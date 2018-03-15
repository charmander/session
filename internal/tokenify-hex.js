/*
 * Creates a token from a buffer in time independent of the buffer’s contents for use in cookies, HTML, and URL-encoded values. (Not an issue? Replace with `.toString('base64')` when proved for shorter tokens.)
 */
'use strict';

// a through p – 16 consecutive ASCII characters that can appear in cookies, HTML, and URL-encoded values unescaped, and that browsers won’t escape in form data (this prevents base-32 ^ through })
const OFFSET = 0x61;

const tokenifyHex = buffer => {
	const token = Buffer.alloc(2 * buffer.length);

	for (let i = 0; i < buffer.length; i++) {
		const b = buffer[i];
		token[2 * i] = OFFSET + (b >>> 4);
		token[2 * i + 1] = OFFSET + (b & 0xf);
	}

	return token.toString('ascii');
};

module.exports = tokenifyHex;
