import sql from '@/app/api/utils/sql';
import { processFarmer } from './fpo-assignment';

// Run on a dedicated worker or scheduled job, not from a public GET request.
export async function reconcileFpoAssignments(shouldStop = () => false) {
  const connection = await sql.reserve();
  let locked = false;
  const totals = { processed: 0, assigned: 0, pending_location: 0, pending_fpo: 0, inactive_fpo: 0, errors: 0 };
  try {
    // A session lock prevents overlapping workers; PostgreSQL releases it if the worker dies.
    const [lock] = await connection`SELECT pg_try_advisory_lock(74621, 1) AS acquired`;
    locked = lock.acquired;
    if (!locked) return { skipped: true, ...totals };
    const catalogue = await sql<any[]>`SELECT id,state,district FROM fpo_districts`;
    let after = '';
    while (!shouldStop()) {
      const batch = await sql`SELECT u.id FROM "user" u
        LEFT JOIN farmer_fpo_assignments a ON a.farmer_id=u.id
        WHERE u.role='farmer' AND u.id>${after}
          AND (a.assignment_status IS DISTINCT FROM 'assigned' OR a.group_id IS NULL
            OR a.district_id IS DISTINCT FROM u.district_id)
        ORDER BY u.id LIMIT 100`;
      if (!batch.length) break;
      for (const farmer of batch) {
        if (shouldStop()) break;
        try {
          const result = await processFarmer(farmer.id, false, catalogue);
          totals.processed++;
          const status = result.assignment_status as keyof typeof totals;
          if (['assigned', 'pending_location', 'pending_fpo', 'inactive_fpo'].includes(status)) totals[status]++;
        } catch {
          // Concurrent edits or temporary failures are retried next sweep.
          totals.errors++;
        }
      }
      after = batch[batch.length - 1].id;
    }
    return { skipped: false, ...totals };
  } finally {
    try { if (locked) await connection`SELECT pg_advisory_unlock(74621, 1)`; }
    finally { connection.release(); }
  }
}
