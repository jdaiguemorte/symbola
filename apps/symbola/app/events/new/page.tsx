import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { HelpButton } from "@symbola/ui";
import { listProspectSources } from "@/modules/events/service";
import { getPlannerAuthContext } from "@/lib/auth-context";
import { isEventsModuleEnabled } from "../module-access";
import { NewProspectForm } from "./new-prospect-form";

export default async function NewProspectPage() {
  const auth = await getPlannerAuthContext();
  if (auth.status === "unauthenticated") redirect("/login");
  if (auth.status === "mfa_required") redirect("/mfa");
  if (auth.status === "forbidden") redirect(auth.role === "client" ? "/espace" : "/");
  if (!auth.user.organizationId) redirect("/");

  const t = await getTranslations("Events");
  const tHelp = await getTranslations("Help");
  if (!(await isEventsModuleEnabled(auth.user.organizationId))) {
    return (
      <main>
        <h1>{t("title")}</h1>
        <p>{t("moduleUnavailable")}</p>
      </main>
    );
  }
  const sources = await listProspectSources(auth.user.organizationId);

  return (
    <main>
      <h1>{t("newProspect")}</h1>
      <HelpButton title={tHelp("eventsNew.title")} body={tHelp("eventsNew.body")} />
      <NewProspectForm sources={sources} />
    </main>
  );
}
