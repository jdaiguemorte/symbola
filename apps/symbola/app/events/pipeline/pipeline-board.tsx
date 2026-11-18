"use client";

// Lot 44 (CRM-02 ; D9 à D11, D0 ; ADR 0084) — le tableau du pipeline. Une colonne par étape, puis les
// deux sorties. Déplacer une carte : le bouton « Déplacer » et la liste des étapes (clavier, lecteur
// d'écran, doigt), ou le glisser-déposer à la souris — composant commun app/ui/move-to-group.tsx.
// Chaque déplacement est annoncé ; le serveur fait foi. « Gagné » demande une confirmation, « Perdu »
// le motif de perte. À 375 px (D10) : une étape à la fois, choisie par ses onglets (nombre de cartes).
import Link from "next/link";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { FreeTextNotice } from "@/app/ui/free-text-notice";
import { MoveAnnouncement, MoveToGroupButton, useMoveToGroup, type MovableItem } from "@/app/ui/move-to-group";
import { loseCardAction, moveCardAction, winCardAction } from "./actions";
import { noteAnsweredAction } from "../[id]/ecrire/actions";

// Lot 45 (CRM-06, D3) : « A répondu », d'un geste depuis la carte ; les relances en attente s'arrêtent.
function AnsweredButton({ eventId, label, done }: { eventId: string; label: string; done: string }) {
  const [noted, setNoted] = useState(false);
  return noted ? (
    <span role="status" className="meta">
      {done}
    </span>
  ) : (
    <button type="button" className="button-ghost" onClick={async () => setNoted(await noteAnsweredAction(eventId))}>
      {label}
    </button>
  );
}

export type BoardCard = MovableItem & {
  when: string | null;
  guests: number | null;
  budget: string | null;
  source: string | null;
  daysInStage: number;
  dateTaken: boolean;
  isDemo: boolean;
};

type Stage = { id: string; label: string };
type LossReason = { id: string; label: string; isFreeText: boolean };
type Exit = { kind: "won" | "lost"; card: BoardCard; resolve: (saved: boolean) => void };

const WON = "won";
const LOST = "lost";

function focusCard(cardId: string) {
  window.setTimeout(() => {
    document.querySelector<HTMLElement>(`[data-move-item="${CSS.escape(cardId)}"] [data-move-button]`)?.focus();
  }, 50);
}

export function PipelineBoard({ stages, cards, lossReasons }: { stages: Stage[]; cards: BoardCard[]; lossReasons: LossReason[] }) {
  const t = useTranslations("Pipeline");
  const router = useRouter();
  const [exit, setExit] = useState<Exit | null>(null);
  const [active, setActive] = useState(stages[0]?.id ?? "");
  const targets = [...stages, { id: WON, label: t("won") }, { id: LOST, label: t("lost") }];

  const board = useMoveToGroup({
    items: cards,
    targets,
    onMove: async (cardId, groupId) => {
      const card = cards.find((candidate) => candidate.id === cardId);
      if (!card) return false;
      if (groupId === WON || groupId === LOST) {
        const saved = await new Promise<boolean>((resolve) => setExit({ kind: groupId, card, resolve }));
        if (saved) router.refresh();
        else focusCard(cardId);
        return saved;
      }
      const saved = await moveCardAction(cardId, groupId);
      if (saved) router.refresh();
      return saved;
    },
  });

  const column = (stage: Stage, exitColumn: boolean) => {
    const items = board.itemsIn(stage.id) as BoardCard[];
    const titleId = `pipeline-column-${stage.id}`;
    return (
      <section
        key={stage.id}
        aria-labelledby={titleId}
        className={exitColumn ? "pipeline-column pipeline-exit" : "pipeline-column"}
        data-active={exitColumn ? undefined : String(active === stage.id)}
        {...board.dropProps(stage.id)}
      >
        <h2 id={titleId} className="pipeline-column-title">
          {stage.label} <span className="nav-count">{items.length}</span>
        </h2>
        {items.length === 0 ? <p className="meta">{exitColumn ? t(stage.id === WON ? "wonHint" : "lostHint") : t("emptyStage")}</p> : null}
        <ul className="pipeline-cards">
          {items.map((card) => (
            <li key={card.id}>
              <article className="pipeline-card" data-move-item={card.id} {...board.dragProps(card.id)} aria-labelledby={`card-${card.id}`}>
                <h3 id={`card-${card.id}`} className="pipeline-card-title">
                  <Link href={`/events/${card.id}`}>{card.label}</Link>
                </h3>
                <p className="meta">{card.when ?? t("noDate")}</p>
                {card.dateTaken ? <p className="badge badge-terracotta">{t("dateTaken")}</p> : null}
                {card.isDemo ? <p className="badge">{t("demo")}</p> : null}
                <dl className="pipeline-card-details">
                  {card.guests !== null ? (
                    <div>
                      <dt>{t("guests")}</dt>
                      <dd>{card.guests}</dd>
                    </div>
                  ) : null}
                  {card.budget ? (
                    <div>
                      <dt>{t("budget")}</dt>
                      <dd>{card.budget}</dd>
                    </div>
                  ) : null}
                  {card.source ? (
                    <div>
                      <dt>{t("source")}</dt>
                      <dd>{card.source}</dd>
                    </div>
                  ) : null}
                  <div>
                    <dt>{t("inStage")}</dt>
                    <dd>{t("days", { count: card.daysInStage })}</dd>
                  </div>
                </dl>
                {/* Lot 45 (CRM-05, CRM-06) : répondre en un clic depuis un modèle ; noter « a répondu ». */}
                {!card.isDemo ? (
                  <div className="row-wrap pipeline-card-actions">
                    <Link href={`/events/${card.id}/ecrire`} className="button-link">
                      {t("reply")}
                    </Link>
                    <AnsweredButton eventId={card.id} label={t("answered")} done={t("answeredDone")} />
                  </div>
                ) : null}
                <MoveToGroupButton
                  itemLabel={card.label}
                  currentGroupId={board.groupOf(card.id)}
                  targets={targets}
                  onChoose={(groupId) => {
                    // À 375 px, l'onglet suit la carte : elle reste visible et garde le focus.
                    if (stages.some((candidate) => candidate.id === groupId)) setActive(groupId);
                    board.move(card.id, groupId);
                  }}
                />
              </article>
            </li>
          ))}
        </ul>
      </section>
    );
  };

  return (
    <div className="pipeline">
      {/* D10 : à 375 px, une étape à la fois ; les onglets donnent le nombre de cartes. */}
      <div className="pipeline-tabs" role="group" aria-label={t("stagesLabel")}>
        {stages.map((stage) => (
          <button key={stage.id} type="button" aria-pressed={active === stage.id} onClick={() => setActive(stage.id)}>
            {stage.label} <span className="nav-count">{board.itemsIn(stage.id).length}</span>
          </button>
        ))}
      </div>
      <div className="pipeline-board">
        {stages.map((stage) => column(stage, false))}
        {column({ id: WON, label: t("won") }, true)}
        {column({ id: LOST, label: t("lost") }, true)}
      </div>
      <MoveAnnouncement text={board.announcement} />
      {exit ? (
        <ExitDialog
          exit={exit}
          lossReasons={lossReasons}
          onClose={(saved) => {
            exit.resolve(saved);
            setExit(null);
          }}
        />
      ) : null}
    </div>
  );
}

