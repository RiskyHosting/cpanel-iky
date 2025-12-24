// api/server.js - FULL VERSION
import { validateLogin } from './account';
import { PANEL_URL, API_KEY, NODE_ID, NEST_ID, EGG_ID, DOCKER_IMG } from './panel';

// === ADMIN ACCOUNTS ===
const ADMIN_ACCOUNTS = [
  { username: 'admin', password: 'admin123', role: 'superadmin' },
  { username: 'Admin', password: 'Admin089', role: 'admin' },
  { username: 'risky', password: '4444', role: 'admin' }
];

// === SIMPLE RATE LIMITING ===
const loginAttempts = new Map();
const sessionStore = new Map();

// === UTILITY FUNCTIONS ===
function getClientIP(req) {
    return req.headers['x-forwarded-for']?.split(',')[0] || 
           req.connection.remoteAddress;
}

function cleanupOldSessions() {
    const now = Date.now();
    for (const [sessionId, session] of sessionStore.entries()) {
        if (now - session.lastActivity > 20 * 60 * 1000) {
            sessionStore.delete(sessionId);
        }
    }
}

// Cleanup every 5 minutes
setInterval(cleanupOldSessions, 5 * 60 * 1000);

export default async function handler(req, res) {
  if (req.method === "GET") {
    try {
      const serverRes = await fetch(`${PANEL_URL}/api/application/servers`, {
        method: "GET",
        headers: {
          "Authorization": `Bearer ${API_KEY}`,
          "Accept": "application/json"
        }
      });

      const serverData = await serverRes.json();

      if (!serverRes.ok) {
        return res.json({ success: false, message: JSON.stringify(serverData) });
      }

      return res.json({
        success: true,
        count: serverData.meta.pagination.total
      });

    } catch (err) {
      return res.json({ success: false, message: err.message });
    }
  }

  if (req.method === "POST") {
    const { action, username, password, name, ram, serverId, session_id, account_type, new_username, new_password, email } = req.body;
    const clientIP = getClientIP(req);

    try {
      // 🔐 USER LOGIN
      if (action === "login") {
        const attemptKey = `${clientIP}:${username}`;
        const attempts = loginAttempts.get(attemptKey) || { count: 0, timestamp: Date.now() };
        
        if (Date.now() - attempts.timestamp > 15 * 60 * 1000) {
          attempts.count = 0;
          attempts.timestamp = Date.now();
        }
        
        if (attempts.count >= 5) {
          return res.json({ 
            success: false, 
            message: "Terlalu banyak percobaan login. Coba lagi nanti." 
          });
        }
        
        if (validateLogin(username, password)) {
          loginAttempts.delete(attemptKey);
          
          const sessionId = Date.now().toString(36) + Math.random().toString(36).substr(2);
          sessionStore.set(sessionId, {
            username,
            ip: clientIP,
            createdAt: Date.now(),
            lastActivity: Date.now()
          });
          
          return res.json({ 
            success: true,
            session_id: sessionId,
            message: "Login berhasil"
          });
        } else {
          attempts.count++;
          attempts.timestamp = Date.now();
          loginAttempts.set(attemptKey, attempts);
          
          return res.json({ 
            success: false, 
            message: "Login gagal!",
            attempts_left: 5 - attempts.count
          });
        }
      }

      // 🔐 ADMIN LOGIN
      if (action === "admin_login") {
        const admin = ADMIN_ACCOUNTS.find(
          acc => acc.username === username && acc.password === password
        );
        
        if (admin) {
          const sessionId = 'admin_' + Date.now().toString(36) + Math.random().toString(36).substr(2);
          sessionStore.set(sessionId, {
            username,
            role: admin.role,
            isAdmin: true,
            createdAt: Date.now(),
            lastActivity: Date.now()
          });
          
          return res.json({ 
            success: true, 
            message: 'Admin login successful',
            session_id: sessionId,
            role: admin.role
          });
        } else {
          return res.json({ 
            success: false, 
            message: 'Invalid admin credentials' 
          });
        }
      }

      // 👑 CREATE ADMIN ACCOUNT IN PTERODACTYL
      if (action === "create_admin_account") {
        if (!new_username || new_username.length < 3) {
          return res.json({ 
            success: false, 
            message: "Username minimal 3 karakter" 
          });
        }
        
        if (!new_password || new_password.length < 6) {
          return res.json({ 
            success: false, 
            message: "Password minimal 6 karakter" 
          });
        }
        
        try {
          const userRes = await fetch(`${PANEL_URL}/api/application/users`, {
            method: "POST",
            headers: {
              "Authorization": `Bearer ${API_KEY}`,
              "Content-Type": "application/json",
              "Accept": "application/json"
            },
            body: JSON.stringify({
              email: email || `${new_username}@admin.riskyhosting.com`,
              username: new_username.toLowerCase().replace(/\s+/g, "_"),
              first_name: new_username,
              last_name: account_type === 'admin' ? 'Admin' : 'User',
              password: new_password,
              root_admin: account_type === 'admin',
              language: "en"
            })
          });

          const userData = await userRes.json();
          
          if (!userRes.ok) {
            if (userData.errors?.[0]?.detail?.includes('already exists')) {
              return res.json({ 
                success: false, 
                message: `Username "${new_username}" sudah ada di panel` 
              });
            }
            return res.json({ 
              success: false, 
              message: JSON.stringify(userData.errors || userData) 
            });
          }

          return res.json({
            success: true,
            message: `✅ ${account_type === 'admin' ? 'Admin' : 'User'} account berhasil dibuat!`,
            account: {
              id: userData.attributes.id,
              username: userData.attributes.username,
              password: new_password,
              email: userData.attributes.email,
              type: account_type || 'user',
              is_admin: userData.attributes.root_admin,
              panel_url: `${PANEL_URL}/auth/login`,
              created_at: userData.attributes.created_at
            },
            login_info: `Panel: ${PANEL_URL}/auth/login\nUsername: ${userData.attributes.username}\nPassword: ${new_password}`
          });
          
        } catch (error) {
          return res.json({
            success: false,
            message: `Server error: ${error.message}`
          });
        }
      }

      // 📋 LIST ALL ACCOUNTS FROM PTERODACTYL
      if (action === "list_all_accounts") {
        try {
          const usersRes = await fetch(`${PANEL_URL}/api/application/users`, {
            method: "GET",
            headers: {
              "Authorization": `Bearer ${API_KEY}`,
              "Accept": "application/json"
            }
          });

          const usersData = await usersRes.json();
          
          if (!usersRes.ok) {
            return res.json({ 
              success: false, 
              message: JSON.stringify(usersData) 
            });
          }

          const formattedUsers = usersData.data.map(user => ({
            id: user.attributes.id,
            username: user.attributes.username,
            email: user.attributes.email,
            is_admin: user.attributes.root_admin,
            created_at: user.attributes.created_at,
            first_name: user.attributes.first_name,
            last_name: user.attributes.last_name
          }));

          return res.json({
            success: true,
            total: usersData.meta.pagination.total,
            accounts: formattedUsers
          });
          
        } catch (error) {
          return res.json({
            success: false,
            message: error.message
          });
        }
      }

      // 🔓 LOGOUT
      if (action === "logout") {
        if (session_id) {
          sessionStore.delete(session_id);
        }
        return res.json({ success: true, message: "Logout berhasil" });
      }

      // ✅ VERIFY SESSION
      if (action === "verify") {
        if (!session_id) {
          return res.json({ success: false, message: "Session diperlukan!" });
        }
        
        const session = sessionStore.get(session_id);
        if (!session) {
          return res.json({ success: false, message: "Session expired!" });
        }
        
        if (Date.now() - session.lastActivity > 20 * 60 * 1000) {
          sessionStore.delete(session_id);
          return res.json({ success: false, message: "Session timeout!" });
        }
        
        session.lastActivity = Date.now();
        
        return res.json({ 
          success: true, 
          message: "Session valid",
          user: { username: session.username }
        });
      }

      // 🛡️ CHECK SESSION for other actions
      if (action === 'create' || action === 'delete' || action === 'list') {
        if (!session_id) {
          return res.json({ success: false, message: "Session diperlukan!" });
        }
        
        const session = sessionStore.get(session_id);
        if (!session) {
          return res.json({ success: false, message: "Session expired!" });
        }
        
        if (Date.now() - session.lastActivity > 20 * 60 * 1000) {
          sessionStore.delete(session_id);
          return res.json({ success: false, message: "Session timeout!" });
        }
        
        session.lastActivity = Date.now();
      }

      // 🟩 CREATE SERVER - YANG BENAR INI
      if (action === "create") {
        const email = `user${Date.now()}@buyer.bimxyz.com`;
        const userPassword = Math.random().toString(36).slice(-8);

        // Buat user
        const userRes = await fetch(`${PANEL_URL}/api/application/users`, {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${API_KEY}`,
            "Content-Type": "application/json",
            "Accept": "application/json"
          },
          body: JSON.stringify({
            email,
            username: name.toLowerCase().replace(/\s+/g, "_"),
            first_name: name,
            last_name: "Client",
            password: userPassword,
            root_admin: false
          })
        });

        const userData = await userRes.json();
        if (!userRes.ok) {
          return res.json({ success: false, message: JSON.stringify(userData) });
        }

        const userId = userData.attributes.id;

        // Cari allocation kosong
        let freeAlloc = null;
        let page = 1;

        while (!freeAlloc) {
          const allocRes = await fetch(`${PANEL_URL}/api/application/nodes/${NODE_ID}/allocations?page=${page}`, {
            headers: {
              "Authorization": `Bearer ${API_KEY}`,
              "Accept": "application/json"
            }
          });

          const allocData = await allocRes.json();
          if (!allocRes.ok) {
            return res.json({ success: false, message: JSON.stringify(allocData) });
          }

          freeAlloc = allocData.data.find(a => a.attributes.assigned === false);
          if (freeAlloc) break;

          if (page >= allocData.meta.pagination.total_pages) break;
          page++;
        }

        if (!freeAlloc) {
          return res.json({ success: false, message: "Ga ada allocation kosong!" });
        }

        // Ambil environment variable dari egg
        const eggRes = await fetch(`${PANEL_URL}/api/application/nests/${NEST_ID}/eggs/${EGG_ID}?include=variables`, {
          headers: {
            "Authorization": `Bearer ${API_KEY}`,
            "Accept": "application/json"
          }
        });

        const eggData = await eggRes.json();

        const env = {};
        eggData.attributes.relationships.variables.data.forEach(v => {
          env[v.attributes.env_variable] = v.attributes.default_value || "";
        });

        // 🎯 **BAGIAN YANG DIPERBAIKI: UNLIMITED = 0**
        const limits = (() => {
          if (ram === 'unlimited') {
            return { 
              memory: 0,      // UNLIMITED = 0
              swap: -1,       // -1 untuk unlimited swap
              disk: 0,        // UNLIMITED = 0  
              io: 500, 
              cpu: 0          // UNLIMITED = 0
            };
          }
          
          const ramNumber = parseInt(ram);
          // Konversi yang benar: 1GB = 1024MB
          return {
            memory: ramNumber * 1024,    // Konversi GB ke MB
            swap: 0,
            disk: ramNumber * 2048,      // Disk 2x RAM (dalam MB)
            io: 500,
            cpu: ramNumber * 100         // 100% per GB
          };
        })();

        // Buat server
        const serverRes = await fetch(`${PANEL_URL}/api/application/servers`, {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${API_KEY}`,
            "Content-Type": "application/json",
            "Accept": "application/json"
          },
          body: JSON.stringify({
            name,
            user: userId,
            egg: parseInt(EGG_ID),
            docker_image: DOCKER_IMG,
            startup: eggData.attributes.startup,
            limits: limits,  // Pakai limits yang sudah diperbaiki
            environment: env,
            feature_limits: { databases: 1, backups: 1, allocations: 1 },
            allocation: { default: parseInt(freeAlloc.attributes.id) }
          })
        });

        const serverData = await serverRes.json();
        if (!serverRes.ok) {
          // Coba hapus user jika server gagal
          try {
            await fetch(`${PANEL_URL}/api/application/users/${userId}`, {
              method: "DELETE",
              headers: { "Authorization": `Bearer ${API_KEY}` }
            });
          } catch (e) {}
          
          return res.json({ 
            success: false, 
            message: JSON.stringify(serverData),
            error_type: 'server_creation_failed'
          });
        }

        return res.json({
          success: true,
          panel: `${PANEL_URL}/server/${serverData.attributes.identifier}`,
          username: userData.attributes.username,
          email: userData.attributes.email,
          password: userPassword,
          ram,
          serverId: serverData.attributes.id,
          limits: limits,  // Tambah info limits di response
          allocation: `${freeAlloc.attributes.ip}:${freeAlloc.attributes.port}`
        });
      }

      // 📋 LIST SERVERS
      if (action === "list") {
        const serverRes = await fetch(`${PANEL_URL}/api/application/servers`, {
          method: "GET",
          headers: {
            "Authorization": `Bearer ${API_KEY}`,
            "Accept": "application/json"
          }
        });

        const serverData = await serverRes.json();

        if (!serverRes.ok) {
          return res.json({ success: false, message: JSON.stringify(serverData) });
        }

        return res.json({
          success: true,
          count: serverData.meta.pagination.total
        });
      }

      // ❌ DELETE SERVER
      if (action === "delete") {
        if (!serverId) {
          return res.json({ success: false, message: "Server ID harus ada!" });
        }

        const delRes = await fetch(`${PANEL_URL}/api/application/servers/${serverId}`, {
          method: "DELETE",
          headers: {
            "Authorization": `Bearer ${API_KEY}`,
            "Accept": "application/json"
          }
        });

        if (delRes.status === 204) {
          return res.json({ success: true, message: "Server berhasil dihapus" });
        } else {
          const errData = await delRes.json();
          return res.json({ success: false, message: JSON.stringify(errData) });
        }
      }

      // 📊 SYSTEM STATS
      if (action === "system_stats") {
        try {
          // Get servers count
          const serverRes = await fetch(`${PANEL_URL}/api/application/servers`, {
            method: "GET",
            headers: {
              "Authorization": `Bearer ${API_KEY}`,
              "Accept": "application/json"
            }
          });

          const serverData = await serverRes.json();
          
          // Get users count
          const usersRes = await fetch(`${PANEL_URL}/api/application/users`, {
            method: "GET",
            headers: {
              "Authorization": `Bearer ${API_KEY}`,
              "Accept": "application/json"
            }
          });

          const usersData = await usersRes.json();

          return res.json({
            success: true,
            stats: {
              total_servers: serverData.meta?.pagination?.total || 0,
              total_users: usersData.meta?.pagination?.total || 0,
              admin_users: usersData.data?.filter(u => u.attributes.root_admin)?.length || 0,
              panel_status: serverRes.ok ? "online" : "offline",
              last_update: new Date().toISOString(),
              panel_url: PANEL_URL
            }
          });
          
        } catch (error) {
          return res.json({
            success: false,
            message: error.message
          });
        }
      }

      return res.json({ success: false, message: "Action tidak dikenal" });

    } catch (err) {
      return res.json({ success: false, message: err.message });
    }
  }

  return res.status(405).json({ success: false, message: "Method not allowed" });
            }
