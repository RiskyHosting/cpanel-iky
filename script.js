// CONFIGURATION - Ganti dengan data kamu
const PTERODACTYL = {
  DOMAIN: "https://peterodatcly.bimxyz.my.id",
  API_KEY: "ptla_Dmo5KBVkO12l1ZfiRosrSee65GEgKMKuan5nOks9cG6",
  ADMIN_KEY: "ptla_Dmo5KBVkO12l1ZfiRosrSee65GEgKMKuan5nOks9cG6", // Sama untuk testing
  NEST_ID: "5",
  EGG_ID: "15",
  LOCATION_ID: "1"
};

// Helper untuk call Pterodactyl API langsung
async function callPteroAPI(endpoint, method = "GET", body = null, useAdminKey = false) {
  const apiKey = useAdminKey ? PTERODACTYL.ADMIN_KEY : PTERODACTYL.API_KEY;
  const url = `${PTERODACTYL.DOMAIN}${endpoint}`;
  
  const headers = {
    "Authorization": `Bearer ${apiKey}`,
    "Accept": "application/json",
    "Content-Type": "application/json",
  };
  
  const options = {
    method: method,
    headers: headers,
    mode: "cors"
  };
  
  if (body && (method === "POST" || method === "PUT" || method === "PATCH")) {
    options.body = JSON.stringify(body);
  }
  
  console.log(`Calling Ptero API: ${method} ${endpoint}`);
  
  try {
    const response = await fetch(url, options);
    
    // Cek jika response tidak OK
    if (!response.ok) {
      let errorText = await response.text();
      try {
        const errorJson = JSON.parse(errorText);
        errorText = errorJson.errors?.[0]?.detail || errorText;
      } catch {
        // Tetap pakai text biasa
      }
      throw new Error(`API Error ${response.status}: ${errorText}`);
    }
    
    // Parse JSON response
    const data = await response.json();
    return data;
    
  } catch (error) {
    console.error("Ptero API Error:", error);
    throw error;
  }
}

// Initialize Dashboard
function initializeDashboard() {
  // Check access
  const akses = sessionStorage.getItem("akses");
  const role = sessionStorage.getItem("role");
  const nama = sessionStorage.getItem("nama");

  if (akses !== "true") {
    alert("Akses ditolak! Silakan login dulu.");
    window.location.href = "index.html";
    return;
  }

  // Set user info
  const userNameEl = document.getElementById("userName");
  const userRoleEl = document.getElementById("userRole");
  
  if (userNameEl) userNameEl.textContent = nama || "User";
  if (userRoleEl) userRoleEl.textContent = role === "Creator" ? "Administrator" : "Seller";

  // Hide admin features for non-creators
  if (role !== "Creator") {
    const adminElements = document.querySelectorAll('.admin-only');
    adminElements.forEach(el => {
      el.style.display = 'none';
    });
  }

  // Initialize forms
  initializeForms();
  
  // Show default section
  showSection('create');
}

// Navigation
function showSection(sectionId) {
  // Hide all sections
  const sections = document.querySelectorAll('.content-section');
  sections.forEach(section => {
    section.classList.remove('active');
  });

  // Remove active from all nav buttons
  const navButtons = document.querySelectorAll('.nav-btn');
  navButtons.forEach(btn => btn.classList.remove('active'));

  // Show target section
  const targetSection = document.getElementById(sectionId);
  if (targetSection) {
    targetSection.classList.add('active');
  }

  // Activate corresponding nav button
  const activeNav = document.querySelector(`[data-section="${sectionId}"]`);
  if (activeNav) {
    activeNav.classList.add('active');
  }

  // Load data for list sections
  if (sectionId === 'list') {
    fetchServers();
  } else if (sectionId === 'listAdmin') {
    fetchAdmins();
  }
}

// Form handling
function initializeForms() {
  // Panel form
  const panelForm = document.getElementById("panelForm");
  if (panelForm) {
    panelForm.addEventListener("submit", handlePanelSubmit);
  }

  // Admin form
  const adminForm = document.getElementById("adminForm");
  if (adminForm) {
    adminForm.addEventListener("submit", handleAdminSubmit);
  }
}

