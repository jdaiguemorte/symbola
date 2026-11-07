// Lot 14c (IMP-08) — une fiche événement PDF lue (event-sheet.ts) devient
// une ligne d'import : mêmes étapes ensuite que pour un tableau (lot 5). Les
// intitulés des colonnes sont des données du profil (starter-templates). Une
// fiche refusée devient une ligne avec son motif, rejetée au rapport des
// écarts sans bloquer les autres.
import type { PhoneEntry } from "../cleanup";
import { tidyText } from "../cleanup";
import type { EventSheet, EventSheetPerson } from "./event-sheet";

export const EVENT_SHEET_COLUMNS = [
  "source",
  "rejection",
  "client1FirstName",
  "client1LastName",
  "client1Email",
  "client1Phone",
  "client1AddressLine",
  "client1PostalCode",
  "client1City",
  "client2FirstName",
  "client2LastName",
  "client2Email",
  "client2Phone",
  "client2AddressLine",
  "client2PostalCode",
  "client2City",
  "eventDate",
  "venueName",
  "places",
  "status",
  "wantedBudget",
  "note",
  "paid",
  "balance",
  "total",
] as const;
export type EventSheetColumn = (typeof EVENT_SHEET_COLUMNS)[number];

// Colonnes gardées en champ libre sur la fiche (décision K : montants
// d'information, jamais recalculés en faux paiements) ; colonnes techniques
// jamais écrites.
export const EVENT_SHEET_FREE_COLUMNS: readonly EventSheetColumn[] = ["note", "paid", "balance", "total"];
export const EVENT_SHEET_TECHNICAL_COLUMNS: readonly EventSheetColumn[] = ["source", "rejection"];

export type EventSheetRejection = "not_pdf" | "too_large" | "encrypted" | "too_many_pages" | "no_text" | "unreadable" | "timeout" | "not_event_sheet" | "infected";

// Montant pour la colonne : « 25000,00 » (virgule décimale sans ambiguïté).
function amountCell(cents: number | null): string {
  if (cents === null) return "";
  const sign = cents < 0 ? "-" : "";
  const value = Math.abs(cents);
  return `${sign}${Math.trunc(value / 100)},${String(value % 100).padStart(2, "0")}`;
}

const fold = (value: string) => value.normalize("NFD").replace(/[̀-ͯ]/g, "").toLocaleLowerCase("fr").trim();

// « Téléphones » vaut pour l'événement : un numéro marqué d'un prénom va à ce
// client, les autres dans l'ordre aux clients qui n'en ont pas.
export function assignPhones(people: Pick<EventSheetPerson, "firstName">[], phones: PhoneEntry[]): (string | null)[] {
  const result: (string | null)[] = people.map(() => null);
  const rest: PhoneEntry[] = [];
  for (const phone of phones) {
    const index = phone.label ? people.findIndex((person, position) => result[position] === null && fold(person.firstName) === fold(phone.label!)) : -1;
    if (index >= 0) result[index] = phone.number;
    else rest.push(phone);
  }
  for (const phone of rest) {
    const index = result.findIndex((value) => value === null);
    if (index < 0) break;
    result[index] = phone.number;
  }
  return result;
}

// Décision J : « confirmé » quand la date est à venir et qu'un lieu est
// connu, « réalisé » quand elle est passée, « prospect » sinon.
export function eventSheetStatus(sheet: Pick<EventSheet, "eventDate" | "places">, today: string): "confirmed" | "done" | "prospect" {
  if (sheet.eventDate && sheet.eventDate < today) return "done";
  if (sheet.eventDate && sheet.places.length > 0) return "confirmed";
  return "prospect";
}

// Lieux, un par ligne : « 14:30 — Domaine des Tilleuls » (sans heure : « — Nom »).
export function placesCell(places: EventSheet["places"]): string {
  return places.map((place) => `${place.time ?? ""} — ${place.label}`.trim()).join("\n");
}

export function parsePlacesCell(value: string): { label: string; time: string | null }[] {
  return value
    .split("\n")
    .map((line) => /^(\d{2}:\d{2})?\s*—\s*(.+)$/.exec(line.trim()))
    .filter((match): match is RegExpExecArray => match !== null && tidyText(match[2] ?? "") !== "")
    .map((match) => ({ label: tidyText(match[2] as string), time: match[1] ?? null }));
}

export function eventSheetRow(fileName: string, sheet: EventSheet, today: string): Record<EventSheetColumn, string> {
  const people = sheet.people.slice(0, 2);
  const phones = assignPhones(people, sheet.phones);
  const person = (index: number) => people[index];
  const cell = (value: string | null | undefined) => value ?? "";
  const row = Object.fromEntries(EVENT_SHEET_COLUMNS.map((column) => [column, ""])) as Record<EventSheetColumn, string>;
  row.source = fileName;
  for (const index of [0, 1] as const) {
    const prefix = `client${index + 1}` as "client1" | "client2";
    row[`${prefix}FirstName`] = cell(person(index)?.firstName);
    row[`${prefix}LastName`] = cell(person(index)?.lastName);
    row[`${prefix}Email`] = cell(person(index)?.email);
    row[`${prefix}Phone`] = cell(phones[index]);
    row[`${prefix}AddressLine`] = cell(person(index)?.addressLine);
    row[`${prefix}PostalCode`] = cell(person(index)?.postalCode);
    row[`${prefix}City`] = cell(person(index)?.city);
  }
  row.eventDate = cell(sheet.eventDate);
  row.venueName = cell(sheet.places[0]?.label);
  row.places = placesCell(sheet.places);
  row.status = eventSheetStatus(sheet, today);
  // Un budget souhaité à zéro est un champ laissé vide dans l'outil.
  row.wantedBudget = sheet.budget.wantedCents ? amountCell(sheet.budget.wantedCents) : "";
  row.note = cell(sheet.note);
  row.paid = sheet.budget.paidCents ? `${amountCell(sheet.budget.paidCents)} €` : "";
  row.balance = sheet.budget.balanceCents ? `${amountCell(sheet.budget.balanceCents)} €` : "";
  row.total = sheet.budget.totalCents ? `${amountCell(sheet.budget.totalCents)} €` : "";
  return row;
}

export function eventSheetRejectionRow(fileName: string, reason: EventSheetRejection): Record<EventSheetColumn, string> {
  const row = Object.fromEntries(EVENT_SHEET_COLUMNS.map((column) => [column, ""])) as Record<EventSheetColumn, string>;
  row.source = fileName;
  row.rejection = reason;
  return row;
}
