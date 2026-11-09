// DEV-01 — PDF du devis : en-tête vendeur, numéro et version, validité,
// mention légale ; filigrane « Document fictif » pour un devis d'essai.
// Lot 17 (DEV-07, DEV-10 à DEV-12) : apparence, coordonnées et mentions de
// l'entreprise, introduction et conditions, échéancier et IBAN, figés à
// l'envoi. Libellés tirés des vrais fichiers de traduction.
import { createElement, type ReactElement } from "react";
import { renderToBuffer, type DocumentProps } from "@react-pdf/renderer";
import { createTranslator } from "next-intl";
import { describe, expect, it } from "vitest";
import frMessages from "@symbola/i18n/messages/fr.json";
import type { QuoteDetail, QuoteVersionView, SellerSnapshot } from "@/modules/quotes/service";
import { pdfSafe } from "@/lib/pdf-text";
import { quotePdfLabels, type Translate } from "../document-labels";
import { QuotePdfDocument } from "./quote-pdf";
import { buildQuotePdfModel } from "./quote-pdf-model";

const t = createTranslator({ locale: "fr", messages: frMessages, namespace: "Documents" }) as unknown as Translate;
const tQuotes = createTranslator({ locale: "fr", messages: frMessages, namespace: "Quotes" }) as unknown as Translate;
const labels = quotePdfLabels(t, tQuotes);
const DEFAULT_COLOR = "#3b3b3b";

const frozenSeller: SellerSnapshot = {
  organizationName: "Atelier Lumière",
  address: "1 rue des Lilas, 69001 Lyon",
  siren: "123456789",
  logoKey: null,
  legalForm: "ei",
  siret: "12345678900012",
  contactEmail: "bonjour@atelier.example",
  contactPhone: "06 12 34 56 78",
  website: null,
  document: {
    color: "#4f6b5a",
    font: "classic",
    iban: "FR7630006000011234567890189",
    bic: "BNPAFRPP",
    intro: "Voici notre proposition.",
    terms: "Bon pour accord après signature.",
    footer: "Membre d'un réseau de wedding planners",
  },
};

function version(overrides: Partial<QuoteVersionView> = {}): QuoteVersionView {
  return {
    id: "v1",
    version: 1,
    lines: [
      {
        id: "l1",
        catalogItemId: null,
        label: "Coordination jour J",
        description: "Présence de 8 h à 2 h",
        unit: "forfait",
        quantityMilli: 1000,
        unitPriceCents: 150000,
        vatRateBasisPoints: 2000,
        discountBasisPoints: 0,
        position: 0,
        netCents: 150000,
      },
    ],
    globalDiscount: { kind: "none" },
    totals: { subtotalCents: 150000, globalDiscountCents: 0, totalHtCents: 150000, vatByRate: [], totalVatCents: 0, totalTtcCents: 150000 },
    vatApplicable: false,
    vatRegime: "franchise",
    legalMention: "TVA non applicable, art. 293 B du CGI",
    seller: frozenSeller,
    validUntil: "2027-04-14",
    sentAt: "2027-03-15T10:00:00.000Z",
    schedule: { items: [], scheduledCents: 0, balanceCents: 150000, exceedsTotal: false },
    ...overrides,
  };
}

function quote(current: QuoteVersionView, isDemo = false): QuoteDetail {
  return {
    id: "q1",
    eventId: "e1",
    number: isDemo ? "DEMO-D-2027-0001" : "D-2027-0001",
    status: current.sentAt ? "sent" : "draft",
    currentVersion: current.version,
    isDemo,
    clientKind: "individual",
    totalTtcCents: current.totals.totalTtcCents,
    versions: [current],
    current,
    regimeChangedSinceSent: false,
    signature: null,
  };
}

// Réglages courants, différents de la copie figée.
const draftSeller: SellerSnapshot = {
  organizationName: "Nouveau nom",
  address: "Nouvelle adresse",
  siren: "999999999",
  logoKey: null,
  legalForm: "sarl",
  shareCapitalCents: 1_000_000,
  document: { color: "#a8553a", font: "modern", iban: null, bic: null, intro: "Nouvelle introduction", terms: null, footer: null },
};

// Comme au rendu : espaces insécables du format français remplacés (pdfSafe).
function model(current: QuoteVersionView, isDemo = false) {
  return pdfSafe(buildQuotePdfModel({
    quote: quote(current, isDemo),
    version: current,
    draftSeller,
    draftLegalMention: "Mention courante",
    clientNames: "Inès & Sacha",
    eventDate: "2027-09-18",
    logo: null,
    labels,
    locale: "fr",
    watermark: isDemo ? "Document fictif" : null,
    defaultColor: DEFAULT_COLOR,
  }));
}

