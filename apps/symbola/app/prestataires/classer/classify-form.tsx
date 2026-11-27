"use client";

// Lot 73b (PRE-01, HUB-14, UX-07 ; spécification du lot 73, § 5.2, critère 9 ; P13 ; maquette 18) — le
// tableau de l'écran « Classer » : pour chaque fiche, la liste des métiers de l'organisation (la proposition
// choisie, sinon « Choisir un métier » ; « Créer un métier » en bas), et d'où vient la proposition (marque
// de provenance du volet 2). « Sélectionner » et « Donner le métier… » pour plusieurs fiches. La barre
// d'enregistrement en bas (D7, volet 6) ; « Fermer » avec des choix faits demande « Fermer sans
// enregistrer ? ». Après « Enregistrer », retour au carnet et « N fiches classées · Revoir » : pas
// d'« Annuler » de tout le lot, « Revoir » rouvre l'écran sur ces fiches (P13).
import Link from "next/link";
import { useMemo, useRef, useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useFeedback } from "@/app/ui/feedback";
import { TaskPopover, usePopover } from "@/app/ui/task-popover";
import { classifyVendorsAction } from "../actions";

type Row = { id: string; name: string; city: string | null; savedTypeId: string | null; proposal: { typeId: string; word: string; label: string } | null };
type TypeOption = { id: string; label: string; group: string | null };

const CREATE = "__create__";

