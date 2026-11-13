"use client";

// Lot 32b (HUB-07, UX-03 ; décision D9) — « Créer » dans la barre du haut de chaque écran, et la
// touche N hors d'un champ : prospect, tâche, dépense, devis, chacun en formulaire court dans une
// fenêtre, sans quitter l'écran. L'évènement proposé est celui de l'écran courant. Les entrées
// suivent les modules souscrits (ARC-06).
import Link from "next/link";
import { Plus } from "lucide-react";
import { useActionState, useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { formatCalendarDate, parisToday, type Locale } from "@symbola/i18n";
import { SameDayNotice } from "@/app/events/same-day-notice";
import {
  quickCreateExpenseAction,
  quickCreateOptionsAction,
  quickCreateProspectAction,
  quickCreateQuoteAction,
  quickCreateSlotsAction,
  quickCreateTaskAction,
  type QuickCreateOptions,
  type QuickCreateState,
  type QuickModules,
  type QuickSlot,
} from "./actions";

type Kind = "prospect" | "task" | "expense" | "quote";

function inField(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  return target.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName);
}

function plusDays(date: string, days: number): string {
  const next = new Date(`${date}T12:00:00Z`);
  next.setUTCDate(next.getUTCDate() + days);
  return next.toISOString().slice(0, 10);
}

export function QuickCreate({ modules }: { modules: QuickModules }) {
  const t = useTranslations("QuickCreate");
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);
  const [kind, setKind] = useState<Kind | null>(null);
  // Options de l'écran courant ; « null » : indisponibles (module Évènements non souscrit).
  const [loaded, setLoaded] = useState<{ path: string; options: QuickCreateOptions | null } | null>(null);
  const options = loaded && loaded.path === pathname ? loaded.options : undefined;
  const [round, setRound] = useState(0);
  const dialog = useRef<HTMLDialogElement>(null);
  const firstItem = useRef<HTMLButtonElement>(null);
  const kinds: Kind[] = [
    ...(modules.events ? (["prospect", "task"] as const) : []),
    ...(modules.events && modules.budget ? (["expense"] as const) : []),
    ...(modules.events && modules.quotes ? (["quote"] as const) : []),
  ];

  useEffect(() => {
    if (menuOpen) firstItem.current?.focus();
  }, [menuOpen]);

  // Les évènements, sources et types se chargent à la première ouverture sur cet écran, et restent
  // chargés quand le menu se referme sur le choix d'une entrée.
  const wanted = menuOpen || kind !== null;
  const stale = !loaded || loaded.path !== pathname;
  useEffect(() => {
    if (!wanted || !stale) return;
    let current = true;
    void quickCreateOptionsAction(pathname).then((result) => {
      if (current) setLoaded({ path: pathname, options: result });
    });
    return () => {
      current = false;
    };
  }, [wanted, stale, pathname]);

  // Touche N, hors d'un champ et sans modificateur : ouvre le menu.
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== "n" && event.key !== "N") return;
      if (event.ctrlKey || event.metaKey || event.altKey || inField(event.target) || dialog.current?.open) return;
      event.preventDefault();
      setMenuOpen(true);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  const choose = (next: Kind) => {
    setMenuOpen(false);
    setKind(next);
    setRound((value) => value + 1);
    dialog.current?.showModal();
  };

  if (kinds.length === 0) return null;
  return (
    <div className="quick-create">
      <button
        type="button"
        className="quick-create-button"
        aria-expanded={menuOpen}
        aria-controls="quick-create-menu"
        aria-keyshortcuts="N"
        onClick={() => setMenuOpen((open) => !open)}
      >
        <Plus size={18} aria-hidden="true" />
        {t("button")}
      </button>
      {menuOpen ? (
        <div
          id="quick-create-menu"
          className="quick-create-menu"
          role="group"
          aria-label={t("menuLabel")}
          onKeyDown={(event) => {
            if (event.key === "Escape") setMenuOpen(false);
          }}
        >
          <p className="quick-create-hint">{t("shortcutHint")}</p>
          {kinds.map((entry, index) => (
            <button key={entry} type="button" ref={index === 0 ? firstItem : undefined} onClick={() => choose(entry)}>
              {t(`kind.${entry}`)}
            </button>
          ))}
        </div>
      ) : null}
      <dialog ref={dialog} className="quick-create-dialog" aria-labelledby="quick-create-title" onClose={() => setKind(null)}>
        {kind ? (
          <>
            <div className="quick-create-head">
              <h2 id="quick-create-title">{t(`title.${kind}`)}</h2>
              <button type="button" className="button-ghost" onClick={() => dialog.current?.close()}>
                {t("close")}
              </button>
            </div>
            {options === undefined ? (
              <p role="status">{t("loading")}</p>
            ) : options === null ? (
              <p>{t("unavailable")}</p>
            ) : kind === "prospect" ? (
              <ProspectForm key={round} options={options} />
            ) : options.events.length === 0 ? (
              <p>{t("noEvents")}</p>
            ) : kind === "task" ? (
              <TaskForm key={round} options={options} />
            ) : kind === "expense" ? (
              <ExpenseForm key={round} options={options} />
            ) : (
              <QuoteForm key={round} options={options} />
            )}
          </>
        ) : null}
      </dialog>
    </div>
  );
}

function Outcome({ state }: { state: QuickCreateState }) {
  const t = useTranslations("QuickCreate");
  if (state.error) return <p role="alert">{state.error}</p>;
  if (!state.done) return null;
  return (
    <p role="status" className="quick-create-done">
      {state.done.message}{" "}
      <Link href={state.done.href}>{t("open")}</Link>
    </p>
  );
}

