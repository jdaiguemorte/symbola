// Lot 16 (ADR 0045) — vocabulaire des clients : celui du type de l'événement
// affiché, sinon celui du métier de l'organisation.
import { beforeEach, describe, expect, it, vi } from "vitest";

const EVENT = "11111111-1111-4111-8111-111111111111";
const QUOTE = "22222222-2222-4222-8222-222222222222";

const state = vi.hoisted(() => ({
  pathname: "/",
  metier: "wedding_planner" as string,
  audiences: new Map<string, "couple" | "clients" | null>(),
}));

vi.mock("react", async (importOriginal) => ({ ...(await importOriginal<typeof import("react")>()), cache: <T,>(fn: T) => fn }));
vi.mock("next/headers", () => ({ headers: async () => new Headers({ "x-pathname": state.pathname }) }));
vi.mock("@/modules/events/service", () => ({
  getEventAudience: async (_org: string, eventId: string) => state.audiences.get(eventId) ?? null,
  listEventAudiences: async () => new Map(state.audiences),
}));
vi.mock("@/modules/quotes/service", () => ({
  getQuote: async (_org: string, quoteId: string) => {
    if (quoteId !== QUOTE) throw new Error("devis introuvable");
    return { eventId: EVENT };
  },
}));
vi.mock("./auth-context", () => ({ getAuthContext: async () => ({ status: "unauthenticated" }) }));
vi.mock("./vendors/catalog", () => ({ organizationMetier: async () => state.metier }));

const { clientFieldLabelsByAudience, messagesFor, requestAudience } = await import("./vocabulary");

describe("lot 16 (ADR 0045) — Vocabulaire selon le type de l'événement", () => {
  beforeEach(() => {
    state.pathname = "/";
    state.metier = "wedding_planner";
    state.audiences = new Map([[EVENT, "clients"]]);
  });

  it("sur la page d'un événement, sur son budget, son espace client et ses devis : le vocabulaire de son type", async () => {
    for (const pathname of [`/events/${EVENT}`, `/events/${EVENT}/programme`, `/budget/${EVENT}`, `/espace/${EVENT}`, `/devis/${QUOTE}`]) {
      state.pathname = pathname;
      expect(await requestAudience("org-1"), pathname).toBe("clients");
    }
  });

  it("ailleurs, ou pour un événement sans type : le vocabulaire du métier", async () => {
    for (const pathname of ["/events", "/events/new", "/events/parametres/types", "/devis/catalogue", `/devis/${EVENT.replace(/1/g, "3")}`]) {
      state.pathname = pathname;
      expect(await requestAudience("org-1"), pathname).toBe("couple");
    }
    state.audiences.set(EVENT, null);
    state.pathname = `/events/${EVENT}`;
    expect(await requestAudience("org-1")).toBe("couple");
    state.metier = "event_agency";
    expect(await requestAudience("org-1")).toBe("clients");
  });

  it("une agence lit « les mariés » sur la fiche d'un mariage ; sans organisation, les mariés comme avant", async () => {
    state.metier = "event_agency";
    state.audiences.set(EVENT, "couple");
    state.pathname = `/events/${EVENT}`;
    expect(await requestAudience("org-1")).toBe("couple");
    state.pathname = "/events";
    expect(await requestAudience("org-1")).toBe("clients");
    expect(await requestAudience(null)).toBe("couple");
  });

  it("les textes « le client » remplacent ceux des mariés, et eux seuls", () => {
    expect(messagesFor("fr", "couple").Events.clientContactTitle).toBe("Coordonnées des mariés");
    expect(messagesFor("fr", "clients").Events.clientContactTitle).toBe("Coordonnées des clients");
    expect(messagesFor("en", "clients").ClientSpace.title).toBe("My event");
    expect(messagesFor("fr", "clients").Events.title).toBe(messagesFor("fr", "couple").Events.title);
  });

  it("le formulaire de création reçoit les libellés des deux vocabulaires", () => {
    const labels = clientFieldLabelsByAudience("fr");
    expect(labels.couple.client1FirstName).toBe("Prénom du premier marié");
    expect(labels.clients.client1FirstName).toBe("Prénom du premier contact");
    expect(clientFieldLabelsByAudience("en").clients.client2LastName).toMatch(/contact/i);
  });
});

const OTHER = "33333333-3333-4333-8333-333333333333";

describe("Lot 20 (décision 6) — Écrans qui mêlent les événements", () => {
  beforeEach(() => {
    state.metier = "wedding_planner";
  });

  it("des mariages et un séminaire : vocabulaire neutre sur l'accueil, la liste, les tâches, les devis et les encaissements", async () => {
    state.audiences = new Map([
      [EVENT, "couple"],
      [OTHER, "clients"],
    ]);
    for (const pathname of ["/", "/events", "/taches", "/devis", "/devis/encaissements"]) {
      state.pathname = pathname;
      expect(await requestAudience("org-1"), pathname).toBe("clients");
    }
    // Ailleurs (réglages, profil) : le vocabulaire du métier.
    state.pathname = "/profil";
    expect(await requestAudience("org-1")).toBe("couple");
  });

  it("des mariages seulement, ou un événement sans type qui suit le métier : le vocabulaire du métier", async () => {
    state.audiences = new Map([
      [EVENT, "couple"],
      [OTHER, null],
    ]);
    state.pathname = "/taches";
    expect(await requestAudience("org-1")).toBe("couple");
  });
});
