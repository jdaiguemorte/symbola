// Lot 60 (L60-PLA-05 ; POR-10) — la rubrique « Plan de salle » du portail du client : la dernière
// version diffusée de chaque plan de l'évènement, en lecture, sans note interne. Fermée par défaut ;
// sans elle (ou sans le module), « indisponible », jamais une erreur.
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { ScreenHelp } from "@/app/screen-help";
import { requireLink } from "@/lib/guards";
import { floorplansForLink } from "@/modules/floorplans/service";
import { LinkPrivacyNotice } from "../link-privacy-notice";
import { linkFloorplanAccess } from "@/app/plans-de-salle/link-access";
import { SharedFloorplanView } from "@/app/plans-de-salle/shared-floorplan";

export default async function PortalFloorplanPage() {
  const link = await requireLink("client");
  const t = await getTranslations("Floorplans.shared");
  const tHelp = await getTranslations("Help");
  const access = await linkFloorplanAccess("client", link);
  const plans = access ? await floorplansForLink(access) : [];
  return (
    <main className="portal stack">
      <p>
        <Link href="/portail">{t("backPortal")}</Link>
      </p>
      <h1>{t("title")}</h1>
      <ScreenHelp title={tHelp("floorplanShared.title")} body={tHelp("floorplanShared.body")} />
      {!access ? <p>{t("unavailable")}</p> : plans.length === 0 ? <p>{t("none")}</p> : null}
      {plans.map((plan) => (
        <SharedFloorplanView key={plan.layoutId} plan={plan} basePath="/portail/plan-de-salle" audience="client" />
      ))}
      <LinkPrivacyNotice organizationId={link.organizationId} />
    </main>
  );
}
