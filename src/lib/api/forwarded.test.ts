import { forwardedForHeader } from "@/lib/api/forwarded";

describe("forwardedForHeader", () => {
  it("forwards the client chain unchanged", () => {
    expect(forwardedForHeader("198.51.100.7, 10.0.0.2")).toEqual({
      "X-Forwarded-For": "198.51.100.7, 10.0.0.2",
    });
  });

  it.each([null, undefined, ""])("sends nothing for %j", (value) => {
    expect(forwardedForHeader(value)).toEqual({});
  });
});
