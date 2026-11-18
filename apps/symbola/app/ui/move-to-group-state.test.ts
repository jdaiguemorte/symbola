// Socle des lots 44 et 50 (D0) — logique du déplacement vers un groupe. L'interaction (clavier,
// doigt, souris, annonce, focus) est prouvée par les parcours Playwright des lots 44 (CRM-02) et
// 50 (INV-05), qui emploient le composant.
import { describe, expect, it } from "vitest";
import { assignmentSignature, createSerialQueue, itemsInGroup, moveAssignment, toAssignment, type MovableItem } from "./move-to-group-state";

const items: MovableItem[] = [
  { id: "a", label: "Léa M.", groupId: "nouvelle" },
  { id: "b", label: "Inès K.", groupId: null },
  { id: "c", label: "Paul D.", groupId: "rendez-vous" },
];

describe("Socle des lots 44 et 50 (D0) — déplacer un élément vers un groupe", () => {
  it("déplace un élément ; un élément inconnu ou déjà dans le groupe ne change rien", () => {
    const start = toAssignment(items);
    const moved = moveAssignment(start, "b", "rendez-vous");
    expect(itemsInGroup(items, moved, "rendez-vous").map((item) => item.id)).toEqual(["b", "c"]);
    expect(itemsInGroup(items, moved, null)).toEqual([]);
    expect(moveAssignment(start, "inconnu", "rendez-vous")).toBe(start);
    expect(moveAssignment(start, "a", "nouvelle")).toBe(start);
  });

  it("les éléments hors groupe restent visibles dans le groupe null (« Non placés »)", () => {
    expect(itemsInGroup(items, toAssignment(items), null).map((item) => item.label)).toEqual(["Inès K."]);
  });

  it("la signature change quand le serveur déplace, renomme, ajoute ou retire un élément", () => {
    const base = assignmentSignature(items);
    expect(assignmentSignature([...items])).toBe(base);
    expect(assignmentSignature(items.map((item) => (item.id === "a" ? { ...item, groupId: "devis" } : item)))).not.toBe(base);
    expect(assignmentSignature(items.map((item) => (item.id === "a" ? { ...item, label: "Léa Martin" } : item)))).not.toBe(base);
    expect(assignmentSignature(items.slice(1))).not.toBe(base);
  });

  it("la file enregistre l'un après l'autre, même si le premier est plus lent, et survit à un échec", async () => {
    const queue = createSerialQueue();
    const order: string[] = [];
    const slow = queue.run(async () => {
      await new Promise((resolve) => setTimeout(resolve, 20));
      order.push("premier");
      throw new Error("refusé");
    });
    const fast = queue.run(async () => {
      order.push("second");
      return true;
    });
    expect(queue.pending).toBe(2);
    await expect(slow).rejects.toThrow("refusé");
    await expect(fast).resolves.toBe(true);
    expect(order).toEqual(["premier", "second"]);
    await Promise.resolve();
    expect(queue.pending).toBe(0);
  });
});
