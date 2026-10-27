// BUD-03 — devis prestataire joint à une ligne de budget, contre un vrai
// PostgreSQL (RLS), ClamAV et le stockage objet, par la porte d'entrée du
// module.
import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import { addDefaultVendorSlots, createProspect, createProspectSource, listEventVendorSlots } from "@/modules/events/service";
import {
  BudgetLineAttachmentNotFoundError,
  BudgetLineNotFoundError,
  EventNotFoundError,
  QuoteFileTooLargeError,
  QuoteFileUnsupportedTypeError,
  attachBudgetLineQuote,
  getBudgetLineAttachmentUrl,
  listBudgetLines,
  updateBudgetLine,
} from "./service";

const plannerId = randomUUID();

const TINY_PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=",
  "base64",
);
const TINY_PDF = Buffer.from("%PDF-1.4\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF\n", "latin1");

// Un événement avec un poste « Photographe » et sa ligne de budget.
async function createLine(organizationId: string) {
  await addDefaultVendorSlots(organizationId, ["Photographe"]);
  const source = await createProspectSource(organizationId, "Salon");
  const event = await createProspect({
    organizationId,
    createdByUserId: plannerId,
    prospectSourceId: source.id,
    clients: [{ firstName: "Camille", lastName: null }],
  });
  const [slot] = await listEventVendorSlots(organizationId, event.id);
  await updateBudgetLine({
    organizationId,
    eventId: event.id,
    eventVendorSlotId: slot!.id,
    field: "planned",
    amountCents: 250000,
    changedByUserId: plannerId,
  });
  return { eventId: event.id, eventVendorSlotId: slot!.id };
}

describe("BUD-03 — Devis prestataire joint", () => {
  it("un devis PDF joint à une ligne s'ouvre par un lien signé temporaire", async () => {
    const organizationId = randomUUID();
    const { eventId, eventVendorSlotId } = await createLine(organizationId);

    const attachment = await attachBudgetLineQuote({
      organizationId,
      eventId,
      eventVendorSlotId,
      content: TINY_PDF,
      uploadedByUserId: plannerId,
    });
    expect(attachment).toMatchObject({ mime: "application/pdf", sizeBytes: TINY_PDF.length });

    const [line] = (await listBudgetLines(organizationId, eventId)).lines;
    expect(line?.attachments).toEqual([attachment]);
    // La vue ne porte jamais d'URL ni de clé de stockage.
    expect(JSON.stringify(line)).not.toContain(organizationId);

    const url = await getBudgetLineAttachmentUrl(organizationId, attachment.id);
    expect(new URL(url).searchParams.get("X-Amz-Expires")).toBe("300");
    const response = await fetch(url);
    expect(response.status).toBe(200);
    expect(Buffer.from(await response.arrayBuffer()).equals(TINY_PDF)).toBe(true);
  });

  it("accepte aussi une image, et plusieurs devis sur la même ligne", async () => {
    const organizationId = randomUUID();
    const { eventId, eventVendorSlotId } = await createLine(organizationId);
    const input = { organizationId, eventId, eventVendorSlotId, uploadedByUserId: plannerId };

    await attachBudgetLineQuote({ ...input, content: TINY_PDF });
    await attachBudgetLineQuote({ ...input, content: TINY_PNG });

    const [line] = (await listBudgetLines(organizationId, eventId)).lines;
    expect(line?.attachments.map((attachment) => attachment.mime)).toEqual(["application/pdf", "image/png"]);
  });

  // Le refus d'un fichier infecté est couvert par attachments.test.ts : un
  // fichier EICAR n'est ni un PDF ni une image, il est donc refusé dès le
  // contrôle de type (même ordre que @symbola/files, SOC-08).
  it("rejette un format non supporté ou un fichier trop lourd, sans rien enregistrer", async () => {
    const organizationId = randomUUID();
    const { eventId, eventVendorSlotId } = await createLine(organizationId);
    const input = { organizationId, eventId, eventVendorSlotId, uploadedByUserId: plannerId };

    await expect(
      attachBudgetLineQuote({ ...input, content: Buffer.from("devis en texte brut") }),
    ).rejects.toBeInstanceOf(QuoteFileUnsupportedTypeError);
    await expect(
      attachBudgetLineQuote({ ...input, content: Buffer.alloc(20 * 1024 * 1024 + 1, 0x25) }),
    ).rejects.toBeInstanceOf(QuoteFileTooLargeError);

    const [line] = (await listBudgetLines(organizationId, eventId)).lines;
    expect(line?.attachments).toEqual([]);
  });

  it("refuse un poste sans ligne de budget", async () => {
    const organizationId = randomUUID();
    await addDefaultVendorSlots(organizationId, ["DJ"]);
    const source = await createProspectSource(organizationId, "Salon");
    const event = await createProspect({
      organizationId,
      createdByUserId: plannerId,
      prospectSourceId: source.id,
      clients: [{ firstName: "Lou", lastName: null }],
    });
    const [slot] = await listEventVendorSlots(organizationId, event.id);

    await expect(
      attachBudgetLineQuote({
        organizationId,
        eventId: event.id,
        eventVendorSlotId: slot!.id,
        content: TINY_PDF,
        uploadedByUserId: plannerId,
      }),
    ).rejects.toBeInstanceOf(BudgetLineNotFoundError);
  });
});

describe("BUD-03 — Isolation entre organisations", () => {
  it("une organisation ne joint rien au budget d'une autre et n'ouvre jamais ses devis", async () => {
    const organizationId = randomUUID();
    const otherOrganizationId = randomUUID();
    const own = await createLine(organizationId);
    const attachment = await attachBudgetLineQuote({
      organizationId,
      eventId: own.eventId,
      eventVendorSlotId: own.eventVendorSlotId,
      content: TINY_PDF,
      uploadedByUserId: plannerId,
    });

    await expect(
      attachBudgetLineQuote({
        organizationId: otherOrganizationId,
        eventId: own.eventId,
        eventVendorSlotId: own.eventVendorSlotId,
        content: TINY_PDF,
        uploadedByUserId: plannerId,
      }),
    ).rejects.toBeInstanceOf(EventNotFoundError);
    await expect(getBudgetLineAttachmentUrl(otherOrganizationId, attachment.id)).rejects.toBeInstanceOf(
      BudgetLineAttachmentNotFoundError,
    );
    expect((await listBudgetLines(organizationId, own.eventId)).lines[0]?.attachments).toHaveLength(1);
  });
});
