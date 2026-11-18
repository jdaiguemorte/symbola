import { requireLink } from "@/lib/guards";
import { VendorSpaceContent } from "./vendor-space-content";

// Lot 26b (UX-11, POR-01 ; ADR 0053, décision D9) — espace minimal d'un
// prestataire, ouvert par son lien personnel. Lot 27a : son contenu vit dans
// VendorSpaceContent, qui sert aussi l'aperçu « vu par » de la planner (POR-09).
// Lot 47 (D4) : « ?reponse=oui|non » vient d'un bouton de l'e-mail du brief ; il présélectionne la
// réponse, que le prestataire confirme d'un toucher (rien n'est enregistré à l'ouverture).
export default async function VendorSpacePage({ searchParams }: { searchParams: Promise<{ reponse?: string }> }) {
  const access = await requireLink("vendor");
  const { reponse } = await searchParams;
  const preselected = reponse === "oui" ? "available" : reponse === "non" ? "unavailable" : null;
  return <VendorSpaceContent access={access} preselected={preselected} />;
}
