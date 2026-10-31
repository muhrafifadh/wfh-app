import { supportContactHref } from "@/features/profile/support-contact";

describe("supportContactHref", () => {
  it.each([
    ["hr@example.com", "mailto:hr@example.com"],
    [" hr@example.com ", "mailto:hr@example.com"],
    ["https://help.example.com/wfh", "https://help.example.com/wfh"],
  ])("links %s", (contact, href) => {
    expect(supportContactHref(contact)).toBe(href);
  });

  it.each(["+62 21 555 0100", "Indah (HR), ext. 204", "javascript:alert(1)", "hr@example"])(
    "shows %s as text",
    (contact) => {
      expect(supportContactHref(contact)).toBeNull();
    },
  );
});
