"use client";

// Lot 16 (L16-PRE-15, ADR 0040) — formulaires du panneau latéral des réglages des
// types : famille (libellé, couleur, pictogramme), type (libellé, famille),
// nouveau type. Libellés visibles, champs empilés (motif du lot 13).
import { useActionState, useState } from "react";
import { useTranslations } from "next-intl";
import { ICON_KEYS } from "@/app/budget-line-icon";
import type { VendorFamily, VendorType } from "@/modules/vendors/service";
import { FamilyIcon } from "../family-icon";
import { createVendorTypeInFamilyAction, saveVendorFamilyAction, saveVendorTypeAction, type TypeSettingsState } from "./type-actions";

function Feedback({ state, success }: { state: TypeSettingsState; success: string }) {
  if (state.error) return <p role="alert">{state.error}</p>;
  if (state.success) return <p role="status">{success}</p>;
  return null;
}

function FamilySelect({ families, defaultValue, label }: { families: VendorFamily[]; defaultValue: string; label: string }) {
  const t = useTranslations("VendorBook");
  return (
    <label>
      {label}
      <select name="familyId" defaultValue={defaultValue}>
        <option value="">{t("unclassified")}</option>
        {families.map((family) => (
          <option key={family.id} value={family.id}>
            {family.label}
          </option>
        ))}
      </select>
    </label>
  );
}

export function FamilyForm({ family }: { family: VendorFamily | null }) {
  const t = useTranslations("VendorBook");
  const tSetup = useTranslations("Setup");
  const [state, action, pending] = useActionState(saveVendorFamilyAction, {});
  const [color, setColor] = useState(family?.color ?? "#5e5a52");
  const [icon, setIcon] = useState(family?.icon ?? "other");
  return (
    <form action={action} className="panel-form">
      {family ? <input type="hidden" name="familyId" value={family.id} /> : null}
      <p className="family-preview">
        <FamilyIcon color={color} icon={icon} />
        <span>{t("familyPreview")}</span>
      </p>
      <label>
        {t("familyLabel")}
        <input type="text" name="label" required maxLength={80} defaultValue={family?.label ?? ""} />
      </label>
      <label>
        {t("familyColor")}
        <input type="color" name="color" value={color} onChange={(event) => setColor(event.target.value)} />
      </label>
      <label>
        {t("familyIcon")}
        <select name="icon" value={icon} onChange={(event) => setIcon(event.target.value)}>
          {ICON_KEYS.map((key) => (
            <option key={key} value={key}>
              {tSetup(`icons.${key}`)}
            </option>
          ))}
        </select>
      </label>
      <button type="submit" disabled={pending}>
        {family ? t("familySave") : t("familyCreate")}
      </button>
      <Feedback state={state} success={t("familySaved")} />
    </form>
  );
}

export function TypeForm({ type, families }: { type: VendorType; families: VendorFamily[] }) {
  const t = useTranslations("VendorBook");
  const [state, action, pending] = useActionState(saveVendorTypeAction, {});
  return (
    <form action={action} className="panel-form">
      <input type="hidden" name="typeId" value={type.id} />
      <label>
        {t("typeLabel")}
        <input type="text" name="label" required maxLength={80} defaultValue={type.label} />
      </label>
      <FamilySelect families={families} defaultValue={type.familyId ?? ""} label={t("typeFamily")} />
      <p className="muted">{t("typeRenameHint")}</p>
      <button type="submit" disabled={pending}>
        {t("typeSave")}
      </button>
      <Feedback state={state} success={t("typeSaved")} />
    </form>
  );
}

export function NewTypeForm({ families, familyId }: { families: VendorFamily[]; familyId: string }) {
  const t = useTranslations("VendorBook");
  const [state, action, pending] = useActionState(createVendorTypeInFamilyAction, {});
  return (
    <form action={action} className="panel-form">
      <label>
        {t("typeLabel")}
        <input type="text" name="label" required maxLength={80} />
      </label>
      <FamilySelect families={families} defaultValue={familyId} label={t("typeFamily")} />
      <button type="submit" disabled={pending}>
        {t("typeAdd")}
      </button>
      <Feedback state={state} success={t("typeAdded")} />
    </form>
  );
}
