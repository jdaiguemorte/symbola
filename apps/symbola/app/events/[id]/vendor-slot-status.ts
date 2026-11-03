// EVT-03 : « chaque statut a sa couleur ». Présentation seulement (les
// statuts sont fixés par le PRD) ; la couleur accompagne toujours le
// libellé, jamais seule, contrastes WCAG AA (charte, lot 7).
import type { VendorSlotStatus } from "@/modules/events/service";

export const VENDOR_STATUS_LABEL_KEYS: Record<VendorSlotStatus, string> = {
  to_find: "vendorStatusToFind",
  quote_requested: "vendorStatusQuoteRequested",
  quote_received: "vendorStatusQuoteReceived",
  booked: "vendorStatusBooked",
  not_required: "vendorStatusNotRequired",
};

// Pastilles de la charte (globals.css), contrastes AA.
export const VENDOR_STATUS_CLASSES: Record<VendorSlotStatus, string> = {
  to_find: "badge badge-terracotta",
  quote_requested: "badge badge-ambre",
  quote_received: "badge badge-bleu",
  booked: "badge badge-sauge",
  not_required: "badge",
};
