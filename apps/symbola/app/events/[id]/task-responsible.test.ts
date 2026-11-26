// Lot 70a (CHR-02 ; A1, A3) — la valeur du choix « Qui s'en charge » : un collègue, les clients, un
// prestataire ; une valeur inconnue ou un identifiant forgé est refusé avant le service.
import { describe, expect, it } from "vitest";
import { readResponsibleCreate, readResponsibleEdit, readResponsibleValue, responsibleSelection, responsibleValue, UNCHANGED_RESPONSIBLE } from "./task-responsible";

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

// Revue du 70a : une tâche sans personne, ou à un accès retiré, s'enregistrait mal (option désactivée,
// champ non envoyé, « date invalide »). La valeur est désormais « inchangé », envoyée et comprise.
describe("CHR-02 — Qui s'en charge : une valeur qu'on ne peut plus choisir reste inchangée", () => {
  const me = { id: MEMBER, name: "Léa Martin", me: true, removed: false };
  const gone = { id: VENDOR, name: "Bastien Roy", me: false, removed: true };

  it("une valeur qu'on peut choisir est montrée telle quelle", () => {
    expect(responsibleSelection(`member:${MEMBER}`, [me], [])).toEqual({ selected: `member:${MEMBER}`, unchanged: null });
    expect(responsibleSelection("planner", [], [])).toEqual({ selected: "planner", unchanged: null });
    expect(responsibleSelection(`vendor:${VENDOR}`, [me], [VENDOR])).toEqual({ selected: `vendor:${VENDOR}`, unchanged: null });
  });

  it("sans personne, à un accès retiré ou à un prestataire retiré : « inchangé », nommé", () => {
    expect(responsibleSelection("planner", [me], [])).toEqual({ selected: UNCHANGED_RESPONSIBLE, unchanged: { kind: "nobody" } });
    expect(responsibleSelection(`member:${VENDOR}`, [me, gone], [])).toEqual({ selected: UNCHANGED_RESPONSIBLE, unchanged: { kind: "removedMember", name: "Bastien Roy" } });
    expect(responsibleSelection("vendor", [me], [])).toEqual({ selected: UNCHANGED_RESPONSIBLE, unchanged: { kind: "removedVendor" } });
  });

  it("à l'enregistrement, « inchangé » ou un champ absent ne touche pas à la personne", () => {
    expect(readResponsibleEdit(UNCHANGED_RESPONSIBLE)).toBe(UNCHANGED_RESPONSIBLE);
    expect(readResponsibleEdit(null)).toBe(UNCHANGED_RESPONSIBLE);
    expect(readResponsibleEdit(undefined)).toBe(UNCHANGED_RESPONSIBLE);
    expect(readResponsibleEdit(`member:${MEMBER}`)).toEqual({ responsible: "planner", vendorCandidateId: null, assigneeUserId: MEMBER });
    expect(readResponsibleEdit("member:bastien")).toBeNull();
  });

  it("à la création, « inchangé » revient à la personne qui crée (A3)", () => {
    expect(readResponsibleCreate(UNCHANGED_RESPONSIBLE)).toEqual({ responsible: "planner", vendorCandidateId: null });
    expect(readResponsibleCreate("")).toBeNull();
  });
});
