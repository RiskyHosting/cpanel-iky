// api/account.js
import { users } from './user.js';

export function validateLogin(username, password) {
  const user = users.find(u => u.username === username && u.password === password);
  
  // Juga cek admin accounts
  const adminAccounts = [
    { username: 'admin', password: 'admin123' },
    { username: 'Admin', password: 'Admin089' },
    { username: 'risky', password: '4444' }
  ];
  
  const admin = adminAccounts.find(a => a.username === username && a.password === password);
  
  return !!user || !!admin;
}
