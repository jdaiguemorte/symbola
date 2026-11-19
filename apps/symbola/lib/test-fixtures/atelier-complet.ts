// Lots 35b et 35c (HUB-13, RGP-11) — pour les tests : l'atelier de Camille (ORG-01 du jeu fictif,
// chargé sous de nouveaux identifiants), complété de ce que le jeu ne porte pas : un devis signé, sa
// facture d'acompte et son original, un avoir, un encaissement annulé puis de nouveau reçu, et un
// document d'évènement dans le stockage. Lot 60 : un plan de salle d'évènement (espace, fond de plan
// stocké, prise, élément relié, version diffusée, version vue par un lien). Renvoie aussi les liens
// personnels du jeu.
import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { sql } from "drizzle-orm";
import { appDatabase } from "@symbola/db/client";
import { eventDocuments } from "@symbola/db/schema/events";
import { layoutElements, layoutVersions, layouts, linkViews, powerLinks, spaceFixtures, spaces } from "@symbola/db/schema/floorplans";
import { withOrganization } from "@symbola/db/with-organization";
import { createStorageClient, uploadPrivateObject } from "@symbola/files";
import { fillRequiredMentions } from "@/lib/test-fixtures/legal-mentions";
import { minimalPdf } from "@/lib/test-fixtures/pdf";
import { loadRecette } from "@/lib/recette/load";
import { listEvents } from "@/modules/events/service";
import { saveOnboardingStep } from "@/modules/hub/service";
import {
  actOnFakeSignature,
  addPaymentMethods,
  addQuoteLine,
  addScheduleItem,
  createQuote,
  issueCreditNote,
  issueDepositInvoice,
  markScheduleItemPaid,
  markScheduleItemUnpaid,
  sendQuote,
  sendQuoteForSignature,
  setQuoteAdvanceKind,
} from "@/modules/quotes/service";
import { fakeSignatureProvider, setSignatureProviderForTests } from "@/modules/quotes/signature";

const dataset: unknown = JSON.parse(readFileSync(new URL("../../../../docs/recette/symbola-synthetic-users.json", import.meta.url), "utf8"));
const today = () => new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Paris", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());

