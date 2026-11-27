// Lot 70b (UX-10 ; P-18, C-04 ; page 4 des maquettes du lot 68) — l'erreur d'un champ, juste dessous :
// « ! » et le message, qui reprend le mot du libellé et dit quoi faire. L'erreur ne tient pas à la
// couleur seule : l'icône, le texte, et un bord de 2 px sur le champ (aria-invalid, globals.css).
export function FieldError({ id, message }: { id: string; message: string | undefined }) {
  if (!message) return null;
  return (
    <p id={id} className="field-error">
      <span className="field-error-icon" aria-hidden="true">
        !
      </span>
      {message}
    </p>
  );
}
