// Lot 71e (HUB-14, PRE-01, PRE-02, CHR-08, UX-17 ; spécification du lot 71, § 5.5 ; maquettes 10 et 11) —
// l'écran d'un PDF de prestataires retenus ou de programme, dans l'assistant commun. Un seul écran, de
// haut en bas : le contrôle du couple (l'aperçu ne s'ouvre pas avant une réponse), puis la question des
// contrats et les postes (prestataires) ou les interlocuteurs (programme), puis « Vérifier : ce qui va
// être écrit », avec les nombres du bilan. Tout se lit sans ouvrir de menu ; un menu n'apparaît que sur
// une ligne « À vérifier » (ou derrière « Modifier »). Textes rendus côté serveur (NFR-02).
import "./pdf-import.css";
import { notFound } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { formatCalendarDate, type Locale } from "@symbola/i18n";
import { ScreenHelp } from "@/app/screen-help";
import { requirePlanner } from "@/lib/guards";
import { getProgramImportView, getVendorsImportView, type ProgramImportView, type VendorsImportView } from "@/lib/import/pdf-imports";
import { clockLabel, programFileCouple } from "@/lib/import/pdf-import-rules";
import type { ImportStepKey } from "@/lib/import/wizard";
import { ImportHeader } from "../../import-header";
import { importStepContext } from "../../step-context";
import { chooseOtherFileAction, confirmCoupleAction, saveProgramAction, saveVendorsAction } from "./actions";

type T = Awaited<ReturnType<typeof getTranslations<"ImportPdf">>>;

export default async function PdfImportPage({ params, searchParams }: { params: Promise<{ importId: string }>; searchParams: Promise<{ bloque?: string }> }) {
  const { importId } = await params;
  const { organizationId, wizard } = await importStepContext(importId, { pdf: true });
  await requirePlanner();
  const t = await getTranslations("ImportPdf");
  const tHelp = await getTranslations("Help");
  const locale = (await getLocale()) as Locale;
  const view = wizard.entityType === "event_vendors" ? await getVendorsImportView(organizationId, importId) : await getProgramImportView(organizationId, importId);
  if (!view) notFound();
  const query = await searchParams;
  const current: ImportStepKey = wizard.next;
  const stepLabel = (key: ImportStepKey) => t(`step.${view.kind}.${key}`);
  const blocked = query.bloque && ["couple", "contracts", "nothing"].includes(query.bloque) ? query.bloque : null;

  return (
    <main className="import-assistant pdf-import">
      <ImportHeader wizard={wizard} current={current} abandon={false} stepLabel={stepLabel} stepHref={() => `/import/${importId}/pdf`} />
      <p className="meta">{t(`intro.${view.kind}`, { file: view.draft.fileName, count: view.kind === "event_vendors" ? view.rows.length : view.preview.rows.length })}</p>
      <ScreenHelp title={tHelp(view.kind === "program" ? "programImport.title" : "importConfirm.title")} body={tHelp(view.kind === "program" ? "programImport.body" : "importConfirm.body")} />
      {blocked ? <p role="alert">{t(`blocked.${blocked}`)}</p> : null}
      {view.coupleStop ? <CoupleStop view={view} t={t} locale={locale} /> : view.kind === "event_vendors" ? <VendorsScreen view={view} t={t} /> : <ProgramScreen view={view} t={t} locale={locale} />}
    </main>
  );
}

// —— « Ce fichier est-il bien celui de Léa et Hugo ? » (R10, C-62) ————————————————————————————————

