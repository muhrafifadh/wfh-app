import type { AddressInfo } from "node:net";

import { SMTPServer } from "smtp-server";

export type ReceivedMail = { from: string | undefined; to: string[]; raw: string };

/** Undoes quoted-printable soft line breaks and "=3D", enough to search the body. */
export const decodeBody = (raw: string): string => raw.replace(/=\r?\n/g, "").replace(/=3D/g, "=");

/** A real SMTP server on a random local port that keeps what it receives. */
export async function startSmtpTestServer(): Promise<{
  url: string;
  received: ReceivedMail[];
  close: () => Promise<void>;
}> {
  const received: ReceivedMail[] = [];
  const server = new SMTPServer({
    authOptional: true,
    disabledCommands: ["STARTTLS"], // plain local test connection
    logger: false,
    onData(stream, session, callback) {
      let raw = "";
      stream.on("data", (chunk: Buffer) => (raw += chunk.toString()));
      stream.on("end", () => {
        const from = session.envelope.mailFrom;
        received.push({
          from: from ? from.address : undefined,
          to: session.envelope.rcptTo.map((r) => r.address),
          raw,
        });
        callback();
      });
    },
  });

  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const { port } = server.server.address() as AddressInfo;

  return {
    url: `smtp://127.0.0.1:${port}`,
    received,
    close: () => new Promise((resolve) => server.close(() => resolve())),
  };
}
