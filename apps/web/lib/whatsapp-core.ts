import { createHmac, timingSafeEqual } from 'node:crypto';
export const categories = ['profile_completion', 'crop_addition', 'nearby_matches'] as const;
export type Category = typeof categories[number];
export const destinations: Record<Category, string> = {
 profile_completion: '/user-profile', crop_addition: '/user-profile?addCrop=true', nearby_matches: '/nearby-farmers'
};
export function normalizeWhatsAppPhone(value: unknown) {
 const raw = String(value || '').trim();
 if (!/^[+\d ()-]+$/.test(raw)) return null;
 let digits = raw.replace(/\D/g, '');
 if (digits.length === 10) digits = '91' + digits;
 return /^[1-9]\d{7,14}$/.test(digits) ? digits : null;
}
export function validSignature(raw: string, signature: string | null, secret: string) {
 if (!secret || !signature || !/^sha256=[a-f0-9]{64}$/.test(signature)) return false;
 const expected = createHmac('sha256', secret).update(raw).digest();
 return timingSafeEqual(expected, Buffer.from(signature.slice(7), 'hex'));
}
export function templateName(category: Category) {
 return process.env['WHATSAPP_TEMPLATE_' + category.toUpperCase()];
}
export async function sendTemplate(phone: string, category: Category, fetcher: typeof fetch = fetch) {
 const env = process.env;
 const name = templateName(category);
 if (!name || !/^[a-z0-9_]+$/.test(name) || !/^v\d+\.\d+$/.test(env.WHATSAPP_GRAPH_VERSION || '') ||
     !/^\d+$/.test(env.WHATSAPP_PHONE_NUMBER_ID || '') || !env.WHATSAPP_ACCESS_TOKEN) {
   return { kind: 'configuration' as const };
 }
 try {
  const response = await fetcher(`https://graph.facebook.com/${env.WHATSAPP_GRAPH_VERSION}/${env.WHATSAPP_PHONE_NUMBER_ID}/messages`, {
   method: 'POST', signal: AbortSignal.timeout(15_000),
   headers: { Authorization: `Bearer ${env.WHATSAPP_ACCESS_TOKEN}`, 'Content-Type': 'application/json' },
   body: JSON.stringify({ messaging_product: 'whatsapp', to: phone, type: 'template',
    template: { name, language: { code: env.WHATSAPP_TEMPLATE_LANGUAGE || 'en' } } })
  });
  const body = await response.json().catch(() => null);
  if (response.ok && body?.messages?.[0]?.id) return { kind: 'accepted' as const, id: String(body.messages[0].id) };
  if (response.ok) return { kind: 'unknown' as const };
  const code = String(Number(body?.error?.code) || response.status);
  if (response.status === 429 || body?.error?.is_transient === true || ['130429','131048','131056'].includes(code)) {
   const seconds = Number(response.headers.get('retry-after'));
   return { kind: 'retry' as const, code, delay: Number.isFinite(seconds) && seconds > 0 ? Math.min(seconds,86400) : 300 };
  }
  // A server error or lost response may occur after Meta accepted the message.
  // Do not automatically resend ambiguous requests (Cloud API has no send idempotency key).
  return { kind: response.status >= 500 ? 'unknown' as const : 'failed' as const, code };
 } catch { return { kind: 'unknown' as const }; }
}
