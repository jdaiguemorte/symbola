// Lot 31a (FAC-07, JUR-01, JUR-09, JUR-08 ; décision D4) — mentions requises manquantes,
// chacune nommée, avec le lien vers l'endroit où la remplir.
import Link from "next/link";
import { useTranslations } from "next-intl";
import type { MissingMention } from "@/modules/quotes/service";
import { anchorHref } from "./[quoteId]/rubrics";

const WHERE: Record<MissingMention, string> = {
  organizationName: "/parametres/entreprise#profil-entreprise",
  address: "/parametres/entreprise#profil-entreprise",
  siren: "/parametres/entreprise#profil-entreprise",
  registration: "/parametres/entreprise#coordonnees-documents",
  shareCapital: "/parametres/entreprise#coordonnees-documents",
  vatNumber: "/parametres/entreprise#coordonnees-documents",
  insurance: "/parametres/mentions#informations-professionnel",
  mediator: "/parametres/mentions#informations-professionnel",
  generalTerms: "/parametres/mentions#informations-professionnel",
  paymentTerms: "/devis/parametres#invoiceMentions",
  // Lot 62d : les ancres du devis mènent à leur rubrique (`?rubrique=`).
  advanceKind: anchorHref("#acompte-arrhes"),
  // Lot 31c (D18, D22).
  professionalPaymentTerms: "/devis/parametres#invoiceMentionsProfessional",
  latePenaltyRate: "/devis/parametres#latePenaltyRate",
  earnestSingleInstalment: anchorHref("#echeancier"),
  // Lot 41 (FAC-10, JUR-02, JUR-12 ; D6, D7, D11).
  postalCode: "/parametres/entreprise#profil-entreprise",
  city: "/parametres/entreprise#profil-entreprise",
  buyerCompany: anchorHref("#acheteur"),
  buyerSiren: anchorHref("#acheteur"),
  buyerAddress: anchorHref("#acheteur"),
  professionalDiscountTerms: "/devis/parametres#professionalDiscountTerms",
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
