import { describe, expect, it } from "vitest";
import type { EReportingView } from "@/modules/quotes/service";
import { bimonthlyPeriods, eReportingCsv } from "./csv";

const labels = {
  header: ["Type", "Date", "Numéro", "Référence", "Libellé", "HT", "TVA", "TTC", "Mode"],
  invoice: "Facture",
  creditNote: "Avoir",
  payment: "Encaissement",
  total: "Total",
  deposit: "Acompte",
  balance: "Solde",
};

const view: EReportingView = {
  from: "2027-03-01",
  to: "2027-04-30",
  invoices: [{ number: "F-2027-0001", issuedOn: "2027-04-10", kind: "deposit", totalHtCents: 69000, totalVatCents: 11400, totalTtcCents: 80400 }],
  creditNotes: [{ number: "A-2027-0001", invoiceNumber: "F-2027-0001", issuedOn: "2027-04-11", totalHtCents: 333, totalVatCents: 67, totalTtcCents: 400 }],
  payments: [{ paidOn: "2027-04-10", amountCents: 80400, paymentMethod: "=HYPERLINK(\"x\")", quoteNumber: "D-2027-0001", label: "Acompte; à la signature" }],
  totals: { invoicedTtcCents: 80400, creditedTtcCents: 400, netHtCents: 68667, netVatCents: 11333, netTtcCents: 80000, collectedCents: 80400 },
};

describe("DEV-04 — Export e-reporting (CSV)", () => {
  it("liste factures, avoirs (en négatif) et encaissements de la période, avec le total", () => {
    const lines = eReportingCsv(view, labels).replace(/^﻿/, "").trim().split("\r\n");
    expect(lines[0]).toBe("Type;Date;Numéro;Référence;Libellé;HT;TVA;TTC;Mode");
    expect(lines[1]).toBe("Facture;2027-04-10;F-2027-0001;;Acompte;690,00;114,00;804,00;");
    expect(lines[2]).toBe("Avoir;2027-04-11;A-2027-0001;F-2027-0001;;-3,33;-0,67;-4,00;");
    expect(lines[4]).toBe("Total;2027-03-01/2027-04-30;;;;686,67;113,33;800,00;804,00");
  });

  it("neutralise une cellule de texte qui commence par =, +, - ou @ et échappe le séparateur", () => {
    const payment = eReportingCsv(view, labels).split("\r\n")[3]!;
    expect(payment).toContain(`"'=HYPERLINK(""x"")"`);
    expect(payment).toContain(`"Acompte; à la signature"`);
  });

  it("découpe l'année en six périodes de deux mois, fin de février comprise", () => {
    expect(bimonthlyPeriods(2028)[0]).toEqual({ from: "2028-01-01", to: "2028-02-29" });
    expect(bimonthlyPeriods(2027)[5]).toEqual({ from: "2027-11-01", to: "2027-12-31" });
  });
});
