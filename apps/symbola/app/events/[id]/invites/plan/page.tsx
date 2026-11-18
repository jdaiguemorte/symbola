// Lot 50 (INV-05, INV-06 ; D1 à D9 ; ARC-07) — « Plan de table » d'un évènement : un plan par temps
// fort à table, ses tables et ses non placés (toujours visibles), les alertes (contraintes non tenues,
// capacité dépassée, désistements), les contraintes de placement (internes), les repas des
// prestataires et la synthèse pour le traiteur en un clic (PDF ou tableur, version permise). Sans le
// module Invités, la page répond « indisponible », jamais une erreur. Le client n'y a pas accès (D9).
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { getLocale, getTranslations } from "next-intl/server";
import { formatCalendarDate, type Locale } from "@symbola/i18n";
import { starterSeatingRules } from "@symbola/starter-templates";
import type { SeatingAlert, SeatingPlanView } from "@symbola/contracts";
import { PageHeader } from "@/app/ui/page-header";
import { ScreenHelp } from "@/app/screen-help";
import { requirePlanner } from "@/lib/guards";
import { eventNames, getEvent } from "@/modules/events/service";
import { getGuestModuleState, getSeatingPlan, listMealTypes, listSeatingMoments } from "@/modules/guests/service";
import { isValidId } from "../../../module-access";
import { guestsAccess } from "../access";
import { createPlanAction, dismissReleaseAction, removeConstraintAction, unseatAction } from "./actions";
import { AddTablesForm, ConstraintForm, CopyPlanForm, VendorMealsForm } from "./plan-forms";
import { SeatingBoard, type BoardGuest, type BoardTable } from "./seating-board";

type Query = { temps?: string };

export default async function SeatingPlanPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<Query> }) {
  await requirePlanner();
  const { id } = await params;
  const t = await getTranslations("Guests.plan");
  const tHelp = await getTranslations("Help");
  const access = await guestsAccess();
  if (!access) {
    return (
      <main>
        <PageHeader title={t("title")} />
        <ScreenHelp title={tHelp("seatingPlan.title")} body={`${tHelp("seatingPlan.body")} ${tHelp("catererSummary.body")}`} />
        <p role="note">{t("unavailable")}</p>
      </main>
    );
  }
  if (!isValidId(id)) notFound();
  const event = await getEvent(access.organizationId, id);
  if (!event || event.isDemo) notFound();
  const locale: Locale = (await getLocale()) === "en" ? "en" : "fr";
  const back = (
    <Link href={`/events/${id}?onglet=invites`} className="back-link">
      <ArrowLeft aria-hidden="true" />
      {t("back")}
    </Link>
  );

  if (!(await getGuestModuleState(access.organizationId)).impactAssessmentConfirmedAt) {
    return (
      <main>
        {back}
        <PageHeader title={t("title")} subtitle={eventNames(event.clients)} />
        <ScreenHelp title={tHelp("seatingPlan.title")} body={`${tHelp("seatingPlan.body")} ${tHelp("catererSummary.body")}`} />
        <p role="note">
          {t("notReady")} <Link href={`/events/${id}?onglet=invites`}>{t("notReadyLink")}</Link>
        </p>
      </main>
    );
  }

  const moments = await listSeatingMoments(access.organizationId, id);
  if (moments.length === 0) {
    return (
      <main>
        {back}
        <PageHeader title={t("title")} subtitle={eventNames(event.clients)} />
        <ScreenHelp title={tHelp("seatingPlan.title")} body={`${tHelp("seatingPlan.body")} ${tHelp("catererSummary.body")}`} />
        <p role="note">
          {t("noKeyMoments")} <Link href={`/events/${id}`}>{t("noKeyMomentsLink")}</Link>
        </p>
      </main>
    );
  }

  const query = await searchParams;
  const current = moments.find((moment) => moment.id === query.temps) ?? moments.find((moment) => moment.planId !== null) ?? moments[0]!;
  const [plan, mealTypes] = await Promise.all([getSeatingPlan(access.organizationId, id, current.id, access.viewer, locale), listMealTypes(access.organizationId, locale)]);
  const rules = starterSeatingRules();
  const momentLabel = (moment: { name: string; date: string }) => t("momentLink", { name: moment.name, date: formatCalendarDate(moment.date, locale) });
  const tableName = new Map(plan.tables.map((table) => [table.id, table.name]));

  return (
    <main className="stack">
      {back}
      <PageHeader title={t("title")} subtitle={eventNames(event.clients)} />
      <ScreenHelp title={tHelp("seatingPlan.title")} body={`${tHelp("seatingPlan.body")} ${tHelp("catererSummary.body")}`} />

      <nav aria-label={t("momentsNav")} className="row-wrap">
        {moments.map((moment) => (
          <Link key={moment.id} href={`/events/${id}/invites/plan?temps=${moment.id}`} aria-current={moment.id === current.id ? "page" : undefined}>
            {momentLabel(moment)} ({moment.planId ? t("momentPlanned", { placed: moment.placed, present: moment.present }) : t("momentNoPlan")})
          </Link>
        ))}
      </nav>

      {plan.planId === null ? (
        <section aria-labelledby="plan-create" className="stack">
          <h2 id="plan-create">{momentLabel(current)}</h2>
          <p>{t("noPlan", { present: current.present, pending: current.pending })}</p>
          <form action={createPlanAction}>
            <input type="hidden" name="eventId" value={id} />
            <input type="hidden" name="keyMomentId" value={current.id} />
            <button type="submit">{t("createPlan", { moment: current.name })}</button>
          </form>
        </section>
      ) : (
        <PlanBody
          eventId={id}
          plan={plan}
          planId={plan.planId}
          mealTypes={mealTypes.filter((type) => !type.hidden).map((type) => ({ id: type.id, label: type.label }))}
          copySources={moments.filter((moment) => moment.id !== current.id && moment.planId !== null).map((moment) => ({ id: moment.id, label: momentLabel(moment) }))}
          tableName={tableName}
          rules={rules}
        />
      )}

      <CatererSection eventId={id} keyMomentId={current.id} owner={access.owner} vendorMeals={plan.vendorMeals} />
      <p>
        <Link href="/events/parametres/repas">{t("mealTypesLink")}</Link>
      </p>
    </main>
  );
}

