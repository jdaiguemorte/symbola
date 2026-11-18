"use client";

// Lot 49 (INV-01 à INV-04, INV-07, RGP-08 ; D3 à D5, D9 à D13 ; partie G) — formulaires de l'onglet
// Invités de la fiche ; le formulaire d'un foyer et celui de l'import servent aussi la rubrique
// « Invités » du portail du client (l'action est donnée par l'écran). Chaque champ est étiqueté.
import { useActionState, useId, useState, type ReactNode } from "react";
import { useTranslations } from "next-intl";
import type { GuestAgeRange, GuestKind, GuestSide, HouseholdView, RecipientsReview } from "@symbola/contracts";
import { RecipientsGuard } from "@/app/recipients-guard";
import { FreeTextNotice } from "@/app/ui/free-text-notice";
import type { GuestFormState, GuestLinkState, InvitationState, ImportState } from "./actions";

type Action<S> = (state: S, formData: FormData) => Promise<S>;

function Feedback({ state, saved }: { state: GuestFormState; saved?: string }) {
  return (
    <>
      {state.error ? <p role="alert">{state.error}</p> : null}
      {state.success && saved ? (
        <p role="status" className="saved">
          {saved}
        </p>
      ) : null}
    </>
  );
}

// —— Partie G : activation ——————————————————————————————————————————————————————————————

export function ActivationForm({ action, assessmentUrl }: { action: Action<GuestFormState>; assessmentUrl: string | null }) {
  const t = useTranslations("Guests.activation");
  const [state, formAction, pending] = useActionState(action, {});
  return (
    <form action={formAction} className="stack">
      <p>
        {assessmentUrl ? (
          <a href={assessmentUrl} target="_blank" rel="noopener noreferrer">
            {t("assessmentLink")}
          </a>
        ) : (
          t("assessmentProvided")
        )}
      </p>
      <label className="checkbox">
        <input type="checkbox" name="confirmed" required />
        {t("confirmLabel")}
      </label>
      <button type="submit" className="primary" disabled={pending}>
        {t("confirm")}
      </button>
      <Feedback state={state} />
    </form>
  );
}

// —— Réglages des réponses (D10, D11, D13) ——————————————————————————————————————————————

export function GuestSettingsForm({
  action,
  eventId,
  settings,
}: {
  action: Action<GuestFormState>;
  eventId: string;
  settings: { responsesCloseOn: string | null; suggestedCloseOn: string | null; askDiet: boolean; askAccommodation: boolean; askTransport: boolean; reminderDays: number[] };
}) {
  const t = useTranslations("Guests.settings");
  const [state, formAction, pending] = useActionState(action, {});
  const reminders = [...settings.reminderDays, undefined, undefined, undefined].slice(0, 3);
  return (
    <form action={formAction} className="stack">
      <input type="hidden" name="eventId" value={eventId} />
      <label>
        {t("closeOn")}
        <input type="date" name="responsesCloseOn" defaultValue={settings.responsesCloseOn ?? settings.suggestedCloseOn ?? ""} />
      </label>
      {settings.suggestedCloseOn && !settings.responsesCloseOn ? <p className="muted">{t("closeOnSuggested")}</p> : null}
      <fieldset>
        <legend>{t("questions")}</legend>
        <p className="muted">{t("presenceAlways")}</p>
        <label className="checkbox">
          <input type="checkbox" name="askDiet" defaultChecked={settings.askDiet} />
          {t("askDiet")}
        </label>
        <label className="checkbox">
          <input type="checkbox" name="askAccommodation" defaultChecked={settings.askAccommodation} />
          {t("askAccommodation")}
        </label>
        <label className="checkbox">
          <input type="checkbox" name="askTransport" defaultChecked={settings.askTransport} />
          {t("askTransport")}
        </label>
      </fieldset>
      <fieldset>
        <legend>{t("reminders")}</legend>
        <p className="muted">{t("remindersHelp")}</p>
        {reminders.map((day, index) => (
          <label key={index}>
            {t("reminderN", { n: index + 1 })}
            <input type="number" name="reminderDays" min={1} max={90} step={1} defaultValue={day ?? ""} />
          </label>
        ))}
      </fieldset>
      <button type="submit" disabled={pending}>
        {t("save")}
      </button>
      <Feedback state={state} saved={t("saved")} />
    </form>
  );
}

