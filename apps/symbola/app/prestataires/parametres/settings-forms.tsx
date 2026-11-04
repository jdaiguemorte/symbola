"use client";

// Lot 11 (PRE-02, PRE-07) — formulaires des réglages du carnet.
import { useActionState, useState } from "react";
import { useTranslations } from "next-intl";
import type { VendorFieldKind } from "@/modules/vendors/service";
import { addVendorFieldAction, createVendorTagAction, createVendorTypeAction, saveTravelSettingsAction } from "../actions";

const KINDS: VendorFieldKind[] = ["number", "text", "time", "amount", "choice", "boolean"];

function Feedback({ state, success }: { state: { error?: string; success?: boolean }; success: string }) {
  if (state.error) return <p role="alert">{state.error}</p>;
  if (state.success) return <p role="status">{success}</p>;
  return null;
}

export function CreateTypeForm() {
  const t = useTranslations("VendorBook");
  const [state, action, pending] = useActionState(createVendorTypeAction, {});
  return (
    <form action={action} className="vendor-filters">
      <label>
        {t("typeLabel")}
        <input type="text" name="label" required />
      </label>
      <label>
        {t("typeColor")}
        <input type="color" name="color" defaultValue="#4f6b5a" />
      </label>
      <button type="submit" disabled={pending}>
        {t("typeAdd")}
      </button>
      <Feedback state={state} success={t("typeAdded")} />
    </form>
  );
}

export function AddFieldForm({ typeId, typeLabel }: { typeId: string; typeLabel: string }) {
  const t = useTranslations("VendorBook");
  const [state, action, pending] = useActionState(addVendorFieldAction, {});
  const [kind, setKind] = useState<VendorFieldKind>("number");
  return (
    <form action={action} className="vendor-filters">
      <input type="hidden" name="typeId" value={typeId} />
      <label>
        {t("fieldLabel", { type: typeLabel })}
        <input type="text" name="label" required />
      </label>
      <label>
        {t("fieldKind")}
        <select name="kind" value={kind} onChange={(event) => setKind(event.target.value as VendorFieldKind)}>
          {KINDS.map((value) => (
            <option key={value} value={value}>
              {t(`kind.${value}`)}
            </option>
          ))}
        </select>
      </label>
      {kind === "choice" ? (
        <label>
          {t("fieldChoices")}
          <textarea name="choices" rows={2} />
        </label>
      ) : null}
      <label className="checkbox">
        <input type="checkbox" name="isFilter" />
        {t("fieldIsFilter")}
      </label>
      <button type="submit" disabled={pending}>
        {t("fieldAdd")}
      </button>
      <Feedback state={state} success={t("fieldAdded")} />
    </form>
  );
}

export function CreateTagForm() {
  const t = useTranslations("VendorBook");
  const [state, action, pending] = useActionState(createVendorTagAction, {});
  return (
    <form action={action} className="vendor-filters">
      <label>
        {t("tagLabel")}
        <input type="text" name="label" required />
      </label>
      <button type="submit" disabled={pending}>
        {t("tagAdd")}
      </button>
      <Feedback state={state} success={t("tagAdded")} />
    </form>
  );
}

export function TravelForm({ detour, speed }: { detour: string; speed: number }) {
  const t = useTranslations("VendorBook");
  const [state, action, pending] = useActionState(saveTravelSettingsAction, {});
  return (
    <form action={action} className="vendor-filters">
      <label>
        {t("travelDetour")}
        <input type="text" inputMode="decimal" name="detour" defaultValue={detour} />
      </label>
      <label>
        {t("travelSpeed")}
        <input type="number" name="speed" min={5} max={130} defaultValue={speed} />
      </label>
      <button type="submit" disabled={pending}>
        {t("travelSave")}
      </button>
      <Feedback state={state} success={t("travelSaved")} />
    </form>
  );
}