function EventSelect({ options, value, onChange }: { options: QuickCreateOptions; value?: string; onChange?: (eventId: string) => void }) {
  const t = useTranslations("QuickCreate");
  const locale = useLocale() as Locale;
  return (
    <label>
      {t("event")}
      <select
        name="eventId"
        required
        {...(onChange ? { value, onChange: (event) => onChange(event.target.value) } : { defaultValue: options.currentEventId ?? "" })}
      >
        <option value="" disabled>
          {t("eventChoose")}
        </option>
        {options.events.map((event) => (
          <option key={event.id} value={event.id}>
            {event.date ? `${event.names} — ${formatCalendarDate(event.date, locale)}` : event.names}
          </option>
        ))}
      </select>
    </label>
  );
}

function ProspectForm({ options }: { options: QuickCreateOptions }) {
  const t = useTranslations("QuickCreate");
  const [state, action, pending] = useActionState(quickCreateProspectAction, {});
  const [date, setDate] = useState("");
  return (
    <form action={action}>
      <label>
        {t("eventType")}
        <select name="eventTypeId" required defaultValue={options.eventTypes[0]?.id ?? ""}>
          {options.eventTypes.map((type) => (
            <option key={type.id} value={type.id}>
              {type.label}
            </option>
          ))}
        </select>
      </label>
      <label>
        {t("firstName")}
        <input type="text" name="firstName" required autoComplete="off" />
      </label>
      <label>
        {t("source")}
        <select name="prospectSourceId" required defaultValue="">
          <option value="" disabled>
            {t("sourceChoose")}
          </option>
          {options.sources.map((source) => (
            <option key={source.id} value={source.id}>
              {source.label}
            </option>
          ))}
        </select>
      </label>
      <label>
        {t("date")}
        <input type="date" name="eventDate" value={date} onChange={(event) => setDate(event.target.value)} />
      </label>
      <SameDayNotice date={date} />
      <button type="submit" disabled={pending}>
        {t("submit.prospect")}
      </button>
      <Outcome state={state} />
    </form>
  );
}

function TaskForm({ options }: { options: QuickCreateOptions }) {
  const t = useTranslations("QuickCreate");
  const [state, action, pending] = useActionState(quickCreateTaskAction, {});
  return (
    <form action={action}>
      <EventSelect options={options} />
      <label>
        {t("taskLabel")}
        <input type="text" name="label" required autoComplete="off" />
      </label>
      <label>
        {t("dueDate")}
        <input type="date" name="dueDate" required defaultValue={plusDays(parisToday(), 7)} />
      </label>
      <fieldset>
        <legend>{t("responsible")}</legend>
        <label>
          <input type="radio" name="responsible" value="planner" defaultChecked />
          {t("responsiblePlanner")}
        </label>
        <label>
          <input type="radio" name="responsible" value="clients" />
          {t("responsibleClients")}
        </label>
      </fieldset>
      <button type="submit" disabled={pending}>
        {t("submit.task")}
      </button>
      <Outcome state={state} />
    </form>
  );
}

function ExpenseForm({ options }: { options: QuickCreateOptions }) {
  const t = useTranslations("QuickCreate");
  const [state, action, pending] = useActionState(quickCreateExpenseAction, {});
  const [eventId, setEventId] = useState(options.currentEventId ?? "");
  const [slots, setSlots] = useState<{ eventId: string; slots: QuickSlot[] } | null>(null);
  const [slotId, setSlotId] = useState("");

  useEffect(() => {
    if (!eventId) return;
    let current = true;
    void quickCreateSlotsAction(eventId).then((loaded) => {
      if (current) setSlots({ eventId, slots: loaded });
    });
    return () => {
      current = false;
    };
  }, [eventId]);

  const shown = slots && slots.eventId === eventId ? slots.slots : null;
  const candidates = shown?.find((slot) => slot.id === slotId)?.candidates ?? [];
  return (
    <form action={action}>
      <EventSelect
        options={options}
        value={eventId}
        onChange={(next) => {
          setEventId(next);
          setSlotId("");
        }}
      />
      {eventId && shown === null ? <p role="status">{t("loading")}</p> : null}
      {shown && shown.length === 0 ? <p>{t("noSlots")}</p> : null}
      {shown && shown.length > 0 ? (
        <>
          <label>
            {t("slot")}
            <select name="eventVendorSlotId" required value={slotId} onChange={(event) => setSlotId(event.target.value)}>
              <option value="" disabled>
                {t("slotChoose")}
              </option>
              {shown.map((slot) => (
                <option key={slot.id} value={slot.id}>
                  {slot.label}
                </option>
              ))}
            </select>
          </label>
          {candidates.length > 0 ? (
            <label>
              {t("vendor")}
              <select name="vendorCandidateId" defaultValue="">
                <option value="">{t("vendorNone")}</option>
                {candidates.map((candidate) => (
                  <option key={candidate.id} value={candidate.id}>
                    {candidate.vendorName}
                  </option>
                ))}
              </select>
            </label>
          ) : null}
          <label>
            {t("expenseLabel")}
            <input type="text" name="label" required autoComplete="off" />
          </label>
          <label>
            {t("amount")}
            <input type="text" name="amount" inputMode="decimal" autoComplete="off" />
          </label>
          <button type="submit" disabled={pending}>
            {t("submit.expense")}
          </button>
        </>
      ) : null}
      <Outcome state={state} />
    </form>
  );
}

function QuoteForm({ options }: { options: QuickCreateOptions }) {
  const t = useTranslations("QuickCreate");
  const [state, action, pending] = useActionState(quickCreateQuoteAction, {});
  return (
    <form action={action}>
      <EventSelect options={options} />
      <p className="meta">{t("quoteHint")}</p>
      <button type="submit" disabled={pending}>
        {t("submit.quote")}
      </button>
      <Outcome state={state} />
    </form>
  );
}
