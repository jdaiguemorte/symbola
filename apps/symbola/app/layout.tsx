import type { ReactNode } from "react";

export const metadata = {
  title: "Symbola",
  description: "Suite applicative pour les métiers de l'événementiel",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="fr">
      <body>{children}</body>
    </html>
  );
}
