// Lot 17 (DEV-07, ADR 0046) — lignes du vendeur sur un devis, une facture ou
// un avoir : nom suivi de « EI » pour un entrepreneur individuel, ligne de
// contact, ligne des mentions légales du pied de page (forme juridique et
// capital d'une société, SIRET ou SIREN, immatriculation, numéro de TVA).
// Seuls les champs renseignés apparaissent, jamais de ligne vide.
import { formatAmount, type Locale } from "@symbola/i18n";
import type { LegalFormCode, SellerSnapshot } from "@symbola/contracts";

export type SellerLegalLabels = {
  // Suffixe du nom d'un entrepreneur individuel (« EI »).
  soleTrader: string;
  legalForms: Record<LegalFormCode, string>;
  capital: (form: string, amount: string) => string;
  siret: (siret: string) => string;
  siren: (siren: string) => string;
  vatNumber: (vatNumber: string) => string;
};

const SOLE_TRADERS: LegalFormCode[] = ["ei", "auto_entrepreneur"];
const COMPANIES: LegalFormCode[] = ["eurl", "sarl", "sas", "sasu", "sa"];

export function sellerDisplayName(seller: SellerSnapshot, labels: Pick<SellerLegalLabels, "soleTrader" | "legalForms">): string {
  const name = seller.organizationName.trim();
  const form = seller.legalForm ?? null;
  const suffix = form && SOLE_TRADERS.includes(form) ? labels.soleTrader : form === "eirl" ? labels.legalForms.eirl : null;
  if (!suffix) return name;
  // Déjà écrit dans le nom (« Atelier Exemple EI ») : pas de doublon.
  const escaped = suffix.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`(^|\\s)${escaped}$`, "i").test(name) ? name : `${name} ${suffix}`;
}

export function sellerContactLine(seller: SellerSnapshot): string | null {
  const parts = [seller.contactEmail, seller.contactPhone, seller.website].filter((part): part is string => Boolean(part));
  return parts.length > 0 ? parts.join(" · ") : null;
}

export function sellerLegalLine(seller: SellerSnapshot, labels: SellerLegalLabels, locale: Locale): string {
  const form = seller.legalForm ?? null;
  const parts: (string | null)[] = [sellerDisplayName(seller, labels)];
  if (form && COMPANIES.includes(form)) {
    const formLabel = labels.legalForms[form];
    parts.push(
      seller.shareCapitalCents !== null && seller.shareCapitalCents !== undefined
        ? labels.capital(formLabel, formatAmount(seller.shareCapitalCents, locale))
        : formLabel,
    );
  }
  parts.push(seller.siret ? labels.siret(seller.siret) : seller.siren ? labels.siren(seller.siren) : null);
  parts.push(seller.registration ?? null);
  parts.push(seller.vatNumber ? labels.vatNumber(seller.vatNumber) : null);
  return parts.filter((part): part is string => Boolean(part)).join(" · ");
}
