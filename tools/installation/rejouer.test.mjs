// Lot 40a (NFR-23, décision D7, ADR 0075) — le guide d'installation se rejoue tel quel : ses blocs
// de commandes sont lus dans l'ordre, entre les repères, et le dernier lance l'app.
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { extractSteps, formatDuration, LIMIT_MS } from "./rejouer.mjs";

const guide = readFileSync(resolve(import.meta.dirname, "../../docs/INSTALLATION.md"), "utf8");

describe("NFR-23 — Installation en moins de trente minutes, rejouée telle que documentée", () => {
  it("le guide se lit en étapes : dépendances, réglages, socle, base, puis l'app qui répond", () => {
    const steps = extractSteps(guide);
    expect(steps.length).toBeGreaterThanOrEqual(5);
    expect(steps[0].code).toContain("pnpm install --frozen-lockfile");
    expect(steps.some((step) => step.code.includes("cp .env.example .env"))).toBe(true);
    expect(steps.some((step) => step.code.includes("pnpm --filter @symbola/db migrate"))).toBe(true);
    expect(steps.some((step) => step.code.includes("seed:recette"))).toBe(true);
    const last = steps.at(-1);
    expect(last.server).toBe("http://localhost:3000/login");
    expect(steps.slice(0, -1).every((step) => step.server === null)).toBe(true);
  });

  it("le clonage reste hors du rejeu : la CI rejoue le guide de la version qu'elle teste", () => {
    expect(extractSteps(guide).some((step) => step.code.includes("git clone"))).toBe(false);
    expect(guide).toContain("git clone https://github.com/jdaiguemorte/symbola.git");
  });

  it("chaque bloc qui lance un script du dépôt exporte d'abord .env", () => {
    for (const step of extractSteps(guide).filter((candidate) => /pnpm --filter|docker compose/.test(candidate.code))) {
      expect(step.code.split("\n")[0], `ligne ${step.line}`).toBe("set -a; . ./.env; set +a");
    }
  });

  it("le seuil est de trente minutes", () => {
    expect(LIMIT_MS).toBe(30 * 60 * 1000);
    expect(formatDuration(LIMIT_MS)).toBe("30 min 00 s");
    expect(formatDuration(754_400)).toBe("12 min 34 s");
  });

  it("ne lit que les blocs bash entre les repères, et refuse un guide mal balisé", () => {
    const sample = ["```bash", "echo avant", "```", "<!-- rejeu:debut -->", "```bash", "echo un", "```", "```text", "pas une commande", "```", "<!-- rejeu:serveur http://localhost:3000/ -->", "```bash", "echo serveur", "```", "<!-- rejeu:fin -->", "```bash", "echo après", "```"].join("\n");
    expect(extractSteps(sample)).toEqual([
      { code: "echo un", server: null, line: 5 },
      { code: "echo serveur", server: "http://localhost:3000/", line: 12 },
    ]);
    expect(() => extractSteps("```bash\necho\n```")).toThrow(/rejeu:debut/);
    expect(() => extractSteps("<!-- rejeu:debut -->\n```bash\necho")).toThrow(/non fermé/);
    expect(() => extractSteps("<!-- rejeu:debut -->\n```bash\necho\n```")).toThrow(/rejeu:fin/);
    expect(() => extractSteps("<!-- rejeu:debut -->\n<!-- rejeu:serveur http://x/ -->\n<!-- rejeu:fin -->")).toThrow(/sans bloc/);
  });
});
