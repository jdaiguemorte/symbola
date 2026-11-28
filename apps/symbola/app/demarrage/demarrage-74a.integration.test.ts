// Lot 74a (HUB-09, HUB-10, PAR-01 ; C-68, D6, M13, B2 à B5, L74-D4) — l'assistant de démarrage contre un vrai
// PostgreSQL : chaque réponse s'enregistre aussitôt, la question des outils ne vient qu'après « Oui », « Je ne
// sais pas encore » pose la franchise et le drapeau, et aucun devis ne s'envoie tant qu'il est posé. Abus : une
// collègue qui poste une réponse à la main est refusée ; une titulaire de A ne touche pas au profil de B. Seul
// l'accès à la requête Next.js est simulé.
import { randomUUID } from "node:crypto";
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import { createOrganization } from "@symbola/auth";
import { createAppConnection } from "@symbola/db/client";
import { signedInAccount } from "@/lib/test-fixtures/session";
import { fillRequiredMentions } from "@/lib/test-fixtures/legal-mentions";
import { completeSetup, getOrganizationProfile, getSetupState, saveSetupStep } from "@/modules/hub/service";
import { createProspect, createProspectSource } from "@/modules/events/service";
import { addQuoteLine, createQuote, getQuote, sendQuote, QuoteVatAnswerPendingError } from "@/modules/quotes/service";

let sessionToken: string | undefined;

vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: (name: string) => (name === "symbola_session" && sessionToken ? { value: sessionToken } : undefined),
    set: () => undefined,
    delete: () => undefined,
  }),
  headers: async () => new Headers(),
}));
vi.mock("next/cache", () => ({ revalidatePath: () => undefined }));
vi.mock("next/navigation", () => ({
  redirect: (to: string) => {
    throw new Error(`redirect:${to}`);
  },
}));
vi.mock("next-intl/server", () => ({
  getTranslations: async () => (key: string) => key,
  getLocale: async () => "fr",
}));

const { answerQuestionAction } = await import("./actions");
const { sendQuoteAction } = await import("../devis/[quoteId]/actions");

const { sql, db } = createAppConnection();
afterAll(async () => {
  await sql.end();
});

function form(values: Record<string, string | string[]>): FormData {
  const data = new FormData();
  for (const [key, value] of Object.entries(values)) for (const item of [value].flat()) data.append(key, item);
  return data;
}

// La réponse à une question : l'action mène à la suivante (redirection) ou rend son refus.
async function answer(values: Record<string, string | string[]>): Promise<string | { error?: string; fieldError?: string }> {
  try {
    return await answerQuestionAction({}, form(values));
  } catch (error) {
    const message = (error as Error).message;
    if (message.startsWith("redirect:")) return message.slice("redirect:".length);
    throw error;
  }
}

async function newOwner() {
  const organization = await createOrganization(db, `Atelier ${randomUUID()}`);
  const owner = await signedInAccount(db, { organizationId: organization.id, role: "owner" });
  sessionToken = owner.token;
  return { organizationId: organization.id, userId: owner.userId };
}

// Les deux premières questions (métier et types, proposés d'avance) : la planner les valide telles quelles.
async function answerFirstTwo() {
  expect(await answer({ step: "1", metier: "wedding_planner" })).toBe("/demarrage?etape=2");
  expect(await answer({ step: "2", eventTypes: "wedding" })).toBe("/demarrage?etape=3");
}

beforeEach(() => {
  sessionToken = undefined;
});

