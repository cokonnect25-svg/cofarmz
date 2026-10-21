// Shared by the in-app feed and the WhatsApp scheduled reminder sweep.
export function profileReminderNeeds(user: {crop_count: unknown;latitude: unknown;longitude: unknown}) {
 return {needsCrops:Number(user.crop_count)===0,needsLocation:user.latitude==null || user.longitude==null};
}
