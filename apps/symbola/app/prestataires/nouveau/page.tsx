// Lot 11 (L11-PRE-01) — nouvelle fiche du carnet ; depuis un poste, on revient
// ensuite au carnet pour l'ajouter au poste.
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { listVendorFamilies, listVendorTagGroups, listVendorTags, listVendorTypes } from "@/modules/vendors/service";
import { requirePlanner } from "@/lib/guards";
import { queryString, type BookQuery } from "../filters";
import { isVendorsModuleEnabled } from "../module-access";
import { VendorForm } from "../vendor-form";
import { ScreenHelp } from "@/app/screen-help";

export default async function NewVendorPage({ searchParams }: { searchParams: Promise<BookQuery> }) {
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
  const back = query.evenement && query.poste ? `/prestataires${queryString(query)}` : "";
  const [types, tags, families, tagGroups] = await Promise.all([
    listVendorTypes(organizationId),
    listVendorTags(organizationId),
    listVendorFamilies(organizationId),
    listVendorTagGroups(organizationId),
  ]);
  return (
    <main>
      <p>
        <Link href={back || "/prestataires"}>{t("backToBook")}</Link>
      </p>
      <h1>{t("newVendor")}</h1>
      <ScreenHelp title={tHelp("vendorNew.title")} body={tHelp("vendorNew.body")} />
      <p>{t("newVendorHint")}</p>
      <VendorForm types={types} tags={tags} tagGroups={tagGroups} families={families} back={back} />
    </main>
  );
}
