// SOC-09 — vérifie la forme des composes de déploiement : un seul Traefik
// partagé (socle), l'app déployée par tag d'image, pas de base de données
// exposée au réseau public, secrets de staging/production jamais commités.
import { execSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const repoRoot = resolve(import.meta.dirname, "..", "..");
const socleCompose = readFileSync(resolve(repoRoot, "infra/compose/docker-compose.socle.yml"), "utf8");
const prodCompose = readFileSync(resolve(repoRoot, "infra/compose/docker-compose.prod.yml"), "utf8");
const gitignore = readFileSync(resolve(repoRoot, ".gitignore"), "utf8");

describe("SOC-09 — Socle partagé (Traefik)", () => {
  it("écoute 80 et 443, redirige vers HTTPS, et résout les certificats via ACME", () => {
    expect(socleCompose).toMatch(/"80:80"/);
    expect(socleCompose).toMatch(/"443:443"/);
    expect(socleCompose).toMatch(/redirections\.entrypoint\.scheme=https/);
    expect(socleCompose).toMatch(/certificatesresolvers\.le\.acme\.email/);
  });

  it("crée le réseau partagé symbola-edge", () => {
    expect(socleCompose).toMatch(/name:\s*symbola-edge/);
  });
});

describe("SOC-09 — Compose d'environnement (staging et production)", () => {
  it("déploie l'app par tag d'image (rollback = changer le tag)", () => {
    expect(prodCompose).toMatch(/image:\s*ghcr\.io\/.*\$\{APP_IMAGE_TAG/);
  });

  it("route l'app via Traefik sur le réseau partagé, avec TLS", () => {
    expect(prodCompose).toMatch(/traefik\.docker\.network=symbola-edge/);
    expect(prodCompose).toMatch(/traefik\.http\.routers\.symbola-.*\.rule=Host/);
    expect(prodCompose).toMatch(/tls\.certresolver=le/);
    expect(prodCompose).toMatch(/external:\s*true/); // réseau créé par le socle, pas ici
  });

  it("n'expose PostgreSQL qu'en boucle locale (jamais au réseau public)", () => {
    expect(prodCompose).toMatch(/"127\.0\.0\.1:\$\{POSTGRES_PORT[^}]*\}:5432"/);
  });

  it("ne publie aucun port MinIO/Garage ni ClamAV vers l'hôte", () => {
    const garageBlock = prodCompose.slice(prodCompose.indexOf("garage:"), prodCompose.indexOf("clamav:"));
    const clamavBlock = prodCompose.slice(prodCompose.indexOf("clamav:"), prodCompose.indexOf("symbola:"));
    expect(garageBlock).not.toMatch(/ports:/);
    expect(clamavBlock).not.toMatch(/ports:/);
  });
});

describe("SOC-09 — Secrets de staging/production jamais commités", () => {
  it("ignore .env.staging, .env.production et les garage.toml d'environnement", () => {
    expect(gitignore).toMatch(/^\.env\.staging$/m);
    expect(gitignore).toMatch(/^\.env\.production$/m);
    expect(gitignore).toMatch(/garage\.staging\.toml/);
    expect(gitignore).toMatch(/garage\.production\.toml/);
  });

  it("garde les modèles .example suivis par git", () => {
    const tracked = execSync("git ls-files infra/compose", { cwd: repoRoot }).toString();
    expect(tracked).toMatch(/\.env\.staging\.example/);
    expect(tracked).toMatch(/\.env\.production\.example/);
    expect(tracked).toMatch(/garage\.toml\.example/);
  });
});
