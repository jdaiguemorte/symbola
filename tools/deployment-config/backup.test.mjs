// SOC-10 — Sauvegardes : comportement de infra/backup/backup.sh et restore.sh.
// `docker`, `curl` et `date` sont remplacés par des doublures qui journalisent chaque
// appel : on vérifie l'ordre des opérations et les garde-fous, sans Docker ni serveur.
import { spawnSync } from "node:child_process";
import { chmodSync, mkdirSync, mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

const repoRoot = resolve(import.meta.dirname, "..", "..");
const backupScript = resolve(repoRoot, "infra/backup/backup.sh");
const restoreScript = resolve(repoRoot, "infra/backup/restore.sh");
const read = (path) => readFileSync(resolve(repoRoot, path), "utf8");

const SNAPSHOT_ID = "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";

// Doublure de docker : réponses pilotées par les variables FAKE_*.
const fakeDocker = `#!/usr/bin/env bash
echo "docker $*" >>"$FAKE_LOG"
args=" $* "
case "$args" in
  *" cat config "*) exit "\${FAKE_REPO_STATUS:-0}" ;;
  *"pg_database"*) echo "\${FAKE_DOCUSEAL_DB-}" ;;
  *" volume inspect "*) [ -n "\${FAKE_DOCUSEAL_VOLUME:-}" ] || exit 1 ;;
  *"docuseal.dump"*" dump "*|*" dump "*"docuseal.dump"*) [ -n "\${FAKE_DOCUSEAL_DUMP:-}" ] || exit 1; echo "PGDMP-fake" ;;
  *"pg_dump"*) [ -n "\${FAKE_PGDUMP_FAIL:-}" ] && exit 1; echo "PGDMP-fake" ;;
  *"pg_restore --list"*) cat >/dev/null ;;
  *"pg_restore --exit-on-error"*) cat >/dev/null ;;
  *" backup --tag "*) exit "\${FAKE_BACKUP_STATUS:-0}" ;;
  *" snapshots "*) printf '%s' "\${FAKE_SNAPSHOTS_JSON-[{\\"tree\\":\\"aaaa\\",\\"id\\":\\"${SNAPSHOT_ID}\\"}]}" ;;
  *" dump "*) echo "PGDMP-fake" ;;
  *"pg_roles"*) echo "\${FAKE_ROLE_EXISTS-1}" ;;
esac
exit 0
`;
const fakeCurl = `#!/usr/bin/env bash
echo "curl $*" >>"$FAKE_LOG"
`;
const fakeDate = `#!/usr/bin/env bash
if [ "$1" = "+%u" ]; then echo "\${FAKE_WEEKDAY:-1}"; else exec /bin/date "$@"; fi
`;

let work;
let env;

function writeExecutable(path, content) {
  writeFileSync(path, content);
  chmodSync(path, 0o755);
}

function writeConfig(environment, extra = "") {
  writeFileSync(
    join(work, "config", `${environment}.env`),
    [
      `SYMBOLA_DIR=${join(work, "symbola")}`,
      `RESTIC_REPOSITORY=${join(work, "repo", environment)}`,
      `RESTIC_PASSWORD_FILE=${join(work, "password")}`,
      extra,
    ].join("\n"),
  );
  mkdirSync(join(work, "repo", environment), { recursive: true });
  writeFileSync(join(work, "symbola/infra/compose", `.env.${environment}`), "POSTGRES_APP_USER=symbola_app\n");
}

function run(script, args, fakes = {}) {
  const result = spawnSync("bash", [script, ...args], { env: { ...env, ...fakes }, encoding: "utf8" });
  let calls = [];
  try {
    calls = readFileSync(env.FAKE_LOG, "utf8").trim().split("\n").filter(Boolean);
  } catch {
    // aucun appel journalisé
  }
  return { status: result.status, output: result.stdout + result.stderr, calls };
}

// Position du premier appel contenant tous les fragments donnés (-1 si absent).
const indexOf = (calls, ...fragments) => calls.findIndex((call) => fragments.every((f) => call.includes(f)));

beforeEach(() => {
  work = mkdtempSync(join(tmpdir(), "symbola-backup-test-"));
  for (const dir of ["bin", "config", "symbola/infra/compose", "work"]) mkdirSync(join(work, dir), { recursive: true });
  writeExecutable(join(work, "bin/docker"), fakeDocker);
  writeExecutable(join(work, "bin/curl"), fakeCurl);
  writeExecutable(join(work, "bin/date"), fakeDate);
  writeFileSync(join(work, "password"), "mot-de-passe-de-test\n");
  writeConfig("production", "INCLUDE_MONITORING=true\nBACKUP_PUSH_URL=http://127.0.0.1:3001/api/push/jeton");
  writeConfig("staging");
  env = {
    ...process.env,
    PATH: `${join(work, "bin")}:${process.env.PATH}`,
    FAKE_LOG: join(work, "calls.log"),
    BACKUP_CONFIG_DIR: join(work, "config"),
    BACKUP_LOCK_DIR: work,
    BACKUP_WORK_DIR: join(work, "work"),
  };
});

afterEach(() => {
  rmSync(work, { recursive: true, force: true });
});

describe("SOC-10 — Sauvegarde nocturne (backup.sh)", () => {
  it("refuse un environnement inconnu, sans aucun appel à Docker", () => {
    const { status, output, calls } = run(backupScript, ["prod"]);
    expect(status).not.toBe(0);
    expect(output).toMatch(/staging ou production/);
    expect(calls).toEqual([]);
  });

  it("refuse de démarrer si le fichier de mot de passe restic est absent", () => {
    rmSync(join(work, "password"));
    const { status, output, calls } = run(backupScript, ["production"]);
    expect(status).not.toBe(0);
    expect(output).toMatch(/mot de passe restic/);
    expect(calls).toEqual([]);
  });

  it("n'initialise jamais un dépôt absent : il échoue et renvoie au runbook", () => {
    const { status, output, calls } = run(backupScript, ["production"], { FAKE_REPO_STATUS: "1" });
    expect(status).not.toBe(0);
    expect(output).toMatch(/non initialisé/);
    expect(indexOf(calls, " init")).toBe(-1);
    expect(indexOf(calls, "pg_dump")).toBe(-1);
  });

  it("étant donné un environnement sain, sauvegarde PostgreSQL et Garage dans un seul instantané chiffré, puis signale le succès", () => {
    const { status, calls } = run(backupScript, ["production"]);
    expect(status).toBe(0);

    const dump = indexOf(calls, "-p symbola-production", "pg_dump --format=custom");
    const verify = indexOf(calls, "pg_restore --list");
    const stopGarage = indexOf(calls, "-p symbola-production", "stop garage");
    const backup = indexOf(calls, "restic/restic", "backup --tag env:production");
    const startGarage = indexOf(calls, "-p symbola-production", "start garage");
    const forget = indexOf(calls, "forget --tag env:production");
    const push = indexOf(calls, "curl", "/api/push/jeton?status=up");

    for (const step of [dump, verify, stopGarage, backup, startGarage, forget, push]) expect(step).toBeGreaterThanOrEqual(0);
    expect(dump).toBeLessThan(verify);
    expect(verify).toBeLessThan(stopGarage);
    expect(stopGarage).toBeLessThan(backup);
    expect(backup).toBeLessThan(startGarage);
    expect(startGarage).toBeLessThan(forget);
    expect(forget).toBeLessThan(push);

    const backupCall = calls[backup];
    expect(backupCall).toContain("-v symbola-production_garage_data:/backup/garage:ro");
    expect(backupCall).toContain(":/backup/postgres:ro");
    expect(backupCall).toContain("RESTIC_PASSWORD_FILE=/run/secrets/restic-password");
    expect(backupCall).not.toContain("mot-de-passe-de-test");
  });

  it("supprime le dump temporaire après la sauvegarde", () => {
    run(backupScript, ["production"]);
    expect(() => statSync(join(work, "work/production/postgres.dump"))).toThrow();
  });

  it("étant donné un pg_dump en échec, alors aucun instantané, aucun arrêt de Garage, aucun signal de succès", () => {
    const { status, calls } = run(backupScript, ["production"], { FAKE_PGDUMP_FAIL: "1" });
    expect(status).not.toBe(0);
    expect(indexOf(calls, "backup --tag")).toBe(-1);
    expect(indexOf(calls, "stop garage")).toBe(-1);
    expect(indexOf(calls, "curl")).toBe(-1);
  });

  it("étant donné restic en échec, alors Garage et Uptime Kuma redémarrent quand même et aucun signal de succès n'est envoyé", () => {
    const { status, calls } = run(backupScript, ["production"], { FAKE_BACKUP_STATUS: "1" });
    expect(status).not.toBe(0);
    expect(indexOf(calls, "-p symbola-production", "start garage")).toBeGreaterThan(indexOf(calls, "backup --tag"));
    expect(indexOf(calls, "-p symbola-socle", "start uptime-kuma")).toBeGreaterThan(indexOf(calls, "backup --tag"));
    expect(indexOf(calls, "curl")).toBe(-1);
  });

  it("inclut les données d'Uptime Kuma en production, jamais en staging", () => {
    const production = run(backupScript, ["production"]);
    expect(production.calls[indexOf(production.calls, "backup --tag")]).toContain("symbola-socle_uptime_kuma_data:/backup/uptime-kuma:ro");
    expect(indexOf(production.calls, "-p symbola-socle", "stop uptime-kuma")).toBeGreaterThanOrEqual(0);

    rmSync(env.FAKE_LOG);
    const staging = run(backupScript, ["staging"]);
    expect(staging.status).toBe(0);
    expect(staging.calls.join("\n")).not.toContain("uptime");
    expect(staging.calls.join("\n")).not.toContain("symbola-production");
    expect(indexOf(staging.calls, "backup --tag env:staging")).toBeGreaterThanOrEqual(0);
    expect(indexOf(staging.calls, "curl")).toBe(-1); // pas d'URL push configurée
  });

  it("contrôle l'intégrité du dépôt le jour prévu seulement", () => {
    expect(indexOf(run(backupScript, ["staging"], { FAKE_WEEKDAY: "3" }).calls, " check ")).toBe(-1);
    rmSync(env.FAKE_LOG);
    expect(indexOf(run(backupScript, ["staging"], { FAKE_WEEKDAY: "7" }).calls, "check --read-data-subset=10%")).toBeGreaterThanOrEqual(0);
  });
});

describe("DEV-02 — Sauvegarde de la base et des fichiers de DocuSeal (ADR 0021)", () => {
  it("sans DocuSeal déployé, la sauvegarde reste celle de Symbola seule", () => {
    const { status, calls } = run(backupScript, ["production"]);
    expect(status).toBe(0);
    expect(indexOf(calls, "--dbname=docuseal")).toBe(-1);
    expect(calls[indexOf(calls, "backup --tag env:production")]).not.toContain("/backup/docuseal");
  });

  it("étant donné DocuSeal déployé, sa base dédiée est vidée et vérifiée, et ses fichiers entrent dans le même instantané", () => {
    const { status, calls } = run(backupScript, ["production"], { FAKE_DOCUSEAL_DB: "1", FAKE_DOCUSEAL_VOLUME: "1" });
    expect(status).toBe(0);
    const dump = indexOf(calls, "pg_dump --format=custom", "--dbname=docuseal");
    const stopDocuseal = indexOf(calls, "-p symbola-production", "stop docuseal");
    const backup = indexOf(calls, "backup --tag env:production");
    const startDocuseal = indexOf(calls, "-p symbola-production", "start docuseal");
    for (const step of [dump, stopDocuseal, backup, startDocuseal]) expect(step).toBeGreaterThanOrEqual(0);
    expect(dump).toBeLessThan(backup);
    expect(stopDocuseal).toBeLessThan(backup);
    expect(backup).toBeLessThan(startDocuseal);
    expect(calls.filter((call) => call.includes("pg_restore --list"))).toHaveLength(2);
    expect(calls[backup]).toContain("-v symbola-production_docuseal_data:/backup/docuseal:ro");
  });

  it("restaure la base et les fichiers de DocuSeal quand l'instantané les contient, après ceux de Symbola", () => {
    const { status, calls } = run(restoreScript, ["staging", "--confirm=staging"], { FAKE_DOCUSEAL_DUMP: "1" });
    expect(status).toBe(0);
    const symbolaRestore = indexOf(calls, "pg_restore --exit-on-error", "POSTGRES_DB");
    const recreate = indexOf(calls, "dropdb --if-exists --force", "docuseal");
    const docusealRestore = indexOf(calls, "pg_restore --exit-on-error", "--dbname=docuseal");
    const files = indexOf(calls, `restore ${SNAPSHOT_ID} --target / --include /backup/docuseal`);
    const restart = calls.findIndex((call) => / -p symbola-staging up -d --wait$/.test(call));
    for (const step of [symbolaRestore, recreate, docusealRestore, files, restart]) expect(step).toBeGreaterThanOrEqual(0);
    expect(symbolaRestore).toBeLessThan(recreate);
    expect(recreate).toBeLessThan(docusealRestore);
    expect(files).toBeLessThan(restart);
    expect(calls[files]).toContain("symbola-staging_docuseal_data:/backup/docuseal");
  });

  it("sans base DocuSeal dans l'instantané, la restauration ne touche pas DocuSeal", () => {
    const { status, calls } = run(restoreScript, ["staging", "--confirm=staging"]);
    expect(status).toBe(0);
    expect(indexOf(calls, "dropdb", "docuseal")).toBe(-1);
    expect(indexOf(calls, "--include /backup/docuseal")).toBe(-1);
  });
});

describe("SOC-10 — Restauration (restore.sh)", () => {
  it("refuse sans --confirm répétant le nom de l'environnement, sans rien toucher", () => {
    for (const args of [["staging"], ["staging", "--confirm=production"]]) {
      const { status, output, calls } = run(restoreScript, args);
      expect(status).not.toBe(0);
      expect(output).toMatch(/--confirm=staging/);
      expect(calls).toEqual([]);
      rmSync(env.FAKE_LOG, { force: true });
    }
  });

  it("étant donné un instantané qui ne porte pas le tag de l'environnement, alors refus avant toute action destructive", () => {
    const { status, output, calls } = run(restoreScript, ["staging", "--confirm=staging", "--snapshot=abcd1234"], {
      FAKE_SNAPSHOTS_JSON: "[]",
    });
    expect(status).not.toBe(0);
    expect(output).toMatch(/env:staging/);
    expect(calls[indexOf(calls, " snapshots ")]).toContain("--tag env:staging");
    expect(indexOf(calls, "stop symbola")).toBe(-1);
    expect(indexOf(calls, "dropdb")).toBe(-1);
  });

  it("étant donné un rôle applicatif absent, alors aucune base n'est supprimée et l'app reste arrêtée", () => {
    const { status, output, calls } = run(restoreScript, ["staging", "--confirm=staging"], { FAKE_ROLE_EXISTS: "" });
    expect(status).not.toBe(0);
    expect(output).toMatch(/bootstrap/);
    expect(indexOf(calls, "dropdb")).toBe(-1);
    expect(indexOf(calls, "up -d --wait", "symbola-staging")).toBeGreaterThanOrEqual(0); // postgres seul
    expect(calls.some((call) => / up -d --wait$/.test(call))).toBe(false);
  });

  it("étant donné un instantané valide, restaure PostgreSQL puis Garage, redémarre et affiche la durée", () => {
    const { status, output, calls } = run(restoreScript, ["staging", "--confirm=staging"]);
    expect(status).toBe(0);

    const stopApp = indexOf(calls, "-p symbola-staging", "stop symbola");
    const recreate = indexOf(calls, "dropdb --if-exists --force");
    const pgRestore = indexOf(calls, "pg_restore --exit-on-error");
    const stopGarage = indexOf(calls, "-p symbola-staging", "stop garage");
    const wipe = indexOf(calls, "symbola-staging_garage_data:/backup/garage", "find /backup/garage -mindepth 1 -delete");
    const restore = indexOf(calls, `restore ${SNAPSHOT_ID} --target / --include /backup/garage`);
    const restart = calls.findIndex((call) => / -p symbola-staging up -d --wait$/.test(call));

    for (const step of [stopApp, recreate, pgRestore, stopGarage, wipe, restore, restart]) expect(step).toBeGreaterThanOrEqual(0);
    expect(stopApp).toBeLessThan(recreate);
    expect(recreate).toBeLessThan(pgRestore);
    expect(pgRestore).toBeLessThan(stopGarage);
    expect(stopGarage).toBeLessThan(wipe);
    expect(wipe).toBeLessThan(restore);
    expect(restore).toBeLessThan(restart);
    expect(calls.join("\n")).not.toContain("symbola-production");
    expect(output).toMatch(/restauration terminée en \d+ min \d+ s/);
  });
});

describe("SOC-10 — Planification et documentation", () => {
  it("planifie la production avant le staging, avant le redémarrage automatique de 05:00, avec rattrapage", () => {
    const production = read("infra/backup/systemd/symbola-backup@production.timer");
    const staging = read("infra/backup/systemd/symbola-backup@staging.timer");
    expect(production).toMatch(/OnCalendar=\*-\*-\* 02:30:00 Europe\/Paris/);
    expect(staging).toMatch(/OnCalendar=\*-\*-\* 03:30:00 Europe\/Paris/);
    expect(production).toMatch(/Persistent=true/);
    expect(read("infra/backup/systemd/symbola-backup@.service")).toMatch(/ExecStart=\/opt\/symbola\/infra\/backup\/backup\.sh %i/);
  });

  it("épingle l'image restic sur une version précise", () => {
    expect(read("infra/backup/lib.sh")).toMatch(/restic\/restic:\d+\.\d+\.\d+/);
  });

  it("fournit le runbook de restauration avec un relevé du test chronométré sur le staging", () => {
    const runbook = read("docs/runbooks/restauration.md");
    expect(runbook).toContain("infra/backup/restore.sh");
    expect(runbook).toMatch(/--confirm=staging/);
    expect(runbook).toMatch(/## \d+\. Test de restauration chronométré/);
    expect(runbook).toMatch(/copie externe/i);
  });
});
