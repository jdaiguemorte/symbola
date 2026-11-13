// Lot 31a (FAC-07, JUR-01, JUR-09, JUR-08 ; décision D4) — mentions requises manquantes,
// chacune nommée, avec le lien vers l'endroit où la remplir.
import Link from "next/link";
import { useTranslations } from "next-intl";
import type { MissingMention } from "@/modules/quotes/service";

const WHERE: Record<MissingMention, string> = {
  organizationName: "/parametres#profil-entreprise",
  address: "/parametres#profil-entreprise",
  siren: "/parametres#profil-entreprise",
  registration: "/parametres#coordonnees-documents",
  shareCapital: "/parametres#coordonnees-documents",
  vatNumber: "/parametres#coordonnees-documents",
  insurance: "/parametres#informations-professionnel",
  mediator: "/parametres#informations-professionnel",
  generalTerms: "/parametres#informations-professionnel",
  paymentTerms: "/devis/parametres#invoiceMentions",
  advanceKind: "#acompte-arrhes",
  // Lot 31c (D18, D22).
  professionalPaymentTerms: "/devis/parametres#invoiceMentionsProfessional",
  latePenaltyRate: "/devis/parametres#latePenaltyRate",
  earnestSingleInstalment: "#echeancier",
};

export function MissingMentionsList({ fields }: { fields: MissingMention[] }) {
  const t = useTranslations("Quotes");
  return (
    <ul className="missing-mentions">
      {fields.map((field) => (
        <li key={field}>
          <Link href={WHERE[field]}>{t(`mention.${field}`)}</Link>
        </li>
      ))}
    </ul>
  );
}
