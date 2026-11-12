import { requireLink } from "@/lib/guards";
import { PortalContent } from "./portal-content";

// PRD-EVT-06, lot 26a (UX-11, POR-01, POR-10 ; ADR 0053) — le portail d'un tiers,
// ouvert par son lien personnel. Lot 26b (SC-S3) : le portail est celui du
// client. Lot 27a : son contenu vit dans PortalContent, qui sert aussi l'aperçu
// « vu par » de la planner (POR-09).
export default async function PortalPage() {
  const access = await requireLink("client");
  return <PortalContent access={access} />;
}
