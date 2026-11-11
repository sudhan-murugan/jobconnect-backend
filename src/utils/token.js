/**
 * JSON Web Token helpers.
 *
 * A JWT is a signed string the client sends back on every request to prove who
 * it is. The server signs it with JWT_SECRET; anyone can READ the payload, but
 * nobody can CHANGE it without the secret, because the signature would no
 * longer match. So never put secrets in the payload.
 */
const jwt = require('jsonwebtoken');
const config = require('../config/env');

function signToken(user) {
  // "sub" (subject) is the standard JWT claim for "who this token is about".
  return jwt.sign({ sub: user.id }, config.jwtSecret, {
    expiresIn: config.jwtExpiresIn,
    algorithm: 'HS256',
  });
}

// Throws if the token is malformed, tampered with, or expired.
function verifyToken(token) {
  // Pinning the algorithm stops attackers from choosing a weaker one.
  return jwt.verify(token, config.jwtSecret, { algorithms: ['HS256'] });
}

module.exports = { signToken, verifyToken };
