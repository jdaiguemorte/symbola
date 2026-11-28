"use client";

// Lot 73b (PRE-01, UX-07, UX-14, UX-15 ; spécification du lot 73, § 5.2, critères 1 et 7 ; M2 ; maquette 18,
// « La ligne » et « Trier, sélectionner ») — ce qui bouge dans le tableau du carnet, rendu par le serveur :
//
// - le menu « ⋯ » d'une ligne : un seul menu pour tout le tableau, monté au premier clic et posé sous le
//   bouton de la ligne (Ouvrir la fiche, Appeler, Écrire, Modifier, puis à part « Archiver… », qui part
//   aussitôt, avec « Annuler » dix secondes). 500 lignes ne portent ainsi aucun menu fermé (NFR-02 : c'est
//   ce qui avait fait échouer la mesure de « Tâches » au lot 70d) ;
// - « Sélectionner » : une case par ligne en mode sélection seulement, et la barre de sélection du volet 1
//   (70d) collée au bas, bordée d'encre : « Ajouter à un mariage… », « Ajouter une étiquette… »,
//   « Exporter… », « Archiver… » (niveau 2), « Tout désélectionner », « Terminer la sélection » ;
// - « Ajouter à un mariage… » (lot 73c) : la fenêtre de rattachement, montée au clic (une seule pour tout
//   le carnet), depuis la ligne, le menu « ⋯ » (téléphone) ou la sélection. Le carnet ouvert depuis un
//   poste : « Ajouter à ce poste… » ouvre la même fenêtre, mariage et poste déjà choisis ; une fiche déjà
//   sur le poste dit « Dans la comparaison » ou « Retenu ».
//
// Tout passe par délégation d'évènements sur le tableau : les lignes restent du HTML du serveur.
import Link from "next/link";
import { memo, useCallback, useEffect, useMemo, useRef, useState, useTransition, type ReactNode } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useFeedback } from "@/app/ui/feedback";
import { TaskPopover, usePopover } from "@/app/ui/task-popover";
import { AddToEventDialog, type AdditionPreset } from "./add-to-event-dialog";
import { archiveVendorAction, archiveVendorsAction, restoreVendorsTagsAction, tagVendorsAction, unarchiveVendorsAction, type VendorBulkResult } from "./actions";

export const SELECT_TOGGLE_EVENT = "symbola:vendor-select-toggle";
export const SELECTING_EVENT = "symbola:vendor-selecting";

type TagOption = { id: string; label: string; group: string | null };
type RowMenuTarget = { id: string; name: string; phone: string | null; email: string | null };

// Lot 73b (NFR-02) : une ligne du carnet, ses textes déjà formatés par le serveur.
export type BookRowData = {
  id: string;
  name: string;
  demo: boolean;
  contact: string;
  trade: string;
  unclassified: boolean;
  city: string;
  withYou: string;
  rating: string;
  tone: "ok" | "soon" | "late" | "todo" | "none";
  icon: "✓" | "◷" | "!" | null;
  documents: string;
  reason: string | null;
  phone: string | null;
  email: string | null;
  // Lot 73c : le carnet ouvert depuis un poste, la fiche déjà sur ce poste.
  onSlot: "compared" | "retained" | null;
};
// Les libellés qui portent le nom de la fiche : un modèle, le nom (\u0000) et le téléphone (\u0002) à glisser.
export type BookRowLabels = { demo: string; add: string; addFor: string; menu: string; call: string; select: string; addToSlot: string | null; addToSlotFor: string | null; inComparison: string; retained: string };
const fill = (template: string, name: string, phone = "") => template.replace("\u0000", name).replace("\u0002", phone);

