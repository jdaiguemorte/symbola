// EVT-03 : « chaque statut a sa couleur ». Présentation seulement (les
// statuts sont fixés par le PRD) ; la couleur accompagne toujours le
// libellé, jamais seule, avec un contraste supérieur à 7:1 (WCAG AA).
import type { VendorSlotStatus } from "@/modules/events/service";

export const VENDOR_STATUS_LABEL_KEYS: Record<VendorSlotStatus, string> = {
  to_find: "vendorStatusToFind",
  quote_requested: "vendorStatusQuoteRequested",
  quote_received: "vendorStatusQuoteReceived",
  booked: "vendorStatusBooked",
  not_required: "vendorStatusNotRequired",
};

export const VENDOR_STATUS_COLORS: Record<VendorSlotStatus, { background: string; color: string }> = {
  to_find: { background: "#fde2e2", color: "#7f1d1d" },
  quote_requested: { background: "#fef3c7", color: "#78350f" },
  quote_received: { background: "#dbeafe", color: "#1e3a8a" },
  booked: { background: "#dcfce7", color: "#14532d" },
  not_required: { background: "#e5e7eb", color: "#374151" },
};
