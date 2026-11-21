// Lot 31a (FAC-07, JUR-01, JUR-09, JUR-08 ; décision D4) — mentions requises manquantes,
// chacune nommée, avec le lien vers l'endroit où la remplir.
import Link from "next/link";
import { useTranslations } from "next-intl";
import type { MissingMention } from "@/modules/quotes/service";
import { anchorHref } from "./[quoteId]/rubrics";

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
  // Lot 62d : les ancres du devis mènent à leur rubrique (`?rubrique=`).
  advanceKind: anchorHref("#acompte-arrhes"),
  // Lot 31c (D18, D22).
  professionalPaymentTerms: "/devis/parametres#invoiceMentionsProfessional",
  latePenaltyRate: "/devis/parametres#latePenaltyRate",
  earnestSingleInstalment: anchorHref("#echeancier"),
  // Lot 41 (FAC-10, JUR-02, JUR-12 ; D6, D7, D11).
  postalCode: "/parametres#profil-entreprise",
  city: "/parametres#profil-entreprise",
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
