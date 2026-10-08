require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { initDb } = require('./db');
const todosRouter = require('./routes/todos');

const app = express();
const PORT = process.env.PORT || 3000;

const allowedOrigins = (process.env.CORS_ORIGIN || 'http://localhost:4200')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);

app.use(
  cors({
    origin: (origin, cb) => {
      // อนุญาต request ที่ไม่มี Origin (curl, Postman, health check) + origin ใน allowlist
      if (!origin || allowedOrigins.includes(origin)) return cb(null, true);
      return cb(null, false);
    },
  })
);
app.use(express.json());

app.get('/health', (req, res) => res.json({ status: 'ok' }));
app.use('/api/todos', todosRouter);

async function start() {
  try {
    await initDb();
    console.log('Database ready');
  } catch (err) {
    console.error('Database init failed. Is PostgreSQL running? DATABASE_URL=', process.env.DATABASE_URL);
    console.error(err);
    process.exit(1);
  }
  app.listen(PORT, () => {
    console.log(`Todo API listening on http://localhost:${PORT}`);
  });
}

start();
