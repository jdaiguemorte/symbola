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

  it("n'expose l'app sur aucun port hôte (Caddy rejoint le réseau Docker, ADR 0018)", () => {
    expect(prodCompose).not.toMatch(/traefik\./);
    const symbolaBlock = prodCompose.slice(
      prodCompose.indexOf("\n  symbola:"),
      prodCompose.indexOf("\nnetworks:"),
    );
    expect(symbolaBlock).not.toMatch(/ports:/);
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

  it("relie l'app seulement au réseau interne de son environnement, avec un alias distinct par environnement (ADR 0018)", () => {
    const symbolaBlock = serviceBlock(prodCompose, "symbola");
    expect(symbolaBlock).toMatch(/\n {4}networks:\n {6}default:\n {8}aliases:\n {10}- symbola-\$\{ENVIRONMENT_NAME\}\n/);
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

describe("DEV-02 — Documenso dans le compose d'environnement (ADR 0026)", () => {
  const block = () => serviceBlock(prodCompose, "documenso");
  const devCompose = readFileSync(resolve(repoRoot, "infra/compose/docker-compose.dev.yml"), "utf8");

  it("épingle l'image documenso/documenso sur une version précise, en dev comme en environnement", () => {
    expect(block()).toMatch(/image: documenso\/documenso:v\d+\.\d+\.\d+\n/);
    expect(serviceBlock(devCompose, "documenso")).toMatch(/image: documenso\/documenso:v\d+\.\d+\.\d+\n/);
    expect(prodCompose).not.toMatch(/docuseal/i);
    expect(devCompose).not.toMatch(/docuseal/i);
  });

  it("ne démarre que dans le profil « signature », activé explicitement par Julien", () => {
    expect(block()).toContain('profiles: ["signature"]');
    for (const name of ["staging", "production"]) expect(envValue(envExample(name), "COMPOSE_PROFILES")).toBe("");
  });

  it("utilise sa propre base (fichiers compris), jamais celle de Symbola ni Garage, et n'expose aucun port hôte", () => {
    expect(block()).toMatch(/NEXT_PRIVATE_DATABASE_URL: postgresql:\/\/\$\{DOCUMENSO_DB_USER:-documenso\}:.*@postgres:5432\/\$\{DOCUMENSO_DB_NAME:-documenso\}/);
    expect(block()).toContain("NEXT_PUBLIC_UPLOAD_TRANSPORT: database");
    expect(block()).not.toContain("POSTGRES_DB");
    expect(block()).not.toMatch(/S3_|garage/);
    expect(block()).not.toMatch(/\n {4}ports:/);
    expect(block()).not.toMatch(/\n {4}volumes:/);
    expect(block()).toContain("no-new-privileges:true");
  });

  it("ferme les inscriptions publiques par défaut et coupe la télémétrie", () => {
    expect(block()).toContain("NEXT_PUBLIC_DISABLE_SIGNUP: ${DOCUMENSO_DISABLE_SIGNUP:-true}");
    expect(block()).toContain('DOCUMENSO_DISABLE_TELEMETRY: "true"');
    for (const name of ["staging", "production"]) expect(envValue(envExample(name), "DOCUMENSO_DISABLE_SIGNUP")).toBe("true");
  });

  it("l'app appelle l'API v2 interne et reçoit le secret du webhook dans l'en-tête de Documenso", () => {
    const app = serviceBlock(prodCompose, "symbola");
    expect(app).toContain("DOCUMENSO_API_URL: http://documenso:3000/api/v2");
    expect(app).toContain("SIGNATURE_WEBHOOK_HEADER: X-Documenso-Secret");
  });

  it("limite sa mémoire et son CPU, staging jamais au-dessus de la production", () => {
    expect(block()).toMatch(/memory:\s*\$\{DOCUMENSO_MEM_LIMIT:-/);
    expect(block()).toMatch(/cpus:\s*\$\{DOCUMENSO_CPUS:-/);
    const [staging, production] = [envExample("staging"), envExample("production")];
    expect(toBytes(envValue(staging, "DOCUMENSO_MEM_LIMIT"))).toBeLessThanOrEqual(toBytes(envValue(production, "DOCUMENSO_MEM_LIMIT")));
    expect(Number(envValue(staging, "DOCUMENSO_CPUS"))).toBeLessThanOrEqual(Number(envValue(production, "DOCUMENSO_CPUS")));
  });

  it("laisse la signature « indisponible » tant qu'elle n'est pas configurée (aucun secret dans les modèles)", () => {
    for (const name of ["staging", "production"]) {
      const content = envExample(name);
      for (const key of [
        "SIGNATURE_PROVIDER",
        "SIGNATURE_WEBHOOK_SECRET",
        "DOCUMENSO_API_KEY",
        "DOCUMENSO_DB_PASSWORD",
        "DOCUMENSO_NEXTAUTH_SECRET",
        "DOCUMENSO_ENCRYPTION_KEY",
        "DOCUMENSO_ENCRYPTION_SECONDARY_KEY",
        "DOCUMENSO_SIGNING_CERT_BASE64",
        "DOCUMENSO_SIGNING_PASSPHRASE",
      ]) {
        expect(envValue(content, key)).toBe("");
      }
    }
  });
});

describe("L16-SEC-01 — Clé de chiffrement de la double authentification (lot 16, ADR 0037)", () => {
  it("l'app reçoit la clé de son environnement, sans valeur par défaut (refus de démarrer si elle manque)", () => {
    expect(serviceBlock(prodCompose, "symbola")).toContain("MFA_ENCRYPTION_KEY: ${MFA_ENCRYPTION_KEY}");
  });

  it("les modèles staging et production prévoient la clé, sans aucune valeur commitée", () => {
    for (const name of ["staging", "production"]) {
      expect(envExample(name)).toMatch(/^MFA_ENCRYPTION_KEY=$/m);
    }
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

describe("SOC-03/SOC-08 — Aucun secret Garage commité, même de développement", () => {
  // Semgrep (generic-secret) bloquait la CI sur les valeurs fixes de garage.toml.
  const devGarageToml = readFileSync(resolve(repoRoot, "infra/compose/garage.toml"), "utf8");
  const devCompose = readFileSync(resolve(repoRoot, "infra/compose/docker-compose.dev.yml"), "utf8");
  const ciWorkflow = readFileSync(resolve(repoRoot, ".github/workflows/ci.yml"), "utf8");
  const rootEnvExample = readFileSync(resolve(repoRoot, ".env.example"), "utf8");
  const secrets = ["GARAGE_RPC_SECRET", "GARAGE_ADMIN_TOKEN", "GARAGE_METRICS_TOKEN"];

  it("garage.toml de dev ne contient ni rpc_secret, ni admin_token, ni metrics_token", () => {
    expect(devGarageToml).not.toMatch(/^\s*(rpc_secret|admin_token|metrics_token)\s*=/m);
  });

  it.each(secrets)("le compose de dev exige %s depuis .env", (name) => {
    expect(devCompose).toMatch(new RegExp(`${name}: \\$\\{${name}:\\?`));
  });

  it.each(secrets)(".env.example déclare %s sans valeur", (name) => {
    expect(envValue(rootEnvExample, name)).toBe("");
  });

  it.each(secrets)("la CI génère %s à chaque exécution", (name) => {
    expect(ciWorkflow).toMatch(new RegExp(`-e ${name}="\\$\\(openssl rand`));
  });
});