// Handle Panel Creation
async function handlePanelSubmit(e) {
  e.preventDefault();

  const username = document.getElementById("username").value.toLowerCase().trim();
  const email = document.getElementById("email").value.toLowerCase().trim();
  const ram = document.getElementById("size").value;
  const resultBox = document.getElementById("result");
  const submitBtn = e.target.querySelector('button[type="submit"]');

  if (!username || !email || !ram) {
    showResult(resultBox, "Harap lengkapi semua field!", "error");
    return;
  }

  // Generate random password
  const password = username + Math.floor(Math.random() * 10000);
  const serverName = username + "-server";

  // Show loading
  showButtonLoading(submitBtn, true);
  showResult(resultBox, "⏳ Membuat panel...", "loading");

  try {
    // 1. Create user in Pterodactyl
    const userData = await callPteroAPI("/api/application/users", "POST", {
      email: email,
      username: username,
      first_name: username,
      last_name: "User",
      password: password,
      language: "en"
    });

    const userId = userData.attributes.id;

    // 2. Get egg details
    const eggData = await callPteroAPI(`/api/application/nests/${PTERODACTYL.NEST_ID}/eggs/${PTERODACTYL.EGG_ID}`, "GET");

    // 3. Create server
    const serverData = await callPteroAPI("/api/application/servers", "POST", {
      name: serverName,
      user: userId,
      egg: parseInt(PTERODACTYL.EGG_ID),
      docker_image: eggData.attributes.docker_image,
      startup: eggData.attributes.startup,
      environment: {
        INST: "npm",
        USER_UPLOAD: "0",
        AUTO_UPDATE: "0",
        CMD_RUN: "npm start",
      },
      limits: {
        memory: parseInt(ram),
        swap: 0,
        disk: parseInt(ram),
        io: 500,
        cpu: 100,
      },
      feature_limits: {
        databases: 5,
        backups: 5,
        allocations: 5,
      },
      deploy: {
        locations: [parseInt(PTERODACTYL.LOCATION_ID)],
        dedicated_ip: false,
        port_range: [],
      },
    });

    const successMessage = `
      <div class="success-result">
        <h4>✅ Panel berhasil dibuat!</h4>
        <div class="result-details">
          <div class="result-item"><strong>Panel URL:</strong> ${PTERODACTYL.DOMAIN}</div>
          <div class="result-item"><strong>Username:</strong> ${username}</div>
          <div class="result-item"><strong>Password:</strong> ${password}</div>
          <div class="result-item"><strong>Email:</strong> ${email}</div>
          <div class="result-item"><strong>Server ID:</strong> ${serverData.attributes.id}</div>
          <div class="result-item"><strong>Server Name:</strong> ${serverName}</div>
        </div>
        <p style="margin-top: 12px; color: var(--text-secondary); font-size: 12px;">
          Simpan informasi ini dengan baik!
        </p>
      </div>
    `;

    showResult(resultBox, successMessage, "success");
    e.target.reset();

    // Refresh server list if on list section
    if (document.getElementById('list').classList.contains('active')) {
      setTimeout(fetchServers, 1000);
    }

  } catch (error) {
    console.error("Create panel error:", error);
    showResult(resultBox, `<div class="error-result">❌ ${error.message}</div>`, "error");
  } finally {
    showButtonLoading(submitBtn, false);
  }
}

// Handle Admin Creation
async function handleAdminSubmit(e) {
  e.preventDefault();

  const username = document.getElementById("adminUsername").value.trim();
  const email = document.getElementById("adminEmail").value.trim();
  const resultBox = document.getElementById("adminResult");
  const submitBtn = e.target.querySelector('button[type="submit"]');

  if (!username || !email) {
    showResult(resultBox, "Harap lengkapi semua field!", "error");
    return;
  }

  const password = username + Math.floor(Math.random() * 10000);

  showButtonLoading(submitBtn, true);
  showResult(resultBox, "⏳ Membuat admin...", "loading");

  try {
    const adminData = await callPteroAPI("/api/application/users", "POST", {
      email: email,
      username: username,
      first_name: username,
      last_name: "Admin",
      password: password,
      language: "en",
      root_admin: true
    }, true); // Use admin key

    const successMessage = `
      <div class="success-result">
        <h4>✅ Admin berhasil dibuat!</h4>
        <div class="result-details">
          <div class="result-item"><strong>Panel URL:</strong> ${PTERODACTYL.DOMAIN}</div>
          <div class="result-item"><strong>Username:</strong> ${username}</div>
          <div class="result-item"><strong>Password:</strong> ${password}</div>
          <div class="result-item"><strong>Email:</strong> ${email}</div>
          <div class="result-item"><strong>Admin ID:</strong> ${adminData.attributes.id}</div>
        </div>
      </div>
    `;

    showResult(resultBox, successMessage, "success");
    e.target.reset();

    // Refresh admin list if on list section
    if (document.getElementById('listAdmin').classList.contains('active')) {
      setTimeout(fetchAdmins, 1000);
    }

  } catch (error) {
    console.error("Create admin error:", error);
    showResult(resultBox, `<div class="error-result">❌ ${error.message}</div>`, "error");
  } finally {
    showButtonLoading(submitBtn, false);
  }
}

