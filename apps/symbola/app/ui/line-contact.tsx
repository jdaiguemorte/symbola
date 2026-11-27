// Lot 72b (UX-13, HUB-08 ; J7 ; maquette 14 du lot 68, repère 3) — qui appeler, sous le titre d'une ligne qui
// attend les mariés ou un prestataire : « Karim Haddad · 06 00 00 41 27 ». Sur téléphone, le numéro est un
// lien « tel: » de 44 px (un toucher appelle) ; à l'ordinateur, du texte. Sans téléphone, l'e-mail en
// « mailto: ». Les coordonnées viennent des fiches (lot 72a) ; sans rien, la ligne n'en dit rien.
import type { ContactParts } from "@/lib/today/home";

export function LineContact({ contact }: { contact: ContactParts | null | undefined }) {
  if (!contact) return null;
  return (
    <span className="line-contact">
      <span>{contact.name}</span>
      {contact.phone ? (
        <>
          <span aria-hidden="true"> · </span>
          <span className="line-contact-phone-text">{contact.phone.text}</span>
          <a href={contact.phone.href} className="line-contact-phone-link">
            {contact.phone.text}
          </a>
        </>
      ) : contact.email ? (
        <>
          <span aria-hidden="true"> · </span>
          <a href={contact.email.href} className="line-contact-email">
            {contact.email.text}
          </a>
        </>
      ) : null}
    </span>
  );
}
