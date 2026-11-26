// Lot 70a (CHR-02 ; A1) — tant que la personne n'a pas donné son prénom, une ligne discrète de l'accueil le
// lui propose, pour que l'équipe la reconnaisse dans « Qui s'en charge » ; elle se ferme sur cet appareil.
import Link from "next/link";
import { cookies } from "next/headers";
import { getTranslations } from "next-intl/server";
import { getUserNames } from "@symbola/auth";
import { appDatabase } from "@symbola/db/client";
import { dismissNamesPromptAction } from "@/app/profil/actions";
import { NAMES_PROMPT_COOKIE } from "@/app/profil/names-prompt-cookie";

export async function NamesPrompt({ userId }: { userId: string }) {
  if ((await cookies()).get(NAMES_PROMPT_COOKIE)) return null;
  const { firstName } = await getUserNames(appDatabase(), userId);
  if (firstName) return null;
  const t = await getTranslations("Profile");
  return (
    <form action={dismissNamesPromptAction} className="row-wrap field-hint">
      <span>
        {t("namesPrompt")} <Link href="/profil#profile-names-title">{t("namesPromptLink")}</Link>
      </span>
      <button type="submit" className="button-ghost">
        {t("namesPromptDismiss")}
      </button>
    </form>
  );
}
