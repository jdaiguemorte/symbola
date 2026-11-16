// Lot 37a (DOC-04, SEC-17 ; D7 ; ADR 0070) — page d'arrivée d'un lien de partage de document
// (/partage#<jeton>). Comme pour un lien personnel, le serveur ne voit jamais le jeton dans
// l'adresse : la page le lit dans le navigateur, l'efface de l'adresse, puis l'envoie en POST. Un
// lien inconnu, expiré ou révoqué reçoit la même réponse, sans nom de fichier ni d'évènement.
import { getTranslations } from "next-intl/server";
import { ShareOpener } from "./share-opener";

export default async function SharePage({ searchParams }: { searchParams: Promise<{ lien?: string }> }) {
  const t = await getTranslations("SharedDocuments");
  const { lien } = await searchParams;
  return (
    <main className="link-page">
      <ShareOpener invalid={lien === "invalide"} />
      {/* RGP-03 : cette page ne recueille rien. */}
      <p className="muted">{t("pageNotice")}</p>
    </main>
  );
}
