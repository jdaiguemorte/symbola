// Lot 60 (L60-PLA-03, L60-PLA-04) — réglages de l'espace d'un évènement (sa copie du lieu, ou un
// espace hors catalogue) : dimensions, fond de plan, installations. Le lieu n'est pas modifié.
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { PageHeader } from "@/app/ui/page-header";
import { ScreenHelp } from "@/app/screen-help";
import { requirePlanner } from "@/lib/guards";
import { isValidId } from "@/app/events/module-access";
import { getSpace } from "@/modules/floorplans/service";
import { floorplansAccess } from "@/app/plans-de-salle/access";
import { Feedback } from "@/app/plans-de-salle/feedback";
import { SpaceSettings } from "@/app/plans-de-salle/space-settings";

export default async function EventSpacePage({ params, searchParams }: { params: Promise<{ id: string; spaceId: string }>; searchParams: Promise<{ ok?: string; erreur?: string }> }) {
  await requirePlanner();
  const t = await getTranslations("Floorplans");
  const tHelp = await getTranslations("Help");
  const access = await floorplansAccess("events");
  if (!access) {
    return (
      <main>
        <PageHeader title={t("event.title")} />
        <p role="note">{t("unavailable")}</p>
      </main>
    );
  }
  const { id, spaceId } = await params;
  if (!isValidId(id) || !isValidId(spaceId)) notFound();
  const found = await getSpace(access.organizationId, spaceId);
  if (!found || found.space.eventId !== id) notFound();
  return (
    <main className="plans-page">
      <Link href={`/events/${id}/plan-de-salle`} className="back-link">
        <ArrowLeft aria-hidden="true" />
        {t("event.back")}
      </Link>
      <PageHeader title={found.space.name} subtitle={t("space.eventSubtitle")} />
      <ScreenHelp title={tHelp("floorplanSpace.title")} body={tHelp("floorplanSpace.body")} />
      <Feedback query={await searchParams} />
      <SpaceSettings organizationId={access.organizationId} spaceId={spaceId} />
    </main>
  );
}
