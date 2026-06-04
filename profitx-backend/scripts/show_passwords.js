const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

(async () => {
  try {
    const res = await pool.query('SELECT id, email, password, supabase_id FROM users ORDER BY id');
    if (!res.rows || res.rows.length === 0) {
      console.log('No users found');
    } else {
      console.table(res.rows.map(r => ({ id: r.id, email: r.email, password: r.password, supabaseId: r.supabase_id })));
    }
  } catch (err) {
    console.error('Query error:', err);
  } finally {
    await pool.end();
  }
})();
