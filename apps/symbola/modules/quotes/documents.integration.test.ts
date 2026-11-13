// Lot 17 (DEV-07 à DEV-12, ADR 0046) — réglages des documents, coordonnées
// du vendeur, logo et copies figées, contre un vrai PostgreSQL (RLS), le
// stockage et l'antivirus du socle, par les portes d'entrée des modules.
import { randomUUID } from "node:crypto";
import { afterEach, describe, expect, it } from "vitest";
import { createOrganization, createUser } from "@symbola/auth";
import { createAppConnection, type AppDatabase } from "@symbola/db/client";
import {
  getOrganizationProfile,
  getSellerDetails,
  InvalidDocumentDetailsError,
  LogoUploadError,
  saveDocumentDetails,
  saveOnboardingStep,
  uploadOrganizationLogo,
} from "@/modules/hub/service";
import { createProspect, createProspectSource } from "@/modules/events/service";
import { fakeSignatureProvider, setSignatureProviderForTests } from "./signature";
import {
  actOnFakeSignature,
  addQuoteLine,
  addScheduleItem,
  createQuote,
  currentQuoteSeller,
  getDocumentSettings,
  getQuote,
  InvalidDocumentSettingsError,
  issueBalanceInvoice,
  issueCreditNote,
  reviseQuote,
  sendQuote,
  sendQuoteForSignature,
  updateDocumentSettings,
} from "./service";
import { fillRequiredMentions } from "@/lib/test-fixtures/legal-mentions";

// Lot 23b (DOC-08) : rendu factice de l'original déposé à l'émission.
const renderInvoice = async () => Buffer.from("%PDF-1.4\n% facture de test\n%%EOF\n", "latin1");
const renderCreditNote = async () => Buffer.from("%PDF-1.4\n% avoir de test\n%%EOF\n", "latin1");


const NOW = new Date("2027-04-10T10:00:00Z");
const PDF = Buffer.from("%PDF-1.4\n%%EOF\n", "latin1");
// Image PNG 1 × 1 : le plus petit logo valide.
const PNG_1PX = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=", "base64");
// IBAN d'exemple publié par les normes (aucun compte réel).
const SAMPLE_IBAN = "FR7630006000011234567890189";

const SETTINGS = {
  color: "#a8553a",
  font: "classic" as const,
  iban: SAMPLE_IBAN,
  bic: "BNPAFRPP",
  quoteIntro: "Voici notre proposition.",
  quoteTerms: "Bon pour accord après signature.",
  invoiceIntro: "Merci pour votre confiance.",
  invoiceTerms: "À réception, par virement.",
  footer: "Membre d'un réseau",
};

afterEach(() => setSignatureProviderForTests(undefined));

async function withDb<T>(fn: (db: AppDatabase) => Promise<T>): Promise<T> {
  const { sql, db } = createAppConnection();
  try {
    return await fn(db);
  } finally {
    await sql.end();
  }
}

async function organization() {
  const organizationId = (await withDb((db) => createOrganization(db, `Atelier ${randomUUID().slice(0, 6)}`))).id;
  await withDb((db) =>
    saveOnboardingStep(db, organizationId, { vatRegime: "franchise", vatRateDefaultBasisPoints: null, legalForm: "ei", siren: "123456789", address: "1 rue des Lilas, 69001 Lyon" }),
  );
  // Lot 31a (FAC-07) : mentions requises remplies.
  await fillRequiredMentions(organizationId);
  const planner = await withDb((db) =>
    createUser(db, { organizationId, email: `planner-${randomUUID()}@example.test`, password: "mot-de-passe-du-test", role: "owner" }),
  );
  return { organizationId, plannerId: planner.id };
}

async function draftQuote(organizationId: string, plannerId: string) {
  const source = await createProspectSource(organizationId, "Salon");
  const eventId = (
    await createProspect({ organizationId, createdByUserId: plannerId, prospectSourceId: source.id, eventDate: "2027-09-18", clients: [{ firstName: "Inès", lastName: "Martin" }] })
  ).id;
  const quote = await createQuote({ organizationId, eventId, createdByUserId: plannerId, now: NOW });
  await addQuoteLine(organizationId, quote.id, { label: "Coordination", unit: "forfait", quantityMilli: 1000, unitPriceCents: 150000, vatRateBasisPoints: 0 });
  await addScheduleItem(organizationId, quote.id, { label: "Acompte à la signature", dueDate: "2027-04-15", percentageBasisPoints: 3000 });
  return quote.id;
}

