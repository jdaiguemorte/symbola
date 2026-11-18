"use client";

// Lot 50 (INV-05 ; D3, D4) — le plan d'un temps fort : les tables en cartes et la colonne des non
// placés, toujours visible (une colonne fixe sur ordinateur, un onglet avec leur nombre à 375 px).
// Placer passe par le composant commun des lots 44 et 50 (app/ui/move-to-group.tsx, D0) : bouton
// « Déplacer » et liste des tables au clavier ou au doigt, glisser-déposer à la souris, annonce du
// résultat, focus qui suit l'invité ; « Non placés » est une destination comme une autre (retirer
// d'une table). Un foyer se place d'un geste. Les invités « en attente de réponse » sont marqués.
// Le serveur fait foi : un refus ramène l'état enregistré.
import { useId, useState } from "react";
import { useTranslations } from "next-intl";
import type { SeatingShape } from "@symbola/contracts";
import { MoveAnnouncement, MoveToGroupButton, useMoveToGroup, type MoveTarget } from "@/app/ui/move-to-group";
import { removeTableAction, seatGuestAction, seatHouseholdAction, setGuestMealTypeAction } from "./actions";
import { TableEditForm } from "./plan-forms";

const UNPLACED = "unplaced";

export type BoardGuest = {
  id: string;
  label: string;
  householdId: string;
  householdName: string;
  status: "present" | "pending";
  tableId: string | null;
  child: boolean;
  mealTypeId: string | null;
  mealLabel: string;
  mealChosen: boolean;
};

export type BoardTable = {
  id: string;
  name: string;
  shape: SeatingShape;
  capacity: number;
  children: number;
  diets: string | null;
  alerts: string[];
};

type Item = BoardGuest & { groupId: string };

