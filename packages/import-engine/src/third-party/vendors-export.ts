// Lot 14 (IMP-07) — export des prestataires d'un logiciel de planification
// tiers (Excel). Reconnaissance par les intitulés du profil (données de
// @symbola/starter-templates), colonnes inversées par l'export remises à
// leur place d'après leur contenu, et valeurs remises en état : entités
// HTML, code postal à 5 chiffres, téléphones multiples, critères en liste.
import type { VendorsExportProfile } from "@symbola/starter-templates";
import { decodeHtmlEntities, looksLikeUrl, normalizePostalCode, splitList, splitPhones, tidyText, type PhoneEntry } from "../cleanup";
import type { ImportTable } from "../types";

export type VendorsExportField =
  | "name"
  | "type"
  | "contactFirstName"
  | "contactLastName"
  | "email"
  | "addressLine"
  | "postalCode"
  | "city"
  | "department"
  | "phones"
  | "website"
  | "criteria"
  | "facebook"
  | "x"
  | "linkedin"
  | "pinterest"
  | "instagram"
  | "siret"
  | "vatNumber"
  | "apeCode"
  | "legalStatus"
  | "services";

export type VendorsExportDetection =
  | { matched: false }
  | {
      matched: true;
      // Champ de chaque colonne (index de colonne → champ), après remise en place.
      columns: Map<number, VendorsExportField>;
      // Paires de champs dont les colonnes étaient inversées dans le fichier.
      swapped: [VendorsExportField, VendorsExportField][];
    };

const fold = (value: string) => value.normalize("NFC").replace(/\s+/g, " ").trim().toLocaleLowerCase("fr");

// Part des valeurs non vides d'une colonne qui ressemblent à une adresse web.
function urlShare(table: Pick<ImportTable, "rows">, column: number): number {
  const values = table.rows.map((row) => row[column] ?? "").filter((value) => value.trim() !== "");
  if (values.length === 0) return 0;
  return values.filter(looksLikeUrl).length / values.length;
}

export function detectVendorsExport(table: Pick<ImportTable, "headers" | "rows">, profile: VendorsExportProfile): VendorsExportDetection {
  const expected = profile.headers.map(fold);
  const matches = expected.filter((header, index) => fold(table.headers[index] ?? "") === header).length;
  if (matches < profile.minimumHeaderMatches) return { matched: false };

  const columns = new Map<number, VendorsExportField>();
  for (const [index, field] of Object.entries(profile.columns)) {
    if (Number(index) < table.headers.length) columns.set(Number(index), field as VendorsExportField);
  }
  // « Site Internet » et « Critères avancés » inversées : on suit le contenu.
  const swapped: [VendorsExportField, VendorsExportField][] = [];
  for (const [urlField, otherField] of profile.swapWhenContentDiffers as [VendorsExportField, VendorsExportField][]) {
    const urlColumn = [...columns].find(([, field]) => field === urlField)?.[0];
    const otherColumn = [...columns].find(([, field]) => field === otherField)?.[0];
    if (urlColumn === undefined || otherColumn === undefined) continue;
    if (urlShare(table, otherColumn) > 0.5 && urlShare(table, urlColumn) < 0.5) {
      columns.set(urlColumn, otherField);
      columns.set(otherColumn, urlField);
      swapped.push([urlField, otherField]);
    }
  }
  return { matched: true, columns, swapped };
}

export type VendorsExportRow = {
  name: string;
  type: string | null;
  contactName: string | null;
  email: string | null;
  addressLine: string | null;
  postalCode: string | null;
  city: string | null;
  phone: string | null;
  // Les autres numéros de la cellule (« 06… (Julie) »), pour la note interne.
  otherPhones: PhoneEntry[];
  website: string | null;
  socialLinks: { network: "instagram" | "facebook" | "pinterest" | "linkedin" | "x"; url: string }[];
  siret: string | null;
  vatNumber: string | null;
  apeCode: string | null;
  legalStatus: string | null;
  criteria: string[];
  services: string | null;
};

