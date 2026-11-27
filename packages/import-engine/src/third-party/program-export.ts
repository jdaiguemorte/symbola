// Lot 63b (CHR-08) — lecture de l'export « programme » du jour J d'un logiciel de planification
// tiers (même logiciel que les fiches d'évènement, ADR 0034). PDF en paysage : un en-tête (titre,
// date, lieux, résumé des invités, tableau des intervenants), puis un tableau Heure · Titre ·
// Description · Interlocuteur · « Caché des mariés », découpé par jour. Les colonnes se repèrent par
// leurs titres et leur position ; les libellés sont des données (@symbola/starter-templates).
// Pièges couverts (docs/audits/2026-11-21-recette-planner.md, § 4 bis) : une fin à 00:00 est
// absente et 00:00 seul n'est pas une heure ; une fin plus tôt que le début passe au lendemain ;
// une ligne sans interlocuteur est un repère ; un interlocuteur sans rôle reste en texte ; un rôle
// en double se départage par le nom (prénom, nom ou raison sociale), la planner est ignorée ;
// « Caché des mariés » est repris ; le résumé des invités est ignoré.
import type { ProgramExportProfile } from "@symbola/starter-templates";
import { decodeHtmlEntities, tidyText } from "../cleanup";
import { neutralizeTexts } from "../neutralize";
import type { PdfPage, PdfTextItem } from "../pdf";

export type ProgramExportSpeaker = { role: string; company: string | null; contact: string | null; phone: string | null };

// « vendor » : un intervenant à rattacher ; « planner » : la planner elle-même (ignorée) ;
// « client » : un marié ou le client (gardé en texte) ; « free » : sans rôle (gardé en texte).
export type ProgramExportContactKind = "vendor" | "planner" | "client" | "free";
export type ProgramExportContact = { text: string; role: string | null; name: string | null; kind: ProgramExportContactKind };

export type ProgramExportRow = {
  // Numéro de la séquence dans le fichier, de 1 à n.
  line: number;
  date: string | null;
  // null : « 00:00 » seul, une tâche sans heure.
  startTime: string | null;
  endTime: string | null;
  endsNextDay: boolean;
  title: string;
  description: string | null;
  contacts: ProgramExportContact[];
  hiddenFromClients: boolean;
  // Aucun interlocuteur : un repère du programme (« Coucher du soleil »), pas une séquence de travail.
  marker: boolean;
};

export type ProgramExport = { title: string | null; eventDate: string | null; speakers: ProgramExportSpeaker[]; rows: ProgramExportRow[] };

// Lot 71a (SEC-21) : `neutralized`, le nombre de textes du fichier neutralisés (=, +, - ou @ en tête).
export type ProgramExportResult = { ok: true; program: ProgramExport; neutralized: number } | { ok: false; reason: "not_program_export" };

type Calendar = { weekdays: readonly string[]; months: readonly string[] };
type Line = { page: number; y: number; x: number; text: string };

const SAME_LINE = 2.5;
const COLUMN_MARGIN = 8;
const PARAGRAPH_GAP = 14;

export const foldProgramText = (value: string) =>
  value
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLocaleLowerCase("fr")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
// « Wedding Planner », « WeddingPlanner », « Wedding-Planner » : un seul rôle.
const roleKey = (value: string) => foldProgramText(value).replace(/\s+/g, "");

// Fragments d'une même ligne et d'une même colonne recollés, de gauche à droite.
function toLines(items: { item: PdfTextItem; page: number }[]): Line[] {
  const sorted = [...items].sort((a, b) => a.page - b.page || a.item.y - b.item.y || a.item.x - b.item.x);
  const groups: { page: number; y: number; items: PdfTextItem[] }[] = [];
  for (const { item, page } of sorted) {
    const group = groups.at(-1);
    if (group && group.page === page && Math.abs(group.y - item.y) <= SAME_LINE) group.items.push(item);
    else groups.push({ page, y: item.y, items: [item] });
  }
  return groups
    .map((group) => {
      const parts = group.items.sort((a, b) => a.x - b.x);
      let text = "";
      let end = -Infinity;
      for (const part of parts) {
        const glue = text === "" || text.endsWith(" ") || part.text.startsWith(" ") || part.x - end < 0.5 ? "" : " ";
        text += glue + part.text;
        end = part.x + part.width;
      }
      return { page: group.page, y: group.y, x: parts[0]!.x, text: tidyText(decodeHtmlEntities(text.replace(/\s+/g, " "))) };
    })
    .filter((line) => line.text.length > 0);
}

const pad = (value: number) => String(value).padStart(2, "0");

