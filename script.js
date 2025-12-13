// Initialize application
document.addEventListener('DOMContentLoaded', function() {
  initializeApp();
});

// Typing animation
const texts = ["Auto Panel Creator", "Pterodactyl API", "Reyz4You Developer", "Server Management"];
let textIndex = 0;
let charIndex = 0;
const typingElement = document.getElementById("typing");

function typeText() {
  if (typingElement && charIndex < texts[textIndex].length) {
    typingElement.textContent += texts[textIndex].charAt(charIndex);
    charIndex++;
    setTimeout(typeText, 100);
  } else if (typingElement) {
    setTimeout(eraseText, 2000);
  }
}

function eraseText() {
  if (typingElement && charIndex > 0) {
    typingElement.textContent = texts[textIndex].substring(0, charIndex - 1);
    charIndex--;
    setTimeout(eraseText, 50);
  } else if (typingElement) {
    textIndex = (textIndex + 1) % texts.length;
    setTimeout(typeText, 500);
  }
}

// Start typing animation if element exists
if (typingElement) {
  typeText();
}

// RAM mapping
const ramValues = {
  "1gb": 1024, "2gb": 2048, "3gb": 3072, "4gb": 4096,
  "5gb": 5120, "6gb": 6144, "7gb": 7168, "8gb": 8192,
  "9gb": 9216, "10gb": 10240, "unlimited": 0
};

// Initialize app
function initializeApp() {
  // Check if we're on the dashboard page
  if (document.body.classList.contains('dashboard-page')) {
    initializeDashboard();
  }
}

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
  const userNameEl = document.getElementById("Hai userName");
  const userRoleEl = document.getElementById("userRole");
  
  if (userNameEl) userNameEl.textContent = nama || "User";
  if (userRoleEl) userRoleEl.textContent = role === "Creator" ? "Administrator" : "Seller";

  // Set body role for CSS
  document.body.setAttribute('data-role', role);

  // Hide admin features for sellers
  if (role === "seller") {
    const adminElements = document.querySelectorAll('.admin-only');
    adminElements.forEach(el => el.style.display = 'none');
  }

  // Initialize navigation
  initializeNavigation();
  
  // Initialize forms
  initializeForms();
  
  // Show default section
  showSection('create');
}

// Navigation
function initializeNavigation() {
  const navButtons = document.querySelectorAll('.nav-btn');
  navButtons.forEach(btn => {
    btn.addEventListener('click', function() {
      const section = this.getAttribute('data-section');
      if (section) {
        showSection(section);
        setActiveNav(this);
      }
    });
  });
}

function showSection(sectionId) {
  // Hide all sections
  const sections = document.querySelectorAll('.content-section');
  sections.forEach(section => {
    section.classList.remove('active');
  });

  // Show target section
  const targetSection = document.getElementById(sectionId);
  if (targetSection) {
    targetSection.classList.add('active');
  }

  // Load data for list sections
  if (sectionId === 'list') {
    fetchServers();
  } else if (sectionId === 'listAdmin') {
    fetchAdmins();
  }
}

