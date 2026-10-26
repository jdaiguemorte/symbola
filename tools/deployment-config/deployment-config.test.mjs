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
const envExample = (name) => readFileSync(resolve(repoRoot, `infra/compose/.env.${name}.example`), "utf8");

// Bloc YAML d'un service (indentation 2) jusqu'au service ou à la clé de
// premier niveau suivante.
function serviceBlock(compose, service) {
  const start = compose.indexOf(`\n  ${service}:\n`);
  if (start === -1) throw new Error(`service ${service} absent`);
  const rest = compose.slice(start + 1);
  const end = rest.slice(1).search(/\n(?: {2}[a-z-]+:\n|[a-z]+:)/);
  return end === -1 ? rest : rest.slice(0, end + 1);
}

function networksOf(block) {
  const match = block.match(/\n {4}networks:\n((?: {6}- .+\n)+)/);
  return match ? [...match[1].matchAll(/- (\S+)/g)].map((m) => m[1]) : [];
}

function envValue(content, key) {
  return content.match(new RegExp(`^${key}=(.*)$`, "m"))?.[1];
}

function toBytes(value) {
  const [, amount, unit] = value.match(/^(\d+(?:\.\d+)?)([kmg]?)$/i);
  return Number(amount) * { "": 1, k: 1024, m: 1024 ** 2, g: 1024 ** 3 }[unit.toLowerCase()];
}

describe("SOC-09 — Socle partagé (Traefik)", () => {
  it("écoute 80 et 443, redirige vers HTTPS, et résout les certificats via ACME", () => {
    expect(socleCompose).toMatch(/"80:80"/);
    expect(socleCompose).toMatch(/"443:443"/);
    expect(socleCompose).toMatch(/redirections\.entrypoint\.scheme=https/);
    expect(socleCompose).toMatch(/certificatesresolvers\.le\.acme\.email/);
  });

  it("crée un réseau frontal par environnement, sans réseau commun aux deux", () => {
    expect(socleCompose).toMatch(/name:\s*symbola-edge-staging\n/);
    expect(socleCompose).toMatch(/name:\s*symbola-edge-production\n/);
    expect(socleCompose).not.toMatch(/name:\s*symbola-edge\n/);
  });

  it("relie Traefik aux deux réseaux frontaux, sans réseau Docker imposé par défaut", () => {
    expect(networksOf(serviceBlock(socleCompose, "traefik")).sort()).toEqual(["edge-production", "edge-staging"]);
    expect(socleCompose).not.toMatch(/providers\.docker\.network=/);
  });
});

describe("SOC-09 — Compose d'environnement (staging et production)", () => {
  it("déploie l'app par tag d'image (rollback = changer le tag)", () => {
    expect(prodCompose).toMatch(/image:\s*ghcr\.io\/.*\$\{APP_IMAGE_TAG/);
  });

  it("route l'app via Traefik sur le réseau partagé, avec TLS", () => {
    expect(prodCompose).toMatch(/traefik\.docker\.network=symbola-edge-\$\{ENVIRONMENT_NAME\}/);
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

describe("SOC-09 — Isolation staging ↔ production sur le même VPS (ADR 0016)", () => {
  it("dérive le nom de projet de ENVIRONMENT_NAME, obligatoire : oublier -p ne mélange jamais les deux", () => {
    expect(prodCompose).toMatch(/^name:\s*symbola-\$\{ENVIRONMENT_NAME:\?[^}]*\}$/m);
  });

  it.each(["postgres", "garage", "clamav"])(
    "garde %s sur le seul réseau interne du projet (le nom ne résout jamais l'autre environnement)",
    (service) => {
      expect(networksOf(serviceBlock(prodCompose, service))).toEqual(["default"]);
    },
  );

  it("relie l'app au réseau interne et au seul réseau frontal de son environnement", () => {
    expect(networksOf(serviceBlock(prodCompose, "symbola"))).toEqual(["default", "edge"]);
    expect(prodCompose).toMatch(/\n {2}edge:\n {4}name:\s*symbola-edge-\$\{ENVIRONMENT_NAME\}\n {4}external:\s*true/);
  });

  it("impose un port PostgreSQL distinct par environnement", () => {
    expect(prodCompose).toMatch(/\$\{POSTGRES_PORT:\?/);
    expect(envValue(envExample("staging"), "POSTGRES_PORT")).not.toBe(envValue(envExample("production"), "POSTGRES_PORT"));
  });

  it.each([
    ["postgres", "POSTGRES"],
    ["garage", "GARAGE"],
    ["clamav", "CLAMAV"],
    ["symbola", "APP"],
  ])("limite la mémoire et le CPU de %s, staging jamais au-dessus de la production", (service, prefix) => {
    const block = serviceBlock(prodCompose, service);
    expect(block).toMatch(new RegExp(`memory:\\s*\\$\\{${prefix}_MEM_LIMIT:\\?`));
    expect(block).toMatch(new RegExp(`cpus:\\s*\\$\\{${prefix}_CPUS:\\?`));
    const [staging, production] = [envExample("staging"), envExample("production")];
    expect(toBytes(envValue(staging, `${prefix}_MEM_LIMIT`))).toBeLessThanOrEqual(
      toBytes(envValue(production, `${prefix}_MEM_LIMIT`)),
    );
    expect(Number(envValue(staging, `${prefix}_CPUS`))).toBeLessThanOrEqual(
      Number(envValue(production, `${prefix}_CPUS`)),
    );
  });

  it("utilise un nom d'environnement distinct dans chaque modèle .env", () => {
    expect(envValue(envExample("staging"), "ENVIRONMENT_NAME")).toBe("staging");
    expect(envValue(envExample("production"), "ENVIRONMENT_NAME")).toBe("production");
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
