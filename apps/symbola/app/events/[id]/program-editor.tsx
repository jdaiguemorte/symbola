"use client";

// Lot 62c (UX-13, UX-05 ; décision D1) — le programme du jour J en liste éditable : un tableau, une
// ligne par séquence (début, fin, durée, séquence, lieu, qui) et deux actions de 44 px. « Modifier »
// ouvre la ligne en place, une seule à la fois. Rien ne part au serveur à la sortie d'un champ :
// les lignes modifiées et ajoutées attendent dans la barre du bas, qui dit leur nombre, et un seul
// « Enregistrer le programme » les écrit ensemble (une transaction). « Annuler les modifications »
// rend le programme enregistré. La suppression d'une séquence reste immédiate, avec son
// « Annuler » de dix secondes (UX-07).
import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import type { EventVendorSlot, ProgramItem } from "@/modules/events/service";
import { clock, durationText, endTimeAfter, minutesBetween, programSpans, type SpanWords } from "@/lib/program-spans";
import { FreeTextNotice } from "@/app/ui/free-text-notice";
import { removeProgramItemAction, saveProgramAction, type ProgramSaveInput } from "./program-actions";

export type MomentChoice = { id: string; label: string };
export type ProgramGroup = { id: string | null; label: string | null; items: ProgramItem[] };

type Draft = {
  startTime: string;
  endTime: string;
  // Lot 30b (CHR-06, D7) : la durée et l'heure de fin se calculent l'une l'autre.
  durationMinutes: string;
  label: string;
  location: string;
  internalNote: string;
  responsible: string;
  vendorSlotIds: string[];
  freeParticipants: string;
  // Lot 51 (EVT-04 ; D1) : le temps fort de la séquence (son jour) ; vide, le jour de l'évènement.
  keyMomentId: string;
  // Lot 63b (CHR-08 ; Q44) : cachée des mariés (leur espace, le programme diffusé, le PDF « mariés »).
  hiddenFromClients: boolean;
};

const EMPTY_DRAFT: Draft = { startTime: "", endTime: "", durationMinutes: "", label: "", location: "", internalNote: "", responsible: "", vendorSlotIds: [], freeParticipants: "", keyMomentId: "", hiddenFromClients: false };
const TEXT_FIELDS = ["startTime", "endTime", "durationMinutes", "label", "location", "internalNote", "responsible", "freeParticipants", "keyMomentId"] as const;

function draftOf(item: ProgramItem): Draft {
  return {
    startTime: item.startTime,
    endTime: item.endTime ?? "",
    durationMinutes: item.endTime ? String(minutesBetween(item.startTime, item.endTime)) : "",
    label: item.label,
    location: item.location ?? "",
    internalNote: item.internalNote ?? "",
    responsible: item.responsible ?? "",
    vendorSlotIds: item.participants.flatMap((participant) => (participant.vendorSlotId ? [participant.vendorSlotId] : [])),
    freeParticipants: item.participants
      .filter((participant) => participant.vendorSlotId === null)
      .map((participant) => participant.label)
      .join(", "),
    keyMomentId: item.keyMomentId ?? "",
    hiddenFromClients: item.hiddenFromClients,
  };
}

function sameDraft(a: Draft, b: Draft): boolean {
  return TEXT_FIELDS.every((field) => a[field] === b[field]) && a.hiddenFromClients === b.hiddenFromClients && a.vendorSlotIds.length === b.vendorSlotIds.length && a.vendorSlotIds.every((id) => b.vendorSlotIds.includes(id));
}

const validDuration = (value: string) => /^\d+$/.test(value) && Number(value) >= 1 && Number(value) <= 1440;
const VALID_TIME = /^([01]\d|2[0-3]):[0-5]\d$/;

function lineOf(draft: Draft): ProgramSaveInput["updates"][number]["item"] {
  return {
    startTime: draft.startTime,
    endTime: draft.endTime,
    durationMinutes: validDuration(draft.durationMinutes) ? Number(draft.durationMinutes) : null,
    label: draft.label,
    location: draft.location,
    internalNote: draft.internalNote,
    responsible: draft.responsible,
    vendorSlotIds: draft.vendorSlotIds,
    freeParticipants: draft.freeParticipants.split(","),
    keyMomentId: draft.keyMomentId === "" ? null : draft.keyMomentId,
    hiddenFromClients: draft.hiddenFromClients,
  };
}

