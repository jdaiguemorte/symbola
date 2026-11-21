// Lot 62d (UX-12) — le devis en rubriques : adresse de chaque rubrique, rubrique d'une ancre d'avant
// le lot, ce qui reste à facturer, et la prochaine action du devis selon son statut (le seul bouton
// principal de l'écran).
import { describe, expect, it } from "vitest";
import type { QuoteDetail, ScheduleItemView } from "@/modules/quotes/service";
import { anchorHref, availableRubrics, invoicePlan, nextAction, parseRubric, rubricHref, rubricOfAnchor, RUBRICS } from "./rubrics";

const item = (id: string): ScheduleItemView => ({ id, label: id, dueDate: "2027-01-10", fixedAmountCents: null, percentageBasisPoints: 3000, amountCents: 30000, paidOn: null, paymentMethodId: null, paymentMethodLabel: null, overdue: false, position: 0, payments: [] });

function quote(overrides: { status?: QuoteDetail["status"]; sent?: boolean; advanceKind?: "deposit" | "earnest" | null; items?: ScheduleItemView[]; signature?: "pending" | "completed" | "declined" | null; regimeChanged?: boolean }) {
  const { status = "draft", sent = status !== "draft", advanceKind = "deposit", items = [], signature = null, regimeChanged = false } = overrides;
  return {
    status,
    regimeChangedSinceSent: regimeChanged,
    signature: signature ? ({ status: signature } as QuoteDetail["signature"]) : null,
    current: { sentAt: sent ? "2026-11-20T10:00:00.000Z" : null, advanceKind, schedule: { items } } as unknown as QuoteDetail["current"],
  };
}

const invoice = (kind: "deposit" | "balance", scheduleItemId: string | null, creditedCents = 0) => ({ kind, scheduleItemId, amountCents: 30000, creditedCents });

describe("UX-12 — Le devis en rubriques (lot 62d)", () => {
  it("chaque rubrique a son adresse ; les lignes gardent l'adresse du devis", () => {
    expect(rubricHref("q1", "lignes")).toBe("/devis/q1");
    expect(rubricHref("q1", "paiement")).toBe("/devis/q1?rubrique=paiement");
    expect(rubricHref("q1", "contrat", "signature")).toBe("/devis/q1?rubrique=contrat#signature");
  });

  it("une rubrique inconnue, ou absente pour ce devis, ramène aux lignes", () => {
    const draft = availableRubrics({ status: "draft", invoiceCount: 0, receiptCount: 0 });
    expect(parseRubric("paiement", draft)).toBe("paiement");
    expect(parseRubric(["contrat", "paiement"], draft)).toBe("contrat");
    expect(parseRubric("inconnue", draft)).toBe("lignes");
    expect(parseRubric(undefined, draft)).toBe("lignes");
    expect(parseRubric("factures", draft)).toBe("lignes");
  });

  it("les factures ont leur rubrique dès que le devis est signé, ou qu'une facture ou un reçu existe", () => {
    expect(availableRubrics({ status: "draft", invoiceCount: 0, receiptCount: 0 })).toEqual(RUBRICS.filter((rubric) => rubric !== "factures"));
    expect(availableRubrics({ status: "sent", invoiceCount: 0, receiptCount: 0 })).not.toContain("factures");
    expect(availableRubrics({ status: "signed", invoiceCount: 0, receiptCount: 0 })).toContain("factures");
    expect(availableRubrics({ status: "sent", invoiceCount: 1, receiptCount: 0 })).toContain("factures");
    expect(availableRubrics({ status: "sent", invoiceCount: 0, receiptCount: 1 })).toContain("factures");
  });

  it("une ancre d'avant le lot mène à sa rubrique", () => {
    expect(rubricOfAnchor("#echeancier")).toBe("paiement");
    expect(rubricOfAnchor("#acompte-arrhes")).toBe("paiement");
    expect(rubricOfAnchor("#reglement-0b8f2c1e")).toBe("paiement");
    expect(rubricOfAnchor("#acheteur")).toBe("acheteur");
    expect(rubricOfAnchor("#argent")).toBe("honoraires");
    expect(rubricOfAnchor("#contrat")).toBe("contrat");
    expect(rubricOfAnchor("#signature")).toBe("contrat");
    expect(rubricOfAnchor("#factures")).toBe("factures");
    expect(rubricOfAnchor("#proposition")).toBe("proposition");
    expect(rubricOfAnchor("#autre")).toBeNull();
    expect(rubricOfAnchor("")).toBeNull();
    expect(anchorHref("#acheteur")).toBe("?rubrique=acheteur#acheteur");
    expect(anchorHref("#autre")).toBe("#autre");
  });
});

