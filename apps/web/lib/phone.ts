export const PHONE_COUNTRIES = [
  { code: '91', label: 'India', flag: 'IN', minLength: 10, maxLength: 10, placeholder: '9876543210' },
  { code: '1', label: 'United States', flag: 'US', minLength: 10, maxLength: 10, placeholder: '2025550123' },
  { code: '44', label: 'United Kingdom', flag: 'GB', minLength: 10, maxLength: 11, placeholder: '7400123456' },
  { code: '61', label: 'Australia', flag: 'AU', minLength: 9, maxLength: 9, placeholder: '412345678' },
  { code: '971', label: 'United Arab Emirates', flag: 'AE', minLength: 9, maxLength: 9, placeholder: '501234567' },
  { code: '966', label: 'Saudi Arabia', flag: 'SA', minLength: 9, maxLength: 9, placeholder: '512345678' },
  { code: '974', label: 'Qatar', flag: 'QA', minLength: 8, maxLength: 8, placeholder: '33123456' },
  { code: '965', label: 'Kuwait', flag: 'KW', minLength: 8, maxLength: 8, placeholder: '51234567' },
  { code: '65', label: 'Singapore', flag: 'SG', minLength: 8, maxLength: 8, placeholder: '81234567' },
  { code: '60', label: 'Malaysia', flag: 'MY', minLength: 9, maxLength: 10, placeholder: '123456789' },
  { code: '94', label: 'Sri Lanka', flag: 'LK', minLength: 9, maxLength: 9, placeholder: '712345678' },
  { code: '880', label: 'Bangladesh', flag: 'BD', minLength: 10, maxLength: 10, placeholder: '1712345678' },
  { code: '977', label: 'Nepal', flag: 'NP', minLength: 10, maxLength: 10, placeholder: '9841234567' },
];

export function getPhoneCountry(countryCode = '91') {
  return PHONE_COUNTRIES.find((country) => country.code === countryCode) || PHONE_COUNTRIES[0];
}

export function getPhoneLengthRule(countryCode = '91') {
  const country = getPhoneCountry(countryCode);
  return {
    minLength: country.minLength,
    maxLength: country.maxLength,
  };
}

export function getPhoneLengthMessage(countryCode = '91') {
  const country = getPhoneCountry(countryCode);
  const lengthText = country.minLength === country.maxLength
    ? `${country.maxLength} digits`
    : `${country.minLength}-${country.maxLength} digits`;

  return `Enter ${lengthText} for ${country.label}.`;
}

export function getPhoneMaxLength(countryCode = '91') {
  return getPhoneLengthRule(countryCode).maxLength;
}

export function sanitizeLocalPhoneInput(value: string, countryCode = '91') {
  return String(value || '').replace(/\D/g, '').slice(0, getPhoneMaxLength(countryCode));
}

export function getCountryCodeFromLocation(location?: string | null, fallback = '91') {
  const cleanLocation = String(location || '').toLowerCase();
  const matches = [
    { code: '91', aliases: ['india', 'bharat'] },
    { code: '1', aliases: ['united states', 'usa', 'u.s.a', 'america'] },
    { code: '44', aliases: ['united kingdom', 'uk', 'england', 'scotland', 'wales'] },
    { code: '61', aliases: ['australia'] },
    { code: '971', aliases: ['united arab emirates', 'uae', 'dubai', 'abu dhabi'] },
    { code: '966', aliases: ['saudi arabia', 'ksa'] },
    { code: '974', aliases: ['qatar'] },
    { code: '965', aliases: ['kuwait'] },
    { code: '65', aliases: ['singapore'] },
    { code: '60', aliases: ['malaysia'] },
    { code: '94', aliases: ['sri lanka'] },
    { code: '880', aliases: ['bangladesh'] },
    { code: '977', aliases: ['nepal'] },
  ];

  return matches.find((item) => item.aliases.some((alias) => cleanLocation.includes(alias)))?.code || fallback;
}

export function getCountryCodeFromPhone(phone?: string | null, fallback = '91') {
  const raw = String(phone || '').trim();
  const digits = raw.replace(/\D/g, '');
  const fallbackCountry = getPhoneCountry(fallback);

  if (!digits) return fallback;

  if (
    digits.length >= fallbackCountry.minLength &&
    digits.length <= fallbackCountry.maxLength
  ) {
    return fallback;
  }

  if (
    digits.startsWith(fallback) &&
    isValidLocalPhoneNumber(digits.slice(fallback.length), fallback)
  ) {
    return fallback;
  }

  const hasInternationalPrefix = raw.startsWith('+') || raw.startsWith('00');
  if (!hasInternationalPrefix) return fallback;

  const internationalDigits = raw.startsWith('00') ? digits.slice(2) : digits;
  const country = PHONE_COUNTRIES
    .slice()
    .sort((a, b) => b.code.length - a.code.length)
    .find((item) => {
      if (!internationalDigits.startsWith(item.code)) return false;
      return isValidLocalPhoneNumber(internationalDigits.slice(item.code.length), item.code);
    });

  return country?.code || fallback;
}

export function normalizePhoneNumber(phone?: string | null, defaultCountryCode = '91') {
  const raw = String(phone || '').trim();
  const digits = raw.replace(/\D/g, '');

  if (!digits) return '';
  if (raw.startsWith('+')) return `+${digits}`;
  if (digits.startsWith(defaultCountryCode)) {
    const localDigits = digits.slice(defaultCountryCode.length);
    if (isValidLocalPhoneNumber(localDigits, defaultCountryCode)) return `+${digits}`;
  }
  if (isValidLocalPhoneNumber(digits, defaultCountryCode)) return `+${defaultCountryCode}${digits}`;

  return `+${digits}`;
}

export function getLocalPhoneNumber(phone?: string | null, defaultCountryCode = '91') {
  const digits = String(phone || '').replace(/\D/g, '');
  if (digits.startsWith(defaultCountryCode) && digits.length > defaultCountryCode.length) {
    return digits.slice(defaultCountryCode.length);
  }
  return digits;
}

export function isValidLocalPhoneNumber(phone?: string | null, countryCode = '91') {
  const digits = String(phone || '').replace(/\D/g, '');
  const { minLength, maxLength } = getPhoneLengthRule(countryCode);
  return digits.length >= minLength && digits.length <= maxLength;
}

export function isValidPhoneNumber(phone?: string | null, defaultCountryCode = '91') {
  const raw = String(phone || '').trim();
  const countryCode = raw.startsWith('+') ? getCountryCodeFromPhone(raw, defaultCountryCode) : defaultCountryCode;
  const localPhone = raw.startsWith('+') ? getLocalPhoneNumber(raw, countryCode) : raw;

  if (!isValidLocalPhoneNumber(localPhone, countryCode)) return false;
  return /^\+[1-9]\d{9,14}$/.test(normalizePhoneNumber(localPhone, countryCode));
}
