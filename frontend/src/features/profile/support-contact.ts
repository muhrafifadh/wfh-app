/**
 * The support contact is free text (an email, a URL, a phone number or a name).
 * Emails and http(s) URLs become links; anything else is shown as text.
 */
export function supportContactHref(contact: string): string | null {
  const value = contact.trim();
  if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) return `mailto:${value}`;
  if (/^https?:\/\/\S+$/i.test(value)) return value;
  return null;
}
