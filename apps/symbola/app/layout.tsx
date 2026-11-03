import type { ReactNode } from "react";
import { Fraunces, Inter } from "next/font/google";
import { NextIntlClientProvider } from "next-intl";
import { getLocale } from "next-intl/server";
import { AppShell } from "./app-shell";
import "./globals.css";

// Charte graphique (lot 7, ADR 0025) : polices servies par l'app elle-même
// (next/font les télécharge au build), aucun appel à Google côté navigateur.
const fraunces = Fraunces({ subsets: ["latin"], weight: ["400", "600"], variable: "--font-fraunces", display: "swap" });
const inter = Inter({ subsets: ["latin"], weight: ["400", "500", "600"], variable: "--font-inter", display: "swap" });

export const metadata = {
  title: "Symbola",
  description: "Suite applicative pour les métiers de l'événementiel",
};

export default async function RootLayout({ children }: { children: ReactNode }) {
  const locale = await getLocale();

  return (
    <html lang={locale} className={`${fraunces.variable} ${inter.variable}`}>
      <body>
        <NextIntlClientProvider>
          <AppShell>{children}</AppShell>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
