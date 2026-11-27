// Lot 72a (HUB-08, UX-13 ; J7 ; critère 4) — qui appeler : une ligne qui attend les mariés porte le nom et
// les coordonnées du premier client de l'évènement ; une ligne qui attend un prestataire, le contact de sa
// fiche. Sans téléphone, l'e-mail ; sans rien, aucun contact. Les coordonnées sont lues à l'affichage
// (champs déjà déclarés au registre RGPD), jamais journalisées. Règle pure : l'appelant lit les fiches des
// prestataires en une requête.
import type { EventSummary, TodayContact } from "@symbola/contracts";
import type { TodayItem } from "./rank";

export type VendorContactCard = { name: string; contactName: string | null; phone: string | null; email: string | null };

function contactOf(name: string, phone: string | null, email: string | null): TodayContact | undefined {
  return phone || email ? { name, phone: phone || null, email: email || null } : undefined;
}

export function attachContacts(items: TodayItem[], events: readonly EventSummary[], vendors: ReadonlyMap<string, VendorContactCard>): TodayItem[] {
  const firstClient = new Map(
    events.map((event) => {
      const [first] = [...event.clients].sort((a, b) => a.position - b.position);
      return [event.id, first] as const;
    }),
  );
  return items.map((item) => {
    let contact: TodayContact | undefined;
    if (item.actor.kind === "client" && item.eventId) {
      const client = firstClient.get(item.eventId);
      if (client?.contactId) contact = contactOf([client.firstName, client.lastName].filter(Boolean).join(" "), client.phone, client.email);
    } else if (item.actor.kind === "vendor" && item.actor.vendorId) {
      const vendor = vendors.get(item.actor.vendorId);
      if (vendor) contact = contactOf(vendor.contactName ?? vendor.name, vendor.phone, vendor.email);
    }
    return contact ? { ...item, contact } : item;
  });
}
