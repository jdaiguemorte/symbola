"use client";

// Lot 73d (PRE-01 ; spécification du lot 73, § 5.4, critère 2) — les champs que la fenêtre unique de
// création et de modification d'un prestataire reprend des rubriques d'avant (lot 63e, ADR 0105) : les
// métiers cochés et le principal, les étiquettes en pastilles (lot 20, ADR 0049), les champs de chaque
// métier.
import { useTranslations } from "next-intl";
import type { VendorFamily, VendorFieldValue, VendorTag, VendorTagGroup, VendorType, VendorTypeField } from "@/modules/vendors/service";
import { FamilyIcon } from "./family-icon";

// Jeton ink-muted de DESIGN.md (attribut SVG fill, qui ne lit pas les variables CSS).
const UNCLASSIFIED_COLOR = "#5A6372";

function initialFieldValue(field: VendorTypeField, value: VendorFieldValue | undefined): string {
  if (value === undefined) return "";
  if (field.kind === "amount" && typeof value === "number") {
    const rest = value % 100;
    return rest === 0 ? String(Math.trunc(value / 100)) : `${Math.trunc(value / 100)},${String(rest).padStart(2, "0")}`;
  }
  return String(value);
}

export function FieldInput({ field, value }: { field: VendorTypeField; value: VendorFieldValue | undefined }) {
  const t = useTranslations("VendorBook");
  const name = `field_${field.id}`;
  if (field.kind === "boolean") {
    return (
      <label className="checkbox">
        <input type="checkbox" name={name} defaultChecked={value === true} />
        {field.label}
      </label>
    );
  }
  if (field.kind === "choice") {
    return (
      <label>
        {field.label}
        <select name={name} defaultValue={typeof value === "string" ? value : ""}>
          <option value="">—</option>
          {field.choices.map((choice) => (
            <option key={choice} value={choice}>
              {choice}
            </option>
          ))}
        </select>
      </label>
    );
  }
  return (
    <label>
      {field.kind === "amount" ? t("fieldAmountLabel", { label: field.label }) : field.label}
      <input
        type={field.kind === "time" ? "time" : "text"}
        inputMode={field.kind === "number" || field.kind === "amount" ? "decimal" : undefined}
        name={name}
        defaultValue={initialFieldValue(field, value)}
      />
    </label>
  );
}

// Lot 20 (décision 5, ADR 0049) — étiquettes en pastilles, rangées par groupe. Un groupe « palier »
// se choisit en un seul segment (le même nom de bouton radio d'une section à l'autre).
export function TagChips({ legend, tags, groups, selected }: { legend: string; tags: VendorTag[]; groups: VendorTagGroup[]; selected: string[] }) {
  const t = useTranslations("VendorBook");
  const sections = [
    ...groups.map((group) => ({
      key: group.id,
      label: group.label,
      exclusive: group.exclusive,
      tags: tags.filter((tag) => tag.groupId === group.id),
    })),
    {
      key: "other",
      label: groups.length > 0 ? t("tagGroupOther") : t("tags"),
      exclusive: false,
      tags: tags.filter((tag) => tag.groupId === null || !groups.some((group) => group.id === tag.groupId)),
    },
  ].filter((section) => section.tags.length > 0);
  if (sections.length === 0) return null;
  return (
    <fieldset className="tag-fieldset">
      <legend>{legend}</legend>
      {sections.map((section) => (
        <fieldset key={section.key} className="tag-group">
          <legend>{section.exclusive ? t("tagGroupTierLegend", { group: section.label }) : section.label}</legend>
          <div className={section.exclusive ? "tag-tier" : "tag-chips"}>
            {section.exclusive ? (
              <label className="tag-chip">
                <input type="radio" name={`tagTier-${section.key}`} value="" defaultChecked={!section.tags.some((tag) => selected.includes(tag.id))} />
                <span>{t("tagTierNone")}</span>
              </label>
            ) : null}
            {section.tags.map((tag) => (
              <label key={tag.id} className="tag-chip">
                {section.exclusive ? (
                  <input type="radio" name={`tagTier-${section.key}`} value={tag.id} defaultChecked={selected.includes(tag.id)} />
                ) : (
                  <input type="checkbox" name="tagIds" value={tag.id} defaultChecked={selected.includes(tag.id)} />
                )}
                <span>{tag.label}</span>
              </label>
            ))}
          </div>
        </fieldset>
      ))}
    </fieldset>
  );
}

// Lot 63e (PRE-01, maquette M4) — les métiers, rangés par famille : une case par métier et, pour les
// métiers cochés, le choix du principal. Les familles sans métier coché sont repliées.
export function TradesPicker({
  types,
  families,
  checked,
  primary,
  onToggle,
  onPrimary,
}: {
  types: VendorType[];
  families: VendorFamily[];
  checked: string[];
  primary: string | null;
  onToggle: (typeId: string, on: boolean) => void;
  onPrimary: (typeId: string) => void;
}) {
  const t = useTranslations("VendorBook");
  const groups = [
    ...families.map((family) => ({
      key: family.id,
      label: family.label,
      color: family.color,
      icon: family.icon,
      items: types.filter((type) => type.familyId === family.id),
    })),
    {
      key: "none",
      label: t("typeUnclassified"),
      color: UNCLASSIFIED_COLOR,
      icon: "other",
      items: types.filter((type) => !families.some((family) => family.id === type.familyId)),
    },
  ].filter((group) => group.items.length > 0);
  const used = groups.filter((group) => group.items.some((type) => checked.includes(type.id)));
  const others = groups.filter((group) => !used.includes(group));
  const renderGroup = (group: (typeof groups)[number]) => (
    <fieldset key={group.key} className="trade-group">
      <legend className="family-cell">
        <FamilyIcon color={group.color} icon={group.icon} />
        {group.label}
      </legend>
      <ul className="trade-list">
        {group.items.map((type) => {
          const on = checked.includes(type.id);
          return (
            <li key={type.id} className="trade-row">
              <label className="checkbox">
                <input type="checkbox" name="typeIds" value={type.id} checked={on} onChange={(event) => onToggle(type.id, event.target.checked)} />
                {type.label}
              </label>
              {on ? (
                <label className="checkbox trade-primary">
                  <input type="radio" name="primaryTypeId" value={type.id} checked={primary === type.id} onChange={() => onPrimary(type.id)} />
                  <span>{t("tradePrimary")}</span>
                  <span className="sr-only">{t("tradePrimaryOf", { type: type.label })}</span>
                </label>
              ) : null}
            </li>
          );
        })}
      </ul>
    </fieldset>
  );
  if (types.length === 0) return <p className="muted">{t("tradesNone")}</p>;
  return (
    <fieldset className="trades-fieldset">
      <legend>{t("trades")}</legend>
      <p className="muted">{t("tradesHint")}</p>
      {used.map(renderGroup)}
      {others.length > 0 ? (
        <details className="trade-more" open={used.length === 0}>
          <summary>{used.length > 0 ? t("tradesAddOther") : t("tradesChoose")}</summary>
          {others.map(renderGroup)}
        </details>
      ) : null}
    </fieldset>
  );
}
