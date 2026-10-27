import { redirect } from "next/navigation";
import { getMessages, getTranslations } from "next-intl/server";
import { getAuthContext } from "@/lib/auth-context";
import { AideSearch, type HelpTopic } from "./aide-search";

// AIDE-03 — « L'aide est consultable et cherchable depuis le hub. » Les
// articles existent déjà par écran (Help.*) ; cette page les réunit sans
// dupliquer leur contenu, en filtrant les entrées qui ne sont pas des
// articles (ex. Help.relaunchTour, une simple chaîne).
export default async function AidePage() {
  const auth = await getAuthContext();
  if (auth.status === "unauthenticated") redirect("/login");
  if (auth.status === "mfa_required") redirect("/mfa");

  const t = await getTranslations("Aide");
  const messages = await getMessages();
  const help = messages.Help as Record<string, unknown>;

  const topics: HelpTopic[] = Object.values(help).filter(
    (entry): entry is HelpTopic =>
      typeof entry === "object" && entry !== null && "title" in entry && "body" in entry,
  );

  return (
    <main>
      <h1>{t("title")}</h1>
      <AideSearch topics={topics} searchLabel={t("search")} noResults={t("noResults")} />
    </main>
  );
}
