// Lot 11 (L11-PRE-02) — types de prestataires et leurs champs ; les champs
// cochés « filtre » apparaissent dans les filtres du carnet.
// Lot 16 (L16-PRE-15, ADR 0040) — familles et types en tableaux alignés (famille,
// type, nombre de fiches) ; le détail s'ouvre dans le panneau latéral (motif
// du lot 13) : renommer, changer de famille, champs, fusionner, supprimer en
// déplaçant les fiches. Les familles appartiennent à l'organisation.
import Link from "next/link";
import { getLocale, getTranslations } from "next-intl/server";
import { countVendorsByType, listVendorFamilies, listVendorTypes, type VendorFamily, type VendorType } from "@/modules/vendors/service";
import { ensureVendorFamilies } from "@/lib/vendors/catalog";
import { SidePanel } from "@/app/ui/side-panel";
import { addStarterVendorTypesAction, removeVendorFieldAction, toggleVendorFieldFilterAction } from "../actions";
import { FamilyIcon } from "../family-icon";
import { vendorSettingsAccess } from "./guard";
import { AddFieldForm } from "./settings-forms";
import { mergeVendorTypesAction, moveVendorFamilyAction, removeVendorFamilyAction, removeVendorTypeMovingAction } from "./type-actions";
import { FamilyForm, NewTypeForm, TypeForm } from "./type-forms";
import { ScreenHelp } from "@/app/screen-help";
import { ListFilter } from "@/app/ui/list-filter";

const BASE = "/prestataires/parametres";
const UNCLASSIFIED_COLOR = "#78716c";
const DONE = ["fusion", "type-supprime", "famille-supprimee"] as const;
const ERRORS = ["type-utilise", "type-introuvable", "famille-non-vide"] as const;

type Query = Record<string, string | string[] | undefined>;
const one = (query: Query, key: string) => {
  const value = query[key];
  return (Array.isArray(value) ? value[0] : value) ?? "";
};

// Liste déroulante des autres types, rangés par famille.
function TypeOptions({ types, families, except, unclassifiedLabel }: { types: VendorType[]; families: VendorFamily[]; except: string; unclassifiedLabel: string }) {
  const others = types.filter((type) => type.id !== except);
  const groups = [
    ...families.map((family) => ({ key: family.id, label: family.label, types: others.filter((type) => type.familyId === family.id) })),
    { key: "none", label: unclassifiedLabel, types: others.filter((type) => type.familyId === null) },
  ].filter((group) => group.types.length > 0);
  return (
    <>
      {groups.map((group) => (
        <optgroup key={group.key} label={group.label}>
          {group.types.map((type) => (
            <option key={type.id} value={type.id}>
              {type.label}
            </option>
          ))}
        </optgroup>
      ))}
    </>
  );
}

