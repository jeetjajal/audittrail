const { Pool } = require('pg');
require('dotenv').config();

const connectionString = process.env.DATABASE_URL || 'postgres://audittrail_app:secret@localhost:5432/audittrail_dev';

const pool = new Pool({
  connectionString,
  max: 10,
  idleTimeoutMillis: 10000,
});

async function runAudit() {
  const client = await pool.connect();
  try {
    console.log('--- AUDITTRAIL AI DATABASE AUDIT ---');
    
    // 1. Role, Database, Version
    const meta = await client.query('SELECT current_user, current_database(), version();');
    console.log('Current User:', meta.rows[0].current_user);
    console.log('Database:', meta.rows[0].current_database);
    console.log('Version:', meta.rows[0].version.split(' on ')[0]);

    // 2. Tables & RLS Status
    const tables = await client.query(`
      SELECT t.tablename, t.rowsecurity
      FROM pg_tables t
      WHERE t.schemaname = 'public'
      ORDER BY t.tablename;
    `);
    console.log(`\nTotal Public Tables: ${tables.rows.length}`);
    tables.rows.forEach(r => {
      console.log(` - ${r.tablename}: RLS=${r.rowsecurity}`);
    });
    const rlsCount = tables.rows.filter(r => r.rowsecurity).length;
    console.log(`Tables with Row-Level Security: ${rlsCount} / ${tables.rows.length}`);
    
    // 3. Foreign Keys
    const fks = await client.query(`
      SELECT count(*) as fk_count
      FROM information_schema.table_constraints
      WHERE constraint_type = 'FOREIGN KEY' AND constraint_schema = 'public';
    `);
    console.log('Total Foreign Keys:', fks.rows[0].fk_count);

    // 4. Indexes
    const idxs = await client.query(`
      SELECT count(*) as index_count
      FROM pg_indexes
      WHERE schemaname = 'public';
    `);
    console.log('Total Indexes:', idxs.rows[0].index_count);

    // 5. Triggers
    const trigs = await client.query(`
      SELECT count(DISTINCT trigger_name) as trigger_count
      FROM information_schema.triggers
      WHERE trigger_schema = 'public';
    `);
    console.log('Total Triggers:', trigs.rows[0].trigger_count);

    // 6. Test RLS Isolation
    console.log('\n--- Testing RLS Isolation ---');
    await client.query('BEGIN;');
    await client.query("SELECT set_config('app.current_organization_id', '00000000-0000-0000-0000-000000000000', true);");
    const isolatedIncidents = await client.query('SELECT count(*) FROM incidents;');
    console.log('Rogue Tenant Incidents Count (Expected 0):', isolatedIncidents.rows[0].count);
    await client.query('ROLLBACK;');

    // 7. Test Transaction Rollback
    console.log('\n--- Testing Transaction Rollback ---');
    const testOrgId = 'ffffffff-ffff-ffff-ffff-ffffffffffff';
    await client.query('BEGIN;');
    await client.query("SELECT set_config('app.current_organization_id', $1, true);", [testOrgId]);
    await client.query(`
      INSERT INTO organizations (id, name, slug, atlassian_cloud_id, atlassian_installation_id, fda_establishment_id)
      VALUES ($1, 'Rollback Test Org', 'rollback-slug', 'rb-cloud', 'rb-inst', 'FDA-RB');
    `, [testOrgId]);
    const insideCount = await client.query('SELECT count(*) FROM organizations WHERE id = $1;', [testOrgId]);
    console.log('Records inside uncommitted transaction:', insideCount.rows[0].count);
    await client.query('ROLLBACK;');
    const afterCount = await client.query('SELECT count(*) FROM organizations WHERE id = $1;', [testOrgId]);
    console.log('Records after ROLLBACK:', afterCount.rows[0].count, '(Rollback SUCCESS:', afterCount.rows[0].count === '0', ')');

  } catch (err) {
    console.error('Audit Error:', err);
  } finally {
    client.release();
    await pool.end();
  }
}

runAudit();