// Fetch Servers
async function fetchServers() {
  const container = document.getElementById("serverList");
  if (!container) return;

  container.innerHTML = `
    <div class="loading-state">
      <div class="spinner"></div>
      <p>Memuat daftar server...</p>
    </div>
  `;

  try {
    const serverData = await callPteroAPI("/api/application/servers", "GET");
    
    if (!serverData.data || serverData.data.length === 0) {
      container.innerHTML = `
        <div class="empty-state">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <rect x="2" y="3" width="20" height="14" rx="2" ry="2"></rect>
            <line x1="8" y1="21" x2="16" y2="21"></line>
            <line x1="12" y1="17" x2="12" y2="21"></line>
          </svg>
          <h4>Tidak ada server</h4>
          <p>Belum ada server yang dibuat. Buat server pertama Anda!</p>
        </div>
      `;
      return;
    }

    container.innerHTML = serverData.data.map(server => `
      <div class="server-item" data-id="${server.attributes.id}">
        <div class="server-info">
          <span class="server-name">${server.attributes.name || 'Tanpa Nama'}</span>
          <span class="server-id">ID: ${server.attributes.id} | RAM: ${server.attributes.limits.memory}MB</span>
        </div>
        <button class="delete-btn" onclick="deleteServer('${server.attributes.id}', '${server.attributes.name}')" title="Hapus Server">
          ×
        </button>
      </div>
    `).join('');
    
  } catch (error) {
    console.error("Fetch servers error:", error);
    container.innerHTML = `
      <div class="empty-state">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <circle cx="12" cy="12" r="10"></circle>
          <line x1="12" y1="8" x2="12" y2="12"></line>
          <line x1="12" y1="16" x2="12.01" y2="16"></line>
        </svg>
        <h4>Gagal memuat data</h4>
        <p>${error.message || "Tidak dapat terhubung ke server"}</p>
        <button onclick="fetchServers()" style="margin-top: 12px;" class="submit-btn">
          Coba Lagi
        </button>
      </div>
    `;
  }
}

// Delete Server
async function deleteServer(id, name) {
  if (!confirm(`Yakin ingin menghapus server "${name}"? Tindakan ini tidak dapat dibatalkan.`)) {
    return;
  }

  const serverItem = document.querySelector(`[data-id="${id}"]`);
  if (serverItem) {
    serverItem.style.opacity = '0.5';
    serverItem.style.pointerEvents = 'none';
  }

  try {
    await callPteroAPI(`/api/application/servers/${id}`, "DELETE");
    
    // Remove from UI
    if (serverItem) {
      serverItem.style.transform = 'translateX(-100%)';
      setTimeout(() => {
        fetchServers(); // Refresh list
      }, 300);
    }
    
    showNotification(`✅ Server "${name}" berhasil dihapus`, "success");
    
  } catch (error) {
    console.error("Delete server error:", error);
    alert("Gagal hapus server: " + error.message);
    
    if (serverItem) {
      serverItem.style.opacity = '1';
      serverItem.style.pointerEvents = 'auto';
    }
  }
}

// Fetch Admins
async function fetchAdmins() {
  const container = document.getElementById("adminList");
  if (!container) return;

  container.innerHTML = `
    <div class="loading-state">
      <div class="spinner"></div>
      <p>Memuat daftar admin...</p>
    </div>
  `;

  try {
    const userData = await callPteroAPI("/api/application/users", "GET", null, true);
    
    const admins = userData.data.filter(user => 
      user.attributes.root_admin === true
    );

    if (admins.length === 0) {
      container.innerHTML = `
        <div class="empty-state">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
            <circle cx="12" cy="7" r="4"></circle>
          </svg>
          <h4>Tidak ada admin</h4>
          <p>Belum ada admin yang dibuat. Buat admin pertama!</p>
        </div>
      `;
      return;
    }

    container.innerHTML = admins.map(admin => `
      <div class="admin-item" data-id="${admin.attributes.id}">
        <div class="admin-info">
          <span class="admin-name">${admin.attributes.username}</span>
          <span class="admin-email">${admin.attributes.email || 'No email'}</span>
        </div>
        <button class="delete-btn" onclick="deleteAdmin('${admin.attributes.id}', '${admin.attributes.username}')" title="Hapus Admin">
          ×
        </button>
      </div>
    `).join('');
    
  } catch (error) {
    console.error("Fetch admins error:", error);
    container.innerHTML = `
      <div class="empty-state">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <circle cx="12" cy="12" r="10"></circle>
          <line x1="12" y1="8" x2="12" y2="12"></line>
          <line x1="12" y1="16" x2="12.01" y2="16"></line>
        </svg>
        <h4>Gagal memuat data</h4>
        <p>${error.message || "Tidak dapat terhubung ke server"}</p>
        <button onclick="fetchAdmins()" style="margin-top: 12px;" class="submit-btn">
          Coba Lagi
        </button>
      </div>
    `;
  }
}

