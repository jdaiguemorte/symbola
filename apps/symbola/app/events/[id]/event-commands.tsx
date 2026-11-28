"use client";

// Lot 72d (EVT-02, EVT-05, UX-07 ; C-22, C-80 ; E4, M6, S8 ; page 15 des maquettes du lot 68) — le menu
// « ⋯ » de la fiche d'un évènement, le même depuis l'en-tête et depuis la barre fine : « Écrire aux
// mariés » (quand « Ouvrir le Jour J » a pris sa place, et toujours sur téléphone, où l'en-tête n'a pas de
// bouton), « Messages », « Voir comme … », « Ouvrir le Jour J », « Changer le type… », puis, après un filet,
// « Reporter l'évènement… » et « Annuler l'évènement… », en rouge et en dernier. Chaque ligne dit ce
// qu'elle fait. Reporter et Annuler sont des fenêtres de niveau 2 (lot 70b) : elles nomment l'évènement et
// proposent « Garder … ». Le menu et ses fenêtres ne sont montés qu'une fois : les deux boutons « ⋯ »
// l'ouvrent sous eux ; sur téléphone, il s'ouvre en panneau du bas, le nom du mariage en tête.
import Link from "next/link";
import { createContext, useActionState, useContext, useEffect, useId, useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { ConfirmDialog } from "@/app/ui/confirm-dialog";
import { useFeedback } from "@/app/ui/feedback";
import { FreeTextNotice } from "@/app/ui/free-text-notice";
import { RequiredLegend, RequiredMark } from "@/app/ui/required-mark";
import { TaskPopover, usePopover } from "@/app/ui/task-popover";
import { cancelEventAction, changeEventTypeAction, postponeEventAction, type ChangeStatusFormState, type EventTypeState } from "./actions";
import type { LossReason } from "@/modules/events/service";

type Command = { href: string; label: string };

export type EventCommandsProps = {
  eventId: string;
  names: string;
  // L'action de l'en-tête : celle qui est montrée en bouton à l'ordinateur.
  headerAction: "write" | "day_of" | null;
  write: Command | null;
  dayOf: Command | null;
  messages: Command;
  viewAs: Command | null;
  // Archivé : lecture seule, ni type, ni report, ni annulation.
  types: { current: string | null; options: { id: string; label: string }[] } | null;
  canPostpone: boolean;
  canCancel: boolean;
  reasons: LossReason[];
  // Lot 72e (C-26) : « Modifier les informations », aussi depuis le menu ; et la fenêtre du report ouverte à
  // l'arrivée (« Reporter l'évènement… » de la fenêtre des informations, qui se ferme d'abord), puis
  // l'adresse rendue sans ce paramètre.
  editInfo?: (Command & { hint: string }) | null;
  openPostpone?: { cleanHref: string } | null;
};

const MenuContext = createContext<{ open: (anchor: HTMLElement | null) => void; label: string } | null>(null);

// Les flèches passent d'un choix du menu à l'autre (motif du menu de DESIGN.md).
function moveFocus(event: KeyboardEvent<HTMLElement>) {
  if (event.key !== "ArrowDown" && event.key !== "ArrowUp") return;
  const items = [...event.currentTarget.querySelectorAll<HTMLElement>("[role=menuitem]")].filter((item) => item.offsetParent !== null);
  const index = items.indexOf(document.activeElement as HTMLElement);
  const next = items[(index + (event.key === "ArrowDown" ? 1 : items.length - 1)) % items.length];
  next?.focus();
  event.preventDefault();
}

export function EventCommands({ children, ...props }: EventCommandsProps & { children: ReactNode }) {
  const t = useTranslations("EventHeader");
  const tEvents = useTranslations("Events");
  const tCommon = useTranslations("Common");
  const router = useRouter();
  const feedback = useFeedback();
  const menu = usePopover();
  const anchor = useRef<HTMLElement | null>(null);
  const postponeRef = useRef<HTMLDialogElement>(null);
  const cancelRef = useRef<HTMLDialogElement>(null);
  const typeRef = useRef<HTMLDialogElement>(null);
  const typeTitleId = useId();
  const [postponeState, postponeAction, postponing] = useActionState<ChangeStatusFormState, FormData>(postponeEventAction, {});
  const [cancelState, cancelAction, cancelling] = useActionState<ChangeStatusFormState, FormData>(cancelEventAction, {});
  const [typeState, typeAction, typing] = useActionState<EventTypeState, FormData>(changeEventTypeAction, {});
  const [undecided, setUndecided] = useState(false);
  const [lossReasonId, setLossReasonId] = useState("");
  const [lossReasonNote, setLossReasonNote] = useState("");
  const [typeChoice, setTypeChoice] = useState(props.types?.current ?? "");
  const reason = props.reasons.find((candidate) => candidate.id === lossReasonId);
  const label = t("menuLabel", { names: props.names });

  // Le focus revient au bouton « ⋯ » qui a ouvert le menu, une fois la fenêtre fermée.
  const backToAnchor = () => {
    if (anchor.current?.isConnected) anchor.current.focus();
  };

  // Chaque changement est dit dans le message de retour (lot 70b) ; la fenêtre se ferme.
  const announced = useRef<object | null>(null);
  useEffect(() => {
    const changes: [object & { success?: boolean }, () => { title: string }, HTMLDialogElement | null][] = [
      [postponeState, () => ({ title: tEvents("statusPostponedMessage", { names: props.names }) }), postponeRef.current],
      [cancelState, () => ({ title: tEvents("statusCancelledMessage", { names: props.names }) }), cancelRef.current],
      [typeState, () => ({ title: t("typeSaved", { type: props.types?.options.find((option) => option.id === typeChoice)?.label ?? "" }) }), typeRef.current],
    ];
    for (const [changed, message, dialog] of changes) {
      if (changed.success && announced.current !== changed) {
        announced.current = changed;
        dialog?.close();
        feedback?.show(message());
        router.refresh();
      }
    }
  }, [postponeState, cancelState, typeState, feedback, props.names, props.types, typeChoice, t, tEvents, router]);

  const openPostpone = props.openPostpone;
  useEffect(() => {
    if (!openPostpone || !props.canPostpone) return;
    if (!postponeRef.current?.open) postponeRef.current?.showModal();
    router.replace(openPostpone.cleanHref, { scroll: false });
  }, [openPostpone, props.canPostpone, router]);

  const open = (element: HTMLElement | null) => {
    anchor.current = element;
    menu.open(element);
    // Le premier choix visible reçoit le focus (« Écrire aux mariés » n'est visible que sur téléphone).
    const first = [...(menu.ref.current?.querySelectorAll<HTMLElement>("[role=menuitem]") ?? [])].find((item) => item.offsetParent !== null);
    first?.focus();
  };
  const choose = (dialog: HTMLDialogElement | null) => {
    menu.close();
    dialog?.showModal();
  };

  const headerIsWrite = props.headerAction === "write";

  return (
    <MenuContext.Provider value={{ open, label }}>
      {children}
      <TaskPopover handle={menu} label={label} className="task-menu event-menu">
        <p className="event-menu-title">{props.names}</p>
        <div role="menu" aria-label={label} onKeyDown={moveFocus}>
          {props.write ? (
            // À l'ordinateur, « Écrire aux mariés » est dans l'en-tête tant que « Ouvrir le Jour J » n'y est pas.
            <Link role="menuitem" href={props.write.href} className={headerIsWrite ? "event-menu-phone-only" : undefined} onClick={() => menu.close()}>
              <span>{props.write.label}</span>
              <span className="task-menu-hint">{t("writeHint")}</span>
            </Link>
          ) : null}
          <Link role="menuitem" href={props.messages.href} onClick={() => menu.close()}>
            <span>{props.messages.label}</span>
            <span className="task-menu-hint">{t("messagesHint")}</span>
          </Link>
          {props.viewAs ? (
            <Link role="menuitem" href={props.viewAs.href} onClick={() => menu.close()}>
              <span>{props.viewAs.label}</span>
              <span className="task-menu-hint">{t("viewAsHint")}</span>
            </Link>
          ) : null}
          {props.dayOf ? (
            // L'écran du jour J est servi hors de l'app (service worker) : un lien plein, pas une navigation client.
            <a role="menuitem" href={props.dayOf.href} onClick={() => menu.close()}>
              <span>{props.dayOf.label}</span>
              <span className="task-menu-hint">{t("openDayOfHint")}</span>
            </a>
          ) : null}
          {props.editInfo ? (
            <Link role="menuitem" href={props.editInfo.href} scroll={false} onClick={() => menu.close()}>
              <span>{props.editInfo.label}</span>
              <span className="task-menu-hint">{props.editInfo.hint}</span>
            </Link>
          ) : null}
          {props.types ? (
            <button type="button" role="menuitem" aria-haspopup="dialog" onClick={() => choose(typeRef.current)}>
              <span>{t("changeType")}</span>
              <span className="task-menu-hint">{props.types.options.find((option) => option.id === props.types?.current)?.label ?? tEvents("eventTypeNone")}</span>
            </button>
          ) : null}
          {props.canPostpone || props.canCancel ? <hr className="task-menu-separator" /> : null}
          {props.canPostpone ? (
            <button type="button" role="menuitem" aria-haspopup="dialog" onClick={() => choose(postponeRef.current)}>
              <span>{t("postpone")}</span>
              <span className="task-menu-hint">{t("postponeHint")}</span>
            </button>
          ) : null}
          {props.canCancel ? (
            <button type="button" role="menuitem" aria-haspopup="dialog" className="task-menu-danger" onClick={() => choose(cancelRef.current)}>
              <span>{t("cancel")}</span>
              <span className="task-menu-hint">{t("cancelHint")}</span>
            </button>
          ) : null}
        </div>
      </TaskPopover>

      {props.canPostpone ? (
        <ConfirmDialog
          hideTrigger
          dialogRef={postponeRef}
          onClosed={backToAnchor}
          level={2}
          trigger={null}
          triggerLabel={t("postpone")}
          title={tEvents("postponeTitle", { names: props.names })}
          body={tEvents("postponeBody")}
          confirmLabel={tEvents("confirmPostpone")}
          keepLabel={tEvents("keepDate")}
          action={postponeAction}
          pending={postponing}
          fields={{ eventId: props.eventId }}
        >
          <label>
            {tEvents("postponeNewDate")}
            <input type="date" name="newDate" disabled={undecided} />
          </label>
          <label className="choice-item">
            <input type="checkbox" name="undecided" value="1" checked={undecided} onChange={(event) => setUndecided(event.target.checked)} />
            <span>{tEvents("postponeUndecided")}</span>
          </label>
          <p className="muted">{tEvents("postponeHint")}</p>
          {postponeState.error ? <p role="alert">{postponeState.error}</p> : null}
        </ConfirmDialog>
      ) : null}

      {props.canCancel ? (
        <ConfirmDialog
          hideTrigger
          dialogRef={cancelRef}
          onClosed={backToAnchor}
          level={2}
          trigger={null}
          triggerLabel={t("cancel")}
          title={tEvents("cancelTitle", { names: props.names })}
          body={tEvents("cancelBody")}
          confirmLabel={tEvents("confirmCancel")}
          keepLabel={tEvents("keepEvent")}
          action={cancelAction}
          pending={cancelling}
          fields={{ eventId: props.eventId }}
        >
          <ul className="confirm-dialog-consequences">
            <li>{tEvents("cancelRestore")}</li>
            <li>{tEvents("cancelLinks")}</li>
            <li>{tEvents("cancelReminders")}</li>
            <li>{tEvents("cancelInvoices")}</li>
            <li>{tEvents("cancelNobody")}</li>
          </ul>
          <label>
            {tEvents("cancelReason")}
            <RequiredMark />
            <select name="lossReasonId" value={lossReasonId} onChange={(event) => setLossReasonId(event.target.value)} required>
              <option value="">{tEvents("sourceChoose")}</option>
              {props.reasons.map((option) => (
                <option key={option.id} value={option.id}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
          {reason?.isFreeText ? (
            <>
              <label>
                {tEvents("lossReasonNote")}
                <RequiredMark />
                <textarea name="lossReasonNote" value={lossReasonNote} onChange={(event) => setLossReasonNote(event.target.value)} required />
              </label>
              <FreeTextNotice />
            </>
          ) : null}
          <RequiredLegend text={tCommon("requiredLegend")} />
          {cancelState.error ? <p role="alert">{cancelState.error}</p> : null}
        </ConfirmDialog>
      ) : null}

      {props.types ? (
        // « Changer le type… » : une fenêtre courte, un choix, « Enregistrer » (même règle qu'avant, lot 16).
        <dialog ref={typeRef} className="confirm-dialog window-short" aria-labelledby={typeTitleId} onClose={backToAnchor}>
          <h2 id={typeTitleId}>{t("typeTitle", { names: props.names })}</h2>
          <p>{t("typeIntro")}</p>
          <form action={typeAction} className="confirm-dialog-form" noValidate>
            <input type="hidden" name="eventId" value={props.eventId} />
            <label>
              {t("typeLabel")}
              <select name="eventTypeId" value={typeChoice} onChange={(event) => setTypeChoice(event.target.value)}>
                {props.types.current ? null : (
                  <option value="" disabled>
                    {tEvents("eventTypeNone")}
                  </option>
                )}
                {props.types.options.map((option) => (
                  <option key={option.id} value={option.id}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
            {typeState.error ? <p role="alert">{typeState.error}</p> : null}
            <div className="confirm-dialog-actions">
              <button type="button" onClick={() => typeRef.current?.close()}>
                {t("typeClose")}
              </button>
              <button type="submit" className="button-primary" disabled={typing}>
                {t("typeSave")}
              </button>
            </div>
          </form>
        </dialog>
      ) : null}
    </MenuContext.Provider>
  );
}

// Le bouton « ⋯ » : dans l'en-tête et dans la barre fine ; les deux ouvrent le même menu, sous eux.
export function EventMenuButton({ className }: { className?: string }) {
  const context = useContext(MenuContext);
  const ref = useRef<HTMLButtonElement>(null);
  if (!context) return null;
  return (
    <button ref={ref} type="button" className={`task-menu-button event-menu-button${className ? ` ${className}` : ""}`} aria-haspopup="menu" aria-label={context.label} onClick={() => context.open(ref.current)}>
      <span aria-hidden="true">⋯</span>
    </button>
  );
}
