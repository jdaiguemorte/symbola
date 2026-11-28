// Lot 11 (L11-PRE-01) — l'adresse d'une nouvelle fiche du carnet. Lot 73d (PRE-01 ; spécification du lot 73,
// § 5.4 ; V10, C-46) : elle ouvre la fenêtre unique de création sur le carnet (« ?nouveau=1 ») ; l'adresse
// est gardée pour les liens qui y mènent (« + Créer », la barre de commandes, les premiers pas).
import { redirect } from "next/navigation";
import { requirePlanner } from "@/lib/guards";
import { queryString, type BookQuery } from "../filters";

export default async function NewVendorPage({ searchParams }: { searchParams: Promise<BookQuery> }) {
  await requirePlanner();
  const query = await searchParams;
  redirect(`/prestataires${queryString(query, { rubrique: null, nouveau: "1" })}`);
}
