// Lot 12 (ONB-03) — assistant de démarrage : sept étapes (lot 18 : « Vos
// documents », facultative) déjà remplies selon le métier, à relire et ajuster. Tant qu'il n'est pas terminé, les menus
// métier sont verrouillés (app-shell). Réservé à la titulaire ; un membre de
// l'équipe voit qu'elle doit le terminer.
import Link from "next/link";
import { getLocale, getTranslations } from "next-intl/server";
import { starterDocumentStyle, starterEventTypes } from "@symbola/starter-templates";
import { appDatabase } from "@symbola/db/client";
import { listDefaultVendorSlots, listEventTypes, listLossReasons, listProgramTemplates, listProspectSources, listTaskTemplates } from "@/modules/events/service";
import { listAllocationModels } from "@/modules/budget/service";
import { getOrganizationProfile, getSetupState, isModuleEnabled, SETUP_STEPS } from "@/modules/hub/service";
import { getDocumentSettings } from "@/modules/quotes/service";
import { LogoForm } from "@/app/logo/logo-form";
import { requirePlanner } from "@/lib/guards";
import { BudgetLineIcon } from "@/app/budget-line-icon";
import { finishSetupAction, nextStepAction, removeBudgetLineAction } from "./actions";
import { ActivityForm, AddBudgetLineForm, AddLossReasonForm, AddSourceForm, BudgetLineForm, CompanyForm, DocumentsColorForm, VatForm } from "./setup-forms";
import { ScreenHelp } from "@/app/screen-help";

export default async function SetupPage({ searchParams }: { searchParams: Promise<{ etape?: string }> }) {
  const auth = await requirePlanner();
  const organizationId = auth.user.organizationId;
  const t = await getTranslations("Setup");
  const tHelp = await getTranslations("Help");

  const db = appDatabase();
  const state = await getSetupState(db, organizationId);
  const profile = await getOrganizationProfile(db, organizationId);
  // Lot 16 (ADR 0045) : types d'événement proposés à l'étape 1, dans l'ordre de chaque métier.
  const starterLocale = (await getLocale()) === "en" ? "en" : "fr";
  const eventTypeOptions = {
    wedding_planner: starterEventTypes(starterLocale, "wedding_planner").map(({ key, label }) => ({ key, label })),
    event_agency: starterEventTypes(starterLocale, "event_agency").map(({ key, label }) => ({ key, label })),
  };
  const installedTypes = await listEventTypes(organizationId);
  const chosenEventTypes = installedTypes.length > 0 ? installedTypes.flatMap((type) => (type.starterKey ? [type.starterKey] : [])) : null;

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
      <ScreenHelp title={tHelp("setup.title")} body={tHelp("setup.body")} />
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
        {step === 1 ? (
          <ActivityForm metier={profile.metier} precision={profile.metierPrecision} eventTypeOptions={eventTypeOptions} chosenEventTypes={chosenEventTypes} />
        ) : null}
        {step === 2 ? <CompanyForm profile={profile} /> : null}
        {step === 3 ? <VatForm regime={profile.vatRegime} /> : null}
        {step === 4 ? <DocumentsStep /> : null}
        {step === 5 ? <BudgetLinesStep /> : null}
        {step === 6 ? <ListsStep /> : null}
        {step === 7 ? <ModelsStep /> : null}
      </section>
      {step > 1 ? (
        <p>
          <Link href={`/demarrage?etape=${step - 1}`}>{t("back")}</Link>
        </p>
      ) : null}
    </main>
  );

  // Lot 18 (AIDE-13, décision E) : logo et couleur, facultatifs.
  async function DocumentsStep() {
    const quotes = await isModuleEnabled(db, organizationId, "quotes");
    const style = starterDocumentStyle(starterLocale);
    const settings = quotes ? await getDocumentSettings(organizationId) : null;
    const logoVersion = profile.logoKey?.split("/").pop() ?? null;
    return (
      <div className="stack">
        <LogoForm version={logoVersion} />
        {quotes ? <DocumentsColorForm swatches={style.swatches} current={settings?.color ?? style.defaultColor} /> : <NextButton next={5} />}
        <form action={nextStepAction}>
          <input type="hidden" name="next" value={5} />
          <button type="submit" className="button-ghost">
            {t("documentsLater")}
          </button>
        </form>
      </div>
    );
  }

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
        <NextButton next={6} />
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
        <NextButton next={7} />
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
