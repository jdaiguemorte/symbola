// Lot 40a (JUR-18, décision D8, ADR 0075) — inventaire des licences des bibliothèques (pnpm
// licenses list, sans dépendance nouvelle) et des services (images Docker du Compose et des
// scripts d'exploitation). Une licence permissive passe ; une licence à copyleft doit avoir sa
// ligne justifiée dans autorisees.json ; une licence inconnue est refusée. Ces fonctions
// décrivent des faits (licence, usage) et ne tranchent aucun point juridique.
import { spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

export const repoRoot = resolve(import.meta.dirname, "..", "..");

// Licences permissives (mention de l'auteur et du texte de la licence, sans autre obligation).
// CC-BY-4.0 : données de caniuse-lite, attribution demandée. Python-2.0 : licence de la PSF.
// Lot 41 : OFL-1.1, licence des polices, qui permet de les incorporer dans un document.
export const PERMISSIVE = new Set(["MIT", "MIT-0", "ISC", "BSD-2-Clause", "BSD-3-Clause", "Apache-2.0", "0BSD", "Unlicense", "BlueOak-1.0.0", "CC0-1.0", "CC-BY-4.0", "Python-2.0", "PostgreSQL", "Zlib", "OFL-1.1"]);
const COPYLEFT = /^(?:AGPL|GPL|LGPL|MPL|EPL|CDDL|EUPL|OSL|CPAL|SSPL)-/;

function classifyOne(licence) {
  if (PERMISSIVE.has(licence)) return "permissive";
  if (COPYLEFT.test(licence)) return "copyleft";
  return "inconnue";
}

// Classe une expression SPDX simple : « A OR B » prend la plus libre, « A AND B » la plus stricte.
export function classify(expression) {
  const text = String(expression ?? "").replace(/[()]/g, " ").trim();
  if (!text) return "inconnue";
  if (/\sOR\s/.test(text)) {
    const kinds = text.split(/\s+OR\s+/).map((part) => classify(part));
    if (kinds.includes("permissive")) return "permissive";
    return kinds.includes("copyleft") ? "copyleft" : "inconnue";
  }
  if (/\sAND\s/.test(text)) {
    const kinds = text.split(/\s+AND\s+/).map((part) => classify(part));
    if (kinds.includes("inconnue")) return "inconnue";
    return kinds.includes("copyleft") ? "copyleft" : "permissive";
  }
  return classifyOne(text.trim());
}

// Paquets propres à une plateforme (lightningcss-darwin-arm64, @img/sharp-libvips-linux-x64…) :
// une seule entrée, la même sur le Mac et en CI.
export function normalizeName(name) {
  return name.replace(/([-/])(?:darwin|linux|linuxmusl|win32|freebsd|openbsd|netbsd|android|sunos|aix)(?:-[a-z0-9]+)*$/, "$1<plateforme>");
}

function pnpmLicences(prod) {
  const args = ["licenses", "list", "--json", ...(prod ? ["--prod"] : [])];
  const result = spawnSync("pnpm", args, { cwd: repoRoot, encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });
  if (result.status !== 0) throw new Error(`pnpm ${args.join(" ")} : ${result.stderr || result.stdout}`);
  const byName = new Map();
  for (const [licence, entries] of Object.entries(JSON.parse(result.stdout))) {
    for (const entry of entries) {
      const name = normalizeName(entry.name);
      byName.set(name, { name, licence: entry.license ?? licence });
    }
  }
  return byName;
}

// Bibliothèques installées, avec leur portée : « production » (dépendances de l'app livrée) ou
// « développement » (outils de construction et de test).
export function listPackages() {
  const all = pnpmLicences(false);
  const production = pnpmLicences(true);
  return [...all.values()]
    .map((entry) => ({ ...entry, portee: production.has(entry.name) ? "production" : "développement" }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

export function loadJson(file) {
  return JSON.parse(readFileSync(resolve(import.meta.dirname, file), "utf8"));
}

// Problèmes de l'inventaire : licence inconnue, copyleft sans ligne justifiée (ou d'une autre
// licence), ligne justifiée qui ne correspond plus à aucun paquet.
export function checkLicences(packages, allowed) {
  const problems = [];
  for (const entry of packages) {
    const kind = classify(entry.licence);
    if (kind === "inconnue") problems.push(`${entry.name} : licence inconnue (« ${entry.licence} »)`);
    if (kind !== "copyleft") continue;
    const line = allowed.find((candidate) => candidate.paquet === entry.name);
    if (!line) problems.push(`${entry.name} : licence ${entry.licence} à copyleft, sans ligne justifiée dans tools/licences/autorisees.json`);
    else if (line.licence !== entry.licence) problems.push(`${entry.name} : licence ${entry.licence}, mais ${line.licence} dans autorisees.json`);
  }
  for (const line of allowed) {
    if (!packages.some((entry) => entry.name === line.paquet)) problems.push(`${line.paquet} : dans autorisees.json, mais plus installé`);
  }
  return problems;
}

const OWN_IMAGE = /^ghcr\.io\/\$\{GITHUB_REPOSITORY/;

function imageName(reference) {
  const slash = reference.lastIndexOf("/");
  const colon = reference.indexOf(":", slash + 1);
  return colon === -1 ? reference : reference.slice(0, colon);
}

// Images des services : Compose de production et du socle, et images des scripts
// d'exploitation (restic, node). L'image de Symbola n'en fait pas partie.
export function listServiceImages() {
  const images = new Set();
  for (const file of ["infra/compose/docker-compose.prod.yml", "infra/compose/docker-compose.socle.yml"]) {
    for (const match of readFileSync(resolve(repoRoot, file), "utf8").matchAll(/^\s+image:\s*(\S+)/gm)) {
      if (!OWN_IMAGE.test(match[1])) images.add(imageName(match[1]));
    }
  }
  const scripts = [
    ["infra/backup/lib.sh", /RESTIC_IMAGE="\$\{RESTIC_IMAGE:-([^}]+)\}"/],
    ["infra/server/deploy-lib.sh", /NODE_IMAGE="\$\{NODE_IMAGE:-([^}]+)\}"/],
  ];
  for (const [file, pattern] of scripts) {
    const match = pattern.exec(readFileSync(resolve(repoRoot, file), "utf8"));
    if (!match) throw new Error(`image introuvable dans ${file}`);
    images.add(imageName(match[1]));
  }
  return [...images].sort();
}

export function checkServices(images, services) {
  const problems = [];
  for (const image of images) {
    const line = services.find((candidate) => candidate.image === image);
    if (!line) problems.push(`${image} : service sans ligne dans tools/licences/services.json`);
    else if (classify(line.licence) === "inconnue") problems.push(`${image} : licence inconnue (« ${line.licence} »)`);
  }
  for (const line of services) {
    if (!images.includes(line.image)) problems.push(`${line.image} : dans services.json, mais plus employé`);
  }
  return problems;
}

// Lot 41 (ADR 0080, 0081) — fichiers tiers rangés dans le dépôt (polices) et outils de la seule CI
// (validateurs) : chaque ligne a sa licence connue (ou « écrit par Symbola ») et son chemin existe.
export function checkFiles(files) {
  const problems = [];
  for (const line of files) {
    const own = String(line.licence).startsWith("aucune");
    if (!own && classify(line.licence) === "inconnue" && !/GPL-2\.0-with-classpath-exception/.test(line.licence)) problems.push(`${line.nom} : licence inconnue (« ${line.licence} »)`);
    if (line.chemin && !existsSync(resolve(repoRoot, line.chemin))) problems.push(`${line.nom} : ${line.chemin} introuvable`);
  }
  return problems;
}
