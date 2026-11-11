// Lot 24b (SEC-03, décisions Q22 et D2, ADR 0063) — règle des mots de passe :
// douze caractères au moins, aucune règle de composition, et refus d'un mot de
// passe connu comme compromis. La liste est celle des mots de passe les plus
// répandus dans les fuites publiées (@zxcvbn-ts/language-common), contrôlée
// hors ligne : aucun mot de passe ne quitte le serveur.
//
// La liste ne compte que 308 mots de passe de douze caractères ou plus : le
// contrôle compare donc aussi la base du mot de passe (minuscules, sans les
// chiffres et symboles collés au début ou à la fin, sans les substitutions
// courantes comme @ pour a ou 0 pour o, sans répétition). « Password1234! »,
// « p@ssw0rd2027 » ou « azertyazerty » sont refusés.
import { dictionary } from "@zxcvbn-ts/language-common";

export const PASSWORD_MIN_LENGTH = 12;

export type PasswordVerdict = "ok" | "too_short" | "compromised";

// Une base plus courte n'est pas comparée : trop de mots de trois lettres
// figurent dans la liste.
const MIN_BASE_LENGTH = 4;

const SUBSTITUTIONS: Record<string, string> = { "@": "a", "4": "a", "0": "o", "1": "i", "!": "i", "3": "e", "5": "s", $: "s", "7": "t", "9": "g" };

let common: Set<string> | null = null;

function commonPasswords(): Set<string> {
  common ??= new Set(dictionary["passwords-common"].map((password) => password.toLowerCase()));
  return common;
}

function withoutSubstitutions(value: string): string {
  return [...value].map((character) => SUBSTITUTIONS[character] ?? character).join("");
}

// Lettres seules en bordure : « mariée2027 » garde son « é ».
function trimmed(value: string): string {
  return value.replace(/^[^\p{L}]+|[^\p{L}]+$/gu, "");
}

function candidates(password: string): string[] {
  const lower = password.normalize("NFKC").toLowerCase();
  const values = new Set([lower, trimmed(lower), withoutSubstitutions(lower), trimmed(withoutSubstitutions(lower)), withoutSubstitutions(trimmed(lower))]);
  for (const value of [...values]) {
    const repeated = /^(.{3,}?)\1+$/u.exec(value);
    if (repeated) values.add(repeated[1]!);
  }
  return [...values].filter((value) => [...value].length >= MIN_BASE_LENGTH);
}

export function isCompromisedPassword(password: string): boolean {
  const list = commonPasswords();
  return candidates(password).some((candidate) => list.has(candidate));
}

export function checkPassword(password: string): PasswordVerdict {
  if ([...password].length < PASSWORD_MIN_LENGTH) return "too_short";
  return isCompromisedPassword(password) ? "compromised" : "ok";
}
