// Lot 26a (UX-11, SEC-15, SEC-17 ; ADR 0053) — page d'arrivée d'un lien
// personnel (/lien#<jeton>). Le serveur ne voit jamais le jeton : la page
// l'échange dans le navigateur. Elle dit aussi qu'un lien n'est plus valable,
// sans rien révéler, et confirme la fermeture d'une session (?ferme=1).
import { getTranslations } from "next-intl/server";
import { currentLinkAccess } from "@/lib/link-session";
import { linkHomePath } from "@/lib/link-cookie";
import { LinkOpener } from "./link-opener";

export default async function LinkPage({ searchParams }: { searchParams: Promise<{ ferme?: string }> }) {
  const t = await getTranslations("LinkPortal");
  const { ferme } = await searchParams;
  const access = ferme === "1" ? null : await currentLinkAccess();
  return (
    <main className="link-page">
      {ferme === "1" ? (
        <>
          <h1>{t("closedTitle")}</h1>
          <p role="status">{t("closedBody")}</p>
        </>
      ) : (
        <LinkOpener home={access ? linkHomePath(access.audience) : null} />
      )}
      {/* RGP-03 : cette page ne recueille rien. */}
      <p className="muted">{t("pageNotice")}</p>
    </main>
  );
}
