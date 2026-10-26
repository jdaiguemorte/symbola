// SOC-08 — « étant donné le fichier de test EICAR, alors l'envoi est
// refusé. » Vérifié contre un vrai clamd (pas de mock crédible possible
// pour un antivirus).
import { describe, expect, it } from "vitest";
import { parseEnv } from "@symbola/env";
import { scanBuffer } from "./clamav-client";
import { EICAR_TEST_STRING } from "./eicar";

const env = parseEnv(process.env);

describe("SOC-08 — Client ClamAV (clamd réel)", () => {
  it("détecte le fichier de test EICAR comme infecté", async () => {
    const result = await scanBuffer(Buffer.from(EICAR_TEST_STRING, "ascii"), {
      host: env.CLAMAV_HOST,
      port: env.CLAMAV_PORT,
      timeoutMs: 20_000,
    });

    expect(result.infected).toBe(true);
    if (result.infected) {
      expect(result.signature.toLowerCase()).toContain("eicar");
    }
  });

  it("laisse passer un contenu inoffensif", async () => {
    const result = await scanBuffer(Buffer.from("bonjour, ceci est un fichier inoffensif"), {
      host: env.CLAMAV_HOST,
      port: env.CLAMAV_PORT,
      timeoutMs: 20_000,
    });

    expect(result.infected).toBe(false);
  });
});