// —— Foyer (INV-01, RGP-18) ———————————————————————————————————————————————————————————————

type PersonDraft = { id?: string; kind: GuestKind; firstName: string; lastName: string; email: string; phone: string; ageRange: GuestAgeRange | "" };

const AGE_RANGES: GuestAgeRange[] = ["0-2", "3-5", "6-11", "12-17"];

function emptyPerson(kind: GuestKind): PersonDraft {
  return { kind, firstName: "", lastName: "", email: "", phone: "", ageRange: "" };
}

export function HouseholdForm({
  action,
  eventId,
  household,
  clients,
  keyMoments,
  groups,
  hidden,
  submitLabel,
}: {
  action: Action<GuestFormState>;
  eventId: string;
  household?: HouseholdView | undefined;
  clients: { id: string; name: string }[];
  keyMoments: { id: string; name: string }[];
  groups: string[];
  hidden?: ReactNode;
  submitLabel?: string;
}) {
  const t = useTranslations("Guests.household");
  const [state, formAction, pending] = useActionState(action, {});
  const prefix = useId();
  const [displayName, setDisplayName] = useState(household?.displayName ?? "");
  const [side, setSide] = useState<string>(household?.side?.kind === "both" ? "both" : household?.side?.kind === "client" ? household.side.clientId : "");
  const [groupLabel, setGroupLabel] = useState(household?.groupLabel ?? "");
  const [language, setLanguage] = useState<"fr" | "en">(household?.language ?? "fr");
  const [moments, setMoments] = useState<string[] | null>(household?.keyMomentIds ?? null);
  const [people, setPeople] = useState<PersonDraft[]>(
    household?.people.map((person) => ({ id: person.id, kind: person.kind, firstName: person.firstName, lastName: person.lastName ?? "", email: person.email ?? "", phone: person.phone ?? "", ageRange: person.ageRange ?? "" })) ?? [emptyPerson("adult")],
  );
  const [respondent, setRespondent] = useState(Math.max(0, household?.people.findIndex((person) => person.id === household.respondentGuestId) ?? 0));
  const sideValue: GuestSide = side === "both" ? { kind: "both" } : side ? { kind: "client", clientId: side } : null;
  const payload = JSON.stringify({
    displayName: displayName.trim() || null,
    side: sideValue,
    groupLabel: groupLabel.trim() || null,
    language,
    keyMomentIds: moments,
    respondentIndex: respondent,
    people: people.map((person) => ({
      ...(person.id ? { id: person.id } : {}),
      kind: person.kind,
      firstName: person.firstName,
      lastName: person.kind === "adult" ? person.lastName || null : null,
      email: person.kind === "adult" ? person.email || null : null,
      phone: person.kind === "adult" ? person.phone || null : null,
      ageRange: person.kind === "child" ? person.ageRange || null : null,
    })),
  });
  const update = (index: number, change: Partial<PersonDraft>) => setPeople(people.map((person, position) => (position === index ? { ...person, ...change } : person)));
  return (
    <form action={formAction} className="stack">
      <input type="hidden" name="eventId" value={eventId} />
      <input type="hidden" name="householdId" value={household?.id ?? ""} />
      <input type="hidden" name="household" value={payload} />
      {hidden}
      <p className="muted">{t("required")}</p>
      {people.map((person, index) => (
        <fieldset key={person.id ?? `new-${index}`}>
          <legend>{person.kind === "adult" ? t("adultN", { n: index + 1 }) : t("childN", { n: index + 1 })}</legend>
          <label>
            {t("firstName")}
            <input value={person.firstName} onChange={(event) => update(index, { firstName: event.target.value })} required maxLength={100} />
          </label>
          {person.kind === "adult" ? (
            <>
              <label>
                {t("lastName")}
                <input value={person.lastName} onChange={(event) => update(index, { lastName: event.target.value })} maxLength={100} />
              </label>
              <label>
                {t("email")}
                <input type="email" value={person.email} onChange={(event) => update(index, { email: event.target.value })} maxLength={320} autoComplete="off" />
              </label>
              <label>
                {t("phone")}
                <input type="tel" value={person.phone} onChange={(event) => update(index, { phone: event.target.value })} maxLength={40} autoComplete="off" />
              </label>
              <label className="checkbox">
                <input type="radio" name={`${prefix}-respondent`} checked={respondent === index} onChange={() => setRespondent(index)} />
                {t("respondent")}
              </label>
            </>
          ) : (
            <>
              <label>
                {t("ageRange")}
                <select value={person.ageRange} onChange={(event) => update(index, { ageRange: event.target.value as GuestAgeRange | "" })}>
                  <option value="">{t("ageUnknown")}</option>
                  {AGE_RANGES.map((range) => (
                    <option key={range} value={range}>
                      {t(`age.${range}`)}
                    </option>
                  ))}
                </select>
              </label>
              <p className="muted">{t("childNoContact")}</p>
            </>
          )}
          {people.length > 1 ? (
            <button
              type="button"
              onClick={() => {
                setPeople(people.filter((_, position) => position !== index));
                setRespondent(0);
              }}
            >
              {t("removePerson", { name: person.firstName || t("thisPerson") })}
            </button>
          ) : null}
        </fieldset>
      ))}
      <div className="row-wrap">
        <button type="button" onClick={() => setPeople([...people, emptyPerson("adult")])}>
          {t("addAdult")}
        </button>
        <button type="button" onClick={() => setPeople([...people, emptyPerson("child")])}>
          {t("addChild")}
        </button>
      </div>
      <label>
        {t("displayName")}
        <input value={displayName} onChange={(event) => setDisplayName(event.target.value)} maxLength={200} placeholder={t("displayNamePlaceholder")} />
      </label>
      <label>
        {t("side")}
        <select value={side} onChange={(event) => setSide(event.target.value)}>
          <option value="">{t("sideNone")}</option>
          {clients.map((client) => (
            <option key={client.id} value={client.id}>
              {t("sideOf", { name: client.name })}
            </option>
          ))}
          <option value="both">{t("sideBoth")}</option>
        </select>
      </label>
      <label>
        {t("group")}
        <input value={groupLabel} onChange={(event) => setGroupLabel(event.target.value)} maxLength={100} list={`${prefix}-groups`} />
        <datalist id={`${prefix}-groups`}>
          {groups.map((group) => (
            <option key={group} value={group} />
          ))}
        </datalist>
      </label>
      <label>
        {t("language")}
        <select value={language} onChange={(event) => setLanguage(event.target.value === "en" ? "en" : "fr")}>
          <option value="fr">{t("languageFr")}</option>
          <option value="en">{t("languageEn")}</option>
        </select>
      </label>
      {keyMoments.length > 0 ? (
        <fieldset>
          <legend>{t("moments")}</legend>
          {keyMoments.map((moment) => (
            <label key={moment.id} className="checkbox">
              <input
                type="checkbox"
                checked={moments === null || moments.includes(moment.id)}
                onChange={(event) => {
                  const current = moments ?? keyMoments.map((candidate) => candidate.id);
                  const next = event.target.checked ? [...current, moment.id] : current.filter((id) => id !== moment.id);
                  setMoments(next.length === keyMoments.length ? null : next);
                }}
              />
              {moment.name}
            </label>
          ))}
        </fieldset>
      ) : null}
      <button type="submit" className="primary" disabled={pending}>
        {submitLabel ?? (household ? t("save") : t("add"))}
      </button>
      <Feedback state={state} saved={household ? t("saved") : t("added")} />
    </form>
  );
}

