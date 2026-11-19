// Lot 26a (SEC-17) : le portail d'un lien personnel n'est pas indexé (en-tête
// X-Robots-Tag dans next.config.ts, et balise robots ici).
// Lot 55 (POR-11, POR-08 ; ADR 0101) : le portail a son manifeste, au nom et aux couleurs de
// l'organisation du lien (à la place de celui de l'application de l'équipe), et propose
// l'installation à partir de la deuxième visite.
import type { Metadata } from "next";
import type { ReactNode } from "react";
import { currentLinkAccess } from "@/lib/link-session";
import { PortalInstallPrompt } from "./install-prompt";

export async function generateMetadata(): Promise<Metadata> {
  const access = await currentLinkAccess();
  return {
    robots: { index: false, follow: false, nocache: true },
    ...(access && access.audience === "client" ? { manifest: `/portail/manifeste/${access.organizationId}` } : {}),
  };
}

export default async function PortalLayout({ children }: { children: ReactNode }) {
  const access = await currentLinkAccess();
  return (
    <>
      {access?.audience === "client" ? <PortalInstallPrompt /> : null}
      {children}
    </>
  );
}
