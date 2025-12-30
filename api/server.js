// api/server.js - FINAL SIMPLE VERSION
import { validateLogin } from './account';
import { PANEL_URL, API_KEY, NODE_ID, NEST_ID, EGG_ID, DOCKER_IMG } from './panel';

const loginAttempts = new Map();
const sessionStore = new Map();

function getClientIP(req) {
    return req.headers['x-forwarded-for']?.split(',')[0] || req.connection.remoteAddress;
}

export default async function handler(req, res) {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  
  if (req.method === "GET") {
    try {
      const serverRes = await fetch(`${PANEL_URL}/api/application/servers`, {
        headers: { "Authorization": `Bearer ${API_KEY}`, "Accept": "application/json" }
      });
      const serverData = await serverRes.json();
      return res.json({ success: true, count: serverData.meta?.pagination?.total || 0 });
    } catch (err) {
      return res.json({ success: false, message: err.message });
    }
  }

  if (req.method === "POST") {
    const { action, username, password, name, ram, serverId, session_id } = req.body;

    try {
      // LOGIN
      if (action === "login") {
        if (validateLogin(username, password)) {
          const sessionId = Date.now().toString(36);
          sessionStore.set(sessionId, { username, lastActivity: Date.now() });
          return res.json({ success: true, session_id: sessionId, message: "Login berhasil" });
        }
        return res.json({ success: false, message: "Login gagal!" });
      }

      // LOGOUT
      if (action === "logout") {
        if (session_id) sessionStore.delete(session_id);
        return res.json({ success: true, message: "Logout berhasil" });
      }

      // VERIFY SESSION
      if (action === "verify") {
        if (!session_id || !sessionStore.get(session_id)) {
          return res.json({ success: false, message: "Session expired!" });
        }
        return res.json({ success: true, message: "Session valid" });
      }

      // SESSION CHECK
      if (['create', 'delete', 'list'].includes(action)) {
        if (!session_id || !sessionStore.get(session_id)) {
          return res.json({ success: false, message: "Session diperlukan!" });
        }
      }

      // =========== CREATE SERVER ===========
      if (action === "create") {
        console.log(`Creating server: ${name} with RAM: ${ram}`);
        
        const email = `user${Date.now()}@buyer.bimxyz.com`;
        const userPassword = Math.random().toString(36).slice(-8);

        // 1. BUAT USER
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
          return res.json({ 
            success: false, 
            message: `Gagal buat user: ${userData.errors?.[0]?.detail || JSON.stringify(userData)}` 
          });
        }

        const userId = userData.attributes.id;
        console.log(`User created: ${userData.attributes.username}`);

        // 2. CARI ALLOCATION
        let freeAlloc = null;
        let page = 1;

        while (!freeAlloc && page <= 3) {
          const allocRes = await fetch(`${PANEL_URL}/api/application/nodes/${NODE_ID}/allocations?page=${page}`, {
            headers: { "Authorization": `Bearer ${API_KEY}`, "Accept": "application/json" }
          });

          if (allocRes.ok) {
            const allocData = await allocRes.json();
            freeAlloc = allocData.data?.find(a => !a.attributes.assigned);
          }
          page++;
        }

        if (!freeAlloc) {
          // Hapus user kalo ga ada allocation
          await fetch(`${PANEL_URL}/api/application/users/${userId}`, {
            method: "DELETE",
            headers: { "Authorization": `Bearer ${API_KEY}` }
          }).catch(() => {});
          
          return res.json({ success: false, message: "Ga ada port kosong!" });
        }

        console.log(`Found allocation: ${freeAlloc.attributes.ip}:${freeAlloc.attributes.port}`);

        // 3. AMBIL EGG STARTUP (SIMPLE - NO VARIABLES)
        let startupCmd = "npm start";
        try {
          const eggRes = await fetch(`${PANEL_URL}/api/application/nests/${NEST_ID}/eggs/${EGG_ID}`, {
            headers: { "Authorization": `Bearer ${API_KEY}`, "Accept": "application/json" }
          });
          
          if (eggRes.ok) {
            const eggData = await eggRes.json();
            startupCmd = eggData.attributes.startup || "npm start";
          }
        } catch (e) {
          console.log("Using default startup command");
        }

        // 4. BUAT SERVER
        const limits = ram === 'unlimited' 
          ? { memory: 0, swap: -1, disk: 0, io: 500, cpu: 0 }
          : { 
              memory: parseInt(ram) * 1024, 
              swap: 0, 
              disk: parseInt(ram) * 2048, 
              io: 500, 
              cpu: parseInt(ram) * 100 
            };

        const serverRes = await fetch(`${PANEL_URL}/api/application/servers`, {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${API_KEY}`,
            "Content-Type": "application/json",
            "Accept": "application/json"
          },
          body: JSON.stringify({
            name: name.substring(0, 50),
            user: userId,
            egg: parseInt(EGG_ID),
            docker_image: DOCKER_IMG,
            startup: startupCmd,
            environment: {},
            limits: limits,
            feature_limits: { databases: 1, backups: 1, allocations: 1 },
            allocation: { default: parseInt(freeAlloc.attributes.id) }
          })
        });

        const serverData = await serverRes.json();
        
        if (!serverRes.ok) {
          // Hapus user kalo server gagal
          await fetch(`${PANEL_URL}/api/application/users/${userId}`, {
            method: "DELETE",
            headers: { "Authorization": `Bearer ${API_KEY}` }
          }).catch(() => {});
          
          return res.json({ 
            success: false, 
            message: `Gagal buat server: ${serverData.errors?.[0]?.detail || JSON.stringify(serverData)}` 
          });
        }

        console.log(`Server created: ${serverData.attributes.identifier}`);
        
        return res.json({
          success: true,
          panel: `${PANEL_URL}/server/${serverData.attributes.identifier}`,
          username: userData.attributes.username,
          email: userData.attributes.email,
          password: userPassword,
          ram: ram === 'unlimited' ? 'Unlimited' : `${ram} GB`,
          serverId: serverData.attributes.id
        });
      }

      // LIST SERVERS
      if (action === "list") {
        const serverRes = await fetch(`${PANEL_URL}/api/application/servers`, {
          headers: { "Authorization": `Bearer ${API_KEY}`, "Accept": "application/json" }
        });
        const serverData = await serverRes.json();
        return res.json({ success: true, count: serverData.meta?.pagination?.total || 0 });
      }

      // DELETE SERVER
      if (action === "delete") {
        if (!serverId) {
          return res.json({ success: false, message: "Server ID harus ada!" });
        }

        const delRes = await fetch(`${PANEL_URL}/api/application/servers/${serverId}`, {
          method: "DELETE",
          headers: { "Authorization": `Bearer ${API_KEY}` }
        });

        if (delRes.status === 204) {
          return res.json({ success: true, message: "Server berhasil dihapus" });
        } else {
          return res.json({ success: false, message: "Gagal hapus server" });
        }
      }

      return res.json({ success: false, message: "Action tidak dikenal" });

    } catch (err) {
      console.error("Server error:", err);
      return res.json({ success: false, message: err.message });
    }
  }

  return res.status(405).json({ success: false, message: "Method not allowed" });
}
