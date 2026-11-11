// Lot 24b (SEC-22) — piège à robots des formulaires publics (connexion, mot de
// passe oublié, réinitialisation, invitations) : un champ hors de l'écran, que
// les lecteurs d'écran ignorent et qu'un humain ne remplit pas. Rempli, l'envoi
// vient d'un robot : il est ignoré, sans le lui dire.
export const HONEYPOT_FIELD = "site_web";

export function isHoneypotFilled(formData: FormData): boolean {
  return String(formData.get(HONEYPOT_FIELD) ?? "").trim() !== "";
}