describe("DEV-01 — PDF du devis", () => {
  it("une version envoyée porte l'en-tête vendeur figé, le numéro, la version, la validité et la mention de franchise, sans TVA", () => {
    const result = model(version());
    expect(result.title).toBe("Devis D-2027-0001 — version 1");
    expect(result.kind).toBe("Devis");
    expect(result.number).toBe("D-2027-0001");
    expect(result.subtitle).toBe("Version 1");
    expect(result.status).toBeNull();
    expect(result.seller.name).toBe("Atelier Lumière EI");
    expect(result.seller.lines).toEqual(["1 rue des Lilas, 69001 Lyon", "bonjour@atelier.example · 06 12 34 56 78"]);
    expect(result.dates).toEqual([
      { label: "Établi le", value: "15 mars 2027" },
      { label: "Événement", value: "18 septembre 2027" },
      { label: "Valable jusqu'au", value: "14 avril 2027" },
    ]);
    expect(result.legalMention).toBe("TVA non applicable, art. 293 B du CGI");
    expect(result.columns).not.toContain(tQuotes("itemVatRate"));
    expect(result.totals.map((total) => total.label)).toEqual(["Sous-total HT", "Total HT"]);
    expect(result.watermark).toBeNull();
  });

  it("assujettie : colonne de taux, TVA par taux et total TTC", () => {
    const result = model(
      version({
        vatApplicable: true,
        vatRegime: "assujetti",
        legalMention: null,
        totals: {
          subtotalCents: 150000,
          globalDiscountCents: 0,
          totalHtCents: 150000,
          vatByRate: [{ rateBasisPoints: 2000, baseCents: 150000, vatCents: 30000 }],
          totalVatCents: 30000,
          totalTtcCents: 180000,
        },
      }),
    );
    expect(result.columns).toContain(tQuotes("itemVatRate"));
    expect(result.rows[0]?.cells).toContain("20 %");
    expect(result.totals.map((total) => total.label)).toEqual(["Sous-total HT", "Total HT", "TVA 20 %", "Total TTC"]);
  });

  it("un brouillon est signalé comme tel et prend l'en-tête, l'apparence et la mention courants", () => {
    const result = model(version({ sentAt: null, validUntil: null, seller: null, legalMention: null }));
    expect(result.status).toBe("Brouillon — non envoyé");
    expect(result.subtitle).toBe("Version 1 · Brouillon — non envoyé");
    expect(result.seller.name).toBe("Nouveau nom");
    expect(result.legalMention).toBe("Mention courante");
    expect(result.intro).toBe("Nouvelle introduction");
    expect(result.appearance.font).toBe("modern");
    expect(result.dates).toEqual([{ label: "Événement", value: "18 septembre 2027" }]);
  });

  it("un devis d'essai porte le filigrane « Document fictif » et son numéro DEMO", () => {
    const result = model(version(), true);
    expect(result.watermark).toBe("Document fictif");
    expect(result.number).toBe("DEMO-D-2027-0001");
  });

  it("DEV-02 — le PDF envoyé en signature porte un bloc « Bon pour accord » avec une balise par signataire", () => {
    const result = buildQuotePdfModel({
      quote: quote(version()),
      version: version(),
      draftSeller,
      draftLegalMention: null,
      clientNames: "Inès & Sacha",
      logo: null,
      labels,
      locale: "fr",
      watermark: null,
      defaultColor: DEFAULT_COLOR,
      signatureSlots: [
        { role: "Signataire 1", tag: "{{Signature;role=Signataire 1;type=signature}}" },
        { role: "Signataire 2", tag: "{{Signature;role=Signataire 2;type=signature}}" },
      ],
    });
    expect(result.signature?.title).toBe(tQuotes("pdfSignatureTitle"));
    expect(result.signature?.slots.map((slot) => slot.tag)).toEqual([
      "{{Signature;role=Signataire 1;type=signature}}",
      "{{Signature;role=Signataire 2;type=signature}}",
    ]);
    expect(model(version()).signature).toBeNull();
  });

  it("produit un PDF A4, sur plusieurs pages quand le devis est long", async () => {
    const long = version({ lines: Array.from({ length: 80 }, (_, index) => ({ ...version().lines[0]!, id: `l${index}` })) });
    const pdf = await renderToBuffer(
      createElement(QuotePdfDocument, { model: model(long, true) }) as unknown as ReactElement<DocumentProps>,
    );
    const text = pdf.toString("latin1");
    expect(pdf.subarray(0, 5).toString("latin1")).toBe("%PDF-");
    expect(text).toMatch(/\/MediaBox \[0 0 595\.28\d* 841\.89\d*\]/);
    expect((text.match(/\/Type \/Page\b/g) ?? []).length).toBeGreaterThan(1);
  });
});

