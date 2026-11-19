import { describe, expect, it } from "vitest";
import { starterAccountingFamily, starterAccountingPlan } from "@symbola/starter-templates";
import {
  checkFecStructure,
  decimalAmount,
  fecFileName,
  fecText,
  formatAllowedForPeriod,
  FORMATS_BY_FAMILY,
  journalRows,
  missingNumbers,
  paymentLines,
  periodBounds,
  receiptsJournalRows,
  reconcile,
  salesLines,
  type CashEntry,
  type SaleDocument,
} from "./accounting-export-rules";

const plan = starterAccountingPlan("fr");
const header = { periodLabel: "T1 2027", organization: "Atelier", exportedOn: "2027-04-02" };
const headerWords = { period: "Période", organization: "Organisation", exportedOn: "Exporté le" };

function invoice(number: string, issuedOn: string, ttc: number, vat = Math.round(ttc / 6)): SaleDocument {
  return {
    kind: "invoice",
    id: number,
    number,
    issuedOn,
    buyerName: "Léa Martin",
    amountCents: ttc,
    totals: { totalHtCents: ttc - vat, vatByRate: vat ? [{ rateBasisPoints: 2000, baseCents: ttc - vat, vatCents: vat }] : [], totalVatCents: vat, totalTtcCents: ttc },
  };
}

function creditNote(number: string, issuedOn: string, ttc: number, vat: number): SaleDocument {
  return { ...invoice(number, issuedOn, ttc, vat), kind: "credit_note" };
}

const cash: CashEntry[] = [
  { id: "p1", kind: "received", on: "2027-01-15", method: "Virement", invoiceNumber: "F-2027-0001", clientName: "Léa Martin", amountCents: 120000 },
  { id: "p2", kind: "received", on: "2027-02-10", method: "Chèque", invoiceNumber: "F-2027-0002", clientName: "Léa Martin", amountCents: 50050 },
  { id: "p3", kind: "reversal", on: "2027-02-12", method: "Chèque", invoiceNumber: "F-2027-0002", clientName: "Léa Martin", amountCents: 50050 },
];