function CoupleStop({ view, t, locale }: { view: VendorsImportView | ProgramImportView; t: T; locale: Locale }) {
  const eventCouple = view.event.names.map((name) => [name.firstName, name.lastName].filter(Boolean).join(" ")).join(" · ");
  const fileCouple = (view.kind === "program" ? programFileCouple(view.draft.document.kind === "program" ? view.draft.document.program : { title: null, rows: [] }).map((person) => person.firstName ?? "") : view.fileCouple).map(nameCase).join(" · ");
  const firstNames = view.event.names.map((name) => name.firstName).join(t("and"));
  const sameDate = view.fileDate !== null && view.fileDate === view.event.eventDate;
  const date = (value: string | null) => (value ? formatCalendarDate(value, locale) : t("notProvided"));
  return (
    <section className="card stack pdf-couple" aria-labelledby="pdf-couple-title">
      <p className="badge badge-attention">{t("toVerify")}</p>
      <h2 id="pdf-couple-title">{t("couple.title", { names: firstNames })}</h2>
      <p>{sameDate ? t("couple.sameDate") : t("couple.otherCouple")}</p>
      <table className="pdf-couple-table">
        <thead>
          <tr>
            <th scope="col">
              <span className="sr-only">{t("couple.what")}</span>
            </th>
            <th scope="col">{t("couple.inFile")}</th>
            <th scope="col">{t("couple.onEvent")}</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <th scope="row">{t("couple.married")}</th>
            <td>
              <strong>{fileCouple || t("notProvided")}</strong>
            </td>
            <td>
              <strong>{eventCouple}</strong>
            </td>
          </tr>
          <tr>
            <th scope="row">{t("couple.date")}</th>
            <td>{sameDate ? date(view.fileDate) : <strong>{date(view.fileDate)}</strong>}</td>
            <td>{sameDate ? date(view.event.eventDate) : <strong>{date(view.event.eventDate)}</strong>}</td>
          </tr>
        </tbody>
      </table>
      <div className="row-actions">
        <form action={chooseOtherFileAction}>
          <input type="hidden" name="importId" value={view.draft.id} />
          <button type="submit">{t("couple.otherFile")}</button>
        </form>
        <form action={confirmCoupleAction}>
          <input type="hidden" name="importId" value={view.draft.id} />
          <button type="submit" className="button-secondary">
            {t("couple.continue")}
          </button>
        </form>
      </div>
      <p className="meta">{t("couple.kept")}</p>
    </section>
  );
}

