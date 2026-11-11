"use client";

// Lot 11 (L11-PRE-02, L11-PRE-07) — formulaires des réglages du carnet.
import { useActionState, useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import type { VendorFieldKind } from "@/modules/vendors/service";
import {
  addVendorFieldAction,
  createVendorTagAction,
  createVendorTagGroupAction,
  saveTravelSettingsAction,
  updateVendorTagAction,
  updateVendorTagGroupAction,
} from "../actions";

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

// Lot 20 (décision 5, ADR 0049) — une étiquette : nom, groupe (vide =
// « Autres ») et familles concernées (aucune cochée = toutes). Sert à
// l'ajout, en tête de l'écran, et à la modification, dans le panneau.
export function TagForm({
  tag = null,
  groups,
  families,
}: {
  tag?: { id: string; label: string; groupId: string | null; familyIds: string[] } | null;
  groups: { id: string; label: string }[];
  families: { id: string; label: string }[];
}) {
  const t = useTranslations("VendorBook");
  const [state, action, pending] = useActionState(tag ? updateVendorTagAction : createVendorTagAction, {});
  // Après un ajout réussi, le formulaire se vide pour l'étiquette suivante.
  const formRef = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (state.success && !tag) formRef.current?.reset();
  }, [state, tag]);
  return (
    <form ref={formRef} action={action} className={tag ? "tag-form" : "tag-form tag-form-inline"}>
      {tag ? <input type="hidden" name="tagId" value={tag.id} /> : null}
      <label>
        {t("tagLabel")}
        <input type="text" name="label" required defaultValue={tag?.label ?? ""} />
      </label>
      <label>
        {t("tagGroupLabel")}
        <select name="groupId" defaultValue={tag?.groupId ?? ""}>
          <option value="">{t("tagGroupOther")}</option>
          {groups.map((group) => (
            <option key={group.id} value={group.id}>
              {group.label}
            </option>
          ))}
        </select>
      </label>
      {families.length > 0 ? (
        <fieldset className="tag-families">
          <legend>{t("tagFamiliesLabel")}</legend>
          <p className="muted">{t("tagFamiliesHint")}</p>
          {families.map((family) => (
            <label key={family.id} className="checkbox">
              <input type="checkbox" name="familyIds" value={family.id} defaultChecked={tag?.familyIds.includes(family.id) ?? false} />
              {family.label}
            </label>
          ))}
        </fieldset>
      ) : null}
      <button type="submit" disabled={pending}>
        {tag ? t("tagSave") : t("tagAdd")}
      </button>
      <Feedback state={state} success={t("tagAdded")} />
    </form>
  );
}

// Lot 20 (décision 5) — un groupe d'étiquettes ; « palier » : une seule
// étiquette du groupe par prestataire.
export function TagGroupForm({ group = null }: { group?: { id: string; label: string; exclusive: boolean } | null }) {
  const t = useTranslations("VendorBook");
  const [state, action, pending] = useActionState(group ? updateVendorTagGroupAction : createVendorTagGroupAction, {});
  return (
    <form action={action} className="tag-form">
      {group ? <input type="hidden" name="groupId" value={group.id} /> : null}
      <label>
        {t("tagGroupNameLabel")}
        <input type="text" name="label" required defaultValue={group?.label ?? ""} />
      </label>
      <label className="checkbox">
        <input type="checkbox" name="exclusive" defaultChecked={group?.exclusive ?? false} />
        {t("tagGroupExclusive")}
      </label>
      <button type="submit" disabled={pending}>
        {group ? t("tagGroupSave") : t("tagGroupAdd")}
      </button>
      <Feedback state={state} success={group ? t("tagGroupSaved") : t("tagGroupAdded")} />
    </form>
  );
}

// Lot 18 (L18-PRE-16) : exemple recalculé à la saisie, même formule que
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
