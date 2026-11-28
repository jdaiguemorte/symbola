// Lot 71e (HUB-14, UX-17 ; spécification du lot 71, § 5.5, R10 ; maquette 10, C-62) — le fichier
// désigne-t-il le couple de la fiche ? On compare des personnes, prénom et nom, sans tenir compte des
// accents ni de la casse ; il suffit qu'un des deux mariés concorde pour ne rien demander. Un nom seul
// (« Martin ») ne suffit pas : Léa Martin n'est pas Clémence Martin. Rien n'est demandé quand la fiche
// n'a pas de mariés ou que le fichier n'en nomme pas.

export type CouplePerson = { firstName: string | null; lastName: string | null };

// « same » : un marié concorde ; « different » : aucun ; « unknown » : rien à comparer.
export type CoupleCheck = "same" | "different" | "unknown";

const fold = (value: string | null | undefined): string =>
  (value ?? "")
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLocaleLowerCase("fr")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();

// Un mot écrit tout en capitales (« MARTIN », « LE GOFF ») est un nom de famille.
const isUpper = (word: string) => /\p{L}/u.test(word) && word === word.toLocaleUpperCase("fr") && word !== word.toLocaleLowerCase("fr");

// « Clémence MARTIN », « MARTIN Clémence », « Jean-Pierre Le Goff » : le prénom et le nom d'un nom écrit
// d'un seul tenant. Les mots en capitales font le nom ; sinon le premier mot est le prénom.
export function personFromFullName(text: string): CouplePerson {
  const words = text.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return { firstName: null, lastName: null };
  if (words.length === 1) return isUpper(words[0]!) ? { firstName: null, lastName: words[0]! } : { firstName: words[0]!, lastName: null };
  const upper = words.filter(isUpper);
  if (upper.length > 0 && upper.length < words.length) {
    return { firstName: words.filter((word) => !isUpper(word)).join(" "), lastName: upper.join(" ") };
  }
  return { firstName: words[0]!, lastName: words.slice(1).join(" ") };
}

function concords(file: CouplePerson, event: CouplePerson): boolean {
  const [fileFirst, fileLast, eventFirst, eventLast] = [fold(file.firstName), fold(file.lastName), fold(event.firstName), fold(event.lastName)];
  const direct = fileFirst !== "" && fileFirst === eventFirst && (fileLast === "" || eventLast === "" || fileLast === eventLast);
  // Prénom et nom inversés dans le fichier (« MARTIN Léa » lu sans capitales).
  const swapped = fileFirst !== "" && fileLast !== "" && fileFirst === eventLast && fileLast === eventFirst;
  // Un nom composé sans capitales (« Jean Pierre Le Goff ») : le nom entier, mot pour mot.
  const whole = fileFirst !== "" && fileLast !== "" && eventFirst !== "" && eventLast !== "" && `${fileFirst} ${fileLast}` === `${eventFirst} ${eventLast}`;
  return direct || swapped || whole;
}

export function sameCouple(file: readonly CouplePerson[], event: readonly CouplePerson[]): CoupleCheck {
  const named = (person: CouplePerson) => fold(person.firstName) !== "" || fold(person.lastName) !== "";
  const fileNamed = file.filter(named);
  const eventNamed = event.filter((person) => fold(person.firstName) !== "");
  if (fileNamed.length === 0 || eventNamed.length === 0) return "unknown";
  return fileNamed.some((person) => eventNamed.some((married) => concords(person, married))) ? "same" : "different";
}
