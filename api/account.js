// api/account.js
import { users } from './user.js';

export const accounts = users;

export function validateLogin(username, password) {
  return accounts.some(acc => acc.username === username && acc.password === password);
}
