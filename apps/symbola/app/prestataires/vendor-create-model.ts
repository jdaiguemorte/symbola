// Lot 73d (PRE-01, UX-03, UX-10 ; spécification du lot 73, § 5.4, critères 1, 2 et 4 ; V10, C-46 ; maquette
// 20, « Créer ») — les règles pures de la fenêtre unique de création d'un prestataire, la même au carnet et
// depuis un poste du budget.
//
// - Les six champs, dans l'ordre de l'usage (nom, métier, contact, téléphone, e-mail, ville).
// - « Plus de détails » : tout ce que portaient les quatre rubriques d'avant (adresse, SIRET, site et
//   réseaux, étiquettes, évaluation, tarifs, note, champs du métier) ; rien n'est perdu (critère 2).
// - La liste des métiers, rangée par famille ; « À classer » en dernier, choisi exprès (critère 1).
// - Un nom proche d'une fiche du carnet (critère 4) : vendor-create-similar.ts, côté serveur (le moteur
//   d'import n'entre pas dans la page).
import { VENDOR_SOCIAL_NETWORKS } from "@symbola/contracts";
import { UNCLASSIFIED_TRADE } from "@/lib/forms/vendor-create-fields";

export const VENDOR_CREATE_FIELDS = ["name", "typeId", "contactName", "phone", "email", "city"] as const;

// Les champs de « Plus de détails » : ceux des quatre rubriques d'avant (identité, métiers et étiquettes,
// coordonnées, tarifs et note) qui ne sont pas parmi les six. Les étiquettes, les champs du métier et le
// pays suivent le métier choisi ; ils sont nommés ici pour l'inventaire.
export const VENDOR_DETAIL_FIELDS = [
  "addressLine",
  "postalCode",
  "country",
  "siret",
  "website",
  ...VENDOR_SOCIAL_NETWORKS.map((network) => `social_${network}` as const),
  "tagIds",
  "rating",
  "indicativePrices",
  "internalNote",
] as const;

// Les champs des quatre rubriques d'avant (lot 63e), pour vérifier que la fenêtre les garde tous.
export const LEGACY_RUBRIC_FIELDS = [
  "name",
  "siret",
  "website",
  ...VENDOR_SOCIAL_NETWORKS.map((network) => `social_${network}` as const),
  "typeIds",
  "tagIds",
  "contactName",
  "phone",
  "email",
  "addressLine",
  "postalCode",
  "city",
  "country",
  "rating",
  "indicativePrices",
  "internalNote",
] as const;

export type TradeOption = { value: string; label: string };
export type TradeGroup = { label: string | null; options: TradeOption[] };

// Les métiers, rangés par famille (dans l'ordre des familles), les métiers sans famille ensuite ; « À
// classer » est le dernier choix, seul.
export function tradeGroups(types: { id: string; label: string; familyId: string | null }[], families: { id: string; label: string }[], unclassifiedLabel: string): TradeGroup[] {
  const groups: TradeGroup[] = families
    .map((family) => ({ label: family.label, options: types.filter((type) => type.familyId === family.id).map((type) => ({ value: type.id, label: type.label })) }))
    .filter((group) => group.options.length > 0);
  const loose = types.filter((type) => !families.some((family) => family.id === type.familyId)).map((type) => ({ value: type.id, label: type.label }));
  if (loose.length > 0) groups.push({ label: null, options: loose });
  groups.push({ label: null, options: [{ value: UNCLASSIFIED_TRADE, label: unclassifiedLabel }] });
  return groups;
}

// Les textes de la fenêtre (espace « VendorCreate », réservé au serveur : vendor-create-labels.ts).
export const VENDOR_CREATE_LABEL_KEYS = [
  "title",
  "editTitle",
  "forSlot",
  "forSlotNoEvent",
  "mainLegend",
  "name",
  "trade",
  "tradeChoose",
  "tradeUnclassified",
  "tradeProposed",
  "tradeMore",
  "contactName",
  "phone",
  "email",
  "city",
  "details",
  "detailsEdit",
  "later",
  "siretHint",
  "links",
  "joinsBook",
  "how",
  "compare",
  "compareHint",
  "retain",
  "retainHint",
  "create",
  "createAndAdd",
  "createdAsk",
  "save",
  "saved",
  "close",
  "similar",
  "similarNoCity",
  "similarSee",
  "errors.nameRequired",
  "errors.nameTooLong",
  "errors.tradeRequired",
  "errors.emailInvalid",
  "errors.modeRequired",
] as const;
export type VendorCreateLabels = Record<(typeof VENDOR_CREATE_LABEL_KEYS)[number], string>;

// Remplit les « {nom} » d'un texte (sans pluriel : la fenêtre n'en a pas).
export function fillLabel(template: string, values: Record<string, string> = {}): string {
  return template.replace(/\{(\w+)\}/g, (whole, key: string) => values[key] ?? whole);
}
