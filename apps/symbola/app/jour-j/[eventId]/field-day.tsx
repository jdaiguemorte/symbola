"use client";

// Lot 30a (JRJ-01, JRJ-03, UX-05 ; décisions D2, D3 et D5) — écran de terrain du jour J :
// « Maintenant » et « Ensuite » en gros caractères, calculés sur l'appareil à l'heure
// de l'évènement et remis à jour chaque demi-minute (sans réseau aussi) ; barre du bas dans
// la zone du pouce : l'appel du contact de la séquence en cours, et quatre onglets.
// Lot 51 (EVT-04, JRJ-05 à JRJ-09, ARC-09 ; D2 à D5, ADR 0091) : un jour par onglet (le jour en
// cours d'abord) ; « Commencé » puis « Terminé » d'un toucher ; un retard propose de décaler la suite
// du temps fort et de prévenir les prestataires concernés, rien n'est envoyé sans validation ; le
// bouton « Incident » toujours visible ; listes de contrôle et remises du jour. Toute écriture passe
// par la file de l'appareil (même sans réseau) ; l'état de l'équipe se relit toutes les 15 secondes.
import { useEffect, useMemo, useState } from "react";
import { useFormatter, useTranslations } from "next-intl";
import type { DayCheckpointKind, DayIncidentSeverity, DayPhotoSubject } from "@symbola/contracts";
import { DAY_INCIDENT_MAX, DAY_INCIDENT_SEVERITIES } from "@symbola/contracts";
import { concernedVendorSlots, openingDay, proposeDayShift, zonedDate } from "@/lib/day-of/rules";
import { overlayDayState } from "@/lib/day-of/overlay";
import { reducePhoto } from "@/lib/offline/photo";
import { programSpans } from "@/lib/program-spans";
import { dayMoment, durationParts, timelineSpans, type DayMoment } from "./day-timeline";
import { useDaySync, type DaySnapshot } from "./use-day-sync";

export type FieldCall = { name: string; phone: string; tel: string };
export type FieldItem = {
  id: string;
  startTime: string;
  endTime: string | null;
  label: string;
  location: string | null;
  note: string | null;
  responsible: string | null;
  participants: string;
  calls: FieldCall[];
  // Lot 51 : temps fort de la séquence (son jour) et postes prestataires (prévenus d'un décalage).
  keyMomentId: string | null;
  vendorSlotIds: string[];
};
export type FieldMoment = { id: string; name: string; date: string };
export type FieldVendor = { slotId: string; names: string[]; notifiable: boolean };
export type FieldSettings = { shiftThresholdMinutes: number; photoMaxSide: number; refreshSeconds: number };

type ShiftDraft = { lateItemId: string; keyMomentId: string | null; label: string; minutes: number; candidates: string[]; itemIds: Set<string>; excludedSlots: Set<string> };

function clock(minutes: number): string {
  const wrapped = ((minutes % 1440) + 1440) % 1440;
  return `${String(Math.floor(wrapped / 60)).padStart(2, "0")}:${String(wrapped % 60).padStart(2, "0")}`;
}

function newActionId(): string {
  return crypto.randomUUID();
}

