"use client";

// Lot 11 (PRE-01 / PRE-02) — fiche d'un prestataire : coordonnées, type et
// ses champs, étiquettes, note interne. Les champs suivent le type choisi.
import { useActionState, useState } from "react";
import { useTranslations } from "next-intl";
import { VENDOR_SOCIAL_NETWORKS } from "@symbola/contracts";
import type { Vendor, VendorFamily, VendorFieldValue, VendorTag, VendorType, VendorTypeField } from "@/modules/vendors/service";
import { saveVendorAction, type VendorFormState } from "./actions";

function initialFieldValue(field: VendorTypeField, value: VendorFieldValue | undefined): string {
  if (value === undefined) return "";
  if (field.kind === "amount" && typeof value === "number") {
    const rest = value % 100;
    return rest === 0 ? String(Math.trunc(value / 100)) : `${Math.trunc(value / 100)},${String(rest).padStart(2, "0")}`;
  }
  return String(value);
}

function FieldInput({ field, value }: { field: VendorTypeField; value: VendorFieldValue | undefined }) {
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

export function VendorForm({
  types,
  tags,
  families = [],
  vendor = null,
  back = "",
}: {
  types: VendorType[];
  tags: VendorTag[];
  // Lot 16 (PRE-14) : types rangés par famille dans la liste.
  families?: VendorFamily[];
  vendor?: Vendor | null;
  back?: string;
}) {
  const t = useTranslations("VendorBook");
  const [state, action, pending] = useActionState<VendorFormState, FormData>(saveVendorAction, {});
  const [typeId, setTypeId] = useState(vendor?.typeId ?? "");
  const type = types.find((candidate) => candidate.id === typeId) ?? null;

  return (
    <form action={action} className="vendor-form">
      {vendor ? <input type="hidden" name="vendorId" value={vendor.id} /> : null}
      {back ? <input type="hidden" name="back" value={back} /> : null}
      <fieldset>
        <legend>{t("identity")}</legend>
        <label>
          {t("name")}
          <input type="text" name="name" required defaultValue={vendor?.name ?? ""} autoComplete="organization" />
        </label>
        <label>
          {t("type")}
          <select name="typeId" value={typeId} onChange={(event) => setTypeId(event.target.value)}>
            <option value="">{t("typeNone")}</option>
            {[...families.map((family) => ({ key: family.id, label: family.label, items: types.filter((candidate) => candidate.familyId === family.id) })), { key: "", label: t("typeUnclassified"), items: types.filter((candidate) => !families.some((family) => family.id === candidate.familyId)) }]
              .filter((group) => group.items.length > 0)
              .map((group) =>
                families.length === 0 ? (
                  group.items.map((candidate) => (
                    <option key={candidate.id} value={candidate.id}>
                      {candidate.label}
                    </option>
                  ))
                ) : (
                  <optgroup key={group.key || "none"} label={group.label}>
                    {group.items.map((candidate) => (
                      <option key={candidate.id} value={candidate.id}>
                        {candidate.label}
                      </option>
                    ))}
                  </optgroup>
                ),
              )}
          </select>
        </label>
      </fieldset>
      <fieldset>
        <legend>{t("contact")}</legend>
        <label>
          {t("contactName")}
          <input type="text" name="contactName" defaultValue={vendor?.contactName ?? ""} autoComplete="name" />
        </label>
        <label>
          {t("phone")}
          <input type="tel" name="phone" defaultValue={vendor?.phone ?? ""} autoComplete="tel" />
        </label>
        <label>
          {t("email")}
          <input type="email" name="email" defaultValue={vendor?.email ?? ""} autoComplete="email" />
        </label>
      </fieldset>
      <fieldset>
        <legend>{t("address")}</legend>
        <label>
          {t("addressLine")}
          <input type="text" name="addressLine" defaultValue={vendor?.addressLine ?? ""} autoComplete="street-address" />
        </label>
        <label>
          {t("postalCode")}
          <input type="text" name="postalCode" defaultValue={vendor?.postalCode ?? ""} autoComplete="postal-code" />
        </label>
        <label>
          {t("city")}
          <input type="text" name="city" defaultValue={vendor?.city ?? ""} autoComplete="address-level2" />
        </label>
        <label>
          {t("country")}
          <input type="text" name="country" defaultValue={vendor?.country ?? "FR"} maxLength={2} autoComplete="country" />
        </label>
        <p className="muted">{t("addressHint")}</p>
      </fieldset>
      <fieldset>
        <legend>{t("links")}</legend>
        <label>
          {t("website")}
          <input type="url" name="website" defaultValue={vendor?.website ?? ""} autoComplete="url" placeholder="https://" />
        </label>
        {VENDOR_SOCIAL_NETWORKS.map((network) => (
          <label key={network}>
            {t(`social.${network}`)}
            <input type="url" name={`social_${network}`} defaultValue={vendor?.socialLinks.find((link) => link.network === network)?.url ?? ""} placeholder="https://" />
          </label>
        ))}
        <label>
          {t("siret")}
          <input type="text" name="siret" inputMode="numeric" defaultValue={vendor?.siret ?? ""} />
        </label>
      </fieldset>
      {type && type.fields.length > 0 ? (
        <fieldset key={type.id}>
          <legend>{t("typeFields", { type: type.label })}</legend>
          {type.fields.map((field) => (
            <FieldInput key={field.id} field={field} value={vendor?.typeId === type.id ? vendor.fieldValues[field.id] : undefined} />
          ))}
        </fieldset>
      ) : null}
      {tags.length > 0 ? (
        <fieldset>
          <legend>{t("tags")}</legend>
          {tags.map((tag) => (
            <label key={tag.id} className="checkbox">
              <input type="checkbox" name="tagIds" value={tag.id} defaultChecked={vendor?.tagIds.includes(tag.id) ?? false} />
              {tag.label}
            </label>
          ))}
        </fieldset>
      ) : null}
      <label>
        {t("internalNote")}
        <textarea name="internalNote" rows={3} defaultValue={vendor?.internalNote ?? ""} />
      </label>
      <p className="muted">{t("internalNoteHint")}</p>
      <button type="submit" disabled={pending}>
        {vendor ? t("save") : t("create")}
      </button>
      {state.error ? <p role="alert">{state.error}</p> : null}
      {state.success ? <p role="status">{state.notice ?? t("saved")}</p> : null}
    </form>
  );
}