export function ClassifyForm({ reviewing, rows, proposed, withoutProposal, withoutFirst, types, createTypeHref }: { reviewing: boolean; rows: Row[]; proposed: number; withoutProposal: number; withoutFirst: boolean; types: TypeOption[]; createTypeHref: string }) {
  const t = useTranslations("VendorBook");
  const router = useRouter();
  const feedback = useFeedback();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  // Le choix de chaque fiche : la proposition, ou le métier enregistré (« Revoir »), ou rien.
  const initial = useMemo(() => Object.fromEntries(rows.map((row) => [row.id, row.savedTypeId ?? row.proposal?.typeId ?? ""])), [rows]);
  const [choices, setChoices] = useState<Record<string, string>>(initial);
  const [selecting, setSelecting] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const give = usePopover();
  const giveButton = useRef<HTMLButtonElement>(null);
  const closeDialog = useRef<HTMLDialogElement>(null);

  // À enregistrer : un métier choisi, différent de celui déjà enregistré.
  const toSave = rows.filter((row) => choices[row.id] && choices[row.id] !== row.savedTypeId);
  const left = rows.filter((row) => !choices[row.id]).length;
  const touched = rows.some((row) => choices[row.id] !== initial[row.id]);
  const groups = [...new Set(types.map((type) => type.group))];

  const setChoice = (id: string, value: string) => {
    if (value === CREATE) {
      router.push(createTypeHref, { scroll: false });
      return;
    }
    setChoices((current) => ({ ...current, [id]: value }));
  };

  const save = () =>
    startTransition(async () => {
      setError(null);
      const result = await classifyVendorsAction(toSave.map((row) => ({ vendorId: row.id, typeId: choices[row.id]!, replaces: row.savedTypeId })));
      if (!result.ok) {
        setError(result.error ?? t("bulk.notFound"));
        return;
      }
      feedback?.show({ title: t("classify.done", { count: result.count ?? 0 }), ...(result.reviewCode ? { action: { kind: "link" as const, label: t("classify.review"), href: `/prestataires/classer?revoir=${result.reviewCode}` } } : {}) });
      router.push("/prestataires");
      router.refresh();
    });

  const options = (
    <>
      {groups.map((group) =>
        group ? (
          <optgroup key={group} label={group}>
            {types
              .filter((type) => type.group === group)
              .map((type) => (
                <option key={type.id} value={type.id}>
                  {type.label}
                </option>
              ))}
          </optgroup>
        ) : (
          types
            .filter((type) => type.group === null)
            .map((type) => (
              <option key={type.id} value={type.id}>
                {type.label}
              </option>
            ))
        ),
      )}
      <option value={CREATE}>{t("classify.createType")}</option>
    </>
  );

  return (
    <div data-selecting={selecting ? "true" : undefined}>
      <div className="vendor-classify-tools">
        <p className="meta">
          {t("classify.counts", { proposed, without: withoutProposal })}
          {withoutProposal > 0 && !reviewing ? (
            <>
              {" · "}
              <Link href={withoutFirst ? "/prestataires/classer" : "/prestataires/classer?sans=1"}>{withoutFirst ? t("classify.byName") : t("classify.withoutFirst", { count: withoutProposal })}</Link>
            </>
          ) : null}
        </p>
        {selecting ? (
          <span className="row-wrap">
            <button ref={giveButton} type="button" className="button-secondary" disabled={selected.size === 0} aria-haspopup="dialog" aria-controls={give.id} onClick={() => give.open(giveButton.current)}>
              {t("classify.give")}
            </button>
            <button
              type="button"
              className="button-ghost"
              onClick={() => {
                setSelecting(false);
                setSelected(new Set());
              }}
            >
              {t("bulk.end")}
            </button>
          </span>
        ) : (
          <button type="button" className="button-ghost" onClick={() => setSelecting(true)}>
            {t("select")}
          </button>
        )}
      </div>
      <table className="vendor-table vendor-classify-table">
        <caption className="sr-only">{t("classify.caption")}</caption>
        <thead>
          <tr>
            {selecting ? (
              <th scope="col">
                <span className="sr-only">{t("columnSelect")}</span>
              </th>
            ) : null}
            <th scope="col">{t("classify.columnRecord")}</th>
            <th scope="col">{t("classify.columnTown")}</th>
            <th scope="col">{t("classify.columnTrade")}</th>
            <th scope="col">{t("classify.columnSource")}</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            const choice = choices[row.id] ?? "";
            const source = row.savedTypeId && choice === row.savedTypeId ? t("classify.sourceSaved") : row.proposal && choice === row.proposal.typeId ? t("classify.sourceName", { word: row.proposal.word }) : choice ? t("classify.sourceYou") : t("classify.sourceNothing");
            return (
              <tr key={row.id}>
                {selecting ? (
                  <td className="vendor-select-cell">
                    <label>
                      <input
                        type="checkbox"
                        checked={selected.has(row.id)}
                        onChange={() =>
                          setSelected((current) => {
                            const next = new Set(current);
                            if (next.has(row.id)) next.delete(row.id);
                            else next.add(row.id);
                            return next;
                          })
                        }
                      />
                      <span className="sr-only">{t("row.select", { vendor: row.name })}</span>
                    </label>
                  </td>
                ) : null}
                <td className="vendor-cell-name">
                  <Link href={`/prestataires/${row.id}`} className="vendor-name-link">
                    {row.name}
                  </Link>
                </td>
                <td>{row.city ?? <span className="muted">{t("classify.noTown")}</span>}</td>
                <td>
                  <label className="vendor-classify-choice">
                    <span className="sr-only">{t("classify.tradeOf", { vendor: row.name })}</span>
                    <select value={choice} onChange={(event) => setChoice(row.id, event.target.value)}>
                      <option value="">{t("classify.choose")}</option>
                      {options}
                    </select>
                  </label>
                </td>
                <td>
                  <span className="vendor-provenance" data-kind={choice ? "set" : "none"}>
                    {source}
                  </span>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>

      <TaskPopover handle={give} label={t("classify.giveTitle", { count: selected.size })} className="task-bulk-panel">
        <p className="task-popover-title">{t("classify.giveTitle", { count: selected.size })}</p>
        <ul className="task-popover-choices vendor-classify-give">
          {types.map((type, index) => (
            <li key={type.id}>
              <button
                type="button"
                className="task-popover-choice"
                {...(index === 0 ? { "data-autofocus": true } : {})}
                onClick={() => {
                  setChoices((current) => ({ ...current, ...Object.fromEntries([...selected].map((id) => [id, type.id])) }));
                  give.close();
                }}
              >
                <span>{type.label}</span>
                {type.group ? <span className="task-popover-choice-hint">{type.group}</span> : null}
              </button>
            </li>
          ))}
        </ul>
      </TaskPopover>

      {/* La barre d'enregistrement (D7) : ce qui sera écrit, et ce qui restera à classer. */}
      <div className="vendor-classify-bar" role="region" aria-label={t("classify.barLabel")}>
        <p className="vendor-classify-bar-text" aria-live="polite">
          {t("classify.toSave", { count: toSave.length })}
          {left > 0 ? ` · ${t("classify.left", { count: left })}` : null}
        </p>
        {error ? (
          <p className="field-error" role="alert">
            {error}
          </p>
        ) : null}
        <div className="row-wrap">
          <button type="button" className="button-ghost" onClick={() => (touched ? closeDialog.current?.showModal() : router.push("/prestataires"))}>
            {t("classify.close")}
          </button>
          <button type="button" className="button-primary" disabled={toSave.length === 0 || pending} onClick={save}>
            {t("classify.save", { count: toSave.length })}
          </button>
        </div>
      </div>

      <dialog ref={closeDialog} className="confirm-dialog" aria-labelledby="classify-close-title" aria-describedby="classify-close-body">
        <h2 id="classify-close-title">{t("classify.closeTitle")}</h2>
        <p id="classify-close-body">{t("classify.closeBody", { count: toSave.length })}</p>
        <div className="confirm-dialog-actions">
          <button type="button" autoFocus onClick={() => closeDialog.current?.close()}>
            {t("classify.keepGoing")}
          </button>
          <button type="button" className="button-danger confirm-dialog-confirm" onClick={() => router.push("/prestataires")}>
            {t("classify.closeConfirm")}
          </button>
        </div>
      </dialog>
    </div>
  );
}