export function FieldDay(props: {
  eventId: string;
  userId: string;
  eventDate: string;
  timeZone: string;
  items: FieldItem[];
  moments: FieldMoment[];
  days: { date: string; label: string }[];
  vendors: FieldVendor[];
  presentByMoment: Record<string, number>;
  initial: DaySnapshot;
  settings: FieldSettings;
  showHandovers: boolean;
}) {
  const t = useTranslations("DayOf");
  const format = useFormatter();
  const { eventId, userId, eventDate, timeZone, settings } = props;
  const sync = useDaySync({ eventId, userId, initial: props.initial, refreshSeconds: settings.refreshSeconds });
  const [now, setNow] = useState<Date | null>(null);
  const [day, setDay] = useState<string>(props.days[0]?.date ?? eventDate);
  const [shift, setShift] = useState<ShiftDraft | null>(null);
  const [declined, setDeclined] = useState<Set<string>>(new Set());
  const [notice, setNotice] = useState<string | null>(null);
  const [incidentOpen, setIncidentOpen] = useState(false);

  useEffect(() => {
    const current = new Date();
    setNow(current);
    setDay(openingDay(props.days.map((entry) => entry.date), zonedDate(current, timeZone)) ?? eventDate);
    const timer = setInterval(() => setNow(new Date()), 30_000);
    return () => clearInterval(timer);
    // Le jour d'ouverture se choisit une fois.
  }, []);

  const view = useMemo(
    () => overlayDayState({ state: sync.snapshot.state, items: sync.snapshot.items, handovers: sync.snapshot.handovers, pending: sync.pending, userId }),
    [sync.snapshot, sync.pending, userId],
  );
  // Les heures du programme : celles du serveur (après décalage) et des décalages encore en file.
  const items = useMemo(() => {
    const times = new Map(view.items.map((entry) => [entry.id, entry]));
    return props.items.map((item) => ({ ...item, ...(times.get(item.id) ? { startTime: times.get(item.id)!.startTime, endTime: times.get(item.id)!.endTime } : {}) }));
  }, [props.items, view.items]);
  const momentDate = new Map(props.moments.map((moment) => [moment.id, moment.date]));
  const dateOf = (item: FieldItem) => (item.keyMomentId ? (momentDate.get(item.keyMomentId) ?? eventDate) : eventDate);
  const dayItems = items.filter((item) => dateOf(item) === day);
  const dayMoments = props.moments.filter((moment) => moment.date === day);
  const actualOf = new Map(view.actuals.map((actual) => [actual.itemId, actual]));
  const people = new Map(sync.snapshot.state.people.map((person) => [person.id, person.name]));
  const who = (id: string | null) => (id === userId ? t("you") : (people.get(id ?? "") ?? t("teammate")));
  const timeOf = (iso: string) => new Intl.DateTimeFormat(undefined, { timeZone, hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(new Date(iso));

  const spans = new Map(timelineSpans(dayItems).map((span) => [span.id, span]));
  const byId = new Map(dayItems.map((item) => [item.id, item]));
  const moment: DayMoment | null = now ? dayMoment(dayItems, day, now, timeZone) : null;
  const duration = (minutes: number) => {
    const { hours, minutes: rest } = durationParts(minutes);
    return hours === 0 ? t("durationMinutes", { minutes: rest }) : rest === 0 ? t("durationHours", { hours }) : t("durationHoursMinutes", { hours, minutes: rest });
  };
  const hoursOf = (id: string) => {
    const span = spans.get(id)!;
    return t("fieldHours", { start: clock(span.start), end: clock(span.end), duration: duration(span.end - span.start) });
  };

  const current = moment?.phase === "now" ? byId.get(moment.currentId) : undefined;
  const nextId = moment?.phase === "now" || moment?.phase === "pause" || moment?.phase === "before" ? moment.nextId : null;
  const next = nextId ? byId.get(nextId) : undefined;
  const primaryCall = current?.calls[0];
  const currentMoment = current?.keyMomentId ?? dayMoments[0]?.id ?? null;
  const present = currentMoment ? props.presentByMoment[currentMoment] : undefined;

  // —— Pointage et décalage (JRJ-05) ——————————————————————————————————————————————————————
  async function point(item: FieldItem, checkpoint: DayCheckpointKind) {
    const at = new Date();
    const actionId = newActionId();
    await sync.enqueue({ actionId, action: { kind: "checkpoint", actionId, deviceAt: at.toISOString(), itemId: item.id, checkpoint } });
    // Un décalage déjà proposé pour cette séquence (refusé ou validé) ne se repropose pas.
    if (declined.has(item.id) || sync.snapshot.state.shifts.some((entry) => entry.lateItemId === item.id) || sync.pending.some((entry) => entry.action?.kind === "shift" && entry.action.lateItemId === item.id)) return;
    const proposal = proposeDayShift({
      items: items.map((entry) => ({ id: entry.id, keyMomentId: entry.keyMomentId, startTime: entry.startTime, endTime: entry.endTime, vendorSlotIds: entry.vendorSlotIds })),
      lateItemId: item.id,
      checkpoint,
      actualAt: at,
      momentDate: dateOf(item),
      timeZone,
      thresholdMinutes: settings.shiftThresholdMinutes,
    });
    if (proposal) setShift({ lateItemId: item.id, keyMomentId: item.keyMomentId, label: item.label, minutes: proposal.minutes, candidates: proposal.itemIds, itemIds: new Set(proposal.itemIds), excludedSlots: new Set() });
  }

  const shiftSlots = shift ? concernedVendorSlots(items.map((entry) => ({ id: entry.id, keyMomentId: entry.keyMomentId, startTime: entry.startTime, endTime: entry.endTime, vendorSlotIds: entry.vendorSlotIds })), [...shift.itemIds]) : [];
  const vendorOf = new Map(props.vendors.map((vendor) => [vendor.slotId, vendor]));
  const notified = shift ? shiftSlots.filter((slot) => !shift.excludedSlots.has(slot) && vendorOf.get(slot)?.notifiable) : [];

  async function validateShift() {
    if (!shift || shift.itemIds.size === 0 || shift.minutes < 1) return;
    const actionId = newActionId();
    await sync.enqueue({
      actionId,
      action: { kind: "shift", actionId, deviceAt: new Date().toISOString(), keyMomentId: shift.keyMomentId, lateItemId: shift.lateItemId, minutes: shift.minutes, itemIds: [...shift.itemIds], vendorSlotIds: notified },
    });
    setNotice(navigator.onLine ? t("shiftSent", { minutes: shift.minutes, count: notified.length }) : t("shiftQueued", { count: notified.length }));
    setDeclined(new Set([...declined, shift.lateItemId]));
    setShift(null);
  }

  function declineShift() {
    if (shift) setDeclined(new Set([...declined, shift.lateItemId]));
    setShift(null);
  }

  // —— Photos (JRJ-06, JRJ-07, JRJ-09) ————————————————————————————————————————————————————
  async function attachPhoto(file: File | undefined, subject: DayPhotoSubject, target: { subjectId?: string; subjectActionId?: string }) {
    if (!file) return;
    const blob = await reducePhoto(file, settings.photoMaxSide);
    const actionId = newActionId();
    await sync.enqueue({ actionId, photo: { meta: { actionId, deviceAt: new Date().toISOString(), subject, subjectId: target.subjectId ?? null, subjectActionId: target.subjectActionId ?? null }, blob } });
    setNotice(t("photoAdded"));
  }

  const pendingCount = sync.pending.length;
  const statusText =
    sync.status === "session"
      ? t("syncSession", { count: pendingCount })
      : pendingCount > 0
        ? sync.status === "offline" || (typeof navigator !== "undefined" && !navigator.onLine)
          ? t("syncOffline", { count: pendingCount })
          : t("syncPending", { count: pendingCount })
        : t("syncDone");

  const pointButtons = (item: FieldItem, large: boolean) => {
    const actual = actualOf.get(item.id);
    return (
      <div className="field-point">
        {actual?.startedAt ? (
          <p className="field-line">
            {t("startedAt", { time: timeOf(actual.startedAt), name: who(actual.startedBy) })}
            {view.pendingCheckpoints.has(`${item.id}:started`) ? ` ${t("pendingMark")}` : ""}
          </p>
        ) : (
          <button type="button" className={large ? "field-action" : "field-point-button"} onClick={() => void point(item, "started")} aria-label={t("startLabel", { label: item.label })}>
            {t("started")}
          </button>
        )}
        {actual?.finishedAt ? (
          <p className="field-line">
            {t("finishedAt", { time: timeOf(actual.finishedAt), name: who(actual.finishedBy) })}
            {view.pendingCheckpoints.has(`${item.id}:finished`) ? ` ${t("pendingMark")}` : ""}
          </p>
        ) : actual?.startedAt ? (
          <button type="button" className={large ? "field-action" : "field-point-button"} onClick={() => void point(item, "finished")} aria-label={t("finishLabel", { label: item.label })}>
            {t("finished")}
          </button>
        ) : null}
      </div>
    );
  };

  return (
    <>
      <p role="status" className={`field-sync${pendingCount > 0 ? " field-sync-pending" : ""}`} data-pending={pendingCount}>
        {statusText}
        {sync.status === "session" ? (
          <>
            {" "}
            <a href={`/login?retour=/jour-j/${eventId}`}>{t("copyLogin")}</a>
          </>
        ) : null}
      </p>
      {sync.lastResult && sync.lastResult.rejected.length > 0 ? <p className="field-alert">{t("syncRejected", { count: sync.lastResult.rejected.length })}</p> : null}
      {sync.lastResult && sync.lastResult.refusedPhotos.length > 0 ? (
        <p className="field-alert">{t("photoRefused", { reason: t(`photoRejection.${sync.lastResult.refusedPhotos[0]!.rejection}` as "photoRejection.type") })}</p>
      ) : null}
      {notice ? <p className="field-notice">{notice}</p> : null}

      {props.days.length > 1 ? (
        <nav className="field-days" aria-label={t("daysLabel")}>
          {props.days.map((entry) => (
            <button key={entry.date} type="button" aria-pressed={entry.date === day} className={entry.date === day ? "primary" : undefined} onClick={() => setDay(entry.date)}>
              {entry.label}
            </button>
          ))}
        </nav>
      ) : null}

      {shift ? (
        <section className="field-card field-shift" role="dialog" aria-labelledby="field-shift-title">
          <h2 id="field-shift-title" className="field-kicker">
            {t("shiftTitle", { minutes: shift.minutes })}
          </h2>
          <p className="field-line">{t("shiftIntro", { label: shift.label, minutes: shift.minutes })}</p>
          <label className="field-input">
            {t("shiftMinutes")}
            <input type="number" inputMode="numeric" min={1} max={720} value={shift.minutes} onChange={(change) => setShift({ ...shift, minutes: Math.max(0, Math.min(720, Number(change.target.value) || 0)) })} />
          </label>
          <fieldset className="field-choices">
            <legend>{t("shiftItems")}</legend>
            <p className="meta">{t("shiftFixedHint")}</p>
            {shift.candidates.map((id) => {
              const entry = items.find((candidate) => candidate.id === id);
              if (!entry) return null;
              return (
                <label key={id} className="field-choice">
                  <input
                    type="checkbox"
                    checked={shift.itemIds.has(id)}
                    onChange={(change) => {
                      const chosen = new Set(shift.itemIds);
                      if (change.target.checked) chosen.add(id);
                      else chosen.delete(id);
                      setShift({ ...shift, itemIds: chosen });
                    }}
                  />
                  {entry.startTime} · {entry.label}
                </label>
              );
            })}
          </fieldset>
          <fieldset className="field-choices">
            <legend>{t("shiftVendors")}</legend>
            {shiftSlots.length === 0 ? <p className="meta">{t("shiftNoVendor")}</p> : null}
            {shiftSlots.map((slot) => {
              const vendor = vendorOf.get(slot);
              const names = vendor?.names.join(", ") || t("vendorUnknown");
              if (!vendor?.notifiable) return <p key={slot} className="meta">{t("shiftNoLink", { name: names })}</p>;
              return (
                <label key={slot} className="field-choice">
                  <input
                    type="checkbox"
                    checked={!shift.excludedSlots.has(slot)}
                    onChange={(change) => {
                      const excluded = new Set(shift.excludedSlots);
                      if (change.target.checked) excluded.delete(slot);
                      else excluded.add(slot);
                      setShift({ ...shift, excludedSlots: excluded });
                    }}
                  />
                  {names}
                </label>
              );
            })}
          </fieldset>
          <div className="field-buttons">
            <button type="button" className="primary" onClick={() => void validateShift()} disabled={shift.itemIds.size === 0 || shift.minutes < 1}>
              {t("shiftValidate", { count: notified.length })}
            </button>
            <button type="button" onClick={declineShift}>
              {t("shiftRefuse")}
            </button>
          </div>
        </section>
      ) : null}

      <section id="maintenant" className="field-cards" aria-label={t("fieldSection")}>
        <article className="field-card field-card-now" aria-labelledby="field-now-title">
          <h2 id="field-now-title" className="field-kicker">
            {t("nowTitle")}
          </h2>
          {moment === null ? (
            <p className="field-now">…</p>
          ) : moment.phase === "now" && current ? (
            <>
              <p className="field-now">{current.label}</p>
              <p className="field-line">{hoursOf(current.id)}</p>
              {current.location ? <p className="field-line">{current.location}</p> : null}
              {current.participants ? <p className="field-line">{current.participants}</p> : null}
              {current.responsible ? <p className="field-line">{t("responsible", { name: current.responsible })}</p> : null}
              {current.note ? <p className="field-note">{current.note}</p> : null}
              <p className="field-line">{t("remaining", { duration: duration(moment.endsInMinutes) })}</p>
              {present !== undefined ? <p className="field-line">{t("present", { count: present })}</p> : null}
              {pointButtons(current, true)}
              {current.calls.length > 0 ? (
                <ul className="field-calls">
                  {current.calls.map((call) => (
                    <li key={call.tel + call.name}>
                      <a className="field-action" href={call.tel} aria-label={t("callLabel", { name: call.name, phone: call.phone })}>
                        {t("callName", { name: call.name })}
                      </a>
                    </li>
                  ))}
                </ul>
              ) : null}
            </>
          ) : moment.phase === "pause" ? (
            <>
              <p className="field-now">{t("pause")}</p>
              <p className="field-line">{t("pauseUntil", { time: clock(spans.get(moment.nextId)!.start) })}</p>
            </>
          ) : moment.phase === "before" ? (
            <p className="field-now">{moment.daysUntil === 1 ? t("beforeTomorrow") : t("beforeDays", { days: moment.daysUntil })}</p>
          ) : moment.phase === "over" ? (
            <p className="field-now">{t("over")}</p>
          ) : (
            <p className="field-now">{t("programEmpty")}</p>
          )}
        </article>
        <article className="field-card" aria-labelledby="field-next-title">
          <h2 id="field-next-title" className="field-kicker">
            {t("nextTitle")}
          </h2>
          {next ? (
            <>
              <p className="field-next">{next.label}</p>
              <p className="field-line">
                {moment && (moment.phase === "now" || moment.phase === "pause") && moment.nextStartsInMinutes !== null
                  ? t("nextAt", { time: clock(spans.get(next.id)!.start), duration: duration(moment.nextStartsInMinutes) })
                  : hoursOf(next.id)}
              </p>
              {next.location ? <p className="field-line">{next.location}</p> : null}
              {next.participants ? <p className="field-line">{next.participants}</p> : null}
            </>
          ) : (
            <p className="field-line">{moment === null ? "…" : t("nothingNext")}</p>
          )}
        </article>
      </section>

      <section id="programme" className="card" aria-labelledby="day-program-title">
        <h2 id="day-program-title">{t("programTitle")}</h2>
        {dayItems.length === 0 ? (
          <p>{t("programEmpty")}</p>
        ) : (
          (dayMoments.length > 0 ? [...dayMoments.map((entry) => ({ id: entry.id as string | null, name: entry.name })), { id: null, name: "" }] : [{ id: null as string | null, name: "" }]).map((group) => {
            const groupItems = dayItems.filter((item) => (dayMoments.length > 0 ? (item.keyMomentId ?? null) === group.id || (group.id === null && !dayMoments.some((entry) => entry.id === item.keyMomentId)) : true));
            if (groupItems.length === 0) return null;
            const groupSpans = new Map(programSpans(groupItems).map((span) => [span.id, span]));
            return (
              <div key={group.id ?? "sans"} className="field-moment">
                {group.name && dayMoments.length > 1 ? <h3>{group.name}</h3> : null}
                <ol className="day-program">
                  {[...groupItems]
                    .sort((a, b) => groupSpans.get(a.id)!.start - groupSpans.get(b.id)!.start)
                    .map((item) => {
                      const span = groupSpans.get(item.id)!;
                      return (
                        <li key={item.id}>
                          <p className="day-program-time">
                            {span.openEnded ? item.startTime : t("timeRange", { start: item.startTime, end: clock(span.end) })}
                            {span.openEnded ? null : <span className="meta">{duration(span.end - span.start)}</span>}
                          </p>
                          <div>
                            <p className="day-program-label">{item.label}</p>
                            {item.location ? <p>{item.location}</p> : null}
                            {item.responsible ? <p>{t("responsible", { name: item.responsible })}</p> : null}
                            {item.participants ? (
                              <p>
                                {t("participants")} {item.participants}
                              </p>
                            ) : null}
                            {item.note ? (
                              <p className="day-program-note">
                                {t("note")} {item.note}
                              </p>
                            ) : null}
                            {pointButtons(item, false)}
                          </div>
                        </li>
                      );
                    })}
                </ol>
              </div>
            );
          })
        )}
      </section>

      <section id="main-courante" className="card" aria-labelledby="day-log-title">
        <h2 id="day-log-title">{t("logTitle")}</h2>
        {view.incidents.length === 0 ? (
          <p>{t("logEmpty")}</p>
        ) : (
          <ul className="day-list field-log">
            {view.incidents.map((incident) => (
              <li key={incident.actionId}>
                <p className="day-list-name">
                  {timeOf(incident.deviceAt)} · {who(incident.userId)}
                  {incident.severity ? <span className={`field-severity field-severity-${incident.severity}`}>{t(`severity.${incident.severity}`)}</span> : null}
                  {incident.pending ? <span className="meta"> {t("pendingMark")}</span> : null}
                </p>
                <p className="field-log-body">{incident.body}</p>
                {incident.photos.map((photo) =>
                  photo.state === "stored" ? (
                    <a key={photo.id} href={`/jour-j/${eventId}/photos/${photo.id}`} target="_blank" rel="noreferrer">
                      {t("logPhoto")}
                    </a>
                  ) : (
                    <p key={photo.id} className="meta">
                      {t("photoRefused", { reason: t(`photoRejection.${photo.rejection ?? "unavailable"}` as "photoRejection.type") })}
                    </p>
                  ),
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section id="listes" className="card" aria-labelledby="day-lists-title">
        <h2 id="day-lists-title">{t("checklistsTitle")}</h2>
        {view.checklists.filter((list) => list.keyMomentId === null || dayMoments.some((entry) => entry.id === list.keyMomentId)).length === 0 ? <p>{t("checklistsEmpty")}</p> : null}
        {view.checklists
          .filter((list) => list.keyMomentId === null || dayMoments.some((entry) => entry.id === list.keyMomentId))
          .map((list) => (
            <div key={list.id} className="field-checklist">
              <h3>
                {list.name} <span className="meta">· {t(`phase.${list.phase}`)}</span>
              </h3>
              <ul className="field-check-items">
                {list.items.map((item) => (
                  <li key={item.id}>
                    <button
                      type="button"
                      role="checkbox"
                      aria-checked={item.checkedAt !== null}
                      className="field-check"
                      disabled={item.checkedAt !== null}
                      onClick={() => {
                        const actionId = newActionId();
                        void sync.enqueue({ actionId, action: { kind: "check", actionId, deviceAt: new Date().toISOString(), checklistItemId: item.id } });
                      }}
                    >
                      <span aria-hidden="true" className="field-check-box">
                        {item.checkedAt ? "✓" : ""}
                      </span>
                      {item.label}
                    </button>
                    {item.checkedAt ? (
                      <p className="meta">
                        {t("checkedAt", { time: timeOf(item.checkedAt), name: who(item.checkedBy) })}
                        {item.pending ? ` ${t("pendingMark")}` : ""}
                      </p>
                    ) : null}
                    <PhotoInput label={t("photoOf", { label: item.label })} text={t("photo")} onFile={(file) => void attachPhoto(file, "checklist_item", { subjectId: item.id })} />
                    {item.photos.map((photo) =>
                      photo.state === "stored" ? (
                        <a key={photo.id} href={`/jour-j/${eventId}/photos/${photo.id}`} target="_blank" rel="noreferrer">
                          {t("logPhoto")}
                        </a>
                      ) : (
                        <p key={photo.id} className="meta">
                          {t("photoRefused", { reason: t(`photoRejection.${photo.rejection ?? "unavailable"}` as "photoRejection.type") })}
                        </p>
                      ),
                    )}
                  </li>
                ))}
              </ul>
            </div>
          ))}
      </section>

      {props.showHandovers && view.handovers ? (
        <section id="remises" className="card" aria-labelledby="day-handovers-title">
          <h2 id="day-handovers-title">{t("handoversTitle")}</h2>
          {view.handovers.length === 0 ? (
            <p>{t("handoversEmpty")}</p>
          ) : (
            <ul className="day-list">
              {view.handovers.map((handover) => (
                <li key={handover.paymentId}>
                  <p className="day-list-name">
                    {handover.vendorName ?? handover.slotLabel} · {format.number(handover.amountCents / 100, { style: "currency", currency: "EUR" })}
                  </p>
                  <p className="meta">{[handover.label, handover.method, handover.by ? t("handoverBy", { name: handover.by }) : null].filter(Boolean).join(" · ")}</p>
                  {handover.handedOverAt ? (
                    <p className="field-line">
                      {t("handedOverAt", { time: timeOf(handover.handedOverAt), name: who(handover.handedOverBy) })}
                      {handover.pending ? ` ${t("pendingMark")}` : ""}
                    </p>
                  ) : (
                    <button
                      type="button"
                      className="field-point-button"
                      aria-label={t("handoverLabel", { vendor: handover.vendorName ?? handover.slotLabel })}
                      onClick={() => {
                        const actionId = newActionId();
                        void sync.enqueue({ actionId, action: { kind: "handover", actionId, deviceAt: new Date().toISOString(), paymentId: handover.paymentId } });
                      }}
                    >
                      {t("handoverDone")}
                    </button>
                  )}
                  <PhotoInput label={t("receiptOf", { vendor: handover.vendorName ?? handover.slotLabel })} text={t("receipt")} onFile={(file) => void attachPhoto(file, "handover", { subjectId: handover.paymentId })} />
                </li>
              ))}
            </ul>
          )}
        </section>
      ) : null}

      {incidentOpen ? (
        <IncidentSheet
          onClose={() => setIncidentOpen(false)}
          onSave={async (body, severity, photo) => {
            const actionId = newActionId();
            const at = new Date();
            await sync.enqueue({ actionId, action: { kind: "incident", actionId, deviceAt: at.toISOString(), body, severity, keyMomentId: currentMoment } });
            if (photo) await attachPhoto(photo, "incident", { subjectActionId: actionId });
            setIncidentOpen(false);
            setNotice(t("incidentSaved", { time: timeOf(at.toISOString()) }));
          }}
        />
      ) : null}

      <nav className="field-bar" aria-label={t("fieldBar")}>
        <div className="field-bar-actions">
          <button type="button" className="field-action field-incident" onClick={() => setIncidentOpen(true)}>
            {t("incidentButton")}
          </button>
          {primaryCall ? (
            <a className="field-action field-bar-call" href={primaryCall.tel} aria-label={t("callLabel", { name: primaryCall.name, phone: primaryCall.phone })}>
              {t("callName", { name: primaryCall.name })}
            </a>
          ) : null}
        </div>
        <ul className="field-tabs">
          <li>
            <a href="#maintenant">{t("navNow")}</a>
          </li>
          <li>
            <a href="#programme">{t("navProgram")}</a>
          </li>
          <li>
            <a href="#contacts">{t("navContacts")}</a>
          </li>
          <li>
            <a href="#documents">{t("navDocuments")}</a>
          </li>
        </ul>
      </nav>
    </>
  );
}

// « Photo » : un toucher ouvre l'appareil photo, le déclencheur joint la photo (JRJ-06 : deux
// touchers). Le champ reste atteignable au clavier (visuellement masqué, pas retiré).
function PhotoInput({ label, text, onFile }: { label: string; text: string; onFile: (file: File | undefined) => void }) {
  return (
    <label className="field-photo">
      <span aria-hidden="true">{text}</span>
      <input
        type="file"
        accept="image/*"
        capture="environment"
        className="sr-only"
        aria-label={label}
        onChange={(change) => {
          onFile(change.target.files?.[0]);
          change.target.value = "";
        }}
      />
    </label>
  );
}

// JRJ-07 : le champ s'ouvre d'emblée avec le clavier (son micro dicte, D2), gravité et photo
// facultatives, « Enregistrer ». L'heure est prise à l'enregistrement.
function IncidentSheet({ onClose, onSave }: { onClose: () => void; onSave: (body: string, severity: DayIncidentSeverity | null, photo: File | null) => Promise<void> }) {
  const t = useTranslations("DayOf");
  const [body, setBody] = useState("");
  const [severity, setSeverity] = useState<DayIncidentSeverity | null>(null);
  const [photo, setPhoto] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);
  return (
    <section className="field-sheet" role="dialog" aria-modal="true" aria-labelledby="field-incident-title">
      <form
        onSubmit={(submit) => {
          submit.preventDefault();
          if (!body.trim() || saving) return;
          setSaving(true);
          void onSave(body.trim(), severity, photo).finally(() => setSaving(false));
        }}
      >
        <h2 id="field-incident-title">{t("incidentTitle")}</h2>
        <label className="field-input">
          {t("incidentLabel")}
          <textarea autoFocus required maxLength={DAY_INCIDENT_MAX} rows={4} enterKeyHint="done" value={body} onChange={(change) => setBody(change.target.value)} />
        </label>
        <p className="meta">{t("incidentHint")}</p>
        <fieldset className="field-severities">
          <legend>{t("severityLegend")}</legend>
          {DAY_INCIDENT_SEVERITIES.map((value) => (
            <label key={value} className="field-choice">
              <input type="radio" name="severity" checked={severity === value} onChange={() => setSeverity(value)} />
              {t(`severity.${value}`)}
            </label>
          ))}
        </fieldset>
        <label className="field-photo">
          <span aria-hidden="true">{photo ? t("photoAdded") : t("photo")}</span>
          <input type="file" accept="image/*" capture="environment" className="sr-only" aria-label={t("incidentPhoto")} onChange={(change) => setPhoto(change.target.files?.[0] ?? null)} />
        </label>
        <p className="meta">{t("photoHint")}</p>
        <div className="field-buttons">
          <button type="submit" className="primary" disabled={!body.trim() || saving}>
            {t("save")}
          </button>
          <button type="button" onClick={onClose}>
            {t("close")}
          </button>
        </div>
      </form>
    </section>
  );
}