export function frenchDate(text: string, calendar: Calendar): string | null {
  const months = calendar.months.map(foldProgramText);
  const match = /(\d{1,2}) (\p{L}+) (\d{4})/u.exec(foldProgramText(text));
  if (!match) return null;
  const month = months.indexOf(match[2] as string);
  const day = Number(match[1]);
  if (month < 0 || day < 1 || day > 31) return null;
  const date = new Date(Date.UTC(Number(match[3]), month, day));
  return date.getUTCDate() === day ? date.toISOString().slice(0, 10) : null;
}

function dayBanner(text: string, calendar: Calendar): string | null {
  const weekdays = calendar.weekdays.map(foldProgramText);
  const folded = foldProgramText(text);
  if (!weekdays.some((weekday) => folded.startsWith(`${weekday} `))) return null;
  return frenchDate(text, calendar);
}

const TIME = /^(\d{1,2}):(\d{2})(?:\s*-\s*(\d{1,2}):(\d{2}))?$/;

function clock(hours: string, minutes: string): string | null {
  const h = Number(hours);
  const m = Number(minutes);
  return h <= 23 && m <= 59 ? `${pad(h)}:${pad(m)}` : null;
}

// Heure d'une séquence : « 13:00 » ou « 12:15 - 13:30 ». Une fin à 00:00 pile est absente ; 00:00 seul
// n'est pas une heure ; une fin plus tôt que le début est le lendemain (« 19:00 - 02:00 »).
export function parseProgramTime(text: string, noTime: string): { startTime: string | null; endTime: string | null; endsNextDay: boolean } | null {
  const match = TIME.exec(text.trim());
  if (!match) return null;
  const start = clock(match[1] as string, match[2] as string);
  if (!start) return null;
  const end = match[3] !== undefined ? clock(match[3], match[4] as string) : null;
  if (match[3] !== undefined && !end) return null;
  if (!end) return { startTime: start === noTime ? null : start, endTime: null, endsNextDay: false };
  if (end === noTime) return { startTime: start, endTime: null, endsNextDay: false };
  return { startTime: start, endTime: end, endsNextDay: end < start };
}

// « Rôle - Nom » ; le rôle peut lui-même contenir le séparateur (« Coiffeur(se) - Maquilleur(se) »),
// d'où les rôles connus (intervenants de l'en-tête, planner, mariés) essayés d'abord, du plus long.
export function parseProgramContact(text: string, knownRoles: readonly string[], profile: ProgramExportProfile): ProgramExportContact {
  const separator = profile.roleSeparator;
  const folded = foldProgramText(text);
  let role: string | null = null;
  let name: string | null = null;
  const roles = [...new Set(knownRoles)].sort((a, b) => b.length - a.length);
  for (const candidate of roles) {
    const key = foldProgramText(candidate);
    if (key && (folded === key || folded.startsWith(`${key} `)) && text.length > candidate.length && text.slice(candidate.length).startsWith(separator)) {
      role = text.slice(0, candidate.length).trim();
      name = text.slice(candidate.length + separator.length).trim() || null;
      break;
    }
  }
  if (role === null) {
    const cut = text.lastIndexOf(separator);
    if (cut > 0) {
      role = text.slice(0, cut).trim();
      name = text.slice(cut + separator.length).trim() || null;
    } else {
      name = text.trim();
    }
  }
  const kind: ProgramExportContactKind =
    role === null
      ? "free"
      : profile.plannerRoles.some((candidate) => roleKey(candidate) === roleKey(role))
        ? "planner"
        : profile.clientRoles.some((candidate) => roleKey(candidate) === roleKey(role))
          ? "client"
          : "vendor";
  return { text, role, name, kind };
}

// Intervenant de l'en-tête désigné par un interlocuteur : même rôle, puis le nom cherché dans le
// prénom, le nom et la raison sociale ; un seul intervenant de ce rôle suffit sans nom reconnu.
export function matchProgramSpeaker(contact: ProgramExportContact, speakers: readonly ProgramExportSpeaker[]): number | null {
  if (contact.kind !== "vendor" || !contact.role) return null;
  const sameRole = speakers.map((speaker, index) => ({ speaker, index })).filter(({ speaker }) => roleKey(speaker.role) === roleKey(contact.role!));
  if (sameRole.length === 0) return null;
  const name = contact.name ? foldProgramText(contact.name) : "";
  if (name) {
    const words = name.split(" ");
    const byName = sameRole.filter(({ speaker }) => {
      const haystack = [speaker.contact, speaker.company].filter((part): part is string => Boolean(part)).map(foldProgramText);
      const tokens = new Set(haystack.flatMap((part) => part.split(" ")));
      return haystack.some((part) => part === name || part.startsWith(`${name} `)) || words.every((word) => tokens.has(word));
    });
    if (byName.length === 1) return byName[0]!.index;
    if (byName.length > 1) return null;
  }
  return sameRole.length === 1 ? sameRole[0]!.index : null;
}

