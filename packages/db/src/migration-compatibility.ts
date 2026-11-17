// Lot 40a (ARC-14, décision D5, ADR 0075) — une migration laisse tourner la version précédente
// du code : c'est ce qui permet le retour arrière en une commande (rollback.sh remet l'image
// précédente sans toucher au schéma) et un déploiement sans arrêt.
//
// Règle : une migration n'ajoute que des tables, des colonnes facultatives (ou avec une valeur
// par défaut), des index, des contraintes et des valeurs. Un changement que l'ancien code ne
// sait pas lire (suppression, renommage, changement de type, colonne rendue obligatoire) porte le
// marqueur `-- symbola: arret-requis <raison>` et un paragraphe de docs/runbooks/deploiement.md :
// deploy.sh arrête alors l'app le temps de la migration.
//
// Le contrôle lit le texte des migrations : il attrape les cas connus, pas tout (une mise à
// jour de données que l'ancien code ne comprend plus reste à signaler par son auteur).

export type JournalEntry = { idx: number; tag: string; when: number };

// Migrations livrées avant la règle (0000 à 0148) : reconnues telles quelles par le contrôle de
// la CI. Celles où le détecteur trouve un changement cassant (douze, dont 0132, 0133 et 0135,
// les trois que le runbook signalait) demandent l'arrêt de l'app quand elles restent à appliquer :
// c'est le cas du déploiement d'ensemble, parti de l'image du lot 22.
export const LAST_MIGRATION_BEFORE_RULE = 148;

const STOP_MARKER = /^[ \t]*--[ \t]*symbola:[ \t]*arret-requis[ \t]+(\S[^\n]*)$/m;

const IDENTIFIER = String.raw`(?:"[^"]+"|[a-z_][a-z0-9_$]*)`;
const QUALIFIED = String.raw`${IDENTIFIER}(?:\s*\.\s*${IDENTIFIER})?`;

const BREAKING_PATTERNS: readonly { change: string; pattern: RegExp }[] = [
  { change: "suppression de colonne", pattern: /\bdrop\s+column\b/i },
  { change: "renommage", pattern: /\brename\s+(?:column\s+|constraint\s+)?(?:(?:"[^"]+"|[a-z_][a-z0-9_$]*)\s+)?to\b|\brename\s+value\b/i },
  { change: "changement de type", pattern: /\balter\s+column\s+\S+\s+(?:set\s+data\s+)?type\b/i },
  { change: "colonne rendue obligatoire", pattern: /\balter\s+column\s+\S+\s+set\s+not\s+null\b/i },
  { change: "suppression de type", pattern: /\bdrop\s+type\b/i },
  { change: "suppression de schéma", pattern: /\bdrop\s+schema\b/i },
];

// Retire les commentaires SQL (-- … et /* … */), en gardant les chaînes entre apostrophes.
export function stripSqlComments(sql: string): string {
  let result = "";
  let index = 0;
  while (index < sql.length) {
    const char = sql[index];
    const next = sql[index + 1];
    if (char === "'") {
      const end = sql.indexOf("'", index + 1);
      const stop = end === -1 ? sql.length : end + 1;
      result += sql.slice(index, stop);
      index = stop;
    } else if (char === "-" && next === "-") {
      const end = sql.indexOf("\n", index);
      index = end === -1 ? sql.length : end;
    } else if (char === "/" && next === "*") {
      const end = sql.indexOf("*/", index + 2);
      index = end === -1 ? sql.length : end + 2;
    } else {
      result += char;
      index += 1;
    }
  }
  return result;
}

function tablesCreatedIn(sql: string): Set<string> {
  const created = new Set<string>();
  const pattern = new RegExp(String.raw`\bcreate\s+(?:temp(?:orary)?\s+|unlogged\s+)?table\s+(?:if\s+not\s+exists\s+)?(${QUALIFIED})`, "gi");
  for (const match of sql.matchAll(pattern)) created.add(normalize(match[1] ?? ""));
  return created;
}

function normalize(name: string): string {
  return name.replace(/\s+/g, "").replaceAll('"', "").toLowerCase();
}

// Changements que l'ancien code ne sait pas lire, dans l'ordre du fichier (sans doublon).
export function breakingChanges(sql: string): string[] {
  const statements = stripSqlComments(sql);
  const found = new Set<string>();
  for (const { change, pattern } of BREAKING_PATTERNS) {
    if (pattern.test(statements)) found.add(change);
  }
  // Une table créée par la même migration (table de travail) peut être supprimée sans risque.
  const created = tablesCreatedIn(statements);
  const dropTable = new RegExp(String.raw`\bdrop\s+table\s+(?:if\s+exists\s+)?(${QUALIFIED}(?:\s*,\s*${QUALIFIED})*)`, "gi");
  for (const match of statements.matchAll(dropTable)) {
    const names = (match[1] ?? "").split(",").map(normalize);
    if (names.some((name) => !created.has(name))) found.add("suppression de table");
  }
  // Colonne ajoutée obligatoire sans valeur par défaut : l'ancien code n'y écrit rien.
  const addColumn = new RegExp(String.raw`\badd\s+column\s+(?:if\s+not\s+exists\s+)?${IDENTIFIER}\s+([^;,]*)`, "gi");
  for (const match of statements.matchAll(addColumn)) {
    const definition = match[1] ?? "";
    if (/\bnot\s+null\b/i.test(definition) && !/\bdefault\b/i.test(definition) && !/\bgenerated\b/i.test(definition)) {
      found.add("colonne obligatoire ajoutée sans valeur par défaut");
    }
  }
  return [...found];
}

// Raison donnée par le marqueur `-- symbola: arret-requis <raison>`, ou null.
export function stopReason(sql: string): string | null {
  const match = STOP_MARKER.exec(sql);
  return match?.[1]?.trim() || null;
}

export function requiresStop(entry: Pick<JournalEntry, "idx">, sql: string): boolean {
  if (stopReason(sql) !== null) return true;
  return entry.idx <= LAST_MIGRATION_BEFORE_RULE && breakingChanges(sql).length > 0;
}

// Migrations du journal pas encore appliquées : Drizzle applique celles dont la date (`when`)
// dépasse celle de la dernière appliquée (drizzle.__drizzle_migrations.created_at).
export function pendingEntries(entries: readonly JournalEntry[], lastAppliedWhen: number | null): JournalEntry[] {
  return entries.filter((entry) => lastAppliedWhen === null || entry.when > lastAppliedWhen).sort((a, b) => a.idx - b.idx);
}
