// Lot 73b (PRE-01, HUB-14, UX-08 ; spécification du lot 73, § 5.2, critère 9 ; D9, V6, P13 ; maquette 18,
// « Un carnet tout juste importé ») — l'écran « Classer N fiches » : un métier par fiche, proposé d'après
// son nom (proposeVendorTypeFromName, 73a) et dit d'où il vient ; rien n'est enregistré avant
// « Enregistrer ». « Revoir » (?revoir=, des identifiants codés, jamais un nom) le rouvre sur les fiches
// qui viennent d'être classées, chacune avec son métier enregistré, qui se change comme les autres.
// Session, organisation, module : refus par défaut ; une fiche d'une autre organisation n'apparaît pas
// (RLS), et son enregistrement serait refusé (service).
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { starterVendorTypeSynonyms } from "@symbola/starter-templates";
import { findVendors, listVendorFamilies, listVendorTypes } from "@/modules/vendors/service";
import { requirePlanner } from "@/lib/guards";
import { ScreenHelp } from "@/app/screen-help";
import { settingsPanelHref } from "@/app/reglages/panels";
import { isVendorsModuleEnabled } from "../module-access";
import { classifyRows, decodeVendorIds } from "../book-row";
import { ClassifyForm } from "./classify-form";

export default async function ClassifyVendorsPage({ searchParams }: { searchParams: Promise<{ revoir?: string; sans?: string }> }) {
  const auth = await requirePlanner();
  const organizationId = auth.user.organizationId;
  const t = await getTranslations("VendorBook");
  const tHelp = await getTranslations("Help");
  if (!(await isVendorsModuleEnabled(organizationId))) {
    return (
      <main>
        <h1>{t("title")}</h1>
        <p>{t("moduleUnavailable")}</p>
      </main>
    );
  }
  const query = await searchParams;
  const reviewIds = typeof query.revoir === "string" ? decodeVendorIds(query.revoir) : [];
  const reviewing = reviewIds.length > 0;
  const [types, families] = await Promise.all([listVendorTypes(organizationId), listVendorFamilies(organizationId)]);
  const classified = new Set(types.filter((type) => type.familyId !== null).map((type) => type.id));
  // « Classer » : les fiches sans métier rangé dans une famille ; « Revoir » : les fiches données.
  const vendors = reviewing ? await findVendors({ organizationId, ids: reviewIds }) : (await findVendors({ organizationId, unclassified: true })).filter((vendor) => !vendor.typeIds.some((id) => classified.has(id)));
  const result = classifyRows(
    vendors.map((vendor) => ({ id: vendor.id, name: vendor.name, city: vendor.city, typeIds: reviewing ? vendor.typeIds : [] })),
    types.map((type) => ({ id: type.id, label: type.label, starterKey: type.starterKey })),
    starterVendorTypeSynonyms(),
    { withoutFirst: query.sans === "1" },
  );
  const familyLabel = new Map(families.map((family) => [family.id, family.label]));
  const typeOptions = [...types]
    .sort((a, b) => (familyLabel.get(a.familyId ?? "") ?? "￿").localeCompare(familyLabel.get(b.familyId ?? "") ?? "￿", "fr") || a.label.localeCompare(b.label, "fr"))
    .map((type) => ({ id: type.id, label: type.label, group: type.familyId ? (familyLabel.get(type.familyId) ?? null) : null }));
  const labelOf = new Map(types.map((type) => [type.id, type.label]));

  return (
    <main>
      <p>
        <Link href="/prestataires">{t("backToBook")}</Link>
      </p>
      <h1>{reviewing ? t("classify.reviewTitle", { count: result.rows.length }) : t("classify.title", { count: result.rows.length })}</h1>
      <p className="meta">{t("classify.intro")}</p>
      <ScreenHelp title={tHelp("vendorClassify.title")} body={tHelp("vendorClassify.body")} />
      {result.rows.length === 0 ? (
        <p>
          {t("classify.nothing")} <Link href="/prestataires">{t("backToBook")}</Link>
        </p>
      ) : (
        <ClassifyForm
          reviewing={reviewing}
          rows={result.rows.map((row) => ({
            id: row.id,
            name: row.name,
            city: row.city,
            savedTypeId: row.savedTypeId,
            proposal: row.proposal ? { typeId: row.proposal.typeId, word: row.proposal.word, label: labelOf.get(row.proposal.typeId) ?? "" } : null,
          }))}
          proposed={result.proposed}
          withoutProposal={result.withoutProposal}
          withoutFirst={query.sans === "1"}
          types={typeOptions}
          createTypeHref={settingsPanelHref("/prestataires/parametres", "vendors")}
        />
      )}
    </main>
  );
}
