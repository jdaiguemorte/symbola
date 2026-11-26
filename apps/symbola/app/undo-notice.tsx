// Lot 39a (UX-07 ; D6 ; ADR 0073) — l'offre « Annuler » en cours (cookie posé par l'action qui a
// supprimé), lue par le gabarit de l'app sur tout écran de l'équipe. Lot 70b : elle passe par le
// message de retour unique (undo-offer-feedback.tsx) ; ce qui va à la Corbeille le dit.
import { getTranslations } from "next-intl/server";
import { isTrashKind } from "@symbola/contracts";
import { readUndo } from "@/lib/undo";
import { UndoOfferFeedback } from "./undo-offer-feedback";

export async function UndoNotice() {
  const offer = await readUndo();
  // Déjà rendu (page rechargée après « Annuler ») : rien à proposer de plus.
  if (!offer || offer.done === true) return null;
  const t = await getTranslations("Trash");
  return (
    <UndoOfferFeedback
      key={`${offer.kind}:${offer.id}:${offer.at}`}
      kind={offer.kind}
      id={offer.id}
      labels={{
        message: t(`undo.${offer.kind}`),
        detail: isTrashKind(offer.kind) ? t("undo.inTrash") : null,
        undo: t("undo.action"),
        restored: t("undo.restored"),
        gone: t("undo.gone"),
        conflict: t("undo.conflict"),
      }}
    />
  );
}
