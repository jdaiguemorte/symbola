"use client";

// Lot 13 (HUB-16) — lignes du budget dans l'ordre que reçoivent les nouveaux
// événements : glisser-déposer à la souris, et « Monter » / « Descendre »
// pour le clavier et le téléphone (le glisser-déposer HTML ne fonctionne pas
// au doigt). Chaque déplacement est enregistré aussitôt et annoncé.
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef, useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { ArrowDown, ArrowUp, GripVertical } from "lucide-react";
import { BudgetLineIcon } from "@/app/budget-line-icon";
import { ListTable } from "@/app/ui/list-table";
import { removeDefaultVendorSlotAction, reorderDefaultVendorSlotsAction } from "./vendor-slot-actions";

export type SortableLine = { id: string; label: string; icon: string | null };

export function SortableBudgetLines({ lines, isOwner, base, editingId }: { lines: SortableLine[]; isOwner: boolean; base: string; editingId: string | null }) {
  const t = useTranslations("Events");
  const router = useRouter();
  const [order, setOrder] = useState(lines);
  const [announcement, setAnnouncement] = useState("");
  const [dragged, setDragged] = useState<string | null>(null);
  const [, startTransition] = useTransition();
  const buttons = useRef(new Map<string, HTMLButtonElement | null>());
  // Les données du serveur font foi : une ligne ajoutée, renommée ou retirée
  // remplace l'ordre local (comparaison du contenu, pas de la référence).
  const signature = lines.map((line) => `${line.id}:${line.label}:${line.icon ?? ""}`).join("|");
  const [source, setSource] = useState(signature);
  if (source !== signature) {
    setSource(signature);
    setOrder(lines);
  }

  function move(id: string, to: number, focusKey?: string) {
    const from = order.findIndex((line) => line.id === id);
    if (from < 0 || to < 0 || to >= order.length || from === to) return;
    const next = [...order];
    const [line] = next.splice(from, 1);
    next.splice(to, 0, line!);
    setOrder(next);
    startTransition(async () => {
      const saved = await reorderDefaultVendorSlotsAction(next.map((item) => item.id));
      setAnnouncement(saved ? t("lineMoved", { label: line!.label, position: to + 1, total: next.length }) : t("lineMoveFailed"));
      if (!saved) setOrder(order);
      router.refresh();
    });
    // Le bouton utilisé peut devenir inactif en haut ou en bas : le focus passe à l'autre.
    if (focusKey) {
      requestAnimationFrame(() => {
        const atTop = to === 0;
        const atBottom = to === next.length - 1;
        const key = focusKey === "up" && atTop ? "down" : focusKey === "down" && atBottom ? "up" : focusKey;
        buttons.current.get(`${id}:${key}`)?.focus();
      });
    }
  }

  return (
    <>
      <ListTable
        label={t("defaultVendorSlotsTitle")}
        head={
          <tr>
            <th scope="col">
              <span className="sr-only">{t("orderColumn")}</span>
            </th>
            <th scope="col">{t("lineIconColumn")}</th>
            <th scope="col">{t("vendorColumnSlot")}</th>
            <th scope="col">
              <span className="sr-only">{t("actionsColumn")}</span>
            </th>
          </tr>
        }
      >
      {order.map((line, index) => (
        <tr
          key={line.id}
          aria-current={line.id === editingId ? "true" : undefined}
          draggable
          data-dragging={dragged === line.id ? "true" : undefined}
          onDragStart={(event) => {
            setDragged(line.id);
            event.dataTransfer.effectAllowed = "move";
            event.dataTransfer.setData("text/plain", line.id);
          }}
          onDragOver={(event) => {
            if (dragged) event.preventDefault();
          }}
          onDrop={(event) => {
            event.preventDefault();
            if (dragged) move(dragged, index);
            setDragged(null);
          }}
          onDragEnd={() => setDragged(null)}
        >
          <td className="drag-cell">
            <GripVertical size={18} aria-hidden="true" className="drag-handle" />
          </td>
          <td className="icon-cell">
            <BudgetLineIcon icon={line.icon} label={line.label} decorative />
          </td>
          <th scope="row">{line.label}</th>
          <td className="actions">
            <button
              type="button"
              className="button-ghost icon-button"
              ref={(element) => {
                buttons.current.set(`${line.id}:up`, element);
              }}
              disabled={index === 0}
              aria-label={t("moveLineUp", { label: line.label })}
              onClick={() => move(line.id, index - 1, "up")}
            >
              <ArrowUp size={16} aria-hidden="true" />
            </button>
            <button
              type="button"
              className="button-ghost icon-button"
              ref={(element) => {
                buttons.current.set(`${line.id}:down`, element);
              }}
              disabled={index === order.length - 1}
              aria-label={t("moveLineDown", { label: line.label })}
              onClick={() => move(line.id, index + 1, "down")}
            >
              <ArrowDown size={16} aria-hidden="true" />
            </button>{" "}
            {isOwner ? (
              <Link href={`${base}?ligne=${line.id}`} scroll={false} className="button-link" aria-label={t("editBudgetLine", { label: line.label })}>
                {t("edit")}
              </Link>
            ) : null}{" "}
            <form action={removeDefaultVendorSlotAction} className="inline-form">
              <input type="hidden" name="defaultVendorSlotId" value={line.id} />
              <button type="submit" className="button-ghost" aria-label={t("removeVendorSlot", { label: line.label })}>
                {t("remove")}
              </button>
            </form>
          </td>
        </tr>
      ))}
      </ListTable>
      <p className="sr-only" role="status">
        {announcement}
      </p>
    </>
  );
}
