// Lot 44 (CRM-01 ; D2) — /contact/<adresse> : le formulaire partagé par lien. Il ne s'encadre pas
// (X-Frame-Options: DENY, frame-ancestors 'none') ; la page encadrable est /contact/<adresse>/cadre.
import { ContactPage } from "./contact-page";

export default async function PublicContactPage({ params }: { params: Promise<{ adresse: string }> }) {
  const { adresse } = await params;
  return <ContactPage slug={adresse} framed={false} />;
}
