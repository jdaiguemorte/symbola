// Lot 52 (HUB-04 ; décision de Julien du 19/11/2026, ADR 0094) — la facture de commission au prestataire
// (lot 48b, PRE-07) se lit par le Comptable invité par la Propriétaire, en lecture seule, comme les autres
// factures : son original Factur-X, et sa ligne dans la comptabilité. Tests d'abus (CLAUDE.md § 2.11,
// SEC-36) : le Comptable n'émet ni ne modifie rien ; une facture d'une autre organisation répond comme une
// facture inexistante.
import { randomUUID } from "node:crypto";
import { describe, expect, it, vi } from "vitest";

let sessionToken: string | undefined;

vi.mock("next/headers", () => ({
  headers: async () => new Headers({ host: "app.test" }),
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

const { createOrganization } = await import("@symbola/auth");
const { createAppConnection } = await import("@symbola/db/client");
const { signedInAccount } = await import("@/lib/test-fixtures/session");
const { fillRequiredMentions } = await import("@/lib/test-fixtures/legal-mentions");
const { minimalPdf } = await import("@/lib/test-fixtures/pdf");
const { saveOnboardingStep } = await import("@/modules/hub/service");
const { createProspect, createProspectSource } = await import("@/modules/events/service");
const quotes = await import("@/modules/quotes/service");
const { GET: getCommissionInvoice } = await import("./factures/[invoiceId]/route");
const { issueCommissionInvoiceAction, updateCommissionAction, addCommissionAction } = await import("./[eventId]/actions");

const render = async () => new Uint8Array(minimalPdf("facture de commission"));

// Une organisation, sa Propriétaire et son Comptable (invité par elle), un évènement et une commission
// facturée au prestataire.
async function atelier() {
  const { sql, db } = createAppConnection();
  try {
    const organizationId = (await createOrganization(db, `Atelier ${randomUUID().slice(0, 6)}`)).id;
    await saveOnboardingStep(db, organizationId, { vatRegime: "assujetti", vatRateDefaultBasisPoints: 2000, siren: "123456782", metier: "wedding_planner" });
    await fillRequiredMentions(organizationId);
    const owner = await signedInAccount(db, { organizationId, role: "owner" });
    const accountant = await signedInAccount(db, { organizationId, role: "accountant" });
    const source = await createProspectSource(organizationId, "Salon");
    const eventId = (await createProspect({ organizationId, createdByUserId: owner.userId, prospectSourceId: source.id, eventDate: "2027-09-18", clients: [{ firstName: "Léa", lastName: "Martin" }] })).id;
    const commission = await quotes.addCommission(organizationId, { eventId, vendorId: null, vendorName: "Maison Haddad", nature: "commission", amountCents: 45_000 });
    const invoice = await quotes.issueCommissionInvoice({
      organizationId,
      commissionId: commission.id,
      buyer: { name: "Maison Haddad SARL", addressLine: "12 rue du Port", postalCode: "59000", city: "Lille", countryCode: "FR", siret: "55210055400013" },
      label: "Commission — mariage de Léa",
      renderOriginal: render,
    });
    const second = await quotes.addCommission(organizationId, { eventId, vendorId: null, vendorName: "Fleurs d'Élodie", nature: "commission", amountCents: 12_000 });
    return { organizationId, eventId, owner, accountant, commission, second, invoice };
  } finally {
    await sql.end();
  }
}

function request(invoiceId: string) {
  return getCommissionInvoice(new Request(`http://app.test/devis/argent/factures/${invoiceId}`), { params: Promise.resolve({ invoiceId }) });
}

function form(fields: Record<string, string>) {
  const data = new FormData();
  for (const [key, value] of Object.entries(fields)) data.set(key, value);
  return data;
}

describe("HUB-04 / PRE-07 — Le Comptable lit les factures de commission, en lecture seule (décision du 19/11)", () => {
  it("lit l'original Factur-X d'une facture de commission de son organisation, qui figure dans sa comptabilité", async () => {
    const a = await atelier();
    sessionToken = a.accountant.token;
    const response = await request(a.invoice.id);
    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe("application/pdf");
    expect(response.headers.get("content-disposition")).toContain(`${a.invoice.number}.pdf`);
    expect(Buffer.from(await response.arrayBuffer()).subarray(0, 5).toString("latin1")).toBe("%PDF-");
    expect(await quotes.commissionInvoiceIds(a.organizationId, [a.invoice.id, randomUUID()])).toEqual(new Set([a.invoice.id]));
  });

  it("n'émet aucune facture de commission et ne modifie aucune commission", async () => {
    const a = await atelier();
    sessionToken = a.accountant.token;
    expect(await issueCommissionInvoiceAction({}, form({ eventId: a.eventId, commissionId: a.second.id }))).toEqual({ error: "unauthorized" });
    expect(await addCommissionAction({}, form({ eventId: a.eventId, vendorName: "Traiteur", nature: "commission", amount: "100" }))).toEqual({ error: "unauthorized" });
    await updateCommissionAction(form({ eventId: a.eventId, commissionId: a.second.id, action: "remove" }));
    await updateCommissionAction(form({ eventId: a.eventId, commissionId: a.commission.id, action: "received" }));
    const commissions = await quotes.listEventCommissions(a.organizationId, a.eventId);
    expect(commissions.map((entry) => [entry.id, entry.status]).sort()).toEqual(
      [
        [a.commission.id, "invoiced"],
        [a.second.id, "expected"],
      ].sort(),
    );
  });

  it("une facture de commission d'une autre organisation répond comme une facture inexistante", async () => {
    const a = await atelier();
    const b = await atelier();
    sessionToken = a.accountant.token;
    const other = await request(b.invoice.id);
    const missing = await request(randomUUID());
    expect(other.status).toBe(missing.status);
    expect(other.status).not.toBe(200);
    expect(await other.text()).toBe(await missing.text());
    expect(await quotes.commissionInvoiceIds(a.organizationId, [b.invoice.id])).toEqual(new Set());
  });

  it("sans session, ou avec une session sans double authentification, rien ne se lit", async () => {
    const a = await atelier();
    sessionToken = undefined;
    expect((await request(a.invoice.id)).status).toBe(401);
    const { sql, db } = createAppConnection();
    try {
      sessionToken = (await signedInAccount(db, { organizationId: a.organizationId, role: "accountant", mfa: false })).token;
    } finally {
      await sql.end();
    }
    expect((await request(a.invoice.id)).status).toBe(401);
  });
});
