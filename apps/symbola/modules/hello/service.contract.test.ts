// SOC-06 — étant donné une modification incompatible de l'interface
// service.ts de hello, ce fichier cesse de compiler : la ligne
// `satisfies HelloServiceContract` exige que le vrai module respecte
// structurellement le contrat publié dans @symbola/contracts.
import { describe, expect, it } from "vitest";
import type { HelloServiceContract } from "@symbola/contracts";
import * as helloService from "./service";

const _contractCheck = helloService satisfies HelloServiceContract;

describe("SOC-06 — Contrat du service.ts de hello", () => {
  it("expose bien getGreeting et createGreeting (vérifié aussi au typage ci-dessus)", () => {
    expect(typeof helloService.getGreeting).toBe("function");
    expect(typeof helloService.createGreeting).toBe("function");
    void _contractCheck;
  });
});
