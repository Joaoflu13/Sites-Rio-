import { describe, expect, it } from "vitest";
import { csvCell, toCsv } from "./csv";

describe("csv", () => {
  it("neutraliza fórmula e escapa aspas", () => {
    expect(csvCell("=HYPERLINK(1)")).toBe(`"'=HYPERLINK(1)"`);
    expect(csvCell("-5")).toBe(`"'-5"`);
    expect(csvCell('diz "oi"')).toBe(`"diz ""oi"""`);
    expect(csvCell(null)).toBe(`""`);
  });

  it("BOM + ; + CRLF", () => {
    const csv = toCsv(["a", "b"], [[1, "x"]]);
    expect(csv.charCodeAt(0)).toBe(0xfeff);
    expect(csv.slice(1)).toBe(`a;b\r\n"1";"x"\r\n`);
  });
});