const BookRow = memo(function BookRow({ row, labels, target, selecting, selected, onToggle }: { row: BookRowData; labels: BookRowLabels; target: AdditionPreset | null; selecting: boolean; selected: boolean; onToggle: (id: string) => void }) {
  return (
    <tr data-vendor-id={row.id}>
      <td className="vendor-select-cell">
        {selecting ? (
          <label>
            <input type="checkbox" checked={selected} onChange={() => onToggle(row.id)} />
            <span className="sr-only">{fill(labels.select, row.name)}</span>
          </label>
        ) : null}
      </td>
      <td className="vendor-cell-name">
        {/* Un lien simple : 500 composants Link hydratés et préchargés coûtaient au rendu. */}
        <a href={`/prestataires/${row.id}`} className="vendor-name-link">
          {row.name}
        </a>
        {row.demo ? <span className="badge badge-ambre">{labels.demo}</span> : null}
        <span className="vendor-contact">{row.contact}</span>
      </td>
      <td className="vendor-cell-trade">
        <span className="vendor-trade" data-unclassified={row.unclassified ? "true" : undefined}>
          {row.trade}
        </span>
        <span className="vendor-city">{row.city}</span>
      </td>
      <td className="vendor-cell-with">{row.withYou}</td>
      <td className="vendor-cell-rating">{row.rating}</td>
      <td className="vendor-cell-documents">
        <span className="book-documents" data-tone={row.tone}>
          {row.icon ? (
            <span className="book-documents-icon" aria-hidden="true">
              {row.icon}
            </span>
          ) : null}
          {row.documents}
        </span>
        {row.reason ? <span className="book-documents-reason">{row.reason}</span> : null}
      </td>
      <td className="vendor-cell-actions">
        {row.phone ? (
          <a className="vendor-phone-call" href={`tel:${row.phone}`} aria-label={fill(labels.call, row.name, row.phone)}>
            {row.phone}
          </a>
        ) : null}
        {target && row.onSlot ? (
          <span className="vendor-row-on-slot" data-on-slot={row.onSlot}>
            {row.onSlot === "retained" ? labels.retained : labels.inComparison}
          </span>
        ) : target && labels.addToSlot && labels.addToSlotFor ? (
          <button type="button" className="button-secondary vendor-row-add" data-add-to-event aria-label={fill(labels.addToSlotFor, row.name)}>
            {labels.addToSlot}
          </button>
        ) : (
          <button type="button" className="button-secondary vendor-row-add" data-add-to-event aria-label={fill(labels.addFor, row.name)}>
            {labels.add}
          </button>
        )}
        <button type="button" className="task-menu-button" aria-haspopup="menu" aria-label={fill(labels.menu, row.name)} data-row-menu>
          ⋯
        </button>
      </td>
    </tr>
  );
})

function moveFocus(event: React.KeyboardEvent<HTMLElement>) {
  if (event.key !== "ArrowDown" && event.key !== "ArrowUp") return;
  const items = [...event.currentTarget.querySelectorAll<HTMLElement>("[role=menuitem]")];
  const index = items.indexOf(document.activeElement as HTMLElement);
  items[(index + (event.key === "ArrowDown" ? 1 : items.length - 1)) % items.length]?.focus();
  event.preventDefault();
}

function RowMenu({ target, anchor, requests, back, addLabel, onAddToEvent }: { target: RowMenuTarget; anchor: HTMLElement | null; requests: number; back: string; addLabel: string; onAddToEvent: (() => void) | null }) {
  const t = useTranslations("VendorBook");
  const menu = usePopover();
  const [pending, startTransition] = useTransition();
  const open = menu.open;
  useEffect(() => {
    open(anchor);
  }, [requests, anchor, open]);
  const label = t("row.menuLabel", { vendor: target.name });
  return (
    <TaskPopover handle={menu} label={label} className="task-menu">
      <div role="menu" aria-label={label} onKeyDown={moveFocus}>
        {/* Sur téléphone, l'action rapide de la ligne passe dans le menu. */}
        {onAddToEvent ? (
          <button
            type="button"
            role="menuitem"
            className="vendor-menu-phone"
            onClick={() => {
              menu.close();
              onAddToEvent();
            }}
          >
            <span>{addLabel}</span>
          </button>
        ) : null}
        <Link role="menuitem" href={`/prestataires/${target.id}`} data-autofocus onClick={() => menu.close()}>
          <span>{t("row.open")}</span>
        </Link>
        {target.phone ? (
          <a role="menuitem" href={`tel:${target.phone}`} onClick={() => menu.close()}>
            <span>{t("row.call")}</span>
            <span className="task-menu-hint">{target.phone}</span>
          </a>
        ) : null}
        {target.email ? (
          <a role="menuitem" href={`mailto:${target.email}`} onClick={() => menu.close()}>
            <span>{t("row.write")}</span>
            <span className="task-menu-hint">{target.email}</span>
          </a>
        ) : null}
        <Link role="menuitem" href={`/prestataires/${target.id}?modifier=1`} onClick={() => menu.close()}>
          <span>{t("row.edit")}</span>
        </Link>
        <hr className="task-menu-separator" />
        <button
          type="button"
          role="menuitem"
          className="task-menu-danger"
          disabled={pending}
          onClick={() =>
            startTransition(async () => {
              menu.close();
              // Niveau 1 (70b) : l'archivage part ; « Annuler » est dans le message de retour, dix secondes.
              const formData = new FormData();
              formData.set("vendorId", target.id);
              formData.set("back", back);
              await archiveVendorAction(formData);
            })
          }
        >
          <span>{t("row.archive")}</span>
          <span className="task-menu-hint">{t("row.archiveHint")}</span>
        </button>
      </div>
    </TaskPopover>
  );
}

