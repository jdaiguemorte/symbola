import type { ReactNode } from "react";
import localFont from "next/font/local";
import { NextIntlClientProvider } from "next-intl";
import { getLocale } from "next-intl/server";
import type { Locale } from "@symbola/i18n";
import { AppShell } from "./app-shell";
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
  description: "Suite applicative pour les métiers de l'événementiel",
};

export default async function RootLayout({ children }: { children: ReactNode }) {
  const locale = await getLocale();

  return (
    <html lang={locale} className={`${spaceGrotesk.variable} ${inter.variable}`}>
      <body>
        {/* Lot 16 (ADR 0045) : le cadre reste en place d'une page à l'autre ; il
            garde le vocabulaire du métier. Une page d'événement dont le type en
            change reçoit le sien (app/event-vocabulary.tsx). */}
        <NextIntlClientProvider messages={await organizationMessages(locale as Locale)}>
          <AppShell>{children}</AppShell>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
