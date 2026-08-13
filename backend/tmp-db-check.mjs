import pool from './config/database.js';

(async () => {
  try {
    const [tables] = await pool.query("SHOW TABLES LIKE 'users'");
    console.log('users table exists:', tables.length > 0);
    if (tables.length > 0) {
      const [rows] = await pool.query('SELECT id, email, password_hash, status FROM users WHERE email = ? LIMIT 1', ['owner@owner.com']);
      console.log('user rows:', rows.length);
      console.log(JSON.stringify(rows, null, 2));
    }
  } catch (err) {
    console.error('DB ERROR', err.stack || err.message);
  } finally {
    await pool.end();
  }
})();
