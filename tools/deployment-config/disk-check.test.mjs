// NFR-14 (lot 22, ADR 0051) — Occupation du disque du VPS signalée à une sonde « Push »
// d'Uptime Kuma : « up » sous le seuil, « down » à partir du seuil. Une sonde muette alerte
// aussi. `df` et `curl` sont remplacés par des doublures : aucun appel réseau.
import { spawnSync } from "node:child_process";
import { chmodSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

const repoRoot = resolve(import.meta.dirname, "..", "..");
const script = resolve(repoRoot, "infra/monitoring/disk-check.sh");
const read = (path) => readFileSync(resolve(repoRoot, path), "utf8");

// FAKE_DF : « chemin=pourcentage » séparés par des espaces.
const fakeDf = `#!/usr/bin/env bash
path="\${@: -1}"
use=""
for pair in \${FAKE_DF:-}; do [ "\${pair%%=*}" = "$path" ] && use="\${pair#*=}"; done
[ -n "$use" ] || exit 1
echo "Filesystem 1024-blocks Used Available Capacity Mounted on"
echo "/dev/sda1 1000 500 500 \${use}% $path"
`;
const fakeCurl = `#!/usr/bin/env bash
echo "curl $*" >>"$FAKE_LOG"
`;

let work;
let env;

function writeExecutable(path, content) {
  writeFileSync(path, content);
  chmodSync(path, 0o755);
}

function writeConfig(...lines) {
  writeFileSync(join(work, "config", "disk.env"), [...lines, ""].join("\n"));
}

function run(fakes = {}) {
  const result = spawnSync("bash", [script], { env: { ...env, ...fakes }, encoding: "utf8" });
  let calls = [];
  try {
    calls = readFileSync(env.FAKE_LOG, "utf8").trim().split("\n").filter(Boolean);
  } catch {
    // aucun appel journalisé
  }
  return { status: result.status, output: result.stdout + result.stderr, calls };
}

beforeEach(() => {
  work = mkdtempSync(join(tmpdir(), "symbola-disk-test-"));
  for (const dir of ["bin", "config"]) mkdirSync(join(work, dir), { recursive: true });
  writeExecutable(join(work, "bin/df"), fakeDf);
  writeExecutable(join(work, "bin/curl"), fakeCurl);
  writeConfig("DISK_PUSH_URL=http://127.0.0.1:3001/api/push/disque");
  env = {
    ...process.env,
    PATH: `${join(work, "bin")}:${process.env.PATH}`,
    FAKE_LOG: join(work, "calls.log"),
    MONITORING_CONFIG_DIR: join(work, "config"),
  };
});

afterEach(() => {
  rmSync(work, { recursive: true, force: true });
});

describe("NFR-14 — Alerte sur l'espace disque du VPS (lot 22)", () => {
  it("sous le seuil, signale « up » à la sonde, avec l'occupation", () => {
    const { status, calls } = run({ FAKE_DF: "/=42" });
    expect(status).toBe(0);
    expect(calls).toHaveLength(1);
    expect(calls[0]).toContain("status=up");
    expect(calls[0]).toContain("42 %");
    expect(calls[0]).toContain("http://127.0.0.1:3001/api/push/disque");
  });

  it("à partir de 80 % par défaut, signale « down » : Uptime Kuma alerte", () => {
    for (const use of ["80", "93"]) {
      rmSync(env.FAKE_LOG, { force: true });
      const { status, calls } = run({ FAKE_DF: `/=${use}` });
      expect(status).toBe(0);
      expect(calls[0]).toContain("status=down");
      expect(calls[0]).toContain(`${use} %`);
    }
    rmSync(env.FAKE_LOG, { force: true });
    expect(run({ FAKE_DF: "/=79" }).calls[0]).toContain("status=up");
  });

  it("prend le disque le plus plein parmi ceux surveillés", () => {
    writeConfig("DISK_PUSH_URL=http://127.0.0.1:3001/api/push/disque", 'DISK_PATHS="/ /var/lib/docker"');
    const { calls } = run({ FAKE_DF: "/=40 /var/lib/docker=90" });
    expect(calls[0]).toContain("status=down");
    expect(calls[0]).toContain("/var/lib/docker");
    expect(calls[0]).toContain("90 %");
  });

  it("le seuil se règle", () => {
    writeConfig("DISK_PUSH_URL=http://127.0.0.1:3001/api/push/disque", "DISK_THRESHOLD_PERCENT=95");
    expect(run({ FAKE_DF: "/=90" }).calls[0]).toContain("status=up");
  });

  it("refuse sans URL de sonde ou avec un seuil invalide, sans rien envoyer", () => {
    writeConfig("DISK_THRESHOLD_PERCENT=80");
    let result = run({ FAKE_DF: "/=42" });
    expect(result.status).not.toBe(0);
    expect(result.output).toMatch(/DISK_PUSH_URL/);
    expect(result.calls).toEqual([]);

    writeConfig("DISK_PUSH_URL=http://127.0.0.1:3001/api/push/disque", "DISK_THRESHOLD_PERCENT=beaucoup");
    result = run({ FAKE_DF: "/=42" });
    expect(result.status).not.toBe(0);
    expect(result.output).toMatch(/DISK_THRESHOLD_PERCENT/);
    expect(result.calls).toEqual([]);
  });

  it("étant donné une occupation illisible, échoue sans signaler « up » : la sonde muette alerte", () => {
    const { status, calls } = run({ FAKE_DF: "" });
    expect(status).not.toBe(0);
    expect(calls).toEqual([]);
  });

  it("étant donné l'URL collée entre guillemets telle que Kuma l'affiche (« ?status=up&msg=OK&ping= »), une alerte part bien « down » (lot 25)", () => {
    // Sans guillemets, Bash couperait la ligne au premier « & » : l'URL serait vide, le script
    // s'arrêterait et la sonde muette alerterait. Avec guillemets, la partie « ?… » est ignorée.
    writeConfig('DISK_PUSH_URL="http://127.0.0.1:3001/api/push/disque?status=up&msg=OK&ping="');
    const { status, calls } = run({ FAKE_DF: "/=93" });
    expect(status).toBe(0);
    expect(calls[0]).toContain("status=down");
    expect(calls[0]).not.toContain("status=up");
    expect(calls[0]).toMatch(/ http:\/\/127\.0\.0\.1:3001\/api\/push\/disque$/);
  });

  it("le message ne contient que le chemin et les pourcentages", () => {
    const { calls } = run({ FAKE_DF: "/=42" });
    expect(calls[0]).toMatch(/msg=Disque \/ à 42 % \(seuil 80 %\)/);
  });

  it("est planifié toutes les 15 minutes, avec rattrapage", () => {
    const timer = read("infra/monitoring/systemd/symbola-disk-check.timer");
    expect(timer).toMatch(/OnCalendar=\*:0\/15/);
    expect(timer).toMatch(/Persistent=true/);
    expect(read("infra/monitoring/systemd/symbola-disk-check.service")).toMatch(
      /ExecStart=\/opt\/symbola\/infra\/monitoring\/disk-check\.sh/,
    );
  });
});

describe("NFR-14 — Alertes sur le téléphone (runbook de surveillance)", () => {
  it("décrit le canal ntfy et la sonde du disque", () => {
    const runbook = read("docs/runbooks/surveillance.md");
    expect(runbook).toMatch(/ntfy/);
    expect(runbook).toContain("infra/monitoring/disk-check.sh");
  });
});
