// Phone numbers of drop-off events (AC-17.9 to AC-17.11). The server validates and stores
// them in E.164 ("+33612345678"); the app checks the same rules before sending, shows
// French numbers in the national format and offers them only as tap-to-call links.

/** EU country codes other than France (+33 is checked on its own). */
const EU_CODES = [
  '30',
  '31',
  '32',
  '34',
  '36',
  '39',
  '40',
  '43',
  '45',
  '46',
  '48',
  '49',
  '351',
  '352',
  '353',
  '356',
  '357',
  '358',
  '359',
  '370',
  '371',
  '372',
  '385',
  '386',
  '420',
  '421',
];

/** The E.164 form, or null when the number isn't accepted (same rules as the API). */
export function normalizePhone(raw: string): string | null {
  let compact = raw.replace(/[\s.\-()\u00A0]/g, '');
  if (compact.startsWith('00')) compact = `+${compact.slice(2)}`;
  const national = /^0([1-9]\d{8})$/.exec(compact);
  if (national) return `+33${national[1]}`;
  const french = /^\+33(?:0)?([1-9]\d{8})$/.exec(compact);
  if (french) return `+33${french[1]}`;
  const international = /^\+(\d{8,15})$/.exec(compact);
  if (!international) return null;
  const digits = international[1]!;
  if (digits.startsWith('33')) return null;
  const code = EU_CODES.find((prefix) => digits.startsWith(prefix));
  return code && digits.length - code.length >= 6 ? `+${digits}` : null;
}

/** "+33612345678" → "06 12 34 56 78"; other countries stay in international form. */
export function displayPhone(e164: string): string {
  const french = /^\+33(\d{9})$/.exec(e164);
  if (!french) return e164;
  return `0${french[1]}`.replace(/(\d{2})(?=\d)/g, '$1 ');
}

/** The `tel:` link (no copy button, design decision 5). */
export function telUrl(e164: string): string {
  return `tel:${e164}`;
}
