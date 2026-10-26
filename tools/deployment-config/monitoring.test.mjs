// SOC-11 — Uptime Kuma surveille l'app et le socle, sans jamais être
// exposé à Internet (console interne, accès par tunnel SSH).
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const repoRoot = resolve(import.meta.dirname, "..", "..");
const socleCompose = readFileSync(resolve(repoRoot, "infra/compose/docker-compose.socle.yml"), "utf8");
const dockerfile = readFileSync(resolve(repoRoot, "apps/symbola/Dockerfile"), "utf8");
const ciWorkflow = readFileSync(resolve(repoRoot, ".github/workflows/ci.yml"), "utf8");
const kumaBlock = socleCompose.slice(socleCompose.indexOf("uptime-kuma:"));

describe("SOC-11 — Surveillance (Uptime Kuma)", () => {
  it("fait tourner Uptime Kuma dans le socle partagé, avec une version figée et des données persistantes", () => {
    expect(kumaBlock).toMatch(/image:\s*louislam\/uptime-kuma:\d+\.\d+\.\d+/);
    expect(kumaBlock).toMatch(/uptime_kuma_data:\/app\/data/);
  });

  it("ne publie la console qu'en boucle locale du VPS (jamais sur Internet)", () => {
    const ports = [...kumaBlock.matchAll(/-\s*"([^"]+):3001"/g)].map((match) => match[1]);
    expect(ports).toEqual(["127.0.0.1:3001"]);
  });

  it("n'est pas routé par Traefik", () => {
    expect(kumaBlock).not.toMatch(/traefik\.enable=true/);
  });
});

describe("SOC-11 — Version affichée par /health", () => {
  it("grave le SHA du commit dans l'image (APP_VERSION)", () => {
    expect(dockerfile).toMatch(/ARG APP_VERSION/);
    expect(dockerfile).toMatch(/ENV APP_VERSION=\$\{?APP_VERSION\}?/);
    expect(ciWorkflow).toMatch(/APP_VERSION=\$\{\{\s*github\.sha\s*\}\}/);
  });
});