function alertText(t: Awaited<ReturnType<typeof getTranslations>>, alert: SeatingAlert, tableName: Map<string, string>): string {
  switch (alert.kind) {
    case "together":
      return t("alertTogether", { names: alert.guestNames.join(", "), tables: alert.tableIds.map((id) => tableName.get(id) ?? "").join(", ") });
    case "apart":
      return t("alertApart", { names: alert.guestNames.join(", "), table: tableName.get(alert.tableId) ?? "" });
    case "capacity":
      return t("alertCapacity", { table: tableName.get(alert.tableId) ?? "", occupied: alert.occupied, capacity: alert.capacity });
    case "released":
      return alert.tableName ? t("alertReleased", { name: alert.guestName, table: alert.tableName }) : t("alertReleasedNoTable", { name: alert.guestName });
    case "notInvited":
      return t("alertNotInvited", { name: alert.guestName, table: tableName.get(alert.tableId) ?? "" });
  }
}

async function PlanBody({
  eventId,
  plan,
  planId,
  mealTypes,
  copySources,
  tableName,
  rules,
}: {
  eventId: string;
  plan: SeatingPlanView;
  planId: string;
  mealTypes: { id: string; label: string }[];
  copySources: { id: string; label: string }[];
  tableName: Map<string, string>;
  rules: ReturnType<typeof starterSeatingRules>;
}) {
  const t = await getTranslations("Guests.plan");
  const tableAlerts = new Map<string, string[]>();
  for (const alert of plan.alerts) {
    const ids = alert.kind === "together" ? alert.tableIds : alert.kind === "apart" ? [alert.tableId] : [];
    for (const tableId of ids) tableAlerts.set(tableId, [...(tableAlerts.get(tableId) ?? []), t("constraintAlert")]);
  }
  const guests: BoardGuest[] = plan.guests.map((guest) => ({
    id: guest.id,
    label: guest.name,
    householdId: guest.householdId,
    householdName: guest.householdName,
    status: guest.status,
    tableId: guest.tableId,
    child: guest.kind === "child",
    mealTypeId: guest.mealTypeId,
    mealLabel: guest.mealTypeLabel,
    mealChosen: guest.mealTypeChosen,
  }));
  const tables: BoardTable[] = plan.tables.map((table) => ({
    id: table.id,
    name: table.name,
    shape: table.shape,
    capacity: table.capacity,
    children: table.children,
    diets: table.diets.length > 0 ? table.diets.map((count) => (count.count !== null ? t("dietCount", { label: count.label, count: count.count }) : t("dietFewer", { label: count.label, threshold: count.fewerThan ?? 3 }))).join(", ") : null,
    alerts: [...new Set(tableAlerts.get(table.id) ?? [])],
  }));

  return (
    <>
      {plan.alerts.length > 0 ? (
        <section aria-labelledby="plan-alerts" className="seating-alerts stack">
          <h2 id="plan-alerts">{t("alertsTitle", { count: plan.alerts.length })}</h2>
          <ul className="plain-list stack">
            {plan.alerts.map((alert, index) => (
              <li key={index} className="row-wrap">
                <span>{alertText(t, alert, tableName)}</span>
                {alert.kind === "released" ? (
                  <form action={dismissReleaseAction}>
                    <input type="hidden" name="eventId" value={eventId} />
                    <input type="hidden" name="planId" value={planId} />
                    <input type="hidden" name="guestId" value={alert.guestId} />
                    <button type="submit">{t("alertReleasedDismiss", { name: alert.guestName })}</button>
                  </form>
                ) : null}
                {alert.kind === "notInvited" ? (
                  <form action={unseatAction}>
                    <input type="hidden" name="eventId" value={eventId} />
                    <input type="hidden" name="planId" value={planId} />
                    <input type="hidden" name="guestId" value={alert.guestId} />
                    <button type="submit">{t("alertNotInvitedRemove", { name: alert.guestName })}</button>
                  </form>
                ) : null}
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <SeatingBoard eventId={eventId} planId={planId} guests={guests} tables={tables} mealTypes={mealTypes} maxCapacity={rules.maxCapacity} />

      <details>
        <summary>{t("addTablesTitle")}</summary>
        <AddTablesForm eventId={eventId} planId={planId} defaults={rules.defaultCapacity} maxCount={rules.maxTablesPerSeries} maxCapacity={rules.maxCapacity} />
      </details>
      {copySources.length > 0 && plan.tables.length === 0 ? (
        <details>
          <summary>{t("copyTitle")}</summary>
          <p className="muted">{t("copyHelp")}</p>
          <CopyPlanForm eventId={eventId} toKeyMomentId={plan.keyMoment.id} sources={copySources} />
        </details>
      ) : null}

      <section aria-labelledby="plan-constraints" className="stack">
        <h2 id="plan-constraints">{t("constraintsTitle")}</h2>
        <p className="muted">{t("constraintsHelp")}</p>
        {plan.constraints.length === 0 ? <p>{t("constraintsNone")}</p> : null}
        <ul className="plain-list stack">
          {plan.constraints.map((constraint) => {
            const names = constraint.members.map((member) => member.name).join(", ");
            const kind = t(`constraintKind.${constraint.kind}`);
            return (
              <li key={constraint.id} className="row-wrap">
                <span>{t("constraintLine", { kind, names })}</span>
                <form action={removeConstraintAction}>
                  <input type="hidden" name="eventId" value={eventId} />
                  <input type="hidden" name="constraintId" value={constraint.id} />
                  <button type="submit">{t("removeConstraint", { kind, names })}</button>
                </form>
              </li>
            );
          })}
        </ul>
        <details>
          <summary>{t("addConstraint")}</summary>
          <ConstraintForm eventId={eventId} planId={planId} guests={plan.guests.map((guest) => ({ id: guest.id, label: guest.name }))} />
        </details>
      </section>
    </>
  );
}

// PAR-07 : la synthèse sort en un clic, dans la version permise (D6) ; rien n'est rangé (D8).
async function CatererSection({ eventId, keyMomentId, owner, vendorMeals }: { eventId: string; keyMomentId: string; owner: boolean; vendorMeals: number }) {
  const t = await getTranslations("Guests.plan");
  const href = (format: "pdf" | "csv", version: "nominative" | "aggregate") => `/events/${eventId}/invites/plan/synthese?temps=${keyMomentId}&format=${format}&version=${version}`;
  return (
    <section aria-labelledby="plan-caterer" className="card stack">
      <h2 id="plan-caterer">{t("catererTitle")}</h2>
      <p>{t("catererHelp")}</p>
      <ul className="seating-downloads">
        {owner ? (
          <>
            <li>
              <a href={href("pdf", "nominative")} className="button-link">
                {t("catererNominativePdf")}
              </a>
            </li>
            <li>
              <a href={href("csv", "nominative")} className="button-link">
                {t("catererNominativeCsv")}
              </a>
            </li>
          </>
        ) : null}
        <li>
          <a href={href("pdf", "aggregate")} className="button-link">
            {t("catererAggregatePdf")}
          </a>
        </li>
        <li>
          <a href={href("csv", "aggregate")} className="button-link">
            {t("catererAggregateCsv")}
          </a>
        </li>
      </ul>
      {owner ? null : <p className="muted">{t("catererMember")}</p>}
      <p role="note">{t("catererOutside")}</p>
      <section aria-labelledby="plan-vendors" className="stack">
        <h3 id="plan-vendors">{t("vendorTitle")}</h3>
        <p className="muted">{t("vendorHelp")}</p>
        <VendorMealsForm eventId={eventId} keyMomentId={keyMomentId} count={vendorMeals} />
      </section>
    </section>
  );
}