type Row = { key: string; item: ProgramItem | null; draft: Draft; state: "saved" | "changed" | "new" };

function LineFields({
  draft,
  setDraft,
  vendorSlots,
  moments,
}: {
  draft: Draft;
  setDraft: (draft: Draft) => void;
  vendorSlots: EventVendorSlot[];
  moments: MomentChoice[];
}) {
  const t = useTranslations("Events");
  const set = (field: (typeof TEXT_FIELDS)[number]) => (event: { target: { value: string } }) => setDraft({ ...draft, [field]: event.target.value });
  // Lot 30b (CHR-06, D7) : le début garde la durée ; la fin donne la durée ; la durée donne la fin.
  const setStart = (event: { target: { value: string } }) => {
    const startTime = event.target.value;
    if (startTime && validDuration(draft.durationMinutes)) setDraft({ ...draft, startTime, endTime: endTimeAfter(startTime, Number(draft.durationMinutes)) });
    else setDraft({ ...draft, startTime });
  };
  const setEnd = (event: { target: { value: string } }) => {
    const endTime = event.target.value;
    const durationMinutes = endTime && draft.startTime ? String(minutesBetween(draft.startTime, endTime)) : endTime ? draft.durationMinutes : "";
    setDraft({ ...draft, endTime, durationMinutes });
  };
  const setDuration = (event: { target: { value: string } }) => {
    const durationMinutes = event.target.value;
    if (!durationMinutes) setDraft({ ...draft, durationMinutes, endTime: "" });
    else if (draft.startTime && validDuration(durationMinutes)) setDraft({ ...draft, durationMinutes, endTime: endTimeAfter(draft.startTime, Number(durationMinutes)) });
    else setDraft({ ...draft, durationMinutes });
  };

  return (
    <>
      <div className="field-row">
        <label className="field-fit">
          {t("programColStart")}
          <input type="time" required className="field-time" value={draft.startTime} onChange={setStart} />
        </label>
        <label className="field-fit">
          {t("programColEnd")}
          <input type="time" className="field-time" value={draft.endTime} onChange={setEnd} />
        </label>
        <label className="field-fit">
          {t("programFieldDuration")}
          <input type="number" className="field-short" min={1} max={1440} step={1} inputMode="numeric" value={draft.durationMinutes} onChange={setDuration} />
        </label>
        <label className="program-field-wide">
          {t("programColSequence")}
          <input type="text" required maxLength={300} value={draft.label} onChange={set("label")} />
        </label>
        <label>
          {t("programLocation")}
          <input type="text" maxLength={300} list="event-place-options" value={draft.location} onChange={set("location")} />
        </label>
      </div>
      <div className="field-row">
        {moments.length > 1 ? (
          <label>
            {t("programKeyMoment")}
            <select value={draft.keyMomentId} onChange={(event) => setDraft({ ...draft, keyMomentId: event.target.value })}>
              {draft.keyMomentId === "" ? <option value="">{t("programKeyMomentDefault")}</option> : null}
              {moments.map((moment) => (
                <option key={moment.id} value={moment.id}>
                  {moment.label}
                </option>
              ))}
            </select>
          </label>
        ) : null}
        <label>
          {t("programResponsible")}
          <input type="text" maxLength={120} list="program-responsible-options" value={draft.responsible} onChange={set("responsible")} />
        </label>
        <label>
          {t("programFreeParticipants")}
          <input type="text" value={draft.freeParticipants} onChange={set("freeParticipants")} />
        </label>
      </div>
      {vendorSlots.length > 0 ? (
        <fieldset className="program-slots">
          <legend>{t("programVendorParticipants")}</legend>
          <div className="program-slot-choices">
            {vendorSlots.map((slot) => (
              <label key={slot.id}>
                <input
                  type="checkbox"
                  checked={draft.vendorSlotIds.includes(slot.id)}
                  onChange={(event) => setDraft({ ...draft, vendorSlotIds: event.target.checked ? [...draft.vendorSlotIds, slot.id] : draft.vendorSlotIds.filter((id) => id !== slot.id) })}
                />
                {slot.label}
              </label>
            ))}
          </div>
        </fieldset>
      ) : null}
      <label className="program-hidden-field">
        <input type="checkbox" checked={draft.hiddenFromClients} onChange={(event) => setDraft({ ...draft, hiddenFromClients: event.target.checked })} />
        {t("programHiddenFromClients")}
        <span className="meta">{t("programHiddenFromClientsHint")}</span>
      </label>
      <label className="program-note-field">
        {t("programInternalNote")}
        <span className="meta">{t("programInternalNoteHint")}</span>
        <textarea name="internalNote" rows={2} maxLength={4000} value={draft.internalNote} onChange={set("internalNote")} />
      </label>
      <FreeTextNotice />
    </>
  );
}

