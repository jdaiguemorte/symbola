import { describe, expect, it } from "vitest";
import { httpStatusFor, runHealthChecks } from "./health";

const ok = async () => {};
const fail = async () => {
  throw new Error("connexion refusée par 10.0.0.12:5432");
};
const never = () => new Promise<void>(() => {});

describe("SOC-11 — Surveillance : page de santé /health", () => {
  it("renvoie l'état « ok » et la version quand toutes les dépendances répondent", async () => {
    const report = await runHealthChecks({ database: ok, storage: ok, antivirus: ok }, { version: "abc123" });

    expect(report).toEqual({
      status: "ok",
      version: "abc123",
      checks: { database: "ok", storage: "ok", antivirus: "ok" },
    });
    expect(httpStatusFor(report)).toBe(200);
  });

  it("passe en « degraded » avec un statut 503 si une dépendance échoue, sans bloquer les autres", async () => {
    const report = await runHealthChecks({ database: fail, storage: ok, antivirus: ok }, { version: "abc123" });

    expect(report.status).toBe("degraded");
    expect(report.checks).toEqual({ database: "fail", storage: "ok", antivirus: "ok" });
    expect(httpStatusFor(report)).toBe(503);
  });

  it("ne divulgue jamais le détail d'une erreur (hôte, adresse, message)", async () => {
    const report = await runHealthChecks({ database: fail }, { version: "abc123" });

    expect(JSON.stringify(report)).not.toMatch(/10\.0\.0\.12|refusée|5432/);
  });

  it("considère une dépendance qui ne répond pas dans le délai comme en échec", async () => {
    const report = await runHealthChecks({ database: never, storage: ok }, { version: "abc123", timeoutMs: 20 });

    expect(report.checks).toEqual({ database: "fail", storage: "ok" });
    expect(report.status).toBe("degraded");
  });
});