describe("DEV-07 — Fiche entreprise complète pour les documents", () => {
  it("le nom d'un entrepreneur individuel est suivi de « EI », sans doublon", () => {
    expect(model(version()).seller.name).toBe("Atelier Lumière EI");
    const already = model(version({ seller: { ...frozenSeller, organizationName: "Atelier Lumière EI" } }));
    expect(already.seller.name).toBe("Atelier Lumière EI");
  });

  it("une société : forme juridique, capital, SIRET, immatriculation et numéro de TVA au pied de page, sans vide pour ceux qui manquent", () => {
    const company = model(
      version({
        seller: {
          ...frozenSeller,
          legalForm: "sarl",
          shareCapitalCents: 1_000_000,
          registration: "RCS Lyon 123 456 789",
          vatNumber: "FR40123456789",
        },
      }),
    );
    expect(company.footer.legal).toBe(
      "Atelier Lumière · SARL au capital de 10 000,00 € · SIRET 12345678900012 · RCS Lyon 123 456 789 · TVA intracommunautaire FR40123456789",
    );
    const minimal = model(version({ seller: { organizationName: "Atelier Lumière", address: null, siren: null, logoKey: null } }));
    expect(minimal.footer.legal).toBe("Atelier Lumière");
    expect(minimal.seller.lines).toEqual([]);
  });
});

describe("DEV-10 — Textes des devis et des factures", () => {
  it("le devis imprime son introduction, ses conditions particulières et le pied de page libre", () => {
    const result = model(version());
    expect(result.intro).toBe("Voici notre proposition.");
    expect(result.terms).toBe("Bon pour accord après signature.");
    expect(result.footer.text).toBe("Membre d'un réseau de wedding planners");
    expect(result.footer.page).toBe("Page {page} / {total}");
  });
});

describe("DEV-11 — Paiement : IBAN, échéance, échéancier", () => {
  it("un devis avec un échéancier liste les acomptes et le solde, puis l'IBAN et le BIC", () => {
    const result = model(
      version({
        schedule: {
          items: [
            {
              id: "s1",
              label: "Acompte à la signature",
              dueDate: "2027-03-20",
              fixedAmountCents: null,
              percentageBasisPoints: 3000,
              amountCents: 45000,
              paidOn: null,
              paymentMethodId: null,
              paymentMethodLabel: null,
              overdue: false,
              position: 0,
            },
          ],
          scheduledCents: 45000,
          balanceCents: 105000,
          exceedsTotal: false,
        },
      }),
    );
    expect(result.payment).toEqual({
      title: "Échéancier",
      lines: [
        { label: "Acompte à la signature, le 20 mars 2027", amount: "450,00 €" },
        { label: "Solde", amount: "1 050,00 €" },
        { label: "IBAN FR76 3000 6000 0112 3456 7890 189", amount: null },
        { label: "BIC BNPAFRPP", amount: null },
      ],
    });
  });

  it("sans échéancier ni IBAN, pas d'encadré ; avec l'IBAN seul, un encadré « Règlement »", () => {
    expect(model(version({ seller: { ...frozenSeller, document: { ...frozenSeller.document!, iban: null, bic: null } } })).payment).toBeNull();
    expect(model(version()).payment).toEqual({
      title: "Règlement",
      lines: [
        { label: "IBAN FR76 3000 6000 0112 3456 7890 189", amount: null },
        { label: "BIC BNPAFRPP", amount: null },
      ],
    });
  });
});

describe("DEV-12 — Nouvelle mise en page, figée à l'émission", () => {
  it("un devis envoyé garde la couleur et la police de sa copie, même quand les réglages changent", () => {
    const result = model(version());
    expect(result.appearance.font).toBe("classic");
    expect(result.appearance.accent).toBe("#4f6b5a");
  });

  it("un devis envoyé avant le lot 17 s'imprime avec l'apparence neutre, sans erreur", async () => {
    const legacy = version({ seller: { organizationName: "Atelier Lumière", address: "1 rue des Lilas", siren: "123456789", logoKey: null } });
    const result = model(legacy);
    expect(result.appearance).toMatchObject({ accent: DEFAULT_COLOR, font: "modern" });
    expect(result.intro).toBeNull();
    expect(result.terms).toBeNull();
    expect(result.payment).toBeNull();
    expect(result.footer.legal).toBe("Atelier Lumière · SIREN 123456789");
    const pdf = await renderToBuffer(createElement(QuotePdfDocument, { model: result }) as unknown as ReactElement<DocumentProps>);
    expect(pdf.subarray(0, 5).toString("latin1")).toBe("%PDF-");
  });
});