export function normalizeVendorsExportRow(
  row: string[],
  columns: Map<number, VendorsExportField>,
  profile: Pick<VendorsExportProfile, "listSeparator">,
): VendorsExportRow | null {
  return normalizeVendorFields((field) => {
    for (const [index, candidate] of columns) if (candidate === field) return row[index] ?? "";
    return "";
  }, profile.listSeparator);
}

// Valeurs d'une ligne déjà lue par champ (import du carnet, IMP-07) : même
// remise en état, quelle que soit l'origine du fichier.
export function normalizeVendorImportValues(
  values: Record<string, string | number | boolean | null | undefined>,
  listSeparator: string,
): VendorsExportRow | null {
  return normalizeVendorFields((field) => {
    const value = values[field];
    return value === null || value === undefined ? "" : String(value);
  }, listSeparator);
}

// Texte d'une cellule remis en état (entités HTML, espaces) ; code postal
// complété ; SIRET réduit à ses chiffres. Pour l'aperçu et les rapprochements.
export function cleanVendorImportText(field: string, value: string): string {
  const text = tidyText(decodeHtmlEntities(value));
  if (field === "postalCode") return text === "" ? text : normalizePostalCode(text);
  if (field === "siret") return text.replace(/[\s.]/g, "");
  return text;
}

function normalizeVendorFields(raw: (field: VendorsExportField) => string, listSeparator: string): VendorsExportRow | null {
  const text = (field: VendorsExportField): string | null => {
    const value = tidyText(decodeHtmlEntities(raw(field)));
    return value === "" ? null : value;
  };
  const name = text("name");
  if (!name) return null;
  const contact = [text("contactFirstName"), text("contactLastName")].filter(Boolean).join(" ");
  const phones = splitPhones(decodeHtmlEntities(raw("phones")));
  const postal = text("postalCode");
  const siret = text("siret")?.replace(/\D/g, "") ?? null;
  const social = (["instagram", "facebook", "pinterest", "linkedin", "x"] as const)
    .map((network) => ({ network, url: text(network) }))
    .filter((link): link is { network: (typeof link)["network"]; url: string } => link.url !== null && looksLikeUrl(link.url));
  const website = text("website");
  return {
    name,
    type: text("type"),
    contactName: contact || null,
    email: text("email"),
    addressLine: text("addressLine"),
    postalCode: postal ? normalizePostalCode(postal) : null,
    city: text("city"),
    phone: phones[0]?.number ?? null,
    otherPhones: phones.slice(1),
    website: website && looksLikeUrl(website) ? website : null,
    socialLinks: social,
    siret: siret && siret.length === 14 ? siret : null,
    vatNumber: text("vatNumber"),
    apeCode: text("apeCode"),
    legalStatus: text("legalStatus"),
    criteria: splitList(text("criteria") ?? "", listSeparator),
    services: text("services"),
  };
}

// IMP-07 — correspondance des colonnes proposée pour un export reconnu :
// chaque colonne reçoit son champ avec une confiance d'au moins 90 ; une
// colonne remise en place d'après son contenu est signalée (`byContent`).
// Les colonnes sans champ du carnet (TVA, APE…) restent sans équivalent.
export const VENDORS_EXPORT_CONFIDENCE = 95;
export const VENDORS_EXPORT_SWAPPED_CONFIDENCE = 90;

export type VendorsExportProposal = { columnIndex: number; fieldKey: string | null; confidence: number; byContent: boolean };

export function proposeVendorsExportMapping(
  table: Pick<ImportTable, "headers" | "rows">,
  profile: VendorsExportProfile,
  fieldKeys: readonly string[],
): VendorsExportProposal[] | null {
  const detection = detectVendorsExport(table, profile);
  if (!detection.matched) return null;
  const swappedFields = new Set(detection.swapped.flat());
  const known = new Set(fieldKeys);
  return table.headers.map((_, columnIndex) => {
    const field = detection.columns.get(columnIndex);
    if (!field || !known.has(field)) return { columnIndex, fieldKey: null, confidence: 0, byContent: false };
    const byContent = swappedFields.has(field);
    return { columnIndex, fieldKey: field, confidence: byContent ? VENDORS_EXPORT_SWAPPED_CONFIDENCE : VENDORS_EXPORT_CONFIDENCE, byContent };
  });
}
