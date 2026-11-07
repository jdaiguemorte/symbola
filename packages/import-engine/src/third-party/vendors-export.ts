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
function urlShare(table: ImportTable, column: number): number {
  const values = table.rows.map((row) => row[column] ?? "").filter((value) => value.trim() !== "");
  if (values.length === 0) return 0;
  return values.filter(looksLikeUrl).length / values.length;
}

export function detectVendorsExport(table: ImportTable, profile: VendorsExportProfile): VendorsExportDetection {
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
  profile: VendorsExportProfile,
): VendorsExportRow | null {
  const raw = (field: VendorsExportField): string => {
    for (const [index, candidate] of columns) if (candidate === field) return row[index] ?? "";
    return "";
  };
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
    criteria: splitList(text("criteria") ?? "", profile.listSeparator),
    services: text("services"),
  };
}
