// Lot 76 (ARC-20, SEC-36 ; ADR 0124) — la CI en deux vitesses : quels parcours de bout en bout jouer.
// - Sur une pull request : la voie rapide, c'est-à-dire le socle (apps/symbola/e2e/socle.ts) et les
//   fichiers de parcours que la PR modifie ou ajoute, sous Chromium en ordinateur et en 375 px ; et,
//   dans leur propre job, les mesures du temps de réponse (décision de Julien du 28/11/2026 : une PR
//   qui alourdit les pages s'arrête avant la fusion).
// - Sur main après une fusion, la nuit, à la demande (workflow_dispatch), ou sur une PR étiquetée
//   « suite-complete » : la suite complète sous Chromium en quatre parts, les scénarios sous Firefox
//   et WebKit, et les mesures du temps de réponse (NFR-01, NFR-02) dans leur propre job.
// Appelé par le job « plan-e2e » de .github/workflows/ci.yml ; testé par plan-parcours.test.mjs.
import { execFileSync } from "node:child_process";
import { appendFileSync } from "node:fs";
import { pathToFileURL } from "node:url";

export const FULL_SUITE_LABEL = "suite-complete";
const E2E_DIR = "apps/symbola/e2e/";
const CHROMIUM = "--project=desktop --project=mobile-375";
const PARTS = 4;

// limite : minutes accordées à l'étape des parcours (Playwright s'arrête proprement deux minutes
// avant) ; limite_job : minutes du job entier (préparation d'environ six minutes comprise).
export const FAST_LANE = {
  cle: "voie-rapide",
  partie: "voie rapide : socle et parcours modifiés, Chromium, ordinateur et 375 px",
  mode: "rapide",
  navigateurs: "chromium",
  projets: CHROMIUM,
  limite: 25,
  limite_job: 40,
};

// Les tests de mesure (« NFR-01 » ou « NFR-02 » dans le titre) : serveur démarré une fois, réchauffé
// par le socle, puis mesuré sans redémarrer. Joués sur chaque PR comme sur main.
export const MEASURES = {
  cle: "mesures",
  partie: "mesures du temps de réponse (NFR-01, NFR-02), serveur chaud",
  mode: "mesures",
  navigateurs: "chromium",
  projets: "--project=desktop",
  limite: 20,
  limite_job: 40,
};

export const FULL_SUITE = [
  ...Array.from({ length: PARTS }, (_, index) => ({
    cle: `part-${index + 1}`,
    partie: `Chromium, ordinateur et 375 px, axe-core, part ${index + 1} sur ${PARTS}`,
    mode: "part",
    navigateurs: "chromium",
    projets: `${CHROMIUM} --shard=${index + 1}/${PARTS}`,
    limite: 40,
    limite_job: 55,
  })),
  {
    cle: "navigateurs",
    partie: "scénarios sous Firefox et WebKit, 360 et 1 920 px, zoom à 150 %",
    mode: "part",
    navigateurs: "chromium firefox webkit",
    projets: "--project=firefox --project=webkit --project=mobile-360 --project=desktop-1920 --project=zoom-150",
    limite: 40,
    limite_job: 55,
  },
  MEASURES,
];

export function isFullSuite({ event, labels = [] }) {
  return event !== "pull_request" || labels.includes(FULL_SUITE_LABEL);
}

// changedFiles : chemins depuis la racine du dépôt (git diff --name-only).
export function planParcours({ event, labels = [], changedFiles = [] }) {
  if (isFullSuite({ event, labels })) return { complete: true, matrix: FULL_SUITE, fichiers: [], avertissements: [] };
  const avertissements = [];
  const inE2e = changedFiles.filter((path) => path.startsWith(E2E_DIR) && !path.slice(E2E_DIR.length).includes("/"));
  const specs = inE2e.map((path) => path.slice(E2E_DIR.length)).filter((name) => name.endsWith(".spec.ts"));
  // Les tests de mesure des fichiers modifiés sont écartés de la voie rapide (serveur froid) : le job
  // des mesures les joue tous.
  const fichiers = specs.sort();
  const shared = inE2e.filter((path) => !path.endsWith(".spec.ts")).concat(changedFiles.filter((path) => path === "apps/symbola/playwright.config.ts"));
  if (shared.length > 0) {
    avertissements.push(`Outils communs des parcours modifiés (${shared.join(", ")}) : ils servent à toute la suite ; l'étiquette « ${FULL_SUITE_LABEL} » la joue sur cette PR.`);
  }
  return { complete: false, matrix: [FAST_LANE, MEASURES], fichiers, avertissements };
}

function changedFilesOfPullRequest() {
  // Le commit d'une PR est sa fusion dans la branche visée : son premier parent est la branche visée.
  const output = execFileSync("git", ["diff", "--name-only", "--diff-filter=AMR", "HEAD^1", "HEAD"], { encoding: "utf8" });
  return output.split("\n").filter(Boolean);
}

function main() {
  const event = process.env.EVENT_NAME ?? "";
  // Hors d'une PR, GitHub donne « null ».
  const labels = JSON.parse(process.env.LABELS || "[]") ?? [];
  const changedFiles = isFullSuite({ event, labels }) ? [] : changedFilesOfPullRequest();
  const plan = planParcours({ event, labels, changedFiles });
  const lines = [
    `complete=${plan.complete}`,
    `matrix=${JSON.stringify({ include: plan.matrix })}`,
    `fichiers=${plan.fichiers.join(" ")}`,
  ];
  if (process.env.GITHUB_OUTPUT) appendFileSync(process.env.GITHUB_OUTPUT, `${lines.join("\n")}\n`);
  const summary = plan.complete
    ? ["### Parcours : suite complète", "", `Chromium en ${PARTS} parts, scénarios sous Firefox et WebKit, mesures du temps de réponse dans leur propre job.`]
    : [
        "### Parcours : voie rapide",
        "",
        "Le socle (`apps/symbola/e2e/socle.ts`) et les fichiers de parcours modifiés par la PR, sous Chromium, en ordinateur et en 375 px ; les mesures du temps de réponse dans leur job. La suite complète tourne sur main après la fusion.",
        "",
        plan.fichiers.length > 0 ? `Fichiers modifiés joués en entier : ${plan.fichiers.map((name) => `\`${name}\``).join(", ")}.` : "Aucun fichier de parcours modifié : le socle seul.",
        ...plan.avertissements.map((text) => `\n> ${text}`),
      ];
  if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, `${summary.join("\n")}\n`);
  for (const text of plan.avertissements) console.log(`::warning::${text}`);
  console.log(lines.join("\n"));
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) main();
