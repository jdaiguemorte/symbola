import { createElement, type ReactElement } from "react";
import { renderToBuffer, type DocumentProps } from "@react-pdf/renderer";
import { describe, expect, it } from "vitest";
import type { BudgetLine, BudgetLinesView } from "@symbola/contracts";
import { budgetPdfPayments, budgetPdfRows, buildBudgetExport } from "./budget-export";
import { BudgetPdfDocument } from "./budget-pdf";

const amounts = (estimated: number, committed: number | null) => ({ estimatedCents: estimated, quotedCents: 0, committedCents: committed ?? 0, paidCents: 0, remainingCents: committed ?? 0, varianceCents: (committed ?? 0) - estimated });

function line(label: string, committed: number | null, rate: number, vendorName: string | null = null): BudgetLine {
  const ht = committed === null ? null : Math.round((committed * 10000) / (10000 + rate));
  return {
    id: label,
    eventVendorSlotId: "traiteur",
    label,
    vendorCandidateId: vendorName ? "haddad" : null,
    vendorName,
    position: 0,
    estimatedAmountCents: 100000,
    quotedAmountCents: null,
    committedAmountCents: committed,
    paidAmountCents: null,
    remainingAmountCents: committed,
    varianceCents: committed === null ? null : committed - 100000,
    variancePercent: null,
    paidFromPayments: false,
    attachments: [],
    payments:
      vendorName === null
        ? []
        : [{ id: "p1", lineId: label, label: "Acompte", amountCents: 36000, fixedAmountCents: null, percentageBasisPoints: 3000, dueOn: "2027-03-01", paidOn: null, status: "due", declaration: null, refusalReason: null }],
    vatRateBasisPoints: rate,
    ht: { estimatedCents: Math.round(1000000000 / (10000 + rate)), quotedCents: null, committedCents: ht, paidCents: null, remainingCents: ht, varianceCents: null },
  };
}

function view(clientKind: BudgetLinesView["clientKind"]): BudgetLinesView {
  const lines = [line("Dîner", 120000, 2000, "Maison Haddad"), line("Vin", null, 1000)];
  return {
    eventId: "e1",
    categories: [{ eventVendorSlotId: "traiteur", label: "Traiteur", lines, ...amounts(200000, 120000), ht: amounts(180000, 100000) }],
    lines,
    totalEstimatedCents: 200000,
    totalQuotedCents: 0,
    totalCommittedCents: 120000,
    totalPaidCents: 0,
    totalRemainingCents: 120000,
    totalVarianceCents: -80000,
    clientKind,
    totalHt: amounts(180000, 100000),
    envelope: null,
  };
}

const format = { amount: (cents: number) => `${cents / 100} €`, ht: (amount: string) => `HT ${amount}`, date: (date: string) => date.split("-").reverse().join("/") };

describe("BUD-10 — Contenu de l'export du budget (lot 28c, D6)", () => {
  it("une rangée par catégorie (ses totaux), puis ses lignes, puis le total du budget ; un montant inconnu s'écrit « — »", () => {
    const rows = budgetPdfRows(buildBudgetExport(view("individual"), { categoryTotal: "Total de la catégorie", total: "Total" }), format);
    expect(rows.map((row) => [row.kind, row.label, row.vendor])).toEqual([
      ["category", "Traiteur", ""],
      ["line", "Dîner", "Maison Haddad"],
      ["line", "Vin", ""],
      ["total", "Total", ""],
    ]);
    expect(rows[2]!.amounts[2]).toBe("—");
    // Particulier : TTC seul (BUD-09).
    expect(rows.every((row) => row.ht.every((value) => value === ""))).toBe(true);
  });

  it("professionnel : le HT sous chaque montant TTC connu", () => {
    const rows = budgetPdfRows(buildBudgetExport(view("professional"), { categoryTotal: "Total de la catégorie", total: "Total" }), format);
    expect(rows[1]!.amounts[2]).toBe("1200 €");
    expect(rows[1]!.ht[2]).toBe("HT 1000 €");
    expect(rows[2]!.ht[2]).toBe("");
    expect(rows[3]!.ht[2]).toBe("HT 1000 €");
  });

  it("les échéances, par date, avec prestataire, ligne, montant et statut", () => {
    const model = buildBudgetExport(view("individual"), { categoryTotal: "Total de la catégorie", total: "Total" });
    expect(budgetPdfPayments(model, { statuses: { due: "À payer", overdue: "En retard", paid: "Payée" } }, format)).toEqual([
      ["Maison Haddad", "Dîner", "Acompte", "360 €", "01/03/2027", "À payer", ""],
    ]);
  });

  it("le PDF se rend en A4 paysage, à la couleur de l'organisation, avec le filigrane d'un événement fictif", async () => {
    const model = buildBudgetExport(view("professional"), { categoryTotal: "Total de la catégorie", total: "Total" });
    const element = createElement(BudgetPdfDocument, {
      model: {
        language: "fr",
        organizationName: "Atelier Camille",
        logo: null,
        color: "#7A1F4B",
        title: "Budget",
        heading: "Léa & Tom — 12/06/2027",
        generated: "Édité le 12/11/2026",
        mode: "Client professionnel",
        columns: ["Ligne", "Estimé TTC", "Devisé TTC", "Engagé TTC", "Payé TTC", "Reste à payer TTC", "Écart TTC"],
        rows: budgetPdfRows(model, format),
        paymentsTitle: "Échéancier des prestataires",
        paymentColumns: ["Prestataire", "Ligne", "Échéance", "Montant TTC", "Date d'échéance", "Statut", "Payée le"],
        payments: budgetPdfPayments(model, { statuses: { due: "À payer", overdue: "En retard", paid: "Payée" } }, format),
        noPayments: "Aucune échéance.",
        watermark: "Document fictif",
      },
    }) as unknown as ReactElement<DocumentProps>;
    const pdf = await renderToBuffer(element);
    expect(pdf.subarray(0, 5).toString("latin1")).toBe("%PDF-");
    expect(pdf.toString("latin1")).toMatch(/\/MediaBox \[0 0 841\.89\d* 595\.28\d*\]/);
  });
});
