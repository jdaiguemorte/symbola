import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { getAuthContext } from "@/lib/auth-context";
import { LanguageForm } from "./language-form";

export default async function ProfilePage() {
  const auth = await getAuthContext();
  if (auth.status === "unauthenticated") redirect("/login");
  if (auth.status === "mfa_required") redirect("/mfa");

  const t = await getTranslations("Profile");

  return (
    <main>
      <h1>{t("title")}</h1>
      <LanguageForm currentLanguage={auth.user.language ?? "fr"} />
    </main>
  );
}
