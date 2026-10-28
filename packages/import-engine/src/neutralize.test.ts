import { describe, expect, it } from "vitest";
import { neutralizeCell } from "./neutralize";

describe("IMP-01 — Neutralisation des formules", () => {
  it.each(["=1+1", "+SUM(A1)", "-2+3", "@SUM(A1:A2)", "  =1+1", "\t=cmd", "\r=cmd", '=HYPERLINK("x")'])(
    "neutralise %j",
    (value) => {
      expect(neutralizeCell(value)).toEqual({ value: `'${value}`, neutralized: true });
    },
  );

  it.each(["-12,50", "+150", "+33 6 12 34 56 78", "-1 234,56 €", "Fleurs", "", "mail@example.org", "1+1"])(
    "laisse intact %j",
    (value) => {
      expect(neutralizeCell(value)).toEqual({ value, neutralized: false });
    },
  );
});
