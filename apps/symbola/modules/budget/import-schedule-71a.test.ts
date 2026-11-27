// Lot 71a (HUB-14, BUD-01, BUD-03 ; spécification du lot 71, § 5.1) — un import ne crée ni retard ni
// relance : la réponse « Les montants de l'acompte ont-ils été payés ? » décide de l'échéance de
// l'acompte. Règle pure, à l'horloge simulée (le « jour » est celui où l'on regarde l'échéance).
import { describe, expect, it } from "vitest";
import { importedPaymentSchedule } from "./import";
import { paymentStatus } from "./payments";

const labels = { deposit: "Acompte", balance: "Solde" };
const TODAY = "2026-11-24";
const line = (depositDueOn: string) => ({ depositAmount: 195000, depositDueOn, balanceAmount: 455000, balanceDueOn: "2027-03-28" });

function statuses(depositDueOn: string, paid: boolean | null, today = TODAY) {
  const schedule = importedPaymentSchedule(line(depositDueOn), labels, paid);
  if (!schedule) throw new Error("échéancier attendu");
  return { schedule, statuses: schedule.payments.map((payment) => paymentStatus(payment, today)) };
}

describe("HUB-14 — Un import ne crée ni retard ni relance : les acomptes du fichier (lot 71a)", () => {
  it("« Oui, payés » : l'acompte devient une échéance payée à sa date, quel que soit le jour (veille, jour même, lendemain)", () => {
    for (const dueOn of ["2026-11-23", "2026-11-24", "2026-11-25"]) {
      const { schedule, statuses: states } = statuses(dueOn, true);
      expect(schedule.payments[0]).toMatchObject({ label: "Acompte", fixedAmountCents: 195000, dueOn, paidOn: dueOn });
      expect(schedule.paidAmountCents).toBe(195000);
      expect(states).toEqual(["paid", "due"]);
    }
  });

  it("« Non » : l'acompte reste dû ; en retard seulement après sa date (la veille), pas le jour même ni le lendemain", () => {
    expect(statuses("2026-11-23", false).statuses).toEqual(["overdue", "due"]);
    expect(statuses("2026-11-24", false).statuses).toEqual(["due", "due"]);
    expect(statuses("2026-11-25", false).statuses).toEqual(["due", "due"]);
    expect(statuses("2026-11-23", false).schedule.paidAmountCents).toBe(0);
  });

  it("le solde du 28/03/2027, jour du passage à l'heure d'été, est dû ce jour-là et en retard le lendemain seulement", () => {
    const { schedule } = statuses("2026-11-23", true);
    expect(paymentStatus(schedule.payments[1]!, "2027-03-27")).toBe("due");
    expect(paymentStatus(schedule.payments[1]!, "2027-03-28")).toBe("due");
    expect(paymentStatus(schedule.payments[1]!, "2027-03-29")).toBe("overdue");
  });

  it("sans réponse (question non posée), la règle d'avant : le « Réglé » du fichier dit ce qui est payé", () => {
    expect(importedPaymentSchedule({ ...line("2026-11-23"), paidAmount: 195000 }, labels, null)?.payments.map((payment) => payment.paidOn)).toEqual(["2026-11-23", null]);
    expect(importedPaymentSchedule(line("2026-11-23"), labels, null)?.payments.map((payment) => payment.paidOn)).toEqual([null, null]);
  });

  it("un acompte seul (sans solde) suit la réponse ; une ligne sans acompte n'en reçoit jamais", () => {
    expect(importedPaymentSchedule({ depositAmount: 81200, depositDueOn: "2026-10-30" }, labels, true)).toEqual({
      payments: [{ label: "Acompte", fixedAmountCents: 81200, dueOn: "2026-10-30", paidOn: "2026-10-30" }],
      paidAmountCents: 81200,
    });
    expect(importedPaymentSchedule({ balanceAmount: 98000, balanceDueOn: "2027-03-20" }, labels, true)?.payments).toEqual([{ label: "Solde", fixedAmountCents: 98000, dueOn: "2027-03-20", paidOn: null }]);
  });
});
