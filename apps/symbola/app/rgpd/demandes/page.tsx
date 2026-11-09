// Lot 18 (RGPD-07, ADR 0047) : les demandes sont désormais l'onglet d'accueil
// de Données personnelles (/rgpd) ; l'ancienne adresse y renvoie.
import { redirect } from "next/navigation";
import { requireOwner } from "@/lib/guards";

export default async function PrivacyRequestsPage() {
  await requireOwner();
  redirect("/rgpd");
}
