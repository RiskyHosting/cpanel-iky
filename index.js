const express = require("express");
const fetch = (...args) =>
  import("node-fetch").then(({ default: fetch }) => fetch(...args));
const cors = require("cors");
const path = require("path");

const app = express();

app.use(
  cors({
    origin: "*",
    methods: ["GET", "POST", "DELETE"],
    allowedHeaders: ["Content-Type"],
  })
);

app.use(express.json());
app.use(express.static(path.join(__dirname)));

const apikey = "ptla_Dmo5KBVkO12l1ZfiRosrSee65GEgKMKuan5nOks9cG6";
const capikey = "-";
const domain = "https://peterodatcly.bimxyz.my.id";
const nestid = "5";
const egg = "15";
const loc = "1";

app.post("/create", async (req, res) => {
  const { username, email, ram, disk, cpu } = req.body;
  const password = username + Math.floor(Math.random() * 10000);
  const name = username + "-server";

  try {
    const userRes = await fetch(`${domain}/api/application/users`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apikey}`,
        Accept: "application/json",
      },
      body: JSON.stringify({
        email,
        username,
        first_name: username,
        last_name: "User",
        password,
        language: "en",
      }),
    });
    const userData = await userRes.json();
    if (userData.errors) return res.json({ error: userData.errors[0].detail });
    const userId = userData.attributes.id;

    const eggData = await fetch(
      `${domain}/api/application/nests/${nestid}/eggs/${egg}`,
      {
        method: "GET",
        headers: {
          Authorization: `Bearer ${apikey}`,
          Accept: "application/json",
          "Content-Type": "application/json",
        },
      }
    );
    const eggJson = await eggData.json();
    const startup = eggJson.attributes.startup;

    const serverRes = await fetch(`${domain}/api/application/servers`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apikey}`,
        Accept: "application/json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        name,
        user: userId,
        egg: parseInt(egg),
        docker_image: eggJson.attributes.docker_image,
        startup,
        environment: {
          INST: "npm",
          USER_UPLOAD: "0",
          AUTO_UPDATE: "0",
          CMD_RUN: "npm start",
        },
        limits: {
          memory: ram,
          swap: 0,
          disk: typeof disk !== "undefined" ? disk : ram,
          io: 500,
          cpu: cpu ?? 100,
        },
        feature_limits: {
          databases: 5,
          backups: 5,
          allocations: 5,
        },
        deploy: {
          locations: [parseInt(loc)],
          dedicated_ip: false,
          port_range: [],
        },
      }),
    });
    let serverData;
try {
  serverData = await serverRes.json();
} catch (e) {
  const text = await serverRes.text();
  return res.status(500).json({
    error: "Gagal parsing JSON dari server creation",
    detail: text || e.message
  });
}
if (serverData.errors)
  return res.json({ error: serverData.errors[0].detail });

    res.json({
      username,
      password,
      email,
      panel_url: `${domain}`,
      server_id: serverData.attributes.id,
    });
  } catch (err) {
    res.status(500).json({ error: "Gagal membuat panel", detail: err.message });
  }
});

app.get("/servers", async (req, res) => {
  try {
    const fetchServers = await fetch(`${domain}/api/application/servers`, {
      headers: {
        Authorization: `Bearer ${apikey}`,
        Accept: "application/json",
        "Content-Type": "application/json",
      },
    });
    const serverData = await fetchServers.json();
    if (!serverData || !Array.isArray(serverData.data)) {
      return res.status(400).json({ error: "Invalid server response" });
    }
    res.json(serverData.data);
  } catch (err) {
    res
      .status(500)
      .json({ error: "Failed to fetch servers", detail: err.message });
  }
});

app.delete("/server/:id", async (req, res) => {
  try {
    const id = req.params.id;
    await fetch(`${domain}/api/application/servers/${id}`, {
      method: "DELETE",
      headers: {
        Authorization: `Bearer ${apikey}`,
        Accept: "application/json",
      },
    });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: "Gagal hapus server", detail: err.message });
  }
});

app.post("/create-admin", async (req, res) => {
  const { username, email } = req.body;
  const password = username + Math.floor(Math.random() * 10000);

  try {
    const userRes = await fetch(`${domain}/api/application/users`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${capikey}`,
        Accept: "application/json",
      },
      body: JSON.stringify({
        email,
        username,
        first_name: username,
        last_name: "Admin",
        password,
        language: "en",
        root_admin: true,
      }),
    });

    let userData;
try {
  userData = await userRes.json();
} catch (e) {
  const text = await userRes.text();
  return res.status(500).json({
    error: "Gagal parsing JSON dari Pterodactyl",
    detail: text || e.message
  });
}
    if (!userRes.ok || userData.errors) {
      return res.json({ error: userData.errors?.[0]?.detail || "Gagal membuat admin" });
    }

    res.json({
      username,
      password,
      panel_url: domain,
    });
  } catch (err) {
    res.status(500).json({ error: "Gagal membuat admin", detail: err.message });
  }
});

app.get("/admins", async (req, res) => {
  try {
    const fetchUsers = await fetch(`${domain}/api/application/users`, {
      headers: {
        Authorization: `Bearer ${capikey}`,
        Accept: "application/json",
        "Content-Type": "application/json",
      },
    });
    const userData = await fetchUsers.json();
    if (!userData || !Array.isArray(userData.data)) {
      return res.status(400).json({ error: "Invalid admin response" });
    }

    const admins = userData.data
      .filter((u) => u.attributes.root_admin === true && u.attributes.username)
      .map((u) => ({
        id: u.attributes.id,
        username: u.attributes.username.trim(),
      }));

    res.json(admins);
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch admins", detail: err.message });
  }
});

app.delete("/admin/:id", async (req, res) => {
  try {
    const id = req.params.id;
    await fetch(`${domain}/api/application/users/${id}`, {
      method: "DELETE",
      headers: {
        Authorization: `Bearer ${capikey}`,
        Accept: "application/json",
      },
    });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: "Gagal hapus admin", detail: err.message });
  }
});

app.get("/", (req, res) => {
  res.json({
    message: "Panel API is running",
    endpoints: {
      "POST /create": "Create panel",
      "GET /servers": "List all servers",
      "DELETE /server/:id": "Delete server",
      "POST /create-admin": "Create admin user",
      "GET /admins": "List admins",
      "DELETE /admin/:id": "Delete admin",
    },
    status: "online",
  });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, "0.0.0.0", () =>
  console.log(`✅ Panel API ready at :${PORT}`)
);
