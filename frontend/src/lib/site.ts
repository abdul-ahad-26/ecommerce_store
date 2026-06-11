/**
 * Store-wide contact + social details, sourced from env so the owner can set
 * real values at deploy time without code changes.
 *
 * NOTE: NEXT_PUBLIC_* vars are baked at build time — changing them on Vercel
 * requires a redeploy, not just a save (see CLAUDE.md).
 */

const WHATSAPP_DIGITS = (
  process.env.NEXT_PUBLIC_CONTACT_WHATSAPP ?? "920000000000"
).replace(/\D/g, "");

export const CONTACT = {
  /** Digits-only WhatsApp number (country code + number, no +). */
  whatsappNumber: WHATSAPP_DIGITS,
  whatsappUrl: `https://wa.me/${WHATSAPP_DIGITS}`,
  phone: process.env.NEXT_PUBLIC_CONTACT_PHONE ?? "+92 000 0000000",
  email: process.env.NEXT_PUBLIC_CONTACT_EMAIL ?? "hello@meher.pk",
  instagramUrl: process.env.NEXT_PUBLIC_INSTAGRAM_URL ?? "",
} as const;

/** Build a WhatsApp link with an optional prefilled message. */
export function whatsappLink(message?: string): string {
  return message
    ? `${CONTACT.whatsappUrl}?text=${encodeURIComponent(message)}`
    : CONTACT.whatsappUrl;
}
