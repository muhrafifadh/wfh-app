import { safeRedirectPath } from "@/lib/auth/redirect";

describe("safeRedirectPath", () => {
  it.each(["/", "/invoices", "/invoices/1?tab=lines#top"])("keeps relative path %s", (path) => {
    expect(safeRedirectPath(path)).toBe(path);
  });

  it.each([
    "https://evil.example",
    "//evil.example",
    "/\\evil.example",
    "javascript:alert(1)",
    "invoices",
    "/\nhttps://evil.example",
    "",
    undefined,
    ["/a"],
  ])("rejects %j", (value) => {
    expect(safeRedirectPath(value)).toBe("/");
  });
});
