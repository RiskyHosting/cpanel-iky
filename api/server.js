// api/server.js - FIXED VERSION (UNLIMITED = 0)
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

// ==================== 🟩 CREATE SERVER - FIXED ====================
if (action === "create") {
    const email = `${name}@buyer.nation.id`;
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
            message: `Gagal buat user: ${JSON.stringify(userData.errors || userData)}` 
        });
    }

    const userId = userData.attributes.id;

    // 2. CARI ALLOCATION KOSONG
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
            return res.json({ 
                success: false, 
                message: `Gagal ambil allocation: ${JSON.stringify(allocData)}` 
            });
        }

        freeAlloc = allocData.data.find(a => a.attributes.assigned === false);
        if (freeAlloc) break;

        if (page >= allocData.meta.pagination.total_pages) break;
        page++;
    }

    if (!freeAlloc) {
        // Hapus user
        await fetch(`${PANEL_URL}/api/application/users/${userId}`, {
            method: "DELETE",
            headers: { "Authorization": `Bearer ${API_KEY}` }
        }).catch(() => {});
        
        return res.json({ 
            success: false, 
            message: "❌ Tidak ada port (allocation) kosong!" 
        });
    }

    // 3. AMBIL EGG VARIABLES
    const eggRes = await fetch(`${PANEL_URL}/api/application/nests/${NEST_ID}/eggs/${EGG_ID}?include=variables`, {
        headers: {
            "Authorization": `Bearer ${API_KEY}`,
            "Accept": "application/json"
        }
    });

    const eggData = await eggRes.json();

    const env = {};
    if (eggData.attributes.relationships?.variables?.data) {
        eggData.attributes.relationships.variables.data.forEach(v => {
            env[v.attributes.env_variable] = v.attributes.default_value || "";
        });
    }

    // 4. BUAT SERVER DENGAN LIMIT YANG BENAR (UNLIMITED = 0)
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
            startup: eggData.attributes.startup || "",
            
            // === INI YANG BENAR: UNLIMITED = 0 ===
            limits: {
                memory: (() => {
                    if (ram === 'unlimited') return 0; // UNLIMITED = 0
                    return parseInt(ram) * 1024; // Konversi GB ke MB
                })(),
                swap: (ram === 'unlimited') ? -1 : 0, // -1 untuk unlimited swap
                disk: (() => {
                    if (ram === 'unlimited') return 0; // UNLIMITED = 0
                    return parseInt(ram) * 2048; // 2x RAM untuk disk
                })(),
                io: 500,
                cpu: (() => {
                    if (ram === 'unlimited') return 0; // UNLIMITED = 0
                    return parseInt(ram) * 100; // 100% per GB
                })()
            },
            // ======================================
            
            environment: env,
            feature_limits: { 
                databases: 1, 
                backups: 1, 
                allocations: 1 
            },
            allocation: { 
                default: parseInt(freeAlloc.attributes.id) 
            }
        })
    });

    const serverData = await serverRes.json();
    
    if (!serverRes.ok) {
        // Hapus user
        await fetch(`${PANEL_URL}/api/application/users/${userId}`, {
            method: "DELETE",
            headers: { "Authorization": `Bearer ${API_KEY}` }
        }).catch(() => {});
        
        return res.json({ 
            success: false, 
            message: `❌ Gagal buat server: ${JSON.stringify(serverData.errors || serverData)}` 
        });
    }

    // 5. BERHASIL
    return res.json({
        success: true,
        panel: `${PANEL_URL}/server/${serverData.attributes.identifier}`,
        username: userData.attributes.username,
        email: userData.attributes.email,
        password: userPassword,
        ram: ram === 'unlimited' ? 'Unlimited' : `${ram} GB`,
        serverId: serverData.attributes.id,
        identifier: serverData.attributes.identifier,
        allocation: `${freeAlloc.attributes.ip}:${freeAlloc.attributes.port}`
    });
}
