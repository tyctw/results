import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { createClient } from "@supabase/supabase-js";

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json({ limit: "50mb" }));

  // API routes
  const supabaseUrl = process.env.VITE_SUPABASE_URL || '';
  // 優先使用 Service Role Key 以允許後端繞過 RLS，否則降級使用 Anon Key
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY || '';
  const supabase = createClient(supabaseUrl, supabaseKey);

  const checkAuth = async (req: express.Request, res: express.Response, next: express.NextFunction) => {
    const password = req.headers['x-admin-password'];
    
    // 從資料庫取得密碼
    const { data } = await supabase
      .from('admin_settings')
      .select('admin_password')
      .eq('id', 1)
      .single();
      
    const validPassword = data?.admin_password || process.env.ADMIN_PASSWORD || 'admin123';

    if (password === validPassword) {
      next();
    } else {
      res.status(401).json({ error: 'Unauthorized' });
    }
  };

  app.post("/api/admin/login", async (req, res) => {
    const { password } = req.body;
    
    // 從資料庫取得密碼
    const { data } = await supabase
      .from('admin_settings')
      .select('admin_password')
      .eq('id', 1)
      .single();
      
    const validPassword = data?.admin_password || process.env.ADMIN_PASSWORD || 'admin123';

    if (password === validPassword) {
      res.json({ success: true });
    } else {
      res.status(401).json({ error: 'Unauthorized' });
    }
  });

  app.post("/api/admin/change-password", checkAuth, async (req, res) => {
    const { newPassword } = req.body;
    if (!newPassword) return res.status(400).json({ error: 'New password is required' });
    
    const { error } = await supabase
      .from('admin_settings')
      .upsert({ id: 1, admin_password: newPassword });
      
    if (error) return res.status(500).json({ error: error.message });
    res.json({ success: true });
  });

  // Admin routes (Protected)
  
  // 自動備份輔助函數
  const autoBackupDatabase = async () => {
    try {
      let allData = [];
      let currentPage = 0;
      const pageSize = 1000;
      
      while (true) {
        const { data, error } = await supabase
          .from('admissions')
          .select('*')
          .range(currentPage * pageSize, (currentPage + 1) * pageSize - 1);
          
        if (error) throw error;
        if (!data || data.length === 0) break;
        
        allData = [...allData, ...data];
        if (data.length < pageSize) break;
        currentPage++;
      }
      
      const dateStr = new Date().toISOString();
      const file_name = `auto_backup_${dateStr}.json`;
      
      // Insert new backup
      await supabase
        .from('database_backups')
        .insert({ file_name, backup_data: allData });
        
      // Keep only the 3 most recent backups
      const { data: backupsToDelete } = await supabase
        .from('database_backups')
        .select('id')
        .order('created_at', { ascending: false })
        .range(3, 100);
        
      if (backupsToDelete && backupsToDelete.length > 0) {
        const idsToDelete = backupsToDelete.map(b => b.id);
        await supabase
          .from('database_backups')
          .delete()
          .in('id', idsToDelete);
      }
    } catch (err) {
      console.error('Auto backup failed:', err);
    }
  };

