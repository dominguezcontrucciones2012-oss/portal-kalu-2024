import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";
import multer from "multer";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json({ limit: '100mb' }));
  app.use(express.urlencoded({ limit: '100mb', extended: true }));

  // API routes

  // Configurar multer para subida de archivos
  const storage = multer.diskStorage({
    destination: (req, file, cb) => {
      const publicDir = path.resolve(process.cwd(), 'public');
      if (!fs.existsSync(publicDir)) {
        fs.mkdirSync(publicDir, { recursive: true });
      }
      cb(null, publicDir);
    },
    filename: (req, file, cb) => {
      const ext = path.extname(file.originalname) || '.mp4';
      cb(null, `propaganda_video${ext}`);
    }
  });
  const upload = multer({ storage });

  app.post("/api/upload-video", upload.single('video'), (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: 'No se recibió ningún archivo de video.' });
      }
      res.json({ url: `/${req.file.filename}` });
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
