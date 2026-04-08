const express = require("express");
const fs = require("fs");
const path = require("path");

const app = express();
const PORT = process.env.PORT || 3000;
const DB = path.join(__dirname, "links.json");

app.use(express.json());
app.use(express.static("public"));

function load() {
  if (!fs.existsSync(DB)) return {};
  try { return JSON.parse(fs.readFileSync(DB, "utf8")); } catch { return {}; }
}

function save(data) {
  fs.writeFileSync(DB, JSON.stringify(data, null, 2));
}

function randomKey(len = 5) {
  return Math.random().toString(36).slice(2, 2 + len);
}

// Dashboard
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

// List all links
app.get("/api/links", (req, res) => {
  res.json(load());
});

// Add a link
app.post("/api/links", (req, res) => {
  let { key, target, label } = req.body;
  if (!target) return res.status(400).json({ error: "target URL is required" });

  // Add https:// if missing
  if (!/^https?:\/\//i.test(target)) target = "https://" + target;

  // Auto-generate key if not provided
  if (!key || !key.trim()) key = randomKey();
  key = key.trim().toLowerCase().replace(/[^a-z0-9_-]/g, "");
  if (!key) key = randomKey();

  const links = load();
  if (links[key]) return res.status(409).json({ error: `Key "${key}" already exists. Choose another.` });

  links[key] = {
    target,
    label: label || key,
    created: new Date().toISOString(),
    clicks: 0
  };
  save(links);
  res.json({ ok: true, key, short: `${req.protocol}://${req.get("host")}/${key}` });
});

// Delete a link
app.delete("/api/links/:key", (req, res) => {
  const links = load();
  if (!links[req.params.key]) return res.status(404).json({ error: "not found" });
  delete links[req.params.key];
  save(links);
  res.json({ ok: true });
});

// Redirect
app.get("/:key", (req, res) => {
  const key = req.params.key.toLowerCase();
  const links = load();
  if (!links[key]) {
    return res.status(404).send(`
      <html><body style="font-family:sans-serif;text-align:center;padding:4rem">
        <h2>Link not found</h2>
        <p>No short link exists for <code>/${key}</code></p>
        <a href="/">Go to dashboard →</a>
      </body></html>
    `);
  }
  // Count clicks
  links[key].clicks = (links[key].clicks || 0) + 1;
  save(links);
  res.redirect(302, links[key].target);
});

app.listen(PORT, () => {
  console.log(`✓ URL Shortener running on port ${PORT}`);
});
