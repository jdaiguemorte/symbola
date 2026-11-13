"use client";

// Lot 30b (CHR-06, décision D8 ; UX-07) — après le changement de l'heure de début d'une
// séquence, la fiche propose de décaler d'autant les séquences suivantes, en un toucher ;
// « Annuler » reste possible dix secondes. La proposition vient de l'adresse
// (?decalage=…&depuis=…) ; une fois le décalage fait, elle en est retirée, pour qu'un
// rechargement ne décale pas deux fois. Le composant reste en place d'un rafraîchissement
// à l'autre : il garde ce qui a été fait.
import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { shiftProgramItemsAction } from "./program-actions";

const UNDO_SECONDS = 10;

export type ShiftProposalView = { minutes: number; itemIds: string[]; outOfDay: boolean; duration: string };

type Phase =
  | { kind: "proposed" }
  | { kind: "shifted"; proposal: ShiftProposalView; secondsLeft: number }
  | { kind: "kept"; proposal: ShiftProposalView }
  | { kind: "undone" };

export function ProgramShiftProposal({ eventId, proposal }: { eventId: string; proposal: ShiftProposalView | null }) {
  const t = useTranslations("Events");
  const [phase, setPhase] = useState<Phase>({ kind: "proposed" });
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const router = useRouter();
  // La proposition faite, l'adresse l'oublie : un rechargement ne décale pas deux fois.
  const forgetProposal = () => {
    const url = new URL(window.location.href);
    url.searchParams.delete("decalage");
    url.searchParams.delete("depuis");
    router.replace(`${url.pathname}${url.search}${url.hash}`, { scroll: false });
  };

  useEffect(() => {
    if (phase.kind !== "shifted") return;
    if (phase.secondsLeft <= 0) {
      setPhase({ kind: "kept", proposal: phase.proposal });
      return;
    }
    const timer = setTimeout(() => setPhase({ ...phase, secondsLeft: phase.secondsLeft - 1 }), 1000);
    return () => clearTimeout(timer);
  }, [phase]);

  const shift = (view: ShiftProposalView) =>
    startTransition(async () => {
      setError(null);
      const result = await shiftProgramItemsAction({ eventId, itemIds: view.itemIds, minutes: view.minutes });
      if (!result.ok) return setError(result.error);
      forgetProposal();
      setPhase({ kind: "shifted", proposal: view, secondsLeft: UNDO_SECONDS });
    });

  const undo = (view: ShiftProposalView) =>
    startTransition(async () => {
      setError(null);
      const result = await shiftProgramItemsAction({ eventId, itemIds: view.itemIds, minutes: -view.minutes });
      if (!result.ok) return setError(result.error);
      setPhase({ kind: "undone" });
    });

  const words = (view: ShiftProposalView) => ({ count: view.itemIds.length, duration: view.duration });

  if (phase.kind === "proposed") {
    if (!proposal) return null;
    if (proposal.outOfDay) {
      return (
        <p role="status" className="program-shift">
          {t("programShiftOutOfDay")}
        </p>
      );
    }
    return (
      <div className="program-shift">
        <button type="button" className="primary" onClick={() => shift(proposal)} disabled={pending}>
          {t(proposal.minutes > 0 ? "programShiftLater" : "programShiftEarlier", words(proposal))}
        </button>
        {error ? <p role="alert">{error}</p> : null}
      </div>
    );
  }
  return (
    <div className="program-shift">
      {phase.kind === "undone" ? (
        <p role="status">{t("programShiftUndone")}</p>
      ) : (
        <p role="status">{t(phase.proposal.minutes > 0 ? "programShiftedLater" : "programShiftedEarlier", words(phase.proposal))}</p>
      )}
      {phase.kind === "shifted" ? (
        <button type="button" onClick={() => undo(phase.proposal)} disabled={pending}>
          {t("programShiftUndo", { seconds: phase.secondsLeft })}
        </button>
      ) : null}
      {error ? <p role="alert">{error}</p> : null}
    </div>
  );
}