function setActiveNav(activeBtn) {
  const navButtons = document.querySelectorAll('.nav-btn');
  navButtons.forEach(btn => btn.classList.remove('active'));
  activeBtn.classList.add('active');
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

async function handlePanelSubmit(e) {
  e.preventDefault();

  const username = document.getElementById("username").value.toLowerCase().trim();
  const email = document.getElementById("email").value.toLowerCase().trim();
  const size = document.getElementById("size").value;
  const resultBox = document.getElementById("result");
  const submitBtn = e.target.querySelector('button[type="submit"]');

  if (!username || !email || !size) {
    showResult(resultBox, "Harap lengkapi semua field!", "error");
    return;
  }

  // Mapping RAM, Disk, CPU
  let ram, disk, cpu;
  if (size === "1gb") {
    ram = 1000; disk = 1000; cpu = 40;
  } else if (size === "2gb") {
    ram = 2000; disk = 1000; cpu = 60;
  } else if (size === "3gb") {
    ram = 3000; disk = 2000; cpu = 80;
  } else if (size === "4gb") {
    ram = 4000; disk = 2000; cpu = 100;
  } else if (size === "5gb") {
    ram = 5000; disk = 3000; cpu = 120;
  } else if (size === "6gb") {
    ram = 6000; disk = 3000; cpu = 140;
  } else if (size === "7gb") {
    ram = 7000; disk = 4000; cpu = 160;
  } else if (size === "8gb") {
    ram = 8000; disk = 4000; cpu = 180;
  } else if (size === "9gb") {
    ram = 9000; disk = 5000; cpu = 200;
  } else if (size === "10gb") {
    ram = 10000; disk = 5000; cpu = 220;
  } else {
    ram = 0; disk = 0; cpu = 0;
  }

  showButtonLoading(submitBtn, true);
  showResult(resultBox, "Membuat panel...", "loading");

  try {
    const res = await fetch("https://solid-hammerhead-petalite.glitch.me/create", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, email, ram, disk, cpu })
    });

    const contentType = res.headers.get('content-type');
    if (!contentType || !contentType.includes('application/json')) {
      const text = await res.text();
      showResult(resultBox, "Server error: Response bukan JSON. Server mungkin offline.", "error");
      console.error('Non-JSON response:', text);
      return;
    }

    const data = await res.json();

    if (data.error || data.errors) {
      showResult(resultBox, "Gagal: " + (data.error || data.errors || "Unknown Error"), "error");
      return;
    }

    const successMessage = `
      <div class="success-result">
        <h4>Panel berhasil dibuat!</h4>
        <div class="result-details">
          <div class="result-item"><strong>Domain:</strong> ${data.panel_url}</div>
          <div class="result-item"><strong>Username:</strong> ${data.username}</div>
          <div class="result-item"><strong>Password:</strong> ${data.password}</div>
          <div class="result-item"><strong>Email:</strong> ${data.email}</div>
          <div class="result-item"><strong>Server ID:</strong> ${data.server_id}</div>
        </div>
      </div>
    `;

    showResult(resultBox, successMessage, "success");
    e.target.reset();

  } catch (err) {
    showResult(resultBox, "Error saat request: " + err.message, "error");
  } finally {
    showButtonLoading(submitBtn, false);
  }
}

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

  showButtonLoading(submitBtn, true);
  showResult(resultBox, "Membuat admin...", "loading");

  try {
    const res = await fetch("https://solid-hammerhead-petalite.glitch.me/create-admin", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, email })
    });

    const contentType = res.headers.get("content-type");
    if (!contentType || !contentType.includes("application/json")) {
      const text = await res.text();
      showResult(resultBox, "Server error: Respon bukan JSON. Cek backend.", "error");
      console.error("Non-JSON response:", text);
      return;
    }

    const data = await res.json();

    if (data.error || data.errors) {
      showResult(resultBox, "Gagal: " + (data.error || data.errors || "Unknown Error"), "error");
      return;
    }

    const successMessage = `
      <div class="success-result">
        <h4>Admin berhasil dibuat!</h4>
        <div class="result-details">
          <div class="result-item"><strong>Domain:</strong> ${data.panel_url}</div>
          <div class="result-item"><strong>Username:</strong> ${data.username}</div>
          <div class="result-item"><strong>Password:</strong> ${data.password}</div>
        </div>
      </div>
    `;

    showResult(resultBox, successMessage, "success");
    e.target.reset();

  } catch (err) {
    showResult(resultBox, "Error saat request: " + err.message, "error");
  } finally {
    showButtonLoading(submitBtn, false);
  }
}

// Server management
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
    const res = await fetch("https://solid-hammerhead-petalite.glitch.me/servers");
    const servers = await res.json();
    
    if (!Array.isArray(servers)) {
      container.innerHTML = `
        <div class="empty-state">
          <p>Gagal mengambil data server.</p>
        </div>
      `;
      return;
    }

    if (servers.length === 0) {
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

    container.innerHTML = servers.map(srv => `
      <div class="server-item" data-id="${srv.attributes.id}">
        <div class="server-info">
          <span class="server-name">${srv.attributes.name || 'Tanpa Nama'}</span>
          <span class="server-id">ID: ${srv.attributes.id}</span>
        </div>
        <button class="delete-btn" onclick="deleteServer('${srv.attributes.id}')" title="Hapus Server">
          ×
        </button>
      </div>
    `).join('');
    
  } catch (err) {
    container.innerHTML = `
      <div class="empty-state">
        <p>Error mengambil data server: ${err.message}</p>
      </div>
    `;
  }
}

