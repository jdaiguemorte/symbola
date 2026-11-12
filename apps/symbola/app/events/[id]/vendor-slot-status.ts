// PRD-EVT-03 : « chaque statut a sa couleur ». Présentation seulement ; la
// couleur accompagne toujours le libellé, jamais seule, contrastes WCAG AA
// (charte, lot 7). Lot 28a (PRE-02) : le poste montre le statut le plus avancé
// de ses prestataires, « À trouver » sans prestataire, ou « Non requis ».
import type { VendorSlotStatus } from "@/modules/events/service";

export const VENDOR_STATUS_LABEL_KEYS: Record<VendorSlotStatus, string> = {
  to_find: "vendorStatusToFind",
  shortlisted: "vendorStatusShortlisted",
  contacted: "vendorStatusContacted",
  quote_received: "vendorStatusQuoteReceived",
  retained: "vendorStatusRetained",
  contract_signed: "vendorStatusContractSigned",
  paid_off: "vendorStatusPaidOff",
  not_required: "vendorStatusNotRequired",
};

// Pastilles de la charte (globals.css), contrastes AA.
export const VENDOR_STATUS_CLASSES: Record<VendorSlotStatus, string> = {
  to_find: "badge badge-terracotta",
  shortlisted: "badge badge-ambre",
  contacted: "badge badge-ambre",
  quote_received: "badge badge-bleu",
  retained: "badge badge-sauge",
  contract_signed: "badge badge-sauge",
  paid_off: "badge badge-sauge",
  not_required: "badge",
};
