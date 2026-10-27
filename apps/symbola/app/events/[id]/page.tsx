import { notFound, redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { HelpButton } from "@symbola/ui";
import { getEvent, listLossReasons, listProspectSources } from "@/modules/events/service";
import { getAuthContext } from "@/lib/auth-context";
import { isEventsModuleEnabled, isValidId } from "../module-access";
import { ChangeStatusForm } from "./change-status-form";

export default async function EventDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const auth = await getAuthContext();
  if (auth.status === "unauthenticated") redirect("/login");
  if (auth.status === "mfa_required") redirect("/mfa");
  if (!auth.user.organizationId) redirect("/");
  const organizationId = auth.user.organizationId;

  const { id } = await params;
  const t = await getTranslations("Events");
  const tHelp = await getTranslations("Help");

  if (!(await isEventsModuleEnabled(organizationId))) {
    return (
      <main>
        <h1>{t("title")}</h1>
        <p>{t("moduleUnavailable")}</p>
      </main>
    );
  }
  if (!isValidId(id)) notFound();

  const [event, reasons, sources] = await Promise.all([
    getEvent(organizationId, id),
    listLossReasons(organizationId),
    listProspectSources(organizationId),
  ]);
  if (!event) notFound();
  const sourceLabel = sources.find((candidate) => candidate.id === event.prospectSourceId)?.label;

  const clientNames = event.clients.length
    ? event.clients.map((client) => client.firstName).join(" & ")
    : t("noClient");

  // EVT-02 : « étant donné un événement confirmé dont la date est passée,
  // alors l'app propose de le passer en Réalisé ».
  const isPastConfirmed =
    event.status === "confirmed" && event.eventDate !== null && event.eventDate < new Date().toISOString().slice(0, 10);

  return (
    <main>
      <h1>{clientNames}</h1>
      <HelpButton title={tHelp("eventsDetail.title")} body={tHelp("eventsDetail.body")} />

      <p>
        {t("eventDate")} : {event.eventDate ?? t("dateUnset")}
      </p>
      <p>
        {t("venueName")} : {event.venueName ?? "—"} {event.venueCity ? `(${event.venueCity})` : ""}
      </p>
      <p>
        {t("source")} : {sourceLabel ?? "—"}
      </p>

      {isPastConfirmed ? <p role="status">{t("suggestMarkDone")}</p> : null}

      <ChangeStatusForm eventId={event.id} currentStatus={event.status} reasons={reasons} />
    </main>
  );
}
