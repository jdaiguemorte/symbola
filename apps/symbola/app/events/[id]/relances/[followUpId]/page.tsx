// Lot 45 (CRM-06 ; D2, D3 ; ADR 0090) — une relance prête, à relire : « Relancer Léa M. : prête, à
// relire ». La planner l'envoie d'un geste après l'avoir relue, ou la retire ; une relance arrêtée (le
// prospect a répondu, la carte a changé d'étape…) le dit et ne part pas.
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { PageHeader } from "@/app/ui/page-header";
import { ScreenHelp } from "@/app/screen-help";
import { requirePlanner } from "@/lib/guards";
import { eventNames, getEvent, getProspectFollowUp } from "@/modules/events/service";
import { preparesRelationEmail } from "@/modules/hub/service";
import { isEventsModuleEnabled, isValidId } from "../../../module-access";
import { FollowUpForm } from "./follow-up-form";

export default async function FollowUpReviewPage({ params }: { params: Promise<{ id: string; followUpId: string }> }) {
  const auth = await requirePlanner();
  const organizationId = auth.user.organizationId;
  const { id, followUpId } = await params;
  if (!isValidId(id) || !isValidId(followUpId) || !(await isEventsModuleEnabled(organizationId))) notFound();
  const [event, followUp] = await Promise.all([getEvent(organizationId, id), getProspectFollowUp(organizationId, followUpId)]);
  if (!event || !followUp || followUp.eventId !== event.id) notFound();
  const t = await getTranslations("FollowUpReview");
  const tHelp = await getTranslations("Help");
  return (
    <main>
      <Link href={`/events/${event.id}`} className="back-link">
        <ArrowLeft aria-hidden="true" />
        {t("back")}
      </Link>
      <PageHeader title={t("title", { rank: followUp.rank })} subtitle={eventNames(event.clients, event.name)} />
      <ScreenHelp title={tHelp("followUpReview.title")} body={tHelp("followUpReview.body")} />
      {followUp.sentAt ? (
        <p role="status">{t("alreadySent")}</p>
      ) : followUp.stopReason ? (
        <p role="status">{t(`stopped.${followUp.stopReason}`)}</p>
      ) : (
        <FollowUpForm eventId={event.id} followUpId={followUp.id} subject={followUp.subject} body={followUp.body} plannerSends={await preparesRelationEmail(organizationId, "prospect_follow_up")} />
      )}
    </main>
  );
}
