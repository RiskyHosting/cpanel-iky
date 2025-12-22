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

export function validateLogin(username, password) {
  return users.some(user => 
    user.username === username && user.password === password
  );
}
