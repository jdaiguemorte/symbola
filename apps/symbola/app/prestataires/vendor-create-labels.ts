// Lot 73d (NFR-02, ADR 0115 ; consigne du chantier du 28/11) — les textes de la fenêtre unique de création,
// lus côté serveur et passés à la fenêtre par l'écran qui l'ouvre : l'espace « VendorCreate » est réservé au
// serveur (lib/client-messages.ts) et n'alourdit pas chaque page. Les modèles gardent leurs « {nom} », que la
// fenêtre remplit (fillLabel).
import { getTranslations } from "next-intl/server";
import type { VendorCreateLabels } from "./vendor-create-model";
import { VENDOR_CREATE_LABEL_KEYS } from "./vendor-create-model";

export async function vendorCreateLabels(): Promise<VendorCreateLabels> {
  const t = await getTranslations("VendorCreate");
  return Object.fromEntries(VENDOR_CREATE_LABEL_KEYS.map((key) => [key, String(t.raw(key))])) as VendorCreateLabels;
}