// « Gagné » : confirmation ; « Perdu » : motif obligatoire (liste de l'organisation), note facultative
// (obligatoire pour le motif « Autre »). Fenêtre native : focus gardé dedans, Échap pour annuler.
function ExitDialog({ exit, lossReasons, onClose }: { exit: Exit; lossReasons: LossReason[]; onClose: (saved: boolean) => void }) {
  const t = useTranslations("Pipeline");
  const dialog = useRef<HTMLDialogElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [reasonId, setReasonId] = useState("");
  const done = useRef(false);

  useEffect(() => {
    dialog.current?.showModal();
  }, []);

  function close(saved: boolean) {
    if (done.current) return;
    done.current = true;
    dialog.current?.close();
    onClose(saved);
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError(null);
    const data = new FormData(event.currentTarget);
    const result = exit.kind === "won" ? await winCardAction(exit.card.id) : await loseCardAction(exit.card.id, String(data.get("lossReasonId") ?? ""), String(data.get("lossReasonNote") ?? ""));
    setPending(false);
    if (result.ok) close(true);
    else setError(result.error);
  }

  const freeText = lossReasons.find((reason) => reason.id === reasonId)?.isFreeText ?? false;
  return (
    <dialog
      ref={dialog}
      className="confirm-dialog"
      aria-labelledby="pipeline-exit-title"
      aria-describedby="pipeline-exit-body"
      onCancel={(event) => {
        event.preventDefault();
        close(false);
      }}
    >
      <h2 id="pipeline-exit-title">{t(exit.kind === "won" ? "wonTitle" : "lostTitle", { name: exit.card.label })}</h2>
      <p id="pipeline-exit-body">{t(exit.kind === "won" ? "wonBody" : "lostBody")}</p>
      <form onSubmit={submit} className="stack">
        {exit.kind === "lost" ? (
          <>
            <label>
              {t("lossReason")}
              <select name="lossReasonId" required value={reasonId} onChange={(event) => setReasonId(event.target.value)}>
                <option value="">{t("chooseReason")}</option>
                {lossReasons.map((reason) => (
                  <option key={reason.id} value={reason.id}>
                    {reason.label}
                  </option>
                ))}
              </select>
            </label>
            <label>
              {freeText ? t("lossNoteRequiredLabel") : t("lossNote")}
              <textarea name="lossReasonNote" rows={3} maxLength={1000} required={freeText} />
            </label>
            <FreeTextNotice />
          </>
        ) : null}
        {error ? <p role="alert">{error}</p> : null}
        <div className="confirm-dialog-actions">
          <button type="button" autoFocus onClick={() => close(false)}>
            {t("cancel")}
          </button>
          <button type="submit" className="confirm-dialog-confirm" disabled={pending}>
            {t(exit.kind === "won" ? "confirmWon" : "confirmLost")}
          </button>
        </div>
      </form>
    </dialog>
  );
}
