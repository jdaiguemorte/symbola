"use client";

// Lot 20 (L20-PRE-17) — une action lourde se confirme dans une fenêtre qui nomme ce qui va changer.
// La fenêtre est un <dialog> natif : focus gardé dedans, Échap pour renoncer.
// Lot 63g (ADR 0108) : une confirmation sans danger (tone « primary », bouton principal) et un détail
// sous le texte (montants, ce que voit l'équipe Symbola).
// Lot 70b (UX-07, HUB-17, EVT-05 ; M6, C-08, C-87 ; page 4 des maquettes du lot 68) — le danger à la
// mesure du risque. Le niveau 1 (ce qui se défait) ne passe pas par ici : l'action part, avec
// « Annuler » dans le message de retour. Niveau 2 (touche des tiers) : la question nomme l'objet, la
// conséquence suit, on renonce par un bouton nommé (« Garder l'évènement »), placé avant le bouton de
// danger (sur téléphone, la fenêtre prend la page et « Garder … » est le plus bas, près du pouce).
// Niveau 3 (ne se défait pas) : en plus, une case « Je comprends que … » à cocher avant que le bouton
// de danger réponde. « Annuler » seul n'y figure jamais : il ne sert qu'à défaire.
import { useId, useRef, useState, type ReactNode, type RefObject } from "react";

export type DangerLevel = 2 | 3;

export function ConfirmDialog({
  trigger,
  triggerLabel,
  triggerClassName,
  title,
  body,
  confirmLabel,
  keepLabel,
  acknowledgeLabel,
  action,
  fields,
  tone = "danger",
  confirmClassName,
  level = 2,
  pending = false,
  triggerDisabled = false,
  dialogRef: externalRef,
  hideTrigger = false,
  onClosed,
  children,
}: {
  trigger: ReactNode;
  // Libellé accessible du bouton qui ouvre la fenêtre (le texte visible peut être court).
  triggerLabel: string;
  triggerClassName?: string;
  title: string;
  body: string;
  confirmLabel: string;
  // Le renoncement, nommé : « Garder l'évènement », « Garder dans la Corbeille ».
  keepLabel: string;
  // Niveau 3 : « Je comprends que … ne pourra pas être récupéré ».
  acknowledgeLabel?: string | undefined;
  action: (formData: FormData) => void | Promise<void>;
  fields: Record<string, string>;
  tone?: "danger" | "primary";
  // Lot 71e : une confirmation sans danger dont l'action est la voie la moins sûre (« Diffuser quand même »),
  // en bouton secondaire.
  confirmClassName?: string;
  level?: DangerLevel;
  // L'action part (useActionState) : le bouton de danger attend sa réponse.
  pending?: boolean;
  triggerDisabled?: boolean;
  // Lot 72d : la fenêtre s'ouvre d'ailleurs (le menu « ⋯ » de l'en-tête) ; sans bouton à elle, le focus
  // revient où l'appelant le dit (onClosed).
  dialogRef?: RefObject<HTMLDialogElement | null>;
  hideTrigger?: boolean;
  onClosed?: () => void;
  children?: ReactNode;
}) {
  const ownRef = useRef<HTMLDialogElement>(null);
  const dialogRef = externalRef ?? ownRef;
  const titleId = useId();
  const bodyId = useId();
  const [acknowledged, setAcknowledged] = useState(false);
  const needsAcknowledgement = tone === "danger" && level === 3 && Boolean(acknowledgeLabel);
  const close = () => {
    setAcknowledged(false);
    dialogRef.current?.close();
  };
  return (
    <>
      {hideTrigger ? null : (
        <button type="button" className={triggerClassName} aria-label={triggerLabel} aria-haspopup="dialog" disabled={triggerDisabled} onClick={() => dialogRef.current?.showModal()}>
          {trigger}
        </button>
      )}
      <dialog
        ref={dialogRef}
        className={tone === "danger" ? "confirm-dialog confirm-dialog-danger" : "confirm-dialog"}
        data-danger-level={tone === "danger" ? String(level) : undefined}
        aria-labelledby={titleId}
        aria-describedby={bodyId}
        onClose={() => {
          setAcknowledged(false);
          onClosed?.();
        }}
      >
        <h2 id={titleId}>{title}</h2>
        <p id={bodyId}>{body}</p>
        <form action={action} className="confirm-dialog-form" noValidate>
          {Object.entries(fields).map(([name, value]) => (
            <input key={name} type="hidden" name={name} value={value} />
          ))}
          {/* Le détail (conséquences, motif, nouvelle date) est dans le formulaire : ses champs partent avec lui. */}
          {children ? <div className="confirm-dialog-details">{children}</div> : null}
          {needsAcknowledgement ? (
            <label className="confirm-dialog-acknowledge">
              <input type="checkbox" checked={acknowledged} onChange={(event) => setAcknowledged(event.target.checked)} />
              <span>{acknowledgeLabel}</span>
            </label>
          ) : null}
          <div className="confirm-dialog-actions">
            <button type="button" autoFocus onClick={close}>
              {keepLabel}
            </button>
            <button type="submit" className={tone === "danger" ? "button-danger confirm-dialog-confirm" : confirmClassName} disabled={(needsAcknowledgement && !acknowledged) || pending}>
              {confirmLabel}
            </button>
          </div>
        </form>
      </dialog>
    </>
  );
}