export function ProgramEditor({
  eventId,
  title,
  groups,
  vendorSlots,
  moments,
}: {
  eventId: string;
  // Nom de la liste quand l'évènement n'a qu'un temps fort (« Programme du jour J »).
  title: string;
  groups: ProgramGroup[];
  vendorSlots: EventVendorSlot[];
  moments: MomentChoice[];
}) {
  const t = useTranslations("Events");
  const tDay = useTranslations("DayOf");
  const words: SpanWords = useMemo(
    () => ({
      minutes: (minutes) => tDay("durationMinutes", { minutes }),
      hours: (hours) => tDay("durationHours", { hours }),
      hoursMinutes: (hours, minutes) => tDay("durationHoursMinutes", { hours, minutes }),
      range: (start, end, duration) => tDay("fieldHours", { start, end, duration }),
    }),
    [tDay],
  );
  const [drafts, setDrafts] = useState<Record<string, Draft>>({});
  const [additions, setAdditions] = useState<{ key: string; draft: Draft }[]>([]);
  const [openKey, setOpenKey] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [savedCount, setSavedCount] = useState<number | null>(null);
  const [pending, startTransition] = useTransition();
  const router = useRouter();
  const nextKey = useRef(1);
  const root = useRef<HTMLDivElement>(null);

  const items = useMemo(() => groups.flatMap((group) => group.items), [groups]);
  // Une ligne redevenue comme elle était, ou supprimée entre-temps, ne compte plus.
  const changed = items.filter((item) => drafts[item.id] && !sameDraft(drafts[item.id]!, draftOf(item)));
  const filled = additions.filter((addition) => !sameDraft(addition.draft, EMPTY_DRAFT));
  const count = changed.length + filled.length;
  const dirty = count > 0;

  // Quitter ou recharger la page avec des lignes en attente : le navigateur demande confirmation.
  useEffect(() => {
    if (!dirty) return;
    const warn = (event: BeforeUnloadEvent) => event.preventDefault();
    // Un lien de l'app (onglet, menu) ferait perdre la saisie sans prévenir : même question.
    const guard = (event: MouseEvent) => {
      const link = (event.target as Element | null)?.closest?.("a[href]") as HTMLAnchorElement | null;
      if (!link || link.target === "_blank" || link.hasAttribute("download") || event.defaultPrevented) return;
      if (link.origin === window.location.origin && link.pathname === window.location.pathname && link.search === window.location.search) return;
      if (!window.confirm(t("programUnsavedConfirm"))) {
        event.preventDefault();
        event.stopPropagation();
      }
    };
    window.addEventListener("beforeunload", warn);
    document.addEventListener("click", guard, true);
    return () => {
      window.removeEventListener("beforeunload", warn);
      document.removeEventListener("click", guard, true);
    };
  }, [dirty, t]);

  // La ligne qui s'ouvre prend le focus (lecteurs d'écran, clavier) ; refermée, il revient à son
  // bouton « Modifier ».
  const lastOpen = useRef<string | null>(null);
  useEffect(() => {
    const target = openKey ? `[data-open-line="${openKey}"]` : lastOpen.current ? `[data-edit-line="${lastOpen.current}"]` : null;
    if (target) root.current?.querySelector<HTMLElement>(target)?.focus();
    lastOpen.current = openKey;
  }, [openKey]);

  const rowOf = (item: ProgramItem): Row => {
    const draft = drafts[item.id];
    const original = draftOf(item);
    return { key: item.id, item, draft: draft ?? original, state: draft && !sameDraft(draft, original) ? "changed" : "saved" };
  };
  const firstGroupId = groups[0]?.id ?? null;
  const groupOfAddition = (draft: Draft) => (groups.some((group) => group.id === draft.keyMomentId) ? draft.keyMomentId : firstGroupId);
  const tables = (groups.length > 0 ? groups : additions.length > 0 ? [{ id: null, label: null, items: [] }] : []).map((group) => ({
    ...group,
    rows: [
      ...group.items.map(rowOf),
      ...additions.filter((addition) => groups.length === 0 || groupOfAddition(addition.draft) === group.id).map((addition): Row => ({ key: addition.key, item: null, draft: addition.draft, state: "new" })),
    ],
  }));

  const setDraft = (row: Row) => (draft: Draft) => {
    setSavedCount(null);
    if (row.item) setDrafts((current) => ({ ...current, [row.key]: draft }));
    else setAdditions((current) => current.map((addition) => (addition.key === row.key ? { ...addition, draft } : addition)));
  };
  const add = () => {
    const key = `nouvelle-${nextKey.current++}`;
    setAdditions((current) => [...current, { key, draft: EMPTY_DRAFT }]);
    setOpenKey(key);
    setSavedCount(null);
    setError(null);
  };
  const discard = (row: Row) => {
    if (row.item) setDrafts((current) => Object.fromEntries(Object.entries(current).filter(([key]) => key !== row.key)));
    else setAdditions((current) => current.filter((addition) => addition.key !== row.key));
    if (openKey === row.key) setOpenKey(null);
    setError(null);
  };
  const cancelAll = () => {
    setDrafts({});
    setAdditions([]);
    setOpenKey(null);
    setError(null);
  };
  const save = () => {
    // Une ligne sans heure de début ou sans intitulé s'ouvre, avec ce qui manque.
    const incomplete = [...changed.map((item) => ({ key: item.id, draft: drafts[item.id]! })), ...filled].find(({ draft }) => !VALID_TIME.test(draft.startTime) || draft.label.trim() === "");
    if (incomplete) {
      setOpenKey(incomplete.key);
      setError(t("programSaveIncomplete"));
      return;
    }
    startTransition(async () => {
      setError(null);
      const result = await saveProgramAction({
        eventId,
        updates: changed.map((item) => ({ itemId: item.id, item: lineOf(drafts[item.id]!) })),
        additions: filled.map((addition) => ({ key: addition.key, item: lineOf(addition.draft) })),
      });
      if (!result.ok) {
        setError(result.error);
        if (result.line) setOpenKey(result.line);
        return;
      }
      setDrafts({});
      setAdditions([]);
      setOpenKey(null);
      setSavedCount(result.count);
      // Lot 30b (CHR-06, D8) : une seule séquence a changé d'heure, la fiche propose de décaler les suivantes.
      if (result.shift) router.replace(`/events/${eventId}?${new URLSearchParams({ onglet: "programme", decalage: result.shift.itemId, depuis: result.shift.from }).toString()}#program-title`, { scroll: false });
    });
  };

  const spanOf = (rows: Row[]) => {
    const timed = rows.filter((row) => VALID_TIME.test(row.draft.startTime));
    const spans = programSpans(timed.map((row) => ({ id: row.key, startTime: row.draft.startTime, endTime: VALID_TIME.test(row.draft.endTime) ? row.draft.endTime : null })));
    return new Map(spans.map((span) => [span.id, span]));
  };

  return (
    <div className="program-editor" ref={root}>
      {tables.map((table) => {
        const spans = spanOf(table.rows);
        const name = groups.length > 1 ? (table.label ?? title) : title;
        return (
          <section key={table.id ?? "sans-temps-fort"} aria-label={groups.length > 1 ? name : undefined} className="program-moment">
            {table.label && groups.length > 1 ? <h3>{table.label}</h3> : null}
            <div className="edit-list program-table" role="table" aria-label={name}>
              <div className="edit-list-head program-cols" role="row">
                <span role="columnheader">{t("programColStart")}</span>
                <span role="columnheader">{t("programColEnd")}</span>
                <span role="columnheader">{t("programColDuration")}</span>
                <span role="columnheader">{t("programColSequence")}</span>
                <span role="columnheader">{t("programLocation")}</span>
                <span role="columnheader">{t("programColWho")}</span>
                <span role="columnheader">{t("programColActions")}</span>
              </div>
              {table.rows.map((row) => {
                const span = spans.get(row.key);
                const label = row.draft.label.trim() || t("programNewLine");
                const who = [
                  ...vendorSlots.filter((slot) => row.draft.vendorSlotIds.includes(slot.id)).map((slot) => slot.label),
                  ...row.draft.freeParticipants.split(",").map((name) => name.trim()).filter(Boolean),
                ];
                if (openKey === row.key) {
                  return (
                    <div key={row.key} role="row">
                      <div role="cell">
                        <div role="group" className="edit-row-open" aria-label={t("editProgramItem", { label: row.item?.label ?? t("programNewLine") })} tabIndex={-1} data-open-line={row.key}>
                        <LineFields draft={row.draft} setDraft={setDraft(row)} vendorSlots={vendorSlots} moments={moments} />
                        <div className="row-wrap">
                          <button type="button" className="button-secondary" onClick={() => setOpenKey(null)}>
                            {t("programCloseLine")}
                          </button>
                          {row.state !== "saved" ? (
                            <button type="button" className="button-ghost" onClick={() => discard(row)}>
                              {t(row.item ? "programRevertLine" : "programDropLine")}
                            </button>
                          ) : null}
                        </div>
                        </div>
                      </div>
                    </div>
                  );
                }
                return (
                  <div key={row.key} role="row" className="edit-row program-cols program-line">
                    <span role="cell" className="program-time program-start">
                      {span ? clock(span.start) : row.draft.startTime}
                    </span>
                    <span role="cell" className="program-end">
                      {span && !span.openEnded ? clock(span.end) : ""}
                    </span>
                    <span role="cell" className="program-duration">
                      {span && !span.openEnded ? durationText(span.end - span.start, words) : ""}
                    </span>
                    <span role="cell" className="program-main">
                      <strong>{label}</strong>
                      {row.state !== "saved" ? <span className="badge badge-ambre">{t(row.state === "new" ? "programLineNew" : "programLineChanged")}</span> : null}
                      {row.draft.hiddenFromClients ? <span className="badge">{t("programHiddenBadge")}</span> : null}
                      {row.draft.internalNote.trim() ? (
                        <span className="program-note">
                          {t("programInternalNote")} : {row.draft.internalNote.trim()}
                        </span>
                      ) : null}
                    </span>
                    <span role="cell" className="program-place">
                      {row.draft.location}
                    </span>
                    <span role="cell" className="program-who">
                      {row.draft.responsible.trim() ? <span>{t("programResponsibleLine", { name: row.draft.responsible.trim() })}</span> : null}
                      {who.length > 0 ? <span>{who.join(", ")}</span> : null}
                    </span>
                    <span role="cell" className="row-actions">
                      <button type="button" className="button-ghost" aria-label={t("editProgramItem", { label })} data-edit-line={row.key} onClick={() => setOpenKey(row.key)}>
                        {t("edit")}
                      </button>
                      {row.item ? (
                        <form action={removeProgramItemAction}>
                          <input type="hidden" name="eventId" value={eventId} />
                          <input type="hidden" name="itemId" value={row.item.id} />
                          <button type="submit" className="button-ghost program-remove" aria-label={t("removeProgramLine", { label })}>
                            {t("remove")}
                          </button>
                        </form>
                      ) : (
                        <button type="button" className="button-ghost program-remove" aria-label={t("removeProgramLine", { label })} onClick={() => discard(row)}>
                          {t("remove")}
                        </button>
                      )}
                    </span>
                  </div>
                );
              })}
            </div>
          </section>
        );
      })}
      <div className="row-wrap">
        <button type="button" className="button-secondary" onClick={add}>
          {t("programAddLine")}
        </button>
      </div>
      {error ? (
        <p role="alert" className="notice notice-error">
          {error}
        </p>
      ) : null}
      {dirty ? (
        <div className="edit-bar">
          <p role="status">{t("programPending", { count })}</p>
          <div className="row-wrap">
            <button type="button" className="button-secondary" onClick={cancelAll} disabled={pending}>
              {t("programCancelChanges")}
            </button>
            <button type="button" className="button-primary" onClick={save} disabled={pending}>
              {t("programSave")}
            </button>
          </div>
        </div>
      ) : savedCount !== null ? (
        <p role="status" className="notice">
          {t("programSaved", { count: savedCount })}
        </p>
      ) : null}
    </div>
  );
}
