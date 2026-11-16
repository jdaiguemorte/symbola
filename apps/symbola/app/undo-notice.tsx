// Lot 39a (UX-07 ; D6 ; ADR 0073) — le bandeau « Annuler » de l'offre en cours (cookie posé par
// l'action qui a supprimé), monté par le gabarit de l'app sur tout écran de l'équipe.
import { getTranslations } from "next-intl/server";
import { isTrashKind } from "@symbola/contracts";
import { readUndo } from "@/lib/undo";
import { UndoBanner } from "./undo-banner";

export async function UndoNotice() {
  const offer = await readUndo();
  if (!offer) return null;
  const t = await getTranslations("Trash");
  const trashed = isTrashKind(offer.kind);
  return (
    <UndoBanner
      key={`${offer.kind}:${offer.id}:${offer.at}`}
      kind={offer.kind}
      id={offer.id}
      remainingMs={offer.remainingMs}
      labels={{
        message: t(`undo.${offer.kind}`),
        undo: t("undo.action"),
        restored: t("undo.restored"),
        gone: t("undo.gone"),
        conflict: t("undo.conflict"),
        trash: trashed ? t("undo.seeTrash") : null,
      }}
    />
  );
}