describe("FAC-11 — Exports comptables (lot 58)", () => {
  it("D1 : la famille proposée se déduit de la forme juridique (micro : recettes ; société ou EI au réel : ventes, encaissements, FEC), PDF d'origine dans les deux", () => {
    expect(starterAccountingFamily("auto_entrepreneur")).toBe("micro");
    expect(starterAccountingFamily("sas")).toBe("real");
    expect(starterAccountingFamily("ei")).toBe("real");
    expect(starterAccountingFamily(null)).toBe("micro");
    expect(FORMATS_BY_FAMILY.micro).toEqual(["receipts_journal", "originals"]);
    expect(FORMATS_BY_FAMILY.real).toEqual(["sales_journal", "payments_journal", "fec", "originals"]);
  });

  it("périodes : mois, trimestre, année civile, exercice décalé ; le FEC ne vaut que pour une année ou un exercice", () => {
    expect(periodBounds("month", 2028, 2)).toEqual({ kind: "month", start: "2028-02-01", end: "2028-02-29" });
    expect(periodBounds("quarter", 2027, 1)).toEqual({ kind: "quarter", start: "2027-01-01", end: "2027-03-31" });
    expect(periodBounds("year", 2027, 0)).toEqual({ kind: "year", start: "2027-01-01", end: "2027-12-31" });
    expect(periodBounds("fiscal_year", 2027, 0, 7)).toEqual({ kind: "fiscal_year", start: "2027-07-01", end: "2028-06-30" });
    expect(() => periodBounds("month", 2027, 13)).toThrow();
    expect(formatAllowedForPeriod("fec", "quarter")).toBe(false);
    expect(formatAllowedForPeriod("fec", "fiscal_year")).toBe(true);
    expect(formatAllowedForPeriod("sales_journal", "month")).toBe(true);
  });

  it("montants à virgule, au centime, sans séparateur de milliers", () => {
    expect(decimalAmount(123456)).toBe("1234,56");
    expect(decimalAmount(5)).toBe("0,05");
    expect(decimalAmount(-50050)).toBe("-500,50");
  });

  it("journal des recettes (micro) : date d'encaissement, mode, numéro, client, montant ; une annulation en négatif ; total au centime", () => {
    const { rows, totalCents } = receiptsJournalRows(cash, header, { ...headerWords, columns: ["Date", "Mode", "Facture", "Client", "Montant"], total: "Total" });
    expect(rows.slice(0, 3)).toEqual([["Période", "T1 2027"], ["Organisation", "Atelier"], ["Exporté le", "2027-04-02"]]);
    expect(rows[4]).toEqual(["Date", "Mode", "Facture", "Client", "Montant"]);
    expect(rows[5]).toEqual(["2027-01-15", "Virement", "F-2027-0001", "Léa Martin", "1200,00"]);
    expect(rows[7]).toEqual(["2027-02-12", "Chèque", "F-2027-0002", "Léa Martin", "-500,50"]);
    expect(totalCents).toBe(120000);
    expect(rows.at(-1)).toEqual(["Total", "", "", "", "1200,00"]);
  });

  it("journal des ventes : client au débit, ventes et TVA par taux au crédit ; un avoir en sens inverse ; chaque écriture équilibrée", () => {
    const lines = salesLines([invoice("F-2027-0001", "2027-01-10", 120000, 20000), creditNote("A-2027-0001", "2027-02-01", 12000, 2000)], { invoice: "Facture", creditNote: "Avoir" });
    expect(lines.filter((line) => line.entryNumber === "VE000001").map((line) => [line.account, line.debitCents, line.creditCents])).toEqual([
      ["clients", 120000, 0],
      ["sales", 0, 100000],
      ["vatCollected", 0, 20000],
    ]);
    expect(lines.filter((line) => line.entryNumber === "VE000002").map((line) => [line.account, line.debitCents, line.creditCents])).toEqual([
      ["clients", 0, 12000],
      ["sales", 10000, 0],
      ["vatCollected", 2000, 0],
    ]);
    const { rows, debitCents, creditCents } = journalRows(lines, plan, header, { ...headerWords, columns: ["Journal", "Date", "Écriture", "Pièce", "Compte", "Libellé", "Débit", "Crédit"], total: "Total" });
    expect(debitCents).toBe(creditCents);
    expect(rows[5]).toEqual(["VE", "2027-01-10", "VE000001", "F-2027-0001", "411", "Facture F-2027-0001 Léa Martin", "1200,00", "0,00"]);
  });

  it("franchise en base de TVA : aucune ligne de TVA, les ventes prennent le TTC", () => {
    const lines = salesLines([invoice("F-2027-0003", "2027-03-01", 80000, 0)], { invoice: "Facture", creditNote: "Avoir" });
    expect(lines.map((line) => line.account)).toEqual(["clients", "sales"]);
    expect(lines[1]!.creditCents).toBe(80000);
  });

  it("journal des encaissements : banque au débit, client au crédit ; l'annulation à l'inverse", () => {
    const lines = paymentLines(cash, { payment: "Encaissement", reversal: "Annulation" });
    expect(lines.map((line) => [line.account, line.debitCents, line.creditCents])).toEqual([
      ["bank", 120000, 0],
      ["clients", 0, 120000],
      ["bank", 50050, 0],
      ["clients", 0, 50050],
      ["bank", 0, 50050],
      ["clients", 50050, 0],
    ]);
  });

  it("D2 : le FEC a l'en-tête réglementaire, 18 colonnes, dates AAAAMMJJ, montants à virgule, écritures équilibrées ; son nom porte le SIREN et la clôture", () => {
    const lines = [...salesLines([invoice("F-2027-0001", "2027-01-10", 120000, 20000)], { invoice: "Facture", creditNote: "Avoir" }), ...paymentLines(cash, { payment: "Encaissement", reversal: "Annulation" })];
    const text = fecText(lines, plan);
    expect(text.split("\r\n")[0]).toBe("JournalCode|JournalLib|EcritureNum|EcritureDate|CompteNum|CompteLib|CompAuxNum|CompAuxLib|PieceRef|PieceDate|EcritureLib|Debit|Credit|EcritureLet|DateLet|ValidDate|Montantdevise|Idevise");
    expect(text.split("\r\n")[1]).toBe("VE|Journal des ventes|VE000001|20270110|411|Clients|||F-2027-0001|20270110|Facture F-2027-0001 Léa Martin|1200,00|0,00|||20270110||");
    expect(checkFecStructure(text)).toEqual([]);
    expect(checkFecStructure(text.replace("1200,00|0,00", "1200,01|0,00"))).toEqual(["unbalanced:VE:VE000001"]);
    expect(fecFileName("123 456 782", "2027-12-31")).toBe("123456782FEC20271231.txt");
  });

  it("numérotation continue, avoirs compris : un trou dans la période est nommé (« F-2027-0042 absente ») ; un trou d'une autre période ne bloque pas celle-ci", () => {
    const earlier = Array.from({ length: 39 }, (_, index) => ({ kind: "invoice" as const, number: `F-2027-${String(index + 1).padStart(4, "0")}`, issuedOn: "2027-02-15" }));
    const numbered = [
      ...earlier,
      { kind: "invoice" as const, number: "F-2027-0040", issuedOn: "2027-03-30" },
      { kind: "invoice" as const, number: "F-2027-0041", issuedOn: "2027-04-02" },
      { kind: "invoice" as const, number: "F-2027-0043", issuedOn: "2027-04-20" },
      { kind: "credit_note" as const, number: "A-2027-0001", issuedOn: "2027-04-05" },
      { kind: "credit_note" as const, number: "A-2027-0003", issuedOn: "2027-04-06" },
    ];
    const lastAssigned = [
      { kind: "invoice" as const, year: 2027, lastNumber: 43 },
      { kind: "credit_note" as const, year: 2027, lastNumber: 3 },
    ];
    expect(missingNumbers({ period: { start: "2027-04-01", end: "2027-04-30" }, numbered, lastAssigned })).toEqual(["A-2027-0002", "F-2027-0042"]);
    // Mars : seule la 40 est dans la période, la 41 la suit ; les trous d'avril ne la regardent pas.
    expect(missingNumbers({ period: { start: "2027-03-01", end: "2027-03-31" }, numbered, lastAssigned })).toEqual([]);
    // Un rang attribué au-delà de la dernière pièce (la 44) manque aussi.
    expect(missingNumbers({ period: { start: "2027-04-01", end: "2027-04-30" }, numbered, lastAssigned: [{ kind: "invoice", year: 2027, lastNumber: 44 }, lastAssigned[1]!] })).toContain("F-2027-0044");
  });

  it("D3 : l'export se rapproche au centime du total facturé, des avoirs et des encaissements ; un écart bloque et s'explique", () => {
    const documents = [invoice("F-2027-0001", "2027-01-10", 120000, 20000), invoice("F-2027-0002", "2027-02-01", 50050, 8342), creditNote("A-2027-0001", "2027-02-01", 12000, 2000)];
    const numbered = documents.map((document) => ({ kind: document.kind, number: document.number, issuedOn: document.issuedOn }));
    const lastAssigned = [{ kind: "invoice" as const, year: 2027, lastNumber: 2 }, { kind: "credit_note" as const, year: 2027, lastNumber: 1 }];
    const period = { start: "2027-01-01", end: "2027-03-31" };
    const ok = reconcile({ period, numbered, lastAssigned, documents, cash, expected: { invoicedCents: 170050, creditedCents: 12000, receivedCents: 120000 } });
    expect(ok).toMatchObject({ ok: true, invoicedCents: 170050, creditedCents: 12000, receivedCents: 120000, documentCount: 3, cashCount: 3, issues: [] });

    const off = reconcile({ period, numbered, lastAssigned, documents, cash, expected: { invoicedCents: 170051, creditedCents: 12000, receivedCents: 120000 } });
    expect(off.ok).toBe(false);
    expect(off.issues).toEqual([{ kind: "total_mismatch", total: "invoiced", exportCents: 170050, expectedCents: 170051 }]);

    const gap = reconcile({ period, numbered: numbered.filter((row) => row.number !== "F-2027-0001"), lastAssigned, documents: documents.slice(1), cash, expected: { invoicedCents: 50050, creditedCents: 12000, receivedCents: 120000 } });
    expect(gap.issues).toEqual([{ kind: "missing_number", number: "F-2027-0001" }]);

    const broken = { ...documents[0]!, totals: { ...documents[0]!.totals, totalTtcCents: 119999 } };
    expect(reconcile({ period, numbered, lastAssigned, documents: [broken, ...documents.slice(1)], cash, expected: { invoicedCents: 170050, creditedCents: 12000, receivedCents: 120000 } }).issues).toEqual([{ kind: "unbalanced", number: "F-2027-0001" }]);

    expect(reconcile({ period, numbered, lastAssigned, documents, cash, expected: { invoicedCents: 170050, creditedCents: 12000, receivedCents: 120000 }, missingOriginals: ["F-2027-0002"] }).issues).toEqual([{ kind: "missing_original", number: "F-2027-0002" }]);
  });
});
