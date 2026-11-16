// Lot 37a (DOC-07, DOC-01 ; D5 ; ADR 0070) — un devis en cours n'est jamais stocké en PDF : seules
// ses données et son modèle le sont, et le PDF se rend à la demande. L'aperçu est ce même PDF,
// affiché au lieu d'être téléchargé. Contre un vrai PostgreSQL (RLS) et le stockage privé, la
// route du PDF appelée comme par le navigateur ; les écritures au stockage sont comptées.
import { randomUUID } from "node:crypto";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createOrganization } from "@symbola/auth";
import { createAppConnection, type AppDatabase } from "@symbola/db/client";
import { signedInAccount } from "@/lib/test-fixtures/session";
import { fillRequiredMentions } from "@/lib/test-fixtures/legal-mentions";
import { attachEventDocument, createProspect, createProspectSource } from "@/modules/events/service";
import { saveOnboardingStep } from "@/modules/hub/service";
import { addQuoteLine, createQuote } from "@/modules/quotes/service";

let sessionToken: string | undefined;
const writes = vi.hoisted(() => ({ count: 0 }));

vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: (name: string) => (name === "symbola_session" && sessionToken ? { value: sessionToken } : undefined),
    set: () => undefined,
    delete: () => undefined,
  }),
}));
vi.mock("next/cache", () => ({ revalidatePath: () => undefined }));
vi.mock("next-intl/server", () => ({
  getTranslations: async () => (key: string) => key,
  getLocale: async () => "fr",
}));
// Toute écriture au stockage privé passe par l'une de ces trois portes.
vi.mock("@symbola/files", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@symbola/files")>();
  return {
    ...actual,
    uploadFile: (...args: Parameters<typeof actual.uploadFile>) => {
      writes.count++;
      return actual.uploadFile(...args);
    },
    uploadPrivateObject: (...args: Parameters<typeof actual.uploadPrivateObject>) => {
      writes.count++;
      return actual.uploadPrivateObject(...args);
    },
    uploadPrivateFile: (...args: Parameters<typeof actual.uploadPrivateFile>) => {
      writes.count++;
      return actual.uploadPrivateFile(...args);
    },
  };
});

const { GET: getQuotePdf } = await import("./[quoteId]/pdf/route");

const TINY_PDF = new Uint8Array(Buffer.from("%PDF-1.4\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF\n", "latin1"));

async function withDb<T>(fn: (db: AppDatabase) => Promise<T>): Promise<T> {
  const { sql, db } = createAppConnection();
  try {
    return await fn(db);
  } finally {
    await sql.end();
  }
}

async function draftQuote() {
  const organizationId = (await withDb((db) => createOrganization(db, `Org ${randomUUID()}`))).id;
  await withDb((db) => saveOnboardingStep(db, organizationId, { vatRegime: "assujetti", vatRateDefaultBasisPoints: 2000 }));
  await fillRequiredMentions(organizationId);
  const planner = await withDb((db) => signedInAccount(db, { organizationId, role: "owner" }));
  const source = await createProspectSource(organizationId, "Salon");
  const event = await createProspect({ organizationId, createdByUserId: planner.userId, prospectSourceId: source.id, clients: [{ firstName: "Inès", lastName: "Morel" }] });
  const quote = await createQuote({ organizationId, eventId: event.id, createdByUserId: planner.userId });
  await addQuoteLine(organizationId, quote.id, { label: "Coordination jour J", unit: "forfait", quantityMilli: 1000, unitPriceCents: 150000 });
  return { organizationId, eventId: event.id, quoteId: quote.id, plannerId: planner.userId, plannerToken: planner.token };
}

function pdf(quoteId: string, preview: boolean) {
  return getQuotePdf(new Request(`http://localhost/devis/${quoteId}/pdf?version=1${preview ? "&apercu=1" : ""}`), { params: Promise.resolve({ quoteId }) });
}

// Deux rendus ne diffèrent que par leurs dates de production et leur identifiant de fichier.
function content(bytes: ArrayBuffer): string {
  return Buffer.from(bytes)
    .toString("latin1")
    .replace(/\/(CreationDate|ModDate) \([^)]*\)/g, "/$1 ()")
    .replace(/\/ID \[<[0-9a-f]+> <[0-9a-f]+>\]/gi, "/ID []");
}

beforeEach(() => {
  sessionToken = undefined;
  writes.count = 0;
});

describe("DOC-07 — Documents produits et non émis : le PDF se reconstruit à la demande", () => {
  it("l'aperçu d'un devis en cours est le PDF lui-même, affiché ; reconstruit, il est identique à l'aperçu", async () => {
    const { quoteId, plannerToken } = await draftQuote();
    sessionToken = plannerToken;
    const preview = await pdf(quoteId, true);
    const download = await pdf(quoteId, false);
    expect([preview.status, download.status]).toEqual([200, 200]);
    expect(preview.headers.get("Content-Disposition")).toMatch(/^inline; filename=".+-V1\.pdf"$/);
    expect(download.headers.get("Content-Disposition")).toMatch(/^attachment; filename=".+-V1\.pdf"$/);
    expect(preview.headers.get("Content-Type")).toBe("application/pdf");
    const [shown, rebuilt] = [content(await preview.arrayBuffer()), content(await download.arrayBuffer())];
    expect(shown.startsWith("%PDF-")).toBe(true);
    expect(rebuilt).toBe(shown);
  });

  it("aucun PDF de brouillon n'est conservé : ni l'aperçu ni le téléchargement n'écrivent au stockage", async () => {
    const { organizationId, eventId, quoteId, plannerId, plannerToken } = await draftQuote();
    sessionToken = plannerToken;
    await pdf(quoteId, true);
    await pdf(quoteId, false);
    await pdf(quoteId, true);
    expect(writes.count).toBe(0);
    // Le compteur voit bien une écriture : un document déposé en fait une.
    await attachEventDocument({ organizationId, eventId, label: "Plan", content: TINY_PDF, uploadedByUserId: plannerId });
    expect(writes.count).toBe(1);
  });

  it("abus : sans session, ou pour une autre organisation, ni aperçu ni PDF", async () => {
    const { quoteId } = await draftQuote();
    const other = await draftQuote();
    expect((await pdf(quoteId, true)).status).toBe(401);
    sessionToken = other.plannerToken;
    expect((await pdf(quoteId, true)).status).toBe(404);
  });
});
