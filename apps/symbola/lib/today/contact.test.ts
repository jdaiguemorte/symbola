// Lot 72a (HUB-08, UX-13 ; J7 ; critère 4) — qui appeler : une ligne qui attend un prestataire porte le
// contact et le téléphone de sa fiche ; une ligne qui attend les mariés, ceux du premier client ; sans
// téléphone, l'e-mail ; sans rien, aucun contact.
import { describe, expect, it } from "vitest";
import type { EventSummary } from "@symbola/contracts";
import type { TodayItem } from "./rank";
import { attachContacts } from "./contact";

const client = (position: number, firstName: string, phone: string | null, email: string | null) => ({ id: `c${position}`, contactId: `k${position}`, firstName, lastName: "Martin", position, email, phone, addressLine: null, postalCode: null, city: null });
const event = (id: string, clients: ReturnType<typeof client>[]): EventSummary => ({ id, status: "confirmed", phase: "confirmed", eventDate: "2027-06-12", timeZone: "Europe/Paris", venueName: null, venueCity: null, clients, isDemo: false });
const line = (key: string, actor: TodayItem["actor"], eventId: string | null = "e1"): TodayItem => ({ key, kind: "client_task", eventId, eventNames: null, title: key, dueOn: null, since: null, actor, href: "/" });

describe("HUB-08, UX-13 — Le contact de la personne attendue (lot 72a, J7, critère 4)", () => {
  const events = [event("e1", [client(2, "Paul", "06 00 00 00 02", null), client(1, "Léa", "06 00 00 41 27", "lea@example.test")]), event("e2", [client(1, "Inès", null, "ines@example.test")]), event("e3", [client(1, "Nora", null, null)])];
  const vendors = new Map([
    ["v1", { name: "Studio Lumière", contactName: "Karim Haddad", phone: "06 00 00 41 28", email: "studio@example.test" }],
    ["v2", { name: "Fleurs du Clain", contactName: null, phone: null, email: null }],
  ]);

  it("les mariés : le premier client, nom et téléphone ; sans téléphone, l'e-mail ; sans rien, rien", () => {
    const [first, second, none] = attachContacts([line("a", { kind: "client" }), line("b", { kind: "client" }, "e2"), line("c", { kind: "client" }, "e3")], events, vendors);
    expect(first!.contact).toEqual({ name: "Léa Martin", phone: "06 00 00 41 27", email: "lea@example.test" });
    expect(second!.contact).toEqual({ name: "Inès Martin", phone: null, email: "ines@example.test" });
    expect(none!.contact).toBeUndefined();
  });

  it("un prestataire : le contact de sa fiche et son téléphone ; une fiche sans coordonnées ne donne rien", () => {
    const [studio, flowers] = attachContacts([line("v", { kind: "vendor", name: "Studio Lumière", vendorId: "v1" }), line("w", { kind: "vendor", name: "Fleurs du Clain", vendorId: "v2" })], events, vendors);
    expect(studio!.contact).toEqual({ name: "Karim Haddad", phone: "06 00 00 41 28", email: "studio@example.test" });
    expect(flowers!.contact).toBeUndefined();
  });

  it("une ligne qui vous revient n'a pas de contact", () => {
    expect(attachContacts([line("moi", { kind: "you" })], events, vendors)[0]!.contact).toBeUndefined();
  });
});
