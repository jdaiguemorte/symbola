// Lot 53 (HUB-28 ; D5 ; ADR 0095) — rappel au payeur sept jours avant l'échéance (délai réglable), lancé
// par la tâche du règlement (settlement-jobs.ts) quand l'automatisme est actif. Le destinataire est le
// payeur désigné de l'échéance (lot 43, module Budget, son lien personnel du module Évènements) ; sans
// lui, ou module Budget fermé, les signataires du devis. Chaque module est lu par son service (ARC-01).
// Jamais après un virement déclaré ; une seule fois par échéance et par destinataire.
import { appDatabase } from "@symbola/db/client";
import type { AutomationHooks } from "@symbola/contracts";
import { getInstalmentPayerLinkId } from "@/modules/budget/service";
import { clientTermForEvent, listEventLinks } from "@/modules/events/service";
import { getAutomationGate, isModuleEnabled } from "@/modules/hub/service";
import { planPaymentDueReminders, sendPaymentDueReminder } from "@/modules/quotes/service";

export async function sendPaymentDueReminders(organizationId: string, now: Date = new Date(), hooks: AutomationHooks = {}): Promise<number> {
  const gate = await getAutomationGate(organizationId, "payment_due_reminder");
  const budgetOpen = await isModuleEnabled(appDatabase(), organizationId, "budget");
  let sent = 0;
  for (const planned of await planPaymentDueReminders(organizationId, gate.days ?? 7, now)) {
    // D5 : un rappel dont le jour est passé pendant que l'automatisme était coupé n'est pas rattrapé.
    if (hooks.notBefore && planned.sendOn < hooks.notBefore) continue;
    const recipients: { key: string; name: string; email: string }[] = [];
    if (budgetOpen) {
      const linkId = await getInstalmentPayerLinkId(organizationId, planned.eventId, planned.scheduleItemId);
      const link = linkId ? (await listEventLinks(organizationId, planned.eventId)).find((candidate) => candidate.id === linkId && candidate.status === "active") : undefined;
      if (link) recipients.push({ key: link.id, name: link.personName, email: link.email });
    }
    const terms = { fr: (await clientTermForEvent(organizationId, planned.eventId, "fr")).term, en: (await clientTermForEvent(organizationId, planned.eventId, "en")).term };
    const count = await sendPaymentDueReminder(organizationId, planned, { recipients, clientTerm: (locale) => terms[locale], now });
    if (count === 0) continue;
    sent += count;
    await hooks.onRun?.({ objectKey: planned.scheduleItemId, objectLabel: planned.quoteNumber, href: `/devis/${planned.quoteId}`, result: "sent" });
  }
  return sent;
}