async function sign(organizationId: string, quoteId: string) {
  setSignatureProviderForTests(fakeSignatureProvider());
  const sent = await sendQuoteForSignature({
    organizationId,
    quoteId,
    signers: [{ name: "Inès Martin", email: `ines-${randomUUID()}@example.test`, billingAddress: "3 place Bellecour, 69002 Lyon" }],
    documentPdf: PDF,
    locale: "fr",
  });
  for (const signer of sent.signature!.signers) await actOnFakeSignature(signer.signingUrl.split("/").pop()!, "sign");
}

describe("DEV-07 — Fiche entreprise complète pour les documents", () => {
  it("les coordonnées sont enregistrées (SIRET compris, sans espaces) et forment l'identité du vendeur", async () => {
    const { organizationId } = await organization();
    await withDb((db) =>
      saveDocumentDetails(db, organizationId, {
        siret: "123 456 789 00012",
        contactEmail: "bonjour@atelier.example",
        contactPhone: "06 12 34 56 78",
        website: "atelier.example",
        vatNumber: "fr 40 123456789",
        registration: "RCS Lyon 123 456 789",
        shareCapitalCents: 1_000_000,
      }),
    );
    expect(await withDb((db) => getSellerDetails(db, organizationId))).toMatchObject({
      siret: "12345678900012",
      contactEmail: "bonjour@atelier.example",
      vatNumber: "FR40123456789",
      registration: "RCS Lyon 123 456 789",
      shareCapitalCents: 1_000_000,
      legalForm: "ei",
    });
  });

  it("un SIRET, un numéro de TVA ou un e-mail invalides sont refusés et rien n'est modifié", async () => {
    const { organizationId } = await organization();
    const empty = { siret: null, contactEmail: null, contactPhone: null, website: null, vatNumber: null, registration: null, shareCapitalCents: null };
    await withDb((db) => saveDocumentDetails(db, organizationId, { ...empty, contactEmail: "avant@atelier.example" }));
    for (const invalid of [{ siret: "1234" }, { vatNumber: "FR123" }, { contactEmail: "pas-un-email" }]) {
      await expect(withDb((db) => saveDocumentDetails(db, organizationId, { ...empty, contactEmail: "apres@atelier.example", ...invalid }))).rejects.toBeInstanceOf(
        InvalidDocumentDetailsError,
      );
    }
    expect((await withDb((db) => getSellerDetails(db, organizationId))).contactEmail).toBe("avant@atelier.example");
  });

  it("isolation : les coordonnées de A ne touchent pas B", async () => {
    const a = await organization();
    const b = await organization();
    await withDb((db) =>
      saveDocumentDetails(db, a.organizationId, { siret: "12345678900012", contactEmail: "a@atelier.example", contactPhone: null, website: null, vatNumber: null, registration: null, shareCapitalCents: null }),
    );
    expect(await withDb((db) => getSellerDetails(db, b.organizationId))).toMatchObject({ siret: null, contactEmail: null });
  });
});

describe("DEV-08 — Logo de l'organisation", () => {
  it("un PNG est accepté et devient le logo ; un fichier d'un autre type, même nommé .png, est refusé sans toucher au logo", async () => {
    const { organizationId } = await organization();
    const key = await withDb((db) => uploadOrganizationLogo(db, organizationId, PNG_1PX));
    expect(key.startsWith(`${organizationId}/`)).toBe(true);
    await expect(withDb((db) => uploadOrganizationLogo(db, organizationId, Buffer.from("pas une image")))).rejects.toMatchObject({ reason: "unsupported_type" });
    await expect(withDb((db) => uploadOrganizationLogo(db, organizationId, Buffer.alloc(2 * 1024 * 1024 + 1)))).rejects.toBeInstanceOf(LogoUploadError);
    expect((await withDb((db) => getOrganizationProfile(db, organizationId))).logoKey).toBe(key);
  });

  it("isolation : le logo de A n'est pas celui de B", async () => {
    const a = await organization();
    const b = await organization();
    await withDb((db) => uploadOrganizationLogo(db, a.organizationId, PNG_1PX));
    expect((await withDb((db) => getOrganizationProfile(db, b.organizationId))).logoKey).toBeNull();
  });
});

