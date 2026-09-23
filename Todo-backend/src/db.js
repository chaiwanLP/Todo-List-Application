const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

pool.on('error', (err) => {
  console.error('Postgres pool error', err);
});

async function initDb() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS todos (
      id SERIAL PRIMARY KEY,
      title TEXT NOT NULL,
      category TEXT NOT NULL DEFAULT '',
      due_date TIMESTAMPTZ NULL,
      status TEXT NOT NULL DEFAULT 'todo' CHECK (status IN ('todo', 'doing', 'done')),
      completed BOOLEAN NOT NULL DEFAULT FALSE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);
  // Migrate existing databases created before these columns existed
  await pool.query(`ALTER TABLE todos ADD COLUMN IF NOT EXISTS category TEXT NOT NULL DEFAULT ''`);
  await pool.query(`ALTER TABLE todos ADD COLUMN IF NOT EXISTS due_date TIMESTAMPTZ NULL`);
  await pool.query(`ALTER TABLE todos ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'todo'`);
  await pool.query(`DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'todos_status_check') THEN
      ALTER TABLE todos ADD CONSTRAINT todos_status_check CHECK (status IN ('todo', 'doing', 'done'));
    END IF;
  END $$`);
  // Backfill: keep status/completed in sync for old rows
  await pool.query(`UPDATE todos SET status = 'done' WHERE completed = TRUE AND status = 'todo'`);
  await pool.query(`UPDATE todos SET completed = TRUE WHERE status = 'done' AND completed = FALSE`);
}

module.exports = { pool, initDb };
