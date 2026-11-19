// Lot 52 (EVT-06 ; D2, D3 ; ADR 0094) — l'équipe de l'évènement : un planner principal (il reçoit les
// alertes et récapitulatifs), des assistants (tout l'évènement, sauf sa suppression), et les renforts
// du jour J, par lien personnel sans compte, valable de la veille au lendemain, qui n'ouvre que le mode
// Jour J de cet évènement.
import Link from "next/link";
import { notFound } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { listTeam } from "@symbola/auth";
import { appDatabase } from "@symbola/db/client";
import { formatCalendarDate, formatDateTime, type Locale } from "@symbola/i18n";
import { ScreenHelp } from "@/app/screen-help";
import { PageHeader } from "@/app/ui/page-header";
import { requirePlanner } from "@/lib/guards";
import { canViewEvent, eventNames, getEvent, listDayHelpers, listEventTeam } from "@/modules/events/service";
import { getEventVisibility } from "@/modules/hub/service";
import { isEventsModuleEnabled, isValidId } from "../../module-access";
import { removeTeamMemberAction, revokeDayHelperAction, setTeamMemberAction } from "./actions";
import { DayHelperForm } from "./helper-form";

const OUTCOMES = ["saved", "removed", "helper_revoked", "invalid"] as const;

export default async function EventTeamPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ resultat?: string }> }) {
  const auth = await requirePlanner();
  const organizationId = auth.user.organizationId;
  const { id } = await params;
  if (!isValidId(id) || !(await isEventsModuleEnabled(organizationId))) notFound();
  const { allPlannersSeeAll } = await getEventVisibility(appDatabase(), organizationId);
  if (!(await canViewEvent(organizationId, { userId: auth.user.id, role: auth.user.role as "owner" | "member", allPlannersSeeAll }, id))) notFound();
  const event = await getEvent(organizationId, id);
  if (!event) notFound();
  const t = await getTranslations("EventTeam");
  const tHelp = await getTranslations("Help");
  const locale = (await getLocale()) as Locale;
  const query = await searchParams;
  const [team, members, helpers] = await Promise.all([listEventTeam(organizationId, id), listTeam(appDatabase(), organizationId), listDayHelpers(organizationId, id)]);
  const planners = members.filter((member) => (member.role === "owner" || member.role === "member") && !member.disabledAt);
  const emailOf = new Map(members.map((member) => [member.id, member.email]));
  const roleOf = new Map(team.map((entry) => [entry.userId, entry.role]));
  const outcome = OUTCOMES.find((candidate) => candidate === query.resultat);
  const title = eventNames(event.clients) || t("untitled");
  return (
    <main>
      <p>
        <Link href={`/events/${id}`}>{t("back", { event: title })}</Link>
      </p>
      <PageHeader title={t("title")} subtitle={t("subtitle")} />
      <ScreenHelp title={tHelp("eventTeam.title")} body={tHelp("eventTeam.body")} />
      {outcome ? <p role={outcome === "invalid" ? "alert" : "status"}>{t(`outcome.${outcome}`)}</p> : null}

      <section className="card" aria-labelledby="team-members-title">
        <h2 id="team-members-title">{t("membersTitle")}</h2>
        <ul className="session-list">
          {planners.map((member) => {
            const role = roleOf.get(member.id) ?? null;
            return (
              <li key={member.id} className="session-row">
                <div>
                  <p className="session-device">{member.email}</p>
                  <p className="muted">{role ? t(`roles.${role}`) : t("notInTeam")}</p>
                </div>
                <div className="row-wrap">
                  {role !== "lead" ? (
                    <form action={setTeamMemberAction}>
                      <input type="hidden" name="eventId" value={id} />
                      <input type="hidden" name="userId" value={member.id} />
                      <input type="hidden" name="role" value="lead" />
                      <button type="submit" className="button-ghost" aria-label={t("makeLeadLabel", { email: member.email })}>
                        {t("makeLead")}
                      </button>
                    </form>
                  ) : null}
                  {role === null ? (
                    <form action={setTeamMemberAction}>
                      <input type="hidden" name="eventId" value={id} />
                      <input type="hidden" name="userId" value={member.id} />
                      <input type="hidden" name="role" value="assistant" />
                      <button type="submit" className="button-ghost" aria-label={t("addAssistantLabel", { email: member.email })}>
                        {t("addAssistant")}
                      </button>
                    </form>
                  ) : (
                    <form action={removeTeamMemberAction}>
                      <input type="hidden" name="eventId" value={id} />
                      <input type="hidden" name="userId" value={member.id} />
                      <button type="submit" className="button-link" aria-label={t("removeLabel", { email: member.email })}>
                        {t("remove")}
                      </button>
                    </form>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
        {team.some((entry) => !emailOf.has(entry.userId)) ? <p className="muted">{t("formerMembers")}</p> : null}
      </section>

      <section className="card" aria-labelledby="helpers-title">
        <h2 id="helpers-title">{t("helpersTitle")}</h2>
        <p>{t("helpersIntro")}</p>
        {helpers.length === 0 ? (
          <p className="muted">{t("noHelper")}</p>
        ) : (
          <ul className="session-list">
            {helpers.map((helper) => (
              <li key={helper.linkId} className="session-row">
                <div>
                  <p className="session-device">{helper.personName}</p>
                  <p className="muted">{[helper.phone, helper.email].filter(Boolean).join(" · ")}</p>
                  <p className="muted">
                    {helper.status === "active"
                      ? t("helperValid", { from: helper.validFrom ? formatDateTime(new Date(helper.validFrom), locale) : "—", until: formatCalendarDate(helper.expiresOn, locale) })
                      : t(`helperStatus.${helper.status}`)}
                  </p>
                </div>
                {helper.status === "active" ? (
                  <form action={revokeDayHelperAction}>
                    <input type="hidden" name="eventId" value={id} />
                    <input type="hidden" name="linkId" value={helper.linkId} />
                    <button type="submit" className="button-ghost" aria-label={t("helperRevokeLabel", { name: helper.personName })}>
                      {t("helperRevoke")}
                    </button>
                  </form>
                ) : null}
              </li>
            ))}
          </ul>
        )}
        {event.eventDate ? <DayHelperForm eventId={id} /> : <p>{t("helperNeedsDate")}</p>}
      </section>
    </main>
  );
}
