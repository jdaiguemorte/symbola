// Lot 38b (HUB-29 ; D11, D12 ; ADR 0072) — un flux de calendrier ICS, lu par l'agenda de la
// personne sans session : l'adresse secrète (organisation et jeton) est vérifiée hachée sous la RLS
// de son organisation, la personne doit être toujours dans l'équipe, le module Évènements souscrit.
// Lecture seule, débit limité. Une adresse inconnue, régénérée ou retirée ne répond rien (404).
import { checkRateLimit } from "@/lib/rate-limit";
import { calendarFeedIcs } from "@/lib/calendar/feeds";
import { isEventsModuleEnabled } from "@/app/events/module-access";
import { resolveCalendarFeed } from "@/modules/hub/service";

function nothing(status = 404): Response {
  return new Response(null, { status, headers: { "Cache-Control": "no-store", "X-Robots-Tag": "noindex, nofollow, noarchive" } });
}

export async function GET(request: Request, { params }: { params: Promise<{ jeton: string }> }): Promise<Response> {
  const token = (await params).jeton.replace(/\.ics$/, "");
  const organization = token.split(".")[0] ?? null;
  const decision = await checkRateLimit("calendarFeed", { account: organization, headers: request.headers });
  if (!decision.allowed) return new Response(null, { status: 429, headers: { "Retry-After": String(decision.retryAfterSeconds), "Cache-Control": "no-store" } });
  const access = await resolveCalendarFeed(token);
  if (!access || !(await isEventsModuleEnabled(access.organizationId))) return nothing();
  const ics = await calendarFeedIcs(access);
  if (!ics) return nothing();
  return new Response(ics, {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": 'inline; filename="symbola.ics"',
      "Cache-Control": "private, no-store",
      "X-Robots-Tag": "noindex, nofollow, noarchive",
      "Referrer-Policy": "no-referrer",
    },
  });
}
