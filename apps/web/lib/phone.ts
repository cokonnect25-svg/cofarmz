export function normalizePhoneNumber(phone?: string | null, defaultCountryCode = '91') {
  const raw = String(phone || '').trim();
  const digits = raw.replace(/\D/g, '');

  if (!digits) return '';
  if (raw.startsWith('+')) return `+${digits}`;
  if (digits.length === 10) return `+${defaultCountryCode}${digits}`;
  if (digits.length === 12 && digits.startsWith(defaultCountryCode)) return `+${digits}`;

  return `+${digits}`;
}

export function getLocalPhoneNumber(phone?: string | null, defaultCountryCode = '91') {
  const digits = String(phone || '').replace(/\D/g, '');
  if (digits.length === 12 && digits.startsWith(defaultCountryCode)) return digits.slice(2);
  return digits;
}

export function isValidPhoneNumber(phone?: string | null) {
  return /^\+[1-9]\d{9,14}$/.test(normalizePhoneNumber(phone));
}

