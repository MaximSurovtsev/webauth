document.addEventListener('DOMContentLoaded', function() {
	const client = new Client()
	console.log('Oke');

	const namefield = document.querySelector('.name');
	const usernamefield = document.querySelector('.username');
	const regbtn = document.querySelector('.reg');

	regbtn.addEventListener('click', function() {
		let name = namefield.value;
		let username = usernamefield.value;
		if (name && username) {
			let ans = client.register({ name, username });
			ans.then(function(v) {
				if (v.status == 'ok') {
					window.location = '/content';
				}
			})
		}
	})
})


