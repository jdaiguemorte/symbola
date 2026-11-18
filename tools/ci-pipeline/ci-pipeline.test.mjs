import { existsSync, readdirSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const repoRoot = resolve(import.meta.dirname, "..", "..");
const ciWorkflow = readFileSync(resolve(repoRoot, ".github/workflows/ci.yml"), "utf8");
const zapWorkflow = readFileSync(resolve(repoRoot, ".github/workflows/zap-baseline.yml"), "utf8");
const renovateConfig = JSON.parse(readFileSync(resolve(repoRoot, "renovate.json"), "utf8"));

describe("SOC-02 — Pipeline CI de sécurité", () => {
  it("se déclenche à chaque pull request et sur push main", () => {
    expect(ciWorkflow).toMatch(/on:\s*\n\s*pull_request:/);
    expect(ciWorkflow).toMatch(/branches:\s*\[main\]/);
  });

  it("exécute lint, typecheck, test et le contrôle de frontières à chaque PR", () => {
    expect(ciWorkflow).toMatch(/run:\s*pnpm lint/);
    expect(ciWorkflow).toMatch(/run:\s*pnpm typecheck/);
    expect(ciWorkflow).toMatch(/run:\s*pnpm test/);
    expect(ciWorkflow).toMatch(/run:\s*pnpm check:boundaries/);
  });

  it("fait échouer la CI sur un secret détecté par Gitleaks", () => {
    expect(ciWorkflow).toMatch(/gitleaks detect/);
    expect(ciWorkflow).toMatch(/--exit-code 1/);
  });

  it("fait échouer la CI sur une dépendance vulnérable (OSV-Scanner) et une image vulnérable critique (Trivy)", () => {
    expect(ciWorkflow).toMatch(/osv-scanner-action/);
    // Trivy par son image officielle, figée par version et empreinte : l'action
    // aquasecurity/trivy-action@0.29.0 a disparu et cassait la CI.
    expect(ciWorkflow).toMatch(/aquasec\/trivy:\d+\.\d+\.\d+@sha256:[0-9a-f]{64}/);
    expect(ciWorkflow).toMatch(/--severity CRITICAL/);
    expect(ciWorkflow).toMatch(/--exit-code 1/);
  });

  it("construit l'image Docker de l'app avant de la scanner", () => {
    expect(ciWorkflow).toMatch(/docker\/build-push-action/);
    expect(ciWorkflow).toMatch(/file:\s*apps\/symbola\/Dockerfile/);
  });

  it("exécute Semgrep à chaque PR", () => {
    expect(ciWorkflow).toMatch(/semgrep scan/);
  });

  it("vérifie l'isolation RLS et l'authentification (SOC-04/05) contre un vrai PostgreSQL de service", () => {
    expect(ciWorkflow).toMatch(/postgres:16-alpine/);
    expect(ciWorkflow).toMatch(/run:\s*pnpm --filter @symbola\/db bootstrap/);
    expect(ciWorkflow).toMatch(/run:\s*pnpm --filter @symbola\/db migrate/);
    expect(ciWorkflow).toMatch(/run:\s*pnpm --filter @symbola\/db test:integration/);
    expect(ciWorkflow).toMatch(/run:\s*pnpm --filter @symbola\/auth test:integration/);
    expect(ciWorkflow).toMatch(/run:\s*pnpm --filter @symbola\/app test:integration/);
  });

  it("fait échouer la CI sur une colonne personnelle non déclarée dans le registre RGPD (SOC-07)", () => {
    expect(ciWorkflow).toMatch(/run:\s*pnpm --filter @symbola\/privacy check:registry/);
  });

  it("démarre Garage et ClamAV réels et exécute les tests de fichiers (SOC-08)", () => {
    expect(ciWorkflow).toMatch(/dxflrs\/garage/);
    expect(ciWorkflow).toMatch(/clamav\/clamav/);
    expect(ciWorkflow).toMatch(/run:\s*pnpm --filter @symbola\/files test:integration/);
  });

  it("publie l'image sur GHCR seulement depuis main, après les contrôles de sécurité (SOC-09)", () => {
    expect(ciWorkflow).toMatch(/ghcr\.io/);
    expect(ciWorkflow).toMatch(/refs\/heads\/main/);
    expect(ciWorkflow).toMatch(/needs:\s*\[lint-typecheck-test, db-isolation, e2e, semgrep, gitleaks, osv-scanner, build-and-scan-image\]/);
  });

  it("vérifie dans l'image construite qu'un PDF se génère (polices de la sortie standalone)", () => {
    expect(ciWorkflow).toMatch(/pdf-smoke\.mjs/);
    expect(ciWorkflow).toMatch(/--entrypoint node symbola-app:ci/);
  });

  it("lance les parcours bout en bout Playwright sur la version compilée, avec les services réels (lot 6)", () => {
    expect(ciWorkflow).toMatch(/\n  e2e:\n/);
    expect(ciWorkflow).toMatch(/pnpm --filter @symbola\/app build/);
    expect(ciWorkflow).toMatch(/pnpm --filter @symbola\/app test:e2e/);
    // Faux fournisseur de signature seulement hors production (NODE_ENV=test).
    expect(ciWorkflow).toMatch(/E2E_SERVER_COMMAND: NODE_ENV=test /);
  });

  it("prépare un scan ZAP baseline du staging qui bloque sur une alerte haute", () => {
    expect(zapWorkflow).toMatch(/zaproxy\/action-baseline/);
    expect(zapWorkflow).toMatch(/fail_action:\s*true/);
  });

  it("configure Renovate pour des mises à jour groupées hebdomadaires", () => {
    expect(renovateConfig.schedule?.[0]).toMatch(/monday/i);
    const hasGroupedRule = renovateConfig.packageRules?.some(
      (rule) => Array.isArray(rule.matchUpdateTypes) && rule.matchUpdateTypes.includes("minor"),
    );
    expect(hasGroupedRule).toBe(true);
    expect(renovateConfig.vulnerabilityAlerts?.enabled).toBe(true);
  });
});

describe("SOC-09 — Image Docker de l'app", () => {
  // L'étape d'installation ne copie que des package.json : un paquet du
  // workspace oublié ici n'est pas installé, et le build de l'image échoue
  // (« Can't resolve '@symbola/db/...' »).
  const dockerfile = readFileSync(resolve(repoRoot, "apps/symbola/Dockerfile"), "utf8");
  const workspacePackages = readdirSync(resolve(repoRoot, "packages")).filter((name) =>
    existsSync(resolve(repoRoot, "packages", name, "package.json")),
  );

  it.each(workspacePackages)("copie packages/%s/package.json avant pnpm install", (name) => {
    expect(dockerfile).toContain(`COPY packages/${name}/package.json packages/${name}/package.json`);
  });
});

describe("NFR-18, NFR-19 — Scénarios sous trois navigateurs, de 360 à 1 920 px, SC-10 à 150 % (lot 40c)", () => {
  const playwrightConfig = readFileSync(resolve(repoRoot, "apps/symbola/playwright.config.ts"), "utf8");

  it("déclare les projets Firefox, WebKit, 360 px, 1 920 px et zoom à 150 % sur les parcours des scénarios", () => {
    expect(playwrightConfig).toMatch(/name: "firefox", testMatch: SCENARIO_SPECS, use: \{ \.\.\.devices\["Desktop Firefox"\] \}/);
    expect(playwrightConfig).toMatch(/name: "webkit", testMatch: SCENARIO_SPECS, use: \{ \.\.\.devices\["Desktop Safari"\] \}/);
    expect(playwrightConfig).toMatch(/name: "mobile-360", testMatch: SCENARIO_SPECS, use: \{ viewport: \{ width: 360, /);
    expect(playwrightConfig).toMatch(/name: "desktop-1920", testMatch: SCENARIO_SPECS, .*viewport: \{ width: 1920, /);
    expect(playwrightConfig).toMatch(/name: "zoom-150", testMatch: SC10_SPECS, .*viewport: \{ width: 853, height: 533 \}/);
  });

  it("joue les deux volets en CI : Chromium d'un côté, Firefox, WebKit, 360, 1 920 px et 150 % de l'autre", () => {
    // 18/11/2026 : la suite sous Chromium, trop longue pour un job de 45 min, est partagée en deux
    // moitiés ; à elles deux, elles jouent toute la suite.
    expect(ciWorkflow).toMatch(/projets: --project=desktop --project=mobile-375 --shard=1\/2\n/);
    expect(ciWorkflow).toMatch(/projets: --project=desktop --project=mobile-375 --shard=2\/2\n/);
    expect(ciWorkflow).not.toMatch(/projets: --project=desktop --project=mobile-375\n/);
    expect(ciWorkflow).toMatch(/navigateurs: chromium firefox webkit\n\s*projets: --project=firefox --project=webkit --project=mobile-360 --project=desktop-1920 --project=zoom-150\n/);
    expect(ciWorkflow).toMatch(/playwright install --with-deps \$\{\{ matrix\.navigateurs \}\}/);
    expect(ciWorkflow).toMatch(/run: pnpm --filter @symbola\/app test:e2e \$\{\{ matrix\.projets \}\}/);
    // Le banc d'essai déclare son adresse : sans elle, les cookies partent en « Secure » et WebKit
    // les refuse sur http://localhost (lib/cookie-security.ts).
    expect(ciWorkflow).toMatch(/\n      APP_PUBLIC_URL: http:\/\/localhost:3000\n/);
  });
});
