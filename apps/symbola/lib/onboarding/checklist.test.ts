// Lot 33b (PAR-01, étape 6 ; D11) — liste de prise en main : ordre selon les outils remplacés,
// actions des modules non souscrits retirées, disparition une fois tout fait.
import { describe, expect, it } from "vitest";
import { buildChecklist } from "./checklist";

const all = { logo: true, first_vendor: true, first_quote: true, client_invite: true, contacts_import: true };
const none = { logo: false, first_vendor: false, first_quote: false, client_invite: false, contacts_import: false };

describe("PAR-01 — Liste de prise en main de cinq actions", () => {
  it("cinq actions dans l'ordre de départ ; un tableur met « Importer vos contacts » en premier", () => {
    expect(buildChecklist({ tools: [], available: all, done: none })!.map((item) => item.key)).toEqual(["logo", "first_vendor", "first_quote", "client_invite", "contacts_import"]);
    expect(buildChecklist({ tools: ["spreadsheet"], available: all, done: none })![0]).toEqual({ key: "contacts_import", href: "/import", done: false });
  });

  it("chaque action se coche d'elle-même, et la liste disparaît une fois tout fait", () => {
    const partly = buildChecklist({ tools: [], available: all, done: { ...none, logo: true, first_quote: true } })!;
    expect(partly.filter((item) => item.done).map((item) => item.key)).toEqual(["logo", "first_quote"]);
    expect(buildChecklist({ tools: [], available: all, done: all })).toBeNull();
  });

  it("ARC-06 — une action d'un module non souscrit n'apparaît pas, et ne bloque pas la fin de la liste", () => {
    const withoutQuotes = { ...all, first_quote: false };
    expect(buildChecklist({ tools: [], available: withoutQuotes, done: none })!.map((item) => item.key)).not.toContain("first_quote");
    expect(buildChecklist({ tools: [], available: withoutQuotes, done: { ...all, first_quote: false } })).toBeNull();
  });
});