// —— Lien à copier et QR code (D4) ——————————————————————————————————————————————————————

export function GuestLinkButton({ action, eventId, guestId, name }: { action: Action<GuestLinkState>; eventId: string; guestId: string; name: string }) {
  const t = useTranslations("Guests.link");
  const [state, formAction, pending] = useActionState(action, {});
  const [copied, setCopied] = useState(false);
  return (
    <div className="stack">
      <form action={formAction}>
        <input type="hidden" name="eventId" value={eventId} />
        <input type="hidden" name="guestId" value={guestId} />
        <button type="submit" disabled={pending}>
          {t("issue", { name })}
        </button>
      </form>
      {state.error ? <p role="alert">{state.error}</p> : null}
      {state.url ? (
        <div className="stack" role="status">
          <p>{t("issued")}</p>
          <label>
            {t("url")}
            <input readOnly value={state.url} onFocus={(event) => event.currentTarget.select()} />
          </label>
          <button
            type="button"
            onClick={() => {
              void navigator.clipboard?.writeText(state.url!).then(() => setCopied(true));
            }}
          >
            {copied ? t("copied") : t("copy")}
          </button>
          {state.qrCodeDataUrl ? (
            <>
              <img className="guest-qr" src={state.qrCodeDataUrl} alt={t("qrAlt", { name })} />
              <a href={state.qrCodeDataUrl} download={`invitation-${name.replace(/[^\p{L}\p{N}]+/gu, "-")}.png`}>
                {t("qrDownload")}
              </a>
            </>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

// —— Invitations après l'écran de contrôle (D4, MSG-02) ————————————————————————————————————

export function InvitationsForm({ action, eventId, count, schedule }: { action: Action<InvitationState>; eventId: string; count: number; schedule: string[] }) {
  const t = useTranslations("Guests.invitations");
  const [state, formAction, pending] = useActionState(action, {});
  const review: RecipientsReview | undefined = state.review;
  return (
    <form action={formAction} className="stack">
      <input type="hidden" name="eventId" value={eventId} />
      {review ? (
        <>
          {schedule.length > 0 ? <p>{t("schedule", { dates: schedule.join(", ") })}</p> : <p>{t("noReminders")}</p>}
          <RecipientsGuard review={review} pending={pending} />
        </>
      ) : (
        <button type="submit" className="primary" disabled={pending || count === 0}>
          {t("prepare", { count })}
        </button>
      )}
      {state.error ? <p role="alert">{state.error}</p> : null}
      {state.success ? (
        <p role="status">
          {t("sent", { count: state.sent ?? 0 })} {state.notSent ? t("notSent", { count: state.notSent }) : null}
        </p>
      ) : null}
    </form>
  );
}

// —— Import d'un tableur (INV-02, D12) ———————————————————————————————————————————————————

export function ImportForm({ action, eventId }: { action: Action<ImportState>; eventId: string }) {
  const t = useTranslations("Guests.import");
  const [state, formAction, pending] = useActionState(action, {});
  const [file, setFile] = useState<File | null>(null);
  const [skip, setSkip] = useState<Set<number> | null>(null);
  const fileId = useId();
  const result = state.result;
  const preview = result?.status === "preview" ? result.preview : null;
  const skipped = skip ?? new Set(preview?.duplicates.map((duplicate) => duplicate.line) ?? []);
  const submit = (intent: "preview" | "apply") => {
    if (!file) return;
    const data = new FormData();
    data.set("eventId", eventId);
    data.set("file", file);
    data.set("intent", intent);
    for (const line of skipped) data.append("skip", String(line));
    formAction(data);
  };
  return (
    <div className="stack">
      <label htmlFor={fileId}>{t("file")}</label>
      <input
        id={fileId}
        type="file"
        accept=".csv,.xlsx,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        onChange={(event) => {
          setFile(event.target.files?.[0] ?? null);
          setSkip(null);
        }}
      />
      <p className="muted">{t("help")}</p>
      <button type="button" disabled={!file || pending} onClick={() => submit("preview")}>
        {t("preview")}
      </button>
      {state.error ? <p role="alert">{state.error}</p> : null}
      {result?.status === "rejected" ? <p role="alert">{t(`rejected.${result.reason}`)}</p> : null}
      {result?.status === "applied" ? (
        <p role="status">{t("applied", { households: result.households, people: result.people, skipped: result.skipped })}</p>
      ) : null}
      {preview ? (
        <section className="stack" aria-labelledby={`${fileId}-preview`}>
          <h4 id={`${fileId}-preview`}>{t("previewTitle", { rows: preview.rows.length, households: preview.households })}</h4>
          <p>{t("nothingWritten")}</p>
          {preview.ignoredDietColumns.length > 0 ? <p role="note">{t("dietIgnored", { columns: preview.ignoredDietColumns.join(", ") })}</p> : null}
          {preview.neutralizedCells > 0 ? <p>{t("neutralized", { count: preview.neutralizedCells })}</p> : null}
          {preview.duplicates.length > 0 ? (
            <fieldset>
              <legend>{t("duplicates", { count: preview.duplicates.length })}</legend>
              {preview.duplicates.map((duplicate) => {
                const row = preview.rows.find((candidate) => candidate.line === duplicate.line);
                return (
                  <label key={duplicate.line} className="checkbox">
                    <input
                      type="checkbox"
                      checked={skipped.has(duplicate.line)}
                      onChange={(event) => {
                        const next = new Set(skipped);
                        if (event.target.checked) next.add(duplicate.line);
                        else next.delete(duplicate.line);
                        setSkip(next);
                      }}
                    />
                    {duplicate.with.kind === "file"
                      ? t("duplicateOfLine", { line: duplicate.line, name: `${row?.firstName ?? ""} ${row?.lastName ?? ""}`.trim(), other: duplicate.with.line })
                      : t("duplicateInEvent", { line: duplicate.line, name: duplicate.with.name })}
                  </label>
                );
              })}
            </fieldset>
          ) : (
            <p>{t("noDuplicates")}</p>
          )}
          {preview.problems.length > 0 ? (
            <ul>
              {preview.problems.map((problem) => (
                <li key={`${problem.line}-${problem.problem}`}>{t(`problem.${problem.problem}`, { line: problem.line })}</li>
              ))}
            </ul>
          ) : null}
          <button type="button" className="primary" disabled={pending} onClick={() => submit("apply")}>
            {t("apply", { count: preview.rows.length - skipped.size })}
          </button>
        </section>
      ) : null}
    </div>
  );
}

// —— Réponse notée par la planner ——————————————————————————————————————————————————————

export function RecordAnswersForm({ action, eventId, household, keyMoments }: { action: Action<GuestFormState>; eventId: string; household: HouseholdView; keyMoments: { id: string; name: string }[] }) {
  const t = useTranslations("Guests.answers");
  const [state, formAction, pending] = useActionState(action, {});
  const invited = keyMoments.filter((moment) => household.keyMomentIds === null || household.keyMomentIds.includes(moment.id));
  return (
    <details>
      <summary>{t("record")}</summary>
      <form action={formAction} className="stack">
        <input type="hidden" name="eventId" value={eventId} />
        <input type="hidden" name="householdId" value={household.id} />
        {household.people.map((person) =>
          invited.map((moment) => {
            const current = person.answers.find((answer) => answer.keyMomentId === moment.id)?.attending;
            return (
              <label key={`${person.id}:${moment.id}`}>
                {t("personAt", { name: person.firstName, moment: moment.name })}
                <select name={`presence:${person.id}:${moment.id}`} defaultValue={current === true ? "yes" : current === false ? "no" : ""}>
                  <option value="">{t("noAnswer")}</option>
                  <option value="yes">{t("yes")}</option>
                  <option value="no">{t("no")}</option>
                </select>
              </label>
            );
          }),
        )}
        <button type="submit" disabled={pending}>
          {t("save")}
        </button>
        <Feedback state={state} saved={t("saved")} />
      </form>
    </details>
  );
}

// —— Report de la purge (RGP-08, D9) ——————————————————————————————————————————————————————

export function PostponeForm({ action, eventId, latest }: { action: Action<GuestFormState>; eventId: string; latest: string }) {
  const t = useTranslations("Guests.purge");
  const [state, formAction, pending] = useActionState(action, {});
  return (
    <details>
      <summary>{t("postpone")}</summary>
      <form action={formAction} className="stack">
        <input type="hidden" name="eventId" value={eventId} />
        <p className="muted">{t("postponeHelp")}</p>
        <label>
          {t("until")}
          <input type="date" name="until" max={latest} required />
        </label>
        <label>
          {t("reason")}
          <textarea name="reason" required minLength={3} maxLength={500} rows={3} />
        </label>
        <FreeTextNotice />
        <button type="submit" disabled={pending}>
          {t("postponeConfirm")}
        </button>
        <Feedback state={state} saved={t("postponed")} />
      </form>
    </details>
  );
}
