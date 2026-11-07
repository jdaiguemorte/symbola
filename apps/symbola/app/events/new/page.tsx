import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { ScreenHelp } from "@/app/screen-help";
import { listProspectSources } from "@/modules/events/service";
import { getPlannerAuthContext } from "@/lib/auth-context";
import { isEventsModuleEnabled } from "../module-access";
import Link from "next/link";
import { NewProspectForm } from "./new-prospect-form";
import { LoadStarterListsForm } from "../parametres/starter-lists-form";

// HUB-13 (lot 12) : depuis un clic sur une date de l'agenda, la date est
// pré-remplie et « Créer un événement » crée directement un événement confirmé.
export default async function NewProspectPage({ searchParams }: { searchParams: Promise<{ date?: string; type?: string }> }) {
  const query = await searchParams;
  const initialDate = query.date && /^\d{4}-\d{2}-\d{2}$/.test(query.date) ? query.date : "";
  const confirmed = query.type === "evenement";
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
      <h1>{t(confirmed ? "newConfirmedEvent" : "newProspect")}</h1>
      <ScreenHelp title={tHelp("eventsNew.title")} body={tHelp("eventsNew.body")} />
      {/* EVT-07 : sans source, la création est impossible ; on dit pourquoi et comment y remédier. */}
      {sources.length === 0 ? (
        <section aria-labelledby="no-sources-title" className="card">
          <h2 id="no-sources-title">{t("noSourcesTitle")}</h2>
          <p>
            {t.rich("noSourcesYet", {
              link: (chunks) => <Link href="/events/parametres/sources">{chunks}</Link>,
            })}
          </p>
          <LoadStarterListsForm />
        </section>
      ) : null}
      <NewProspectForm sources={sources} initialDate={initialDate} confirmed={confirmed} />
    </main>
  );
}
