export type MailMessage = { to: string; subject: string; text: string };

/**
 * Inject this to send email. The implementation is picked by MAIL_TRANSPORT
 * in MailModule. Add an SMTP/provider implementation here for production.
 */
export abstract class MailService {
  abstract send(message: MailMessage): Promise<void>;
}