// Delete Admin
async function deleteAdmin(id, username) {
  if (!confirm(`Yakin ingin menghapus admin "${username}"? Tindakan ini tidak dapat dibatalkan.`)) {
    return;
  }

  const adminItem = document.querySelector(`[data-id="${id}"]`);
  if (adminItem) {
    adminItem.style.opacity = '0.5';
    adminItem.style.pointerEvents = 'none';
  }

  try {
    await callPteroAPI(`/api/application/users/${id}`, "DELETE", null, true);
    
    // Remove from UI
    if (adminItem) {
      adminItem.style.transform = 'translateX(-100%)';
      setTimeout(() => {
        fetchAdmins(); // Refresh list
      }, 300);
    }
    
    showNotification(`✅ Admin "${username}" berhasil dihapus`, "success");
    
  } catch (error) {
    console.error("Delete admin error:", error);
    alert("Gagal hapus admin: " + error.message);
    
    if (adminItem) {
      adminItem.style.opacity = '1';
      adminItem.style.pointerEvents = 'auto';
    }
  }
}

// Utility Functions
function showResult(container, message, type) {
  if (!container) return;
  
  container.innerHTML = message;
  container.className = `result-box show ${type}`;
  
  // Auto hide after 10 seconds for success
  if (type === 'success') {
    setTimeout(() => {
      container.classList.remove('show');
    }, 10000);
  }
}

function showButtonLoading(button, loading) {
  if (!button) return;
  
  const btnText = button.querySelector('.btn-text');
  const btnLoader = button.querySelector('.btn-loader');
  
  if (loading) {
    button.disabled = true;
    if (btnText) btnText.classList.add('hidden');
    if (btnLoader) btnLoader.classList.remove('hidden');
  } else {
    button.disabled = false;
    if (btnText) btnText.classList.remove('hidden');
    if (btnLoader) btnLoader.classList.add('hidden');
  }
}

function showNotification(message, type = "info") {
  // Create notification element
  const notification = document.createElement("div");
  notification.className = `notification ${type}`;
  notification.innerHTML = message;
  
  // Style
  notification.style.cssText = `
    position: fixed;
    top: 20px;
    right: 20px;
    padding: 12px 16px;
    border-radius: 8px;
    background: var(--card);
    border-left: 4px solid;
    box-shadow: 0 4px 12px rgba(0,0,0,0.3);
    z-index: 1000;
    max-width: 300px;
    transform: translateX(120%);
    transition: transform 0.3s ease;
    font-size: 14px;
    color: var(--text);
  `;
  
  // Set border color
  const colors = {
    success: "#10b981",
    error: "#ef4444",
    warning: "#f59e0b",
    info: "#3b82f6"
  };
  notification.style.borderLeftColor = colors[type] || colors.info;
  
  // Add to DOM
  document.body.appendChild(notification);
  
  // Show
  setTimeout(() => {
    notification.style.transform = "translateX(0)";
  }, 10);
  
  // Auto remove
  setTimeout(() => {
    notification.style.transform = "translateX(120%)";
    setTimeout(() => {
      if (notification.parentNode) {
        notification.parentNode.removeChild(notification);
      }
    }, 300);
  }, 5000);
}

function logout() {
  if (confirm("Yakin ingin logout?")) {
    sessionStorage.clear();
    window.location.href = "index.html";
  }
}

// Make functions global
window.showSection = showSection;
window.deleteServer = deleteServer;
window.deleteAdmin = deleteAdmin;
window.fetchServers = fetchServers;
window.fetchAdmins = fetchAdmins;
window.logout = logout;
