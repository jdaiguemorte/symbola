// Lot 71b (HUB-14, C-52, C-67 ; maquette 06, « Saisir les noms et la date ») — la ligne 2 de la reprise
// pour un mariage suivi dans un tableur : ses noms et sa date, rien de plus ; le reste viendra des
// fichiers. Ouverte depuis une reprise (`?reprise=`), elle la complète ; sinon la reprise naît à
// l'enregistrement. Une reprise d'une autre organisation : la page n'existe pas (SEC-13).
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import type { Locale } from "@symbola/i18n";
import { appDatabase } from "@symbola/db/client";
import { getTakeover } from "@/modules/hub/service";
import { ScreenHelp } from "@/app/screen-help";
import { ensureEventTypes } from "@/lib/events/event-types";
import { clientFieldLabelsByAudience } from "@/lib/vocabulary";
import { requireTakeoverActor, validId } from "../access";
import { TakeoverEventForm } from "./takeover-event-form";

export default async function TakeoverEventPage({ searchParams }: { searchParams: Promise<{ reprise?: string }> }) {
  const { actor, eventsEnabled } = await requireTakeoverActor();
  if (!eventsEnabled) notFound();
  const query = await searchParams;
  const takeoverId = query.reprise === undefined ? null : validId(query.reprise);
  if (query.reprise !== undefined && !takeoverId) notFound();
  if (takeoverId) {
    const takeover = await getTakeover(appDatabase(), actor.organizationId, takeoverId, actor.viewer);
    if (!takeover) notFound();
    // Le mariage est déjà là : la page de reprise.
    if (takeover.eventId) redirect(`/reprise/${takeover.id}`);
  }
  const t = await getTranslations("Takeover");
  const tHelp = await getTranslations("Help");
  const locale = (await getLocale()) as Locale;
  const eventTypes = await ensureEventTypes(actor.organizationId, locale);
  return (
    <main className="takeover-event-page">
      <p className="takeover-back">
        <Link href={takeoverId ? `/reprise/${takeoverId}` : "/reprise"}>‹ {t("formBack")}</Link>
      </p>
      <h1>{t("formTitle")}</h1>
      <ScreenHelp title={tHelp("takeover.title")} body={tHelp("takeover.body")} />
      <p className="meta">{t("formIntro")}</p>
      <TakeoverEventForm takeoverId={takeoverId} eventTypes={eventTypes.map(({ id, label, audience }) => ({ id, label, audience }))} clientLabels={clientFieldLabelsByAudience(locale)} />
    </main>
  );
}