// « Clémence MARTIN » → « Clémence Martin » (la casse de l'app, UX-02).
function nameCase(value: string): string {
  return value.replace(/\p{L}[\p{L}'’-]*/gu, (word) => (word === word.toLocaleUpperCase("fr") && word.length > 1 ? word.charAt(0) + word.slice(1).toLocaleLowerCase("fr") : word));
}

// —— Les prestataires retenus (maquette 10) ——————————————————————————————————————————————————

function VendorsScreen({ view, t }: { view: VendorsImportView; t: T }) {
  const answer = view.answers?.contracts?.answer ?? null;
  const perLine = answer === "per_line";
  const rows = view.rows.filter((row) => !row.planner);
  const agency = view.rows.filter((row) => row.planner);
  const slotText = (row: (typeof rows)[number]) => (row.slot.kind === "new" ? t("vendors.newSlot", { label: row.slot.label }) : row.slot.label);
  const importable = rows.filter((row) => !row.skip && !row.alreadyRetained).length;
  return (
    <form action={saveVendorsAction} className="stack">
      <input type="hidden" name="importId" value={view.draft.id} />
      <fieldset className="card pdf-question" aria-describedby="pdf-contracts-hint">
        <legend>{t("vendors.contractsQuestion")}</legend>
        <div className="row-wrap">
          {(["all", "none", "per_line"] as const).map((value) => (
            <label key={value}>
              <input type="radio" name="contracts" value={value} defaultChecked={answer === value} required />
              {t(`vendors.contracts.${value}`)}
            </label>
          ))}
        </div>
        <p id="pdf-contracts-hint" className="meta">
          {t("vendors.noReminder")}
        </p>
        <p className="row-actions">
          <button type="submit" name="intent" value="answer" className="button-secondary">
            {t("vendors.saveAnswer")}
          </button>
        </p>
      </fieldset>

      <section className="card" aria-labelledby="pdf-rows-title">
        <h2 id="pdf-rows-title">{t("vendors.rowsTitle", { count: rows.length })}</h2>
        {view.toVerify > 0 ? <p className="meta">{t("vendors.toVerifyCount", { count: view.toVerify })}</p> : null}
        {perLine ? <input type="hidden" name="contractsPerLine" value="1" /> : null}
        <table className="pdf-vendors">
          <thead>
            <tr>
              <th scope="col">{t("vendors.col.file")}</th>
              <th scope="col">{t("vendors.col.fiche")}</th>
              <th scope="col">{t("vendors.col.slot")}</th>
              {perLine ? <th scope="col">{t("vendors.col.contract")}</th> : null}
              <th scope="col">{t("vendors.col.keep")}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.line} className={row.verify ? "pdf-row-verify" : undefined} id={`ligne-${row.line}`}>
                <th scope="row">
                  <input type="hidden" name="line" value={row.line} />
                  <span className="pdf-name">{row.name}</span>
                  <span className="meta">
                    {[row.type, row.contact ? nameCase(row.contact) : null].filter(Boolean).join(" · ")}
                  </span>
                </th>
                <td>
                  {row.verify === "possible_vendor" ? (
                    <label>
                      <span className="sr-only">{t("vendors.col.fiche")}</span>
                      <select name={`vendor-${row.line}`} defaultValue={row.vendor?.id ?? "new"}>
                        {row.vendor ? <option value={row.vendor.id}>{t("vendors.sameFiche", { name: row.vendor.name })}</option> : null}
                        <option value="new">{t("vendors.newFiche")}</option>
                      </select>
                    </label>
                  ) : (
row.vendor ? t("vendors.found") : t("vendors.newFiche")
                  )}
                </td>
                <td>
                  {row.verify && row.verify !== "possible_vendor" ? (
                    <label>
                      <span className="sr-only">{t("vendors.col.slot")}</span>
                      <select name={`slot-${row.line}`} defaultValue={row.slot.kind === "existing" ? row.slot.id : "new"}>
                        <option value="new">{t("vendors.newSlot", { label: row.slot.kind === "new" ? row.slot.label : row.type })}</option>
                        {view.slots.map((slot) => (
                          <option key={slot.id} value={slot.id}>
                            {slot.label}
                          </option>
                        ))}
                      </select>
                    </label>
                  ) : (
slotText(row)
                  )}
                  {row.verify ? (
                    <p className="pdf-verify">
                      <span className="badge badge-attention">{t("toVerify")}</span> {t(`vendors.verify.${row.verify}`, { type: row.type })}
                    </p>
                  ) : null}
                  {row.alreadyRetained ? <p className="meta">{t("vendors.alreadyRetained")}</p> : null}
                </td>
                {perLine ? (
                  <td>
                    <label>
                      <span className="sr-only">{t("vendors.col.contract")}</span>
                      <select name={`contract-${row.line}`} defaultValue={row.contract === "signed" ? "signed" : "unsigned"}>
                        <option value="signed">{t("vendors.signed")}</option>
                        <option value="unsigned">{t("vendors.unsigned")}</option>
                      </select>
                    </label>
                  </td>
                ) : null}
                <td>
                  <label>
                    <input type="checkbox" name="keep" value={row.line} defaultChecked={!row.skip} />
                    <span className="sr-only">{t("vendors.keepLabel", { name: row.name })}</span>
                  </label>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {agency.map((row) => (
          <p key={row.line} className="meta">
            {t("vendors.agencyLine", { name: row.name })}
          </p>
        ))}
        <p className="row-actions">
          <button type="submit" name="intent" value="continue" className="button-secondary">
            {t("save")}
          </button>
        </p>
      </section>

      <section className="card stack" id="verifier" aria-labelledby="pdf-verify-title">
        <h2 id="pdf-verify-title">{t("verifyTitle")}</h2>
        <ul className="import-figures pdf-figures">
          <li>
            <strong>{t("vendors.figure.vendors", { count: view.figures.vendors })}</strong>
          </li>
          <li>{t("vendors.figure.carnet", { found: view.figures.foundInCarnet, created: view.figures.createdFiches })}</li>
          <li>
            {answer
              ? t("vendors.figure.contracts", { signed: view.figures.signed, unsigned: view.figures.unsigned })
              : t("vendors.figure.contractsPending")}
          </li>
          <li>{t("vendors.figure.newSlots", { count: view.figures.newSlots })}</li>
        </ul>
        <p className="meta">{t("vendors.notTaken")}</p>
        <p className="row-actions">
          <button type="submit" name="intent" value="import" disabled={importable === 0}>
            {t("vendors.import", { count: importable })}
          </button>
        </p>
      </section>
    </form>
  );
}

// —— Le programme (maquette 11) ——————————————————————————————————————————————————————————————

function ProgramScreen({ view, t, locale }: { view: ProgramImportView; t: T; locale: Locale }) {
  const vendors = view.speakers.filter((speaker) => speaker.kind === "vendor");
  const slotLabels = new Map(view.preview.slots.map((slot) => [slot.id, slot.label] as const));
  const lang = locale === "en" ? "en" : "fr";
  const timeOf = (row: ProgramImportView["preview"]["rows"][number]) => {
    const start = clockLabel(row.startTime, lang);
    if (row.timing === "marker") return t("program.marker", { start });
    if (!row.endTime) return start;
    const end = clockLabel(row.endTime, lang);
    return row.endsNextDay ? t("program.nextDay", { start, end }) : `${start} – ${end}`;
  };
  const who = (row: ProgramImportView["preview"]["rows"][number]) => (row.participants ?? []).map((participant) => participant.label).join(" · ");
  return (
    <form action={saveProgramAction} className="stack">
      <input type="hidden" name="importId" value={view.draft.id} />
      <section className="card" aria-labelledby="pdf-speakers-title">
        <h2 id="pdf-speakers-title">{t("program.speakersTitle", { count: vendors.length })}</h2>
        <p className="meta">{t("program.speakersHint")}</p>
        <ul className="pdf-speakers">
          {vendors.map((speaker) => (
            <li key={speaker.index} className={speaker.slotId ? undefined : "pdf-row-verify"}>
              <label>
                <span>
                  <span className="pdf-name">{[speaker.company, speaker.contact ? nameCase(speaker.contact) : null].filter(Boolean).join(" · ")}</span> <span className="meta">{speaker.role}</span>
                </span>
                <select name={`speaker-${speaker.index}`} defaultValue={speaker.slotId ?? ""}>
                  <option value="">{t("program.asText")}</option>
                  {view.preview.slots.map((slot) => (
                    <option key={slot.id} value={slot.id}>
                      {slot.label}
                    </option>
                  ))}
                </select>
              </label>
            </li>
          ))}
        </ul>
        <p className="row-actions">
          <button type="submit" name="intent" value="continue" className="button-secondary">
            {t("save")}
          </button>
        </p>
      </section>

      <section className="card stack" id="verifier" aria-labelledby="pdf-verify-title">
        <h2 id="pdf-verify-title">{t("verifyTitle")}</h2>
        <ul className="import-figures pdf-figures">
          <li>
            <strong>{t("program.figure.days", { count: view.figures.days })}</strong>
          </li>
          <li>{t("program.figure.moments", { count: view.figures.moments, markers: view.figures.markers })}</li>
          <li>{t("program.figure.endsMissing", { count: view.figures.endsMissing })}</li>
          {view.figures.hiddenFromClients > 0 ? <li>{t("program.figure.hidden", { count: view.figures.hiddenFromClients })}</li> : null}
        </ul>
        {view.figures.directory > 0 ? <p>{t("program.directoryNotTaken", { count: view.figures.directory })}</p> : null}
        {view.days.map((day) => (
          <section key={day.date ?? "sans-date"} className="pdf-day" aria-label={t(`program.day.${day.kind}`, { date: day.date ? formatCalendarDate(day.date, locale) : "" })}>
            <h3>
              {t(`program.day.${day.kind}`, { date: day.date ? formatCalendarDate(day.date, locale) : "" })}{" "}
              <span className="meta">
                {day.date ? formatCalendarDate(day.date, locale) : ""} · {t("program.dayCount", { count: day.rows.length })}
              </span>
            </h3>
            <ul className="pdf-moments">
              {day.rows.map((row) => (
                <li key={row.line}>
                  <span className="pdf-time">
                    {timeOf(row)}
                    {row.timing !== "marker" && !row.endTime ? <span className="pdf-missing">{t("program.endMissing")}</span> : null}
                  </span>
                  <span>
                    <span className="pdf-name">{row.label}</span>
                    {row.hiddenFromClients ? <span className="badge">{t("program.hidden")}</span> : null}
                    {row.midnightEnd ? <span className="meta pdf-midnight">{t("program.midnight", { start: row.startTime ?? "" })}</span> : null}
                    <span className="meta">{who(row) || "—"}</span>
                  </span>
                </li>
              ))}
            </ul>
          </section>
        ))}
        {view.preview.problems.length > 0 ? <p className="meta">{t("program.problems", { count: view.preview.problems.length })}</p> : null}
        <p className="meta">{slotLabels.size === 0 ? t("program.noSlots") : null}</p>
        <p className="row-actions">
          <button type="submit" name="intent" value="import" disabled={view.preview.rows.length === 0}>
            {t("program.import", { count: view.preview.rows.length })}
          </button>
        </p>
      </section>
    </form>
  );
}
