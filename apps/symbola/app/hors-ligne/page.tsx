// Lot 29a (ARC-09, NFR-09 ; ADR 0064, décision D6) — page « Hors ligne » : le service
// worker la sert quand un écran est demandé sans réseau. Elle ne montre que ce que
// l'appareil garde (les jours J), lu dans son cache ; aucune donnée du serveur, aucune
// session demandée. Les écrans de gestion ne sont jamais servis depuis une copie.
import { getTranslations } from "next-intl/server";
import { ScreenHelp } from "@/app/screen-help";
import { OfflineDays } from "./offline-days";

export default async function OfflinePage() {
  const t = await getTranslations("Offline");
  const tHelp = await getTranslations("Help");
  return (
    <main className="day-of">
      <ScreenHelp title={tHelp("offline.title")} body={tHelp("offline.body")} />
      <h1>{t("title")}</h1>
      <p>{t("intro")}</p>
      <OfflineDays />
    </main>
  );
}
