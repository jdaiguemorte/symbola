// Lot 70a (CHR-02 ; A1, A3) — la valeur du choix « Qui s'en charge » : un collègue, les clients, un
// prestataire ; une valeur inconnue ou un identifiant forgé est refusé avant le service.
import { describe, expect, it } from "vitest";
import { readResponsibleValue, responsibleValue } from "./task-responsible";

const MEMBER = "7e2a6b1f-9a3a-4c9a-9a3a-6b1f7e2a7e3a";
const VENDOR = "9a3a6b1f-7e2a-4c9a-9a3a-6b1f7e2a7e3a";

describe("CHR-02 — Qui s'en charge : la valeur du choix", () => {
  it("une tâche « planner » confiée se dit par son membre ; sans personne, « planner »", () => {
    expect(responsibleValue({ responsible: "planner", vendorCandidateId: null, assigneeUserId: MEMBER })).toBe(`member:${MEMBER}`);
    expect(responsibleValue({ responsible: "planner", vendorCandidateId: null, assigneeUserId: null })).toBe("planner");
    expect(responsibleValue({ responsible: "vendor", vendorCandidateId: VENDOR })).toBe(`vendor:${VENDOR}`);
    expect(responsibleValue({ responsible: "clients", vendorCandidateId: null })).toBe("clients");
  });

  it("se relit, et refuse une valeur inconnue ou un identifiant forgé", () => {
    expect(readResponsibleValue(`member:${MEMBER}`)).toEqual({ responsible: "planner", vendorCandidateId: null, assigneeUserId: MEMBER });
    expect(readResponsibleValue(`vendor:${VENDOR}`)).toEqual({ responsible: "vendor", vendorCandidateId: VENDOR });
    expect(readResponsibleValue("clients")).toEqual({ responsible: "clients", vendorCandidateId: null });
    expect(readResponsibleValue("member:bastien")).toBeNull();
    expect(readResponsibleValue("vendor")).toBeNull();
    expect(readResponsibleValue("admin")).toBeNull();
  });
});
