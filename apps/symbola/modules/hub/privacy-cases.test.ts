import { describe, expect, it } from "vitest";
import { actionKindOf, caseSteps } from "./privacy-cases";

const base = { closed: false, actionDone: false, actionStarted: false, actionWaiting: false, responseSent: false };

describe("RGPD-07 — Une demande, un dossier suivi de bout en bout", () => {
  it("une demande enregistrée s'ouvre sur l'étape « Données retrouvées »", () => {
    const { steps, current } = caseSteps(base);
    expect(steps).toEqual({ registered: "done", found: "current", action: "todo", response: "todo", closed: "todo" });
    expect(current).toBe("found");
  });

  it("un effacement lancé attend l'accusé des modules ; la réponse vient après", () => {
    const { steps, current } = caseSteps({ ...base, actionStarted: true, actionWaiting: true });
    expect(steps).toMatchObject({ found: "done", action: "waiting", response: "todo" });
    expect(current).toBe("action");
  });

  it("l'action faite ouvre la réponse ; la réponse envoyée ouvre la clôture", () => {
    expect(caseSteps({ ...base, actionStarted: true, actionDone: true }).current).toBe("response");
    const ready = caseSteps({ ...base, actionStarted: true, actionDone: true, responseSent: true });
    expect(ready.steps).toMatchObject({ action: "done", response: "done", closed: "current" });
    expect(ready.current).toBe("closed");
  });

  it("une demande close a toutes ses étapes faites", () => {
    const { steps } = caseSteps({ closed: true, actionDone: true, actionStarted: true, actionWaiting: false, responseSent: true });
    expect(Object.values(steps).every((state) => state === "done")).toBe(true);
  });

  it("l'oubli s'efface, l'accès et la portabilité s'exportent, la rectification et l'opposition se font à la main", () => {
    expect(actionKindOf("erasure")).toBe("erasure");
    expect(actionKindOf("access")).toBe("export");
    expect(actionKindOf("portability")).toBe("export");
    expect(actionKindOf("rectification")).toBe("manual");
    expect(actionKindOf("objection")).toBe("manual");
  });
});