describe("HUB-09 — Questionnaire d'accueil : la question des mariages en cours et la TVA en mots des devis (lot 74a)", () => {
  it("critère 5 — « Oui » mène aux outils, enregistrés après « Oui » seulement ; chaque réponse est en base aussitôt", async () => {
    const { organizationId } = await newOwner();
    await answerFirstTwo();
    expect(await answer({ step: "3", ongoing: "yes" })).toBe("/demarrage?etape=4");
    expect((await getOrganizationProfile(db, organizationId)).hasOngoingEvents).toBe("yes");
    expect((await getSetupState(db, organizationId)).step).toBe(4);
    expect(await answer({ step: "4", tools: ["spreadsheet", "paper", "fax"] })).toBe("/demarrage?etape=5");
    expect((await getOrganizationProfile(db, organizationId)).replacedTools).toEqual(["spreadsheet", "paper"]);
    expect(await answer({ step: "5", vat: "yes" })).toBe("/demarrage/pret");
    const profile = await getOrganizationProfile(db, organizationId);
    expect(profile).toMatchObject({ vatRegime: "assujetti", vatAnswerPending: false });
    expect((await getSetupState(db, organizationId)).completed).toBe(true);
  });

  it("critère 5 — « Non » mène à la TVA, efface les outils, et la question des outils se refuse", async () => {
    const { organizationId } = await newOwner();
    await answerFirstTwo();
    expect(await answer({ step: "3", ongoing: "yes" })).toBe("/demarrage?etape=4");
    expect(await answer({ step: "4", tools: "spreadsheet" })).toBe("/demarrage?etape=5");
    // Elle revient à la question 3 et répond « Non » : les outils ne se gardent plus.
    expect(await answer({ step: "3", ongoing: "no" })).toBe("/demarrage?etape=5");
    const profile = await getOrganizationProfile(db, organizationId);
    expect(profile).toMatchObject({ hasOngoingEvents: "no", replacedTools: [] });
    expect(await answer({ step: "4", tools: "spreadsheet" })).toEqual({ error: "ownerOnly" });
    expect((await getOrganizationProfile(db, organizationId)).replacedTools).toEqual([]);
  });

  it("critères 3 et 4 — sans réponse, « Choisissez une réponse » et rien ne passe ; aucune réponse de fait n'est posée d'office", async () => {
    const { organizationId } = await newOwner();
    await answerFirstTwo();
    expect(await answer({ step: "3" })).toEqual({ fieldError: "chooseAnswer" });
    expect(await answer({ step: "3", ongoing: "peut-être" })).toEqual({ fieldError: "chooseAnswer" });
    expect((await getSetupState(db, organizationId)).step).toBe(3);
    expect(await answer({ step: "3", ongoing: "yes" })).toBe("/demarrage?etape=4");
    expect(await answer({ step: "4" })).toEqual({ fieldError: "chooseAnswer" });
    expect(await answer({ step: "4", tools: "spreadsheet" })).toBe("/demarrage?etape=5");
    expect(await answer({ step: "5" })).toEqual({ fieldError: "chooseAnswer" });
    // Rien n'a été écrit pour elle : ni régime de TVA, ni fin de l'assistant.
    const profile = await getOrganizationProfile(db, organizationId);
    expect(profile.vatRegime).toBeNull();
    expect((await getSetupState(db, organizationId)).completed).toBe(false);
    // Une question pas encore atteinte se refuse.
    const other = await newOwner();
    expect(await answer({ step: "4", tools: "spreadsheet" })).toEqual({ error: "ownerOnly" });
    expect((await getOrganizationProfile(db, other.organizationId)).replacedTools).toEqual([]);
  });

  it("critère 6 — le volume annuel n'est jamais demandé : une valeur postée n'est pas lue", async () => {
    const { organizationId } = await newOwner();
    expect(await answer({ step: "1", metier: "wedding_planner", volume: "over_50", annualEventVolume: "over_50" })).toBe("/demarrage?etape=2");
    expect((await getOrganizationProfile(db, organizationId)).annualEventVolume).toBeNull();
  });
});

