// Lot 49 (INV-02 ; D12) — règles pures de l'import d'une liste d'invités : colonnes reconnues
// (intitulés en données, sans accents ni casse), personnes lues (un enfant perd e-mail, téléphone et
// nom de famille : RGP-18), doublons (même nom et même e-mail, ou même nom et même téléphone, dans
// l'évènement ou dans le fichier). Une colonne de régime est ignorée et signalée : seul l'invité
// donne son régime, avec son accord. Les cellules arrivent déjà neutralisées par le moteur d'import.
import type { GuestAgeRange, GuestImportDuplicate, GuestImportProblem, GuestImportRow } from "@symbola/contracts";
import type { GuestImportField, StarterGuestImportColumns } from "@symbola/starter-templates";
import { normalizeEmail, normalizePhone } from "./rsvp";

export function foldHeader(value: string): string {
  return value
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9']+/g, " ")
    .trim();
}

export type GuestColumnMapping = { mapping: Partial<Record<GuestImportField, number>>; ignoredDiet: number[]; unknown: number[] };

export function mapGuestColumns(headers: string[], columns: StarterGuestImportColumns): GuestColumnMapping {
  const folded = (names: string[]) => new Set(names.map(foldHeader));
  const known = (Object.entries(columns.columns) as [GuestImportField, string[]][]).map(([field, names]) => [field, folded(names)] as const);
  const diet = folded(columns.ignoredDiet);
  const mapping: Partial<Record<GuestImportField, number>> = {};
  const ignoredDiet: number[] = [];
  const unknown: number[] = [];
  headers.forEach((header, index) => {
    const name = foldHeader(header);
    if (name === "") return;
    if (diet.has(name)) {
      ignoredDiet.push(index);
      return;
    }
    const field = known.find(([candidate, names]) => mapping[candidate] === undefined && names.has(name))?.[0];
    if (field) mapping[field] = index;
    else unknown.push(index);
  });
  return { mapping, ignoredDiet, unknown };
}

function ageRangeOf(value: string): GuestAgeRange | null {
  const text = value.trim();
  const exact = (["0-2", "3-5", "6-11", "12-17"] as const).find((range) => range === text.replace(/\s/g, ""));
  if (exact) return exact;
  const age = Number.parseInt(text, 10);
  if (!Number.isFinite(age) || age < 0) return null;
  if (age <= 2) return "0-2";
  if (age <= 5) return "3-5";
  if (age <= 11) return "6-11";
  if (age <= 17) return "12-17";
  return null;
}

export function readGuestRows(
  rows: string[][],
  lineNumbers: number[],
  mapping: GuestColumnMapping["mapping"],
  columns: StarterGuestImportColumns,
): { rows: GuestImportRow[]; problems: { line: number; problem: GuestImportProblem }[] } {
  const isChild = new Set(columns.values.child.map(foldHeader));
  const isEnglish = new Set(columns.values.en.map(foldHeader));
  const cell = (row: string[], field: GuestImportField) => {
    const index = mapping[field];
    return index === undefined ? "" : (row[index] ?? "").trim();
  };
  const result: GuestImportRow[] = [];
  const problems: { line: number; problem: GuestImportProblem }[] = [];
  rows.forEach((row, index) => {
    const line = lineNumbers[index] ?? index + 1;
    const firstName = cell(row, "firstName").replace(/\s+/g, " ").slice(0, 100);
    if (!firstName) {
      problems.push({ line, problem: "name_missing" });
      return;
    }
    const lastName = cell(row, "lastName").replace(/\s+/g, " ").slice(0, 100) || null;
    const ageRange = ageRangeOf(cell(row, "ageRange"));
    const child = isChild.has(foldHeader(cell(row, "kind"))) || ageRange !== null;
    const email = normalizeEmail(cell(row, "email"));
    const phone = normalizePhone(cell(row, "phone"));
    if (child && (email || phone || lastName)) problems.push({ line, problem: "child_contact_dropped" });
    result.push({
      line,
      household: (cell(row, "household") || [firstName, lastName].filter(Boolean).join(" ")).slice(0, 200),
      kind: child ? "child" : "adult",
      firstName,
      lastName: child ? null : lastName,
      email: child ? null : email,
      phone: child ? null : phone,
      ageRange: child ? ageRange : null,
      side: cell(row, "side") || null,
      group: cell(row, "group").slice(0, 100) || null,
      language: isEnglish.has(foldHeader(cell(row, "language"))) ? "en" : "fr",
    });
  });
  return { rows: result, problems };
}

// Chiffres seuls, l'indicatif français ramené au zéro (« +33 6… » = « 06… »).
export function phoneKey(phone: string | null | undefined): string | null {
  if (!phone) return null;
  let digits = phone.replace(/\D/g, "");
  if (digits.startsWith("0033")) digits = `0${digits.slice(4)}`;
  else if (digits.startsWith("33") && phone.trim().startsWith("+")) digits = `0${digits.slice(2)}`;
  return digits.length >= 6 ? digits : null;
}

type Person = { firstName: string; lastName: string | null; email: string | null; phone: string | null };

function keysOf(person: Person): string[] {
  const name = foldHeader(`${person.firstName} ${person.lastName ?? ""}`);
  const email = normalizeEmail(person.email);
  const phone = phoneKey(person.phone);
  return [...(email ? [`${name}|e:${email}`] : []), ...(phone ? [`${name}|p:${phone}`] : [])];
}

// Une ligne qui en répète une autre (plus haut dans le fichier, ou déjà dans l'évènement).
export function findDuplicates(rows: GuestImportRow[], existing: Person[]): GuestImportDuplicate[] {
  const inEvent = new Map<string, string>();
  for (const person of existing) for (const key of keysOf(person)) inEvent.set(key, [person.firstName, person.lastName].filter(Boolean).join(" "));
  const inFile = new Map<string, number>();
  const duplicates: GuestImportDuplicate[] = [];
  for (const row of rows) {
    const keys = keysOf(row);
    const eventName = keys.map((key) => inEvent.get(key)).find((name): name is string => name !== undefined);
    const fileLine = keys.map((key) => inFile.get(key)).find((line): line is number => line !== undefined);
    if (eventName !== undefined) duplicates.push({ line: row.line, with: { kind: "event", name: eventName } });
    else if (fileLine !== undefined) duplicates.push({ line: row.line, with: { kind: "file", line: fileLine } });
    for (const key of keys) if (!inFile.has(key)) inFile.set(key, row.line);
  }
  return duplicates;
}
