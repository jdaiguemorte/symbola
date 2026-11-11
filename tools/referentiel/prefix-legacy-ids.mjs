#!/usr/bin/env node
// Lot 25 (décision Q1, NFR-24) — préfixe les anciens identifiants (PRD du MVP, lots 10 à 21)
// qui portent le même nom qu'une exigence du nouveau cahier des charges : EVT-03 → PRD-EVT-03,
// HUB-28 → L21-HUB-28. La table fait foi : docs/referentiel/correspondance-identifiants.md.
//
// Usage :
//   node tools/referentiel/prefix-legacy-ids.mjs <fichier…>          préfixe, en place
//   node tools/referentiel/prefix-legacy-ids.mjs --check <fichier…>  signale un ancien identifiant
//                                                                    resté sans préfixe (sortie 1)
//   node tools/referentiel/prefix-legacy-ids.mjs --name <fichier>    nouveau chemin d'un fichier
//                                                                    nommé d'après un identifiant
// Ne jamais l'appliquer aux documents écrits avec les nouveaux identifiants (cahier des charges,
// rapport d'écart, CLAUDE.md, lots 22 et suivants, ADR 0051 et suivants) ni aux archives.
import { readFileSync, writeFileSync } from "node:fs";
import { basename, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const tablePath = join(dirname(fileURLToPath(import.meta.url)), "../../docs/referentiel/correspondance-identifiants.md");

// Un identifiant isolé : ni précédé d'une lettre, d'un chiffre ou d'un tiret (donc jamais
// re-préfixé), ni suivi d'un chiffre.
const ID = /(?<![A-Za-z0-9-])([A-Z]{3})-(\d{2})(?![0-9])/g;

/** Lit la table Markdown : « | EVT-03 | PRD-EVT-03 | … | » → Map("EVT-03" → "PRD-EVT-03"). */
export function parseTable(markdown) {
  const table = new Map();
  for (const line of markdown.split("\n")) {
    const match = /^\| ([A-Z]{3}-\d{2}) \| ((?:PRD|L\d+)-\1) \|/.exec(line);
    if (match) table.set(match[1], match[2]);
  }
  return table;
}

export function loadTable() {
  return parseTable(readFileSync(tablePath, "utf8"));
}

/** Préfixe chaque ancien identifiant présent dans la table ; les autres restent tels quels. */
export function prefixIds(text, table) {
  let count = 0;
  const result = text.replace(ID, (whole) => {
    const renamed = table.get(whole);
    if (!renamed) return whole;
    count += 1;
    return renamed;
  });
  return { text: result, count };
}

/** Anciens identifiants restés sans préfixe : [{ line, id }]. */
export function findBareIds(text, table) {
  const found = [];
  text.split("\n").forEach((content, index) => {
    for (const match of content.matchAll(ID)) {
      if (table.has(match[0])) found.push({ line: index + 1, id: match[0] });
    }
  });
  return found;
}

/** « e2e/evt-06.spec.ts » → « e2e/prd-evt-06.spec.ts » ; null si le nom ne commence pas par un ancien identifiant. */
export function legacyFileName(path, table) {
  const name = basename(path);
  const match = /^([a-z]{3})-(\d{2})(?![0-9])/.exec(name);
  if (!match) return null;
  const renamed = table.get(`${match[1].toUpperCase()}-${match[2]}`);
  if (!renamed) return null;
  const prefix = renamed.slice(0, renamed.indexOf("-") + 1).toLowerCase();
  return join(dirname(path), prefix + name);
}

function main(argv) {
  const table = loadTable();
  const [first, ...rest] = argv;
  if (first === "--name") {
    const renamed = legacyFileName(rest[0] ?? "", table);
    if (renamed) console.log(renamed);
    return 0;
  }
  if (first === "--check") {
    let failures = 0;
    for (const file of rest) {
      for (const { line, id } of findBareIds(readFileSync(file, "utf8"), table)) {
        console.error(`${file}:${line} : ${id} sans préfixe (attendu ${table.get(id)})`);
        failures += 1;
      }
    }
    return failures === 0 ? 0 : 1;
  }
  let total = 0;
  for (const file of argv) {
    const { text, count } = prefixIds(readFileSync(file, "utf8"), table);
    if (count > 0) writeFileSync(file, text);
    total += count;
  }
  console.log(`${total} identifiant(s) préfixé(s) dans ${argv.length} fichier(s)`);
  return 0;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  process.exitCode = main(process.argv.slice(2));
}
