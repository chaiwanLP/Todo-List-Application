const express = require('express');
const { pool } = require('../db');

const router = express.Router();
const STATUSES = ['todo', 'doing', 'done'];

const SELECT_WITH_OVERDUE = `
  *, (due_date IS NOT NULL AND due_date < NOW() AND status <> 'done') AS overdue,
  (due_date IS NOT NULL AND due_date >= NOW() AND due_date < NOW() + INTERVAL '24 hours' AND status <> 'done') AS due_soon
  FROM todos`;

function toBool(v) {
  if (v === undefined) return undefined;
  return v === true || v === 'true' || v === 1 || v === '1';
}

// GET /api/todos?status=doing&overdue=true&q=xxx - list + filters
router.get('/', async (req, res) => {
  try {
    const clauses = [];
    const params = [];
    if (STATUSES.includes(req.query.status)) {
      params.push(req.query.status);
      clauses.push(`status = $${params.length}`);
    }
    if (req.query.overdue === 'true') {
      clauses.push(`due_date IS NOT NULL AND due_date < NOW() AND status <> 'done'`);
    }
    if (req.query.due_soon === 'true') {
      clauses.push(`due_date IS NOT NULL AND due_date >= NOW() AND due_date < NOW() + INTERVAL '24 hours' AND status <> 'done'`);
    }
    if (req.query.q) {
      params.push(`%${req.query.q}%`);
      clauses.push(`(title ILIKE $${params.length} OR category ILIKE $${params.length})`);
    }
    const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';
    const { rows } = await pool.query(
      `SELECT ${SELECT_WITH_OVERDUE} ${where} ORDER BY
        CASE WHEN due_date IS NULL THEN 1 ELSE 0 END, due_date ASC, id DESC`
    );
    res.json({ data: rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch todos' });
  }
});

// GET /api/todos/:id - get one
router.get('/:id', async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT ${SELECT_WITH_OVERDUE} WHERE id = $1`,
      [req.params.id]
    );
    if (rows.length === 0) return res.status(404).json({ error: 'Todo not found' });
    res.json({ data: rows[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch todo' });
  }
});

// POST /api/todos - create {title, category?, due_date?, status?}
router.post('/', async (req, res) => {
  const title = (req.body.title || '').trim();
  if (!title) return res.status(400).json({ error: 'Title is required' });
  const category = (req.body.category || '').trim();
  const dueDate = req.body.due_date || null;
  let status = STATUSES.includes(req.body.status) ? req.body.status : 'todo';
  if (dueDate && isNaN(Date.parse(dueDate))) {
    return res.status(400).json({ error: 'Invalid due_date (use ISO string)' });
  }
  try {
    const { rows } = await pool.query(
      `INSERT INTO todos (title, category, due_date, status, completed)
       VALUES ($1, $2, $3, $4, $4 = 'done') RETURNING *, (due_date IS NOT NULL AND due_date < NOW() AND status <> 'done') AS overdue, (due_date IS NOT NULL AND due_date >= NOW() AND due_date < NOW() + INTERVAL '24 hours' AND status <> 'done') AS due_soon`,
      [title, category, dueDate, status]
    );
    res.status(201).json({ data: rows[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to create todo' });
  }
});

// PUT /api/todos/:id - update {title?, category?, due_date? (null=clear), status?, completed?}
router.put('/:id', async (req, res) => {
  const { title, category } = req.body;
  const hasDue = Object.prototype.hasOwnProperty.call(req.body, 'due_date');
  const dueDate = req.body.due_date;
  let { status, completed } = req.body;
  if (status !== undefined && !STATUSES.includes(status)) {
    return res.status(400).json({ error: 'Invalid status (todo|doing|done)' });
  }
  if (hasDue && dueDate !== null && isNaN(Date.parse(dueDate))) {
    return res.status(400).json({ error: 'Invalid due_date (use ISO string or null)' });
  }
  // Keep completed/status in sync when only one is sent
  const completedBool = toBool(completed);
  if (status === undefined && completedBool !== undefined) {
    status = completedBool ? 'done' : 'todo';
  }
  if (completedBool === undefined && status !== undefined) {
    completed = status === 'done';
  } else if (completedBool !== undefined) {
    completed = completedBool;
  }
  const sets = ['updated_at = NOW()'];
  const params = [];
  if (title !== undefined) {
    params.push(title);
    sets.push(`title = $${params.length}`);
  }
  if (category !== undefined) {
    params.push(category);
    sets.push(`category = $${params.length}`);
  }
  if (hasDue) {
    if (dueDate === null) {
      sets.push('due_date = NULL');
    } else {
      params.push(dueDate);
      sets.push(`due_date = $${params.length}::timestamptz`);
    }
  }
  if (status !== undefined) {
    params.push(status);
    sets.push(`status = $${params.length}`);
  }
  if (completed !== undefined) {
    params.push(completed);
    sets.push(`completed = $${params.length}`);
  }
  if (sets.length === 1) {
    return res.status(400).json({ error: 'Nothing to update' });
  }
  try {
    params.push(req.params.id);
    const { rows } = await pool.query(
      `UPDATE todos SET ${sets.join(', ')}
       WHERE id = $${params.length}
       RETURNING *, (due_date IS NOT NULL AND due_date < NOW() AND status <> 'done') AS overdue, (due_date IS NOT NULL AND due_date >= NOW() AND due_date < NOW() + INTERVAL '24 hours' AND status <> 'done') AS due_soon`,
      params
    );
    if (rows.length === 0) return res.status(404).json({ error: 'Todo not found' });
    res.json({ data: rows[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to update todo' });
  }
});

// PATCH /api/todos/:id/status - {status} : todo -> doing -> done
router.patch('/:id/status', async (req, res) => {
  const { status } = req.body;
  if (!STATUSES.includes(status)) {
    return res.status(400).json({ error: 'Invalid status (todo|doing|done)' });
  }
  try {
    const { rows } = await pool.query(
      `UPDATE todos SET status = $1, completed = ($1 = 'done'), updated_at = NOW()
       WHERE id = $2
       RETURNING *, (due_date IS NOT NULL AND due_date < NOW() AND status <> 'done') AS overdue, (due_date IS NOT NULL AND due_date >= NOW() AND due_date < NOW() + INTERVAL '24 hours' AND status <> 'done') AS due_soon`,
      [status, req.params.id]
    );
    if (rows.length === 0) return res.status(404).json({ error: 'Todo not found' });
    res.json({ data: rows[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to update status' });
  }
});

// PATCH /api/todos/:id/toggle - flip completed (kept for compat)
router.patch('/:id/toggle', async (req, res) => {
  try {
    const { rows } = await pool.query(
      `UPDATE todos SET
         completed = NOT completed,
         status = CASE WHEN NOT completed THEN 'done' ELSE 'todo' END,
         updated_at = NOW()
       WHERE id = $1
       RETURNING *, (due_date IS NOT NULL AND due_date < NOW() AND status <> 'done') AS overdue, (due_date IS NOT NULL AND due_date >= NOW() AND due_date < NOW() + INTERVAL '24 hours' AND status <> 'done') AS due_soon`,
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
