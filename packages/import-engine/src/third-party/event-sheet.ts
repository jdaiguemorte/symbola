// Lot 14 (IMP-08, ADR 0034) — lecture d'une fiche événement PDF exportée
// par un logiciel de planification tiers. La fiche est disposée sur deux
// colonnes (les deux mariés côte à côte, deux lieux par rangée) : on
// regroupe les morceaux de texte par ligne et par colonne d'après leur
// position, puis on lit les blocs repérés par les libellés du profile
// (données de @symbola/starter-templates, jamais en dur ici).
import type { EventSheetProfile } from "@symbola/starter-templates";
import { decodeHtmlEntities, splitPhones, tidyText, type PhoneEntry } from "../cleanup";
import type { PdfPage, PdfTextItem } from "../pdf";
import { parseAmountCents } from "../values";

export type EventSheetPerson = {
  firstName: string;
  lastName: string | null;
  email: string | null;
  addressLine: string | null;
  postalCode: string | null;
  city: string | null;
};

export type EventSheetPlace = { label: string; date: string | null; time: string | null };

export type EventSheet = {
  people: EventSheetPerson[];
  phones: PhoneEntry[];
  eventDate: string | null;
  places: EventSheetPlace[];
  note: string | null;
  budget: { wantedCents: number | null; paidCents: number | null; balanceCents: number | null; totalCents: number | null };
};

export type EventSheetResult = { ok: true; sheet: EventSheet } | { ok: false; reason: "not_event_sheet" };

// Un morceau de texte d'une ligne, après regroupement des fragments voisins.
type Run = { text: string; x: number; y: number; end: number };

const SAME_LINE = 2.5;
const SAME_RUN_GAP = 14;

const fold = (value: string) => value.normalize("NFC").replace(/\s+/g, " ").trim().toLocaleLowerCase("fr");

// Regroupe les fragments d'une même ligne qui se suivent (« Lieu » + « - samedi… »).
export function toRuns(items: PdfTextItem[]): Run[] {
  // D'abord les lignes (à quelques dixièmes de point près), puis de gauche à droite.
  const lines: PdfTextItem[][] = [];
  for (const item of [...items].sort((a, b) => a.y - b.y)) {
    const line = lines.at(-1);
    if (line && Math.abs((line[0] as PdfTextItem).y - item.y) <= SAME_LINE) line.push(item);
    else lines.push([item]);
  }
  const runs: Run[] = [];
  for (const line of lines) {
    let previous: Run | null = null;
    for (const item of line.sort((a, b) => a.x - b.x)) {
      const text = item.text.replace(/\s+/g, " ");
      if (previous && item.x - previous.end <= SAME_RUN_GAP) {
        const glue = previous.text.endsWith(" ") || text.startsWith(" ") || item.x - previous.end < 0.5 ? "" : " ";
        previous.text += glue + text;
        previous.end = Math.max(previous.end, item.x + item.width);
        continue;
      }
      previous = { text, x: item.x, y: item.y, end: item.x + item.width };
      runs.push(previous);
    }
  }
  return runs.map((run) => ({ ...run, text: tidyText(decodeHtmlEntities(run.text)) })).filter((run) => run.text.length > 0);
}

// Deux colonnes : coupure au milieu du plus grand écart entre les débuts de ligne.
function splitColumns(runs: Run[]): Run[][] {
  const starts = [...new Set(runs.map((run) => Math.round(run.x)))].sort((a, b) => a - b);
  let cut: number | null = null;
  let widest = 0;
  for (let index = 1; index < starts.length; index += 1) {
    const gap = (starts[index] as number) - (starts[index - 1] as number);
    if (gap > widest) {
      widest = gap;
      cut = ((starts[index] as number) + (starts[index - 1] as number)) / 2;
    }
  }
  if (cut === null || widest < 80) return [runs];
  return [runs.filter((run) => run.x < cut!), runs.filter((run) => run.x >= cut!)];
}

function afterLabel(text: string, label: string): string | null {
  const folded = fold(text);
  const key = fold(label);
  if (!folded.startsWith(key)) return null;
  return text.slice(text.length - (folded.length - key.length)).replace(/^\s*:?\s*/, "").trim();
}

// « Léa MARTIN », « Inès DUPONT-MOREAU » : le nom est en capitales, à la fin.
export function splitPersonName(value: string): { firstName: string; lastName: string | null } {
  const tokens = value.trim().split(/\s+/);
  let index = tokens.length;
  while (index > 0) {
    const token = tokens[index - 1] as string;
    const letters = token.replace(/[^\p{L}]/gu, "");
    if (letters.length < 2 || letters !== letters.toLocaleUpperCase("fr")) break;
    index -= 1;
  }
  if (index === 0 || index === tokens.length) return { firstName: value.trim(), lastName: null };
  return { firstName: tokens.slice(0, index).join(" "), lastName: tokens.slice(index).join(" ") };
}

function frenchDate(text: string, profile: EventSheetProfile): string | null {
  const months = profile.months.map(fold);
  const match = /(\d{1,2})\s+([\p{L}]+)\s+(\d{4})/u.exec(fold(text));
  if (!match) return null;
  const month = months.indexOf(match[2] as string);
  const day = Number(match[1]);
  if (month < 0 || day < 1 || day > 31) return null;
  const date = new Date(Date.UTC(Number(match[3]), month, day));
  if (date.getUTCDate() !== day) return null;
  return date.toISOString().slice(0, 10);
}

