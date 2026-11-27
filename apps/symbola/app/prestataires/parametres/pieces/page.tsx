// Lot 48a (PRE-05 ; D3, ADR 0093) — réglages des pièces des prestataires : alerte N jours avant la fin
// de validité (30 proposés), natures de pièces (données de départ, puis libres).
import { getLocale, getTranslations } from "next-intl/server";
import { getVendorDocumentAlertDays, listVendorDocumentKinds } from "@/modules/vendors/service";
import { vendorSettingsAccess } from "../guard";
import { ScreenHelp } from "@/app/screen-help";
import { archiveDocumentKindAction } from "./actions";
import { AddKindForm, AlertDaysForm } from "./forms";

export default async function VendorDocumentSettingsPage() {
  const { organizationId, enabled } = await vendorSettingsAccess();
  const t = await getTranslations("VendorDocumentSettings");
  const tMenu = await getTranslations("SettingsMenu");
  const tHelp = await getTranslations("Help");
  if (!enabled) {
    return (
      <main>
        <h1>{tMenu("rubrics.vendorDocuments.label")}</h1>
        <p>{t("unavailable")}</p>
      </main>
    );
  }
  const locale = (await getLocale()) === "en" ? "en" : "fr";
  const [days, kinds] = await Promise.all([getVendorDocumentAlertDays(organizationId), listVendorDocumentKinds(organizationId, locale)]);
  return (
    <main>
      <h1>{tMenu("rubrics.vendorDocuments.label")}</h1>
      <ScreenHelp title={tHelp("vendorDocuments.title")} body={tHelp("vendorDocuments.body")} />
      <section className="card" aria-labelledby="alert-days-title">
        <h2 id="alert-days-title">{t("alertTitle")}</h2>
        <p>{t("alertIntro")}</p>
        <AlertDaysForm days={days} />
      </section>
      <section className="card" aria-labelledby="kinds-title">
        <h2 id="kinds-title">{t("kindsTitle")}</h2>
        <ul>
          {kinds.map((kind) => (
            <li key={kind.id}>
              {kind.label} {kind.expires ? <span className="badge">{t("kindWithExpiry")}</span> : null}
              <form action={archiveDocumentKindAction} className="inline-form">
                <input type="hidden" name="kindId" value={kind.id} />
                <button type="submit">{t("kindRemove", { kind: kind.label })}</button>
              </form>
            </li>
          ))}
        </ul>
        <AddKindForm />
      </section>
    </main>
  );
}
