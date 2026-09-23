const express = require('express');
const { pool } = require('../db');

const router = express.Router();

// GET /api/todos - list all
router.get('/', async (req, res) => {
  try {
    const { rows } = await pool.query('SELECT * FROM todos ORDER BY id DESC');
    res.json({ data: rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch todos' });
  }
});

// GET /api/todos/:id - get one
router.get('/:id', async (req, res) => {
  try {
    const { rows } = await pool.query('SELECT * FROM todos WHERE id = $1', [req.params.id]);
    if (rows.length === 0) return res.status(404).json({ error: 'Todo not found' });
    res.json({ data: rows[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch todo' });
  }
});

// POST /api/todos - create
router.post('/', async (req, res) => {
  const title = (req.body.title || '').trim();
  if (!title) return res.status(400).json({ error: 'Title is required' });
  try {
    const { rows } = await pool.query(
      'INSERT INTO todos (title) VALUES ($1) RETURNING *',
      [title]
    );
    res.status(201).json({ data: rows[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to create todo' });
  }
});

// PUT /api/todos/:id - full update (title/completed)
router.put('/:id', async (req, res) => {
  const { title, completed } = req.body;
  try {
    const { rows } = await pool.query(
      `UPDATE todos SET
         title = COALESCE($1, title),
         completed = COALESCE($2, completed),
         updated_at = NOW()
       WHERE id = $3 RETURNING *`,
      [title ?? null, completed ?? null, req.params.id]
    );
    if (rows.length === 0) return res.status(404).json({ error: 'Todo not found' });
    res.json({ data: rows[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to update todo' });
  }
});

// PATCH /api/todos/:id/toggle - flip completed
router.patch('/:id/toggle', async (req, res) => {
  try {
    const { rows } = await pool.query(
      'UPDATE todos SET completed = NOT completed, updated_at = NOW() WHERE id = $1 RETURNING *',
      [req.params.id]
    );
    if (rows.length === 0) return res.status(404).json({ error: 'Todo not found' });
    res.json({ data: rows[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to toggle todo' });
  }
});

// DELETE /api/todos/:id
router.delete('/:id', async (req, res) => {
  try {
    const result = await pool.query('DELETE FROM todos WHERE id = $1', [req.params.id]);
    if (result.rowCount === 0) return res.status(404).json({ error: 'Todo not found' });
    res.json({ data: { id: Number(req.params.id) } });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to delete todo' });
  }
});

module.exports = router;
