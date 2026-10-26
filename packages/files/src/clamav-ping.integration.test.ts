// SOC-11 — la page /health interroge clamd par PING : vérifié contre un vrai clamd.
import { describe, expect, it } from "vitest";
import { parseEnv } from "@symbola/env";
import { pingClamav } from "./clamav-client";

const env = parseEnv(process.env);

describe("SOC-11 — Disponibilité de ClamAV (PING)", () => {
  it("répond PONG quand clamd est démarré", async () => {
    await expect(pingClamav({ host: env.CLAMAV_HOST, port: env.CLAMAV_PORT })).resolves.toBeUndefined();
  });

  it("échoue quand rien n'écoute sur le port", async () => {
    await expect(pingClamav({ host: env.CLAMAV_HOST, port: 1, timeoutMs: 500 })).rejects.toThrow();
  });
});
