import Link from "next/link";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { listTeam } from "@symbola/auth";
import { appDatabase } from "@symbola/db/client";
import { APPOINTMENT_DESCRIPTION_MAX, APPOINTMENT_LOCATION_KINDS, APPOINTMENT_REMINDER_PLANS } from "@symbola/contracts";
import { ScreenHelp } from "@/app/screen-help";
import { PageHeader } from "@/app/ui/page-header";
import { getAppointmentType } from "@/modules/appointments/service";
import { appointmentsPlanner } from "../../../access";
import { Notice } from "../../../notice";
import { updateAppointmentTypeAction } from "../../../actions";
import { QuestionsEditor } from "./questions-editor";

// Lot 46 (RDV-01 ; D6, D10), revu au lot 64 (maquette M7 ; D7, D8) — réglages d'un type : lieu, marges, prévenance, horizon, rappels,
// questions préalables (zéro à cinq ; une réponse libre porte la mise en garde de RGP-04), personne
// qui reçoit, jours d'évènement, actif.
export default async function AppointmentTypePage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ ok?: string; erreur?: string }> }) {
  const auth = await appointmentsPlanner();
  const t = await getTranslations("Appointments");
  const tHelp = await getTranslations("Help");
  if (!auth) {
    return (
      <main>
        <h1>{t("settingsTitle")}</h1>
        <p>{t("moduleUnavailable")}</p>
      </main>
    );
  }
  const { id } = await params;
  const type = await getAppointmentType(auth.user.organizationId, id);
  if (!type) notFound();
  const query = await searchParams;
  const team = (await listTeam(appDatabase(), auth.user.organizationId)).filter((member) => !member.disabledAt);

  return (
    <main>
      <PageHeader title={type.name} subtitle={t("typeEditSubtitle")} actions={<Link href="/rendez-vous/reglages#types">{t("backToSettings")}</Link>} />
      <ScreenHelp title={tHelp("appointmentType.title")} body={tHelp("appointmentType.body")} />
      <Notice ok={query.ok} error={query.erreur} />
      {/* Lot 64 (maquette M7) : formulaire en grille (lot 62), en trois cartes ; questions en liste
          éditable, une ligne par question posée. */}
      <form action={updateAppointmentTypeAction} className="type-form">
        <input type="hidden" name="id" value={type.id} />
        <section className="card" aria-labelledby="type-section-meeting">
          <h2 id="type-section-meeting">{t("typeSectionMeeting")}</h2>
          <div className="type-grid type-grid-meeting">
            <label>
              {t("typeName")}
              <input type="text" name="name" defaultValue={type.name} required maxLength={120} />
            </label>
            <label>
              {t("typeDurationMinutes")}
              <input type="number" name="durationMinutes" defaultValue={type.durationMinutes} min={15} max={480} step={5} required className="field-short" />
            </label>
            <label>
              {t("host")}
              <select name="hostUserId" defaultValue={type.hostUserId}>
                {team.map((member) => (
                  <option key={member.id} value={member.id}>
                    {member.email}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <div className="type-location" role="group" aria-labelledby="type-location-title">
            <span id="type-location-title" className="text-label font-medium">
              {t("typeLocation")}
            </span>
            <div className="segmented-radio">
              {APPOINTMENT_LOCATION_KINDS.map((kind) => (
                <label key={kind}>
                  <input type="radio" name="locationKind" value={kind} defaultChecked={type.locationKind === kind} />
                  {t(`locationKind.${kind}`)}
                </label>
              ))}
            </div>
            <label className="type-location-detail">
              <span className="sr-only">{t("typeLocationDetail")}</span>
              <input type="text" name="location" defaultValue={type.location ?? ""} maxLength={500} aria-describedby="location-hint" placeholder={t("typeLocationDetail")} />
            </label>
            <p id="location-hint" className="field-hint">
              {t("typeLocationHint")}
            </p>
          </div>
          <label className="type-description">
            {t("typeDescription")}
            <textarea name="description" rows={2} maxLength={APPOINTMENT_DESCRIPTION_MAX} defaultValue={type.description ?? ""} aria-describedby="description-hint" />
          </label>
          <p id="description-hint" className="field-hint">
            {t("typeDescriptionHint")}
          </p>
        </section>
        <section className="card" aria-labelledby="type-section-when">
          <h2 id="type-section-when">{t("typeSectionWhen")}</h2>
          <div className="type-grid type-grid-when">
            <label>
              {t("bufferBefore")}
              <input type="number" name="bufferBeforeMinutes" defaultValue={type.bufferBeforeMinutes} min={0} max={240} step={5} className="field-short" />
            </label>
            <label>
              {t("bufferAfter")}
              <input type="number" name="bufferAfterMinutes" defaultValue={type.bufferAfterMinutes} min={0} max={240} step={5} className="field-short" />
            </label>
            <label>
              {t("minNoticeHours")}
              <input type="number" name="minNoticeHours" defaultValue={Math.round(type.minNoticeMinutes / 60)} min={0} max={720} className="field-short" />
            </label>
            <label>
              {t("horizonDays")}
              <input type="number" name="horizonDays" defaultValue={type.horizonDays} min={1} max={365} className="field-short" />
            </label>
          </div>
          <ul className="type-switches">
            <li>
              <label className="checkbox">
                <input type="checkbox" name="allowEventDays" defaultChecked={type.allowEventDays} />
                <span>
                  <strong>{t("allowEventDays")}</strong>
                  <span className="field-hint">
                    {t.rich("allowEventDaysHint", { link: (chunks) => <Link href="/events/parametres/plages-occupees">{chunks}</Link> })}
                  </span>
                </span>
              </label>
            </li>
            <li>
              <label className="checkbox">
                <input type="checkbox" name="active" defaultChecked={type.active} />
                <strong>{t("typeActive")}</strong>
              </label>
            </li>
            <li className="type-reminders">
              <label>
                {t("reminders")}
                <select name="reminders" defaultValue={type.reminders}>
                  {APPOINTMENT_REMINDER_PLANS.map((plan) => (
                    <option key={plan} value={plan}>
                      {t(`reminderPlan.${plan}`)}
                    </option>
                  ))}
                </select>
              </label>
            </li>
          </ul>
        </section>
        <section className="card" aria-labelledby="type-section-questions">
          <h2 id="type-section-questions">{t("questionsTitle")}</h2>
          <p className="field-hint">{t("questionsHint")}</p>
          <QuestionsEditor questions={type.questions} />
        </section>
        <div className="type-form-foot">
          <button type="submit">{t("typeSave")}</button>
        </div>
      </form>
    </main>
  );
}
