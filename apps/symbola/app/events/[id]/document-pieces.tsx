"use client";

// Lot 63c (DOC-01, BUD-04 ; maquette M8) — ranger les pièces : « Déplacer vers… » sur chaque pièce,
// partout, et le glisser-déposer d'une pièce sur un dossier, sur ordinateur (DESIGN.md : le
// glisser-déposer est toujours doublé d'un bouton). Le serveur revérifie chaque déplacement.
import { createContext, useContext, useState, useTransition, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { GripVertical } from "lucide-react";
import { moveBudgetPieceAction, moveDocumentAction } from "./document-actions";
import { canMoveTo, moveTargets, type FolderTarget, type PieceRef } from "./document-targets";

type Pieces = { targets: FolderTarget[]; move: (piece: PieceRef, target: FolderTarget) => void; dragged: PieceRef | null; setDragged: (piece: PieceRef | null) => void; pending: boolean; message: string | null };

const PiecesContext = createContext<Pieces | null>(null);

function usePieces(): Pieces {
  const pieces = useContext(PiecesContext);
  if (!pieces) throw new Error("PiecesProvider manquant");
  return pieces;
}

export function PiecesProvider({ eventId, targets, children }: { eventId: string; targets: FolderTarget[]; children: ReactNode }) {
  const t = useTranslations("EventDocuments");
  const router = useRouter();
  const [dragged, setDragged] = useState<PieceRef | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const move = (piece: PieceRef, target: FolderTarget) => {
    if (!canMoveTo(piece, target)) return;
    startTransition(async () => {
      const data = new FormData();
      data.set("eventId", eventId);
      let state: { error?: string; success?: boolean };
      if (piece.type === "team") {
        data.set("documentId", piece.id);
        data.set("folderId", target.folderId ?? "");
        state = await moveDocumentAction({}, data);
      } else {
        data.set("attachmentId", piece.id);
        data.set("kind", target.budgetKind ?? "");
        state = await moveBudgetPieceAction({}, data);
      }
      setMessage(state.error ?? t("movedTo", { label: piece.label, folder: target.name }));
      if (!state.error) router.refresh();
    });
  };
  return (
    <PiecesContext.Provider value={{ targets, move, dragged, setDragged, pending, message }}>
      {children}
      <p role="status" className="sr-only">
        {message ?? ""}
      </p>
    </PiecesContext.Provider>
  );
}

// Une pièce qu'on peut saisir (poignée) pour la poser sur un dossier.
export function DraggablePiece({ piece, children }: { piece: PieceRef; children: ReactNode }) {
  const t = useTranslations("EventDocuments");
  const { setDragged } = usePieces();
  return (
    <li
      draggable
      onDragStart={(event) => {
        event.dataTransfer.effectAllowed = "move";
        event.dataTransfer.setData("text/plain", piece.label);
        setDragged(piece);
      }}
      onDragEnd={() => setDragged(null)}
      className="document-piece"
    >
      <GripVertical size={16} aria-hidden="true" className="drag-handle" />
      <span className="sr-only">{t("dragHint")}</span>
      {children}
    </li>
  );
}

// Un dossier où poser une pièce glissée.
export function FolderDrop({ target, headingId, className, children }: { target: FolderTarget; headingId: string; className?: string; children: ReactNode }) {
  const { dragged, move } = usePieces();
  const [over, setOver] = useState(false);
  const allowed = dragged !== null && canMoveTo(dragged, target);
  return (
    <section
      aria-labelledby={headingId}
      className={[className, allowed ? "drop-allowed" : null, allowed && over ? "drop-over" : null].filter(Boolean).join(" ")}
      onDragOver={(event) => {
        if (!allowed) return;
        event.preventDefault();
        event.dataTransfer.dropEffect = "move";
        setOver(true);
      }}
      onDragLeave={() => setOver(false)}
      onDrop={(event) => {
        event.preventDefault();
        setOver(false);
        if (dragged && allowed) move(dragged, target);
      }}
    >
      {children}
    </section>
  );
}

// « Déplacer vers… » : les dossiers où la pièce peut aller, un bouton chacun.
export function MoveToMenu({ piece }: { piece: PieceRef }) {
  const t = useTranslations("EventDocuments");
  const { targets, move, pending } = usePieces();
  const choices = moveTargets(piece, targets);
  if (choices.length === 0) return null;
  return (
    <details className="move-menu">
      <summary>
        {t("moveTo")}
        <span className="sr-only"> {piece.label}</span>
      </summary>
      <ul className="menu-popover" aria-label={t("moveToLabel", { label: piece.label })}>
        {choices.map((target) => (
          <li key={target.key}>
            <button
              type="button"
              disabled={pending}
              onClick={(event) => {
                (event.currentTarget.closest("details") as HTMLDetailsElement | null)?.removeAttribute("open");
                move(piece, target);
              }}
            >
              {target.name}
            </button>
          </li>
        ))}
      </ul>
    </details>
  );
}
