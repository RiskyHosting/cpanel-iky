// api/account.js
export const accounts = [
  { username: "risky", password: "risky4444" },
  { username: "risky", password: "reseller123" },
  
  
];

export function validateLogin(username, password) {
  return accounts.some(acc => acc.username === username && acc.password === password);
  }
  
