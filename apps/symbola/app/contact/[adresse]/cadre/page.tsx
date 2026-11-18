// Lot 44 (CRM-01 ; D1 ; ADR 0084) — /contact/<adresse>/cadre : le même formulaire, à encadrer dans le
// site de la planner. Seule page de l'app sans X-Frame-Options: DENY ; sa CSP n'accepte comme parents
// que les sites déclarés (middleware.ts). Sans site déclaré, elle ne s'encadre nulle part.
import { ContactPage } from "../contact-page";

export default async function FramedContactPage({ params }: { params: Promise<{ adresse: string }> }) {
  const { adresse } = await params;
  return <ContactPage slug={adresse} framed />;
}
