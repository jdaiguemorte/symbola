// Lot 63a (UX-14, FAC-01 ; recette du 21/11/2026) — l'astérisque d'un champ obligatoire, dans son
// libellé, et la légende « * obligatoire » du formulaire. Le champ porte aussi l'attribut
// `required` : c'est lui que lit le lecteur d'écran, l'astérisque est pour l'œil (aria-hidden).
// Règle de DESIGN.md ; contrôlée par app/ui/required-mark.test.ts.
export function RequiredMark() {
  return (
    <span className="required-mark" aria-hidden="true">
      {" *"}
    </span>
  );
}

export function RequiredLegend({ text }: { text: string }) {
  return (
    <p className="field-hint required-legend">
      <span aria-hidden="true">* </span>
      {text}
    </p>
  );
}
