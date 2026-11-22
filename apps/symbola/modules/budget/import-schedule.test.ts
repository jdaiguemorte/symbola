// Lot 63b (BUD-01, BUD-03, HUB-14) — un budget importé avec un acompte et un solde datés crée les
// échéances de la ligne ; le réglé du fichier dit lesquelles sont payées. Règle pure.
import { describe, expect, it } from "vitest";
import { importedPaymentSchedule } from "./import";

const labels = { deposit: "Acompte", balance: "Solde" };

describe("BUD-03 — Budget importé complet : échéances datées (lot 63b)", () => {
  it("un acompte et un solde datés deviennent deux échéances ; le réglé égal à l'acompte le marque payé à sa date", () => {
    expect(importedPaymentSchedule({ depositAmount: 30000, depositDueOn: "2027-01-15", balanceAmount: 70000, balanceDueOn: "2027-06-01", paidAmount: 30000 }, labels)).toEqual({
      payments: [
        { label: "Acompte", fixedAmountCents: 30000, dueOn: "2027-01-15", paidOn: "2027-01-15" },
        { label: "Solde", fixedAmountCents: 70000, dueOn: "2027-06-01", paidOn: null },
      ],
      paidAmountCents: 30000,
    });
  });

  it("rien de réglé : deux échéances à venir ; tout réglé : les deux sont payées", () => {
    const values = { depositAmount: 30000, depositDueOn: "2027-01-15", balanceAmount: 70000, balanceDueOn: "2027-06-01" };
    expect(importedPaymentSchedule(values, labels)?.payments.map((payment) => payment.paidOn)).toEqual([null, null]);
    expect(importedPaymentSchedule({ ...values, paidAmount: 100000 }, labels)).toMatchObject({ paidAmountCents: 100000, payments: [{ paidOn: "2027-01-15" }, { paidOn: "2027-06-01" }] });
  });

  it("un acompte seul, daté, suffit", () => {
    expect(importedPaymentSchedule({ depositAmount: 50000, depositDueOn: "2027-02-01" }, labels)?.payments).toEqual([{ label: "Acompte", fixedAmountCents: 50000, dueOn: "2027-02-01", paidOn: null }]);
  });

  it("sans date, ou avec un réglé qui ne tombe pas sur une échéance, l'import fait comme avant (aucune échéance inventée)", () => {
    expect(importedPaymentSchedule({ paidAmount: 30000 }, labels)).toBeNull();
    expect(importedPaymentSchedule({ depositAmount: 30000, balanceAmount: 70000, balanceDueOn: "2027-06-01" }, labels)).toBeNull();
    expect(importedPaymentSchedule({ depositAmount: 30000, depositDueOn: "2027-01-15", balanceAmount: 70000, balanceDueOn: "2027-06-01", paidAmount: 45000 }, labels)).toBeNull();
    expect(importedPaymentSchedule({ depositAmount: 0, depositDueOn: "2027-01-15" }, labels)).toBeNull();
  });
});