function BulkBar({ ids, names, tags, exportFields, exportListHrefs, onEnd, onAddToEvent, onDeselect }: {
  ids: string[];
  names: string[];
  tags: TagOption[];
  exportFields: Record<string, string>;
  exportListHrefs: { csv: string; pdf: string };
  onEnd: () => void;
  onAddToEvent: () => void;
  onDeselect: () => void;
}) {
  const t = useTranslations("VendorBook");
  const feedback = useFeedback();
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const tagPanel = usePopover();
  const exportPanel = usePopover();
  const tagButton = useRef<HTMLButtonElement>(null);
  const exportButton = useRef<HTMLButtonElement>(null);
  const confirm = useRef<HTMLDialogElement>(null);
  const exportForm = useRef<HTMLFormElement>(null);
  const [exportFormat, setExportFormat] = useState<"csv" | "pdf">("csv");
  const count = ids.length;
  const none = count === 0;

  const run = (action: () => Promise<VendorBulkResult>, undo: (result: VendorBulkResult) => (() => Promise<VendorBulkResult>) | null, close?: () => void) =>
    startTransition(async () => {
      setError(null);
      const result = await action();
      if (!result.ok) {
        setError(result.error ?? t("bulk.notFound"));
        return;
      }
      close?.();
      const undoRun = undo(result);
      feedback?.show({
        title: result.message ?? "",
        ...(undoRun
          ? {
              action: {
                kind: "undo" as const,
                label: t("bulk.undo"),
                run: async () => {
                  const undone = await undoRun();
                  feedback.show(undone.ok ? { title: undone.message ?? "" } : { tone: "error", title: undone.error ?? t("bulk.notFound") });
                  router.refresh();
                },
              },
            }
          : {}),
      });
      onEnd();
      router.refresh();
    });

  return (
    <div className="task-bulk" role="region" aria-label={t("bulk.label")}>
      <p className="task-bulk-count" aria-live="polite">
        {none ? t("bulk.none") : t("bulk.selected", { count })}
      </p>
      <div className="task-bulk-actions">
        <button type="button" className="button-secondary" disabled={none || pending} onClick={onAddToEvent}>
          <span className="task-bulk-long">{t("addToEvent.button")}</span>
          <span className="task-bulk-short">{t("bulk.addShort")}</span>
        </button>
        <button ref={tagButton} type="button" className="button-secondary" disabled={none || pending || tags.length === 0} aria-haspopup="dialog" aria-controls={tagPanel.id} onClick={() => tagPanel.open(tagButton.current)}>
          <span className="task-bulk-long">{t("bulk.tag")}</span>
          <span className="task-bulk-short">{t("bulk.tagShort")}</span>
        </button>
        <button ref={exportButton} type="button" className="button-secondary" disabled={pending} aria-haspopup="dialog" aria-controls={exportPanel.id} onClick={() => exportPanel.open(exportButton.current)}>
          <span className="task-bulk-long">{t("bulk.export")}</span>
          <span className="task-bulk-short">{t("bulk.exportShort")}</span>
        </button>
        <button type="button" className="button-secondary vendor-bulk-danger" disabled={none || pending} onClick={() => confirm.current?.showModal()}>
          <span className="task-bulk-long">{t("bulk.archive")}</span>
          <span className="task-bulk-short">{t("bulk.archiveShort")}</span>
        </button>
        <button type="button" className="button-ghost task-bulk-wide" disabled={none} onClick={onDeselect}>
          {t("bulk.deselectAll")}
        </button>
        <button type="button" className="button-ghost" onClick={onEnd}>
          <span className="task-bulk-long">{t("bulk.end")}</span>
          <span className="task-bulk-short">{t("bulk.endShort")}</span>
        </button>
      </div>
      {error ? (
        <p className="field-error" role="alert">
          {error}
        </p>
      ) : null}

      <TaskPopover handle={tagPanel} label={t("bulk.tagTitle", { count })} className="task-bulk-panel">
        <p className="task-popover-title">{t("bulk.tagTitle", { count })}</p>
        <ul className="task-popover-choices">
          {tags.map((tag, index) => (
            <li key={tag.id}>
              <button
                type="button"
                className="task-popover-choice"
                disabled={pending}
                {...(index === 0 ? { "data-autofocus": true } : {})}
                onClick={() =>
                  run(
                    () => tagVendorsAction(ids, tag.id),
                    (result) => (result.previous && result.previous.length > 0 ? () => restoreVendorsTagsAction(result.previous!) : null),
                    tagPanel.close,
                  )
                }
              >
                <span>{tag.label}</span>
                {tag.group ? <span className="task-popover-choice-hint">{tag.group}</span> : null}
              </button>
            </li>
          ))}
        </ul>
      </TaskPopover>

      <TaskPopover handle={exportPanel} label={t("bulk.exportTitle")} className="task-bulk-panel">
        <p className="task-popover-title">{t("bulk.exportTitle")}</p>
        <ul className="task-popover-choices">
          {(["csv", "pdf"] as const).map((format, index) => (
            <li key={format}>
              <button
                type="button"
                className="task-popover-choice"
                disabled={none}
                {...(index === 0 ? { "data-autofocus": true } : {})}
                onClick={() => {
                  setExportFormat(format);
                  exportPanel.close();
                  // Le formulaire porte le format au prochain rendu.
                  requestAnimationFrame(() => exportForm.current?.requestSubmit());
                }}
              >
                <span>{t(format === "csv" ? "bulk.exportSelectionCsv" : "bulk.exportSelectionPdf", { count })}</span>
              </button>
            </li>
          ))}
          <li>
            <a className="task-popover-choice" href={exportListHrefs.csv} onClick={() => exportPanel.close()}>
              <span>{t("bulk.exportListCsv")}</span>
            </a>
          </li>
          <li>
            <a className="task-popover-choice" href={exportListHrefs.pdf} onClick={() => exportPanel.close()}>
              <span>{t("bulk.exportListPdf")}</span>
            </a>
          </li>
        </ul>
      </TaskPopover>
      {/* L'export de la sélection : POST, des identifiants seulement (aucun nom). */}
      <form ref={exportForm} method="post" action="/prestataires/export" hidden>
        <input type="hidden" name="format" value={exportFormat} />
        {Object.entries(exportFields).map(([key, value]) => (
          <input key={key} type="hidden" name={key} value={value} />
        ))}
        {ids.map((id) => (
          <input key={id} type="hidden" name="ids" value={id} />
        ))}
      </form>

      {/* « Archiver… » en lot : niveau 2 (70b), la question nomme ce qui change ; on renonce par un bouton
          nommé, avant le bouton de danger ; puis « Annuler » dix secondes. */}
      <dialog ref={confirm} className="confirm-dialog confirm-dialog-danger" data-danger-level="2" aria-labelledby="vendor-archive-title" aria-describedby="vendor-archive-body">
        <h2 id="vendor-archive-title">{count === 1 ? t("bulk.archiveTitleOne", { vendor: names[0] ?? "" }) : t("bulk.archiveTitle", { count })}</h2>
        <p id="vendor-archive-body">{t("bulk.archiveBody")}</p>
        <div className="confirm-dialog-actions">
          <button type="button" autoFocus onClick={() => confirm.current?.close()}>
            {t("bulk.keep")}
          </button>
          <button
            type="button"
            className="button-danger confirm-dialog-confirm"
            disabled={pending}
            onClick={() =>
              run(
                () => archiveVendorsAction(ids),
                (result) => (result.archivedIds && result.archivedIds.length > 0 ? () => unarchiveVendorsAction(result.archivedIds!) : null),
                () => confirm.current?.close(),
              )
            }
          >
            {count === 1 ? t("bulk.archiveConfirmOne") : t("bulk.archiveConfirm", { count })}
          </button>
        </div>
      </dialog>
    </div>
  );
}

