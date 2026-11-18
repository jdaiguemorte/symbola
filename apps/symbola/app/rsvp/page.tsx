// Lot 49 (INV-03 ; SU-10, SU-11) — page de réponse d'un invité (/rsvp#<jeton>), sans compte. Le
// serveur ne voit jamais le jeton dans l'adresse : la page l'échange dans le navigateur, puis
// affiche la réponse de son foyer. Un lien inconnu, retiré ou d'un module fermé : « lien inconnu »,
// sans rien révéler.
import { RsvpApp } from "./rsvp-app";

export default function RsvpPage() {
  return <RsvpApp />;
}
