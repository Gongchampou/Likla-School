// Minimal Express server to serve the Vite-built SPA
import express from 'express';
import path from 'path';
import compression from 'compression';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(compression());

const distPath = path.join(__dirname, 'dist');
app.use(express.static(distPath, { maxAge: '1y', etag: false }));

// SPA fallback
app.get('*', (_req, res) => {
  res.sendFile(path.join(distPath, 'index.html'));
});

const port = process.env.PORT || 3000;
app.listen(port, () => console.log(`Server running on http://localhost:${port}`));
