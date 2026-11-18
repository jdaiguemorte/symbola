// Lot 44 (CRM-01, D1 ; ADR 0084) — les sites autorisés à encadrer le formulaire de contact d'une
// adresse : lus par le middleware pour la seule page /contact/<adresse>/cadre. Un formulaire fermé,
// sans politique de confidentialité ou inconnu : null, la page ne s'encadre nulle part. Lecture sans organisation de la
// ligne publique du formulaire (politique public_lookup, migration 0159) ; rien de personnel.
import { eq } from "drizzle-orm";
import { appDatabase } from "@symbola/db/client";
import { contactForms } from "@symbola/db/schema/events";

export async function contactFrameOrigins(slug: string): Promise<string[] | null> {
  const [form] = await appDatabase()
    .select({ active: contactForms.active, policy: contactForms.privacyPolicyUrl, origins: contactForms.allowedOrigins })
    .from(contactForms)
    .where(eq(contactForms.slug, slug))
    .limit(1);
  return form && form.active && form.policy ? form.origins : null;
}
