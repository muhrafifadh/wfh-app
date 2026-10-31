import { SmtpMailer } from "@/infra/mail/smtp-mailer.js";

import { startSmtpTestServer } from "./support/smtp-test-server.js";

describe("SmtpMailer", () => {
  it("delivers the message over SMTP", async () => {
    const smtp = await startSmtpTestServer();
    const mailer = new SmtpMailer(smtp.url, "Boilerplate <no-reply@example.test>");
    try {
      await mailer.send({ to: "ada@example.test", subject: "Hello", text: "Line one\n\nLine two" });

      expect(smtp.received).toHaveLength(1);
      const [mail] = smtp.received;
      expect(mail?.from).toBe("no-reply@example.test");
      expect(mail?.to).toEqual(["ada@example.test"]);
      expect(mail?.raw).toMatch(/^Subject: Hello$/m);
      expect(mail?.raw).toContain("Line two");
    } finally {
      mailer.onModuleDestroy();
      await smtp.close();
    }
  });

  it("rejects when the server is unreachable", async () => {
    const smtp = await startSmtpTestServer();
    await smtp.close(); // nothing listens on that port any more
    const mailer = new SmtpMailer(smtp.url, "Boilerplate <no-reply@example.test>");

    await expect(mailer.send({ to: "ada@example.test", subject: "x", text: "y" })).rejects.toThrow(
      /ECONNREFUSED|connect/i,
    );
    mailer.onModuleDestroy();
  });
});
