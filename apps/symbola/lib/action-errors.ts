// Lot 39b (NFR-16, UX-10 ; D9 ; ADR 0074) — une action serveur qui échoue sans raison prévue ne casse
// plus la page : elle rend au formulaire un message qui dit ce qui s'est passé et comment en sortir,
// avec une référence courte, notée au journal du serveur (nom de l'erreur seulement, jamais son
// message : il peut contenir une donnée personnelle, SEC-20). Les redirections et pages introuvables
// de Next.js passent : ce ne sont pas des erreurs.
import { unstable_rethrow } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { newErrorReference } from "./error-reference";

export async function unexpectedActionError(error: unknown): Promise<string> {
  unstable_rethrow(error);
  const reference = newErrorReference();
  console.error("action en échec", JSON.stringify({ reference, name: error instanceof Error ? error.name : "inconnue" }));
  const t = await getTranslations("Errors");
  return t("actionFailed", { reference });
}
