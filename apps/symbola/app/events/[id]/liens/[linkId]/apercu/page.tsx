import Link from "next/link";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { ScreenHelp } from "@/app/screen-help";
import { getLinkAccess, listEventLinks } from "@/modules/events/service";
import { requirePlanner } from "@/lib/guards";
import { isEventsModuleEnabled, isValidId } from "@/app/events/module-access";
import { PortalContent } from "@/app/portail/portal-content";
import { VendorSpaceContent } from "@/app/prestataire/vendor-space-content";

// Lot 27a (POR-09, UX-17, décision D8) — aperçu « vu par » : la planner voit
// exactement ce que voit la personne d'un lien, rendu par les mêmes composants
// que son portail (ou son espace de prestataire), avec l'accès de ce lien.
// Actions inactives, fichiers fermés ; ni session de lien, ni date
// d'ouverture, ni ligne au journal du lien. Un lien qui ne vaut plus montre
// ce que la personne verrait : « Ce lien n'est plus valable ».
export default async function LinkPreviewPage({ params }: { params: Promise<{ id: string; linkId: string }> }) {
  const auth = await requirePlanner();
  const organizationId = auth.user.organizationId;
  const { id, linkId } = await params;
  if (!isValidId(id) || !isValidId(linkId) || !(await isEventsModuleEnabled(organizationId))) notFound();
  const link = (await listEventLinks(organizationId, id)).find((candidate) => candidate.id === linkId);
  if (!link) notFound();
  const t = await getTranslations("Events");
  const tLink = await getTranslations("LinkPortal");
  const tHelp = await getTranslations("Help");
  const banner = (
    <div className="notice preview-banner" role="note">
      <p>
        <strong>{t("linkPreviewBanner", { name: link.personName })}</strong>
      </p>
      <p>{t("linkPreviewNote")}</p>
      <ScreenHelp title={tHelp("linkPreview.title")} body={tHelp("linkPreview.body")} />
      <p>
        <Link href={`/events/${id}?onglet=maries`}>{t("linkPreviewBack")}</Link>
      </p>
    </div>
  );
  const access = await getLinkAccess(organizationId, linkId);
  if (!access) {
    return (
      <main className="link-page">
        {banner}
        <h1>{tLink("invalidTitle")}</h1>
        <p>{tLink("invalidBody")}</p>
      </main>
    );
  }
  return access.audience === "vendor" ? <VendorSpaceContent access={access} preview banner={banner} /> : <PortalContent access={access} preview banner={banner} />;
}