describe("HUB-09 / L74-D4 — « Je ne sais pas encore » pour la TVA : la franchise et le drapeau, aucun devis envoyé (lot 74a, critère 9)", () => {
  async function draftQuote(organizationId: string, userId: string) {
    await fillRequiredMentions(organizationId);
    const source = await createProspectSource(organizationId, "Salon");
    const event = await createProspect({ organizationId, createdByUserId: userId, clients: [{ firstName: "Léa", lastName: null }], prospectSourceId: source.id });
    const quote = await createQuote({ organizationId, eventId: event.id, createdByUserId: userId });
    await addQuoteLine(organizationId, quote.id, { label: "Coordination", unit: "forfait", quantityMilli: 1000, unitPriceCents: 150_000 });
    return quote.id;
  }

  it("pose la franchise et le drapeau ; l'envoi d'un devis est refusé, le brouillon reste", async () => {
    const { organizationId, userId } = await newOwner();
    await answerFirstTwo();
    expect(await answer({ step: "3", ongoing: "no" })).toBe("/demarrage?etape=5");
    expect(await answer({ step: "5", vat: "unknown" })).toBe("/demarrage/pret");
    expect(await getOrganizationProfile(db, organizationId)).toMatchObject({ vatRegime: "franchise", vatAnswerPending: true });
    const quoteId = await draftQuote(organizationId, userId);
    await expect(sendQuote({ organizationId, quoteId })).rejects.toBeInstanceOf(QuoteVatAnswerPendingError);
    expect((await getQuote(organizationId, quoteId)).status).toBe("draft");
    // « Envoyer » ouvre la question ; « Je ne sais pas encore » n'y est pas une réponse.
    expect(await sendQuoteAction({}, form({ quoteId }))).toEqual({ vatQuestion: true });
    expect(await sendQuoteAction({}, form({ quoteId, vatAnswer: "unknown" }))).toEqual({ vatQuestion: true, error: "vatAnswerRequired" });
    // La question posée, « Répondre et envoyer » sans choix le dit.
    expect(await sendQuoteAction({}, form({ quoteId, vatQuestion: "1" }))).toEqual({ vatQuestion: true, error: "vatAnswerRequired" });
    expect((await getQuote(organizationId, quoteId)).status).toBe("draft");
  });

  it("la réponse donnée à l'envoi fait tomber le drapeau, et l'envoi reprend", async () => {
    const { organizationId, userId } = await newOwner();
    await answerFirstTwo();
    await answer({ step: "3", ongoing: "no" });
    await answer({ step: "5", vat: "unknown" });
    const quoteId = await draftQuote(organizationId, userId);
    expect(await sendQuoteAction({}, form({ quoteId, vatAnswer: "no" }))).toEqual({ success: true });
    expect(await getOrganizationProfile(db, organizationId)).toMatchObject({ vatRegime: "franchise", vatAnswerPending: false });
    expect((await getQuote(organizationId, quoteId)).status).toBe("sent");
  });

  it("revenir sur la question et répondre « Oui » pose l'assujettissement et fait tomber le drapeau", async () => {
    const { organizationId } = await newOwner();
    await answerFirstTwo();
    await answer({ step: "3", ongoing: "no" });
    await answer({ step: "5", vat: "unknown" });
    expect(await answer({ step: "5", vat: "yes" })).toBe("/demarrage/pret");
    expect(await getOrganizationProfile(db, organizationId)).toMatchObject({ vatRegime: "assujetti", vatAnswerPending: false });
  });
});

describe("SEC-12, SEC-13 — L'assistant de démarrage : titulaire seulement, sa propre organisation (lot 74a, critère 10)", () => {
  it("une collègue qui poste une réponse à la main est refusée, et rien n'est écrit", async () => {
    const organization = await createOrganization(db, `Atelier ${randomUUID()}`);
    const member = await signedInAccount(db, { organizationId: organization.id, role: "member" });
    sessionToken = member.token;
    expect(await answer({ step: "1", metier: "event_agency" })).toEqual({ error: "ownerOnly" });
    expect(await answer({ step: "3", ongoing: "yes" })).toEqual({ error: "ownerOnly" });
    expect((await getOrganizationProfile(db, organization.id)).metier).toBeNull();
    expect((await getSetupState(db, organization.id)).step).toBe(1);
  });

  it("sans session, rien n'est écrit", async () => {
    expect(await answer({ step: "1", metier: "wedding_planner" })).toEqual({ error: "ownerOnly" });
  });

  it("une titulaire de A ne modifie pas le profil de B, même en postant son identifiant", async () => {
    const b = await createOrganization(db, `Atelier B ${randomUUID()}`);
    await saveSetupStep(db, b.id, 3);
    await newOwner();
    await answerFirstTwo();
    expect(await answer({ step: "3", ongoing: "yes", organizationId: b.id })).toBe("/demarrage?etape=4");
    expect((await getOrganizationProfile(db, b.id)).hasOngoingEvents).toBeNull();
    await completeSetup(db, b.id);
  });
});
