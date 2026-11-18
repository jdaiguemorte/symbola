// Lot 46 (RDV-03 ; D10 ; ADR 0053, ADR 0083) — page d'un lien de gestion de rendez-vous (/rdv#<jeton>).
// Comme pour un lien personnel, le serveur ne voit jamais le jeton dans l'adresse : la page le lit
// dans le navigateur, l'efface de l'adresse, puis l'envoie en POST. Aucun compte ; aucun cookie. Un
// lien inconnu, d'une autre organisation, expiré ou retiré reçoit la même réponse.
import { getTranslations } from "next-intl/server";
import { ManageOpener } from "./manage-opener";

export default async function ManageAppointmentPage() {
  const t = await getTranslations("Appointments.manage");
  return (
    <main className="link-page">
      <ManageOpener />
      {/* RGP-03 : cette page ne recueille rien de nouveau. */}
      <p className="muted">{t("pageNotice")}</p>
    </main>
  );
}