app.post("/api/admin/admissions", checkAuth, async (req, res) => {
    const records = req.body;
    const { data, error } = await supabase.from('admissions').insert(records);
    if (error) return res.status(500).json({ error: error.message });
    res.json({ success: true, data });
    autoBackupDatabase().catch(console.error);
  });

  app.post("/api/admin/admissions/batch-delete", checkAuth, async (req, res) => {
    const { ids } = req.body;
    if (!ids || !Array.isArray(ids)) return res.status(400).json({ error: 'Invalid ids array' });
    const { error } = await supabase.from('admissions').delete().in('id', ids);
    if (error) return res.status(500).json({ error: error.message });
    res.json({ success: true });
    autoBackupDatabase().catch(console.error);
  });

  app.post("/api/admin/admissions/batch-update", checkAuth, async (req, res) => {
    const { ids, updates } = req.body;
    if (!ids || !Array.isArray(ids)) return res.status(400).json({ error: 'Invalid ids array' });
    const { error } = await supabase.from('admissions').update(updates).in('id', ids);
    if (error) return res.status(500).json({ error: error.message });
    res.json({ success: true });
    autoBackupDatabase().catch(console.error);
  });

  app.delete("/api/admin/admissions/:id", checkAuth, async (req, res) => {
    const { id } = req.params;
    const { error } = await supabase.from('admissions').delete().eq('id', id);
    if (error) return res.status(500).json({ error: error.message });
    res.json({ success: true });
    autoBackupDatabase().catch(console.error);
  });

  app.delete("/api/admin/admissions", checkAuth, async (req, res) => {
    const { error } = await supabase.from('admissions').delete().neq('id', 0);
    if (error) return res.status(500).json({ error: error.message });
    res.json({ success: true });
    autoBackupDatabase().catch(console.error);
  });

  app.post("/api/admin/admissions/deduplicate", checkAuth, async (req, res) => {
    let allData: any[] = [];
    let page = 0;
    const pageSize = 1000;
    
    while (true) {
      const { data, error } = await supabase
        .from('admissions')
        .select('id, ticket_number')
        .order('id', { ascending: false })
        .range(page * pageSize, (page + 1) * pageSize - 1);
        
      if (error) return res.status(500).json({ error: error.message });
      if (!data || data.length === 0) break;
      
      allData = [...allData, ...data];
      if (data.length < pageSize) break;
      page++;
    }
    
    if (allData.length === 0) return res.json({ success: true, count: 0 });
    
    const deleteIds: number[] = [];
    const ticketMap = new Set();
    
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
    
    const chunkSize = 1000;
    for (let i = 0; i < deleteIds.length; i += chunkSize) {
      const chunk = deleteIds.slice(i, i + chunkSize);
      const { error: delError } = await supabase.from('admissions').delete().in('id', chunk);
      if (delError) {
         return res.status(500).json({ error: delError.message });
      }
    }
    
    res.json({ success: true, count: deleteIds.length });
    autoBackupDatabase().catch(console.error);
  });

  app.get("/api/admin/admissions/duplicate-tickets", checkAuth, async (req, res) => {
    let allData: any[] = [];
    let page = 0;
    const pageSize = 1000;
    
    while (true) {
      const { data, error } = await supabase
        .from('admissions')
        .select('ticket_number')
        .range(page * pageSize, (page + 1) * pageSize - 1);
        
      if (error) return res.status(500).json({ error: error.message });
      if (!data || data.length === 0) break;
      
      allData = [...allData, ...data];
      if (data.length < pageSize) break;
      page++;
    }

    const counts = new Map<string, number>();
    for (const row of allData) {
      if (row.ticket_number) {
        counts.set(row.ticket_number, (counts.get(row.ticket_number) || 0) + 1);
      }
    }

    const duplicateTickets: string[] = [];
    for (const [ticket, count] of counts.entries()) {
      if (count > 1) duplicateTickets.push(ticket);
    }
    
    res.json({ success: true, duplicateTickets });
  });

  app.put("/api/admin/admissions/:id", checkAuth, async (req, res) => {
    const { id } = req.params;
    const updates = req.body;
    const { error } = await supabase.from('admissions').update(updates).eq('id', id);
    if (error) return res.status(500).json({ error: error.message });
    res.json({ success: true });
    autoBackupDatabase().catch(console.error);
  });

  
  app.get("/api/admin/backups", checkAuth, async (req, res) => {
    const { data, error } = await supabase
      .from('database_backups')
      .select('id, created_at, file_name')
      .order('created_at', { ascending: false });
      
    if (error) return res.status(500).json({ error: error.message });
    res.json({ success: true, backups: data });
  });

  app.get("/api/admin/backups/:id", checkAuth, async (req, res) => {
    const { id } = req.params;
    const { data, error } = await supabase
      .from('database_backups')
      .select('backup_data')
      .eq('id', id)
      .single();
      
    if (error) return res.status(500).json({ error: error.message });
    if (!data) return res.status(404).json({ error: 'Backup not found' });
    res.json({ success: true, backup_data: data.backup_data });
  });

  app.post("/api/admin/backups", checkAuth, async (req, res) => {
    const { file_name, backup_data } = req.body;
    
    // Insert new backup
    const { error: insertError } = await supabase
      .from('database_backups')
      .insert({ file_name, backup_data });
      
    if (insertError) return res.status(500).json({ error: insertError.message });
    
    // Keep only the 3 most recent backups
    const { data: backupsToDelete, error: fetchError } = await supabase
      .from('database_backups')
      .select('id')
      .order('created_at', { ascending: false })
      .range(3, 100);
      
    if (fetchError) return res.status(500).json({ error: fetchError.message });
    
    if (backupsToDelete && backupsToDelete.length > 0) {
      const idsToDelete = backupsToDelete.map(b => b.id);
      await supabase
        .from('database_backups')
        .delete()
        .in('id', idsToDelete);
    }
    
    res.json({ success: true });
  });

app.get("/api/proxy/pdf", async (req, res) => {
    const targetUrl = req.query.url as string;
    if (!targetUrl) {
      return res.status(400).json({ error: 'URL is required' });
    }

    try {
      const response = await fetch(targetUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
        }
      });
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const contentType = response.headers.get('content-type');
      if (contentType && !contentType.includes('pdf') && !contentType.includes('octet-stream')) {
        console.warn('Proxy warning: Content-Type is not PDF:', contentType);
      }

      const arrayBuffer = await response.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);

      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', 'inline; filename="proxy.pdf"');
      res.send(buffer);
    } catch (err: any) {
      console.error('Proxy Error:', err);
      res.status(500).json({ error: 'Failed to fetch PDF from URL: ' + err.message });
    }
  });

  // Stats endpoint
  let cachedCompletionRate: { rate: number, timestamp: number, currentYear: number } | null = null;

  app.get("/api/stats/completion-rate", async (req, res) => {
    const currentYear = parseInt(req.query.year as string);
    if (!currentYear) {
      return res.status(400).json({ error: 'Year is required' });
    }

    if (cachedCompletionRate && cachedCompletionRate.currentYear === currentYear && Date.now() - cachedCompletionRate.timestamp < 1000 * 60 * 60) {
      return res.json({ rate: cachedCompletionRate.rate });
    }

    try {
      let page = 0;
      const pageSize = 1000;
      const uniqueSchools = new Set();
      
      while (true) {
        const { data, error } = await supabase
          .from('admissions')
          .select('school_name')
          .eq('year', currentYear.toString())
          .range(page * pageSize, (page + 1) * pageSize - 1);
          
        if (error) throw error;
        if (!data || data.length === 0) break;
        
        data.forEach(d => {
          if (d.school_name) uniqueSchools.add(d.school_name);
        });
        if (data.length < pageSize) break;
        page++;
      }
      
      const totalSchools = 508;
      const rate = Math.min((uniqueSchools.size / totalSchools) * 100, 100);
      
      cachedCompletionRate = { rate, timestamp: Date.now(), currentYear };
      res.json({ rate });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
