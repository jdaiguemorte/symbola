// Lot 41 (JUR-02, JUR-13 ; D6, D8, D9) — règles pures des mentions de la réforme : références
// d'achat bornées, adresse structurée, catégorie de l'opération déduite des lignes, acheteur
// entreprise figé depuis le contact du hub (SIREN tiré d'un SIRET). Testées sans base.
import type { Contact, LineNature, OperationCategory, PostalAddress } from "@symbola/contracts";

export const REFERENCE_MAX_LENGTH = 60;
// Caractères de contrôle, et séparateurs de ligne et de paragraphe Unicode.
const CONTROL_CHARACTERS = new RegExp("[\\u0000-\\u001f\\u007f-\\u009f\\u2028\\u2029]");

export class InvalidReferenceError extends Error {
  constructor(readonly field: "orderReference" | "buyerReference") {
    super(`référence invalide : ${field}`);
    this.name = "InvalidReferenceError";
  }
}

export class InvalidPostalAddressError extends Error {
  constructor(readonly field: "line" | "postalCode" | "city" | "countryCode") {
    super(`adresse invalide : ${field}`);
    this.name = "InvalidPostalAddressError";
  }
}

// Bon de commande ou référence de l'acheteur : une ligne de texte imprimable (les caractères de
// contrôle sont refusés ; « < », « & » et les guillemets sont permis, échappés dans le XML), au plus
// 60 caractères. Vide : null.
export function cleanReference(value: string | null | undefined, field: "orderReference" | "buyerReference"): string | null {
  const raw = value ?? "";
  if (CONTROL_CHARACTERS.test(raw.replace(/\t/g, " "))) throw new InvalidReferenceError(field);
  const clean = raw.replace(/\s+/g, " ").trim();
  if (clean === "") return null;
  if (clean.length > REFERENCE_MAX_LENGTH) throw new InvalidReferenceError(field);
  return clean;
}

// Pays d'un contact (texte libre) en code ISO : vide ou « France », FR ; deux lettres, telles quelles.
export function countryCodeOf(country: string | null | undefined): string | null {
  const text = (country ?? "").trim();
  if (text === "" || /^france$/i.test(text)) return "FR";
  if (/^[A-Za-z]{2}$/.test(text)) return text.toUpperCase();
  return null;
}

// Adresse de livraison saisie : vide (aucune), ou ligne, code postal et ville tous remplis.
export function cleanPostalAddress(input: { line?: string | null; postalCode?: string | null; city?: string | null; countryCode?: string | null } | null): PostalAddress | null {
  if (!input) return null;
  const text = (value: string | null | undefined, max: number, field: "line" | "postalCode" | "city") => {
    const clean = (value ?? "").replace(/\s+/g, " ").trim();
    if (clean.length > max) throw new InvalidPostalAddressError(field);
    return clean;
  };
  const line = text(input.line, 300, "line");
  const postalCode = text(input.postalCode, 16, "postalCode");
  const city = text(input.city, 120, "city");
  if (line === "" && postalCode === "" && city === "") return null;
  if (line === "") throw new InvalidPostalAddressError("line");
  if (postalCode === "" || !/^[0-9A-Za-z -]+$/.test(postalCode)) throw new InvalidPostalAddressError("postalCode");
  if (city === "") throw new InvalidPostalAddressError("city");
  const countryCode = countryCodeOf(input.countryCode);
  if (!countryCode) throw new InvalidPostalAddressError("countryCode");
  return { line, postalCode, city, countryCode };
}

export function formatPostalAddress(address: PostalAddress): string {
  return `${address.line}, ${address.postalCode} ${address.city}${address.countryCode === "FR" ? "" : `, ${address.countryCode}`}`;
}

// Réponse 2 de l'expert-comptable : la catégorie imprimée sur toutes les factures.
export function operationCategory(natures: readonly LineNature[]): OperationCategory {
  const goods = natures.includes("goods");
  const services = natures.length === 0 || natures.includes("service");
  return goods && services ? "mixed" : goods ? "goods" : "services";
}

// Un SIRET (14 chiffres) donne son SIREN : ses neuf premiers chiffres.
export function sirenOf(companyIdNumber: string | null | undefined): string | null {
  const digits = (companyIdNumber ?? "").replace(/[\s.]/g, "");
  if (/^[0-9]{14}$/.test(digits)) return digits.slice(0, 9);
  if (/^[0-9]{9}$/.test(digits)) return digits;
  return null;
}

export type BuyerMention = "buyerCompany" | "buyerSiren" | "buyerAddress";
export type CompanyBuyer = { name: string; siren: string; vatNumber: string | null; address: PostalAddress };

// Acheteur entreprise d'un devis professionnel (D6), et ce qui lui manque pour une facture : un
// contact « entreprise » non anonymisé, son SIREN, son adresse structurée.
export function companyBuyerOf(contact: Pick<Contact, "kind" | "name" | "anonymized" | "companyIdNumber" | "vatNumber" | "addressLine" | "postalCode" | "city" | "country"> | null): {
  buyer: CompanyBuyer | null;
  missing: BuyerMention[];
} {
  if (!contact || contact.kind !== "company" || contact.anonymized || !contact.name?.trim()) return { buyer: null, missing: ["buyerCompany"] };
  const missing: BuyerMention[] = [];
  const siren = sirenOf(contact.companyIdNumber);
  if (!siren) missing.push("buyerSiren");
  let address: PostalAddress | null = null;
  try {
    address = cleanPostalAddress({ line: contact.addressLine, postalCode: contact.postalCode, city: contact.city, countryCode: contact.country });
  } catch {
    address = null;
  }
  if (!address) missing.push("buyerAddress");
  if (!siren || !address) return { buyer: null, missing };
  return { buyer: { name: contact.name.trim(), siren, vatNumber: contact.vatNumber, address }, missing: [] };
}
