import { getLocale, getTranslations } from "next-intl/server";
import type { Locale } from "@symbola/i18n";
import { ScreenHelp } from "@/app/screen-help";
import { getContact } from "@/modules/hub/service";
import { requirePlanner } from "@/lib/guards";
import { ensureEventTypes } from "@/lib/events/event-types";
import { clientFieldLabelsByAudience } from "@/lib/vocabulary";
import { isEventsModuleEnabled } from "../module-access";
import { NewEventForm } from "./new-event-form";

// L12-HUB-13 (lot 12) : depuis un clic sur une date de l'agenda, la date est pré-remplie.
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Lot 36a (UX-02) : « Créer un évènement » depuis la fiche d'un contact (?contact=…) le choisit
// d'emblée comme premier client.
// Lot 70e (D8, C-03) : une seule forme, « Nouvel évènement » ; les anciennes adresses (?type=evenement,
// ?type=client) ouvrent la même.
// Lot 74a (HUB-10, PAR-01 ; R3) : « Entrer un mariage en cours » (fin de l'assistant, mariages suivis sur papier)
// ouvre la fenêtre réglée sur « Signé, en préparation » (?ou=signe) ; sinon rien n'est choisi d'avance (M13).
export default async function NewEventPage({ searchParams }: { searchParams: Promise<{ date?: string; contact?: string; ou?: string }> }) {
  const query = await searchParams;
  const initialStanding = query.ou === "signe" ? "signed" : null;
  const initialDate = query.date && /^\d{4}-\d{2}-\d{2}$/.test(query.date) ? query.date : "";
  const auth = await requirePlanner();

  const t = await getTranslations("Events");
  const tHelp = await getTranslations("Help");
  if (!(await isEventsModuleEnabled(auth.user.organizationId))) {
    return (
      <main>
        <h1>{t("title")}</h1>
        <p>{t("moduleUnavailable")}</p>
      </main>
    );
  }
  const locale = (await getLocale()) as Locale;
  // Lot 16 (ADR 0045) : le type de l'événement, et les libellés des clients qui le suivent.
  const eventTypes = await ensureEventTypes(auth.user.organizationId, locale);
  const contact = query.contact && UUID.test(query.contact) ? await getContact(auth.user.organizationId, query.contact) : null;
  const initialContact = contact && !contact.isDemo && !contact.anonymized ? { id: contact.id, kind: contact.kind, displayName: contact.displayName, email: contact.email, city: contact.city } : null;

  return (
    <main>
      <h1>{t("newEvent")}</h1>
      <ScreenHelp title={tHelp("eventsNew.title")} body={tHelp("eventsNew.body")} />
      <NewEventForm
        eventTypes={eventTypes.map((type) => ({ id: type.id, label: type.label, audience: type.audience }))}
        clientLabels={clientFieldLabelsByAudience(locale)}
        initialContact={initialContact}
        initialDate={initialDate}
        initialStanding={initialStanding}
      />
    </main>
  );
}
