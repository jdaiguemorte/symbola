// Lot 52 (EVT-06 ; D2, D3 ; ADR 0094) — sur la synthèse de l'évènement : son planner principal, ses
// assistants et ses renforts du jour J, avec le lien vers l'écran de l'équipe.
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { listTeam } from "@symbola/auth";
import { appDatabase } from "@symbola/db/client";
import { listDayHelpers, listEventTeam } from "@/modules/events/service";

export async function EventTeamCard({ organizationId, eventId }: { organizationId: string; eventId: string }) {
  const t = await getTranslations("EventTeam");
  const [team, members, helpers] = await Promise.all([listEventTeam(organizationId, eventId), listTeam(appDatabase(), organizationId), listDayHelpers(organizationId, eventId)]);
  const emailOf = new Map(members.map((member) => [member.id, member.email]));
  const lead = team.find((entry) => entry.role === "lead");
  const assistants = team.filter((entry) => entry.role === "assistant");
  const activeHelpers = helpers.filter((helper) => helper.status === "active");
  return (
    <section className="card" aria-labelledby="event-team-title">
      <div className="section-head">
        <h2 id="event-team-title">{t("title")}</h2>
        <Link className="button-link" href={`/events/${eventId}/equipe`}>
          {t("manage")}
        </Link>
      </div>
      <dl className="facts">
        <dt>{t("lead")}</dt>
        <dd>{lead ? (emailOf.get(lead.userId) ?? "—") : t("noLead")}</dd>
        <dt>{t("assistants")}</dt>
        <dd>{assistants.length === 0 ? t("noAssistant") : assistants.map((entry) => emailOf.get(entry.userId) ?? "—").join(", ")}</dd>
        <dt>{t("helpers")}</dt>
        <dd>{activeHelpers.length === 0 ? t("noHelper") : activeHelpers.map((helper) => helper.personName).join(", ")}</dd>
      </dl>
    </section>
  );
}
