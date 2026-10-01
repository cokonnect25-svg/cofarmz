import { randomBytes, randomUUID } from 'node:crypto';
import { hashPassword } from 'better-auth/crypto';
import { NextResponse } from 'next/server';
import sql from '@/app/api/utils/sql';
import { requireFpoReviewer, FpoError, fpoError } from '@/lib/fpo-access';

export const dynamic = 'force-dynamic';
const headers = { 'Cache-Control': 'private, no-store' };
function validId(id: unknown): asserts id is string {
  if (typeof id !== 'string' || !/^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i.test(id)) throw new FpoError('Invalid FPO ID');
}
export async function GET(request: Request) {
  try {
    await requireFpoReviewer(request);
    const id = new URL(request.url).searchParams.get('fpoId'); validId(id);
    const [account] = await sql`SELECT u.email,u.name,m.must_change_password FROM fpo_manager_accounts m JOIN "user" u ON u.id=m.user_id WHERE m.digital_fpo_id=${id}`;
    return NextResponse.json({ account: account || null }, { headers });
  } catch (e) { return fpoError(e); }
}
export async function POST(request: Request) {
  try {
    const actor = await requireFpoReviewer(request);
    const body = await request.json(); validId(body.fpoId);
    if (!['create','reset'].includes(body.action)) throw new FpoError('Invalid credential action');
    const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
    if (body.action === 'create' && (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254)) throw new FpoError('Enter a valid manager email');
    const password = randomBytes(18).toString('base64url');
    const hash = await hashPassword(password);
    const result = await sql.begin(async tx => {
      const [fpo] = await tx`SELECT id,name FROM digital_fpos WHERE id=${body.fpoId} FOR UPDATE`;
      if (!fpo) throw new FpoError('FPO not found',404);
      const [manager] = await tx`SELECT m.user_id,u.email FROM fpo_manager_accounts m JOIN "user" u ON u.id=m.user_id WHERE m.digital_fpo_id=${fpo.id} FOR UPDATE OF m`;
      if (body.action === 'create') {
        if (manager) throw new FpoError('This FPO already has a login. Use reset temporary password.',409);
        const [existing] = await tx`SELECT id FROM "user" WHERE lower(email)=${email}`;
        if (existing) throw new FpoError('Email already belongs to an account. Use a separate FPO login email.',409);
        const userId = randomUUID();
        await tx`INSERT INTO "user"(id,name,email,"emailVerified",role,role_confirmed,"createdAt","updatedAt") VALUES(${userId},${fpo.name},${email},false,'fpo',true,now(),now())`;
        await tx`INSERT INTO account(id,"userId","accountId","providerId",password,"createdAt","updatedAt") VALUES(${randomUUID()},${userId},${userId},'credential',${hash},now(),now())`;
        await tx`INSERT INTO fpo_manager_accounts(digital_fpo_id,user_id,updated_by) VALUES(${fpo.id},${userId},${actor.id})`;
        return { email };
      }
      if (!manager) throw new FpoError('Create an FPO login first',404);
      const accounts = await tx`UPDATE account SET password=${hash},"updatedAt"=now() WHERE "userId"=${manager.user_id} AND "providerId"='credential' RETURNING id`;
      if (!accounts.length) throw new FpoError('FPO password account is missing',409);
      await tx`DELETE FROM session WHERE "userId"=${manager.user_id}`;
      await tx`UPDATE fpo_manager_accounts SET must_change_password=true,updated_by=${actor.id},updated_at=now() WHERE digital_fpo_id=${fpo.id}`;
      return { email: manager.email };
    });
    return NextResponse.json({ ...result, temporaryPassword: password, loginPath: '/fpo/login' }, { headers });
  } catch (e) {
    if ((e as {code?:string})?.code === '23505') return NextResponse.json({error:'This email or FPO already has an account'}, {status:409,headers});
    return fpoError(e);
  }
}
