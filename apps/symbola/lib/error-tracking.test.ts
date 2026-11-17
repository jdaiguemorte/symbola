// Lot 40b (Q27, NFR-16, SEC-20 ; décision D14, ADR 0077) — ce qui part au suivi des erreurs : la
// référence, le type, la pile d'appels, la route sans identifiant ni jeton, la version ; jamais le
// message, l'adresse complète ni la personne.
import { describe, expect, it, vi } from "vitest";
import { buildEnvelope, parseDsn, parseStack, reportError, scrubRoute } from "./error-tracking";

const DSN = "http://cle-publique@glitchtip:8000/3";
const REFERENCE = "7KQ2-M9XD";

const nodeError = () => {
  const error = new TypeError("lecture impossible pour lea@example.org (tél. 06 12 34 56 78)");
  error.stack = [
    "TypeError: lecture impossible pour lea@example.org (tél. 06 12 34 56 78)",
    "    at loadContact (/app/.next/server/chunks/412.js:1:2345)",
    "    at async Page (/app/.next/server/app/contacts/[id]/page.js:3:678)",
  ].join("\n");
  return error;
};

describe("Q27 — Suivi des erreurs : ce qui part, et seulement cela", () => {
  it("lit l'adresse du projet (DSN) : adresse de l'enveloppe et clé publique ; refuse une adresse incomplète", () => {
    expect(parseDsn(DSN)).toEqual({ endpoint: "http://glitchtip:8000/api/3/envelope/", key: "cle-publique" });
    expect(parseDsn("https://cle@erreurs.example.test/12")).toEqual({ endpoint: "https://erreurs.example.test/api/12/envelope/", key: "cle" });
    for (const invalid of ["", "glitchtip:8000/3", "http://glitchtip:8000/3", "http://cle@glitchtip:8000/projet", "ftp://cle@hote/3"]) expect(parseDsn(invalid), invalid).toBeNull();
  });

  it("la route perd requête, fragment, identifiants, jetons et adresses e-mail", () => {
    expect(scrubRoute("/events/0f8fad5b-d9cb-469f-a165-70867728950e?onglet=budget#ligne")).toBe("/events/[id]");
    expect(scrubRoute("/contacts/[id]")).toBe("/contacts/[id]");
    expect(scrubRoute("/factures/2027/42")).toBe("/factures/[n]/[n]");
    expect(scrubRoute("/l/Q2hfV3Z2bHh0b2tlbnNlY3JldGxvbmd1ZQ")).toBe("/l/[jeton]");
    expect(scrubRoute("/recherche/lea@example.org")).toBe("/recherche/[valeur]");
    expect(scrubRoute(null)).toBeNull();
  });

  it("la pile d'appels garde fichiers, fonctions et lignes, jamais la première ligne (le message), le plus ancien appel d'abord", () => {
    expect(parseStack(nodeError().stack)).toEqual([
      { function: "async Page", filename: "/app/.next/server/app/contacts/[id]/page.js", lineno: 3, colno: 678 },
      { function: "loadContact", filename: "/app/.next/server/chunks/412.js", lineno: 1, colno: 2345 },
    ]);
    expect(parseStack("render@https://symbola.example/_next/static/chunks/app.js?dpl=abc:10:20\n@https://symbola.example/_next/static/chunks/main.js:1:2")).toEqual([
      { filename: "/_next/static/chunks/main.js", lineno: 1, colno: 2 },
      { function: "render", filename: "/_next/static/chunks/app.js", lineno: 10, colno: 20 },
    ]);
  });

  it("l'enveloppe porte la référence, le type, la route nettoyée et la version, sans message ni donnée personnelle", () => {
    const error = nodeError();
    const envelope = buildEnvelope({ reference: REFERENCE, name: error.name, stack: error.stack ?? null, route: "/contacts/0f8fad5b-d9cb-469f-a165-70867728950e?q=lea@example.org", source: "serveur", release: "2b93999" }, new Date("2026-11-18T09:00:00Z"), "a".repeat(32));
    const [header, item, event] = envelope.trim().split("\n").map((line) => JSON.parse(line));
    expect(header).toEqual({ event_id: "a".repeat(32), sent_at: "2026-11-18T09:00:00.000Z" });
    expect(item).toEqual({ type: "event", content_type: "application/json" });
    expect(event).toMatchObject({ platform: "node", level: "error", release: "2b93999", transaction: "/contacts/[id]", tags: { reference: REFERENCE, source: "serveur", route: "/contacts/[id]" } });
    expect(event.exception.values[0]).toMatchObject({ type: "TypeError", value: "" });
    for (const secret of ["lea@example.org", "06 12 34 56 78", "lecture impossible", "q="]) expect(envelope).not.toContain(secret);
    expect(Object.keys(event)).not.toEqual(expect.arrayContaining(["user", "request", "message", "extra", "contexts"]));
  });

  it("envoie au projet avec la clé publique ; sans adresse de projet ou sans référence valable, rien ne part", async () => {
    const fetchImpl = vi.fn(async () => new Response(null, { status: 200 }));
    const report = { reference: REFERENCE, name: "TypeError", stack: null, route: "/", source: "navigateur" as const, release: "dev" };
    expect(await reportError(report, { dsn: DSN, fetchImpl })).toBe(true);
    const [url, init] = fetchImpl.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("http://glitchtip:8000/api/3/envelope/");
    expect((init.headers as Record<string, string>)["X-Sentry-Auth"]).toBe("Sentry sentry_version=7, sentry_client=symbola/1.0, sentry_key=cle-publique");
    expect(await reportError(report, { dsn: "", fetchImpl })).toBe(false);
    expect(await reportError({ ...report, reference: "pas une référence" }, { dsn: DSN, fetchImpl })).toBe(false);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it("un service de suivi injoignable ne fait jamais lever l'erreur d'origine", async () => {
    const fetchImpl = vi.fn(async () => {
      throw new TypeError("connexion refusée");
    });
    const silence = vi.spyOn(console, "error").mockImplementation(() => {});
    await expect(reportError({ reference: REFERENCE, name: "Error", source: "serveur", release: "dev" }, { dsn: DSN, fetchImpl })).resolves.toBe(false);
    expect(silence).toHaveBeenCalledWith("suivi des erreurs : envoi impossible", "TypeError");
    silence.mockRestore();
  });
});
