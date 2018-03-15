'use strict';

const assert = require('assert');
const test = require('@charmander/test')(module);

const SessionBox = require('./');

const CSRF_TOKEN = /^[a-p]{30}$/;
const USER_TOKEN = /^[a-p]{32}$/;

const promisifyStrict = f => function (...args) {
	let resolve;
	let reject;

	const promise = new Promise((resolve_, reject_) => {
		resolve = resolve_;
		reject = reject_;
	});

	let called = false;

	f.call(this, ...args, (error, result) => {
		if (called) {
			throw new Error('Callback called multiple times');
		}

		called = true;

		if (error) {
			reject(error);
		} else {
			resolve(result);
		}
	});

	return promise;
};

class MemoryStorage {
	constructor() {
		this._sessions = new Map();
	}

	get(key, callback) {
		process.nextTick(callback, null, this._sessions.get(key.toString('hex')));
	}

	set(key, userId, callback) {
		assert(key instanceof Buffer);
		assert.strictEqual(key.length, 16);

		assert.notEqual(userId, null);

		this._sessions.set(key.toString('hex'), userId);
		process.nextTick(callback, null);
	}

	delete(key, userId, callback) {
		assert.notEqual(userId, null);

		const hexKey = key.toString('hex');

		if (this._sessions.has(hexKey)) {
			assert.strictEqual(this._sessions.get(hexKey), userId);
			this._sessions.delete(hexKey);
		}

		process.nextTick(callback, null);
	}
}

['get', 'update'].forEach(name => {
	Object.defineProperty(SessionBox.prototype, name + 'Async', {
		configurable: true,
		value: promisifyStrict(SessionBox.prototype[name]),
	});
});

const t = (description, func) => {
	test(description, () => {
		const sessions = new SessionBox(new MemoryStorage());
		return func(sessions);
	});
};

const assertNewSession = session => {
	assert.strictEqual(typeof session.newToken, 'string');
	assert(CSRF_TOKEN.test(session.newToken));
	assert.strictEqual(session._storageKey, null);
	assert.strictEqual(session.userId, null);
	assert.strictEqual(session.csrf, session.newToken);
};

t('a user without a session is given a new guest session', async sessions => {
	assertNewSession(await sessions.getAsync(null));
	assertNewSession(await sessions.getAsync(undefined));
});

t('a user with an invalid session token is given a new guest session', async sessions => {
	assertNewSession(await sessions.getAsync(''));
	assertNewSession(await sessions.getAsync('short'));
	assertNewSession(await sessions.getAsync('long' + 'x'.repeat(100)));
});

t('a user with an expired session is given a new guest session', async sessions => {
	assertNewSession(await sessions.getAsync('a'.repeat(32)));
});

t('a guest session can be read', async sessions => {
	const token = 'a'.repeat(30);
	const session = await sessions.getAsync(token);
	assert.strictEqual(session.newToken, null);
	assert.strictEqual(session._storageKey, null);
	assert.strictEqual(session.userId, null);
	assert.strictEqual(session.csrf, token);
});

t('a guest session can be replaced with a new guest session', async sessions => {
	const oldSession = await sessions.getAsync(null);
	const newSession = await sessions.updateAsync(oldSession, null);
	assertNewSession(newSession);
	assert.notStrictEqual(oldSession.csrf, newSession.csrf);
});

t('a guest session can be replaced with a new user session', async sessions => {
	const oldSession = await sessions.getAsync(null);
	const newSession = await sessions.updateAsync(oldSession, 1);
	assert.strictEqual(typeof newSession.newToken, 'string');
	assert(USER_TOKEN.test(newSession.newToken));
	assert.strictEqual(newSession._storageKey.length, 16);
	assert.strictEqual(newSession.userId, 1);
	assert.notStrictEqual(oldSession.csrf, newSession.csrf);
});

t('a user session can be read', async sessions => {
	const guestSession = await sessions.getAsync(null);
	const session = await sessions.updateAsync(guestSession, 1);
	const readSession = await sessions.getAsync(session.newToken);
	assert.strictEqual(readSession.newToken, null);
	assert(readSession._storageKey.equals(session._storageKey));
	assert.strictEqual(readSession.userId, 1);
	assert.strictEqual(readSession.csrf, session.csrf);
});

t('a user session can be replaced with a new user session', async sessions => {
	const guestSession = await sessions.getAsync(null);
	const userSession1 = await sessions.updateAsync(guestSession, 1);
	const userSession2 = await sessions.updateAsync(userSession1, 2);

	assert.strictEqual(typeof userSession2.newToken, 'string');
	assert(USER_TOKEN.test(userSession2.newToken));
	assert.strictEqual(userSession2._storageKey.length, 16);
	assert.strictEqual(userSession2.userId, 2);
	assert.notStrictEqual(userSession2.csrf, userSession1.csrf);

	assertNewSession(await sessions.getAsync(userSession1.newToken));
});

t('a user session can be replaced with a new guest session', async sessions => {
	const guestSession1 = await sessions.getAsync(null);
	const userSession = await sessions.updateAsync(guestSession1, 1);
	const guestSession2 = await sessions.updateAsync(userSession, null);

	assertNewSession(guestSession1);
	assertNewSession(guestSession2);
	assertNewSession(await sessions.getAsync(userSession.newToken));
});
