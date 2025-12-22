// api/server.js - MODIFIKASI MINIMAL (FIXED VERSION)
import { validateLogin } from './account';
import { PANEL_URL, API_KEY, NODE_ID, NEST_ID, EGG_ID, DOCKER_IMG } from './panel';

// === SIMPLE RATE LIMITING (Tambah di atas handler) ===
const loginAttempts = new Map();
const sessionStore = new Map(); // Simple session storage

// === UTILITY FUNCTIONS ===
function getClientIP(req) {
    return req.headers['x-forwarded-for']?.split(',')[0] || 
           req.connection.remoteAddress;
}

function cleanupOldSessions() {
    const now = Date.now();
    for (const [sessionId, session] of sessionStore.entries()) {
        if (now - session.lastActivity > 20 * 60 * 1000) { // 20 menit
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
    const { action, username, password, name, ram, serverId, session_id } = req.body;
    const clientIP = getClientIP(req);

    try {
      // 🔐 LOGIN with rate limiting
      if (action === "login") {
        // Rate limiting check
        const attemptKey = `${clientIP}:${username}`;
        const attempts = loginAttempts.get(attemptKey) || { count: 0, timestamp: Date.now() };
        
        // Reset after 15 minutes
        if (Date.now() - attempts.timestamp > 15 * 60 * 1000) {
          attempts.count = 0;
          attempts.timestamp = Date.now();
        }
        
        // Block if too many attempts
        if (attempts.count >= 5) {
          return res.json({ 
            success: false, 
            message: "Terlalu banyak percobaan login. Coba lagi nanti." 
          });
        }
        
        if (validateLogin(username, password)) {
          // Reset attempts on successful login
          loginAttempts.delete(attemptKey);
          
          // Create simple session
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
          // Increment failed attempts
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

      // 🔓 LOGOUT ACTION
      if (action === "logout") {
        if (session_id) {
          sessionStore.delete(session_id);
        }
        return res.json({ success: true, message: "Logout berhasil" });
      }

      // ✅ VERIFY SESSION ACTION
      if (action === "verify") {
        if (!session_id) {
          return res.json({ success: false, message: "Session diperlukan!" });
        }
        
        const session = sessionStore.get(session_id);
        if (!session) {
          return res.json({ success: false, message: "Session expired!" });
        }
        
        // Check session timeout (20 minutes)
        if (Date.now() - session.lastActivity > 20 * 60 * 1000) {
          sessionStore.delete(session_id);
          return res.json({ success: false, message: "Session timeout!" });
        }
        
        // Update last activity
        session.lastActivity = Date.now();
        
        return res.json({ 
          success: true, 
          message: "Session valid",
          user: { username: session.username }
        });
      }

      // 🛡️ CHECK SESSION for other actions (create, delete, list)
      if (action === 'create' || action === 'delete' || action === 'list') {
        if (!session_id) {
          return res.json({ success: false, message: "Session diperlukan!" });
        }
        
        const session = sessionStore.get(session_id);
        if (!session) {
          return res.json({ success: false, message: "Session expired!" });
        }
        
        // Check IP match (optional - bisa di-comment jika troublesome)
        // if (session.ip !== clientIP) {
        //   return res.json({ success: false, message: "Security violation!" });
        // }
        
        // Check session timeout (20 minutes)
        if (Date.now() - session.lastActivity > 20 * 60 * 1000) {
          sessionStore.delete(session_id);
          return res.json({ success: false, message: "Session timeout!" });
        }
        
        // Update last activity
        session.lastActivity = Date.now();
      }

      // 🟩 CREATE SERVER
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
            egg: EGG_ID,
            docker_image: DOCKER_IMG,
            startup: eggData.attributes.startup,
            limits: (() => {
              if (ram === 'unlimited') {
                return { memory: 0, swap: 0, disk: 0, io: 500, cpu: 0 };
              }
              const ramNumber = parseInt(ram);
              return {
                memory: ramNumber * 550,
                swap: 0,
                disk: ramNumber * 550,
                io: 500,
                cpu: ramNumber * 150
              };
            })(),
            environment: env,
            feature_limits: { databases: 1, backups: 1, allocations: 1 },
            allocation: { default: freeAlloc.attributes.id }
          })
        });

        const serverData = await serverRes.json();
        if (!serverRes.ok) {
          return res.json({ success: false, message: JSON.stringify(serverData) });
        }

        return res.json({
          success: true,
          panel: PANEL_URL,
          username: userData.attributes.username,
          email: userData.attributes.email,
          password: userPassword,
          ram,
          serverId: serverData.attributes.id
        });
      }

      // 📋 LIST SERVERS ACTION (tambah ini)
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

      return res.json({ success: false, message: "Action tidak dikenal" });

    } catch (err) {
      return res.json({ success: false, message: err.message });
    }
  }

  return res.status(405).json({ success: false, message: "Method not allowed" });
      }
