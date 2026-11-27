// Lot 73b (PRE-01, PRE-05, HUB-14 ; spécification du lot 73, § 5.2 et § 9 ; P3, P13 ; maquette 18) — les
// règles pures de la ligne du carnet et de l'écran « Classer ».
//
// - L'état des pièces en mots (P3) : le nom de la pièce en tête (son nom court, sinon son libellé), puis une
//   tournure qui ne s'accorde pas et dit quoi faire ; chaque état a un mot et, quand il presse, une forme
//   (✓, ◷, !) ; seul l'expiré est rouge (tone « late »). L'écran traduit la clé rendue (VendorBook.documents).
// - La phrase « à classer », avec sa raison quand un import l'explique.
// - Les propositions de l'écran « Classer », d'après le nom (proposeVendorTypeFromName du 73a).
// - Les identifiants de « Revoir » (P13), codés court dans l'adresse : jamais un nom.
import type { VendorDocumentState } from "@symbola/contracts";
import { proposeVendorTypeFromName, type VendorTypeProposal } from "@/modules/vendors/service";

type Message = { key: string; values: Record<string, string | number> };
export type DocumentStateView = {
  // ok : à jour ; soon : bientôt ; late : à renouveler (le seul rouge) ; todo : à recevoir, à vérifier ;
  // none : aucune pièce demandée.
  tone: "ok" | "soon" | "late" | "todo" | "none";
  icon: "✓" | "◷" | "!" | null;
  message: Message;
  // Les autres pièces à régler (« + 1 »).
  more: number;
  // La raison, dite sous l'état quand le filtre « Pièces » est posé.
  reason: Message | null;
};

export function documentStateView(state: VendorDocumentState): DocumentStateView {
  const document = state.document ? (state.document.shortLabel ?? state.document.label) : "";
  const more = state.othersToSettle;
  const reason = reasonOf(state);
  switch (state.state) {
    case "up_to_date":
      return { tone: "ok", icon: "✓", message: { key: "upToDate", values: {} }, more: 0, reason: null };
    case "expiring":
      return { tone: "soon", icon: "◷", message: { key: "expiring", values: { document, date: state.document?.validUntil ?? "" } }, more, reason };
    case "expired":
      return { tone: "late", icon: "!", message: { key: "expired", values: { document } }, more, reason };
    case "requested":
      return { tone: "todo", icon: null, message: { key: "requested", values: { document } }, more, reason };
    case "to_verify":
      return { tone: "todo", icon: null, message: { key: "toVerify", values: { document } }, more, reason };
    default:
      return { tone: "none", icon: null, message: { key: "noneRequested", values: {} }, more: 0, reason: null };
  }
}

function reasonOf(state: VendorDocumentState): Message | null {
  const reason = state.reason;
  if (!reason) return null;
  switch (reason.code) {
    case "before_event":
      return reason.couple ? { key: "reasonBeforeEvent", values: { couple: reason.couple } } : { key: "reasonBeforeAnEvent", values: {} };
    case "valid_until":
      return reason.upcomingRetained > 0 ? { key: "reasonValidUntilRetained", values: { date: reason.date, count: reason.upcomingRetained } } : { key: "reasonValidUntil", values: { date: reason.date } };
    case "requested_on":
      return reason.date ? { key: "reasonRequestedOn", values: { date: reason.date } } : null;
    case "uploaded_by_link":
      return reason.at ? { key: "reasonUploadedByLink", values: { date: reason.at } } : { key: "reasonUploadedByLinkUndated", values: {} };
    default:
      // « expires_on » : la date est déjà dans l'état (« Assurance : expire le 15 déc. »).
      return null;
  }
}

// Lot 73b (critère 8) : la phrase d'état du carnet tant que des fiches n'ont pas de métier. Sa raison quand
// le dernier import d'un carnet n'avait pas de colonne « métier » (maquette 18, « Un carnet tout juste
// importé ») ; sinon le nombre seul.
export function unclassifiedNotice({ count, importWithoutTradeColumn }: { count: number; importWithoutTradeColumn: boolean }): { key: "unclassifiedFromImport" | "unclassifiedPlain"; count: number } | null {
  if (count <= 0) return null;
  return { key: importWithoutTradeColumn ? "unclassifiedFromImport" : "unclassifiedPlain", count };
}

// L'écran « Classer » (critère 9) : pour chaque fiche, le métier proposé d'après son nom et le mot qui l'a
// fait proposer ; une fiche déjà classée (« Revoir ») montre son métier enregistré, sans proposition.
export type ClassifyVendor = { id: string; name: string; city: string | null; typeIds: string[] };
export type ClassifyType = { id: string; label: string; starterKey: string | null };
export type ClassifyRow = ClassifyVendor & { proposal: VendorTypeProposal | null; savedTypeId: string | null };

export function classifyRows(
  vendors: ClassifyVendor[],
  types: ClassifyType[],
  synonyms: { key: string; fr: string[]; en: string[] }[],
  options: { withoutFirst: boolean },
): { rows: ClassifyRow[]; proposed: number; withoutProposal: number } {
  const known = new Set(types.map((type) => type.id));
  const rows = vendors.map((vendor): ClassifyRow => {
    const savedTypeId = vendor.typeIds.find((id) => known.has(id)) ?? null;
    return { ...vendor, savedTypeId, proposal: savedTypeId ? null : proposeVendorTypeFromName(vendor.name, types, synonyms) };
  });
  const proposed = rows.filter((row) => row.proposal).length;
  const withoutProposal = rows.filter((row) => !row.proposal && !row.savedTypeId).length;
  const ordered = options.withoutFirst ? [...rows.filter((row) => !row.proposal && !row.savedTypeId), ...rows.filter((row) => row.proposal || row.savedTypeId)] : rows;
  return { rows: ordered, proposed, withoutProposal };
}

// « Revoir » (P13) : les fiches classées passent à l'écran par leurs identifiants, 22 caractères chacun
// (seize octets en base64url), séparés par un point ; 500 fiches tiennent dans une adresse.
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function encodeVendorIds(ids: string[]): string {
  return ids
    .filter((id) => UUID.test(id))
    .map((id) => Buffer.from(id.replace(/-/g, ""), "hex").toString("base64url"))
    .join(".");
}

export function decodeVendorIds(code: string): string[] {
  if (!/^[A-Za-z0-9_.-]*$/.test(code)) return [];
  return code.split(".").flatMap((part) => {
    if (!/^[A-Za-z0-9_-]{22}$/.test(part)) return [];
    const hex = Buffer.from(part, "base64url").toString("hex");
    const id = `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20, 32)}`;
    return UUID.test(id) ? [id] : [];
  });
}

// « 15 déc. » : une date sans heure (AAAA-MM-JJ) lue en UTC, un instant à Paris.
export function shortDayMonth(value: string, locale: "fr" | "en"): string {
  const calendar = /^\d{4}-\d{2}-\d{2}$/.test(value);
  const date = new Date(calendar ? `${value}T00:00:00.000Z` : value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat(locale === "en" ? "en-GB" : "fr-FR", { day: "numeric", month: "short", timeZone: calendar ? "UTC" : "Europe/Paris" }).format(date).replace(/[\u00a0\u202f]/g, " ");
}