export function BookBoard({
  rows,
  labels,
  target,
  caption,
  head,
  tags,
  exportFields,
  exportListHrefs,
  back,
}: {
  rows: BookRowData[];
  labels: BookRowLabels;
  // Le carnet ouvert depuis un poste (lot 73c) : « Ajouter à ce poste… », mariage et poste déjà choisis.
  target: AdditionPreset | null;
  caption: string;
  // Les en-têtes qui trient, rendus par le serveur.
  head: ReactNode;
  tags: TagOption[];
  // Lieu, rayon et tri de l'écran : l'export de la sélection garde les trajets et l'ordre.
  exportFields: Record<string, string>;
  exportListHrefs: { csv: string; pdf: string };
  // L'adresse du carnet, filtres compris, où revenir après « Archiver… ».
  back: string;
}) {
  const t = useTranslations("VendorBook");
  const [selecting, setSelecting] = useState(false);
  const [selected, setSelected] = useState<string[]>([]);
  const [menu, setMenu] = useState<{ target: RowMenuTarget; anchor: HTMLElement; requests: number } | null>(null);
  // La fenêtre « Ajouter à un mariage… », montée au clic seulement.
  const [adding, setAdding] = useState<{ ids: string[]; names: string[] } | null>(null);
  const byId = useMemo(() => new Map(rows.map((row) => [row.id, row])), [rows]);
  // Les fiches qui quittent la liste (archivées, filtrées) quittent la sélection.
  const shown = selected.filter((id) => byId.has(id));

  const end = useCallback(() => {
    setSelected([]);
    setSelecting(false);
  }, []);
  const toggle = useCallback((id: string) => setSelected((current) => (current.includes(id) ? current.filter((value) => value !== id) : [...current, id])), []);

  // « Sélectionner » est dans l'en-tête de l'écran ; il parle au tableau par un évènement.
  useEffect(() => {
    const onToggle = () => setSelecting((current) => !current);
    window.addEventListener(SELECT_TOGGLE_EVENT, onToggle);
    return () => window.removeEventListener(SELECT_TOGGLE_EVENT, onToggle);
  }, []);
  useEffect(() => {
    if (!selecting) setSelected([]);
    window.dispatchEvent(new CustomEvent(SELECTING_EVENT, { detail: selecting }));
    if (!selecting) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !document.querySelector(":popover-open, dialog[open]")) end();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [selecting, end]);

  const nameOf = (id: string) => byId.get(id)?.name ?? "";
  const openAdd = (ids: string[]) => setAdding({ ids, names: ids.map(nameOf) });

  return (
    <div
      className="vendor-board"
      data-selecting={selecting ? "true" : undefined}
      onClick={(event) => {
        // Un seul menu et une seule fenêtre pour tout le tableau : la ligne se lit au clic.
        const element = event.target as HTMLElement;
        const id = element.closest<HTMLElement>("tr[data-vendor-id]")?.dataset.vendorId;
        const row = id ? byId.get(id) : undefined;
        if (!row) return;
        const menuButton = element.closest<HTMLElement>("[data-row-menu]");
        if (menuButton) {
          setMenu((current) => ({ target: { id: row.id, name: row.name, phone: row.phone, email: row.email }, anchor: menuButton, requests: (current?.requests ?? 0) + 1 }));
          return;
        }
        if (element.closest("[data-add-to-event]")) openAdd([row.id]);
      }}
    >
      {selecting ? (
        <div className="vendor-board-select">
          <button type="button" className="button-ghost" onClick={() => setSelected(rows.map((row) => row.id))}>
            {t("bulk.selectAll", { count: rows.length })}
          </button>
        </div>
      ) : null}
      <table className="vendor-table">
        <caption className="sr-only">{caption}</caption>
        {head}
        <tbody>
          {rows.map((row) => (
            <BookRow key={row.id} row={row} labels={labels} target={target} selecting={selecting} selected={selecting && selected.includes(row.id)} onToggle={toggle} />
          ))}
        </tbody>
      </table>
      {menu ? (
        <RowMenu
          target={menu.target}
          anchor={menu.anchor}
          requests={menu.requests}
          back={back}
          addLabel={target && labels.addToSlot ? labels.addToSlot : t("addToEvent.button")}
          onAddToEvent={target && byId.get(menu.target.id)?.onSlot ? null : () => openAdd([menu.target.id])}
        />
      ) : null}
      {selecting ? <BulkBar ids={shown} names={shown.map(nameOf)} tags={tags} exportFields={exportFields} exportListHrefs={exportListHrefs} onEnd={end} onAddToEvent={() => openAdd(shown)} onDeselect={() => setSelected([])} /> : null}
      {adding ? <AddToEventDialog vendorIds={adding.ids} names={adding.names} preset={target ?? undefined} onClose={() => setAdding(null)} onAdded={() => (selecting ? end() : undefined)} /> : null}
    </div>
  );
}

// « Sélectionner » / « Terminer la sélection », dans l'en-tête de l'écran.
export function SelectToggle() {
  const t = useTranslations("VendorBook");
  const [selecting, setSelecting] = useState(false);
  useEffect(() => {
    const onState = (event: Event) => setSelecting(Boolean((event as CustomEvent<boolean>).detail));
    window.addEventListener(SELECTING_EVENT, onState);
    return () => window.removeEventListener(SELECTING_EVENT, onState);
  }, []);
  return (
    <button type="button" className="button-ghost" aria-pressed={selecting} onClick={() => window.dispatchEvent(new Event(SELECT_TOGGLE_EVENT))}>
      {selecting ? t("bulk.end") : t("select")}
    </button>
  );
}
