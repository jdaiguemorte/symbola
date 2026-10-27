import { notFound, redirect } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { formatAmount, type Locale } from "@symbola/i18n";
import { HelpButton } from "@symbola/ui";
import {
  getEvent,
  listEventVendorSlots,
  listLossReasons,
  listProspectSources,
  summarizeVendorSlots,
} from "@/modules/events/service";
import { getAuthContext } from "@/lib/auth-context";
import { isEventsModuleEnabled, isValidId } from "../module-access";
import { ChangeStatusForm } from "./change-status-form";
import { removeVendorSlotAction } from "./vendor-slot-actions";
import { AddVendorSlotForm, VendorSlotForm } from "./vendor-slot-forms";
import { VENDOR_STATUS_COLORS, VENDOR_STATUS_LABEL_KEYS } from "./vendor-slot-status";

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

  const [event, reasons, sources, vendorSlots] = await Promise.all([
    getEvent(organizationId, id),
    listLossReasons(organizationId),
    listProspectSources(organizationId),
    listEventVendorSlots(organizationId, id),
  ]);
  if (!event) notFound();
  const locale = (await getLocale()) as Locale;
  const progress = summarizeVendorSlots(vendorSlots);
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

      {/* EVT-03 : barre d'avancement en haut de la fiche. */}
      <p id="vendor-progress-label">
        {t("vendorProgress", { booked: progress.booked, required: progress.required })}
      </p>
      <progress
        aria-labelledby="vendor-progress-label"
        value={progress.booked}
        max={Math.max(progress.required, 1)}
      />

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

      <h2>{t("vendorSlotsTitle")}</h2>
      {vendorSlots.length === 0 ? <p>{t("noVendorSlots")}</p> : null}
      <ul>
        {vendorSlots.map((slot) => (
          <li key={slot.id}>
            <strong>{slot.label}</strong>{" "}
            <span style={{ ...VENDOR_STATUS_COLORS[slot.status], padding: "0 0.4em", borderRadius: "0.3em" }}>
              {t(VENDOR_STATUS_LABEL_KEYS[slot.status])}
            </span>
            {slot.status === "booked" && slot.vendorName ? ` — ${slot.vendorName}` : ""}
            {slot.status === "booked" && slot.amountCents !== null ? ` — ${formatAmount(slot.amountCents, locale)}` : ""}
            <VendorSlotForm eventId={event.id} slot={slot} />
            <form action={removeVendorSlotAction}>
              <input type="hidden" name="eventId" value={event.id} />
              <input type="hidden" name="vendorSlotId" value={slot.id} />
              <button type="submit">{t("removeVendorSlot", { label: slot.label })}</button>
            </form>
          </li>
        ))}
      </ul>
      <AddVendorSlotForm eventId={event.id} />
    </main>
  );
}
