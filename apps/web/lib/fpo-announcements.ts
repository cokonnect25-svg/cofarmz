import sql from '@/app/api/utils/sql';
import { sendPushToAllUsers, sendPushToUser } from '@/app/api/utils/push';
export async function deliverAnnouncement(groupId: string | null, payload: Parameters<typeof sendPushToUser>[1]) {
  if (!groupId) return sendPushToAllUsers(payload);
  const members = await sql`SELECT farmer_id FROM farmer_fpo_assignments WHERE group_id=${groupId} AND can_receive_fpo_message(farmer_id,group_id)`;
  const result = { attempted:0,succeeded:0,failed:0 };
  for (const member of members) {
    // Lock membership and FPO while submitting; reassignment/deactivation cannot race delivery.
    const delivery = await sql.begin(async tx => {
      const [a] = await tx`SELECT a.farmer_id FROM farmer_fpo_assignments a JOIN farmer_groups g ON g.id=a.group_id JOIN digital_fpos f ON f.id=g.digital_fpo_id JOIN "user" u ON u.id=a.farmer_id
        WHERE a.farmer_id=${member.farmer_id} AND a.group_id=${groupId} AND can_receive_fpo_message(a.farmer_id,a.group_id) FOR SHARE OF u,a,f`;
      if (!a) return null;
      // Push contains no private content. Opening the app fetches it after membership validation.
      return sendPushToUser(a.farmer_id, { title:'CoFarmz', body:'You have a new group update', url:'/chat', tag:payload.tag, data:{type:'fpo_update'} });
    });
    if (delivery) { result.attempted += delivery.attempted; result.succeeded += delivery.succeeded; result.failed += delivery.failed; }
  }
  return result;
}
