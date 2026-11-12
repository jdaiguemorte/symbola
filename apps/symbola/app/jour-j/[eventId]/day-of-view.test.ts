// Lot 29a (JRJ-02, décision D5) — contenu de l'écran du jour J.
import { describe, expect, it } from "vitest";
import type { EventClient, EventProgram, EventVendorSlot, VendorCandidate } from "@/modules/events/service";
import { buildDayOfView, isDayOfOpen, telHref } from "./day-of-view";

const slot = (id: string, label: string) => ({ id, label }) as EventVendorSlot;
const candidate = (input: Partial<VendorCandidate> & Pick<VendorCandidate, "id" | "vendorSlotId" | "vendorName">) =>
  ({ vendorId: null, outcome: null, ...input }) as VendorCandidate;
const client = (firstName: string, lastName: string | null, phone: string | null) =>
  ({ id: firstName, firstName, lastName, phone, email: null }) as EventClient;

const slots = [slot("s-traiteur", "Traiteur"), slot("s-fleurs", "Fleurs et décoration"), slot("s-dj", "DJ")];
const candidates = [
  candidate({ id: "c-1", vendorSlotId: "s-fleurs", vendorName: "Atelier Verveine", vendorId: "v-verveine", outcome: "selected" }),
  candidate({ id: "c-2", vendorSlotId: "s-traiteur", vendorName: "Maison Ruche", vendorId: "v-ruche", outcome: "selected" }),
  candidate({ id: "c-3", vendorSlotId: "s-traiteur", vendorName: "Le Grand Couvert", vendorId: "v-couvert", outcome: "not_selected" }),
  candidate({ id: "c-4", vendorSlotId: "s-dj", vendorName: "DJ Sam", outcome: null }),
  candidate({ id: "c-5", vendorSlotId: "s-fleurs", vendorName: "Pétales (saisie libre)", outcome: "selected" }),
];
const contacts = [
  { id: "v-ruche", name: "Maison Ruche", contactName: "Karim Haddad", phone: "06 12 34 56 78", email: "karim@ruche.example" },
  { id: "v-verveine", name: "Atelier Verveine", contactName: null, phone: null, email: "bonjour@verveine.example" },
];
const program: EventProgram = {
  items: [
    {
      id: "i-1",
      eventId: "e",
      startTime: "16:00",
      endTime: "17:00",
      label: "Cérémonie laïque",
      location: "Jardin",
      internalNote: "Prévoir les parapluies",
      participants: [
        { vendorSlotId: "s-fleurs", label: "Fleurs et décoration" },
        { vendorSlotId: null, label: "Officiante" },
      ],
    },
  ],
  overlaps: [],
  updatedAt: null,
};

describe("JRJ-02 — Contenu de l'écran du jour J (décision D5)", () => {
  it("les prestataires retenus, dans l'ordre des postes, avec leurs coordonnées ; ni écartés ni en lice", () => {
    const view = buildDayOfView({ event: { clients: [] }, program, places: [], slots, candidates, contacts });
    expect(view.vendors).toEqual([
      { id: "c-2", slot: "Traiteur", name: "Maison Ruche", detail: "Karim Haddad", phone: "06 12 34 56 78", email: "karim@ruche.example" },
      { id: "c-1", slot: "Fleurs et décoration", name: "Atelier Verveine", detail: null, phone: null, email: "bonjour@verveine.example" },
      { id: "c-5", slot: "Fleurs et décoration", name: "Pétales (saisie libre)", detail: null, phone: null, email: null },
    ]);
  });

  it("le programme garde ses notes internes ; chaque participant d'un poste nomme ses prestataires retenus", () => {
    const view = buildDayOfView({ event: { clients: [] }, program, places: [], slots, candidates, contacts });
    expect(view.items[0]).toMatchObject({ label: "Cérémonie laïque", note: "Prévoir les parapluies", location: "Jardin" });
    expect(view.items[0]!.participants).toEqual([
      { label: "Fleurs et décoration", vendors: ["Atelier Verveine", "Pétales (saisie libre)"] },
      { label: "Officiante", vendors: [] },
    ]);
  });

  it("module Prestataires non souscrit : les noms restent, sans coordonnées", () => {
    const view = buildDayOfView({ event: { clients: [] }, program, places: [], slots, candidates, contacts: null });
    expect(view.vendors.map((vendor) => [vendor.name, vendor.phone, vendor.email])).toEqual([
      ["Maison Ruche", null, null],
      ["Atelier Verveine", null, null],
      ["Pétales (saisie libre)", null, null],
    ]);
  });

  it("les clients, avec nom complet, téléphone et e-mail", () => {
    const view = buildDayOfView({
      event: { clients: [client("Léa", "Martin", "07 00 00 00 01"), client("Hugo", null, null)] },
      program,
      places: [{ id: "p", eventId: "e", label: "Domaine des Tilleuls", address: "12 route des Vignes", vendorId: null }],
      slots,
      candidates,
      contacts,
    });
    expect(view.clients).toEqual([
      { name: "Léa Martin", detail: null, phone: "07 00 00 00 01", email: null },
      { name: "Hugo", detail: null, phone: null, email: null },
    ]);
    expect(view.places).toEqual([{ id: "p", label: "Domaine des Tilleuls", address: "12 route des Vignes" }]);
  });

  it("un lien d'appel garde les chiffres et le « + » ; rien pour un numéro vide", () => {
    expect(telHref("06 12 34 56 78")).toBe("tel:0612345678");
    expect(telHref("+33 (0)6.12.34.56.78")).toBe("tel:+330612345678");
    expect(telHref("")).toBeNull();
    expect(telHref(null)).toBeNull();
  });

  it("l'écran existe pour un évènement confirmé ou réalisé, et daté", () => {
    expect(isDayOfOpen({ status: "confirmed", eventDate: "2026-06-20" })).toBe(true);
    expect(isDayOfOpen({ status: "done", eventDate: "2026-06-20" })).toBe(true);
    expect(isDayOfOpen({ status: "confirmed", eventDate: null })).toBe(false);
    expect(isDayOfOpen({ status: "prospect", eventDate: "2026-06-20" })).toBe(false);
    expect(isDayOfOpen({ status: "lost", eventDate: "2026-06-20" })).toBe(false);
  });
});
