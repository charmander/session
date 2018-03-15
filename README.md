[![Build status][ci image]][ci]


## API

**Session tokens** are secret strings consisting of 32 ASCII characters in the range `a` through `p`.

**CSRF tokens** are secret strings constisting of 30 ASCII characters in the range `a` through `p`.

**Storage keys** are 16-byte `Buffer` values that don’t need to be treated as secret.

**User ids** are non-`null`/`undefined` values otherwise free to be defined by the user of the `SessionBox`.


- `new SessionBox(storage)`

- `SessionBox#get(token, callback)`

  Gets a session based on a token. The session token can change after this operation, indicated by a non-null `newToken` property. Pass `null` if no token was provided.

- `SessionBox#update(session, newUserId, callback)`

  Updates a session obtained from `SessionBox#get` with a new user id. The session token will always change after this operation, and the old session will be invalidated. Pass `null` to update to a guest session.


### Sessions

Sessions have the following public properties:

- `newToken`

  A new session token to return to the client, or `null` if the existing session token remains valid.

- `userId`

  The user id associated with the session. `null` represents a guest session.

- `csrf`

  The CSRF token associated with the session.


### Storage

A storage implementation should provide these methods:

- `get(key, callback)`

  Retrieves a user id based on a key. The callback has two parameters: `error, userId`.

  If the key does not exist, the retrieved value should be `null` (but `undefined` is also accepted).

- `set(key, userId, callback)`

  Associates a user id with a key. The callback has one parameter: `error`.

  The key will not already exist.

- `delete(key, userId, callback)`

  Disassociates a user id from a key. The id is provided in case the storage maintains a set of keys for each user (e.g. for the purposes of invalidating all of a user’s sessions). The callback has one parameter: `error`.

  If the key does not exist, no error should be produced.


  [ci]: https://travis-ci.com/charmander/session
  [ci image]: https://api.travis-ci.com/charmander/session.svg?branch=master
