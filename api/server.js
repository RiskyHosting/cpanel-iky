// api/server.js - FULL VERSION FIXED
import { validateLogin } from './account';
import { PANEL_URL, API_KEY, NODE_ID, NEST_ID, EGG_ID, DOCKER_IMG } from './panel';

// === ADMIN ACCOUNTS ===
const ADMIN_ACCOUNTS = [
  { username: 'admin', password: 'admin123', role: 'superadmin' },
  { username: 'Admin', password: 'Admin089', role: 'admin' },
  { username: 'risky', password: '4444', role: 'admin' }
];

// === SESSION MANAGEMENT ===
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

setInterval(cleanupOldSessions, 5 * 60 * 1000);

export default async function handler(req, res) {
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

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
        return res.json({ 
          success: false, 
          message: "Failed to fetch servers",
          error: serverData 
        });
      }

      return res.json({
        success: true,
        count: serverData.meta.pagination.total
      });

    } catch (err) {
      return res.json({ 
        success: false, 
        message: "Server connection error",
        error: err.message 
      });
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

      // 👑 CREATE ADMIN ACCOUNT
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

      // 📋 LIST ALL ACCOUNTS
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

      // ==================== 🟩 CREATE SERVER - FIXED VERSION ====================
      if (action === "create") {
        console.log(`[CREATE SERVER] Starting process for: ${name} with RAM: ${ram}`);
        
        const email = `user${Date.now()}@buyer.bimxyz.com`;
        const userPassword = Math.random().toString(36).slice(-8);

        try {
          // 1. BUAT USER DI PTERODACTYL
          console.log(`[1/6] Creating user: ${name}`);
          const userRes = await fetch(`${PANEL_URL}/api/application/users`, {
            method: "POST",
            headers: {
              "Authorization": `Bearer ${API_KEY}`,
              "Content-Type": "application/json",
              "Accept": "application/json"
            },
            body: JSON.stringify({
              email,
              username: name.toLowerCase().replace(/[^a-z0-9_]/g, "_").substring(0, 20),
              first_name: name.substring(0, 30),
              last_name: "Client",
              password: userPassword,
              root_admin: false,
              language: "en"
            })
          });

          const userData = await userRes.json();
          
          if (!userRes.ok) {
            console.error(`User creation failed:`, userData);
            return res.json({ 
              success: false, 
              message: `Gagal buat user: ${userData.errors?.[0]?.detail || JSON.stringify(userData)}` 
            });
          }

          const userId = userData.attributes.id;
          console.log(`✅ User created: ${userData.attributes.username} (ID: ${userId})`);

          // 2. CARI ALLOCATION KOSONG
          console.log(`[2/6] Finding free allocation...`);
          let freeAlloc = null;
          let page = 1;
          const MAX_PAGES = 3;

          while (!freeAlloc && page <= MAX_PAGES) {
            try {
              const allocRes = await fetch(`${PANEL_URL}/api/application/nodes/${NODE_ID}/allocations?page=${page}&per_page=50`, {
                headers: {
                  "Authorization": `Bearer ${API_KEY}`,
                  "Accept": "application/json"
                }
              });

              if (!allocRes.ok) {
                const allocError = await allocRes.json();
                throw new Error(`Allocation error: ${JSON.stringify(allocError)}`);
              }

              const allocData = await allocRes.json();
              
              // Cari allocation yang belum dipakai
              freeAlloc = allocData.data?.find(a => !a.attributes.assigned);
              
              if (!freeAlloc && page >= (allocData.meta?.pagination?.total_pages || 1)) {
                break;
              }
              
              page++;
              
            } catch (allocErr) {
              console.error("Error mencari allocation:", allocErr);
              break;
            }
          }

          if (!freeAlloc) {
            console.log(`❌ No free allocation found, deleting user...`);
            // Hapus user
            try {
              await fetch(`${PANEL_URL}/api/application/users/${userId}`, {
                method: "DELETE",
                headers: { "Authorization": `Bearer ${API_KEY}` }
              });
            } catch (deleteErr) {}
            
            return res.json({ 
              success: false, 
              message: "❌ Tidak ada port (allocation) kosong di node ini!" 
            });
          }

          console.log(`✅ Found free allocation: ${freeAlloc.attributes.ip}:${freeAlloc.attributes.port}`);

          // 3. AMBIL EGG DETAIL (NODE.JS EGG 15)
          console.log(`[3/6] Fetching egg details...`);
          let eggVariables = {};
          let startupCmd = "";
          
          try {
            const eggRes = await fetch(`${PANEL_URL}/api/application/nests/${NEST_ID}/eggs/${EGG_ID}?include=variables`, {
              headers: {
                "Authorization": `Bearer ${API_KEY}`,
                "Accept": "application/json"
              }
            });

            if (eggRes.ok) {
              const eggData = await eggRes.json();
              startupCmd = eggData.attributes.startup || "npm start";
              console.log(`Egg startup: ${startupCmd}`);
              
              // Environment variables khusus untuk Node.js
              if (eggData.attributes.relationships?.variables?.data) {
                eggData.attributes.relationships.variables.data.forEach(v => {
                  eggVariables[v.attributes.env_variable] = v.attributes.default_value || "";
                });
              }
            }
          } catch (eggErr) {
            console.warn(`Warning: Gagal ambil egg details, using defaults`);
          }

          // 4. SET DEFAULT ENV VARIABLES UNTUK NODE.JS
          // Ini penting! Node.js egg butuh variabel ini
          const defaultEnv = {
            NODE_VERSION: "20",
            NPM_VERSION: "latest",
            STARTUP_CMD: "npm start",
            USER_UPLOAD: "0",
            AUTO_UPDATE: "0",
            ...eggVariables
          };

          // 5. HITUNG LIMITS (FIX: Unlimited = 0)
          console.log(`[4/6] Calculating limits for RAM: ${ram}`);
          const ramNumber = ram === 'unlimited' ? 1 : parseInt(ram);
          
          const limits = {
            memory: ram === 'unlimited' ? 0 : ramNumber * 1024, // MB (0 = unlimited)
            swap: ram === 'unlimited' ? -1 : 0, // -1 = unlimited
            disk: ram === 'unlimited' ? 0 : ramNumber * 2048, // MB (0 = unlimited)
            io: 500,
            cpu: ram === 'unlimited' ? 0 : Math.min(ramNumber * 100, 400), // % (0 = unlimited)
            threads: null,
            oom_disabled: false
          };

          console.log(`Limits:`, limits);

          // 6. BUAT SERVER
          console.log(`[5/6] Creating server...`);
          const serverPayload = {
            name: name.substring(0, 50),
            description: `Dibuat via Risky Hosting Panel - ${new Date().toLocaleDateString()}`,
            user: parseInt(userId),
            egg: parseInt(EGG_ID),
            docker_image: DOCKER_IMG,
            startup: startupCmd,
            environment: defaultEnv,
            limits: limits,
            feature_limits: {
              databases: 1,
              backups: 1,
              allocations: 1
            },
            allocation: {
              default: parseInt(freeAlloc.attributes.id),
              additional: []
            },
            deploy: {
              locations: [parseInt(NODE_ID)],
              dedicated_ip: false,
              port_range: []
            },
            start_on_completion: true,
            skip_scripts: false
          };

          console.log(`Server payload prepared`);

          const serverRes = await fetch(`${PANEL_URL}/api/application/servers`, {
            method: "POST",
            headers: {
              "Authorization": `Bearer ${API_KEY}`,
              "Content-Type": "application/json",
              "Accept": "application/json"
            },
            body: JSON.stringify(serverPayload)
          });

          const serverData = await serverRes.json();
          
          // 7. HANDLE RESPONSE
          if (!serverRes.ok) {
            console.error(`❌ Server creation failed:`, serverData);
            
            // Hapus user jika server gagal
            try {
              await fetch(`${PANEL_URL}/api/application/users/${userId}`, {
                method: "DELETE",
                headers: { "Authorization": `Bearer ${API_KEY}` }
              });
            } catch (deleteErr) {}
            
            const errorDetail = serverData.errors?.[0]?.detail || JSON.stringify(serverData);
            return res.json({ 
              success: false, 
              message: `❌ Gagal buat server: ${errorDetail}`,
              error_details: serverData
            });
          }

          console.log(`[6/6] ✅ Server created successfully! ID: ${serverData.attributes.id}`);

          // 8. KIRIM RESPONSE
          return res.json({
            success: true,
            message: "✅ Server berhasil dibuat!",
            panel: `${PANEL_URL}/server/${serverData.attributes.identifier}`,
            username: userData.attributes.username,
            email: userData.attributes.email,
            password: userPassword,
            ram: ram === 'unlimited' ? 'Unlimited' : `${ram} GB`,
            serverId: serverData.attributes.id,
            identifier: serverData.attributes.identifier,
            allocation: {
              ip: freeAlloc.attributes.ip,
              port: freeAlloc.attributes.port
            },
            limits: {
              memory: limits.memory === 0 ? 'Unlimited' : `${limits.memory} MB`,
              disk: limits.disk === 0 ? 'Unlimited' : `${limits.disk} MB`,
              cpu: limits.cpu === 0 ? 'Unlimited' : `${limits.cpu}%`
            },
            note: "Server sedang diproses. Tunggu 1-2 menit untuk instalasi."
          });

        } catch (processErr) {
          console.error(`❌ Error in server creation:`, processErr);
          return res.json({
            success: false,
            message: `❌ Error sistem: ${processErr.message}`
          });
        }
      }

      // ==================== 📋 LIST SERVERS ====================
      if (action === "list") {
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
            return res.json({ 
              success: false, 
              message: "Gagal ambil data server",
              detail: serverData.errors?.[0]?.detail 
            });
          }

          return res.json({
            success: true,
            count: serverData.meta?.pagination?.total || 0,
            servers: serverData.data?.map(s => ({
              id: s.attributes.id,
              name: s.attributes.name,
              identifier: s.attributes.identifier,
              status: s.attributes.status || 'unknown'
            })) || []
          });
          
        } catch (err) {
          return res.json({ 
            success: false, 
            message: "Error koneksi ke panel",
            detail: err.message 
          });
        }
      }

      // ==================== ❌ DELETE SERVER ====================
      if (action === "delete") {
        if (!serverId) {
          return res.json({ success: false, message: "Server ID harus ada!" });
        }

        try {
          const delRes = await fetch(`${PANEL_URL}/api/application/servers/${serverId}`, {
            method: "DELETE",
            headers: {
              "Authorization": `Bearer ${API_KEY}`,
              "Accept": "application/json"
            }
          });

          if (delRes.status === 204) {
            return res.json({ 
              success: true, 
              message: "Server berhasil dihapus" 
            });
          } else {
            const errData = await delRes.json();
            return res.json({ 
              success: false, 
              message: `Gagal hapus: ${JSON.stringify(errData)}` 
            });
          }
          
        } catch (err) {
          return res.json({ 
            success: false, 
            message: "Error koneksi",
            detail: err.message 
          });
        }
      }

      // ==================== 📊 SYSTEM STATS ====================
      if (action === "system_stats") {
        try {
          const [serverRes, usersRes] = await Promise.all([
            fetch(`${PANEL_URL}/api/application/servers`, {
              headers: { "Authorization": `Bearer ${API_KEY}`, "Accept": "application/json" }
            }),
            fetch(`${PANEL_URL}/api/application/users`, {
              headers: { "Authorization": `Bearer ${API_KEY}`, "Accept": "application/json" }
            })
          ]);

          const [serverData, usersData] = await Promise.all([
            serverRes.ok ? serverRes.json() : { meta: { pagination: { total: 0 } } },
            usersRes.ok ? usersRes.json() : { meta: { pagination: { total: 0 } }, data: [] }
          ]);

          const adminUsers = (usersData.data || []).filter(u => u.attributes.root_admin).length;

          return res.json({
            success: true,
            stats: {
              total_servers: serverData.meta?.pagination?.total || 0,
              total_users: usersData.meta?.pagination?.total || 0,
              admin_users: adminUsers,
              panel_status: "online",
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

      // ==================== UNKNOWN ACTION ====================
      return res.status(400).json({ 
        success: false, 
        message: "Action tidak dikenal" 
      });

    } catch (err) {
      console.error("Global error:", err);
      return res.status(500).json({ 
        success: false, 
        message: "Internal server error",
        detail: err.message 
      });
    }
  }

  // ==================== METHOD NOT ALLOWED ====================
  return res.status(405).json({ 
    success: false, 
    message: "Method not allowed" 
  });
}
