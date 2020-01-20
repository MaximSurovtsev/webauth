const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';
const lookup = new Uint8Array(256);
for (let i = 0; i < chars.length; i++) {
  lookup[chars.charCodeAt(i)] = i;
}

class lib {
  static encode (arraybuffer) {
    let bytes = new Uint8Array(arraybuffer),
      i, len = bytes.length, base64url = '';

    for (i = 0; i < len; i += 3) {
      base64url += chars[bytes[i] >> 2];
      base64url += chars[((bytes[i] & 3) << 4) | (bytes[i + 1] >> 4)];
      base64url += chars[((bytes[i + 1] & 15) << 2) | (bytes[i + 2] >> 6)];
      base64url += chars[bytes[i + 2] & 63];
    }

    if ((len % 3) === 2) {
      base64url = base64url.substring(0, base64url.length - 1);
    } else if (len % 3 === 1) {
      base64url = base64url.substring(0, base64url.length - 2);
    }

    return base64url;
  }

  static decode (base64string) {
    let bufferLength = base64string.length * 0.75,
      len = base64string.length, i, p = 0,
      encoded1, encoded2, encoded3, encoded4;

    let bytes = new Uint8Array(bufferLength);

    for (i = 0; i < len; i += 4) {
      encoded1 = lookup[base64string.charCodeAt(i)];
      encoded2 = lookup[base64string.charCodeAt(i + 1)];
      encoded3 = lookup[base64string.charCodeAt(i + 2)];
      encoded4 = lookup[base64string.charCodeAt(i + 3)];

      bytes[p++] = (encoded1 << 2) | (encoded2 >> 4);
      bytes[p++] = ((encoded2 & 15) << 4) | (encoded3 >> 2);
      bytes[p++] = ((encoded3 & 3) << 6) | (encoded4 & 63);
    }

    return bytes.buffer
  }
}

window.base64url = lib

class Client {
  constructor (options = {}) {
    const defaults = {
      pathPrefix: '/webauthn',
      credentialEndpoint: '/register',
      assertionEndpoint: '/login',
      challengeEndpoint: '/response',
      logoutEndpoint: '/logout',
    }

    Object.assign(this, defaults, options)
  }

  static publicKeyCredentialToJSON (pubKeyCred) {
    if (ArrayBuffer.isView(pubKeyCred)) {
      return Client.publicKeyCredentialToJSON(pubKeyCred.buffer)
    }

    if (pubKeyCred instanceof Array) {
      const arr = []

      for (let i of pubKeyCred) {
        arr.push(Client.publicKeyCredentialToJSON(i))
      }

      return arr
    }

    if (pubKeyCred instanceof ArrayBuffer) {
      return base64url.encode(pubKeyCred)
    }

    if (pubKeyCred instanceof Object) {
      const obj = {}

      for (let key in pubKeyCred) {
        obj[key] = Client.publicKeyCredentialToJSON(pubKeyCred[key])
      }

      return obj
    }

    return pubKeyCred
  }

  static generateRandomBuffer (len) {
    const buf = new Uint8Array(len || 32)
    window.crypto.getRandomValues(buf)
    return buf
  }

  static preformatMakeCredReq (makeCredReq) {
    makeCredReq.challenge = base64url.decode(makeCredReq.challenge)
    makeCredReq.user.id = base64url.decode(makeCredReq.user.id)
    return makeCredReq
  }

  static preformatGetAssertReq (getAssert) {
    getAssert.challenge = base64url.decode(getAssert.challenge)

    for (let allowCred of getAssert.allowCredentials) {
      allowCred.id = base64url.decode(allowCred.id)
    }

    return getAssert
  }

  async getMakeCredentialsChallenge (formBody) {
    const response = await fetch(`${this.pathPrefix}${this.credentialEndpoint}`, {
      method: 'POST',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(formBody)
    })

    if (response.status === 403) {
      const failureMessage = (await response.json()).message
      const errorMessage = 'Registration failed'
      throw new Error(failureMessage ? `${errorMessage}: ${failureMessage}.` : `${errorMessage}.`)
    }

    if (response.status < 200 || response.status > 205) {
      throw new Error('Server responded with error.')
    }

    return await response.json()
  }

  async sendWebAuthnResponse (body) {
    console.log(`${this.pathPrefix}${this.challengeEndpoint}`);
    const response = await fetch(`${this.pathPrefix}${this.challengeEndpoint}`, {
      method: 'POST',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(body)
    })

    if (response.status !== 200) {
      throw new Error('Server responded with error.')
    }

    

    return await response.json()
  }

  async getGetAssertionChallenge (formBody) {
    const response = await fetch(`${this.pathPrefix}${this.assertionEndpoint}`, {
      method: 'POST',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(formBody)
    })

    if (response.status !== 200) {
      throw new Error('Server responded with error.')
    }

    return await response.json()
  }

  async register (data = {}) {
    try {
      const challenge = await this.getMakeCredentialsChallenge(data)
      console.log('REGISTER CHALLENGE', challenge)

      const publicKey = Client.preformatMakeCredReq(challenge)
      console.log('REGISTER PUBLIC KEY', publicKey)

      const credential = await navigator.credentials.create({ publicKey })
      console.log('REGISTER CREDENTIAL', credential)

      const credentialResponse = Client.publicKeyCredentialToJSON(credential)
      console.log('REGISTER RESPONSE', credentialResponse)

      let status = await this.sendWebAuthnResponse(credentialResponse);
      if (status.status == 'ok') {
        // const response = await fetch(`/content`, {
        //   method: 'GET',
        //   credentials: 'include',
        // });
      }
      return status;

    } catch (err) {
      console.error(err)
    }
  }

  async login (data = {}) {
    try {
      const challenge = await this.getGetAssertionChallenge(data)
      console.log('LOGIN CHALLENGE', challenge)

      const publicKey = Client.preformatGetAssertReq(challenge)
      console.log('LOGIN PUBLIC KEY', publicKey)

      const credential = await navigator.credentials.get({ publicKey })
      console.log('LOGIN CREDENTIAL', credential)

      const credentialResponse = Client.publicKeyCredentialToJSON(credential)
      console.log('LOGIN RESPONSE', credentialResponse)

      return await this.sendWebAuthnResponse(credentialResponse)

    } catch (err) {
      console.error(err)
    }
  }

  async logout () {
    const response = await fetch(`${this.pathPrefix}${this.logoutEndpoint}`, {
      method: 'GET',
      credentials: 'include',
    })

    if (response.status !== 200) {
      throw new Error('Server responded with error.')
    }

    return await response.json()
  }
}