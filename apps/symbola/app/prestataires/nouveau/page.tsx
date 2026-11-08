// Lot 11 (PRE-01) — nouvelle fiche du carnet ; depuis un poste, on revient
// ensuite au carnet pour l'ajouter au poste.
import Link from "next/link";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { listVendorFamilies, listVendorTags, listVendorTypes } from "@/modules/vendors/service";
import { getPlannerAuthContext } from "@/lib/auth-context";
import { queryString, type BookQuery } from "../filters";
import { isVendorsModuleEnabled } from "../module-access";
import { VendorForm } from "../vendor-form";

export default async function NewVendorPage({ searchParams }: { searchParams: Promise<BookQuery> }) {
  const auth = await getPlannerAuthContext();
  if (auth.status === "unauthenticated") redirect("/login");
  if (auth.status === "mfa_required") redirect("/mfa");
  if (auth.status === "forbidden") redirect(auth.role === "client" ? "/espace" : "/");
  if (!auth.user.organizationId) redirect("/");
  const organizationId = auth.user.organizationId;
  const t = await getTranslations("VendorBook");
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
  const [types, tags, families] = await Promise.all([listVendorTypes(organizationId), listVendorTags(organizationId), listVendorFamilies(organizationId)]);
  return (
    <main>
      <p>
        <Link href={back || "/prestataires"}>{t("backToBook")}</Link>
      </p>
      <h1>{t("newVendor")}</h1>
      <p>{t("newVendorHint")}</p>
      <VendorForm types={types} tags={tags} families={families} back={back} />
    </main>
  );
}
