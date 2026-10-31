import { CSV_BOM, csvCell, csvLine } from "@/modules/reports/domain/csv.js";

describe("CSV", () => {
  it.each([
    ['=HYPERLINK("http://x")', '"\'=HYPERLINK(""http://x"")"'],
    ["+62 812", "'+62 812"],
    ["-1+2", "'-1+2"],
    ["@SUM(A1)", "'@SUM(A1)"],
    ["\tcmd", "'\tcmd"],
    ["\rcmd", '"\'\rcmd"'],
  ])("neutralizes formula-like text %j", (value, expected) => {
    expect(csvCell(value)).toBe(expected);
  });

  it("quotes commas, quotes and line breaks, and leaves plain values alone", () => {
    expect(csvCell("Wijaya, Rina")).toBe('"Wijaya, Rina"');
    expect(csvCell('say "hi"')).toBe('"say ""hi"""');
    expect(csvCell("two\nlines")).toBe('"two\nlines"');
    expect(csvCell("Sari Lestari")).toBe("Sari Lestari");
    expect(csvCell("2026-11-02T09:05:12+07:00")).toBe("2026-11-02T09:05:12+07:00");
  });

  it("writes numbers, booleans and empty cells as is", () => {
    expect(csvLine([15, true, null, "x"])).toBe("15,true,,x\r\n");
    expect(csvCell(-3)).toBe("-3");
  });

  it("starts files with a UTF-8 BOM", () => {
    expect(CSV_BOM).toBe("﻿");
  });
});
