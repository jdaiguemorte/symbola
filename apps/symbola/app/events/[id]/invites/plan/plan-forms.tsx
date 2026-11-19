"use client";

// Lot 50 (INV-05, INV-06 ; D2, D4, D5) — formulaires du plan de table : ajouter des tables en série
// (la forme propose la capacité), modifier une table, copier le plan d'un autre temps fort, ajouter
// une contrainte, repas des prestataires. Chaque formulaire annonce son résultat (role="status") ou
// son erreur (role="alert") ; le serveur valide tout.
import { useActionState, useState } from "react";
import { useTranslations } from "next-intl";
import { SEATING_SHAPES, type SeatingShape } from "@symbola/contracts";
import { addConstraintAction, addTablesAction, copyPlanAction, setVendorMealsAction, updateTableAction, type PlanFormState } from "./actions";

function Result({ state }: { state: PlanFormState }) {
  return (
    <>
      {state.error ? <p role="alert">{state.error}</p> : null}
      {state.success ? <p role="status">{state.success}</p> : null}
    </>
  );
}

export function AddTablesForm({ eventId, planId, defaults, maxCount, maxCapacity }: { eventId: string; planId: string; defaults: Record<SeatingShape, number>; maxCount: number; maxCapacity: number }) {
  const t = useTranslations("Guests.plan");
  const [state, action, pending] = useActionState(addTablesAction, {} as PlanFormState);
  const [shape, setShape] = useState<SeatingShape>("round");
  const [capacity, setCapacity] = useState(String(defaults.round));
  return (
    <form action={action} className="seating-form">
      <input type="hidden" name="eventId" value={eventId} />
      <input type="hidden" name="planId" value={planId} />
      <label>
        {t("addCount")}
        <input name="count" type="number" inputMode="numeric" min={1} max={maxCount} defaultValue={1} required />
      </label>
      <label>
        {t("addShape")}
        <select
          name="shape"
          value={shape}
          onChange={(event) => {
            const next = event.target.value as SeatingShape;
            setShape(next);
            setCapacity(String(defaults[next]));
          }}
        >
          {SEATING_SHAPES.map((value) => (
            <option key={value} value={value}>
              {t(`shape.${value}`)}
            </option>
          ))}
        </select>
      </label>
      <label>
        {t("addCapacity")}
        <input name="capacity" type="number" inputMode="numeric" min={1} max={maxCapacity} value={capacity} onChange={(event) => setCapacity(event.target.value)} required />
      </label>
      <button type="submit" disabled={pending}>
        {t("addSubmit")}
      </button>
      <Result state={state} />
    </form>
  );
}

export function TableEditForm({ eventId, table, maxCapacity }: { eventId: string; table: { id: string; name: string; shape: SeatingShape; capacity: number }; maxCapacity: number }) {
  const t = useTranslations("Guests.plan");
  const [state, action, pending] = useActionState(updateTableAction, {} as PlanFormState);
  return (
    <form action={action} className="seating-form">
      <input type="hidden" name="eventId" value={eventId} />
      <input type="hidden" name="tableId" value={table.id} />
      <label>
        {t("tableName")}
        <input name="name" defaultValue={table.name} maxLength={60} required />
      </label>
      <label>
        {t("tableShape")}
        <select name="shape" defaultValue={table.shape}>
          {SEATING_SHAPES.map((value) => (
            <option key={value} value={value}>
              {t(`shape.${value}`)}
            </option>
          ))}
        </select>
      </label>
      <label>
        {t("tableCapacity")}
        <input name="capacity" type="number" inputMode="numeric" min={1} max={maxCapacity} defaultValue={table.capacity} required />
      </label>
      <button type="submit" disabled={pending}>
        {t("saveTable")}
      </button>
      <Result state={state} />
    </form>
  );
}

export function CopyPlanForm({ eventId, toKeyMomentId, sources }: { eventId: string; toKeyMomentId: string; sources: { id: string; label: string }[] }) {
  const t = useTranslations("Guests.plan");
  const [state, action, pending] = useActionState(copyPlanAction, {} as PlanFormState);
  return (
    <form action={action} className="seating-form">
      <input type="hidden" name="eventId" value={eventId} />
      <input type="hidden" name="toKeyMomentId" value={toKeyMomentId} />
      <label>
        {t("copyFrom")}
        <select name="fromKeyMomentId" defaultValue={sources[0]?.id}>
          {sources.map((source) => (
            <option key={source.id} value={source.id}>
              {source.label}
            </option>
          ))}
        </select>
      </label>
      <button type="submit" disabled={pending}>
        {t("copySubmit")}
      </button>
      <Result state={state} />
    </form>
  );
}

export function ConstraintForm({ eventId, planId, guests }: { eventId: string; planId: string; guests: { id: string; label: string }[] }) {
  const t = useTranslations("Guests.plan");
  const [state, action, pending] = useActionState(addConstraintAction, {} as PlanFormState);
  return (
    <form action={action} className="stack">
      <input type="hidden" name="eventId" value={eventId} />
      <input type="hidden" name="planId" value={planId} />
      <fieldset>
        <legend>{t("constraintKindLabel")}</legend>
        <label className="seating-choice">
          <input type="radio" name="kind" value="together" defaultChecked />
          {t("constraintKind.together")}
        </label>
        <label className="seating-choice">
          <input type="radio" name="kind" value="apart" />
          {t("constraintKind.apart")}
        </label>
      </fieldset>
      <fieldset>
        <legend>{t("constraintMembers")}</legend>
        <ul className="seating-checklist">
          {guests.map((guest) => (
            <li key={guest.id}>
              <label className="seating-choice">
                <input type="checkbox" name="guestIds" value={guest.id} />
                {guest.label}
              </label>
            </li>
          ))}
        </ul>
      </fieldset>
      <button type="submit" disabled={pending}>
        {t("constraintSubmit")}
      </button>
      <Result state={state} />
    </form>
  );
}

export function VendorMealsForm({ eventId, keyMomentId, count }: { eventId: string; keyMomentId: string; count: number }) {
  const t = useTranslations("Guests.plan");
  const [state, action, pending] = useActionState(setVendorMealsAction, {} as PlanFormState);
  return (
    <form action={action} className="seating-form">
      <input type="hidden" name="eventId" value={eventId} />
      <input type="hidden" name="keyMomentId" value={keyMomentId} />
      <label>
        {t("vendorCount")}
        <input name="count" type="number" inputMode="numeric" min={0} max={1000} defaultValue={count} required />
      </label>
      <button type="submit" disabled={pending}>
        {t("vendorSave")}
      </button>
      <Result state={state} />
    </form>
  );
}
