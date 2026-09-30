import sql from '@/app/api/utils/sql';
import { NextResponse } from 'next/server';
import { requireActor, canReviewFpos, fpoError, FpoError } from '@/lib/fpo-access';
export const dynamic='force-dynamic';
const headers={'Cache-Control':'private, no-store'};
const uuid=/^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i;
export async function GET(request:Request){
  try{
    const actor=await requireActor(request);
    const params=new URL(request.url).searchParams;
    const fpoId=params.get('fpoId');
    const offset=Number(params.get('offset')||0);
    if(!fpoId||!uuid.test(fpoId)||!Number.isSafeInteger(offset)||offset<0)throw new FpoError('Valid group and offset required');
    const [group]=await sql`SELECT id FROM farmer_groups WHERE digital_fpo_id=${fpoId} AND (${canReviewFpos(actor.role)} OR can_receive_fpo_message(${actor.id},id))`;
    if(!group)throw new FpoError('Only farmers tagged to this active FPO can access its group',403);
    const rows=await sql`SELECT m.id,m.body,m.created_at,m.sender_id,u.name AS sender_name, u.role AS sender_role
      FROM fpo_group_chat m JOIN "user" u ON u.id=m.sender_id
      WHERE m.group_id=${group.id} AND (${canReviewFpos(actor.role)} OR can_receive_fpo_message(${actor.id},m.group_id))
      ORDER BY m.created_at DESC,m.id DESC LIMIT 51 OFFSET ${offset}`;
    return NextResponse.json({messages:rows.slice(0,50),next:rows.length>50?offset+50:null},{headers});
  }catch(e){return fpoError(e);}
}
export async function POST(request:Request){
  try{
    const actor=await requireActor(request);
    const input=await request.json();
    if(!input||typeof input.fpoId!=='string'||!uuid.test(input.fpoId))throw new FpoError('Valid FPO required');
    if(typeof input.body!=='string'||!input.body.trim()||input.body.trim().length>5000)throw new FpoError('Enter a message of 1 to 5000 characters');
    const [message]=await sql`INSERT INTO fpo_group_chat(group_id,sender_id,body)
      SELECT g.id,${actor.id},${input.body.trim()} FROM farmer_groups g JOIN digital_fpos f ON f.id=g.digital_fpo_id
      WHERE g.digital_fpo_id=${input.fpoId} AND f.status='active' AND (${canReviewFpos(actor.role)} OR can_receive_fpo_message(${actor.id},g.id)) RETURNING id`;
    if(!message)throw new FpoError('Only farmers tagged to this active FPO can send group messages',403);
    return NextResponse.json({success:true},{status:201,headers});
  }catch(e){return fpoError(e);}
}
