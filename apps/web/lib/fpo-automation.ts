import sql from '@/app/api/utils/sql';
import { processFarmer } from './fpo-assignment';

// Run on a dedicated worker or scheduled job, not from a public GET request.
export async function reconcileFpoAssignments(shouldStop = () => false, onProgress: (message: string) => void = () => {}) {
  onProgress('Connecting to database');
  const connection = await sql.reserve();
  let locked = false;
  const totals = { processed: 0, assigned: 0, pending_location: 0, pending_fpo: 0, inactive_fpo: 0, errors: 0 };
  try {
    // A session lock prevents overlapping workers; PostgreSQL releases it if the worker dies.
    onProgress('Checking for another assignment worker');
    const [lock] = await connection`SELECT pg_try_advisory_lock(74621, 1) AS acquired`;
    locked = lock.acquired;
    if (!locked) { onProgress('Skipped: another assignment worker is already running'); return { skipped: true, ...totals }; }
    onProgress('Checking location mapping setup');
    const [schema] = await sql`SELECT to_regclass('fpo_subdistricts') IS NOT NULL AS subdistricts,
      to_regclass('fpo_localities') IS NOT NULL AS localities`;
    if (!schema.subdistricts || !schema.localities) {
      throw Object.assign(new Error('Location mapping tables are missing'), { code: 'FPO_SETUP_REQUIRED' });
    }
    onProgress('Loading district catalogue');
    const catalogue = await sql<any[]>`SELECT id,state,district FROM fpo_districts`;
    let after = '';
    while (!shouldStop()) {
      onProgress(`Loading next batch (${totals.processed + totals.errors} farmers checked)`);
      const batch = await sql`SELECT u.id FROM "user" u
        LEFT JOIN farmer_fpo_assignments a ON a.farmer_id=u.id
        WHERE u.role='farmer' AND u.id>${after}
          AND (a.assignment_status IS DISTINCT FROM 'assigned' OR a.group_id IS NULL
            OR a.district_id IS DISTINCT FROM u.district_id)
        ORDER BY u.id LIMIT 100`;
      if (!batch.length) break;
      onProgress(`Matching batch of ${batch.length} farmers using saved addresses and localities`);
      for (const farmer of batch) {
        if (shouldStop()) break;
        try {
          const result = await processFarmer(farmer.id, false, catalogue);
          totals.processed++;
          const status = result.assignment_status as keyof typeof totals;
          if (['assigned', 'pending_location', 'pending_fpo', 'inactive_fpo'].includes(status)) totals[status]++;
        } catch (error) {
          // Concurrent edits or temporary failures are retried next sweep.
          totals.errors++;
          const code = String((error as { code?: string })?.code || 'assignment_error').replace(/[^a-zA-Z0-9_]/g, '').slice(0, 40);
          onProgress(`Farmer could not be processed (${code}); will retry next sweep`);
        }
        if ((totals.processed + totals.errors) % 10 === 0) onProgress(`Checked ${totals.processed + totals.errors}: ${totals.assigned} assigned, ${totals.pending_location} unresolved locations, ${totals.pending_fpo} missing FPOs, ${totals.inactive_fpo} inactive FPOs, ${totals.errors} errors`);
      }
      after = batch[batch.length - 1].id;
    }
    onProgress(shouldStop() ? 'Stopped safely; completed assignments are saved' : 'Assignment sweep complete');
    return { skipped: false, ...totals };
  } finally {
    try { if (locked) await connection`SELECT pg_advisory_unlock(74621, 1)`; }
    finally { connection.release(); }
  }
}
