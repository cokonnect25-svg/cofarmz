export function validateCropProfileFields(body: { comment?: unknown; cultivated_acres?: unknown }, role: unknown) {
  if (body.comment != null && typeof body.comment !== 'string') throw new Error('Comment must be text');
  const comment = typeof body.comment === 'string' ? body.comment.trim() : null;
  if (comment && comment.length > 2000) throw new Error('Comment must be 2000 characters or fewer');
  const value = body.cultivated_acres;
  let acres: number | null = null;
  if (value !== undefined && value !== null && value !== '') {
    if (role !== 'farmer') throw new Error('Only farmers can enter acres cultivated');
    if ((typeof value !== 'number' && typeof value !== 'string') || (typeof value === 'string' && !/^\d+(\.\d+)?$/.test(value.trim()))) throw new Error('Acres cultivated must be a positive number');
    acres = Number(value);
    if (!Number.isFinite(acres) || acres <= 0) throw new Error('Acres cultivated must be a positive number');
  }
  return { comment: comment || null, cultivated_acres: acres };
}
