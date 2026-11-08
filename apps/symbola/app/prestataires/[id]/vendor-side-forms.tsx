"use client";

// Lot 11 (PRE-01 / PRE-03) — fichiers de la fiche et correction du point.
import { useActionState } from "react";
import { useTranslations } from "next-intl";
import { useUploadAction } from "@/app/ui/use-upload";
import { setVendorLocationAction, type VendorFormState } from "../actions";

export function VendorFileForm({ vendorId }: { vendorId: string }) {
  const t = useTranslations("VendorBook");
  const [state, action, pending] = useUploadAction<VendorFormState>(`/prestataires/${vendorId}/fichiers`);
  return (
    <form action={action} className="stack">
      <input type="hidden" name="vendorId" value={vendorId} />
      <label>
        {t("fileKind")}
        <select name="kind" defaultValue="brochure">
          <option value="brochure">{t("fileBrochure")}</option>
          <option value="rib">{t("fileRib")}</option>
        </select>
      </label>
      <label>
        {t("fileChoose")}
        <input type="file" name="file" accept="application/pdf,image/*" />
      </label>
      <button type="submit" disabled={pending}>
        {t("fileAttach")}
      </button>
      {state.error ? <p role="alert">{state.error}</p> : null}
      {state.success ? <p role="status">{t("fileAttached")}</p> : null}
    </form>
  );
}

export function VendorLocationForm({ vendorId, latitude, longitude }: { vendorId: string; latitude: number | null; longitude: number | null }) {
  const t = useTranslations("VendorBook");
  const [state, action, pending] = useActionState(setVendorLocationAction, {});
  return (
    <form action={action} className="vendor-filters">
      <input type="hidden" name="vendorId" value={vendorId} />
      <label>
        {t("latitude")}
        <input id="vendor-latitude" type="text" inputMode="decimal" name="latitude" defaultValue={latitude ?? ""} />
      </label>
      <label>
        {t("longitude")}
        <input id="vendor-longitude" type="text" inputMode="decimal" name="longitude" defaultValue={longitude ?? ""} />
      </label>
      <button type="submit" disabled={pending}>
        {t("savePoint")}
      </button>
      {state.error ? <p role="alert">{state.error}</p> : null}
      {state.success ? <p role="status">{t("pointSaved")}</p> : null}
    </form>
  );
}
