// Lot 53 (HUB-15, UX-16, ARC-09, HUB-28, GC-02, CHR-05, CHR-10 ; D1, D2, D5, D7 ; ADR 0095) — tâche
// périodique des notifications, toutes les cinq minutes, derrière le verrou des tâches périodiques
// (ADR 0076). Pour chaque organisation :
// 1. les e-mails immédiats et les push dus (hors plages de silence, ou à leur fin) ;
// 2. une fois par matin, à partir de l'heure du radar (risk-radar.json) : les tâches récurrentes arrivées
//    à leur date, les tâches et jalons en retard, les devis expirés, puis le radar des risques (s'il est
//    actif), chacun en notification, une seule fois par objet ; les purges (DPO-10) ;
// 3. le récapitulatif de chaque personne, à son heure, dans le fuseau de l'organisation.
// Chaque module est lu par son service (ARC-01) ; un module fermé ne produit rien (ARC-06). Journaux :
// des identifiants seulement (SEC-20).
import { createTranslator } from "next-intl";
import frMessages from "@symbola/i18n/messages/fr.json";
import enMessages from "@symbola/i18n/messages/en.json";
import { SYSTEM_ACTOR, withActor } from "@symbola/db/actor";
import { appDatabase } from "@symbola/db/client";
import { parisToday } from "@symbola/i18n";
import { starterRiskRadarHour } from "@symbola/starter-templates";
import { getEvent, listLatePlannerTasks, listOrganizationTasks, listStandaloneTasks, spawnDueRecurringTasks } from "@/modules/events/service";
import {
  claimDailyAutomationRun,
  deliverDueNotifications,
  getAutomationGate,
  isModuleEnabled,
  listOrganizations,
  localClock,
  notify,
  purgeAutomationRuns,
  purgeEmailDeliveries,
  purgeNotifications,
  recordAutomationRun,
  sendDueDigests,
} from "@/modules/hub/service";
import { listRecentlyExpiredProposals } from "@/modules/quotes/service";
import { getVendorsByIds, listPendingBankChecks, listVendorDocumentNotices } from "@/modules/vendors/service";
import { loadRiskRadar } from "./risk-radar/load";

const INTERVAL_MS = 5 * 60 * 1000;
const PARIS = "Europe/Paris";

function digestWords(locale: "fr" | "en") {
  return createTranslator({ locale, messages: locale === "en" ? enMessages : frMessages, namespace: "Notifications.digest" });
}

// NFR-02 (lot 65, ADR 0114) : le jour du dernier passage du matin de chaque organisation, connu du
// processus ; il évite de redemander à la base, toutes les cinq minutes, un passage déjà fait. La base
// reste l'arbitre (claimDailyAutomationRun) : un redémarrage la relit.
const morningDoneOn = new Map<string, string>();

