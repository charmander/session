'use strict';

const crypto = require('crypto');
const tokenifyHex = require('./internal/tokenify-hex');

const USER_TOKEN_BYTES = 16;    // 128 bits; needs to be unguessable and have no collisions
const CSRF_BYTES = 15;          // 120 bits; needs to be unguessable and distinct from USER_TOKEN_BYTES
const STORAGE_KEY_BYTES = 16;   // 128 bits; needs to have no collisions

const USER_TOKEN_LENGTH = 2 * USER_TOKEN_BYTES;
const CSRF_LENGTH = 2 * CSRF_BYTES;

const getStorageKey = token =>
	crypto.createHash('sha256')
		.update(token, 'ascii')
		.digest()
		.slice(0, STORAGE_KEY_BYTES);

const generateToken = byteCount =>
	tokenifyHex(crypto.randomBytes(byteCount));

const getCsrf = token => {
	const csrf =
		crypto.createHmac('sha256', 'csrf')
			.update(token, 'ascii')
			.digest()
			.slice(0, CSRF_BYTES);

	return tokenifyHex(csrf);
};

class Session {
	constructor({token, storageKey, userId, updated}) {
		this.newToken = updated ? token : null;
		this._storageKey = storageKey;
		this.userId = userId;
		this.csrf = userId === null ? token : getCsrf(token);
	}
}

class SessionBox {
	constructor(storage) {
		this.storage = storage;
	}

	_create(userId, callback) {
		if (userId === null) {
			process.nextTick(callback, null, new Session({
				token: generateToken(CSRF_BYTES),
				storageKey: null,
				userId: null,
				updated: true,
			}));
			return;
		}

		const token = generateToken(USER_TOKEN_BYTES);
		const storageKey = getStorageKey(token);

		this.storage.set(storageKey, userId, error => {
			if (error) {
				callback(error, undefined);
				return;
			}

			callback(null, new Session({
				token,
				storageKey,
				userId,
				updated: true,
			}));
		});
	}

	get(token, callback) {
		if (token != null && typeof token !== 'string') {
			throw new TypeError('Token must be a string, null, or undefined');
		}

		if (typeof callback !== 'function') {
			throw new TypeError('Callback must be a function');
		}

		if (token == null || (token.length !== CSRF_LENGTH && token.length !== USER_TOKEN_LENGTH)) {
			this._create(null, callback);
			return;
		}

		if (token.length === CSRF_LENGTH) {
			process.nextTick(callback, null, new Session({
				token,
				storageKey: null,
				userId: null,
				updated: false,
			}));
			return;
		}

		const storageKey = getStorageKey(token);

		this.storage.get(storageKey, (error, userId) => {
			if (error) {
				callback(error, undefined);
				return;
			}

			if (userId == null) {
				this._create(null, callback);
			} else {
				callback(null, new Session({
					token,
					storageKey,
					userId,
					updated: false,
				}));
			}
		});
	}

	update(session, newUserId, callback) {
		if (!(session instanceof Session)) {
			throw new TypeError('Session must be a session');
		}

		if (typeof callback !== 'function') {
			throw new TypeError('Callback must be a function');
		}

		if (session.userId === null) {
			this._create(newUserId, callback);
			return;
		}

		this.storage.delete(session._storageKey, session.userId, error => {
			if (error) {
				callback(error, undefined);
				return;
			}

			this._create(newUserId, callback);
		});
	}
}

module.exports = SessionBox;
