import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json({ limit: '100mb' }));
  app.use(express.urlencoded({ limit: '100mb', extended: true }));

  // API routes

  app.post("/api/upload-video", (req, res) => {
    try {
      const { file, filename } = req.body;
      if (!file || !filename) {
        return res.status(400).json({ error: 'Faltan datos de archivo' });
      }
      const base64Data = file.replace(/^data:video\/[^;]+;base64,/, "");
      const buffer = Buffer.from(base64Data, 'base64');
      const publicDir = path.resolve(process.cwd(), 'public');
      if (!fs.existsSync(publicDir)) {
        fs.mkdirSync(publicDir, { recursive: true });
      }
      const ext = path.extname(filename) || '.mp4';
      const targetPath = path.join(publicDir, `propaganda_video${ext}`);
      fs.writeFileSync(targetPath, buffer);
      res.json({ url: `/propaganda_video${ext}` });
    } catch (err: any) {
      res.status(500).json({ error: 'Error al guardar el archivo', details: err.message });
    }
  });

  app.get("/api/health", (req, res) => {
    res.json({ status: "ok", time: new Date().toISOString() });
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
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