// Le passage du matin : true s'il a eu lieu à cet appel (une fois par jour et par organisation).
export async function runMorningPass(organizationId: string, now: Date = new Date()): Promise<boolean> {
  const today = parisToday(now);
  if (localClock(now, PARIS).minute < starterRiskRadarHour() * 60) return false;
  if (morningDoneOn.get(organizationId) === today) return false;
  const claimed = await claimDailyAutomationRun(organizationId, "risk_radar", today);
  morningDoneOn.set(organizationId, today);
  if (!claimed) return false;
  const db = appDatabase();
  const eventsOpen = await isModuleEnabled(db, organizationId, "events");
  if (eventsOpen) {
    // CHR-10 : la répétition d'une tâche hors évènement arrivée à sa date.
    await spawnDueRecurringTasks(organizationId, today, now);
    // CHR-05, UX-16 : chaque tâche de la planner en retard, une fois ; un jalon en retard part en alerte.
    for (const task of await listLatePlannerTasks(organizationId, today)) {
      if (task.isDemo) continue;
      await notify({
        organizationId,
        type: task.isMilestone ? "milestone_late" : "task_overdue",
        eventId: task.eventId,
        objectKey: task.taskId,
        params: { label: task.label.slice(0, 200) },
        href: `/events/${task.eventId}?onglet=taches&tache=${task.taskId}`,
        eventDate: task.eventDate,
        now,
      });
    }
  }
  if (await isModuleEnabled(db, organizationId, "quotes")) {
    for (const quote of await listRecentlyExpiredProposals(organizationId, today)) {
      const event = eventsOpen ? await getEvent(organizationId, quote.eventId).catch(() => null) : null;
      await notify({ organizationId, type: "quote_expired", eventId: quote.eventId, objectKey: quote.quoteId, params: { number: quote.number }, href: `/devis/${quote.quoteId}`, eventDate: event?.eventDate ?? null, now });
    }
  }
  // Lot 48a (PRE-05, PRE-10) : chaque IBAN changé « à vérifier » et chaque pièce expirée ou proche de sa
  // fin, une seule fois, à la Propriétaire (le carnet n'appartient à aucun évènement).
  if (await isModuleEnabled(db, organizationId, "vendors")) {
    const pending = await listPendingBankChecks(organizationId);
    const names = new Map((await getVendorsByIds(organizationId, [...pending.keys()])).map((vendor) => [vendor.id, vendor.name]));
    for (const check of pending.values()) {
      const vendor = names.get(check.vendorId);
      if (vendor) await notify({ organizationId, type: "iban_to_verify", eventId: null, objectKey: check.changeId, params: { vendor: vendor.slice(0, 200) }, href: `/prestataires/${check.vendorId}`, now });
    }
    for (const notice of await listVendorDocumentNotices(organizationId, { now })) {
      if (notice.reason !== "expired" && notice.reason !== "expiring") continue;
      await notify({ organizationId, type: "document_expiring", eventId: null, objectKey: `${notice.documentId}:${notice.reason}`, params: { vendor: notice.vendorName.slice(0, 200), document: notice.kindLabel.slice(0, 200) }, href: `/prestataires/${notice.vendorId}`, now });
    }
  }
  // GC-02 : le radar, s'il est actif (HUB-28) ; chaque alerte une seule fois, avec sa règle expliquée.
  const radarGate = await getAutomationGate(organizationId, "risk_radar");
  if (radarGate.enabled) {
    const radar = await loadRiskRadar(organizationId, now);
    for (const alert of radar.alerts) {
      const event = alert.eventId ? await getEvent(organizationId, alert.eventId).catch(() => null) : null;
      const params: Record<string, string | number> = { rule: alert.rule, threshold: alert.thresholdDays };
      for (const [key, value] of Object.entries(alert.facts)) params[key] = typeof value === "string" ? value.slice(0, 200) : value;
      await notify({ organizationId, type: "risk_alert", eventId: alert.eventId, objectKey: alert.key, params, href: alert.href, eventDate: event?.eventDate ?? null, now });
    }
    await recordAutomationRun(organizationId, "risk_radar", { objectKey: today, objectLabel: String(radar.alerts.length), href: "/", result: "done", ranAt: now });
  }
  await purgeNotifications(organizationId, now);
  await purgeAutomationRuns(organizationId, now);
  // Lot 55 (MSG-05) : le journal des envois est purgé à 13 mois.
  await purgeEmailDeliveries(organizationId, now);
  return true;
}

// Ce qui attend aujourd'hui, en lignes du récapitulatif : tâches du jour et en retard, risques.
async function digestExtras(organizationId: string, locale: "fr" | "en", now: Date): Promise<string[]> {
  const today = parisToday(now);
  const t = digestWords(locale);
  const lines: string[] = [];
  const db = appDatabase();
  if (await isModuleEnabled(db, organizationId, "events")) {
    const eventTasks = (await listOrganizationTasks({ organizationId, today, horizonDays: 0 })).filter((task) => task.responsible === "planner" && !task.event.isDemo);
    const standalone = await listStandaloneTasks(organizationId, { until: today });
    const due = eventTasks.length + standalone.length;
    const late = eventTasks.filter((task) => task.overdue).length + standalone.filter((task) => task.dueDate < today).length;
    if (due > 0) lines.push(t("tasks", { count: due, late }));
  }
  if ((await getAutomationGate(organizationId, "risk_radar")).enabled) {
    const radar = await loadRiskRadar(organizationId, now);
    if (radar.alerts.length > 0) lines.push(t("risks", { count: radar.alerts.length }));
  }
  return lines;
}

export async function runNotificationJobs(now: Date = new Date()): Promise<{ emails: number; pushes: number; digests: number; mornings: number }> {
  const db = appDatabase();
  const total = { emails: 0, pushes: 0, digests: 0, mornings: 0 };
  for (const organization of await listOrganizations(db)) {
    try {
      await withActor(SYSTEM_ACTOR, async () => {
        if (await runMorningPass(organization.id, now)) total.mornings += 1;
        const delivered = await deliverDueNotifications(organization.id, now);
        total.emails += delivered.emails;
        total.pushes += delivered.pushes;
        total.digests += await sendDueDigests(organization.id, (_userId, locale) => digestExtras(organization.id, locale, now), now);
      });
    } catch (error) {
      console.error("notifications échouées", organization.id, error instanceof Error ? error.name : "inconnue");
    }
  }
  return total;
}

export function scheduleNotificationJobs(): void {
  let running = false;
  const run = () => {
    if (running) return;
    running = true;
    runNotificationJobs()
      .catch((error: unknown) => {
        console.error("notifications échouées", error instanceof Error ? error.name : "inconnue");
      })
      .finally(() => {
        running = false;
      });
  };
  run();
  setInterval(run, INTERVAL_MS).unref();
}