export default async function VendorTypesPage({ searchParams }: { searchParams: Promise<Query> }) {
  const { organizationId, enabled } = await vendorSettingsAccess();
  const t = await getTranslations("VendorBook");
  const tHelp = await getTranslations("Help");
  const tCommon = await getTranslations("Common");
  if (!enabled) {
    return (
      <main>
        <h1>{t("settingsTitle")}</h1>
        <p>{t("moduleUnavailable")}</p>
      </main>
    );
  }
  await ensureVendorFamilies(organizationId, (await getLocale()) === "en" ? "en" : "fr");
  const query = await searchParams;
  const [families, types, counts] = await Promise.all([listVendorFamilies(organizationId), listVendorTypes(organizationId), countVendorsByType(organizationId)]);
  const countOf = new Map(counts.map((entry) => [entry.typeId, entry.count]));
  const familyById = new Map(families.map((family) => [family.id, family]));
  const typesOf = (familyId: string | null) => types.filter((type) => type.familyId === familyId);
  const vendorsOf = (list: VendorType[]) => list.reduce((sum, type) => sum + (countOf.get(type.id) ?? 0), 0);
  const ordered = [...families.flatMap((family) => typesOf(family.id)), ...typesOf(null)];

  const openedType = types.find((type) => type.id === one(query, "type")) ?? null;
  const addingType = one(query, "type") === "nouveau";
  const openedFamily = families.find((family) => family.id === one(query, "famille")) ?? null;
  const addingFamily = one(query, "famille") === "nouvelle";
  const mergeTarget = openedType ? (types.find((type) => type.id === one(query, "fusion") && type.id !== openedType.id) ?? null) : null;
  const done = DONE.find((value) => value === one(query, "fait"));
  const error = ERRORS.find((value) => value === one(query, "erreur"));
  const openedCount = openedType ? (countOf.get(openedType.id) ?? 0) : 0;

  return (
    <main>
      <h1>{t("settingsTypesTitle")}</h1>
      <ScreenHelp title={tHelp("vendorTypes.title")} body={tHelp("vendorTypes.body")} />
      <p>{t("settingsTypesIntro")}</p>
      {done ? (
        <p role="status" className="notice">
          {t(`settingsDone.${done}`)}
        </p>
      ) : null}
      {error ? <p role="alert">{t(`settingsError.${error}`)}</p> : null}

      {types.length === 0 ? (
        <section className="card" aria-labelledby="starter-title">
          <h2 id="starter-title">{t("starterTitle")}</h2>
          <p>{t("starterBody")}</p>
          <form action={addStarterVendorTypesAction} className="primary-action">
            <button type="submit">{t("starterAdd")}</button>
          </form>
        </section>
      ) : null}

      <section aria-labelledby="families-title" className="settings-block">
        <div className="section-head">
          <h2 id="families-title">{t("familiesTitle")}</h2>
          <Link href={`${BASE}?famille=nouvelle`} scroll={false} className="button-link">
            {t("familyNew")}
          </Link>
        </div>
        <p className="muted">{t("familiesIntro")}</p>
        {families.length > 0 ? (
          <div className="list-table-wrap" role="region" aria-label={t("familiesTable")} tabIndex={0}>
            <table className="list-table">
              <thead>
                <tr>
                  <th scope="col">{t("columnFamily")}</th>
                  <th scope="col">{t("columnTypes")}</th>
                  <th scope="col">{t("columnVendors")}</th>
                  <th scope="col">{t("columnOrder")}</th>
                </tr>
              </thead>
              <tbody>
                {families.map((family, index) => (
                  <tr key={family.id} aria-current={openedFamily?.id === family.id ? "true" : undefined}>
                    <th scope="row">
                      <Link href={`${BASE}?famille=${family.id}`} scroll={false} className="family-cell">
                        <FamilyIcon color={family.color} icon={family.icon} />
                        {family.label}
                      </Link>
                    </th>
                    <td>{typesOf(family.id).length}</td>
                    <td>{vendorsOf(typesOf(family.id))}</td>
                    <td>
                      <div className="row-actions">
                        <form action={moveVendorFamilyAction}>
                          <input type="hidden" name="familyId" value={family.id} />
                          <input type="hidden" name="direction" value="up" />
                          <button type="submit" disabled={index === 0} aria-label={t("familyUp", { family: family.label })}>
                            ↑
                          </button>
                        </form>
                        <form action={moveVendorFamilyAction}>
                          <input type="hidden" name="familyId" value={family.id} />
                          <input type="hidden" name="direction" value="down" />
                          <button type="submit" disabled={index === families.length - 1} aria-label={t("familyDown", { family: family.label })}>
                            ↓
                          </button>
                        </form>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}
      </section>

      <section aria-labelledby="types-title" className="settings-block">
        <div className="section-head">
          <h2 id="types-title">{t("typesTitle")}</h2>
          <Link href={`${BASE}?type=nouveau`} scroll={false} className="button-link">
            {t("typeNew")}
          </Link>
        </div>
        <ListFilter targetId="vendor-types-list" total={ordered.length} />
        {ordered.length > 0 ? (
          <div className="list-table-wrap" role="region" aria-label={t("typesTable")} tabIndex={0}>
            <table className="list-table">
              <thead>
                <tr>
                  <th scope="col">{t("columnFamily")}</th>
                  <th scope="col">{t("columnType")}</th>
                  <th scope="col">{t("columnVendors")}</th>
                  <th scope="col">{t("columnFields")}</th>
                </tr>
              </thead>
              <tbody id="vendor-types-list">
                {ordered.map((type) => {
                  const family = type.familyId ? familyById.get(type.familyId) : undefined;
                  return (
                    <tr key={type.id} aria-current={openedType?.id === type.id ? "true" : undefined} data-filter-item={`${type.label} ${family?.label ?? ""}`}>
                      <td>
                        <span className="family-cell">
                          <FamilyIcon color={family?.color ?? UNCLASSIFIED_COLOR} icon={family?.icon ?? "other"} />
                          {family?.label ?? t("unclassified")}
                        </span>
                      </td>
                      <th scope="row">
                        <Link href={`${BASE}?type=${type.id}`} scroll={false}>
                          {type.label}
                        </Link>
                      </th>
                      <td>{countOf.get(type.id) ?? 0}</td>
                      <td>{type.fields.length}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : null}
      </section>

      {openedType ? (
        <SidePanel title={openedType.label} closeHref={BASE} closeLabel={tCommon("closePanel")}>
          <TypeForm key={openedType.id} type={openedType} families={families} />

          <section aria-labelledby="fields-title" className="panel-section">
            <h3 id="fields-title">{t("fieldsTitle")}</h3>
            {openedType.fields.length === 0 ? <p className="muted">{t("fieldsEmpty")}</p> : null}
            {openedType.fields.length > 0 ? (
              <ul className="panel-fields">
                {openedType.fields.map((field) => (
                  <li key={field.id}>
                    <span>
                      <strong>{field.label}</strong> · {t(`kind.${field.kind}`)}
                      {field.kind === "choice" ? <span className="meta"> ({field.choices.join(", ")})</span> : null}
                    </span>
                    <span className="row-actions">
                      <form action={toggleVendorFieldFilterAction}>
                        <input type="hidden" name="fieldId" value={field.id} />
                        <input type="hidden" name="isFilter" value={field.isFilter ? "false" : "true"} />
                        <button type="submit" aria-label={t(field.isFilter ? "filterOffFor" : "filterOnFor", { field: field.label })}>
                          {field.isFilter ? t("fieldFilterOn") : t("fieldFilterOff")}
                        </button>
                      </form>
                      <form action={removeVendorFieldAction}>
                        <input type="hidden" name="fieldId" value={field.id} />
                        <button type="submit">{t("fieldRemove", { field: field.label })}</button>
                      </form>
                    </span>
                  </li>
                ))}
              </ul>
            ) : null}
            <AddFieldForm typeId={openedType.id} typeLabel={openedType.label} />
          </section>

          <section aria-labelledby="merge-title" className="panel-section">
            <h3 id="merge-title">{t("mergeTitle")}</h3>
            {mergeTarget ? (
              <>
                <p>{t("mergeConfirm", { source: openedType.label, target: mergeTarget.label, count: openedCount })}</p>
                <form action={mergeVendorTypesAction} className="primary-action">
                  <input type="hidden" name="typeId" value={openedType.id} />
                  <input type="hidden" name="targetId" value={mergeTarget.id} />
                  <button type="submit">{t("mergeSubmit", { source: openedType.label, target: mergeTarget.label })}</button>
                </form>
                <Link href={`${BASE}?type=${openedType.id}`} scroll={false}>
                  {t("mergeCancel")}
                </Link>
              </>
            ) : types.length > 1 ? (
              <form method="get" action={BASE} className="panel-form">
                <input type="hidden" name="type" value={openedType.id} />
                <label>
                  {t("mergeInto", { type: openedType.label })}
                  <select name="fusion" required defaultValue="">
                    <option value="" disabled>
                      {t("chooseType")}
                    </option>
                    <TypeOptions types={types} families={families} except={openedType.id} unclassifiedLabel={t("unclassified")} />
                  </select>
                </label>
                <p className="muted">{t("mergeHint")}</p>
                <button type="submit">{t("mergeContinue")}</button>
              </form>
            ) : (
              <p className="muted">{t("mergeNone")}</p>
            )}
          </section>

          <section aria-labelledby="remove-title" className="panel-section">
            <h3 id="remove-title">{t("typeRemoveTitle")}</h3>
            {openedCount === 0 ? (
              <form action={removeVendorTypeMovingAction}>
                <input type="hidden" name="typeId" value={openedType.id} />
                <button type="submit">{t("typeRemove", { type: openedType.label })}</button>
              </form>
            ) : (
              <form action={removeVendorTypeMovingAction} className="panel-form">
                <input type="hidden" name="typeId" value={openedType.id} />
                <label>
                  {t("typeRemoveMoveTo", { count: openedCount })}
                  <select name="moveTo" required defaultValue="">
                    <option value="" disabled>
                      {t("chooseType")}
                    </option>
                    <TypeOptions types={types} families={families} except={openedType.id} unclassifiedLabel={t("unclassified")} />
                    <option value="aucun">{t("typeRemoveNoType")}</option>
                  </select>
                </label>
                <p className="muted">{t("typeRemoveFieldsHint")}</p>
                <button type="submit">{t("typeRemoveAndMove", { type: openedType.label })}</button>
              </form>
            )}
          </section>
        </SidePanel>
      ) : null}

      {addingType ? (
        <SidePanel title={t("typeNew")} closeHref={BASE} closeLabel={tCommon("closePanel")}>
          <NewTypeForm families={families} familyId={one(query, "dans")} />
        </SidePanel>
      ) : null}

      {openedFamily || addingFamily ? (
        <SidePanel title={openedFamily?.label ?? t("familyNew")} closeHref={BASE} closeLabel={tCommon("closePanel")}>
          <FamilyForm key={openedFamily?.id ?? "nouvelle"} family={openedFamily} />
          {openedFamily ? (
            <section aria-labelledby="family-types-title" className="panel-section">
              <h3 id="family-types-title">{t("familyTypesTitle")}</h3>
              {typesOf(openedFamily.id).length > 0 ? (
                <ul className="panel-fields">
                  {typesOf(openedFamily.id).map((type) => (
                    <li key={type.id}>
                      <Link href={`${BASE}?type=${type.id}`} scroll={false}>
                        {type.label}
                      </Link>
                      <span className="meta">{t("vendorCount", { count: countOf.get(type.id) ?? 0 })}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="muted">{t("familyEmpty")}</p>
              )}
              <Link href={`${BASE}?type=nouveau&dans=${openedFamily.id}`} scroll={false} className="button-link">
                {t("typeNewInFamily", { family: openedFamily.label })}
              </Link>
              {typesOf(openedFamily.id).length === 0 ? (
                <form action={removeVendorFamilyAction}>
                  <input type="hidden" name="familyId" value={openedFamily.id} />
                  <button type="submit">{t("familyRemove", { family: openedFamily.label })}</button>
                </form>
              ) : (
                <p className="muted">{t("familyRemoveHint")}</p>
              )}
            </section>
          ) : null}
        </SidePanel>
      ) : null}
    </main>
  );
}
