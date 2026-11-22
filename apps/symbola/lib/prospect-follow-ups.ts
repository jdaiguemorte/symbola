// Lot 45 (CRM-05, CRM-06, CRM-07 ; D1 à D5 ; ADR 0090) — ce qui relie les modules autour du prospect :
// - les faits que d'autres modules connaissent (rendez-vous pris sur la page publique, signature),
//   demandés à leurs services pour arrêter les relances (D3), quand ces modules sont ouverts (ARC-07) ;
// - la page de réservation du module Rendez-vous, s'il est ouvert, pour le modèle « rendez-vous » ;
// - la tâche horaire qui prépare (ou envoie, si l'organisation l'a réglé) les relances du jour, et la
//   détection nocturne des doublons de contacts. Lancée par instrumentation.ts, derrière le verrou des
//   tâches périodiques (ADR 0076) ; les journaux ne portent que des identifiants (SEC-20).
import { SYSTEM_ACTOR, withActor } from "@symbola/db/actor";
import { appDatabase } from "@symbola/db/client";
import { parseEnv } from "@symbola/env";
import { getBookingPage, latestProspectAppointment } from "@/modules/appointments/service";
import { prepareDueFollowUps, prospectMessageContext, sendProspectFollowUp, type ExternalProspectActivity, type FollowUpSendOutcome } from "@/modules/events/service";
import { detectAllDuplicates, isModuleEnabled, listOrganizations, sendTimeReached } from "@/modules/hub/service";
import { automationHooks, oncePer, sendTimeDue } from "./automation-gates";
import { latestContactSignature } from "@/modules/quotes/service";

// Lot 66a (D1 ; ADR 0112) : toutes les cinq minutes, pour partir à l'heure réglée.
const INTERVAL_MS = 5 * 60 * 1000;
const DUPLICATES_HOUR = 3; // la nuit, heure de Paris

// La page de réservation, si le module Rendez-vous est ouvert et la page active (ARC-07).
export async function bookingPageUrl(organizationId: string): Promise<string | null> {
  if (!(await isModuleEnabled(appDatabase(), organizationId, "appointments"))) return null;
  const page = await getBookingPage(organizationId);
  return page?.active ? `${parseEnv(process.env).APP_PUBLIC_URL}/reserver/${page.slug}` : null;
}

// D3 — les actions du prospect connues des autres modules : un rendez-vous pris, une signature.
export function prospectExternalActivity(): ExternalProspectActivity {
  return async ({ organizationId, eventId, contactIds }) => {
    const db = appDatabase();
    const dates: Date[] = [];
    if (await isModuleEnabled(db, organizationId, "appointments")) {
      const booked = await latestProspectAppointment(organizationId, eventId, contactIds);
      if (booked) dates.push(booked);
    }
    if (await isModuleEnabled(db, organizationId, "quotes")) {
      const signed = await latestContactSignature(organizationId, contactIds);
      if (signed) dates.push(signed);
    }
    return dates.length > 0 ? new Date(Math.max(...dates.map((date) => date.getTime()))) : null;
  };
}

export async function prepareFollowUpsFor(organizationId: string, locale: "fr" | "en", now: Date = new Date()) {
  // Lot 53 (HUB-28, D5) : coupé, l'automatisme ne prépare rien ; remis en route, il ne rattrape rien.
  const hooks = await automationHooks(organizationId, "prospect_follow_up", now);
  if (!hooks) return { prepared: 0, stopped: 0, sent: 0 };
  // Lot 66a (D1, correctif) : à l'heure d'envoi de l'automatisme (heure de Paris) ; plus aucune relance
  // la nuit.
  if (!sendTimeReached(hooks.isSendTime, now)) return { prepared: 0, stopped: 0, sent: 0 };
  const bookingUrl = await bookingPageUrl(organizationId);
  return prepareDueFollowUps({
    organizationId,
    now,
    locale,
    hooks,
    external: prospectExternalActivity(),
    context: ({ eventId, contactIds }) => prospectMessageContext({ organizationId, eventId, locale, contactIds, bookingUrl }),
  });
}

// La planner envoie une relance relue (et peut-être modifiée) : les faits sont revérifiés juste avant.
export async function sendFollowUpNow(input: { organizationId: string; eventId: string; followUpId: string; userId: string; locale: "fr" | "en"; subject: string; body: string; now?: Date }): Promise<FollowUpSendOutcome> {
  const context = await prospectMessageContext({ organizationId: input.organizationId, eventId: input.eventId, locale: input.locale, bookingUrl: await bookingPageUrl(input.organizationId) });
  return sendProspectFollowUp({
    organizationId: input.organizationId,
    followUpId: input.followUpId,
    userId: input.userId,
    locale: input.locale,
    subject: input.subject,
    body: input.body,
    recipients: context?.recipients ?? [],
    values: context?.values ?? {},
    external: prospectExternalActivity(),
    ...(input.now ? { now: input.now } : {}),
  });
}

function parisHour(now: Date): number {
  return Number(new Intl.DateTimeFormat("fr-FR", { timeZone: "Europe/Paris", hour: "2-digit", hourCycle: "h23" }).format(now));
}

export async function runProspectTasks(now: Date = new Date()): Promise<{ prepared: number; sent: number; duplicates: number }> {
  const db = appDatabase();
  const totals = { prepared: 0, sent: 0, duplicates: 0 };
  for (const organization of await listOrganizations(db)) {
    // Lot 66a (D1 ; ADR 0112) : les relances à l'heure d'envoi de l'automatisme ; les doublons, une fois
    // dans l'heure de la nuit prévue. Ni l'un ni l'autre maintenant : rien n'est lu.
    const followUpsDue = await sendTimeDue(organization.id, "prospect_follow_up", now);
    const duplicatesDue = parisHour(now) === DUPLICATES_HOUR && oncePer(2 * 60 * 60 * 1000, `duplicates:${organization.id}`, now);
    if (!followUpsDue && !duplicatesDue) continue;
    try {
      await withActor(SYSTEM_ACTOR, async () => {
        if (followUpsDue && (await isModuleEnabled(db, organization.id, "events"))) {
          const result = await prepareFollowUpsFor(organization.id, organization.language === "en" ? "en" : "fr", now);
          totals.prepared += result.prepared;
          totals.sent += result.sent;
        }
        if (duplicatesDue) totals.duplicates += await detectAllDuplicates(organization.id, now);
      });
    } catch (error) {
      console.error("tâches des prospects échouées", organization.id, error instanceof Error ? error.name : "inconnue");
    }
  }
  return totals;
}

export function scheduleProspectTasks(): void {
  let running = false;
  const run = () => {
    if (running) return;
    running = true;
    runProspectTasks()
      .catch((error: unknown) => {
        console.error("tâches des prospects échouées", error instanceof Error ? error.name : "inconnue");
      })
      .finally(() => {
        running = false;
      });
  };
  run();
  setInterval(run, INTERVAL_MS).unref();
}
