import { matchesContentType } from "@/modules/uploads/file-signature.js";

const bytes = (...values: (number | string)[]) =>
  new Uint8Array(
    values.flatMap((v) => (typeof v === "string" ? Array.from(Buffer.from(v, "latin1")) : [v])),
  );

describe("matchesContentType", () => {
  it.each([
    ["image/png", bytes(0x89, "PNG", 0x0d, 0x0a, 0x1a, 0x0a, 0, 0)],
    ["image/jpeg", bytes(0xff, 0xd8, 0xff, 0xe0)],
    ["image/gif", bytes("GIF89a", 1, 0)],
    ["image/webp", bytes("RIFF", 0, 0, 0, 0, "WEBPVP8 ")],
    ["application/pdf", bytes("%PDF-1.7\n")],
    ["text/csv", bytes("name,amount\nAcme,1\n")],
  ] as const)("accepts a real %s", (type, content) => {
    expect(matchesContentType(content, type)).toBe(true);
  });

  it("rejects an executable renamed to .png", () => {
    expect(matchesContentType(bytes("MZ", 0x90, 0), "image/png")).toBe(false);
  });

  it("rejects binary content declared as text", () => {
    expect(matchesContentType(bytes("PK", 3, 4, 0, 0), "text/plain")).toBe(false);
  });

  it("rejects a RIFF file that isn't WebP (e.g. WAV audio)", () => {
    expect(matchesContentType(bytes("RIFF", 0, 0, 0, 0, "WAVEfmt "), "image/webp")).toBe(false);
  });
});
