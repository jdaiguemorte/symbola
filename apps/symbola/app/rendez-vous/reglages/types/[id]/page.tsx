import Link from "next/link";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { listTeam } from "@symbola/auth";
import { appDatabase } from "@symbola/db/client";
import { APPOINTMENT_LOCATION_KINDS, APPOINTMENT_REMINDER_PLANS, APPOINTMENT_QUESTIONS_MAX } from "@symbola/contracts";
import { ScreenHelp } from "@/app/screen-help";
import { PageHeader } from "@/app/ui/page-header";
import { getAppointmentType } from "@/modules/appointments/service";
import { appointmentsPlanner } from "../../../access";
import { Notice } from "../../../notice";
import { updateAppointmentTypeAction } from "../../../actions";

// Lot 46 (RDV-01 ; D6, D10) — réglages d'un type : lieu, marges, prévenance, horizon, rappels,
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
  const questions = Array.from({ length: APPOINTMENT_QUESTIONS_MAX }, (_, index) => type.questions[index] ?? null);

  return (
    <main>
      <PageHeader title={type.name} subtitle={t("typeEditSubtitle")} actions={<Link href="/rendez-vous/reglages#types">{t("backToSettings")}</Link>} />
      <ScreenHelp title={tHelp("appointmentType.title")} body={tHelp("appointmentType.body")} />
      <Notice ok={query.ok} error={query.erreur} />
      <form action={updateAppointmentTypeAction} className="stack card">
        <input type="hidden" name="id" value={type.id} />
        <label>
          {t("typeName")}
          <input type="text" name="name" defaultValue={type.name} required maxLength={120} />
        </label>
        <label>
          {t("typeDurationMinutes")}
          <input type="number" name="durationMinutes" defaultValue={type.durationMinutes} min={15} max={480} step={5} required />
        </label>
        <fieldset>
          <legend>{t("typeLocation")}</legend>
          {APPOINTMENT_LOCATION_KINDS.map((kind) => (
            <label key={kind}>
              <input type="radio" name="locationKind" value={kind} defaultChecked={type.locationKind === kind} />
              {t(`locationKind.${kind}`)}
            </label>
          ))}
          <label>
            {t("typeLocationDetail")}
            <input type="text" name="location" defaultValue={type.location ?? ""} maxLength={500} aria-describedby="location-hint" />
          </label>
          <p id="location-hint" className="meta">
            {t("typeLocationHint")}
          </p>
        </fieldset>
        <div className="row-wrap">
          <label>
            {t("bufferBefore")}
            <input type="number" name="bufferBeforeMinutes" defaultValue={type.bufferBeforeMinutes} min={0} max={240} step={5} />
          </label>
          <label>
            {t("bufferAfter")}
            <input type="number" name="bufferAfterMinutes" defaultValue={type.bufferAfterMinutes} min={0} max={240} step={5} />
          </label>
          <label>
            {t("minNoticeHours")}
            <input type="number" name="minNoticeHours" defaultValue={Math.round(type.minNoticeMinutes / 60)} min={0} max={720} />
          </label>
          <label>
            {t("horizonDays")}
            <input type="number" name="horizonDays" defaultValue={type.horizonDays} min={1} max={365} />
          </label>
        </div>
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
        <label className="checkbox">
          <input type="checkbox" name="allowEventDays" defaultChecked={type.allowEventDays} />
          {t("allowEventDays")}
        </label>
        <label className="checkbox">
          <input type="checkbox" name="active" defaultChecked={type.active} />
          {t("typeActive")}
        </label>
        <fieldset>
          <legend>{t("questionsTitle")}</legend>
          <p className="meta">{t("questionsHint")}</p>
          {questions.map((question, index) => (
            <div key={index} className="question-row">
              <input type="hidden" name={`question${index}Id`} value={question?.id ?? ""} />
              <label>
                {t("questionLabel", { number: index + 1 })}
                <input type="text" name={`question${index}Label`} defaultValue={question?.label ?? ""} maxLength={200} />
              </label>
              <label>
                {t("questionKind")}
                <select name={`question${index}Kind`} defaultValue={question?.kind ?? "text"}>
                  <option value="text">{t("questionKindText")}</option>
                  <option value="choice">{t("questionKindChoice")}</option>
                </select>
              </label>
              <label>
                {t("questionChoices")}
                <textarea name={`question${index}Choices`} rows={3} defaultValue={question?.choices.join("\n") ?? ""} />
              </label>
            </div>
          ))}
        </fieldset>
        <button type="submit" className="primary">
          {t("typeSave")}
        </button>
      </form>
    </main>
  );
}
