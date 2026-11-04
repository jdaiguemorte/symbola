// Lot 11 (PRE-02) — types de prestataires et leurs champs ; les champs
// cochés « filtre » apparaissent dans les filtres du carnet.
import { getTranslations } from "next-intl/server";
import { listVendorTypes } from "@/modules/vendors/service";
import { addStarterVendorTypesAction, removeVendorFieldAction, removeVendorTypeAction, toggleVendorFieldFilterAction } from "../actions";
import { vendorSettingsAccess } from "./guard";
import { AddFieldForm, CreateTypeForm } from "./settings-forms";

export default async function VendorTypesPage() {
  const { organizationId, enabled } = await vendorSettingsAccess();
  const t = await getTranslations("VendorBook");
  if (!enabled) {
    return (
      <main>
        <h1>{t("settingsTitle")}</h1>
        <p>{t("moduleUnavailable")}</p>
      </main>
    );
  }
  const types = await listVendorTypes(organizationId);
  return (
    <main>
      <h1>{t("settingsTypesTitle")}</h1>
      <p>{t("settingsTypesIntro")}</p>
      {types.length === 0 ? (
        <section className="card" aria-labelledby="starter-title">
          <h2 id="starter-title">{t("starterTitle")}</h2>
          <p>{t("starterBody")}</p>
          <form action={addStarterVendorTypesAction} className="primary-action">
            <button type="submit">{t("starterAdd")}</button>
          </form>
        </section>
      ) : null}
      {types.map((type) => (
        <section key={type.id} className="card" aria-labelledby={`type-${type.id}`}>
          <div className="section-head">
            <h2 id={`type-${type.id}`}>{type.label}</h2>
            <form action={removeVendorTypeAction}>
              <input type="hidden" name="typeId" value={type.id} />
              <button type="submit">{t("typeRemove", { type: type.label })}</button>
            </form>
          </div>
          {type.fields.length === 0 ? <p>{t("fieldsEmpty")}</p> : null}
          {type.fields.length > 0 ? (
            <div role="region" aria-label={t("fieldsOf", { type: type.label })} tabIndex={0}>
              <table className="data-table">
                <thead>
                  <tr>
                    <th scope="col">{t("fieldName")}</th>
                    <th scope="col">{t("fieldKind")}</th>
                    <th scope="col">{t("fieldIsFilter")}</th>
                    <th scope="col">{t("fieldActions")}</th>
                  </tr>
                </thead>
                <tbody>
                  {type.fields.map((field) => (
                    <tr key={field.id}>
                      <th scope="row">
                        {field.label}
                        {field.kind === "choice" ? <span className="meta"> ({field.choices.join(", ")})</span> : null}
                      </th>
                      <td>{t(`kind.${field.kind}`)}</td>
                      <td>
                        <form action={toggleVendorFieldFilterAction}>
                          <input type="hidden" name="fieldId" value={field.id} />
                          <input type="hidden" name="isFilter" value={field.isFilter ? "false" : "true"} />
                          <button type="submit" aria-label={`${field.isFilter ? t("yes") : t("no")} — ${t(field.isFilter ? "filterOffFor" : "filterOnFor", { field: field.label })}`}>
                            {field.isFilter ? t("yes") : t("no")}
                          </button>
                        </form>
                      </td>
                      <td>
                        <form action={removeVendorFieldAction}>
                          <input type="hidden" name="fieldId" value={field.id} />
                          <button type="submit">{t("fieldRemove", { field: field.label })}</button>
                        </form>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : null}
          <AddFieldForm typeId={type.id} typeLabel={type.label} />
        </section>
      ))}
      <section className="card" aria-labelledby="new-type-title">
        <h2 id="new-type-title">{t("typeNew")}</h2>
        <CreateTypeForm />
      </section>
    </main>
  );
}
