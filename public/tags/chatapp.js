riot.tag2('chatapp', '', '', '', function(opts) {
		'use strict';

		function RiotChat() {

			this.messageList = document.getElementById('messages');
			this.messageForm = document.getElementById('message-form');
			this.messageInput = document.getElementById('message');
			this.submitButton = document.getElementById('submit');
			this.submitImageButton = document.getElementById('submitImage');
			this.imageForm = document.getElementById('image-form');
			this.mediaCapture = document.getElementById('mediaCapture');
			this.userPic = document.getElementById('user-pic');
			this.userName = document.getElementById('user-name');
			this.signInButton = document.getElementById('sign-in');
			this.signOutButton = document.getElementById('sign-out');
			this.signInSnackbar = document.getElementById('must-signin-snackbar');

			this.messageForm.addEventListener('submit', this.saveMessage.bind(this));
			this.signOutButton.addEventListener('click', this.signOut.bind(this));
			this.signInButton.addEventListener('click', this.signIn.bind(this));

			var buttonTogglingHandler = this.toggleButton.bind(this);
			this.messageInput.addEventListener('keyup', buttonTogglingHandler);
			this.messageInput.addEventListener('change', buttonTogglingHandler);

			this.submitImageButton.addEventListener('click', function() {
				this.mediaCapture.click();
			}.bind(this));
			this.mediaCapture.addEventListener('change', this.saveImageMessage.bind(this));

			this.initFirebase();
		}

		RiotChat.prototype.initFirebase = function() {

			this.auth = firebase.auth();
			this.database = firebase.database();
			this.storage = firebase.storage();

			this.auth.onAuthStateChanged(this.onAuthStateChanged.bind(this));
		};

		RiotChat.prototype.loadMessages = function() {

			this.messagesRef = this.database.ref('messages');

			this.messagesRef.off();

			var setMessage = function(data) {
				var val = data.val();
				this.displayMessage(data.key, val.name, val.text, val.photoUrl, val.imageUrl);
			}.bind(this);
			this.messagesRef.limitToLast(20).on('child_added', setMessage);
			this.messagesRef.limitToLast(20).on('child_changed', setMessage);
		};

		RiotChat.prototype.saveMessage = function(e) {
			e.preventDefault();

			if (this.messageInput.value && this.checkSignedInWithMessage()) {
				var currentUser = this.auth.currentUser;

				this.messagesRef.push({
					name: currentUser.displayName,
					text: this.messageInput.value,
					photoUrl: currentUser.photoURL || '/images/profile_placeholder.png'
				}).then(function() {

					RiotChat.resetMaterialTextfield(this.messageInput);
					this.toggleButton();
				}.bind(this)).catch(function(error) {
					console.error('Error writing new message to Firebase Database', error);
				});
			}
		};

		RiotChat.prototype.setImageUrl = function(imageUri, imgElement) {
			imgElement.src = imageUri;

			if (imageUri.startsWith('gs://')) {
				imgElement.src = RiotChat.LOADING_IMAGE_URL;
				this.storage.refFromURL(imageUri).getMetadata().then(function(metadata) {
					imgElement.src = metadata.downloadURLs[0];
				});
			} else {
				imgElement.src = imageUri;
			}
		};

		RiotChat.prototype.saveImageMessage = function(event) {
			var file = event.target.files[0];

			this.imageForm.reset();

			if (!file.type.match('image.*')) {
				var data = {
					message: 'You can only share images',
					timeout: 2000
				};
				this.signInSnackbar.MaterialSnackbar.showSnackbar(data);
				return;
			}

			if (this.checkSignedInWithMessage()) {

				var currentUser = this.auth.currentUser;
				this.messagesRef.push({
					name: currentUser.displayName,
					imageUrl: RiotChat.LOADING_IMAGE_URL,
					photoUrl: currentUser.photoURL || '/images/profile_placeholder.png'
				}).then(function(data) {

					this.storage.ref(currentUser.uid + '/' + Date.now() + '/' + file.name)
					.put(file, {contentType: file.type})
					.then(function(snapshot) {

						var filePath = snapshot.metadata.fullPath;
						data.update({imageUrl: this.storage.ref(filePath).toString()});
					}.bind(this)).catch(function(error) {
						console.error('There was an error uploading a file to Firebase Storage:', error);
					});
				}.bind(this));
			}
		};

		RiotChat.prototype.signIn = function() {

			var provider = new firebase.auth.GoogleAuthProvider();
			this.auth.signInWithPopup(provider);
		};

		RiotChat.prototype.signOut = function() {

			this.auth.signOut();
		};

		RiotChat.prototype.onAuthStateChanged = function(user) {
			if (user) {

				var profilePicUrl = user.photoURL;
				var userName = user.displayName;

				this.userPic.style.backgroundImage = 'url(' + profilePicUrl + ')';
				this.userName.textContent = userName;

				this.userName.removeAttribute('hidden');
				this.userPic.removeAttribute('hidden');
				this.signOutButton.removeAttribute('hidden');

				this.signInButton.setAttribute('hidden', 'true');

				this.loadMessages();
			} else {

				this.userName.setAttribute('hidden', 'true');
				this.userPic.setAttribute('hidden', 'true');
				this.signOutButton.setAttribute('hidden', 'true');

				this.signInButton.removeAttribute('hidden');
			}
		};

		RiotChat.prototype.checkSignedInWithMessage = function() {

			if (this.auth.currentUser) {
				return true;
			}

			var data = {
				message: 'You must sign-in first',
				timeout: 2000
			};
			this.signInSnackbar.MaterialSnackbar.showSnackbar(data);
			return false;
		};

		RiotChat.resetMaterialTextfield = function(element) {
			element.value = '';
			element.parentNode.MaterialTextfield.boundUpdateClassesHandler();
		};

		RiotChat.MESSAGE_TEMPLATE =
			'<div class="message-container">' +
			'<div class="spacing"><div class="pic"></div></div>' +
			'<div class="message"></div>' +
			'<div class="name"></div>' +
			'</div>';

		RiotChat.LOADING_IMAGE_URL = 'https://www.google.com/images/spin-32.gif';

		RiotChat.prototype.displayMessage = function(key, name, text, picUrl, imageUri) {
			var div = document.getElementById(key);

			if (!div) {
				var container = document.createElement('div');
				container.innerHTML = RiotChat.MESSAGE_TEMPLATE;
				div = container.firstChild;
				div.setAttribute('id', key);
				this.messageList.appendChild(div);
			}
			if (picUrl) {
				div.querySelector('.pic').style.backgroundImage = 'url(' + picUrl + ')';
			}
			div.querySelector('.name').textContent = name;
			var messageElement = div.querySelector('.message');
			if (text) {
				messageElement.textContent = text;

				messageElement.innerHTML = messageElement.innerHTML.replace(/\n/g, '<br>');
			} else if (imageUri) {
				var image = document.createElement('img');
				image.addEventListener('load', function() {
					this.messageList.scrollTop = this.messageList.scrollHeight;
				}.bind(this));
				this.setImageUrl(imageUri, image);
				messageElement.innerHTML = '';
				messageElement.appendChild(image);
			}

			setTimeout(function() {div.classList.add('visible')}, 1);
			this.messageList.scrollTop = this.messageList.scrollHeight;
			this.messageInput.focus();
		};

		RiotChat.prototype.toggleButton = function() {
			if (this.messageInput.value) {
				this.submitButton.removeAttribute('disabled');
			} else {
				this.submitButton.setAttribute('disabled', 'true');
			}
		};

		window.onload = function() {
			window.riotChat = new RiotChat();
		};
});