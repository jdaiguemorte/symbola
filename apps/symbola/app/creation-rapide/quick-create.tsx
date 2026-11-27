"use client";

// Lot 32b (HUB-07, UX-03 ; décision D9) — « + Créer » dans la barre du haut de chaque écran, et la
// touche N hors d'un champ. Lot 70e (M7, A12) : six entrées dans l'ordre de la journée, chacune avec sa
// phrase (évènement, tâche, prestataire, contact, devis, dépense) ; tâche, devis et dépense en formulaire
// court dans une fenêtre, les trois autres mènent à leur écran. Le mariage de l'écran en cours est dit
// (« Tâche pour Léa & Maxime »). Les entrées suivent les modules souscrits (ARC-06).
import Link from "next/link";
import { Plus } from "lucide-react";
import { useActionState, useEffect, useId, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { formatCalendarDate, parisToday, type Locale } from "@symbola/i18n";
import { SameDayNotice } from "@/app/events/same-day-notice";
import {
  quickCreateExpenseAction,
  quickCreateOptionsAction,
  quickCreateQuoteAction,
  quickCreateSlotsAction,
  quickCreateTaskAction,
  type QuickCreateOptions,
  type QuickCreateState,
  type QuickSlot,
} from "./actions";
import { quickCreateEntries, type QuickModules } from "./entries";

type Kind = "task" | "expense" | "quote";

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
  const root = useRef<HTMLDivElement>(null);
  const button = useRef<HTMLButtonElement>(null);
  const menuId = useId();
  const entries = quickCreateEntries(modules);
  // Le mariage de l'écran en cours, dit dans les entrées qui le suivent (« Tâche pour Léa & Maxime »).
  const currentEvent = options?.currentEventId ? options.events.find((event) => event.id === options.currentEventId) : undefined;

  // Ouverture : le focus va à la première entrée ; Échap et un clic ailleurs ferment, le focus revient
  // au bouton.
  useEffect(() => {
    if (!menuOpen) return;
    root.current?.querySelector<HTMLElement>(".quick-create-menu a, .quick-create-menu button")?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      setMenuOpen(false);
      button.current?.focus();
    };
    const onPointer = (event: PointerEvent) => {
      if (!root.current?.contains(event.target as Node)) setMenuOpen(false);
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("pointerdown", onPointer);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("pointerdown", onPointer);
    };
  }, [menuOpen]);

  // Lot 67c (HUB-07) : « Ouvrir » mène à ce qui vient d'être créé ; la fenêtre se ferme à l'arrivée,
  // au lieu de rester ouverte par-dessus la page.
  useEffect(() => {
    if (dialog.current?.open) dialog.current.close();
  }, [pathname]);

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

  return (
    <div className="quick-create" ref={root}>
      <button
        ref={button}
        type="button"
        className="quick-create-button button-secondary"
        aria-expanded={menuOpen}
        aria-controls={menuId}
        aria-keyshortcuts="N"
        onClick={() => setMenuOpen((open) => !open)}
      >
        <Plus size={18} aria-hidden="true" />
        {t("button")}
      </button>
      {menuOpen ? (
        <div id={menuId} className="quick-create-menu" role="group" aria-label={t("menuLabel")}>
          {entries.map((entry) => {
            const title = entry.contextual && currentEvent && entry.key !== "event" ? t(`kind.${entry.key}For`, { event: currentEvent.names }) : t(`kind.${entry.key}`);
            const body = (
              <>
                <strong>{title}</strong>
                <span className="meta">{t(`hint.${entry.key}`)}</span>
              </>
            );
            return entry.action === "link" ? (
              <Link key={entry.key} href={entry.href!} className="quick-create-item" onClick={() => setMenuOpen(false)}>
                {body}
              </Link>
            ) : (
              <button key={entry.key} type="button" className="quick-create-item" onClick={() => choose(entry.key as Kind)}>
                {body}
              </button>
            );
          })}
          <p className="quick-create-hint">{t("shortcutHint")}</p>
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
            ) : kind === "quote" ? (
              <QuoteForm key={round} options={options} />
            ) : kind === "task" ? (
              <TaskForm key={round} options={options} />
            ) : options.events.length === 0 ? (
              <p>{t("noEvents")}</p>
            ) : (
              <ExpenseForm key={round} options={options} />
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

function EventSelect({ options, value, onChange, optional = false }: { options: QuickCreateOptions; value?: string; onChange?: (eventId: string) => void; optional?: boolean }) {
  const t = useTranslations("QuickCreate");
  const locale = useLocale() as Locale;
  return (
    <label>
      {t("event")}
      <select
        name="eventId"
        required={!optional}
        {...(onChange ? { value, onChange: (event) => onChange(event.target.value) } : { defaultValue: options.currentEventId ?? "" })}
      >
        {optional ? (
          <option value="">{t("noEvent")}</option>
        ) : (
          <option value="" disabled>
            {t("eventChoose")}
          </option>
        )}
        {options.events.map((event) => (
          <option key={event.id} value={event.id}>
            {event.date ? `${event.names} — ${formatCalendarDate(event.date, locale)}` : event.names}
          </option>
        ))}
      </select>
    </label>
  );
}

// Les champs d'un prospect : type d'évènement, prénom, source, date facultative. Partagés par
// « Prospect » et « Devis pour un nouveau prospect » (lot 67c).
function ProspectFields({ options }: { options: QuickCreateOptions }) {
  const t = useTranslations("QuickCreate");
  const [date, setDate] = useState("");
  return (
    <>
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
    </>
  );
}

function TaskForm({ options }: { options: QuickCreateOptions }) {
  const t = useTranslations("QuickCreate");
  const [state, action, pending] = useActionState(quickCreateTaskAction, {});
  return (
    <form action={action}>
      <EventSelect options={options} optional />
      <p className="meta">{t("noEventHint")}</p>
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
          {/* Lot 70a (A3) : « planner » sans personne nommée = la personne qui crée (« Vous »). */}
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
  const hasEvents = options.events.length > 0;
  const [target, setTarget] = useState<"event" | "prospect">(hasEvents ? "event" : "prospect");
  return (
    <form action={action}>
      {/* Lot 67c (HUB-07, FAC-01 ; R05) : pour un évènement existant, ou pour un nouveau prospect. */}
      <fieldset>
        <legend>{t("quoteFor")}</legend>
        <label>
          <input type="radio" name="for" value="event" checked={target === "event"} disabled={!hasEvents} onChange={() => setTarget("event")} />
          {t("quoteForEvent")}
        </label>
        <label>
          <input type="radio" name="for" value="prospect" checked={target === "prospect"} onChange={() => setTarget("prospect")} />
          {t("quoteForProspect")}
        </label>
      </fieldset>
      {target === "event" ? <EventSelect options={options} /> : <ProspectFields options={options} />}
      <p className="meta">{t(target === "event" ? "quoteHint" : "quoteHintProspect")}</p>
      <button type="submit" disabled={pending}>
        {t("submit.quote")}
      </button>
      <Outcome state={state} />
    </form>
  );
}
