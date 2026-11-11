// SOC-10 — Sauvegardes : comportement de infra/backup/backup.sh et restore.sh.
// Lot 22 (NFR-10, NFR-13, ADR 0051) : dépôt distant sur la Storage Box Hetzner et contrôle
// de la protection de ses copies instantanées (check-snapshot-protection.sh).
// `docker`, `curl`, `date` et `flock` sont remplacés par des doublures qui journalisent
// chaque appel : on vérifie l'ordre des opérations et les garde-fous, sans Docker ni serveur
// (la doublure de `flock` rend aussi les tests jouables sur macOS, qui n'en a pas).
import { spawnSync } from "node:child_process";
import { chmodSync, mkdirSync, mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

const repoRoot = resolve(import.meta.dirname, "..", "..");
const backupScript = resolve(repoRoot, "infra/backup/backup.sh");
const restoreScript = resolve(repoRoot, "infra/backup/restore.sh");
const protectionScript = resolve(repoRoot, "infra/backup/check-snapshot-protection.sh");
const read = (path) => readFileSync(resolve(repoRoot, path), "utf8");

const SNAPSHOT_ID = "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";

// Doublure de docker : réponses pilotées par les variables FAKE_*.
const fakeDocker = `#!/usr/bin/env bash
echo "docker $*" >>"$FAKE_LOG"
args=" $* "
case "$args" in
  *" --entrypoint sftp "*)
    # Lot 22 : une commande sftp par lot (-b -), lue sur l'entrée standard.
    batch=$(cat)
    echo "sftp-batch $batch" >>"$FAKE_LOG"
    case "$batch" in
      "ls -1 "*) [ -n "\${FAKE_SFTP_LS:-}" ] || exit 1; echo "sftp> $batch"; printf '%s\\n' \${FAKE_SFTP_LS} ;;
      *) exit "\${FAKE_SFTP_WRITE_STATUS:-1}" ;;
    esac ;;
  *" cat config "*) exit "\${FAKE_REPO_STATUS:-0}" ;;
  *" check "*) exit "\${FAKE_CHECK_STATUS:-0}" ;;
  *" stats --mode raw-data "*) echo "Total Size: 42 MiB" ;;
  *"pg_database"*) echo "\${FAKE_DOCUMENSO_DB-}" ;;
  *"documenso.dump"*" dump "*|*" dump "*"documenso.dump"*) [ -n "\${FAKE_DOCUMENSO_DUMP:-}" ] || exit 1; echo "PGDMP-fake" ;;
  *"pg_dump"*) [ -n "\${FAKE_PGDUMP_FAIL:-}" ] && exit 1; echo "PGDMP-fake" ;;
  *"pg_restore --list"*) cat >/dev/null ;;
  *"pg_restore --exit-on-error"*) cat >/dev/null ;;
  *"returning id"*) echo "\${FAKE_RUN_ID-11111111-2222-3333-4444-555555555555}" ;;
  *" backup --json --tag "*) printf '{"message_type":"summary","data_added":%s}\\n' "\${FAKE_DATA_ADDED:-4096}"; exit "\${FAKE_BACKUP_STATUS:-0}" ;;
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
const fakeFlock = `#!/usr/bin/env bash
exit 0
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
  writeExecutable(join(work, "bin/flock"), fakeFlock);
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
    const backup = indexOf(calls, "restic/restic", "backup --json --tag env:production");
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
    expect(indexOf(calls, "backup --json --tag")).toBe(-1);
    expect(indexOf(calls, "stop garage")).toBe(-1);
    expect(indexOf(calls, "curl")).toBe(-1);
  });

  it("étant donné restic en échec, alors Garage et Uptime Kuma redémarrent quand même et aucun signal de succès n'est envoyé", () => {
    const { status, calls } = run(backupScript, ["production"], { FAKE_BACKUP_STATUS: "1" });
    expect(status).not.toBe(0);
    expect(indexOf(calls, "-p symbola-production", "start garage")).toBeGreaterThan(indexOf(calls, "backup --json --tag"));
    expect(indexOf(calls, "-p symbola-socle", "start uptime-kuma")).toBeGreaterThan(indexOf(calls, "backup --json --tag"));
    expect(indexOf(calls, "curl")).toBe(-1);
  });

  it("inclut les données d'Uptime Kuma en production, jamais en staging", () => {
    const production = run(backupScript, ["production"]);
    expect(production.calls[indexOf(production.calls, "backup --json --tag")]).toContain("symbola-socle_uptime_kuma_data:/backup/uptime-kuma:ro");
    expect(indexOf(production.calls, "-p symbola-socle", "stop uptime-kuma")).toBeGreaterThanOrEqual(0);

    rmSync(env.FAKE_LOG);
    const staging = run(backupScript, ["staging"]);
    expect(staging.status).toBe(0);
    expect(staging.calls.join("\n")).not.toContain("uptime");
    expect(staging.calls.join("\n")).not.toContain("symbola-production");
    expect(indexOf(staging.calls, "backup --json --tag env:staging")).toBeGreaterThanOrEqual(0);
    expect(indexOf(staging.calls, "curl")).toBe(-1); // pas d'URL push configurée
  });

  it("NFR-10 : contrôle chaque nuit la structure du dépôt, et relit 10 % des données le jour prévu seulement", () => {
    const weekday = run(backupScript, ["staging"], { FAKE_WEEKDAY: "3" }).calls;
    const nightly = indexOf(weekday, "restic/restic", " check");
    expect(nightly).toBeGreaterThanOrEqual(0);
    expect(weekday[nightly]).not.toContain("--read-data-subset");
    expect(nightly).toBeGreaterThan(indexOf(weekday, "forget --tag env:staging"));
    expect(indexOf(weekday, "stats --mode raw-data")).toBe(-1);
    rmSync(env.FAKE_LOG);
    const sunday = run(backupScript, ["staging"], { FAKE_WEEKDAY: "7" }).calls;
    expect(indexOf(sunday, "check --read-data-subset=10%")).toBeGreaterThanOrEqual(0);
    // NFR-30 : la taille du dépôt est relevée chaque semaine dans le journal.
    expect(indexOf(sunday, "stats --mode raw-data")).toBeGreaterThanOrEqual(0);
  });

  it("NFR-10 : étant donné le contrôle du dépôt en échec, alors aucun signal de succès n'est envoyé", () => {
    const { status, calls } = run(backupScript, ["production"], { FAKE_CHECK_STATUS: "1" });
    expect(status).not.toBe(0);
    expect(indexOf(calls, "curl", "status=up")).toBe(-1);
    expect(indexOf(calls, "status = 'failed'")).toBeGreaterThanOrEqual(0);
  });
});

