const express = require("express");
const fs = require("fs");
const path = require("path");

const app = express();
const PORT = process.env.PORT || 3000;
const DB = path.join(__dirname, "links.json");
const MASK_DB = path.join(__dirname, "masks.json");

app.use(express.json());
app.use(express.static("public"));

function load(file) {
  if (!fs.existsSync(file)) return {};
  try { return JSON.parse(fs.readFileSync(file, "utf8")); } catch { return {}; }
}

function save(file, data) {
  fs.writeFileSync(file, JSON.stringify(data, null, 2));
}

function randomKey(len = 6) {
  return Math.random().toString(36).slice(2, 2 + len);
}

function ensureHttp(u) {
  return /^https?:\/\//i.test(u) ? u : "https://" + u;
}

// Dashboard
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

// ── URL SHORTENER API ─────────────────────────────────────────

app.get("/api/links", (req, res) => res.json(load(DB)));

app.post("/api/links", (req, res) => {
  let { key, target, label } = req.body;
  if (!target) return res.status(400).json({ error: "target URL is required" });
  target = ensureHttp(target);
  if (!key || !key.trim()) key = randomKey();
  key = key.trim().toLowerCase().replace(/[^a-z0-9_-]/g, "");
  if (!key) key = randomKey();
  const links = load(DB);
  if (links[key]) return res.status(409).json({ error: `Key "${key}" already exists.` });
  links[key] = { target, label: label || key, created: new Date().toISOString(), clicks: 0 };
  save(DB, links);
  res.json({ ok: true, key, short: `${req.protocol}://${req.get("host")}/${key}` });
});

app.delete("/api/links/:key", (req, res) => {
  const links = load(DB);
  if (!links[req.params.key]) return res.status(404).json({ error: "not found" });
  delete links[req.params.key];
  save(DB, links);
  res.json({ ok: true });
});

// ── URL MASKING API ───────────────────────────────────────────

app.get("/api/masks", (req, res) => res.json(load(MASK_DB)));

app.post("/api/masks", (req, res) => {
  let { realUrl, fakeWord, label } = req.body;
  if (!realUrl) return res.status(400).json({ error: "Real URL is required" });
  if (!fakeWord) return res.status(400).json({ error: "Fake word is required" });
  realUrl = ensureHttp(realUrl);
  const key = fakeWord.trim().toLowerCase().replace(/[^a-z0-9_-]/g, "");
  if (!key) return res.status(400).json({ error: "Invalid fake word" });
  const masks = load(MASK_DB);
  if (masks[key]) return res.status(409).json({ error: `"${key}" already exists.` });
  masks[key] = { realUrl, label: label || key, created: new Date().toISOString(), clicks: 0 };
  save(MASK_DB, masks);
  res.json({ ok: true, key, maskedUrl: `${req.protocol}://${req.get("host")}/m/${key}` });
});

app.delete("/api/masks/:key", (req, res) => {
  const masks = load(MASK_DB);
  if (!masks[req.params.key]) return res.status(404).json({ error: "not found" });
  delete masks[req.params.key];
  save(MASK_DB, masks);
  res.json({ ok: true });
});

// ── MASKED PAGE (iframe — address bar stays on your domain) ───
app.get("/m/:key", (req, res) => {
  const key = req.params.key.toLowerCase();
  const masks = load(MASK_DB);
  if (!masks[key]) {
    return res.status(404).send(`<html><body style="font-family:sans-serif;text-align:center;padding:4rem">
      <h2>Masked link not found</h2><a href="/">Go to dashboard →</a></body></html>`);
  }
  masks[key].clicks = (masks[key].clicks || 0) + 1;
  save(MASK_DB, masks);
  res.send(`<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>${key}</title>
  <style>*{margin:0;padding:0;box-sizing:border-box}html,body{width:100%;height:100%;overflow:hidden}iframe{width:100%;height:100vh;border:none;display:block}</style>
</head>
<body>
  <iframe src="${masks[key].realUrl}" allowfullscreen></iframe>
</body>
</html>`);
});

// ── SHORT LINK REDIRECT ───────────────────────────────────────
app.get("/:key", (req, res) => {
  const key = req.params.key.toLowerCase();
  const links = load(DB);
  if (!links[key]) {
    return res.status(404).send(`<html><body style="font-family:sans-serif;text-align:center;padding:4rem">
      <h2>Link not found</h2><p>No short link for <code>/${key}</code></p>
      <a href="/">Go to dashboard →</a></body></html>`);
  }
  links[key].clicks = (links[key].clicks || 0) + 1;
  save(DB, links);
  res.redirect(302, links[key].target);
});

app.listen(PORT, () => {
  console.log(`✓ URL Shortener + Masking Tool running on port ${PORT}`);
});
