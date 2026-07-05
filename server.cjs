var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));

// server.ts
var import_express = __toESM(require("express"), 1);
var import_path = __toESM(require("path"), 1);
var import_vite = require("vite");
var import_supabase_js = require("@supabase/supabase-js");
async function startServer() {
  const app = (0, import_express.default)();
  const PORT = Number(process.env.PORT || 3e3);
  app.use(import_express.default.json({ limit: "50mb" }));
  const supabaseUrl = process.env.VITE_SUPABASE_URL || "";
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY || "";
  const supabase = (0, import_supabase_js.createClient)(supabaseUrl, supabaseKey);
  const checkAuth = async (req, res, next) => {
    const password = req.headers["x-admin-password"];
    const { data } = await supabase.from("admin_settings").select("admin_password").eq("id", 1).single();
    const validPassword = data?.admin_password || process.env.ADMIN_PASSWORD || "admin123";
    if (password === validPassword) {
      next();
    } else {
      res.status(401).json({ error: "Unauthorized" });
    }
  };
  app.post("/api/admin/login", async (req, res) => {
    const { password } = req.body;
    const { data } = await supabase.from("admin_settings").select("admin_password").eq("id", 1).single();
    const validPassword = data?.admin_password || process.env.ADMIN_PASSWORD || "admin123";
    if (password === validPassword) {
      res.json({ success: true });
    } else {
      res.status(401).json({ error: "Unauthorized" });
    }
  });
  app.post("/api/admin/change-password", checkAuth, async (req, res) => {
    const { newPassword } = req.body;
    if (!newPassword) return res.status(400).json({ error: "New password is required" });
    const { error } = await supabase.from("admin_settings").upsert({ id: 1, admin_password: newPassword });
    if (error) return res.status(500).json({ error: error.message });
    res.json({ success: true });
  });
  const autoBackupDatabase = async () => {
    try {
      let allData = [];
      let currentPage = 0;
      const pageSize = 1e3;
      while (true) {
        const { data, error } = await supabase.from("admissions").select("*").range(currentPage * pageSize, (currentPage + 1) * pageSize - 1);
        if (error) throw error;
        if (!data || data.length === 0) break;
        allData = [...allData, ...data];
        if (data.length < pageSize) break;
        currentPage++;
      }
      const dateStr = (/* @__PURE__ */ new Date()).toISOString();
      const file_name = `auto_backup_${dateStr}.json`;
      await supabase.from("database_backups").insert({ file_name, backup_data: allData });
      const { data: backupsToDelete } = await supabase.from("database_backups").select("id").order("created_at", { ascending: false }).range(3, 100);
      if (backupsToDelete && backupsToDelete.length > 0) {
        const idsToDelete = backupsToDelete.map((b) => b.id);
        await supabase.from("database_backups").delete().in("id", idsToDelete);
      }
    } catch (err) {
      console.error("Auto backup failed:", err);
    }
  };
  app.post("/api/admin/admissions", checkAuth, async (req, res) => {
    const records = req.body;
    const { data, error } = await supabase.from("admissions").insert(records);
    if (error) return res.status(500).json({ error: error.message });
    res.json({ success: true, data });
    autoBackupDatabase().catch(console.error);
  });
  app.post("/api/admin/admissions/batch-delete", checkAuth, async (req, res) => {
    const { ids } = req.body;
    if (!ids || !Array.isArray(ids)) return res.status(400).json({ error: "Invalid ids array" });
    const { error } = await supabase.from("admissions").delete().in("id", ids);
    if (error) return res.status(500).json({ error: error.message });
    res.json({ success: true });
    autoBackupDatabase().catch(console.error);
  });
  app.post("/api/admin/admissions/batch-update", checkAuth, async (req, res) => {
    const { ids, updates } = req.body;
    if (!ids || !Array.isArray(ids)) return res.status(400).json({ error: "Invalid ids array" });
    const { error } = await supabase.from("admissions").update(updates).in("id", ids);
    if (error) return res.status(500).json({ error: error.message });
    res.json({ success: true });
    autoBackupDatabase().catch(console.error);
  });
  app.delete("/api/admin/admissions/:id", checkAuth, async (req, res) => {
    const { id } = req.params;
    const { error } = await supabase.from("admissions").delete().eq("id", id);
    if (error) return res.status(500).json({ error: error.message });
    res.json({ success: true });
    autoBackupDatabase().catch(console.error);
  });
  app.delete("/api/admin/admissions", checkAuth, async (req, res) => {
    const { error } = await supabase.from("admissions").delete().neq("id", 0);
    if (error) return res.status(500).json({ error: error.message });
    res.json({ success: true });
    autoBackupDatabase().catch(console.error);
  });
  app.post("/api/admin/admissions/deduplicate", checkAuth, async (req, res) => {
    let allData = [];
    let page = 0;
    const pageSize = 1e3;
    while (true) {
      const { data, error } = await supabase.from("admissions").select("id, ticket_number").order("id", { ascending: false }).range(page * pageSize, (page + 1) * pageSize - 1);
      if (error) return res.status(500).json({ error: error.message });
      if (!data || data.length === 0) break;
      allData = [...allData, ...data];
      if (data.length < pageSize) break;
      page++;
    }
    if (allData.length === 0) return res.json({ success: true, count: 0 });
    const deleteIds = [];
    const ticketMap = /* @__PURE__ */ new Set();
    for (const row of allData) {
      if (!row.ticket_number) continue;
      if (!ticketMap.has(row.ticket_number)) {
        ticketMap.add(row.ticket_number);
      } else {
        deleteIds.push(row.id);
      }
    }
    if (deleteIds.length === 0) {
      return res.json({ success: true, count: 0 });
    }
    const chunkSize = 1e3;
    for (let i = 0; i < deleteIds.length; i += chunkSize) {
      const chunk = deleteIds.slice(i, i + chunkSize);
      const { error: delError } = await supabase.from("admissions").delete().in("id", chunk);
      if (delError) {
        return res.status(500).json({ error: delError.message });
      }
    }
    res.json({ success: true, count: deleteIds.length });
    autoBackupDatabase().catch(console.error);
  });
  app.get("/api/admin/admissions/duplicate-tickets", checkAuth, async (req, res) => {
    let allData = [];
    let page = 0;
    const pageSize = 1e3;
    while (true) {
      const { data, error } = await supabase.from("admissions").select("ticket_number").range(page * pageSize, (page + 1) * pageSize - 1);
      if (error) return res.status(500).json({ error: error.message });
      if (!data || data.length === 0) break;
      allData = [...allData, ...data];
      if (data.length < pageSize) break;
      page++;
    }
    const counts = /* @__PURE__ */ new Map();
    for (const row of allData) {
      if (row.ticket_number) {
        counts.set(row.ticket_number, (counts.get(row.ticket_number) || 0) + 1);
      }
    }
    const duplicateTickets = [];
    for (const [ticket, count] of counts.entries()) {
      if (count > 1) duplicateTickets.push(ticket);
    }
    res.json({ success: true, duplicateTickets });
  });
  app.put("/api/admin/admissions/:id", checkAuth, async (req, res) => {
    const { id } = req.params;
    const updates = req.body;
    const { error } = await supabase.from("admissions").update(updates).eq("id", id);
    if (error) return res.status(500).json({ error: error.message });
    res.json({ success: true });
    autoBackupDatabase().catch(console.error);
  });
  app.get("/api/admin/backups", checkAuth, async (req, res) => {
    const { data, error } = await supabase.from("database_backups").select("id, created_at, file_name").order("created_at", { ascending: false });
    if (error) return res.status(500).json({ error: error.message });
    res.json({ success: true, backups: data });
  });
  app.get("/api/admin/backups/:id", checkAuth, async (req, res) => {
    const { id } = req.params;
    const { data, error } = await supabase.from("database_backups").select("backup_data").eq("id", id).single();
    if (error) return res.status(500).json({ error: error.message });
    if (!data) return res.status(404).json({ error: "Backup not found" });
    res.json({ success: true, backup_data: data.backup_data });
  });
  app.post("/api/admin/backups", checkAuth, async (req, res) => {
    const { file_name, backup_data } = req.body;
    const { error: insertError } = await supabase.from("database_backups").insert({ file_name, backup_data });
    if (insertError) return res.status(500).json({ error: insertError.message });
    const { data: backupsToDelete, error: fetchError } = await supabase.from("database_backups").select("id").order("created_at", { ascending: false }).range(3, 100);
    if (fetchError) return res.status(500).json({ error: fetchError.message });
    if (backupsToDelete && backupsToDelete.length > 0) {
      const idsToDelete = backupsToDelete.map((b) => b.id);
      await supabase.from("database_backups").delete().in("id", idsToDelete);
    }
    res.json({ success: true });
  });
  app.get("/api/proxy/pdf", async (req, res) => {
    const targetUrl = req.query.url;
    if (!targetUrl) {
      return res.status(400).json({ error: "URL is required" });
    }
    try {
      const response = await fetch(targetUrl, {
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36"
        }
      });
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      const contentType = response.headers.get("content-type");
      if (contentType && !contentType.includes("pdf") && !contentType.includes("octet-stream")) {
        console.warn("Proxy warning: Content-Type is not PDF:", contentType);
      }
      const arrayBuffer = await response.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);
      res.setHeader("Content-Type", "application/pdf");
      res.setHeader("Content-Disposition", 'inline; filename="proxy.pdf"');
      res.send(buffer);
    } catch (err) {
      console.error("Proxy Error:", err);
      res.status(500).json({ error: "Failed to fetch PDF from URL: " + err.message });
    }
  });
  let cachedCompletionRate = null;
  app.get("/api/stats/completion-rate", async (req, res) => {
    const currentYear = parseInt(req.query.year);
    if (!currentYear) {
      return res.status(400).json({ error: "Year is required" });
    }
    if (cachedCompletionRate && cachedCompletionRate.currentYear === currentYear && Date.now() - cachedCompletionRate.timestamp < 1e3 * 60 * 60) {
      return res.json({ rate: cachedCompletionRate.rate });
    }
    try {
      let page = 0;
      const pageSize = 1e3;
      const uniqueSchools = /* @__PURE__ */ new Set();
      while (true) {
        const { data, error } = await supabase.from("admissions").select("school_name").eq("year", currentYear.toString()).range(page * pageSize, (page + 1) * pageSize - 1);
        if (error) throw error;
        if (!data || data.length === 0) break;
        data.forEach((d) => {
          if (d.school_name) uniqueSchools.add(d.school_name);
        });
        if (data.length < pageSize) break;
        page++;
      }
      const totalSchools = 508;
      const rate = Math.min(uniqueSchools.size / totalSchools * 100, 100);
      cachedCompletionRate = { rate, timestamp: Date.now(), currentYear };
      res.json({ rate });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });
  if (process.env.NODE_ENV !== "production") {
    const vite = await (0, import_vite.createServer)({
      server: { middlewareMode: true },
      appType: "spa"
    });
    app.use(vite.middlewares);
  } else {
    const distPath = import_path.default.join(process.cwd(), "dist");
    app.use(import_express.default.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(import_path.default.join(distPath, "index.html"));
    });
  }
  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
  });
}
startServer();
//# sourceMappingURL=server.cjs.map
