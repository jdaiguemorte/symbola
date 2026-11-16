// Lot 38a (MSG-02, D8) — une demande de signature à plusieurs signataires ne part qu'avec l'empreinte
// de la liste revue sur l'écran du garde-fou. Les tests confirment la liste qu'ils envoient, comme
// l'écran le ferait ; le contrôle du service reste entier.
import { recipientsDigest } from "@/modules/hub/service";

export function confirmed<T extends { signers: { name: string; email: string }[] }>(input: T): T & { confirmedRecipients: string } {
  return { ...input, confirmedRecipients: recipientsDigest(input.signers.map(({ name, email }) => ({ name, email }))) };
}
