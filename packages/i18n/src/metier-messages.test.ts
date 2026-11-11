// Lot 16 (L16-HUB-21) — vocabulaire selon le métier : les textes d'un métier
// remplacent ceux du catalogue, clé par clé, sans rien perdre d'autre.
import { describe, expect, it } from "vitest";
import frMessages from "./messages/fr.json";
import agencyFr from "./messages/vocabulary/clients.fr.json";
import { withMetierMessages } from "./metier-messages";

describe("L16-HUB-21 — Vocabulaire selon le métier", () => {
  it("une agence événementielle lit « les clients » là où une wedding planner lit « les mariés »", () => {
    const agency = withMetierMessages(frMessages, agencyFr);
    expect(frMessages.Events.tabClients).toBe("Mariés");
    expect(agency.Events.tabClients).toBe("Clients");
    expect(agency.Events.nextStep.invite_clients.action).toBe("Inviter les clients");
    // Le reste du catalogue est intact, listes de l'aide comprises.
    expect(agency.Events.title).toBe(frMessages.Events.title);
    expect(Array.isArray(agency.Help.eventsDetail.faq)).toBe(true);
    expect(agency.Help.eventsDetail.faq).toHaveLength(frMessages.Help.eventsDetail.faq.length);
    expect(agency.Help.eventsDetail.faq[3]!.q).toBe("Que voient les clients ?");
    expect(agency.Help.eventsDetail.faq[0]).toEqual(frMessages.Help.eventsDetail.faq[0]);
  });

  it("sans textes propres au métier, le catalogue est rendu tel quel", () => {
    expect(withMetierMessages(frMessages, null)).toBe(frMessages);
  });

  it("aucun texte d'agence ne parle encore de mariés", () => {
    expect(JSON.stringify(agencyFr)).not.toMatch(/marié/i);
  });
});
