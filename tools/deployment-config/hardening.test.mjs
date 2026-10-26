// SOC-12 — Durcissement du VPS : runbook exécuté par Julien, script de
// vérification après exécution, et garde-fou sur les composes (Docker
// contourne le pare-feu UFW pour les ports publiés).
import { spawnSync } from "node:child_process";
import { existsSync, readFileSync, statSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const repoRoot = resolve(import.meta.dirname, "..", "..");
const read = (path) => readFileSync(resolve(repoRoot, path), "utf8");
const runbookPath = "docs/runbooks/durcissement-serveur.md";
const scriptPath = "infra/server/check-hardening.sh";
const runbook = existsSync(resolve(repoRoot, runbookPath)) ? read(runbookPath) : "";
const script = existsSync(resolve(repoRoot, scriptPath)) ? read(scriptPath) : "";

describe("SOC-12 — Runbook de durcissement serveur", () => {
  it("existe dans docs/runbooks", () => {
    expect(runbook).not.toBe("");
  });

  it("impose la connexion SSH par clé uniquement et désactive root", () => {
    expect(runbook).toMatch(/PasswordAuthentication no/);
    expect(runbook).toMatch(/KbdInteractiveAuthentication no/);
    expect(runbook).toMatch(/PermitRootLogin no/);
    expect(runbook).toMatch(/passwd -l root/);
  });

  it("limite le pare-feu à 80/443 plus SSH restreint", () => {
    expect(runbook).toMatch(/ufw default deny incoming/);
    expect(runbook).toMatch(/ufw allow 80\/tcp/);
    expect(runbook).toMatch(/ufw allow 443\/tcp/);
    expect(runbook).toMatch(/ufw limit 22\/tcp|ufw allow from \S+ to any port 22/);
  });

  it("explique que Docker contourne UFW et protège les conteneurs (DOCKER-USER)", () => {
    expect(runbook).toMatch(/DOCKER-USER/);
  });

  it("installe CrowdSec avec un bouncer pare-feu", () => {
    expect(runbook).toMatch(/crowdsec-firewall-bouncer/);
  });

  it("active les mises à jour de sécurité automatiques", () => {
    expect(runbook).toMatch(/unattended-upgrades/);
    expect(runbook).toMatch(/APT::Periodic::Unattended-Upgrade "1"/);
  });

  it("installe Docker depuis le dépôt officiel et documente sa mise à jour", () => {
    expect(runbook).toMatch(/download\.docker\.com/);
    expect(runbook).toMatch(/"live-restore":\s*true/);
    expect(runbook).toMatch(/## (\d+\. )?Mettre Docker à jour/);
  });

  it("se termine par une checklist de vérification après exécution", () => {
    expect(runbook).toMatch(/## Checklist de vérification/);
    expect(runbook).toContain(scriptPath);
    expect(runbook).toMatch(/- \[ \]/);
  });
});

describe("SOC-12 — Script de vérification après exécution", () => {
  it("existe, est exécutable et s'arrête sur une erreur de shell", () => {
    expect(script).toMatch(/^#!\/usr\/bin\/env bash\n/);
    expect(script).toMatch(/set -euo pipefail/);
    expect(statSync(resolve(repoRoot, scriptPath)).mode & 0o111).not.toBe(0);
  });

  it.each([
    ["SSH par clé uniquement", /passwordauthentication no/],
    ["root interdit en SSH", /permitrootlogin no/],
    ["pare-feu actif", /ufw status verbose/],
    ["CrowdSec actif", /crowdsec/],
    ["bouncer pare-feu actif", /crowdsec-firewall-bouncer/],
    ["mises à jour automatiques", /Unattended-Upgrade/],
    ["Docker live-restore", /LiveRestoreEnabled/],
    ["ports publiés par Docker", /docker ps/],
    ["ports en écoute sur l'hôte", /ss -H?tln/],
    ["horloge synchronisée (TOTP)", /NTPSynchronized/],
  ])("vérifie : %s", (_label, pattern) => {
    expect(script).toMatch(pattern);
  });

  it("ne modifie rien sur le serveur (lecture seule)", () => {
    expect(script).not.toMatch(/\b(ufw (allow|deny|enable|disable|limit)|apt(-get)? (install|remove)|systemctl (start|stop|restart|enable|disable)|rm -|sed -i|tee )/);
  });
});

describe("SOC-12 — Aucun port publié sur toutes les interfaces, hors Traefik 80/443", () => {
  // Docker insère ses règles iptables avant UFW : un port publié sans
  // 127.0.0.1 est joignable depuis Internet même si UFW le refuse.
  const composes = ["infra/compose/docker-compose.socle.yml", "infra/compose/docker-compose.prod.yml"];

  it.each(composes)("%s", (path) => {
    const portBlocks = [...read(path).matchAll(/\n {4}ports:\n((?: {6}- .+\n)+)/g)].map((match) => match[1]);
    expect(portBlocks.length).toBeGreaterThan(0);
    const published = portBlocks.flatMap((block) => [...block.matchAll(/- "([^"]+)"/g)].map((match) => match[1]));
    const publicPorts = published.filter((port) => !port.startsWith("127.0.0.1:"));
    for (const port of publicPorts) expect(["80:80", "443:443"]).toContain(port);
  });
});

describe("SOC-12 — Script de vérification : ports en écoute sur l'hôte", () => {
  // Rejoue le filtre réel du script sur des sorties `ss -Htln` types, pour éviter les
  // faux positifs constatés sur le VPS (résolveur systemd affiché « 127.0.0.53%lo:53 »).
  const pipeline = script.match(/public_listeners=\$\(ss -Htln 2>\/dev\/null (\| awk[\s\S]*?) \|\| true\)/)?.[1];
  const publicListeners = (addresses) =>
    spawnSync("bash", ["-c", `printf '%s\\n' "$@" | awk '{print "LISTEN 0 4096 " $1 " 0.0.0.0:*"}' | awk '{print $4}' ${pipeline.replace(/^\| awk '\{print \$4\}'/, "")} || true`, "_", ...addresses], {
      encoding: "utf8",
    }).stdout.trim();

  it("retrouve le filtre dans le script", () => {
    expect(pipeline).toBeDefined();
  });

  it.each(["127.0.0.53%lo:53", "127.0.0.54:53", "127.0.0.1:3001", "[::1]:25", "0.0.0.0:22", "[::]:443", "0.0.0.0:80"])(
    "n'alerte pas pour %s (boucle locale ou port attendu)",
    (address) => {
      expect(publicListeners([address])).toBe("");
    },
  );

  it.each(["0.0.0.0:9443", "[::]:8000", "5.182.17.166:5432", "0.0.0.0%eth0:8080"])("alerte pour %s", (address) => {
    expect(publicListeners([address])).toBe(address);
  });
});