function findHeaderLine(lines: Line[], labels: string[]): { page: number; y: number; xs: number[] } | null {
  const keys = labels.map(foldProgramText);
  for (const line of lines) {
    const sameLine = lines.filter((other) => other.page === line.page && Math.abs(other.y - line.y) <= SAME_LINE);
    const xs = keys.map((key) => sameLine.find((other) => foldProgramText(other.text) === key)?.x ?? null);
    if (xs.every((x): x is number => x !== null)) return { page: line.page, y: line.y, xs };
  }
  return null;
}

// Les lignes d'une colonne lues séparément : un morceau de texte de chaque colonne par ligne.
function itemsOf(pages: PdfPage[], profile: ProgramExportProfile, keep: (item: PdfTextItem, page: number) => boolean) {
  const prefix = foldProgramText(profile.footerPrefix);
  const items: { item: PdfTextItem; page: number }[] = [];
  pages.forEach((page, index) => {
    for (const item of page.items) {
      if (item.size < 2 || foldProgramText(item.text).startsWith(prefix)) continue;
      if (keep(item, index)) items.push({ item, page: index });
    }
  });
  return items;
}

export function parseProgramExport(pages: PdfPage[], profile: ProgramExportProfile, calendar: Calendar): ProgramExportResult {
  // Le titre du tableau : chaque mot est un morceau de texte à part ; on cherche les trois premiers.
  const all = toLines(itemsOf(pages, profile, () => true).map(({ item, page }) => ({ item, page })));
  const wordLines = itemsOf(pages, profile, () => true).map(({ item, page }) => ({ page, y: item.y, x: item.x, text: item.text.trim() }));
  const header = findHeaderLine(wordLines, [profile.columnHeaders.title, profile.columnHeaders.description, profile.columnHeaders.contact]);
  if (!header) return { ok: false, reason: "not_program_export" };
  const [titleX, descriptionX, contactX] = header.xs as [number, number, number];
  const hiddenX =
    wordLines.find((line) => line.page === header.page && line.x > contactX + 40 && Math.abs(line.y - header.y) <= 30 && foldProgramText(line.text) === foldProgramText(profile.columnHeaders.hidden))?.x ??
    Number.POSITIVE_INFINITY;
  const headerTop = Math.min(header.y, ...wordLines.filter((line) => line.page === header.page && line.x >= hiddenX - COLUMN_MARGIN && Math.abs(line.y - header.y) <= 30).map((line) => line.y));

  // En-tête : titre (le plus grand texte de la première page), date, tableau des intervenants.
  const before = all.filter((line) => line.page < header.page || (line.page === header.page && line.y < headerTop - SAME_LINE));
  const firstPage = itemsOf(pages, profile, (_, page) => page === 0).map(({ item }) => item);
  const biggest = firstPage.reduce<PdfTextItem | null>((best, item) => (!best || item.size > best.size ? item : best), null);
  const title = biggest ? tidyText(biggest.text) || null : null;
  const eventDate = before.filter((line) => line.page === 0).map((line) => dayBanner(line.text, calendar)).find((date) => date !== null) ?? null;

  const speakers: ProgramExportSpeaker[] = [];
  const speakerWords = wordLines.filter((line) => line.page < header.page || (line.page === header.page && line.y < headerTop - SAME_LINE));
  const speakerHeader = findHeaderLine(speakerWords, [profile.speakerHeaders.role, profile.speakerHeaders.company, profile.speakerHeaders.contact, profile.speakerHeaders.phone]);
  if (speakerHeader) {
    const [roleX, companyX, speakerContactX, phoneX] = speakerHeader.xs as [number, number, number, number];
    const instagramX = speakerWords.find((line) => line.page === speakerHeader.page && Math.abs(line.y - speakerHeader.y) <= SAME_LINE && foldProgramText(line.text) === foldProgramText(profile.speakerHeaders.instagram))?.x ?? Number.POSITIVE_INFINITY;
    const after = itemsOf(pages, profile, (item, page) =>
      (page > speakerHeader.page || (page === speakerHeader.page && item.y > speakerHeader.y + SAME_LINE)) && (page < header.page || (page === header.page && item.y < headerTop - SAME_LINE)),
    );
    const column = (x: number) => (x < companyX - COLUMN_MARGIN ? "role" : x < speakerContactX - COLUMN_MARGIN ? "company" : x < phoneX - COLUMN_MARGIN ? "contact" : x < instagramX - COLUMN_MARGIN ? "phone" : "instagram");
    const rows = new Map<string, Partial<Record<ReturnType<typeof column>, string>>>();
    for (const line of toLines(after)) {
      // Une ligne regroupe les colonnes : on relit chaque morceau de la ligne à part.
      const parts = after.filter(({ item, page }) => page === line.page && Math.abs(item.y - line.y) <= SAME_LINE);
      const row = rows.get(`${line.page}:${line.y}`) ?? {};
      for (const { item } of parts.sort((a, b) => a.item.x - b.item.x)) {
        if (item.x < roleX - COLUMN_MARGIN) continue;
        const key = column(item.x);
        row[key] = tidyText([row[key], item.text].filter(Boolean).join(" "));
      }
      rows.set(`${line.page}:${line.y}`, row);
    }
    for (const row of rows.values()) {
      // Une ligne sans rôle (contact de plus, personne sans métier) n'est pas un intervenant.
      if (!row.role) continue;
      speakers.push({ role: row.role, company: row.company || null, contact: row.contact || null, phone: row.phone || null });
    }
  }

  // Programme : chaque morceau de texte rangé dans sa colonne, puis rattaché à l'heure qui le précède.
  const program = itemsOf(pages, profile, (item, page) => page > header.page || (page === header.page && item.y > header.y + SAME_LINE));
  const columnOf = (x: number) =>
    x < titleX - COLUMN_MARGIN ? "time" : x < descriptionX - COLUMN_MARGIN ? "title" : x < contactX - COLUMN_MARGIN - 4 ? "description" : x < hiddenX - COLUMN_MARGIN ? "contact" : "hidden";
  const byColumn: Record<ReturnType<typeof columnOf>, { item: PdfTextItem; page: number }[]> = { time: [], title: [], description: [], contact: [], hidden: [] };
  for (const entry of program) byColumn[columnOf(entry.item.x)].push(entry);
  const position = (line: Line) => line.page * 100_000 + line.y;

  type Anchor = { position: number; kind: "day"; date: string } | { position: number; kind: "row"; time: NonNullable<ReturnType<typeof parseProgramTime>> };
  const anchors: Anchor[] = [];
  for (const line of toLines(byColumn.time)) {
    const date = dayBanner(line.text, calendar);
    if (date) {
      anchors.push({ position: position(line), kind: "day", date });
      continue;
    }
    const time = parseProgramTime(line.text, profile.noTime);
    if (time) anchors.push({ position: position(line), kind: "row", time });
  }
  if (!anchors.some((anchor) => anchor.kind === "row")) return { ok: false, reason: "not_program_export" };

  const owner = (line: Line): number => {
    let found = -1;
    anchors.forEach((anchor, index) => {
      if (anchor.position <= position(line) + SAME_LINE) found = index;
    });
    return found;
  };
  const cells = new Map<number, { title: Line[]; description: Line[]; contact: Line[]; hidden: Line[] }>();
  for (const key of ["title", "description", "contact", "hidden"] as const) {
    for (const line of toLines(byColumn[key])) {
      const index = owner(line);
      if (index < 0 || anchors[index]!.kind !== "row") continue;
      const cell = cells.get(index) ?? { title: [], description: [], contact: [], hidden: [] };
      cell[key].push(line);
      cells.set(index, cell);
    }
  }

  const knownRoles = [...speakers.map((speaker) => speaker.role), ...profile.plannerRoles, ...profile.clientRoles];
  const yes = new Set(profile.hiddenYes.map(foldProgramText));
  const rows: ProgramExportRow[] = [];
  let date: string | null = eventDate;
  anchors.forEach((anchor, index) => {
    if (anchor.kind === "day") {
      date = anchor.date;
      return;
    }
    const cell = cells.get(index) ?? { title: [], description: [], contact: [], hidden: [] };
    const description: string[] = [];
    cell.description.forEach((line, position) => {
      const previous = cell.description[position - 1];
      if (previous && previous.page === line.page && line.y - previous.y > PARAGRAPH_GAP) description.push("");
      description.push(line.text);
    });
    const contacts = cell.contact.map((line) => parseProgramContact(line.text, knownRoles, profile));
    rows.push({
      line: rows.length + 1,
      date,
      ...anchor.time,
      title: tidyText(cell.title.map((line) => line.text).join(" ")),
      description: description.length > 0 ? description.join("\n") : null,
      contacts,
      hiddenFromClients: cell.hidden.some((line) => yes.has(foldProgramText(line.text))),
      marker: contacts.length === 0,
    });
  });
  // Lot 71a (SEC-21) : chaque texte lu passe par la neutralisation des cellules avant d'être gardé.
  const safe = neutralizeTexts({ title, eventDate, speakers, rows });
  return { ok: true, program: safe.value, neutralized: safe.neutralized };
}
