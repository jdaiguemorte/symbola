// Lot 12 (ONB-03) — assistant de démarrage : six étapes déjà remplies selon
// le métier, à relire et ajuster. Tant qu'il n'est pas terminé, les menus
// métier sont verrouillés (app-shell). Réservé à la titulaire ; un membre de
// l'équipe voit qu'elle doit le terminer.
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { appDatabase } from "@symbola/db/client";
import { listDefaultVendorSlots, listLossReasons, listProgramTemplates, listProspectSources, listTaskTemplates } from "@/modules/events/service";
import { listAllocationModels } from "@/modules/budget/service";
import { getOrganizationProfile, getSetupState, SETUP_STEPS } from "@/modules/hub/service";
import { requirePlanner } from "@/lib/guards";
import { BudgetLineIcon } from "@/app/budget-line-icon";
import { finishSetupAction, nextStepAction, removeBudgetLineAction } from "./actions";
import { ActivityForm, AddBudgetLineForm, AddLossReasonForm, AddSourceForm, BudgetLineForm, CompanyForm, VatForm } from "./setup-forms";

export default async function SetupPage({ searchParams }: { searchParams: Promise<{ etape?: string }> }) {
  const auth = await requirePlanner();
  const organizationId = auth.user.organizationId;
  const t = await getTranslations("Setup");

  const db = appDatabase();
  const state = await getSetupState(db, organizationId);
  const profile = await getOrganizationProfile(db, organizationId);

  if (auth.user.role !== "owner") {
    return (
      <main>
        <h1>{t("title")}</h1>
        <p>{state.completed ? t("doneForMember") : t("ownerMustFinish")}</p>
      </main>
    );
  }

  // On peut revenir sur une étape déjà faite, jamais sauter en avant.
  const asked = Number((await searchParams).etape);
  const step = Number.isInteger(asked) && asked >= 1 && asked <= state.step ? asked : state.step;
  const labels = Array.from({ length: SETUP_STEPS }, (_, index) => t(`steps.${index + 1}`));

  return (
    <main className="setup">
      <h1>{state.completed ? t("titleDone") : t("title")}</h1>
      <p className="muted">{t("intro")}</p>
      <nav aria-label={t("progressLabel")} className="setup-steps">
        <ol>
          {labels.map((label, index) => {
            const number = index + 1;
            const done = number < state.step || state.completed;
            const current = number === step;
            return (
              <li key={number} aria-current={current ? "step" : undefined} className={current ? "current" : done ? "done" : ""}>
                {number <= state.step ? <Link href={`/demarrage?etape=${number}`}>{t("stepItem", { number, label })}</Link> : <span>{t("stepItem", { number, label })}</span>}
                {done && !current ? <span className="sr-only"> {t("stepDone")}</span> : null}
              </li>
            );
          })}
        </ol>
      </nav>

      <section className="card" aria-labelledby="setup-step-title">
        <h2 id="setup-step-title">{t(`titles.${step}`)}</h2>
        <p>{t(`explanations.${step}`)}</p>
        {step === 1 ? <ActivityForm metier={profile.metier} precision={profile.metierPrecision} /> : null}
        {step === 2 ? <CompanyForm profile={profile} /> : null}
        {step === 3 ? <VatForm regime={profile.vatRegime} /> : null}
        {step === 4 ? <BudgetLinesStep /> : null}
        {step === 5 ? <ListsStep /> : null}
        {step === 6 ? <ModelsStep /> : null}
      </section>
      {step > 1 ? (
        <p>
          <Link href={`/demarrage?etape=${step - 1}`}>{t("back")}</Link>
        </p>
      ) : null}
    </main>
  );

  async function BudgetLinesStep() {
    const lines = await listDefaultVendorSlots(organizationId);
    return (
      <div className="stack">
        <ul className="setup-lines" aria-label={t("linesLabel")}>
          {lines.map((line) => (
            <li key={line.id}>
              <BudgetLineForm line={line} />
              <form action={removeBudgetLineAction}>
                <input type="hidden" name="id" value={line.id} />
                <button type="submit">{t("removeLine", { line: line.label })}</button>
              </form>
            </li>
          ))}
        </ul>
        <AddBudgetLineForm />
        <NextButton next={5} />
      </div>
    );
  }

  async function ListsStep() {
    const [sources, reasons] = await Promise.all([listProspectSources(organizationId), listLossReasons(organizationId)]);
    return (
      <div className="setup-two">
        <section aria-labelledby="setup-sources">
          <h3 id="setup-sources">{t("sourcesTitle")}</h3>
          <p className="muted">{t("sourcesHint")}</p>
          <ul>
            {sources.map((source) => (
              <li key={source.id}>{source.label}</li>
            ))}
          </ul>
          <AddSourceForm />
        </section>
        <section aria-labelledby="setup-reasons">
          <h3 id="setup-reasons">{t("reasonsTitle")}</h3>
          <p className="muted">{t("reasonsHint")}</p>
          <ul>
            {reasons.map((reason) => (
              <li key={reason.id}>{reason.label}</li>
            ))}
          </ul>
          <AddLossReasonForm />
        </section>
        <NextButton next={6} />
      </div>
    );
  }

  async function ModelsStep() {
    const [tasks, programs, splits, lines] = await Promise.all([
      listTaskTemplates(organizationId),
      listProgramTemplates(organizationId),
      listAllocationModels(organizationId),
      listDefaultVendorSlots(organizationId),
    ]);
    return (
      <div className="stack">
        <ul className="setup-models">
          <li>
            <strong>{t("modelRetroplanning")}</strong> {tasks.map((template) => t("modelCount", { name: template.name, count: template.items.length })).join(" · ") || t("modelNone")}{" "}
            <Link href="/events/modeles">{t("modelEditLater")}</Link>
          </li>
          <li>
            <strong>{t("modelProgram")}</strong> {programs.map((template) => t("modelCount", { name: template.name, count: template.items.length })).join(" · ") || t("modelNone")}{" "}
            <Link href="/events/modeles-programme">{t("modelEditLater")}</Link>
          </li>
          <li>
            <strong>{t("modelSplit")}</strong> {splits.map((split) => split.name).join(" · ") || t("modelNone")} <Link href="/budget/parametres">{t("modelEditLater")}</Link>
          </li>
        </ul>
        <p className="muted">{t("modelsHint")}</p>
        <p className="line-icons" aria-label={t("linesLabel")}>
          {lines.map((line) => (
            <BudgetLineIcon key={line.id} icon={line.icon} label={line.label} />
          ))}
        </p>
        {state!.completed ? (
          <p role="status">{t("alreadyDone")}</p>
        ) : (
          <form action={finishSetupAction} className="primary-action">
            <button type="submit">{t("finish")}</button>
          </form>
        )}
      </div>
    );
  }

  function NextButton({ next }: { next: number }) {
    return (
      <form action={nextStepAction} className="primary-action">
        <input type="hidden" name="next" value={next} />
        <button type="submit">{t("validateAndContinue")}</button>
      </form>
    );
  }
}