export function SeatingBoard({
  eventId,
  planId,
  guests,
  tables,
  mealTypes,
  maxCapacity,
}: {
  eventId: string;
  planId: string;
  guests: BoardGuest[];
  tables: BoardTable[];
  mealTypes: { id: string; label: string }[];
  maxCapacity: number;
}) {
  const t = useTranslations("Guests.plan");
  const [view, setView] = useState<"tables" | "unplaced">("tables");
  const [householdAnnouncement, setHouseholdAnnouncement] = useState("");
  const unplacedHeading = useId();
  const items: Item[] = guests.map((guest) => ({ ...guest, groupId: guest.tableId ?? UNPLACED }));
  const targets: MoveTarget[] = [{ id: UNPLACED, label: t("unplacedTarget") }, ...tables.map((table) => ({ id: table.id, label: table.name }))];
  const tableTargets = targets.filter((target) => target.id !== UNPLACED);
  const board = useMoveToGroup({
    items,
    targets,
    onMove: (itemId, groupId) => seatGuestAction(eventId, planId, itemId, groupId === UNPLACED ? null : groupId),
  });

  const unplaced = board.itemsIn(UNPLACED);
  const unplacedPresent = unplaced.filter((guest) => guest.status === "present");
  const unplacedPending = unplaced.filter((guest) => guest.status === "pending");

  async function moveHousehold(householdId: string, name: string, groupId: string, firstMemberId: string) {
    const target = targets.find((candidate) => candidate.id === groupId);
    const count = await seatHouseholdAction(eventId, planId, householdId, groupId === UNPLACED ? null : groupId).catch(() => null);
    setHouseholdAnnouncement(count === null ? t("householdMoveFailed", { name }) : t("householdMoved", { name, count, group: target?.label ?? "" }));
    // Le focus suit le premier membre du foyer dans sa table.
    requestAnimationFrame(() => {
      const button = document.querySelector<HTMLElement>(`[data-move-item="${CSS.escape(firstMemberId)}"] [data-move-button]`);
      (button ?? document.getElementById(unplacedHeading))?.focus();
    });
  }

  function guestItem(guest: Item) {
    const details = [guest.child ? t("child") : null, guest.status === "pending" ? t("pendingMark") : null, guest.mealChosen ? t("mealOf", { meal: guest.mealLabel }) : t("mealDefault", { meal: guest.mealLabel })].filter(Boolean).join(" · ");
    return (
      <li key={guest.id} className="seating-guest" data-move-item={guest.id} data-status={guest.status} {...board.dragProps(guest.id)}>
        <span className="seating-guest-name">
          <strong>{guest.label}</strong>
          <span className="seating-guest-meta">{details}</span>
        </span>
        <MoveToGroupButton itemLabel={guest.label} currentGroupId={board.groupOf(guest.id)} targets={targets} onChoose={(groupId) => board.move(guest.id, groupId)} />
        <details className="seating-guest-meal">
          <summary>{t("mealChange", { name: guest.label })}</summary>
          <form action={setGuestMealTypeAction} className="seating-form">
            <input type="hidden" name="eventId" value={eventId} />
            <input type="hidden" name="guestId" value={guest.id} />
            <label>
              {t("mealSelect")}
              <select name="mealTypeId" defaultValue={guest.mealChosen ? (guest.mealTypeId ?? "") : ""}>
                <option value="">{t("mealDefaultOption")}</option>
                {mealTypes.map((type) => (
                  <option key={type.id} value={type.id}>
                    {type.label}
                  </option>
                ))}
              </select>
            </label>
            <button type="submit">{t("mealSave")}</button>
          </form>
        </details>
      </li>
    );
  }

  // Les non placés présents, par foyer : un foyer de deux personnes ou plus se place d'un geste.
  const households = [...new Set(unplacedPresent.map((guest) => guest.householdId))].map((householdId) => unplacedPresent.filter((guest) => guest.householdId === householdId));

  return (
    <div className="stack">
      <p className="seating-counts">{t("counts", { unplaced: unplacedPresent.length, pending: guests.filter((guest) => guest.status === "pending").length })}</p>
      <div role="group" aria-label={t("viewSwitch")} className="seating-switch">
        <button type="button" className="button-ghost" aria-pressed={view === "tables"} onClick={() => setView("tables")}>
          {t("showTables")}
        </button>
        <button type="button" className="button-ghost" aria-pressed={view === "unplaced"} onClick={() => setView("unplaced")}>
          {t("showUnplaced", { count: unplacedPresent.length })}
        </button>
      </div>
      <MoveAnnouncement text={board.announcement} />
      <MoveAnnouncement text={householdAnnouncement} />

      <div className="seating-layout">
        <section className="seating-panel seating-unplaced" data-active={view === "unplaced"} aria-labelledby={unplacedHeading} {...board.dropProps(UNPLACED)}>
          <h2 id={unplacedHeading} tabIndex={-1}>
            {t("unplacedTitle", { count: unplacedPresent.length })}
          </h2>
          {unplacedPresent.length === 0 ? <p className="muted">{t("unplacedEmpty")}</p> : null}
          {households.map((members) => {
            const first = members[0]!;
            return (
              <div key={first.householdId} className="seating-household">
                {members.length > 1 ? (
                  <div className="seating-household-head">
                    <h3>{t("householdHeading", { name: first.householdName, count: members.length })}</h3>
                    <MoveToGroupButton
                      itemLabel={t("householdItem", { name: first.householdName })}
                      currentGroupId={null}
                      targets={tableTargets}
                      onChoose={(groupId) => void moveHousehold(first.householdId, first.householdName, groupId, first.id)}
                    />
                  </div>
                ) : null}
                <ul className="plain-list seating-guests">{members.map(guestItem)}</ul>
              </div>
            );
          })}
          {unplacedPending.length > 0 ? (
            <section aria-labelledby={`${unplacedHeading}-pending`} className="stack">
              <h3 id={`${unplacedHeading}-pending`}>{t("pendingTitle", { count: unplacedPending.length })}</h3>
              <p className="muted">{t("pendingHelp")}</p>
              <ul className="plain-list seating-guests">{unplacedPending.map(guestItem)}</ul>
            </section>
          ) : null}
        </section>

        <section className="seating-panel" data-active={view === "tables"} aria-labelledby={`${unplacedHeading}-tables`}>
          <h2 id={`${unplacedHeading}-tables`}>{t("tablesTitle", { count: tables.length })}</h2>
          {tables.length === 0 ? <p>{t("noTables")}</p> : null}
          <ul className="plain-list seating-tables">
            {tables.map((table) => {
              const seated = board.itemsIn(table.id);
              const over = seated.length > table.capacity;
              return (
                <li key={table.id} className="seating-table" data-alert={over || table.alerts.length > 0 ? "true" : undefined} {...board.dropProps(table.id)}>
                  <h3>{table.name}</h3>
                  <p className="seating-table-meta">
                    {[t(`shape.${table.shape}`), t("occupancy", { occupied: seated.length, capacity: table.capacity }), table.children > 0 ? t("children", { count: table.children }) : null].filter(Boolean).join(" · ")}
                  </p>
                  {table.diets ? <p className="seating-table-meta">{t("tableDiets", { list: table.diets })}</p> : null}
                  {over || table.alerts.length > 0 ? (
                    <ul className="plain-list seating-table-alerts">
                      {over ? <li>{t("overCapacity")}</li> : null}
                      {table.alerts.map((alert, index) => (
                        <li key={index}>{alert}</li>
                      ))}
                    </ul>
                  ) : null}
                  {seated.length === 0 ? <p className="muted">{t("tableEmpty")}</p> : <ul className="plain-list seating-guests">{seated.map(guestItem)}</ul>}
                  <details>
                    <summary>{t("editTable", { name: table.name })}</summary>
                    <TableEditForm eventId={eventId} table={table} maxCapacity={maxCapacity} />
                    <form action={removeTableAction} className="seating-form">
                      <input type="hidden" name="eventId" value={eventId} />
                      <input type="hidden" name="tableId" value={table.id} />
                      <p className="muted">{t("removeTableHelp")}</p>
                      <button type="submit">{t("removeTable", { name: table.name })}</button>
                    </form>
                  </details>
                </li>
              );
            })}
          </ul>
        </section>
      </div>
    </div>
  );
}
