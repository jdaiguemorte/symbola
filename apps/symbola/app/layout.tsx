import { Suspense, type ReactNode } from "react";
import localFont from "next/font/local";
import { NextIntlClientProvider } from "next-intl";
import { getLocale } from "next-intl/server";
import type { Locale } from "@symbola/i18n";
import { AppShell } from "./app-shell";
import { PrepareEmailHost } from "./preparer/prepare-email-host";
import { clientMessages } from "@/lib/client-messages";
import { organizationMessages } from "@/lib/vocabulary";
import "./globals.css";

// Charte graphique (DESIGN.md, lot 25b, ADR 0057) : polices servies par l'app
// elle-même, fichiers versionnés dans app/fonts (licence OFL, sous-ensemble
// latin, poids variables) : ni le navigateur ni le build de l'image n'appellent
// Google. Space Grotesk pour les titres et les chiffres, Inter pour le texte.
const spaceGrotesk = localFont({
  src: "./fonts/space-grotesk-latin.woff2",
  weight: "300 700",
  variable: "--font-space-grotesk",
  display: "swap",
});
const inter = localFont({
  src: "./fonts/inter-latin.woff2",
  weight: "100 900",
  variable: "--font-inter",
  display: "swap",
});

export const metadata = {
  title: "Symbola",
  description: "Suite applicative pour les métiers de l'évènementiel",
  // Lot 55 (POR-11) : le manifeste de l'application de l'équipe ; le portail le remplace par le sien.
  manifest: "/manifest.webmanifest",
};

export default async function RootLayout({ children, panel }: { children: ReactNode; panel: ReactNode }) {
  const locale = await getLocale();

  return (
    <html lang={locale} className={`${spaceGrotesk.variable} ${inter.variable}`}>
      <body>
        {/* Lot 16 (ADR 0045) : le cadre reste en place d'une page à l'autre ; il
            garde le vocabulaire du métier. Une page d'événement dont le type en
            change reçoit le sien (app/event-vocabulary.tsx). */}
        <NextIntlClientProvider messages={clientMessages(await organizationMessages(locale as Locale))}>
          <AppShell>{children}</AppShell>
          {/* Lot 63c (ADR 0107) : le panneau des réglages d'un écran (navigation interceptée). */}
          {panel}
          {/* Lot 65d (ADR 0110) : la fenêtre « Préparer l'e-mail », ouverte par ?preparer=. */}
          <Suspense fallback={null}>
            <PrepareEmailHost />
          </Suspense>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
