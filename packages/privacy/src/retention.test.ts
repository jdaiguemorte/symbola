import { describe, expect, it } from "vitest";
import { clientDueOn, inactiveAccountDueOn, isExpired, prospectDueOn } from "./retention";

const months = { prospectRetentionMonths: 36, clientRetentionMonths: 36, inactiveAccountMonths: 24 };

describe("RGPD-05 — Règles de conservation (dates simulées)", () => {
  it("prospect sans suite : 3 ans après la dernière activité ; échu le jour même, pas la veille", () => {
    const due = prospectDueOn(["2023-01-10", "2023-11-02", null], months);
    expect(due).toBe("2026-11-02");
    expect(isExpired("2026-11-01", due!)).toBe(false);
    expect(isExpired("2026-11-02", due!)).toBe(true);
  });

  it("client : 3 ans après la plus tardive entre la date de l'événement et le dernier encaissement", () => {
    expect(clientDueOn({ eventDate: "2023-06-12", lastPaymentOn: "2023-09-30" }, months)).toBe("2026-09-30");
    expect(clientDueOn({ eventDate: "2023-06-12", lastPaymentOn: null }, months)).toBe("2026-06-12");
    // Relation non terminée (ni date ni paiement) : rien n'est échu.
    expect(clientDueOn({ eventDate: null, lastPaymentOn: null }, months)).toBeNull();
    // 29 février : ramené au dernier jour du mois.
    expect(clientDueOn({ eventDate: "2024-02-29", lastPaymentOn: null }, { ...months, clientRetentionMonths: 12 })).toBe("2025-02-28");
  });

  it("compte d'un marié : 2 ans sans connexion, ou depuis sa création s'il ne s'est jamais connecté", () => {
    expect(inactiveAccountDueOn({ lastLoginOn: "2024-11-03", createdOn: "2024-01-01" }, months)).toBe("2026-11-03");
    expect(inactiveAccountDueOn({ lastLoginOn: null, createdOn: "2024-11-02" }, months)).toBe("2026-11-02");
    expect(isExpired("2026-11-02", "2026-11-03")).toBe(false);
  });
});
