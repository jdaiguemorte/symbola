import { describe, expect, it } from "vitest";
import { installLogRedaction } from "./log-redaction";

function fakeConsole() {
  const written: unknown[][] = [];
  const record = (...args: unknown[]) => {
    written.push(args);
  };
  return { written, target: { log: record, info: record, warn: record, error: record, debug: record, trace: record } };
}

describe("SEC-20 — Aucune donnée personnelle dans les journaux du serveur", () => {
  it("masque l'e-mail et le téléphone d'un message, y compris dans une erreur affichée", () => {
    const { written, target } = fakeConsole();
    installLogRedaction(target);
    target.error("e-mail non envoyé à", "ines@exemple.fr", { telephone: "06 12 34 56 78" });
    target.warn(new Error("Key (email)=(ines@exemple.fr) already exists"));
    expect(written[0]).toEqual(["e-mail non envoyé à [e-mail] { telephone: '[téléphone]' }"]);
    expect(String(written[1]![0])).toMatch(/^Error: Key \(email\)=\(\[e-mail\]\) already exists/);
    expect(JSON.stringify(written)).not.toContain("ines@");
  });

  it("écrit tel quel un message sans donnée personnelle, avec ses arguments d'origine", () => {
    const { written, target } = fakeConsole();
    installLogRedaction(target);
    const details = { organizationId: "550e8400-e29b-41d4-a716-446655440000", count: 3 };
    target.info("purge faite", details);
    expect(written[0]).toEqual(["purge faite", details]);
  });

  it("ne s'installe qu'une fois", () => {
    const { written, target } = fakeConsole();
    installLogRedaction(target);
    const first = target.log;
    installLogRedaction(target);
    expect(target.log).toBe(first);
    target.log("a@b.fr");
    expect(written).toEqual([["[e-mail]"]]);
  });
});