describe("L13-HUB-18 — Dernière sauvegarde signalée à l'app (lot 13, ADR 0033)", () => {
  const RUN = "11111111-2222-3333-4444-555555555555";

  it("étant donné une sauvegarde réussie, son début puis sa fin, son résultat et sa taille sont enregistrés dans hub.backup_runs", () => {
    const { status, calls } = run(backupScript, ["production"], { FAKE_DATA_ADDED: "73400320" });
    expect(status).toBe(0);
    const start = indexOf(calls, "-p symbola-production", "psql", "insert into hub.backup_runs default values returning id");
    const dump = indexOf(calls, "pg_dump --format=custom");
    const end = indexOf(calls, "psql", "update hub.backup_runs", "status = 'succeeded'", "size_bytes = 73400320", `where id = '${RUN}'`);
    expect(start).toBeGreaterThanOrEqual(0);
    expect(start).toBeLessThan(dump);
    expect(end).toBeGreaterThan(indexOf(calls, "forget --tag env:production"));
    // Avec le rôle d'administration du conteneur : aucun identifiant dans les arguments.
    expect(calls[start]).toContain('--username="$POSTGRES_USER"');
  });

  it("étant donné restic en échec, la fin est signalée « failed » après le redémarrage de Garage", () => {
    const { status, calls } = run(backupScript, ["production"], { FAKE_BACKUP_STATUS: "1" });
    expect(status).not.toBe(0);
    const end = indexOf(calls, "update hub.backup_runs", "status = 'failed'");
    expect(end).toBeGreaterThan(indexOf(calls, "-p symbola-production", "start garage"));
  });

  it("étant donné un pg_dump en échec, la fin est signalée « failed », sans taille", () => {
    const { calls } = run(backupScript, ["staging"], { FAKE_PGDUMP_FAIL: "1" });
    expect(indexOf(calls, "update hub.backup_runs", "status = 'failed'", "size_bytes = null")).toBeGreaterThanOrEqual(0);
  });

  it("étant donné le signal impossible (base arrêtée, migration absente), la sauvegarde se fait quand même, sans signal de fin", () => {
    const { status, calls } = run(backupScript, ["staging"], { FAKE_RUN_ID: "" });
    expect(status).toBe(0);
    expect(indexOf(calls, "backup --json --tag env:staging")).toBeGreaterThanOrEqual(0);
    expect(indexOf(calls, "update hub.backup_runs")).toBe(-1);
  });
});

