import { supportContactHref } from "@/features/profile/support-contact";

/** The organization's support contact, as a link when it's an email or URL. */
export function SupportContact({ contact }: { contact: string | null }) {
  if (!contact) return <span className="text-muted-foreground">Your Admin/HR</span>;
  const href = supportContactHref(contact);
  return href ? (
    <a href={href} className="break-all text-primary underline-offset-4 hover:underline">
      {contact}
    </a>
  ) : (
    <span className="break-words">{contact}</span>
  );
}
