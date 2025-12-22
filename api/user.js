export const users = [
  {
    "username": "Admin",
    "password": "Admin089"
  },
  {
    "username": "risky",
    "password": "4444"
  }
];

// TAMBAH INI UNTUK VALIDASI LOGIN
export function validateLogin(username, password) {
  // Cek di user database biasa
  const user = users.find(u => u.username === username && u.password === password);
  if (user) return true;
  
  // Juga cek di admin accounts (optional)
  const adminAccounts = [
    { username: 'admin', password: 'admin123' },
    { username: 'Admin', password: 'Admin089' },
    { username: 'risky', password: '4444' }
  ];
  
  const admin = adminAccounts.find(a => a.username === username && a.password === password);
  return !!admin;
}
