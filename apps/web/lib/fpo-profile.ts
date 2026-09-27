import { FpoError } from './fpo-error';
export type FpoContact = { contact_phone?: string | null; office_address?: string | null; latitude?: number | null; longitude?: number | null };
export function validateFpoContact(input: Record<string, unknown>): FpoContact {
  function text(key: string, max: number) {
    const value = input[key];
    if (value == null || value === '') return null;
    if (typeof value !== 'string' || value.trim().length > max) throw new FpoError(`Invalid ${key.replaceAll('_', ' ')}`);
    return value.trim() || null;
  }
  const contact_phone = text('contact_phone', 30);
  if (contact_phone && !/^\+?[0-9 ()-]{7,30}$/.test(contact_phone)) throw new FpoError('Enter a valid phone number');
  if (contact_phone && (contact_phone.replace(/\D/g, '').length < 7 || contact_phone.replace(/\D/g, '').length > 15)) throw new FpoError('Enter a valid phone number');
  const office_address = text('office_address', 500);
  function coordinate(key: string, limit: number) {
    const value = input[key];
    if (value == null || value === '') return null;
    if (typeof value !== 'number' || !Number.isFinite(value) || Math.abs(value) > limit) throw new FpoError(`Invalid ${key}`);
    return value;
  }
  const latitude = coordinate('latitude', 90), longitude = coordinate('longitude', 180);
  if ((latitude === null) !== (longitude === null)) throw new FpoError('Provide both latitude and longitude');
  return { contact_phone, office_address, latitude, longitude };
}
export function fpoMapUrl(profile: FpoContact) {
  const { latitude, longitude, office_address } = profile;
  const coordinates = typeof latitude === 'number' && typeof longitude === 'number' && Number.isFinite(latitude) && Number.isFinite(longitude) && Math.abs(latitude) <= 90 && Math.abs(longitude) <= 180;
  const query = coordinates ? `${latitude},${longitude}` : office_address?.trim();
  return query ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}` : null;
}
