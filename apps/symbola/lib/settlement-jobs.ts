// Lot 43 (FAC-09, FAC-15, JUR-07 ; D1, D7 ; ADR 0087, ADR 0089) — tâche horaire du règlement : pour chaque
// organisation dont le module Devis est ouvert, la relance avant l'expiration des propositions, le RIB
// envoyé le jour où un paiement peut être demandé (hors établissement), puis les relances d'impayés.
// Chaque passage reprend ce qui est dû à ce jour : une panne est rattrapée au passage suivant, sans
// doublon (chaque envoi s'inscrit une fois en base, avec sa clé d'unicité dans la file des e-mails,
// lot 40b). Rien ne part hors des heures d'envoi. Lancée derrière le verrou des tâches périodiques
// (ADR 0076). Journaux : des identifiants seulement (SEC-20).
import { SYSTEM_ACTOR, withActor } from "@symbola/db/actor";
import { appDatabase } from "@symbola/db/client";
import { isModuleEnabled, listOrganizations } from "@/modules/hub/service";
import { automationHooks } from "./automation-gates";
import { sendPaymentDueReminders } from "./payment-due-reminders";
import { sendDueSettlementDetails, sendInvoiceReminders, sendProposalExpiryReminders } from "@/modules/quotes/service";

const INTERVAL_MS = 60 * 60 * 1000; // toutes les heures

export async function runSettlementJobs(now: Date = new Date()): Promise<{ expiry: number; details: number; reminders: number; dueSoon: number }> {
  const db = appDatabase();
  const total = { expiry: 0, details: 0, reminders: 0, dueSoon: 0 };
  for (const organization of await listOrganizations(db)) {
    if (!(await isModuleEnabled(db, organization.id, "quotes"))) continue;
    try {
      await withActor(SYSTEM_ACTOR, async () => {
        // Lot 53 (HUB-28, D5) : chaque relance a son interrupteur ; le RIB du 8e jour hors établissement
        // (JUR-07) n'en a pas.
        const expiry = await automationHooks(organization.id, "proposal_expiry_reminder", now);
        if (expiry) total.expiry += await sendProposalExpiryReminders(organization.id, now, expiry);
        total.details += await sendDueSettlementDetails(organization.id, now);
        const reminders = await automationHooks(organization.id, "invoice_reminder", now);
        if (reminders) total.reminders += await sendInvoiceReminders(organization.id, now, reminders);
        const dueSoon = await automationHooks(organization.id, "payment_due_reminder", now);
        if (dueSoon) total.dueSoon += await sendPaymentDueReminders(organization.id, now, dueSoon);
      });
    } catch (error) {
      console.error("relances du règlement échouées", organization.id, error instanceof Error ? error.name : "inconnue");
    }
  }
  return total;
}

export function scheduleSettlementJobs(): void {
  let running = false;
  const run = () => {
    if (running) return;
    running = true;
    runSettlementJobs()
      .catch((error: unknown) => {
        console.error("relances du règlement échouées", error instanceof Error ? error.name : "inconnue");
      })
      .finally(() => {
        running = false;
      });
  };
  run();
  setInterval(run, INTERVAL_MS).unref();
}
