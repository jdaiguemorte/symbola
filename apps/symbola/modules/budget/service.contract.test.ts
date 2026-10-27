// SOC-06 — étant donné une modification incompatible de l'interface
// service.ts de budget, ce fichier cesse de compiler : la vérification
// `satisfies BudgetServiceContract` (via _contractCheck) dans service.ts
// exige que le vrai module respecte structurellement le contrat publié
// dans @symbola/contracts.
import { describe, expect, it } from "vitest";
import * as budgetService from "./service";

describe("SOC-06 — Contrat du service.ts de budget", () => {
  it("expose toutes les fonctions du contrat BudgetServiceContract", () => {
    expect(typeof budgetService.listAllocationModels).toBe("function");
    expect(typeof budgetService.createAllocationModel).toBe("function");
    expect(typeof budgetService.removeAllocationModel).toBe("function");
    expect(typeof budgetService.getEventBudget).toBe("function");
    expect(typeof budgetService.simulateEventBudget).toBe("function");
    expect(typeof budgetService.adjustEventBudgetItem).toBe("function");
    expect(typeof budgetService.listBudgetLines).toBe("function");
    expect(typeof budgetService.confirmEventBudget).toBe("function");
    expect(typeof budgetService.updateBudgetLine).toBe("function");
    expect(typeof budgetService.listBudgetLineHistory).toBe("function");
  });
});
