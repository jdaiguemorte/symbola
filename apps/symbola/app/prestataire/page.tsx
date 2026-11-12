import { requireLink } from "@/lib/guards";
import { VendorSpaceContent } from "./vendor-space-content";

// Lot 26b (UX-11, POR-01 ; ADR 0053, décision D9) — espace minimal d'un
// prestataire, ouvert par son lien personnel. Lot 27a : son contenu vit dans
// VendorSpaceContent, qui sert aussi l'aperçu « vu par » de la planner (POR-09).
export default async function VendorSpacePage() {
  const access = await requireLink("vendor");
  return <VendorSpaceContent access={access} />;
}
