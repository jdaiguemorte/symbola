import Link from "next/link";
import { redirect } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { formatCalendarDate, type Locale } from "@symbola/i18n";
import { HelpButton } from "@symbola/ui";
import { listClientEvents } from "@/modules/events/service";
import { getClientAuthContext } from "@/lib/auth-context";
import { isEventsModuleEnabled } from "@/app/events/module-access";
import { logoutAction } from "../logout-action";

// EVT-06 — accueil de l'espace du marié : ses événements.
export default async function ClientSpacePage() {
  const auth = await getClientAuthContext();
  if (auth.status === "unauthenticated") redirect("/login");
  if (auth.status === "mfa_required") redirect("/mfa");
  if (auth.status === "forbidden") redirect("/");
  if (!auth.user.organizationId) redirect("/login");
  // Dégradation propre (CLAUDE.md §2.3) : module désactivé = « indisponible ».
  if (!(await isEventsModuleEnabled(auth.user.organizationId))) {
    const tUnavailable = await getTranslations("ClientSpace");
    return (
      <main>
        <h1>{tUnavailable("title")}</h1>
        <p>{tUnavailable("unavailable")}</p>
      </main>
    );
  }

  const t = await getTranslations("ClientSpace");
  const tHelp = await getTranslations("Help");
  const locale = (await getLocale()) as Locale;
  const events = await listClientEvents(auth.user.organizationId, auth.user.id);

  return (
    <main>
      <h1>{t("title")}</h1>
      <HelpButton title={tHelp("clientSpace.title")} body={tHelp("clientSpace.body")} />
      <nav aria-label={t("accountNav")}>
        <Link href="/espace/securite">{t("securityLink")}</Link>
        {" · "}
        <Link href="/profil">{t("profileLink")}</Link>
      </nav>
      {events.length === 0 ? <p>{t("noEvents")}</p> : null}
      <ul aria-label={t("eventsLabel")}>
        {events.map((event) => (
          <li key={event.id}>
            <Link href={`/espace/${event.id}`}>
              {event.clients.map((client) => client.firstName).join(" & ")}
              {" — "}
              {event.eventDate ? formatCalendarDate(event.eventDate, locale) : t("dateUnset")}
            </Link>
          </li>
        ))}
      </ul>
      <form action={logoutAction}>
        <button type="submit">{t("logout")}</button>
      </form>
    </main>
  );
}