describe("DEV-02 — Sauvegarde de la base de Documenso (ADR 0026)", () => {
  it("sans Documenso déployé, la sauvegarde reste celle de Symbola seule", () => {
    const { status, calls } = run(backupScript, ["production"]);
    expect(status).toBe(0);
    expect(indexOf(calls, "--dbname=documenso")).toBe(-1);
  });

  it("étant donné Documenso déployé, sa base dédiée (fichiers compris) est vidée, vérifiée et entre dans le même instantané", () => {
    const { status, calls } = run(backupScript, ["production"], { FAKE_DOCUMENSO_DB: "1" });
    expect(status).toBe(0);
    const dump = indexOf(calls, "pg_dump --format=custom", "--dbname=documenso");
    const backup = indexOf(calls, "backup --json --tag env:production");
    for (const step of [dump, backup]) expect(step).toBeGreaterThanOrEqual(0);
    expect(dump).toBeLessThan(backup);
    expect(calls.filter((call) => call.includes("pg_restore --list"))).toHaveLength(2);
    // Ses fichiers sont dans sa base : aucun volume à copier, Documenso n'est jamais arrêté.
    expect(indexOf(calls, "stop documenso")).toBe(-1);
    expect(calls[backup]).not.toContain("documenso_data");
  });

  it("restaure la base de Documenso quand l'instantané la contient, après celle de Symbola", () => {
    const { status, calls } = run(restoreScript, ["staging", "--confirm=staging"], { FAKE_DOCUMENSO_DUMP: "1" });
    expect(status).toBe(0);
    const stop = indexOf(calls, "-p symbola-staging", "stop documenso");
    const symbolaRestore = indexOf(calls, "pg_restore --exit-on-error", "POSTGRES_DB");
    const recreate = indexOf(calls, "dropdb --if-exists --force", "documenso");
    const documensoRestore = indexOf(calls, "pg_restore --exit-on-error", "--dbname=documenso");
    const restart = indexOf(calls, "-p symbola-staging", "up -d documenso");
    for (const step of [stop, symbolaRestore, recreate, documensoRestore, restart]) expect(step).toBeGreaterThanOrEqual(0);
    expect(stop).toBeLessThan(recreate);
    expect(symbolaRestore).toBeLessThan(recreate);
    expect(recreate).toBeLessThan(documensoRestore);
    expect(documensoRestore).toBeLessThan(restart);
  });

  it("sans base Documenso dans l'instantané, la restauration ne touche pas Documenso", () => {
    const { status, calls } = run(restoreScript, ["staging", "--confirm=staging"]);
    expect(status).toBe(0);
    expect(indexOf(calls, "dropdb", "documenso")).toBe(-1);
    expect(indexOf(calls, "stop documenso")).toBe(-1);
    expect(indexOf(calls, "up -d documenso")).toBe(-1);
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

// Lot 22 — configuration d'un environnement dont le dépôt est sur la Storage Box Hetzner.
function writeRemoteConfig(environment, { strict = "yes", knownHosts = true, extra = "" } = {}) {
  const sshDir = join(work, "ssh", environment);
  mkdirSync(sshDir, { recursive: true });
  writeFileSync(
    join(sshDir, "config"),
    [`Host symbola-${environment}`, "  HostName u1-sub1.storage.test", "  Port 23", `  StrictHostKeyChecking ${strict}`, ""].join("\n"),
  );
  if (knownHosts) writeFileSync(join(sshDir, "known_hosts"), "[u1-sub1.storage.test]:23 ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIFAKE\n");
  writeFileSync(join(sshDir, "id_ed25519"), "CLE-PRIVEE-DE-TEST\n");
  writeFileSync(
    join(work, "config", `${environment}.env`),
    [
      `SYMBOLA_DIR=${join(work, "symbola")}`,
      `RESTIC_REPOSITORY=sftp:symbola-${environment}:restic`,
      `RESTIC_SSH_DIR=${sshDir}`,
      `RESTIC_PASSWORD_FILE=${join(work, "password")}`,
      extra,
    ].join("\n"),
  );
  return sshDir;
}

describe("NFR-10 — Sauvegarde chiffrée vers la Storage Box (lot 22, ADR 0051)", () => {
  it("étant donné un dépôt distant, l'instantané part vers lui : adresse passée à restic, configuration SSH montée en lecture seule, aucun dossier local monté comme dépôt", () => {
    const sshDir = writeRemoteConfig("staging");
    const { status, calls } = run(backupScript, ["staging"]);
    expect(status).toBe(0);
    const backupCall = calls[indexOf(calls, "restic/restic", "backup --json --tag env:staging")];
    expect(backupCall).toContain("RESTIC_REPOSITORY=sftp:symbola-staging:restic");
    expect(backupCall).toContain(`-v ${sshDir}:/root/.ssh:ro`);
    expect(backupCall).not.toContain(":/repo");
    for (const call of calls.filter((c) => c.includes("restic/restic"))) {
      expect(call).toContain("RESTIC_REPOSITORY=sftp:symbola-staging:restic");
    }
  });

  it("la clé SSH et le mot de passe restic ne passent jamais en argument", () => {
    writeRemoteConfig("staging");
    const all = run(backupScript, ["staging"]).calls.join("\n");
    expect(all).not.toContain("CLE-PRIVEE-DE-TEST");
    expect(all).not.toContain("mot-de-passe-de-test");
    expect(all).toContain("/run/secrets/restic-password:ro");
  });

  it("refuse un dépôt distant sans fichier des empreintes connues, sans aucun appel à Docker", () => {
    writeRemoteConfig("staging", { knownHosts: false });
    const { status, output, calls } = run(backupScript, ["staging"]);
    expect(status).not.toBe(0);
    expect(output).toMatch(/known_hosts/);
    expect(calls).toEqual([]);
  });

  it("refuse une configuration SSH qui accepterait une empreinte inconnue ou changée", () => {
    for (const strict of ["no", "accept-new"]) {
      writeRemoteConfig("staging", { strict });
      const { status, output, calls } = run(backupScript, ["staging"]);
      expect(status).not.toBe(0);
      expect(output).toMatch(/StrictHostKeyChecking yes/);
      expect(calls).toEqual([]);
    }
  });

  it("étant donné le dépôt distant injoignable (réseau, clé ou empreinte refusée), la sauvegarde échoue avant d'arrêter Garage, sans signal de succès, et sa fin est signalée « failed »", () => {
    writeRemoteConfig("production", { extra: "BACKUP_PUSH_URL=http://127.0.0.1:3001/api/push/jeton" });
    const { status, output, calls } = run(backupScript, ["production"], { FAKE_REPO_STATUS: "1" });
    expect(status).not.toBe(0);
    expect(output).toMatch(/injoignable/);
    expect(indexOf(calls, "stop garage")).toBe(-1);
    expect(indexOf(calls, "curl")).toBe(-1);
    expect(indexOf(calls, "status = 'failed'")).toBeGreaterThanOrEqual(0);
  });

  it("restaure depuis le dépôt distant, avec la même configuration SSH en lecture seule", () => {
    const sshDir = writeRemoteConfig("staging");
    const { status, calls } = run(restoreScript, ["staging", "--confirm=staging"]);
    expect(status).toBe(0);
    const resticCalls = calls.filter((c) => c.includes("restic/restic") && !c.includes("--entrypoint"));
    expect(resticCalls.length).toBeGreaterThan(0);
    for (const call of resticCalls) {
      expect(call).toContain("RESTIC_REPOSITORY=sftp:symbola-staging:restic");
      expect(call).toContain(`-v ${sshDir}:/root/.ssh:ro`);
    }
  });
});

describe("NFR-13 — Rétention, et copies instantanées hors d'atteinte du VPS (lot 22, ADR 0051)", () => {
  const SNAPSHOTS = ".zfs/snapshot/2026-11-11T05-00-00 .zfs/snapshot/2026-11-10T05-00-00";

  it("garde par défaut 7 sauvegardes quotidiennes, 4 hebdomadaires et 12 mensuelles", () => {
    const { calls } = run(backupScript, ["staging"]);
    expect(calls[indexOf(calls, "forget --tag env:staging")]).toContain("--keep-daily 7 --keep-weekly 4 --keep-monthly 12");
  });

  it("les modèles de configuration visent la Storage Box, épinglent l'empreinte et gardent 12 mensuelles", () => {
    const example = read("infra/backup/backup.env.example");
    expect(example).toMatch(/^RESTIC_REPOSITORY=sftp:symbola-production:restic$/m);
    expect(example).toMatch(/^RESTIC_SSH_DIR=\/etc\/symbola\/backup\/production\.ssh$/m);
    expect(example).toMatch(/^KEEP_MONTHLY=12$/m);
    const sshConfig = read("infra/backup/ssh-config.example");
    expect(sshConfig).toMatch(/^\s*Port 23$/m);
    expect(sshConfig).toMatch(/^\s*StrictHostKeyChecking yes$/m);
  });

  it("refuse de contrôler un dépôt local : le contrôle ne vaut que pour la Storage Box", () => {
    const { status, output, calls } = run(protectionScript, ["staging", "--confirm=staging"]);
    expect(status).not.toBe(0);
    expect(output).toMatch(/dépôt distant/);
    expect(calls).toEqual([]);
  });

  it("refuse sans --confirm répétant le nom de l'environnement, sans rien tenter", () => {
    writeRemoteConfig("staging");
    const { status, output, calls } = run(protectionScript, ["staging"], { FAKE_SFTP_LS: SNAPSHOTS });
    expect(status).not.toBe(0);
    expect(output).toMatch(/--confirm=staging/);
    expect(calls).toEqual([]);
  });

  it("étant donné les copies invisibles depuis le sous-compte, conclut qu'il ne peut pas les atteindre et renvoie au contrôle par le compte principal", () => {
    writeRemoteConfig("staging");
    const { status, output, calls } = run(protectionScript, ["staging", "--confirm=staging"]);
    expect(status).toBe(0);
    expect(output).toMatch(/invisibles/);
    expect(output).toMatch(/compte principal/);
    expect(calls.join("\n")).not.toMatch(/sftp-batch (mkdir|rmdir|rename)/);
  });

  it("étant donné les copies visibles, tente de les créer, modifier, renommer et supprimer depuis le sous-compte ; tout refus prouve qu'elles sont protégées", () => {
    const sshDir = writeRemoteConfig("staging");
    const { status, output, calls } = run(protectionScript, ["staging", "--confirm=staging"], { FAKE_SFTP_LS: SNAPSHOTS });
    expect(status).toBe(0);
    expect(output).toMatch(/2 copies/);
    expect(output).toMatch(/protégées/);
    const batches = calls.filter((c) => c.startsWith("sftp-batch "));
    expect(batches).toContain("sftp-batch mkdir .zfs/snapshot/symbola-protection-test");
    expect(batches).toContain("sftp-batch mkdir .zfs/snapshot/2026-11-10T05-00-00/symbola-protection-test");
    expect(batches).toContain("sftp-batch rename .zfs/snapshot/2026-11-10T05-00-00 .zfs/snapshot/2026-11-10T05-00-00-symbola-test");
    expect(batches).toContain("sftp-batch rmdir .zfs/snapshot/2026-11-10T05-00-00");
    for (const call of calls.filter((c) => c.includes("--entrypoint sftp"))) {
      expect(call).toContain(`-v ${sshDir}:/root/.ssh:ro`);
      expect(call).toContain("symbola-staging");
      expect(call).not.toContain("restic-password");
    }
  });

  it("étant donné une tentative acceptée, conclut bruyamment que les copies ne sont PAS protégées", () => {
    writeRemoteConfig("staging");
    const { status, output } = run(protectionScript, ["staging", "--confirm=staging"], {
      FAKE_SFTP_LS: SNAPSHOTS,
      FAKE_SFTP_WRITE_STATUS: "0",
    });
    expect(status).not.toBe(0);
    expect(output).toMatch(/NON protégées/);
  });
});

describe("Lot 22 — Runbook et chaîne de contrôle", () => {
  it("le runbook de restauration décrit la Storage Box, le contrôle des copies et l'exercice « dépôt effacé »", () => {
    const runbook = read("docs/runbooks/restauration.md");
    expect(runbook).toMatch(/Storage Box/);
    expect(runbook).toContain("infra/backup/check-snapshot-protection.sh");
    expect(runbook).toMatch(/dépôt effacé/);
    expect(runbook).toMatch(/## \d+\. Exercice « dépôt effacé »/);
  });

  it("la CI passe shellcheck sur les scripts de surveillance", () => {
    expect(read(".github/workflows/ci.yml")).toMatch(/shellcheck -x .*infra\/monitoring\/\*\.sh/);
  });
});
