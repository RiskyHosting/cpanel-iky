// api/account.js
import { users } from './user.js';

export function validateLogin(username, password) {
  return users.some(user => 
    user.username === username && user.password === password
  );
}
