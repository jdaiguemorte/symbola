// Lot 40a (NFR-07, SEC-28, ARC-14, DAT-10 ; décisions D2 à D6, ADR 0075) — déploiement en une
// commande, dans la fenêtre, après le contrôle du durcissement ; retour arrière en une commande ;
// jeu fictif au staging seulement. `docker`, `git`, `systemctl`, `flock` et le contrôle du
// durcissement sont des doublures qui notent chaque appel ; l'heure est fixée par
// SYMBOLA_DEPLOY_NOW (secondes depuis 1970).
import { spawnSync } from "node:child_process";
import { chmodSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const repoRoot = resolve(import.meta.dirname, "..", "..");
const deployScript = resolve(repoRoot, "infra/server/deploy.sh");
const rollbackScript = resolve(repoRoot, "infra/server/rollback.sh");
const recetteScript = resolve(repoRoot, "infra/server/recette.sh");

// Chaque déploiement simulé lance une dizaine de processus : sous la charge de `pnpm test` (tous
// les paquets en parallèle), les tests qui en enchaînent plusieurs dépassent les 5 s par défaut.
vi.setConfig({ testTimeout: 30_000 });

const OLD = "1111111111111111111111111111111111111111";
const NEW = "2222222222222222222222222222222222222222";

// Heure de Paris → secondes. Hiver : UTC+1 ; été : UTC+2.
const at = (iso) => String(Math.floor(Date.parse(iso) / 1000));
const FRIDAY_1159 = at("2026-11-20T10:59:00Z");
const FRIDAY_1200 = at("2026-11-20T11:00:00Z");
const SATURDAY = at("2026-11-21T09:00:00Z");
const MONDAY_0759 = at("2026-11-23T06:59:00Z");
const MONDAY_0800 = at("2026-11-23T07:00:00Z");
const WEDNESDAY = at("2026-11-18T14:00:00Z");
// Lundi 29 mars 2027, lendemain du passage à l'heure d'été ; vendredi 29 octobre 2027, avant le
// retour à l'heure d'hiver.
const SUMMER_MONDAY_0759 = at("2027-03-29T05:59:00Z");
const SUMMER_MONDAY_0800 = at("2027-03-29T06:00:00Z");
const SUMMER_FRIDAY_1159 = at("2027-10-29T09:59:00Z");
const SUMMER_FRIDAY_1200 = at("2027-10-29T10:00:00Z");

const fakeDocker = `#!/usr/bin/env bash
echo "docker $*" >>"$FAKE_LOG"
envfile=""
prev=""
for arg in "$@"; do
  [ "$prev" = "--env-file" ] && envfile=$arg
  prev=$arg
done
tag=""
[ -n "$envfile" ] && tag=$(sed -n 's/^APP_IMAGE_TAG=//p' "$envfile" | tail -n 1)
case " $* " in
  *" ops."*) echo "sql $(cat | tr '\\n' ' ')" >>"$FAKE_LOG" ;;
  *" pull symbola"*) [ "$tag" = "\${FAKE_MISSING_TAG:-}" ] && exit 1 ;;
  *"migrate:plan"*) printf '%b\\n' "\${FAKE_PLAN:-arret-requis=non}" ;;
  *"@symbola/db migrate"*) exit "\${FAKE_MIGRATE_STATUS:-0}" ;;
  *" up -d --wait"*)
    echo "up $tag" >>"$FAKE_LOG"
    [ "$tag" = "\${FAKE_UNHEALTHY_TAG:-}" ] && exit 1
    ;;
esac
exit 0
`;

const fakeGit = `#!/usr/bin/env bash
echo "git $*" >>"$FAKE_LOG"
case " $* " in
  *" fetch "*) exit "\${FAKE_FETCH_STATUS:-0}" ;;
  *" merge-base "*) exit "\${FAKE_NOT_ON_MAIN:-0}" ;;
  *" merge "*)
    for arg in "$@"; do last=$arg; done
    printf '%s' "$last" >"$FAKE_DIR/head"
    ;;
  *" rev-parse HEAD"*) if [ -n "\${FAKE_HEAD:-}" ]; then echo "$FAKE_HEAD"; else cat "$FAKE_DIR/head"; fi ;;
esac
exit 0
`;

let work;
let env;

function writeExecutable(path, content) {
  writeFileSync(path, content);
  chmodSync(path, 0o755);
}

function run(script, args, extra = {}) {
  const result = spawnSync("bash", [script, ...args], { env: { ...env, ...extra }, encoding: "utf8" });
  let calls = [];
  try {
    calls = readFileSync(env.FAKE_LOG, "utf8").trim().split("\n").filter(Boolean);
  } catch {
    // aucun appel noté
  }
  return { status: result.status, output: result.stdout + result.stderr, calls };
}

const indexOf = (calls, ...fragments) => calls.findIndex((call) => fragments.every((fragment) => call.includes(fragment)));
// L'appel des migrations elles-mêmes (pas celui de migrate:plan).
const migrateIndex = (calls) => calls.findIndex((call) => call.includes("@symbola/db migrate") && !call.includes("migrate:plan"));
const envFile = (environment) => join(work, "symbola/infra/compose", `.env.${environment}`);
const imageTag = (environment) => readFileSync(envFile(environment), "utf8").match(/^APP_IMAGE_TAG=(.*)$/m)?.[1];
const previousTag = (environment) => {
  const file = join(work, "state", `${environment}.previous`);
  return existsSync(file) ? readFileSync(file, "utf8").trim() : null;
};
const deployLog = () => {
  const file = join(work, "log", "deploiements.log");
  // Pas de trim : un motif vide laisse une tabulation en fin de ligne.
  return existsSync(file) ? readFileSync(file, "utf8").split("\n").filter(Boolean).map((line) => line.split("\t")) : [];
};

beforeEach(() => {
  work = mkdtempSync(join(tmpdir(), "symbola-deploy-test-"));
  for (const dir of ["bin", "config", "symbola/infra/compose", "work", "repo/staging", "repo/production"]) mkdirSync(join(work, dir), { recursive: true });
  writeExecutable(join(work, "bin/docker"), fakeDocker);
  writeExecutable(join(work, "bin/git"), fakeGit);
  writeExecutable(join(work, "bin/systemctl"), `#!/usr/bin/env bash\necho "systemctl $*" >>"$FAKE_LOG"\nexit "\${FAKE_BACKUP_STATUS:-0}"\n`);
  writeExecutable(join(work, "bin/flock"), "#!/usr/bin/env bash\nexit 0\n");
  writeExecutable(join(work, "hardening.sh"), `#!/usr/bin/env bash\necho "hardening" >>"$FAKE_LOG"\nexit "\${FAKE_HARDENING_STATUS:-0}"\n`);
  writeFileSync(join(work, "password"), "mot-de-passe-de-test\n");
  for (const environment of ["staging", "production"]) {
    writeFileSync(
      join(work, "config", `${environment}.env`),
      [`SYMBOLA_DIR=${join(work, "symbola")}`, `RESTIC_REPOSITORY=${join(work, "repo", environment)}`, `RESTIC_PASSWORD_FILE=${join(work, "password")}`].join("\n"),
    );
    writeFileSync(envFile(environment), `POSTGRES_APP_USER=symbola_app\nAPP_IMAGE_TAG=${OLD}\nSMTP_FROM=symbola@example.test\n`, { mode: 0o600 });
  }
  env = {
    ...process.env,
    PATH: `${join(work, "bin")}:${process.env.PATH}`,
    FAKE_LOG: join(work, "calls.log"),
    FAKE_DIR: work,
    BACKUP_CONFIG_DIR: join(work, "config"),
    BACKUP_LOCK_DIR: work,
    BACKUP_WORK_DIR: join(work, "work"),
    DEPLOY_STATE_DIR: join(work, "state"),
    DEPLOY_LOG_DIR: join(work, "log"),
    SYMBOLA_HARDENING_CHECK: join(work, "hardening.sh"),
    RECETTE_ACCOUNTS_DIR: join(work, "comptes"),
    SYMBOLA_DEPLOY_NOW: WEDNESDAY,
  };
});

afterEach(() => {
  rmSync(work, { recursive: true, force: true });
});

describe("NFR-07 — Aucun déploiement en production du vendredi midi au lundi matin (deploy.sh)", () => {
  it("refuse la production le vendredi à 12 h 00, le samedi et le lundi à 7 h 59, heure de Paris, sans rien toucher", () => {
    for (const now of [FRIDAY_1200, SATURDAY, MONDAY_0759, SUMMER_MONDAY_0759, SUMMER_FRIDAY_1200]) {
      const { status, output, calls } = run(deployScript, ["production", NEW], { SYMBOLA_DEPLOY_NOW: now });
      expect(status, now).not.toBe(0);
      expect(output).toMatch(/hors de la fenêtre de déploiement/);
      expect(calls).toEqual([]);
      expect(imageTag("production")).toBe(OLD);
    }
  });

  it("déploie la production le vendredi à 11 h 59 et le lundi à 8 h 00, y compris aux changements d'heure", () => {
    for (const now of [FRIDAY_1159, MONDAY_0800, SUMMER_MONDAY_0800, SUMMER_FRIDAY_1159]) {
      rmSync(join(work, "calls.log"), { force: true });
      writeFileSync(envFile("production"), `APP_IMAGE_TAG=${OLD}\n`);
      const { status, output } = run(deployScript, ["production", NEW], { SYMBOLA_DEPLOY_NOW: now });
      expect(status, `${now} ${output}`).toBe(0);
      expect(imageTag("production")).toBe(NEW);
    }
  });

  it("laisse le staging se déployer le week-end", () => {
    expect(run(deployScript, ["staging", NEW], { SYMBOLA_DEPLOY_NOW: SATURDAY }).status).toBe(0);
  });

  it("un correctif urgent passe hors fenêtre, avec son motif au journal d'audit et au journal des déploiements", () => {
    const motif = "facture d'acompte refusée ; ticket 42";
    const { status, calls } = run(deployScript, ["production", NEW, `--urgence=${motif}`], { SYMBOLA_DEPLOY_NOW: SATURDAY });
    expect(status).toBe(0);
    expect(indexOf(calls, "ops.deploy.completed", `version 2222222 ; correctif urgent : ${motif}`)).toBeGreaterThanOrEqual(0);
    expect(deployLog().at(-1)).toEqual([expect.any(String), "production", "deploiement", NEW, OLD, motif]);
  });

  it("refuse une urgence sans motif, ou dont le motif contient une donnée personnelle", () => {
    for (const urgence of ["--urgence=", "--urgence=   ", "--urgence=demande de lea@example.org"]) {
      const { status, calls } = run(deployScript, ["production", NEW, urgence], { SYMBOLA_DEPLOY_NOW: SATURDAY });
      expect(status, urgence).not.toBe(0);
      expect(calls).toEqual([]);
    }
  });
});

describe("SEC-28 — Le contrôle du durcissement est rejoué à chaque déploiement", () => {
  it("passe le contrôle avant la sauvegarde et toute autre étape", () => {
    const { status, calls } = run(deployScript, ["staging", NEW]);
    expect(status).toBe(0);
    expect(calls[0]).toBe("hardening");
    expect(indexOf(calls, "systemctl start symbola-backup@staging.service")).toBe(1);
  });

  it("un ÉCHEC arrête le déploiement avant la sauvegarde, sans rien changer", () => {
    const { status, output, calls } = run(deployScript, ["staging", NEW], { FAKE_HARDENING_STATUS: "1" });
    expect(status).not.toBe(0);
    expect(output).toMatch(/contrôle du durcissement en échec/);
    expect(calls).toEqual(["hardening"]);
    expect(imageTag("staging")).toBe(OLD);
  });

  it("avec --urgence, l'échec est signalé et le déploiement continue", () => {
    const { status, output } = run(deployScript, ["staging", NEW, "--urgence=faille corrigée en urgence"], { FAKE_HARDENING_STATUS: "1" });
    expect(status).toBe(0);
    expect(output).toMatch(/ATTENTION : contrôle du durcissement en échec, déploiement forcé/);
  });

  it("une sauvegarde en échec arrête le déploiement, même en urgence", () => {
    const { status, output, calls } = run(deployScript, ["staging", NEW, "--urgence=correctif"], { FAKE_BACKUP_STATUS: "1" });
    expect(status).not.toBe(0);
    expect(output).toMatch(/sauvegarde en échec/);
    expect(indexOf(calls, "git")).toBe(-1);
    expect(imageTag("staging")).toBe(OLD);
  });
});

describe("ARC-14 — Déploiement reproductible en une commande (deploy.sh)", () => {
  it("enchaîne sauvegarde, dépôt, image, migrations, démarrage avec sonde et journal, puis note la version précédente", () => {
    const { status, calls } = run(deployScript, ["staging", NEW]);
    expect(status).toBe(0);
    const steps = [
      indexOf(calls, "systemctl start symbola-backup@staging.service"),
      indexOf(calls, "git -C", "fetch --quiet origin main"),
      indexOf(calls, "git -C", "merge --ff-only --quiet", NEW),
      indexOf(calls, "pull symbola"),
      indexOf(calls, "node:22-slim", "migrate:plan"),
      migrateIndex(calls),
      indexOf(calls, `up ${NEW}`),
      indexOf(calls, "ops.deploy.completed", "version 2222222"),
    ];
    expect(steps.every((step) => step >= 0), JSON.stringify(calls, null, 2)).toBe(true);
    expect([...steps].sort((a, b) => a - b)).toEqual(steps);
    expect(indexOf(calls, "stop symbola")).toBe(-1);
    expect(imageTag("staging")).toBe(NEW);
    expect(previousTag("staging")).toBe(OLD);
    expect(deployLog().at(-1)).toEqual([expect.any(String), "staging", "deploiement", NEW, OLD, ""]);
  });

  it("garde les droits du fichier d'environnement, qui contient des secrets", () => {
    run(deployScript, ["staging", NEW]);
    expect(statSync(envFile("staging")).mode & 0o777).toBe(0o600);
    expect(readFileSync(envFile("staging"), "utf8")).toContain("SMTP_FROM=symbola@example.test");
  });

  it("refuse un commit qui n'est pas un SHA complet, avant toute étape", () => {
    for (const sha of ["2222222", "main", "latest", "ABCDEF0123456789ABCDEF0123456789ABCDEF01", `${NEW}0`]) {
      const { status, calls } = run(deployScript, ["staging", sha]);
      expect(status, sha).not.toBe(0);
      expect(calls).toEqual([]);
    }
  });

  it("refuse un commit absent de main, sans changer l'image", () => {
    const { status, output, calls } = run(deployScript, ["staging", NEW], { FAKE_NOT_ON_MAIN: "1" });
    expect(status).not.toBe(0);
    expect(output).toMatch(/n'est pas sur main/);
    expect(indexOf(calls, "pull symbola")).toBe(-1);
    expect(imageTag("staging")).toBe(OLD);
  });

  it("refuse de reculer le dépôt : une version plus ancienne passe par rollback.sh", () => {
    const { status, output } = run(deployScript, ["staging", NEW], { FAKE_HEAD: "3333333333333333333333333333333333333333" });
    expect(status).not.toBe(0);
    expect(output).toMatch(/rollback\.sh/);
    expect(imageTag("staging")).toBe(OLD);
  });

  it("une image introuvable laisse l'app et son tag tels quels, sans migration", () => {
    const { status, calls } = run(deployScript, ["staging", NEW], { FAKE_MISSING_TAG: NEW });
    expect(status).not.toBe(0);
    expect(indexOf(calls, "migrate")).toBe(-1);
    expect(imageTag("staging")).toBe(OLD);
  });

  it("arrête symbola pendant une migration qui le demande, puis le démarre sur la nouvelle version", () => {
    const { status, calls } = run(deployScript, ["staging", NEW], { FAKE_PLAN: "en attente : 0150_exemple (arrêt requis : statut renommé)\\narret-requis=oui" });
    expect(status).toBe(0);
    const stop = indexOf(calls, "stop symbola");
    expect(stop).toBeGreaterThan(indexOf(calls, "migrate:plan"));
    expect(stop).toBeLessThan(migrateIndex(calls));
    expect(indexOf(calls, `up ${NEW}`)).toBeGreaterThan(migrateIndex(calls));
  });

  it("des migrations en échec laissent l'app sur la version précédente, et le notent", () => {
    const { status, output, calls } = run(deployScript, ["staging", NEW], { FAKE_MIGRATE_STATUS: "1", FAKE_PLAN: "arret-requis=oui" });
    expect(status).not.toBe(0);
    expect(output).toMatch(/migrations en échec/);
    expect(imageTag("staging")).toBe(OLD);
    expect(indexOf(calls, `up ${OLD}`)).toBeGreaterThan(indexOf(calls, "stop symbola"));
    expect(indexOf(calls, `up ${NEW}`)).toBe(-1);
    expect(deployLog().at(-1)?.[2]).toBe("echec-migrations");
  });

  it("une version qui ne répond pas à la sonde de santé est remplacée aussitôt par la précédente", () => {
    const { status, output, calls } = run(deployScript, ["staging", NEW], { FAKE_UNHEALTHY_TAG: NEW });
    expect(status).not.toBe(0);
    expect(output).toMatch(/retour automatique à 1111111/);
    expect(indexOf(calls, `up ${OLD}`)).toBeGreaterThan(indexOf(calls, `up ${NEW}`));
    expect(indexOf(calls, "ops.deploy.rolled_back", "retour automatique à la version 1111111")).toBeGreaterThanOrEqual(0);
    expect(indexOf(calls, "ops.deploy.completed")).toBe(-1);
    expect(imageTag("staging")).toBe(OLD);
    expect(deployLog().at(-1)?.slice(2, 5)).toEqual(["retour-automatique", OLD, NEW]);
  });
});

describe("ARC-14 — Retour arrière en une commande (rollback.sh)", () => {
  it("remet la version précédente notée par deploy.sh, sans toucher au schéma, et la journalise", () => {
    expect(run(deployScript, ["staging", NEW]).status).toBe(0);
    rmSync(join(work, "calls.log"));
    const { status, calls } = run(rollbackScript, ["staging", "--motif=la page devis ne s'ouvre plus"]);
    expect(status).toBe(0);
    expect(imageTag("staging")).toBe(OLD);
    expect(indexOf(calls, `up ${OLD}`)).toBeGreaterThanOrEqual(0);
    expect(indexOf(calls, "migrate")).toBe(-1);
    expect(indexOf(calls, "hardening")).toBe(-1);
    expect(indexOf(calls, "ops.deploy.rolled_back", "retour à la version 1111111 (depuis 2222222) : la page devis ne s'ouvre plus")).toBeGreaterThanOrEqual(0);
    expect(deployLog().at(-1)?.slice(1, 5)).toEqual(["staging", "retour-arriere", OLD, NEW]);
  });

  it("n'attend pas la fenêtre : un retour arrière se fait le week-end", () => {
    expect(run(deployScript, ["production", NEW]).status).toBe(0);
    expect(run(rollbackScript, ["production"], { SYMBOLA_DEPLOY_NOW: SATURDAY }).status).toBe(0);
    expect(imageTag("production")).toBe(OLD);
  });

  it("relancé, il revient à la version qu'il vient de quitter", () => {
    run(deployScript, ["staging", NEW]);
    run(rollbackScript, ["staging"]);
    expect(run(rollbackScript, ["staging"]).status).toBe(0);
    expect(imageTag("staging")).toBe(NEW);
  });

  it("refuse sans version précédente notée, sans aucun appel", () => {
    const { status, output, calls } = run(rollbackScript, ["staging"]);
    expect(status).not.toBe(0);
    expect(output).toMatch(/aucune version précédente notée/);
    expect(calls).toEqual([]);
  });

  it("si la version précédente ne répond pas, revient à celle qui tournait", () => {
    run(deployScript, ["staging", NEW]);
    const { status } = run(rollbackScript, ["staging"], { FAKE_UNHEALTHY_TAG: OLD });
    expect(status).not.toBe(0);
    expect(imageTag("staging")).toBe(NEW);
    expect(previousTag("staging")).toBe(OLD);
  });
});

describe("DAT-10 — Jeu fictif rechargeable en une commande, au staging seulement (recette.sh)", () => {
  it("refuse la production et tout autre environnement, sans aucun appel", () => {
    for (const environment of ["production", "prod", ""]) {
      const { status, calls } = run(recetteScript, [environment]);
      expect(status, environment).not.toBe(0);
      expect(calls).toEqual([]);
    }
  });

  it("charge le jeu au staging par le chargeur de l'app, comptes hors du dépôt, lisibles par root seul", () => {
    const { status, calls } = run(recetteScript, ["staging"]);
    expect(status).toBe(0);
    const call = calls.find((candidate) => candidate.includes("seed:recette"));
    expect(call).toContain("--network symbola-staging_default");
    expect(call).toContain(`${join(work, "comptes")}:/comptes`);
    expect(call).toContain("--comptes /comptes/comptes-recette.txt");
    expect(statSync(join(work, "comptes")).mode & 0o777).toBe(0o700);
  });
});
