import express from 'express';
import cors from 'cors';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { dailyRouter } from './routes/daily.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

app.use('/api', dailyRouter);
app.use('/targets', express.static(path.join(__dirname, 'public', 'targets')));

app.get('/health', (_req, res) => res.json({ ok: true }));

app.listen(PORT, () => {
  console.log(`🌳 bonsai-daily server on http://localhost:${PORT}`);
});
