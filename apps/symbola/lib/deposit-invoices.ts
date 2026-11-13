// Lot 31b (FAC-05, D6) — factures d'acompte émises d'elles-mêmes : à la signature (worker
// d'événements, quotes.quote.signed ; page de signature fictive), et à chaque passage régulier
// (lendemain de la fin du délai de rétractation, devis d'essai). Chaque organisation est traitée
// dans son propre contexte (RLS) ; une erreur n'empêche pas les suivantes. Journal sans donnée
// personnelle : des identifiants.
import { appDatabase } from "@symbola/db/client";
import { listOrganizations } from "@/modules/hub/service";
import { issueScheduledDepositInvoices } from "@/modules/quotes/service";
import { renderInvoicePdf } from "@/app/devis/factures/render-invoice-pdf";

const ISSUANCE_INTERVAL_MS = 60 * 60 * 1000; // toutes les heures

export async function issueDueDepositInvoices(options: { organizationIds?: string[]; quoteId?: string; now?: Date } = {}): Promise<{ issued: number; blocked: number }> {
  const organizationIds = options.organizationIds ?? (await listOrganizations(appDatabase())).map((organization) => organization.id);
  const total = { issued: 0, blocked: 0 };
  for (const organizationId of organizationIds) {
    try {
      const result = await issueScheduledDepositInvoices({
        organizationId,
        quoteId: options.quoteId,
        now: options.now,
        renderOriginal: async (invoice, locale) => new Uint8Array(await renderInvoicePdf(organizationId, invoice, locale)),
      });
      total.issued += result.issued;
      total.blocked += result.blocked;
    } catch (error) {
      console.error(`factures d'acompte automatiques : passage échoué (organisation ${organizationId})`, error instanceof Error ? error.message : error);
    }
  }
  return total;
}

// Lancé une fois au démarrage du serveur (instrumentation.ts), puis toutes les heures.
export function scheduleDepositInvoiceIssuance(): void {
  let running = false;
  const run = () => {
    if (running) return;
    running = true;
    issueDueDepositInvoices()
      .catch((error: unknown) => {
        console.error("factures d'acompte automatiques : passage échoué", error instanceof Error ? error.message : error);
      })
      .finally(() => {
        running = false;
      });
  };
  run();
  setInterval(run, ISSUANCE_INTERVAL_MS).unref();
}
