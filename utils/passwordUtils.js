// utils/passwordUtils.js
import crypto from 'crypto';

export function hashOpenCartPassword(password, salt) {
  const first = sha1(password);
  const second = sha1(salt + first);
  const third = sha1(salt + second);
  return third;
}

function sha1(str) {
  return crypto.createHash('sha1').update(str).digest('hex');
}
