"use client";

// Lot 74g — « Paramètres » ouvrait « Entreprise et TVA » ; ses ancres (« #tva-debits »,
// « #informations-professionnel »…) étaient citées par des liens, des e-mails et l'aide. Le fragment
// n'arrive pas au serveur : l'accueil les renvoie à leur rubrique, au même bloc, sans garder l'accueil
// dans l'historique.
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { companyAnchorTarget } from "../settings-menu";

export function CompanyAnchorRedirect() {
  const router = useRouter();
  useEffect(() => {
    const target = companyAnchorTarget(window.location.hash);
    if (target) router.replace(target);
  }, [router]);
  return null;
}
