// Lot 67e (HUB-14, PRE-02 ; recette du 24/11/2026, R07) — export « prestataires d'un évènement » du
// logiciel de planification tiers, en PDF : la date de l'évènement et ses clients en tête, puis une
// ligne par prestataire retenu (type, nom, contact, e-mail, téléphone, Instagram). Reconnu par son
// titre et les titres de ses colonnes (données du profil, @symbola/starter-templates) ; chaque
// cellule est un morceau de texte aligné sur le début de sa colonne, si bien qu'une cellule vide ne
// décale pas la ligne et que le pied de page (mentions légales, pagination) n'est jamais une ligne.
import type { EventVendorsExportProfile } from "@symbola/starter-templates";
import { decodeHtmlEntities, tidyText } from "../cleanup";
import type { PdfPage, PdfTextItem } from "../pdf";
import { foldProgramText, frenchDate } from "./program-export";

export type EventVendorsExportRow = {
  // Rang dans le fichier, à partir de 1.
  line: number;
  type: string;
  name: string;
  contact: string | null;
  email: string | null;
  phone: string | null;
  instagram: string | null;
  // La ligne de la planner elle-même (son rôle), à écarter de la reprise.
  planner: boolean;
};

export type EventVendorsExport = { eventDate: string | null; clients: string[]; rows: EventVendorsExportRow[] };

export type EventVendorsExportResult = { ok: true; export: EventVendorsExport } | { ok: false; reason: "not_event_vendors_export" };

const COLUMNS = ["type", "name", "contact", "email", "phone", "instagram"] as const;
type Column = (typeof COLUMNS)[number];

// Deux morceaux de la même ligne : l'Instagram, écrit plus petit, est un point plus bas.
const SAME_LINE = 2.5;
// Une cellule commence au début de sa colonne, à l'arrondi près.
const ALIGNED = 1.5;

const roleKey = (value: string) => foldProgramText(value).replace(/\s+/g, "");
const clean = (value: string) => tidyText(decodeHtmlEntities(value.replace(/\s+/g, " ")));

export function parseEventVendorsExport(
  pages: PdfPage[],
  profile: EventVendorsExportProfile,
  context: { calendar: { weekdays: readonly string[]; months: readonly string[] }; footerPrefix: string; plannerRoles: readonly string[] },
): EventVendorsExportResult {
  const footer = foldProgramText(context.footerPrefix);
  const items: { item: PdfTextItem; page: number }[] = pages.flatMap((page, index) =>
    page.items.filter((item) => item.size >= 2 && item.text.trim() !== "" && !foldProgramText(item.text).startsWith(footer)).map((item) => ({ item, page: index })),
  );
  const is = (item: PdfTextItem, label: string) => foldProgramText(item.text) === foldProgramText(label);

  const title = items.find(({ item }) => is(item, profile.title));
  if (!title) return { ok: false, reason: "not_event_vendors_export" };

  // La ligne des titres de colonnes : les six titres sur une même ligne, après le titre.
  const header = items
    .filter(({ item, page }) => page === title.page && item.y > title.item.y && is(item, profile.columnHeaders.type))
    .map((start) => {
      const sameLine = items.filter(({ item, page }) => page === start.page && Math.abs(item.y - start.item.y) <= SAME_LINE);
      const xs = COLUMNS.map((column) => sameLine.find(({ item }) => is(item, profile.columnHeaders[column]))?.item.x ?? null);
      return { page: start.page, y: start.item.y, xs };
    })
    .find((candidate) => candidate.xs.every((x) => x !== null));
  if (!header) return { ok: false, reason: "not_event_vendors_export" };
  const columnAt = (x: number): Column | null => {
    const index = (header.xs as number[]).findIndex((start) => Math.abs(start - x) <= ALIGNED);
    return index < 0 ? null : COLUMNS[index]!;
  };

  // En-tête : la date de l'évènement, puis une ligne par client, au-dessus du titre.
  const above = items.filter(({ item, page }) => page === title.page && item.y < title.item.y - SAME_LINE).sort((a, b) => a.item.y - b.item.y || a.item.x - b.item.x);
  const dated = above.find(({ item }) => frenchDate(item.text, context.calendar) !== null);
  const eventDate = dated ? frenchDate(dated.item.text, context.calendar) : null;
  const clients = above.filter(({ item }) => (dated ? item.y > dated.item.y + SAME_LINE : true)).map(({ item }) => clean(item.text)).filter((text) => text !== "");

  // Tableau : les morceaux alignés sur une colonne, regroupés par ligne ; une ligne sans type
  // prolonge la précédente (cellule sur deux lignes).
  const cells = items
    .filter(({ item, page }) => (page > header.page || (page === header.page && item.y > header.y + SAME_LINE)) && columnAt(item.x) !== null)
    .sort((a, b) => a.page - b.page || a.item.y - b.item.y || a.item.x - b.item.x);
  const lines: { page: number; y: number; cells: Partial<Record<Column, string>> }[] = [];
  for (const { item, page } of cells) {
    const column = columnAt(item.x)!;
    let line = lines.at(-1);
    if (!line || line.page !== page || Math.abs(line.y - item.y) > SAME_LINE) {
      line = { page, y: item.y, cells: {} };
      lines.push(line);
    }
    line.cells[column] = clean([line.cells[column], item.text].filter(Boolean).join(" "));
  }
  const merged: Partial<Record<Column, string>>[] = [];
  for (const line of lines) {
    const previous = merged.at(-1);
    if (line.cells.type || !previous) merged.push({ ...line.cells });
    else for (const column of COLUMNS) if (line.cells[column]) previous[column] = clean([previous[column], line.cells[column]].filter(Boolean).join(" "));
  }

  const planner = new Set(context.plannerRoles.map(roleKey));
  const rows: EventVendorsExportRow[] = merged
    .filter((row): row is Partial<Record<Column, string>> & { type: string; name: string } => Boolean(row.type) && Boolean(row.name))
    .map((row, index) => ({
      line: index + 1,
      type: row.type,
      name: row.name,
      contact: row.contact || null,
      email: row.email || null,
      phone: row.phone || null,
      instagram: row.instagram || null,
      planner: planner.has(roleKey(row.type)),
    }));
  if (rows.length === 0) return { ok: false, reason: "not_event_vendors_export" };
  return { ok: true, export: { eventDate, clients, rows } };
}
