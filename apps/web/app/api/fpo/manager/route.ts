import { hashPassword, verifyPassword } from 'better-auth/crypto';
import { NextResponse } from 'next/server';
import sql from '@/app/api/utils/sql';
import { requireActor, FpoError, fpoError } from '@/lib/fpo-access';
export const dynamic = 'force-dynamic';
const headers = { 'Cache-Control': 'private, no-store' };
export async function GET(request: Request) {
  try {
    const actor = await requireActor(request);
    const [manager] = await sql`SELECT m.must_change_password,f.id,f.name,f.status,d.state,d.district,g.id AS group_id,u.email FROM fpo_manager_accounts m JOIN digital_fpos f ON f.id=m.digital_fpo_id JOIN fpo_districts d ON d.id=f.district_id JOIN farmer_groups g ON g.digital_fpo_id=f.id JOIN "user" u ON u.id=m.user_id WHERE m.user_id=${actor.id}`;
    if (!manager) throw new FpoError('This account is not an assigned FPO manager',403);
    const farmers = manager.must_change_password || manager.status !== 'active' ? [] : await sql`SELECT u.id,u.name FROM farmer_fpo_assignments a JOIN "user" u ON u.id=a.farmer_id WHERE a.group_id=${manager.group_id} AND can_receive_fpo_message(u.id,a.group_id) ORDER BY u.name,u.id`;
    return NextResponse.json({ manager, farmers }, { headers });
  } catch(e) { return fpoError(e); }
}
export async function POST(request: Request) {
  try {
    const actor = await requireActor(request);
    const body = await request.json();
    if (typeof body.currentPassword !== 'string' || body.currentPassword.length > 128 || typeof body.newPassword !== 'string' || body.newPassword.length < 12 || body.newPassword.length > 128 || body.currentPassword === body.newPassword) throw new FpoError('Choose a different password with 12–128 characters');
    const hash = await hashPassword(body.newPassword);
    await sql.begin(async tx => {
      const [manager] = await tx`SELECT user_id FROM fpo_manager_accounts WHERE user_id=${actor.id} FOR UPDATE`;
      if (!manager) throw new FpoError('FPO manager access required',403);
      const [account] = await tx`SELECT id,password FROM account WHERE "userId"=${actor.id} AND "providerId"='credential' FOR UPDATE`;
      if (!account?.password || !await verifyPassword({hash:account.password,password:body.currentPassword})) throw new FpoError('Current password is incorrect',400);
      await tx`UPDATE account SET password=${hash},"updatedAt"=now() WHERE id=${account.id}`;
      await tx`UPDATE fpo_manager_accounts SET must_change_password=false,updated_at=now() WHERE user_id=${actor.id}`;
      await tx`DELETE FROM session WHERE "userId"=${actor.id}`;
    });
    return NextResponse.json({ success: true }, { headers });
  } catch(e) { return fpoError(e); }
}
