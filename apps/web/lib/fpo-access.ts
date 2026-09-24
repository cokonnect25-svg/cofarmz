import { auth } from '@/lib/auth';
import sql from '@/app/api/utils/sql';
import { NextResponse } from 'next/server';

import { FpoError } from './fpo-error';
export { FpoError } from './fpo-error';
export const isSuperAdmin = (role: unknown) => ['superadmin', 'super_admin'].includes(String(role));
export const canReviewFpos = (role: unknown) => role === 'admin' || isSuperAdmin(role);
export async function requireFpoReviewer(request: Request) {
  const actor = await requireActor(request);
  if (!canReviewFpos(actor.role)) throw new FpoError('Admin access required', 403);
  return actor;
}
export async function requireActor(request: Request, admin = false) {
  if (!['GET','HEAD','OPTIONS'].includes(request.method) && !request.headers.get('content-type')?.toLowerCase().startsWith('application/json')) {
    throw new FpoError('JSON request required',415);
  }
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session?.user?.id) throw new FpoError('Sign in required', 401);
  const [actor] = await sql`SELECT id,role FROM "user" WHERE id=${session.user.id}`;
  if (!actor) throw new FpoError('Sign in required', 401);
  if (admin && !isSuperAdmin(actor.role)) throw new FpoError('Super Admin access required', 403);
  return actor;
}
export function fpoError(error: unknown) {
  if (error instanceof FpoError) return NextResponse.json({ error: error.message }, { status: error.status });
  if ((error as {code?: string})?.code === '23505') return NextResponse.json({ error: 'This district already has a Digital FPO' }, { status: 409 });
  console.error('Digital FPO operation failed', error);
  return NextResponse.json({ error: 'Unable to complete Digital FPO operation' }, { status: 500 });
}
export function rejectAssignmentInput(body: Record<string, unknown>) {
  if (['district_id','digital_fpo_id','group_id','assignment_status','assignment_source'].some(k => k in body)) {
    throw new FpoError('Group assignment is determined by your validated location');
  }
}
