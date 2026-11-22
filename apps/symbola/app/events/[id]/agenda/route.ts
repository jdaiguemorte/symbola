// Lot 64 (HUB-29 ; D5 ; ADR 0109) — « Ajouter à mon agenda » : un fichier iCalendar d'un seul évènement,
// sa plage occupée, marquée « occupé » (TRANSP:OPAQUE), à importer dans l'agenda principal que lit un
// outil de réservation extérieur (TidyCal, Calendly…). Le fichier importé ne suit pas les changements :
// l'écran le dit. Contrôles côté serveur : session, rôle planner, organisation, module souscrit,
// identifiant valide ; un évènement sans date ou d'essai ne répond rien. Aucun nom dans le nom du fichier.
import { createTranslator } from "next-intl";
import frMessages from "@symbola/i18n/messages/fr.json";
import enMessages from "@symbola/i18n/messages/en.json";
import { parseEnv } from "@symbola/env";
import { refusedResponse } from "@/lib/access-refusals";
import { getPlannerAuthContext } from "@/lib/auth-context";
import { buildIcs } from "@/lib/calendar/ics";
import { eventNames, getEvent, getEventBusy } from "@/modules/events/service";
import { isEventsModuleEnabled, isValidId } from "../../module-access";

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }): Promise<Response> {
  const auth = await getPlannerAuthContext();
  if (auth.status !== "authenticated" || !auth.user.organizationId) return new Response(null, { status: 401 });
  const organizationId = auth.user.organizationId;
  if (!(await isEventsModuleEnabled(organizationId))) return new Response(null, { status: 404 });
  const { id } = await params;
  if (!isValidId(id)) return new Response(null, { status: 404 });
  const [event, busy] = await Promise.all([getEvent(organizationId, id), getEventBusy(organizationId, id)]);
  if (!event || !busy || event.isDemo || busy.startsAt === null || busy.endsAt === null) return refusedResponse(request);
  const locale = auth.user.language === "en" ? "en" : "fr";
  const t = createTranslator({ locale, messages: locale === "en" ? enMessages : frMessages, namespace: "Calendar" });
  const names = eventNames(event.clients);
  const appUrl = parseEnv(process.env).APP_PUBLIC_URL.replace(/\/+$/, "");
  const ics = buildIcs({
    name: t("busyFileName"),
    now: new Date(),
    events: [
      {
        uid: `${id}-plage@symbola`,
        summary: busy.typeLabel ? `${busy.typeLabel} — ${names}` : names,
        start: { dateTime: new Date(busy.startsAt) },
        end: { dateTime: new Date(busy.endsAt) },
        url: `${appUrl}/events/${id}`,
        status: busy.status === "option" || busy.status === "postponed" ? "TENTATIVE" : "CONFIRMED",
        transparency: "OPAQUE",
      },
    ],
  });
  return new Response(ics, {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": 'attachment; filename="plage-occupee.ics"',
      "Cache-Control": "private, no-store",
      "X-Robots-Tag": "noindex, nofollow, noarchive",
    },
  });
}