function placePattern(profile: EventSheetProfile): RegExp {
  const weekdays = profile.weekdays.join("|");
  const months = profile.months.join("|");
  const at = profile.placeTimeSeparator;
  return new RegExp(`^(.+?)\\s+-\\s+((?:${weekdays})\\s+\\d{1,2}\\s+(?:${months})\\s+\\d{4})(?:\\s+${at}\\s+(\\d{1,2}):(\\d{2}))?$`, "iu");
}

export function parseEventSheet(page: PdfPage, profile: EventSheetProfile): EventSheetResult {
  const footerFrom = page.height * profile.footerFromRatio;
  const runs = toRuns(page.items.filter((item) => item.size >= 2 && item.y < footerFrom));
  const find = (label: string) => runs.find((run) => afterLabel(run.text, label) !== null);
  const dateRun = find(profile.dateLabel);
  const placesHeading = find(profile.placesHeading);
  const budgetHeading = find(profile.budgetHeading);
  if (!dateRun || (!placesHeading && !budgetHeading)) return { ok: false, reason: "not_event_sheet" };

  const eventDate = frenchDate(afterLabel(dateRun.text, profile.dateLabel) ?? "", profile);
  const peopleEnd = placesHeading?.y ?? budgetHeading?.y ?? page.height;

  // Mariés : une colonne chacun ; « Téléphones » s'applique à l'événement.
  const peopleRuns = runs.filter((run) => run.y > dateRun.y + SAME_LINE && run.y < peopleEnd - SAME_LINE);
  const phonesRun = peopleRuns.find((run) => afterLabel(run.text, profile.phonesPrefix) !== null);
  const phones = phonesRun ? splitPhones(afterLabel(phonesRun.text, profile.phonesPrefix) ?? "") : [];
  const people: EventSheetPerson[] = [];
  for (const column of splitColumns(peopleRuns.filter((run) => run !== phonesRun))) {
    const lines = [...column].sort((a, b) => a.y - b.y);
    const person: EventSheetPerson = { firstName: "", lastName: null, email: null, addressLine: null, postalCode: null, city: null };
    for (const line of lines) {
      const email = afterLabel(line.text, profile.emailPrefix);
      const address = afterLabel(line.text, profile.addressPrefix);
      const cityLine = /^(\d{5})\s+(.+)$/.exec(line.text);
      if (email !== null) person.email = email || null;
      else if (address !== null) person.addressLine = address || null;
      else if (cityLine && person.firstName) {
        person.postalCode = cityLine[1] as string;
        person.city = cityLine[2] as string;
      } else if (!person.firstName) Object.assign(person, splitPersonName(line.text));
    }
    if (person.firstName) people.push(person);
  }

  // Lieux : deux par rangée, un lieu peut passer à la ligne ; ce qui reste est une note.
  const pattern = placePattern(profile);
  const placesEnd = budgetHeading?.y ?? page.height;
  const placeRuns = placesHeading ? runs.filter((run) => run.y > placesHeading.y + SAME_LINE && run.y < placesEnd - SAME_LINE) : [];
  const places: (EventSheetPlace & { y: number; x: number })[] = [];
  const leftovers: { text: string; y: number }[] = [];
  for (const column of splitColumns(placeRuns)) {
    let buffer: { text: string; y: number; x: number } | null = null;
    for (const line of [...column].sort((a, b) => a.y - b.y)) {
      const candidate: { text: string; y: number; x: number } = buffer ? { ...buffer, text: `${buffer.text} ${line.text}` } : { text: line.text, y: line.y, x: line.x };
      const match = pattern.exec(candidate.text);
      if (match && match[3] !== undefined) {
        places.push({
          label: (match[1] as string).trim(),
          date: frenchDate(match[2] as string, profile),
          time: `${(match[3] as string).padStart(2, "0")}:${match[4] as string}`,
          y: candidate.y,
          x: candidate.x,
        });
        buffer = null;
      } else if (/\s-\s/.test(candidate.text) || buffer) {
        // Lieu en cours (la suite est sur la ligne suivante).
        buffer = candidate;
      } else {
        leftovers.push({ text: candidate.text, y: candidate.y });
      }
    }
    if (buffer) {
      const match = pattern.exec(buffer.text);
      if (match) places.push({ label: (match[1] as string).trim(), date: frenchDate(match[2] as string, profile), time: null, y: buffer.y, x: buffer.x });
      else leftovers.push({ text: buffer.text, y: buffer.y });
    }
  }
  places.sort((a, b) => a.y - b.y || a.x - b.x);

  // Budget : « Libellé : montant € », montants à point décimal.
  const budgetRuns = budgetHeading ? runs.filter((run) => run.y > budgetHeading.y + SAME_LINE) : [];
  const amount = (label: string): number | null => {
    for (const run of budgetRuns) {
      const [name, value] = run.text.split(/\s:\s/, 2);
      if (value !== undefined && fold(name as string) === fold(label)) return parseAmountCents(value.replace(/€/g, "").trim(), "dot");
    }
    return null;
  };

  return {
    ok: true,
    sheet: {
      people,
      phones,
      eventDate,
      places: places.map(({ label, date, time }) => ({ label, date, time })),
      note: leftovers.length > 0 ? leftovers.sort((a, b) => a.y - b.y).map((item) => item.text).join("\n") : null,
      budget: {
        wantedCents: amount(profile.budgetLabels.wanted),
        paidCents: amount(profile.budgetLabels.paid),
        balanceCents: amount(profile.budgetLabels.balance),
        totalCents: amount(profile.budgetLabels.total),
      },
    },
  };
}
