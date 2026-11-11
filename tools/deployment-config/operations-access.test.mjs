// Lot 23 — SEC-09 (décision Q31, ADR 0060) : un accès d'exploitation à la base est tracé
// et motivé. infra/server/acces-base.sh écrit au journal d'audit avant d'ouvrir psql et à
// la sortie ; infra/backup/restore.sh écrit la restauration. `docker` et `flock` sont des
// doublures qui journalisent chaque appel (et le SQL reçu sur l'entrée standard).
import { spawnSync } from "node:child_process";
import { chmodSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

const repoRoot = resolve(import.meta.dirname, "..", "..");
const accessScript = resolve(repoRoot, "infra/server/acces-base.sh");
const restoreScript = resolve(repoRoot, "infra/backup/restore.sh");
const SNAPSHOT_ID = "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";

const fakeDocker = `#!/usr/bin/env bash
echo "docker $*" >>"$FAKE_LOG"
case " $* " in
  *" ops."*) echo "sql $(cat | tr '\\n' ' ')" >>"$FAKE_LOG" ;;
  *" snapshots "*) printf '[{"id":"${SNAPSHOT_ID}"}]' ;;
  *"pg_roles"*) echo 1 ;;
  *"pg_restore"*) cat >/dev/null ;;
  *" dump "*"documenso.dump"*) exit 1 ;;
  *" dump "*) echo "PGDMP-fake" ;;
esac
exit 0
`;

let work;
let env;

function writeExecutable(path, content) {
  writeFileSync(path, content);
  chmodSync(path, 0o755);
}

function run(script, args) {
  const result = spawnSync("bash", [script, ...args], { env, encoding: "utf8" });
  let calls = [];
  try {
    calls = readFileSync(env.FAKE_LOG, "utf8").trim().split("\n").filter(Boolean);
  } catch {
    // aucun appel journalisé
  }
  return { status: result.status, output: result.stdout + result.stderr, calls };
}

const indexOf = (calls, ...fragments) => calls.findIndex((call) => fragments.every((f) => call.includes(f)));

beforeEach(() => {
  work = mkdtempSync(join(tmpdir(), "symbola-ops-test-"));
  for (const dir of ["bin", "config", "symbola/infra/compose", "work", "repo/staging"]) mkdirSync(join(work, dir), { recursive: true });
  writeExecutable(join(work, "bin/docker"), fakeDocker);
  writeExecutable(join(work, "bin/flock"), "#!/usr/bin/env bash\nexit 0\n");
  writeFileSync(join(work, "password"), "mot-de-passe-de-test\n");
  writeFileSync(
    join(work, "config", "staging.env"),
    [`SYMBOLA_DIR=${join(work, "symbola")}`, `RESTIC_REPOSITORY=${join(work, "repo", "staging")}`, `RESTIC_PASSWORD_FILE=${join(work, "password")}`].join("\n"),
  );
  writeFileSync(join(work, "symbola/infra/compose", ".env.staging"), "POSTGRES_APP_USER=symbola_app\n");
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

describe("SEC-09 — Accès d'exploitation à la base (acces-base.sh)", () => {
  it("refuse un accès sans motif, sans aucun appel à Docker", () => {
    for (const args of [["staging"], ["staging", "--motif="], ["staging", "--motif=   "]]) {
      const { status, output, calls } = run(accessScript, args);
      expect(status).not.toBe(0);
      expect(output).toMatch(/motif obligatoire/);
      expect(calls).toEqual([]);
    }
  });

  it("refuse un motif qui contient une donnée personnelle (e-mail, téléphone)", () => {
    for (const motif of ["demande de lea@example.org", "rappeler le 06 12 34 56 78"]) {
      const { status, output, calls } = run(accessScript, ["staging", `--motif=${motif}`]);
      expect(status).not.toBe(0);
      expect(output).toMatch(/aucune donnée personnelle/);
      expect(calls).toEqual([]);
    }
  });

  it("journalise l'ouverture avec le motif, ouvre psql, puis journalise la fermeture", () => {
    const motif = "vérifier la migration 0093 ; ticket 42";
    const { status, calls } = run(accessScript, ["staging", `--motif=${motif}`]);
    expect(status).toBe(0);
    const opened = indexOf(calls, "ops.database.opened", motif);
    const psql = calls.findIndex((call) => call.includes("exec postgres") && call.includes("psql --username"));
    const closed = indexOf(calls, "ops.database.closed", motif);
    expect([opened, psql, closed].every((index) => index >= 0)).toBe(true);
    expect(opened).toBeLessThan(psql);
    expect(psql).toBeLessThan(closed);
    // Le motif passe en variable psql, jamais collé dans le SQL.
    const sql = calls.filter((call) => call.startsWith("sql "));
    expect(sql).toHaveLength(2);
    for (const statement of sql) {
      expect(statement).toContain(":'motif'");
      expect(statement).toContain("'exploitation'");
      expect(statement).not.toContain(motif);
    }
  });
});

describe("SEC-09 — Restauration journalisée (restore.sh)", () => {
  it("écrit ops.backup.restored après le redémarrage, avec l'instantané pour motif par défaut", () => {
    const { status, calls } = run(restoreScript, ["staging", "--confirm=staging"]);
    expect(status).toBe(0);
    const restart = calls.findIndex((call) => call.includes(" up -d --wait") && !call.includes("postgres"));
    const restored = indexOf(calls, "ops.backup.restored", "restauration de l'instantané 01234567");
    expect(restart).toBeGreaterThanOrEqual(0);
    expect(restored).toBeGreaterThan(restart);
  });

  it("prend le motif donné, et refuse une donnée personnelle avant toute restauration", () => {
    expect(indexOf(run(restoreScript, ["staging", "--confirm=staging", "--motif=exercice mensuel"]).calls, "ops.backup.restored", "exercice mensuel")).toBeGreaterThanOrEqual(0);
    rmSync(env.FAKE_LOG);
    const refused = run(restoreScript, ["staging", "--confirm=staging", "--motif=pour lea@example.org"]);
    expect(refused.status).not.toBe(0);
    expect(refused.calls).toEqual([]);
  });
});
