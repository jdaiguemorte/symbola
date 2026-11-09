"use client";

// Lot 11 (PRE-02, PRE-07) — formulaires des réglages du carnet.
import { useActionState, useState } from "react";
import { useTranslations } from "next-intl";
import type { VendorFieldKind } from "@/modules/vendors/service";
import { addVendorFieldAction, createVendorTagAction, saveTravelSettingsAction } from "../actions";

const KINDS: VendorFieldKind[] = ["number", "text", "time", "amount", "choice", "boolean"];

function Feedback({ state, success }: { state: { error?: string; success?: boolean }; success: string }) {
  if (state.error) return <p role="alert">{state.error}</p>;
  if (state.success) return <p role="status">{success}</p>;
  return null;
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

// Lot 18 (PRE-16) : exemple recalculé à la saisie, même formule que
// modules/vendors/travel.ts (distance × détour, minute supérieure).
const EXAMPLE_CROW_FLIES_KM = 40;

function travelExample(detourText: string, speedText: string): { km: string; minutes: number } | null {
  const detour = Number(detourText.replace(",", "."));
  const speed = Number(speedText);
  if (!(detour >= 1 && detour <= 3) || !(speed >= 5 && speed <= 130)) return null;
  const roadKm = EXAMPLE_CROW_FLIES_KM * detour;
  return { km: String(Math.round(roadKm)), minutes: Math.max(1, Math.ceil((roadKm / speed) * 60)) };
}

export function TravelForm({ detour, speed }: { detour: string; speed: number }) {
  const t = useTranslations("VendorBook");
  const [state, action, pending] = useActionState(saveTravelSettingsAction, {});
  const [detourText, setDetourText] = useState(detour);
  const [speedText, setSpeedText] = useState(String(speed));
  const example = travelExample(detourText, speedText);
  return (
    <form action={action} className="vendor-filters">
      <label>
        {t("travelDetour")}
        <input type="text" inputMode="decimal" name="detour" value={detourText} onChange={(event) => setDetourText(event.target.value)} />
      </label>
      <label>
        {t("travelSpeed")}
        <input type="number" name="speed" min={5} max={130} value={speedText} onChange={(event) => setSpeedText(event.target.value)} />
      </label>
      {example ? (
        <p className="meta" aria-live="polite">
          {t("settingsTravelExample", { crow: EXAMPLE_CROW_FLIES_KM, km: example.km, minutes: example.minutes })}
        </p>
      ) : null}
      <button type="submit" disabled={pending}>
        {t("travelSave")}
      </button>
      <Feedback state={state} success={t("travelSaved")} />
    </form>
  );
}
