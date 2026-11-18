// Lot 47 (BUD-05 ; D5 ; ADR 0085) — scénarios d'options d'un évènement : chacun choisit au plus un
// prestataire consulté par poste ; deux scénarios se comparent côte à côte (postes en lignes,
// scénarios en colonnes, écarts en évidence), leur total face à l'enveloppe du client (BUD-02) et
// au budget estimé. Montants TTC en centimes ; un devis sans montant compte « à préciser ».
import Link from "next/link";
import { notFound } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { formatAmount, type Locale } from "@symbola/i18n";
import { ScreenHelp } from "@/app/screen-help";
import { requirePlanner } from "@/lib/guards";
import { compareVendorScenarios, getEvent, listEventVendorSlots, listVendorCandidates, listVendorScenarios } from "@/modules/events/service";
import { listBudgetLines } from "@/modules/budget/service";
import { isBudgetModuleEnabled } from "@/app/budget/module-access";
import { isEventsModuleEnabled, isValidId } from "@/app/events/module-access";
import { removeScenarioAction, setScenarioChoiceAction, showScenarioAction } from "./actions";
import { CreateScenarioForm } from "./scenario-forms";

export default async function VendorScenariosPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ a?: string; b?: string }> }) {
  const auth = await requirePlanner();
  const organizationId = auth.user.organizationId;
  const t = await getTranslations("VendorCoordination");
  const tHelp = await getTranslations("Help");
  const locale = (await getLocale()) as Locale;
  const { id: eventId } = await params;
  if (!(await isEventsModuleEnabled(organizationId))) {
    return (
      <main>
        <h1>{t("scenarios.title")}</h1>
        <p>{t("unavailable")}</p>
      </main>
    );
  }
  if (!isValidId(eventId)) notFound();
  const event = await getEvent(organizationId, eventId);
  if (!event) notFound();
  const [scenarios, slots, candidates] = await Promise.all([listVendorScenarios(organizationId, eventId), listEventVendorSlots(organizationId, eventId), listVendorCandidates(organizationId, eventId)]);
  const query = await searchParams;
  const first = scenarios.find((scenario) => scenario.id === query.a) ?? scenarios[0];
  const second = scenarios.find((scenario) => scenario.id === query.b && scenario.id !== first?.id) ?? scenarios.find((scenario) => scenario.id !== first?.id);
  const compared = first && second ? await compareVendorScenarios(organizationId, eventId, [first.id, second.id]) : null;
  // BUD-02 : l'enveloppe du client et le budget estimé, si le module Budget est souscrit (ARC-06).
  const budget = (await isBudgetModuleEnabled(organizationId)) ? await listBudgetLines(organizationId, eventId) : null;
  const money = (cents: number) => formatAmount(cents, locale);
  const slotsWithCandidates = slots.filter((slot) => candidates.some((candidate) => candidate.vendorSlotId === slot.id && candidate.status !== "dismissed"));

  return (
    <main className="stack">
      <p>
        <Link href={`/events/${eventId}?onglet=budget`}>{t("back")}</Link>
      </p>
      <h1>{t("scenarios.title")}</h1>
      <ScreenHelp title={tHelp("vendorScenarios.title")} body={tHelp("vendorScenarios.body")} />
      <p>{t("scenarios.intro")}</p>

      {compared && compared.columns.length === 2 ? (
        <section className="card stack scenario-compare" aria-labelledby="compare-scenarios-title">
          <h2 id="compare-scenarios-title">{t("scenarios.compareTitle")}</h2>
          {scenarios.length > 2 ? (
            <form method="get" className="row-wrap">
              <label>
                {t("scenarios.left")}
                <select name="a" defaultValue={first!.id}>
                  {scenarios.map((scenario) => (
                    <option key={scenario.id} value={scenario.id}>
                      {scenario.name}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                {t("scenarios.right")}
                <select name="b" defaultValue={second!.id}>
                  {scenarios.map((scenario) => (
                    <option key={scenario.id} value={scenario.id}>
                      {scenario.name}
                    </option>
                  ))}
                </select>
              </label>
              <button type="submit">{t("scenarios.compare")}</button>
            </form>
          ) : null}
          <div className="list-table-wrap" role="region" aria-label={t("scenarios.tableLabel")} tabIndex={0}>
            <table className="data-table">
              <caption className="sr-only">{t("scenarios.compareTitle")}</caption>
              <thead>
                <tr>
                  <th scope="col">{t("scenarios.slot")}</th>
                  {compared.columns.map((column) => (
                    <th key={column.scenario.id} scope="col" className="num">
                      {column.scenario.name}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {compared.slots.map((slot, index) => {
                  const [left, right] = compared.columns.map((column) => column.lines[index]!);
                  const differs = left!.candidateId !== right!.candidateId;
                  return (
                    <tr key={slot.id}>
                      <th scope="row">{slot.label}</th>
                      {[left!, right!].map((line, side) => (
                        <td key={side} className={differs ? "num delta" : "num"}>
                          {line.candidateId ? `${line.vendorName} — ${line.amountCents !== null ? money(line.amountCents) : t("compare.toBeSpecified")}` : "—"}
                        </td>
                      ))}
                    </tr>
                  );
                })}
                <tr>
                  <th scope="row">{t("scenarios.total")}</th>
                  {compared.columns.map((column) => (
                    <td key={column.scenario.id} className="num">
                      <strong>{money(column.totalCents)}</strong>
                      {column.pendingCount > 0 ? ` (${t("scenarios.pending", { count: column.pendingCount })})` : ""}
                    </td>
                  ))}
                </tr>
                <tr>
                  <th scope="row">{t("scenarios.gap")}</th>
                  <td className="num" colSpan={2}>
                    {money(Math.abs(compared.columns[0]!.totalCents - compared.columns[1]!.totalCents))}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
          {budget ? (
            <p>
              {budget.envelope ? t("scenarios.envelope", { amount: money(budget.envelope.amountCents) }) : t("scenarios.noEnvelope")} · {t("scenarios.estimated", { amount: money(budget.totalEstimatedCents) })}
            </p>
          ) : null}
        </section>
      ) : (
        <p className="muted">{t("scenarios.needTwo")}</p>
      )}

      {scenarios.map((scenario) => (
        <section key={scenario.id} className="card stack" aria-labelledby={`scenario-${scenario.id}`}>
          <h2 id={`scenario-${scenario.id}`}>{scenario.name}</h2>
          {slotsWithCandidates.length === 0 ? <p className="muted">{t("scenarios.noCandidates")}</p> : null}
          <ul className="plain-list stack">
            {slotsWithCandidates.map((slot) => {
              const chosen = scenario.choices.find((choice) => choice.vendorSlotId === slot.id)?.candidateId ?? "";
              return (
                <li key={slot.id}>
                  <form action={setScenarioChoiceAction} className="row-wrap">
                    <input type="hidden" name="eventId" value={eventId} />
                    <input type="hidden" name="scenarioId" value={scenario.id} />
                    <input type="hidden" name="vendorSlotId" value={slot.id} />
                    <label>
                      {t("scenarios.choiceFor", { slot: slot.label, scenario: scenario.name })}
                      <select name="candidateId" defaultValue={chosen}>
                        <option value="">{t("scenarios.none")}</option>
                        {candidates
                          .filter((candidate) => candidate.vendorSlotId === slot.id && candidate.status !== "dismissed")
                          .map((candidate) => (
                            <option key={candidate.id} value={candidate.id}>
                              {candidate.vendorName} — {candidate.quoteAmountCents !== null ? money(candidate.quoteAmountCents) : t("compare.toBeSpecified")}
                            </option>
                          ))}
                      </select>
                    </label>
                    <button type="submit">{t("scenarios.choose")}</button>
                  </form>
                </li>
              );
            })}
          </ul>
          <div className="link-actions">
            <form action={showScenarioAction}>
              <input type="hidden" name="eventId" value={eventId} />
              <input type="hidden" name="scenarioId" value={scenario.id} />
              <button type="submit">{t("scenarios.show", { scenario: scenario.name })}</button>
            </form>
            <form action={removeScenarioAction}>
              <input type="hidden" name="eventId" value={eventId} />
              <input type="hidden" name="scenarioId" value={scenario.id} />
              <button type="submit">{t("scenarios.remove", { scenario: scenario.name })}</button>
            </form>
          </div>
        </section>
      ))}

      <section className="card stack" aria-labelledby="new-scenario-title">
        <h2 id="new-scenario-title">{t("scenarios.newTitle")}</h2>
        <CreateScenarioForm eventId={eventId} />
      </section>
    </main>
  );
}
