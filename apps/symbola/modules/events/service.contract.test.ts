// SOC-06 — étant donné une modification incompatible de l'interface
// service.ts d'events, ce fichier cesse de compiler : la vérification
// `satisfies EventsServiceContract` dans service.ts exige que le vrai
// module respecte structurellement le contrat publié dans
// @symbola/contracts.
import { describe, expect, it } from "vitest";
import * as eventsService from "./service";

describe("SOC-06 — Contrat du service.ts d'events", () => {
  it("expose toutes les fonctions du contrat EventsServiceContract", () => {
    expect(typeof eventsService.listEvents).toBe("function");
    expect(typeof eventsService.getEvent).toBe("function");
    expect(typeof eventsService.createProspect).toBe("function");
    expect(typeof eventsService.changeEventStatus).toBe("function");
    expect(typeof eventsService.listProspectSources).toBe("function");
    expect(typeof eventsService.createProspectSource).toBe("function");
    expect(typeof eventsService.listLossReasons).toBe("function");
    expect(typeof eventsService.createLossReason).toBe("function");
  });
});