describe("DEV-09 — Apparence des documents", () => {
  it("les réglages enregistrés sont relus ; sans réglage, la police Moderne et aucune couleur", async () => {
    const { organizationId } = await organization();
    expect(await getDocumentSettings(organizationId)).toMatchObject({ color: null, font: "modern", iban: null });
    await updateDocumentSettings(organizationId, SETTINGS);
    expect(await getDocumentSettings(organizationId)).toEqual(SETTINGS);
  });

  it("une couleur invalide est refusée et les réglages restent ceux d'avant", async () => {
    const { organizationId } = await organization();
    await updateDocumentSettings(organizationId, SETTINGS);
    await expect(updateDocumentSettings(organizationId, { ...SETTINGS, color: "rouge" })).rejects.toBeInstanceOf(InvalidDocumentSettingsError);
    expect((await getDocumentSettings(organizationId)).color).toBe("#a8553a");
  });

  it("isolation : les réglages de A ne sont ni lus ni modifiés par B", async () => {
    const a = await organization();
    const b = await organization();
    await updateDocumentSettings(a.organizationId, SETTINGS);
    expect(await getDocumentSettings(b.organizationId)).toMatchObject({ color: null, iban: null, quoteIntro: null });
    await updateDocumentSettings(b.organizationId, { ...SETTINGS, color: "#2f4a66", iban: null });
    expect(await getDocumentSettings(a.organizationId)).toEqual(SETTINGS);
  });
});

describe("DEV-11 — Paiement : IBAN, échéance, échéancier", () => {
  it("un IBAN dont la clé est fausse est refusé ; un IBAN valide est enregistré sans espaces", async () => {
    const { organizationId } = await organization();
    await expect(updateDocumentSettings(organizationId, { ...SETTINGS, iban: "FR76 3000 6000 0112 3456 7890 188" })).rejects.toMatchObject({ field: "iban" });
    await updateDocumentSettings(organizationId, { ...SETTINGS, iban: "FR76 3000 6000 0112 3456 7890 189" });
    expect((await getDocumentSettings(organizationId)).iban).toBe(SAMPLE_IBAN);
  });
});

describe("DEV-12 — Nouvelle mise en page, figée à l'émission", () => {
  it("un devis envoyé garde l'apparence, les textes et l'IBAN de son envoi ; un brouillon suit les réglages courants", async () => {
    const { organizationId, plannerId } = await organization();
    await updateDocumentSettings(organizationId, SETTINGS);
    const quoteId = await draftQuote(organizationId, plannerId);
    await sendQuote({ organizationId, quoteId, now: NOW });
    await updateDocumentSettings(organizationId, { ...SETTINGS, color: "#2f4a66", font: "modern", iban: null, quoteIntro: "Nouvelle introduction" });

    const sent = await getQuote(organizationId, quoteId);
    expect(sent.current.seller?.document).toEqual({
      color: "#a8553a",
      font: "classic",
      iban: SAMPLE_IBAN,
      bic: "BNPAFRPP",
      intro: "Voici notre proposition.",
      terms: "Bon pour accord après signature.",
      footer: "Membre d'un réseau",
    });
    // Une nouvelle version (brouillon) imprime les réglages courants.
    await reviseQuote(organizationId, quoteId);
    expect((await currentQuoteSeller(organizationId)).document).toMatchObject({ color: "#2f4a66", font: "modern", iban: null, intro: "Nouvelle introduction" });
  });

  it("une facture fige le vendeur et l'apparence du jour de son émission ; l'avoir reprend la copie de sa facture", async () => {
    const { organizationId, plannerId } = await organization();
    await updateDocumentSettings(organizationId, SETTINGS);
    const quoteId = await draftQuote(organizationId, plannerId);
    await sendQuote({ organizationId, quoteId, now: NOW });
    await sign(organizationId, quoteId);

    // Après l'envoi du devis : déménagement et nouvelle couleur.
    await withDb((db) => saveOnboardingStep(db, organizationId, { address: "9 quai Saint-Antoine, 69002 Lyon" }));
    await updateDocumentSettings(organizationId, { ...SETTINGS, color: "#2f4a66" });
    const invoice = await issueBalanceInvoice({ renderOriginal: renderInvoice, organizationId, quoteId, now: NOW });
    expect(invoice.seller).toMatchObject({ address: "9 quai Saint-Antoine, 69002 Lyon", legalForm: "ei" });
    expect(invoice.seller.document).toMatchObject({ color: "#2f4a66", intro: "Merci pour votre confiance.", terms: null, iban: SAMPLE_IBAN });
    expect(invoice.mentions).toBe("À réception, par virement.");

    // Les réglages changent encore : la facture émise ne bouge pas, l'avoir non plus.
    await updateDocumentSettings(organizationId, { ...SETTINGS, color: "#6d3b5a", iban: null });
    const note = await issueCreditNote({ renderOriginal: renderCreditNote, organizationId, invoiceId: invoice.id, amountCents: 1000, reason: "Geste commercial", now: NOW });
    expect(note.seller.document).toMatchObject({ color: "#2f4a66", iban: SAMPLE_IBAN });
  });
});