// L'atelier de Camille (ORG-01 du jeu fictif), complété de pièces comptables : un devis signé, sa
// facture d'acompte et son original, un avoir, un encaissement annulé puis de nouveau reçu, et un
// document d'évènement dans le stockage.
export async function seedFullAtelier() {
  const db = appDatabase();
  const organizationId = randomUUID();
  const loaded = await loadRecette(dataset, { nodeEnv: "test", organizationIds: { "ORG-01": organizationId, "ORG-02": randomUUID() }, emailTag: randomUUID().slice(0, 8) });
  const owner = loaded.accounts.find((account) => account.organisation === "ORG-01" && account.role === "owner")!;
  const ownerId = (await db.execute(sql`select id from hub.users where email = ${owner.email}`)) as unknown as { id: string }[];
  await saveOnboardingStep(db, organizationId, { vatRegime: "assujetti", vatRateDefaultBasisPoints: 2000 });
  await fillRequiredMentions(organizationId);
  const [event] = await listEvents({ organizationId });
  const [method] = await addPaymentMethods(organizationId, ["Mode de test"]);
  const created = await createQuote({ organizationId, eventId: event!.id, createdByUserId: ownerId[0]!.id });
  await addQuoteLine(organizationId, created.id, { label: "Coordination", unit: "forfait", quantityMilli: 1000, unitPriceCents: 100000, vatRateBasisPoints: 2000 });
  await setQuoteAdvanceKind(organizationId, created.id, "deposit");
  const detail = await addScheduleItem(organizationId, created.id, { label: "À la signature", dueDate: today(), percentageBasisPoints: 3000 });
  await sendQuote({ organizationId, quoteId: created.id });
  setSignatureProviderForTests(fakeSignatureProvider());
  const sent = await sendQuoteForSignature({
    organizationId,
    quoteId: created.id,
    signers: [{ name: "Léa Martin", email: `lea-${randomUUID()}@example.test`, billingAddress: "4 rue des Lilas, 24200 Sarlat" }],
    documentPdf: minimalPdf("devis"),
    locale: "fr",
  });
  for (const signer of sent.signature!.signers) await actOnFakeSignature(signer.signingUrl.split("/").pop()!, "sign");
  const itemId = detail.current.schedule.items[0]!.id;
  const render = async () => minimalPdf("pièce");
  const invoice = await issueDepositInvoice({ renderOriginal: render, organizationId, scheduleItemId: itemId });
  await issueCreditNote({ renderOriginal: render, organizationId, invoiceId: invoice.id, amountCents: 1000, reason: "Geste commercial" });
  await markScheduleItemPaid({ organizationId, scheduleItemId: itemId, paidOn: today(), paymentMethodId: method!.id });
  await markScheduleItemUnpaid(organizationId, itemId, "Virement rejeté");
  await markScheduleItemPaid({ organizationId, scheduleItemId: itemId, paidOn: today(), paymentMethodId: method!.id });
  const key = `${organizationId}/${randomUUID()}.pdf`;
  const pdf = minimalPdf("plan de table");
  await uploadPrivateObject(createStorageClient(), { key, body: pdf, contentType: "application/pdf" });
  await withOrganization(db, organizationId, (tx) =>
    tx.insert(eventDocuments).values({ organizationId, eventId: event!.id, label: "Plan de table", fileKey: key, mime: "application/pdf", sizeBytes: pdf.byteLength, uploadedByUserId: ownerId[0]!.id }),
  );
  // Lot 60 : le plan de salle du dîner, avec son fond de plan (PNG) dans le stockage privé.
  const backgroundKey = `${organizationId}/${randomUUID()}.png`;
  const png = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 13, 0x49, 0x48, 0x44, 0x52, 0, 0, 0, 40, 0, 0, 0, 24, 8, 2, 0, 0, 0, 0, 0, 0, 0]);
  await uploadPrivateObject(createStorageClient(), { key: backgroundKey, body: png, contentType: "image/png" });
  await withOrganization(db, organizationId, async (tx) => {
    const [space] = await tx
      .insert(spaces)
      .values({ organizationId, eventId: event!.id, name: "Orangerie", widthCm: 2000, depthCm: 1200, backgroundKey, backgroundMime: "image/png", backgroundSizeBytes: png.byteLength, backgroundWidthPx: 40, backgroundHeightPx: 24 })
      .returning();
    const [outlet] = await tx.insert(spaceFixtures).values({ organizationId, spaceId: space!.id, kind: "outlet", xCm: 100, yCm: 20, widthCm: 40, depthCm: 20, outletCount: 2, amps: 16 }).returning();
    const [layout] = await tx.insert(layouts).values({ organizationId, spaceId: space!.id, eventId: event!.id, name: "Dîner", publishedVersion: 1 }).returning();
    const [element] = await tx
      .insert(layoutElements)
      .values({ organizationId, layoutId: layout!.id, typeStarterKey: "dj", category: "setup", shape: "rect", xCm: 500, yCm: 200, widthCm: 200, depthCm: 100, powerOutlets: 2, powerAmps: 16 })
      .returning();
    await tx.insert(powerLinks).values({ organizationId, elementId: element!.id, fixtureId: outlet!.id });
    await tx.insert(layoutVersions).values({ organizationId, layoutId: layout!.id, version: 1, snapshot: { layoutName: "Dîner", elementIds: [element!.id] }, backgroundKey });
    await tx.insert(linkViews).values({ organizationId, linkId: randomUUID(), layoutId: layout!.id, seenVersion: 1 });
  });
  setSignatureProviderForTests(undefined);
  return { organizationId, ownerId: ownerId[0]!.id, invoiceNumber: invoice.number, documentKey: key, links: loaded.links.filter((link) => link.organisation === "ORG-01") };
}

