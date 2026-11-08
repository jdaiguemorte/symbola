// Lot 16 (ADR 0045) — sur la page d'un événement, les composants client
// reçoivent le vocabulaire de son type (« les mariés » ou « le client ») quand
// il diffère de celui du métier, que garde le cadre de l'app. Les composants
// serveur l'ont déjà, par la configuration de la requête (i18n/request.ts).
import type { ReactNode } from "react";
import { NextIntlClientProvider } from "next-intl";
import { getMessages } from "next-intl/server";
import { getAuthContext } from "@/lib/auth-context";
import { organizationAudience, requestAudience } from "@/lib/vocabulary";

export async function EventVocabulary({ children }: { children: ReactNode }) {
  const auth = await getAuthContext();
  const organizationId = auth.status === "authenticated" ? auth.user.organizationId : null;
  if ((await requestAudience(organizationId)) === (await organizationAudience(organizationId))) return <>{children}</>;
  return <NextIntlClientProvider messages={await getMessages()}>{children}</NextIntlClientProvider>;
}
