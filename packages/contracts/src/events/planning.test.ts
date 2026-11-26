// Lot 70a (CHR-02 ; A19) — contrat de l'événement events.task.assigned : l'exemple figé reste publiable,
// et la charge utile ne porte que des identifiants (SEC-20) ; seuil « Bientôt » de l'état d'échéance.
import { describe, expect, it } from "vitest";
import { EVT_TASK_ASSIGNED, EVT_TASK_ASSIGNED_VERSION, taskAssignedPayloadSchema, taskSoonDaysSchema, TASK_DUE_STATES } from "./planning";

const FROZEN_PAYLOAD = {
  taskId: "6b1f7e2a-7e3a-4c9a-9a3a-6b1f7e2a7e3a",
  eventId: "9a3a6b1f-7e2a-4c9a-9a3a-6b1f7e2a7e3a",
  assigneeUserId: "7e2a6b1f-9a3a-4c9a-9a3a-6b1f7e2a7e3a",
  assignedByUserId: "4c9a6b1f-7e2a-4c9a-9a3a-6b1f7e2a7e3a",
};

describe("CHR-02 — Contrat de l'événement events.task.assigned (A19)", () => {
  it("accepte l'exemple figé, avec ou sans évènement, seul ou en lot", () => {
    expect(() => taskAssignedPayloadSchema.parse(FROZEN_PAYLOAD)).not.toThrow();
    expect(() => taskAssignedPayloadSchema.parse({ ...FROZEN_PAYLOAD, eventId: null })).not.toThrow();
    expect(() => taskAssignedPayloadSchema.parse({ ...FROZEN_PAYLOAD, batch: { id: "1a2b6b1f-7e2a-4c9a-9a3a-6b1f7e2a7e3a", count: 3 } })).not.toThrow();
  });

  it("garde le nom et la version attendus", () => {
    expect(EVT_TASK_ASSIGNED).toBe("events.task.assigned");
    expect(EVT_TASK_ASSIGNED_VERSION).toBe(1);
  });

  it("ne transporte que des identifiants (aucun libellé, aucun nom)", () => {
    expect(Object.keys(taskAssignedPayloadSchema.shape).sort()).toEqual(["assignedByUserId", "assigneeUserId", "batch", "eventId", "taskId"]);
    const parsed = taskAssignedPayloadSchema.parse({ ...FROZEN_PAYLOAD, label: "Réserver la navette", name: "Bastien" } as unknown);
    expect(parsed).not.toHaveProperty("label");
    expect(parsed).not.toHaveProperty("name");
  });

  it("refuse un identifiant qui n'en est pas un, un lot vide ou démesuré", () => {
    expect(() => taskAssignedPayloadSchema.parse({ ...FROZEN_PAYLOAD, assigneeUserId: "bastien" })).toThrow();
    expect(() => taskAssignedPayloadSchema.parse({ ...FROZEN_PAYLOAD, batch: { id: FROZEN_PAYLOAD.taskId, count: 0 } })).toThrow();
    expect(() => taskAssignedPayloadSchema.parse({ ...FROZEN_PAYLOAD, batch: { id: FROZEN_PAYLOAD.taskId, count: 501 } })).toThrow();
  });
});

describe("UX-06, CHR-05 — États d'une tâche sans « En cours », avec « Bientôt » (Q47-4)", () => {
  it("les états d'échéance sont fermés et ne comptent pas « En cours »", () => {
    expect([...TASK_DUE_STATES]).toEqual(["late", "today", "tomorrow", "soon", "later"]);
  });

  it("le seuil « Bientôt » va de 1 à 30 jours", () => {
    expect(taskSoonDaysSchema.safeParse(7).success).toBe(true);
    expect(taskSoonDaysSchema.safeParse(0).success).toBe(false);
    expect(taskSoonDaysSchema.safeParse(31).success).toBe(false);
    expect(taskSoonDaysSchema.safeParse(2.5).success).toBe(false);
  });
});
