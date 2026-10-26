import { readFileSync } from "node:fs";
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
    expect(ciWorkflow).toMatch(/trivy-action/);
    expect(ciWorkflow).toMatch(/severity:\s*CRITICAL/);
    expect(ciWorkflow).toMatch(/exit-code:\s*"1"/);
  });

  it("construit l'image Docker de l'app avant de la scanner", () => {
    expect(ciWorkflow).toMatch(/docker\/build-push-action/);
    expect(ciWorkflow).toMatch(/file:\s*apps\/symbola\/Dockerfile/);
  });

  it("exécute Semgrep à chaque PR", () => {
    expect(ciWorkflow).toMatch(/semgrep scan/);
  });

  it("vérifie l'isolation RLS (SOC-05) contre un vrai PostgreSQL de service", () => {
    expect(ciWorkflow).toMatch(/postgres:16-alpine/);
    expect(ciWorkflow).toMatch(/run:\s*pnpm --filter @symbola\/db bootstrap/);
    expect(ciWorkflow).toMatch(/run:\s*pnpm --filter @symbola\/db migrate/);
    expect(ciWorkflow).toMatch(/run:\s*pnpm --filter @symbola\/db test:integration/);
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
