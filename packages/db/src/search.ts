// Lot 10 (AIDE-08) — recherche insensible aux accents et à la casse, sans
// extension PostgreSQL : le terme est replié en JS, la colonne par
// translate() + lower() côté base. Les jokers % et _ du terme sont échappés.
import { sql, type SQL, type SQLWrapper } from "drizzle-orm";

const ACCENTED = "ÀÁÂÃÄÅàáâãäåÇçÈÉÊËèéêëÌÍÎÏìíîïÑñÒÓÔÕÖòóôõöÙÚÛÜùúûüÝýÿŒœÆæ";
const PLAIN = "AAAAAAaaaaaaCcEEEEeeeeIIIIiiiiNnOOOOOoooooUUUUuuuuYyyOoAa";

export function foldSearchText(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[œ]/g, "o")
    .replace(/[æ]/g, "a");
}

// Mots du terme (au moins 2 caractères au total), repliés ; au plus 5.
export function searchWords(term: string): string[] {
  const folded = foldSearchText(term).trim();
  if (folded.length < 2) return [];
  return folded.split(/\s+/).filter(Boolean).slice(0, 5);
}

export function foldedColumn(column: SQLWrapper | SQL): SQL {
  return sql`lower(translate(coalesce(${column}, ''), ${ACCENTED}, ${PLAIN}))`;
}

export function likeWord(word: string): string {
  return `%${word.replace(/[\\%_]/g, (character) => `\\${character}`)}%`;
}

/** Vrai si la colonne repliée contient le mot replié. */
export function foldedContains(column: SQLWrapper | SQL, word: string): SQL {
  return sql`${foldedColumn(column)} like ${likeWord(word)}`;
}
