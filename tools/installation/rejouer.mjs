// Lot 40a (NFR-23, décision D7, ADR 0075) — rejoue le guide d'installation (docs/INSTALLATION.md)
// et le chronomètre. Les blocs ```bash placés entre <!-- rejeu:debut --> et <!-- rejeu:fin -->
// s'exécutent dans l'ordre, chacun dans son shell (bash -euo pipefail), depuis la racine du dépôt.
// Un bloc précédé de <!-- rejeu:serveur <adresse> --> démarre un serveur : il tourne en
// arrière-plan le temps que l'adresse réponde, puis il est arrêté. Échec si une commande échoue,
// si le serveur ne répond pas, ou si le tout dépasse trente minutes.
//   node tools/installation/rejouer.mjs [docs/INSTALLATION.md]
import { spawn, spawnSync } from "node:child_process";
import { appendFileSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

export const LIMIT_MS = 30 * 60 * 1000;
const SERVER_WAIT_MS = 5 * 60 * 1000;
const repoRoot = resolve(import.meta.dirname, "..", "..");

// Étapes du guide : { code, server (adresse attendue ou null), line (ligne du bloc) }.
export function extractSteps(markdown) {
  const lines = markdown.split("\n");
  const steps = [];
  let inside = false;
  let started = false;
  let pendingServer = null;
  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index].trim();
    if (line === "<!-- rejeu:debut -->") {
      if (started) throw new Error(`ligne ${index + 1} : deuxième repère rejeu:debut`);
      inside = true;
      started = true;
      continue;
    }
    if (line === "<!-- rejeu:fin -->") {
      if (!inside) throw new Error(`ligne ${index + 1} : rejeu:fin sans rejeu:debut`);
      inside = false;
      continue;
    }
    if (!inside) continue;
    const server = /^<!-- rejeu:serveur (https?:\/\/\S+) -->$/.exec(line);
    if (server) {
      pendingServer = server[1];
      continue;
    }
    if (line === "```bash") {
      const start = index + 1;
      const body = [];
      for (index += 1; index < lines.length && lines[index].trim() !== "```"; index += 1) body.push(lines[index]);
      if (index >= lines.length) throw new Error(`ligne ${start} : bloc de commandes non fermé`);
      steps.push({ code: body.join("\n"), server: pendingServer, line: start });
      pendingServer = null;
    }
  }
  if (!started) throw new Error("aucun repère <!-- rejeu:debut --> dans le guide");
  if (inside) throw new Error("repère <!-- rejeu:fin --> manquant");
  if (pendingServer) throw new Error(`rejeu:serveur ${pendingServer} sans bloc de commandes`);
  return steps;
}

export function formatDuration(milliseconds) {
  const seconds = Math.round(milliseconds / 1000);
  return `${Math.floor(seconds / 60)} min ${String(seconds % 60).padStart(2, "0")} s`;
}

async function waitFor(url, child) {
  const deadline = Date.now() + SERVER_WAIT_MS;
  while (Date.now() < deadline) {
    if (child.exitCode !== null) throw new Error(`le serveur s'est arrêté (code ${child.exitCode}) avant de répondre`);
    try {
      const response = await fetch(url, { redirect: "manual" });
      if (response.status < 500) return response.status;
    } catch {
      // pas encore prêt
    }
    await new Promise((done) => setTimeout(done, 2000));
  }
  throw new Error(`${url} ne répond pas après ${formatDuration(SERVER_WAIT_MS)}`);
}

function stop(child) {
  try {
    process.kill(-child.pid, "SIGTERM");
  } catch {
    // déjà arrêté
  }
}

async function main() {
  const guide = resolve(repoRoot, process.argv[2] ?? "docs/INSTALLATION.md");
  const steps = extractSteps(readFileSync(guide, "utf8"));
  const started = Date.now();
  const timings = [];
  for (const step of steps) {
    const stepStart = Date.now();
    console.log(`\n▶ ${guide.replace(`${repoRoot}/`, "")}, ligne ${step.line}${step.server ? ` (serveur, ${step.server})` : ""}`);
    if (step.server) {
      const child = spawn("bash", ["-euo", "pipefail", "-c", step.code], { cwd: repoRoot, stdio: "inherit", detached: true });
      try {
        const status = await waitFor(step.server, child);
        console.log(`${step.server} répond (${status}).`);
      } finally {
        stop(child);
      }
    } else {
      const result = spawnSync("bash", ["-euo", "pipefail", "-c", step.code], { cwd: repoRoot, stdio: "inherit" });
      if (result.status !== 0) throw new Error(`ligne ${step.line} : commande en échec (code ${result.status})`);
    }
    timings.push({ line: step.line, duration: Date.now() - stepStart });
  }
  const total = Date.now() - started;
  const summary = [
    `### Installation rejouée (NFR-23) : ${formatDuration(total)}, pour un seuil de ${formatDuration(LIMIT_MS)}`,
    "",
    "| Bloc (ligne du guide) | Durée |",
    "| --- | ---: |",
    ...timings.map((timing) => `| ${timing.line} | ${formatDuration(timing.duration)} |`),
    "",
  ].join("\n");
  console.log(`\n${summary}`);
  if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, summary);
  if (total > LIMIT_MS) throw new Error(`installation en ${formatDuration(total)} : au-delà de trente minutes`);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    console.error(`\nRejeu de l'installation en échec : ${error instanceof Error ? error.message : error}`);
    process.exitCode = 1;
  });
}