describe("DEV-04 — Ce qui reste à facturer (inchangé, lot 62d)", () => {
  it("une échéance facturée ne l'est plus à émettre ; une facture entièrement annulée par avoir se réémet", () => {
    const signed = quote({ status: "signed", items: [item("a"), item("b")] });
    expect(invoicePlan(signed, []).pendingItems.map((entry) => entry.id)).toEqual(["a", "b"]);
    expect(invoicePlan(signed, [invoice("deposit", "a")]).pendingItems.map((entry) => entry.id)).toEqual(["b"]);
    expect(invoicePlan(signed, [invoice("deposit", "a", 30000)]).pendingItems.map((entry) => entry.id)).toEqual(["a", "b"]);
  });

  it("après le solde, ou pour des arrhes, aucune facture d'acompte n'est à émettre", () => {
    const signed = quote({ status: "signed", items: [item("a")] });
    expect(invoicePlan(signed, [invoice("balance", null)])).toMatchObject({ balanceIssued: true, pendingItems: [] });
    expect(invoicePlan(quote({ status: "signed", advanceKind: "earnest", items: [item("a")] }), [])).toMatchObject({ earnest: true, balanceIssued: false, pendingItems: [] });
  });
});

describe("UX-12 — Un seul bouton principal, celui de la prochaine action (lot 62d)", () => {
  const plan = (value: ReturnType<typeof quote>, invoices: ReturnType<typeof invoice>[] = []) => invoicePlan(value, invoices);
  const next = (value: ReturnType<typeof quote>, invoices: ReturnType<typeof invoice>[] = [], signatureAvailable = true) => nextAction({ quote: value, plan: plan(value, invoices), signatureAvailable });

  it("brouillon : envoyer le devis", () => {
    expect(next(quote({ status: "draft" }))).toEqual({ kind: "send" });
    // Une nouvelle version d'un devis déjà envoyé est un brouillon.
    expect(next(quote({ status: "sent", sent: false }))).toEqual({ kind: "send" });
  });

  it("envoyé : faire signer, tant qu'aucune signature n'est demandée et que le service est disponible", () => {
    expect(next(quote({ status: "sent" }))).toEqual({ kind: "sign" });
    expect(next(quote({ status: "sent" }), [], false)).toBeNull();
    expect(next(quote({ status: "sent", signature: "pending" }))).toBeNull();
  });

  it("envoyé, régime de TVA changé depuis : créer la nouvelle version passe avant la signature", () => {
    expect(next(quote({ status: "sent", regimeChanged: true }))).toEqual({ kind: "revise", reason: "regime" });
  });

  it("refusé : créer une nouvelle version", () => {
    expect(next(quote({ status: "declined", signature: "declined" }))).toEqual({ kind: "revise", reason: "declined" });
  });

  it("signé : la facture d'acompte de la première échéance à facturer, puis celle du solde, puis plus rien", () => {
    const signed = quote({ status: "signed", signature: "completed", items: [item("a"), item("b")] });
    expect(next(signed)).toEqual({ kind: "invoice", scheduleItemId: "a" });
    expect(next(signed, [invoice("deposit", "a")])).toEqual({ kind: "invoice", scheduleItemId: "b" });
    expect(next(signed, [invoice("deposit", "a"), invoice("deposit", "b")])).toEqual({ kind: "invoice", scheduleItemId: null });
    expect(next(signed, [invoice("deposit", "a"), invoice("deposit", "b"), invoice("balance", null)])).toBeNull();
  });

  it("signé avec des arrhes : la facture de solde, sans facture d'acompte", () => {
    expect(next(quote({ status: "signed", signature: "completed", advanceKind: "earnest", items: [item("a")] }))).toEqual({ kind: "invoice", scheduleItemId: null });
  });

  it("expiré : aucune prochaine action désignée", () => {
    expect(next(quote({ status: "expired" }))).toBeNull();
  });
});
