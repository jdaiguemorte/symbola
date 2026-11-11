"use client";

// Lot 13 (L13-HUB-16) — formulaires du panneau latéral des lignes du budget :
// libellés visibles, champs empilés, icône choisie dans la liste commune.
import { useActionState, useState } from "react";
import { useTranslations } from "next-intl";
import type { DefaultVendorSlot } from "@/modules/events/service";
import { BudgetLineIcon, ICON_KEYS } from "@/app/budget-line-icon";
import { updateBudgetLineAction } from "@/app/demarrage/actions";
import { addDefaultVendorSlotAction, type DefaultVendorSlotFormState } from "./vendor-slot-actions";

function IconSelect({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  const t = useTranslations("Setup");
  return (
    <label>
      {t("iconLabel")}
      <select name="icon" value={value} onChange={(event) => onChange(event.target.value)}>
        <option value="">{t("iconNone")}</option>
        {ICON_KEYS.map((key) => (
          <option key={key} value={key}>
            {t(`icons.${key}`)}
          </option>
        ))}
      </select>
    </label>
  );
}

export function EditBudgetLineForm({ line }: { line: DefaultVendorSlot }) {
  const t = useTranslations("Setup");
  const [state, action, pending] = useActionState(updateBudgetLineAction, {});
  const [label, setLabel] = useState(line.label);
  const [icon, setIcon] = useState(line.icon ?? "");
  return (
    <form action={action} className="stack">
      <input type="hidden" name="id" value={line.id} />
      <BudgetLineIcon icon={icon || null} label={label} decorative />
      <label>
        {t("lineNameLabel")}
        <input type="text" name="label" value={label} onChange={(event) => setLabel(event.target.value)} required />
      </label>
      <IconSelect value={icon} onChange={setIcon} />
      <button type="submit" disabled={pending}>
        {t("save")}
      </button>
      {state.error ? <p role="alert">{state.error}</p> : null}
      {state.success ? <p role="status">{t("saved")}</p> : null}
    </form>
  );
}

export function AddBudgetLineForm() {
  const t = useTranslations("Events");
  const tSetup = useTranslations("Setup");
  const initialState: DefaultVendorSlotFormState = {};
  const [state, action, pending] = useActionState(addDefaultVendorSlotAction, initialState);
  const [label, setLabel] = useState("");
  const [icon, setIcon] = useState("");
  return (
    <form action={action} className="stack">
      <label>
        {t("newDefaultVendorSlotLabel")}
        <input type="text" name="label" value={label} onChange={(event) => setLabel(event.target.value)} required />
      </label>
      <IconSelect value={icon} onChange={setIcon} />
      <button type="submit" disabled={pending}>
        {t("addDefaultVendorSlot")}
      </button>
      {state.error ? <p role="alert">{state.error}</p> : null}
      {state.success ? <p role="status">{t("defaultVendorSlotAdded")}</p> : null}
      <p className="muted">{tSetup("panelAddHint")}</p>
    </form>
  );
}
