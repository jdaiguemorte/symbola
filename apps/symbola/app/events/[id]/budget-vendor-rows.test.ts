import { describe, expect, it } from "vitest";
import type { BudgetLine, EventVendorSlot, VendorPayment } from "@symbola/contracts";
import { buildBudgetVendorRows, signedAmount } from "./budget-vendor-rows";

function slot(id: string, label: string, retained: { name: string; quote: number | null }[] = []): EventVendorSlot {
  return {
    id,
    eventId: "e",
    label,
    status: retained.length > 0 ? "retained" : "to_find",
    notRequired: false,
    retainedVendors: retained.map((vendor, index) => ({ candidateId: `${id}-c${index}`, vendorName: vendor.name, quoteAmountCents: vendor.quote })),
    position: 0,
    brief: null,
    icon: null,
  };
}

function payment(id: string, label: string, amountCents: number, dueOn: string, paidOn: string | null = null): VendorPayment {
  return { id, lineId: "l", label, amountCents, fixedAmountCents: amountCents, percentageBasisPoints: null, dueOn, paidOn, status: paidOn ? "paid" : "due", declaration: null, refusalReason: null, payerId: null, handover: null };
}

function line(slotId: string, values: Partial<BudgetLine>): BudgetLine {
  return {
    id: `${slotId}-line`,
    eventVendorSlotId: slotId,
    label: "Ligne",
    vendorCandidateId: null,
    vendorName: null,
    position: 0,
    estimatedAmountCents: null,
    quotedAmountCents: null,
    committedAmountCents: null,
    paidAmountCents: null,
    remainingAmountCents: null,
    varianceCents: null,
    variancePercent: null,
    paidFromPayments: false,
    attachments: [],
    payments: [],
    vatRateBasisPoints: 2000,
    ht: { estimatedCents: null, quotedCents: null, committedCents: null, paidCents: null, remainingCents: null, varianceCents: null },
    ...values,
  };
}

describe("BUD-01, BUD-03, BUD-04 — Budget et prestataires, une seule vue (lot 63c, M9)", () => {
  const today = "2026-11-21";
  const slots = [slot("traiteur", "Traiteur", [{ name: "Les Saveurs", quote: 840000 }]), slot("photo", "Photographe", [{ name: "Studio Lumière", quote: 220000 }]), slot("dj", "DJ"), slot("fleurs", "Fleurs")];
  const categories = [
    {
      eventVendorSlotId: "traiteur",
      lines: [
        line("traiteur", {
          estimatedAmountCents: 800000,
          quotedAmountCents: 840000,
          committedAmountCents: 840000,
          paidAmountCents: 252000,
          paidFromPayments: true,
          payments: [payment("solde", "Solde", 588000, "2027-06-14"), payment("acompte", "Acompte", 252000, "2026-10-02", "2026-10-02")],
          attachments: [{ id: "a1", kind: "quote", mime: "application/pdf", sizeBytes: 1000, createdAt: "2026-11-20T10:00:00Z" }],
        }),
      ],
    },
    { eventVendorSlotId: "photo", lines: [line("photo", { estimatedAmountCents: 250000, quotedAmountCents: 220000, paidAmountCents: 220000 })] },
    { eventVendorSlotId: "dj", lines: [line("dj", { estimatedAmountCents: 120000, quotedAmountCents: 110000, paidAmountCents: 20000, payments: [payment("dj-solde", "Solde", 90000, "2026-11-20")] })] },
    { eventVendorSlotId: "fleurs", lines: [line("fleurs", { estimatedAmountCents: 180000 })] },
  ];
  const { rows, totals } = buildBudgetVendorRows(slots, categories, today);
  const row = (id: string) => rows.find((candidate) => candidate.slotId === id)!;

  it("par ligne : prévu, réel, écart (réel − prévu), réglé et reste à payer", () => {
    expect(row("traiteur")).toMatchObject({ plannedCents: 800000, actualCents: 840000, varianceCents: 40000, paidCents: 252000, remainingCents: 588000 });
    expect(row("photo")).toMatchObject({ varianceCents: -30000, remainingCents: 0, settled: true });
    expect(row("fleurs")).toMatchObject({ plannedCents: 180000, actualCents: null, varianceCents: null, paidCents: 0, remainingCents: null, settled: false });
  });

  it("la prochaine échéance est la première non payée ; « En retard » si sa date est passée (horloge simulée)", () => {
    expect(row("traiteur").nextPayment).toMatchObject({ id: "solde", late: false });
    expect(row("dj").nextPayment).toMatchObject({ id: "dj-solde", late: true });
    // Le jour même n'est pas en retard.
    expect(buildBudgetVendorRows(slots, categories, "2026-11-20").rows.find((candidate) => candidate.slotId === "dj")!.nextPayment?.late).toBe(false);
    expect(row("photo").nextPayment).toBeNull();
  });

  it("l'échéancier dépliable suit l'ordre des dates ; les pièces du prestataire sont sous son nom", () => {
    expect(row("traiteur").payments.map((item) => item.id)).toEqual(["acompte", "solde"]);
    expect(row("traiteur").attachments).toHaveLength(1);
    expect(row("traiteur").vendorNames).toEqual(["Les Saveurs"]);
  });

  it("l'engagé : une pastille sur la ligne engagée et un sous-total « dont engagé » (Q42)", () => {
    expect(row("traiteur").engaged).toBe(true);
    expect(row("photo").engaged).toBe(false);
    expect(totals.engagedCents).toBe(840000);
  });

  it("les totaux ; l'écart total ne compte que les lignes qui ont un réel", () => {
    expect(totals).toEqual({ plannedCents: 1350000, actualCents: 1170000, varianceCents: 0, paidCents: 492000, remainingCents: 678000, engagedCents: 840000 });
  });

  it("sans ligne de budget, le réel est le devis des prestataires retenus", () => {
    const { rows: alone } = buildBudgetVendorRows([slot("traiteur", "Traiteur", [{ name: "Les Saveurs", quote: 840000 }])], [], today);
    expect(alone[0]).toMatchObject({ plannedCents: null, actualCents: 840000, remainingCents: 840000 });
  });

  it("l'écart s'écrit toujours avec son signe", () => {
    const format = (cents: number) => `${cents / 100} €`;
    expect(signedAmount(40000, format)).toBe("+ 400 €");
    expect(signedAmount(-30000, format)).toBe("− 300 €");
    expect(signedAmount(0, format)).toBe("0 €");
  });
});
