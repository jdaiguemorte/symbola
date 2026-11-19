// Lot 60 (L60-PLA-05 ; D8) — le plan de salle vu par un prestataire retenu, par son lien : la
// dernière version diffusée de chaque plan de l'évènement, son emplacement en évidence, ses besoins et
// sa prise, l'accès de livraison et les issues ; les autres prestataires par leur type (leur nom
// seulement si la planner l'a coché). Une version nouvelle est signalée, puis notée vue.
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { ScreenHelp } from "@/app/screen-help";
import { requireLink } from "@/lib/guards";
import { floorplansForLink } from "@/modules/floorplans/service";
import { LinkPrivacyNotice } from "@/app/portail/link-privacy-notice";
import { linkFloorplanAccess } from "@/app/plans-de-salle/link-access";
import { SharedFloorplanView } from "@/app/plans-de-salle/shared-floorplan";

export default async function VendorFloorplanPage() {
  const link = await requireLink("vendor");
  const t = await getTranslations("Floorplans.shared");
  const tHelp = await getTranslations("Help");
  const access = await linkFloorplanAccess("vendor", link);
  const plans = access ? await floorplansForLink(access) : [];
  return (
    <main className="portal stack">
      <p>
        <Link href="/prestataire">{t("backVendor")}</Link>
      </p>
      <h1>{t("title")}</h1>
      <ScreenHelp title={tHelp("floorplanShared.title")} body={tHelp("floorplanShared.body")} />
      {plans.length === 0 ? <p>{t("none")}</p> : null}
      {plans.map((plan) => (
        <SharedFloorplanView key={plan.layoutId} plan={plan} basePath="/prestataire/plan-de-salle" audience="vendor" />
      ))}
      <LinkPrivacyNotice organizationId={link.organizationId} />
    </main>
  );
}