async function deleteServer(id) {
  if (!confirm("Yakin ingin menghapus server ini? Tindakan ini tidak dapat dibatalkan.")) {
    return;
  }

  const serverItem = document.querySelector(`[data-id="${id}"]`);
  if (serverItem) {
    serverItem.style.opacity = '0.5';
    serverItem.style.pointerEvents = 'none';
  }

  try {
    const res = await fetch(`https://solid-hammerhead-petalite.glitch.me/server/${id}`, {
      method: "DELETE"
    });

    const data = await res.json();

    if (data.success) {
      // Remove from DOM with animation
      if (serverItem) {
        serverItem.style.transform = 'translateX(-100%)';
        setTimeout(() => {
          fetchServers(); // Refresh the list
        }, 300);
      }
    } else {
      alert("Gagal hapus server: " + (data.error || "Unknown error"));
      if (serverItem) {
        serverItem.style.opacity = '1';
        serverItem.style.pointerEvents = 'auto';
      }
    }
  } catch (err) {
    alert("Error saat hapus server: " + err.message);
    if (serverItem) {
      serverItem.style.opacity = '1';
      serverItem.style.pointerEvents = 'auto';
    }
  }
}

// Admin management
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
    const res = await fetch("https://solid-hammerhead-petalite.glitch.me/admins");
    const admins = await res.json();
    
    if (!Array.isArray(admins)) {
      container.innerHTML = `
        <div class="empty-state">
          <p>Gagal mengambil data admin.</p>
        </div>
      `;
      return;
    }

    const filtered = admins.filter(a => a.username && a.username.trim() !== "");
    
    if (filtered.length === 0) {
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

    container.innerHTML = filtered.map(admin => `
      <div class="admin-item" data-id="${admin.id}">
        <div class="admin-info">
          <span class="admin-name">${admin.username}</span>
          <span class="admin-email">${admin.email || 'No email'}</span>
        </div>
        <button class="delete-btn" onclick="deleteAdmin('${admin.id}')" title="Hapus Admin">
          ×
        </button>
      </div>
    `).join('');
    
  } catch (err) {
    container.innerHTML = `
      <div class="empty-state">
        <p>Error mengambil data admin: ${err.message}</p>
      </div>
    `;
  }
}

async function deleteAdmin(id) {
  if (!confirm("Yakin ingin menghapus admin ini? Tindakan ini tidak dapat dibatalkan.")) {
    return;
  }

  const adminItem = document.querySelector(`[data-id="${id}"]`);
  if (adminItem) {
    adminItem.style.opacity = '0.5';
    adminItem.style.pointerEvents = 'none';
  }

  try {
    const res = await fetch(`https://solid-hammerhead-petalite.glitch.me/admin/${id}`, {
      method: "DELETE"
    });

    const data = await res.json();

    if (data.success) {
      // Remove from DOM with animation
      if (adminItem) {
        adminItem.style.transform = 'translateX(-100%)';
        setTimeout(() => {
          fetchAdmins(); // Refresh the list
        }, 300);
      }
    } else {
      alert("Gagal hapus admin: " + (data.error || "Unknown error"));
      if (adminItem) {
        adminItem.style.opacity = '1';
        adminItem.style.pointerEvents = 'auto';
      }
    }
  } catch (err) {
    alert("Error saat hapus admin: " + err.message);
    if (adminItem) {
      adminItem.style.opacity = '1';
      adminItem.style.pointerEvents = 'auto';
    }
  }
}

// Utility functions
function showResult(container, message, type) {
  if (!container) return;
  
  container.innerHTML = message;
  container.className = `result-box show ${type}`;
  
  // Auto hide after 10 seconds for success messages
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

function logout() {
  if (confirm("Yakin ingin logout?")) {
    sessionStorage.clear();
    window.location.href = "index.html";
  }
}

// Add smooth scrolling and page transitions
window.addEventListener('load', function() {
  document.body.classList.add('loaded');
});

// Add keyboard navigation
document.addEventListener('keydown', function(e) {
  // Escape key to close modals or go back
  if (e.key === 'Escape') {
    const activeModal = document.querySelector('.modal.active');
    if (activeModal) {
      activeModal.classList.remove('active');
    }
  }
});

// Add touch gestures for mobile
let touchStartX = 0;
let touchEndX = 0;

document.addEventListener('touchstart', function(e) {
  touchStartX = e.changedTouches[0].screenX;
});

document.addEventListener('touchend', function(e) {
  touchEndX = e.changedTouches[0].screenX;
  handleSwipe();
});

function handleSwipe() {
  const swipeThreshold = 50;
  const diff = touchStartX - touchEndX;
  
  if (Math.abs(diff) > swipeThreshold) {
    if (diff > 0) {
      // Swipe left - next section
      // You can implement section navigation here
    } else {
      // Swipe right - previous section
      // You can implement section navigation here
    }
  }
}
