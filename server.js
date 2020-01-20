const path = require('path')
const express = require('express')
const bodyParser = require('body-parser')
const session = require('express-session')
const Webauthn = require('webauthn')
const LevelAdapter = require('webauthn/src/LevelAdapter')

const app = express()

app.use(session({
  secret: 'keyboard cat',
  saveUninitialized: true,
  resave: false,
  cookie: {
    maxAge: 24 * 60 * 60 * 1000, 
  },
}))

app.use(express.static(path.join(__dirname)))

app.use(bodyParser.urlencoded({ extended: true }))
app.use(bodyParser.json())

const webauthn = new Webauthn({
  origin: 'http://localhost:3000',
  usernameField: 'username',
  userFields: {
    username: 'username',
    name: 'displayName',
  },
  store: new LevelAdapter('db'),
  rpName: 'Stranger Labs, Inc.',
})

const r = webauthn.initialize()
app.use('/webauthn', r)

app.use(function (req, res, next) {
  console.log(req.originalUrl);
  next();
});

app.get('/content', webauthn.authenticate(), (req, res) => {
  return res.sendFile(path.join(__dirname, 'content.html')); 
})

app.get('/login', (req, res) => {
  return res.sendFile(path.join(__dirname, 'login.html')); 
})

app.get('/', (req, res) => {
  return res.sendFile(path.join(__dirname, 'reg.html'));  
})

const port = process.env.PORT || 3000;
app.listen(port, () => {
  console.log('Listening on port', port)
})




