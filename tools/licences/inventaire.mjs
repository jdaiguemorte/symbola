// Lot 40a (JUR-18, décision D8, ADR 0075) — écrit docs/conformite/licences.md depuis
// `pnpm licenses list`, autorisees.json et services.json. Usage :
//   pnpm --filter @symbola/tools-licences inventaire
// À relancer quand une dépendance ou un service change ; le contrôle de la CI (licences.test.mjs)
// refuse une licence inconnue ou à copyleft non justifiée, et un document qui oublie l'une d'elles.
import { writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { checkFiles, checkLicences, checkServices, classify, listPackages, listServiceImages, loadJson, repoRoot } from "./licences.mjs";

const packages = listPackages();
const allowed = loadJson("autorisees.json");
const services = loadJson("services.json");
const files = loadJson("fichiers.json");
const problems = [...checkLicences(packages, allowed), ...checkServices(listServiceImages(), services), ...checkFiles(files)];
if (problems.length > 0) {
  console.error(`Inventaire refusé :\n- ${problems.join("\n- ")}`);
  process.exit(1);
}

const counts = new Map();
for (const entry of packages) {
  const count = counts.get(entry.licence) ?? { production: 0, developpement: 0 };
  if (entry.portee === "production") count.production += 1;
  else count.developpement += 1;
  counts.set(entry.licence, count);
}
const byCount = [...counts.entries()].sort((a, b) => b[1].production + b[1].developpement - (a[1].production + a[1].developpement) || a[0].localeCompare(b[0]));
const production = packages.filter((entry) => entry.portee === "production").length;
const portee = (name) => packages.find((entry) => entry.name === name)?.portee ?? "—";
const cell = (text) => String(text).replaceAll("|", "\\|");

const lines = [
  "# Inventaire des licences (JUR-18)",
  "",
  "Généré par `pnpm --filter @symbola/tools-licences inventaire` (lot 40a, ADR 0075) depuis",
  "`pnpm licenses list`, `tools/licences/autorisees.json`, `tools/licences/services.json` et `tools/licences/fichiers.json` : ne pas",
  "le modifier à la main. Le contrôle de la CI (`tools/licences/licences.test.mjs`) refuse une licence",
  "inconnue, une licence à copyleft sans ligne justifiée, et un service sans ligne.",
  "",
  "Ce document décrit des faits : la licence de chaque composant et la façon dont Symbola l'emploie.",
  "Il ne tranche aucun point juridique ; les questions pour l'avocat sont à la fin.",
  "",
  "## Bibliothèques",
  "",
  `${packages.length} paquets installés, dont ${production} dans les dépendances de l'app livrée (« production ») ; les autres`,
  "servent à construire et à tester (« développement »). Les paquets propres à une plateforme",
  "(macOS, Linux) comptent pour un.",
  "",
  "| Licence | Type | Production | Développement |",
  "| --- | --- | ---: | ---: |",
  ...byCount.map(([licence, count]) => `| ${cell(licence)} | ${classify(licence)} | ${count.production} | ${count.developpement} |`),
  "",
  "### Licences à copyleft, et leur usage",
  "",
  "| Paquet | Licence | Portée | Usage |",
  "| --- | --- | --- | --- |",
  ...allowed.map((line) => `| \`${line.paquet}\` | ${line.licence} | ${portee(line.paquet)} | ${cell(line.usage)} |`),
  "",
  "## Services (images Docker)",
  "",
  "Images du Compose de production et du socle, et des scripts d'exploitation. Toutes sont",
  "employées telles que publiées.",
  "",
  "| Image | Licence | Usage |",
  "| --- | --- | --- |",
  ...services.map((line) => `| \`${line.image}\` | ${line.licence} | ${cell(line.mode)} |`),
  "",
  "## Fichiers tiers et outils de la CI",
  "",
  "Fichiers rangés dans le dépôt (polices) et outils qui ne tournent qu'en intégration continue",
  "(`tools/licences/fichiers.json`).",
  "",
  "| Fichier ou outil | Licence | Portée | Usage |",
  "| --- | --- | --- | --- |",
  ...files.map((line) => `| ${cell(line.nom)} | ${cell(line.licence)} | ${line.portee} | ${cell(line.usage)} |`),
  "",
  "## Points à faire valider par l'avocat",
  "",
  ...services.filter((line) => line.aValider).map((line) => `- **\`${line.image}\`** (${line.licence}) : ${line.aValider}`),
  "- **Code de Symbola** : aucun fichier de licence n'accompagne le dépôt public ; le choix revient à",
  "  Julien.",
  "",
];

const target = resolve(repoRoot, "docs/conformite/licences.md");
writeFileSync(target, lines.join("\n"));
console.log(`docs/conformite/licences.md écrit : ${packages.length} paquets, ${services.length} services.`);
