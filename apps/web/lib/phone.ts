export const PHONE_COUNTRIES = [
  { code: '91', label: 'India', flag: 'IN' },
  { code: '1', label: 'United States', flag: 'US' },
  { code: '44', label: 'United Kingdom', flag: 'GB' },
  { code: '61', label: 'Australia', flag: 'AU' },
  { code: '971', label: 'United Arab Emirates', flag: 'AE' },
  { code: '966', label: 'Saudi Arabia', flag: 'SA' },
  { code: '974', label: 'Qatar', flag: 'QA' },
  { code: '965', label: 'Kuwait', flag: 'KW' },
  { code: '65', label: 'Singapore', flag: 'SG' },
  { code: '60', label: 'Malaysia', flag: 'MY' },
  { code: '94', label: 'Sri Lanka', flag: 'LK' },
  { code: '880', label: 'Bangladesh', flag: 'BD' },
  { code: '977', label: 'Nepal', flag: 'NP' },
];

export function getCountryCodeFromPhone(phone?: string | null, fallback = '91') {
  const digits = String(phone || '').replace(/\D/g, '');
  const country = PHONE_COUNTRIES
    .slice()
    .sort((a, b) => b.code.length - a.code.length)
    .find((item) => digits.startsWith(item.code));

  return country?.code || fallback;
}

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
  if (digits.startsWith(defaultCountryCode) && digits.length > defaultCountryCode.length) {
    return digits.slice(defaultCountryCode.length);
  }
  return digits;
}

export function isValidPhoneNumber(phone?: string | null, defaultCountryCode = '91') {
  return /^\+[1-9]\d{9,14}$/.test(normalizePhoneNumber(phone, defaultCountryCode));
}
