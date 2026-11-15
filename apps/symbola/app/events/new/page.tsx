import { getLocale, getTranslations } from "next-intl/server";
import type { Locale } from "@symbola/i18n";
import { ScreenHelp } from "@/app/screen-help";
import { listProspectSources } from "@/modules/events/service";
import { getContact } from "@/modules/hub/service";
import { requirePlanner } from "@/lib/guards";
import { ensureEventTypes } from "@/lib/events/event-types";
import { clientFieldLabelsByAudience } from "@/lib/vocabulary";
import { isEventsModuleEnabled } from "../module-access";
import Link from "next/link";
import { NewProspectForm } from "./new-prospect-form";
import { LoadStarterListsForm } from "../parametres/starter-lists-form";

// L12-HUB-13 (lot 12) : depuis un clic sur une date de l'agenda, la date est
// pré-remplie et « Créer un événement » crée directement un événement confirmé.
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Lot 36a (UX-02) : « Créer un évènement » depuis la fiche d'un contact (?contact=…) le choisit
// d'emblée comme premier client.
export default async function NewProspectPage({ searchParams }: { searchParams: Promise<{ date?: string; type?: string; contact?: string }> }) {
  const query = await searchParams;
  const initialDate = query.date && /^\d{4}-\d{2}-\d{2}$/.test(query.date) ? query.date : "";
  const confirmed = query.type === "evenement";
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
  const [sources, eventTypes] = await Promise.all([listProspectSources(auth.user.organizationId), ensureEventTypes(auth.user.organizationId, locale)]);
  const contact = query.contact && UUID.test(query.contact) ? await getContact(auth.user.organizationId, query.contact) : null;
  const initialContact = contact && !contact.isDemo && !contact.anonymized ? { id: contact.id, displayName: contact.displayName, email: contact.email, city: contact.city } : null;

  return (
    <main>
      <h1>{t(confirmed ? "newConfirmedEvent" : "newProspect")}</h1>
      <ScreenHelp title={tHelp("eventsNew.title")} body={tHelp("eventsNew.body")} />
      {/* PRD-EVT-07 : sans source, la création est impossible ; on dit pourquoi et comment y remédier. */}
      {sources.length === 0 ? (
        <section aria-labelledby="no-sources-title" className="card">
          <h2 id="no-sources-title">{t("noSourcesTitle")}</h2>
          <p>
            {t.rich("noSourcesYet", {
              link: (chunks) => <Link href="/events/parametres/sources">{chunks}</Link>,
            })}
          </p>
          <LoadStarterListsForm />
        </section>
      ) : null}
      <NewProspectForm sources={sources} eventTypes={eventTypes} clientLabels={clientFieldLabelsByAudience(locale)} initialDate={initialDate} confirmed={confirmed} initialContact={initialContact} />
    </main>
  );
}
