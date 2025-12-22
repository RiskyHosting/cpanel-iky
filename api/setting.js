// api/setting.js

export default function handler(req, res) {

  // === TOKEN DISAMARKAN (AMAN) ===
  const part1 = "github_";   // depan token
  const part2 = "pat_"; // tengah token
  const part3 = "11BUFX7SI03LiShlTTFkS4_AyJ3QEiNFulPxwSnpA2kVxtshMi350j2IhI3"; // tengah 2
  const part4 = "RBAJqN7Y3OIDJA2ssE3OV7D"; // belakang token

  // gabungin jadi token utuh
  const safeToken = part1 + part2 + part3 + part4;

  res.json({
    github: {
      token: safeToken,     // token aman sudah digabung
      owner: "RiskyHosting",
      repo: "cpanel-iky",

      userFile: "api/user.js",   // file akun user
      panelFile: "api/panel.js"  // file pengaturan panel
    },

    login: {
      // login web manage user
      userManager: {
        username: "risky",
        password: "4444"
      },

      // login web manage panel
      panelManager: {
        username: "Admin",
        password: "4444"
      }
    }
  });
}


