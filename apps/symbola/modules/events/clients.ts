// Lot 36a (CRM-03, UX-02 ; décisions D4 et D5 ; ADR 0069) — les clients d'un évènement sont des
// contacts du hub. La ligne d'event_clients n'est que le lien (évènement, contact, position) ; le
// nom et les coordonnées se lisent chez le hub, par son service, par lot pour les listes. Un lien
// sans contact est un client retiré par le RGPD : il s'affiche « [anonymisé] ».
import type { EventClientInput } from "@symbola/contracts";
import { eventClients } from "@symbola/db/schema/events";
import { ANONYMIZED } from "@symbola/privacy";
import { getContactsByIds, resolveContact } from "@/modules/hub/service";

export type EventClientLinkRow = typeof eventClients.$inferSelect;

// Un client tel que le module le montre : le lien, complété par son contact.
export type EventClientRow = EventClientLinkRow & {
  firstName: string;
  lastName: string | null;
  email: string | null;
  phone: string | null;
  addressLine: string | null;
  postalCode: string | null;
  city: string | null;
};

export async function withContacts(organizationId: string, links: readonly EventClientLinkRow[]): Promise<EventClientRow[]> {
  const contacts = await getContactsByIds(
    organizationId,
    links.map((link) => link.contactId).filter((id): id is string => id !== null),
  );
  return links.map((link) => {
    const contact = link.contactId ? contacts.get(link.contactId) : undefined;
    if (!contact || contact.anonymized) {
      return { ...link, firstName: ANONYMIZED, lastName: null, email: null, phone: null, addressLine: null, postalCode: null, city: null };
    }
    return {
      ...link,
      firstName: contact.kind === "person" ? (contact.firstName ?? "") : contact.displayName,
      lastName: contact.kind === "person" ? contact.lastName : null,
      email: contact.email,
      phone: contact.phone,
      addressLine: contact.addressLine,
      postalCode: contact.postalCode,
      city: contact.city,
    };
  });
}

// Le contact de chaque client à enregistrer (UX-02, DAT-12) : celui qu'on a choisi, celui qui porte
// déjà l'adresse e-mail donnée, ou un nouveau, créé dans le hub. Dans l'ordre des clients.
export async function resolveClientContacts(organizationId: string, clients: readonly EventClientInput[], options: { isDemo?: boolean } = {}): Promise<string[]> {
  const ids: string[] = [];
  for (const client of clients) {
    const contact = await resolveContact(
      organizationId,
      {
        contactId: client.contactId ?? null,
        kind: "person",
        firstName: client.firstName,
        lastName: client.lastName ?? null,
        email: client.email ?? null,
        phone: client.phone ?? null,
        addressLine: client.addressLine ?? null,
        postalCode: client.postalCode ?? null,
        city: client.city ?? null,
      },
      options,
    );
    // Un même contact n'est client qu'une fois d'un même évènement.
    if (!ids.includes(contact.id)) ids.push(contact.id);
  }
  return ids;
}
