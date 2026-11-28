// Lot 63f (HUB-11 ; ADR 0104), revu au lot 74d (C-02 ; page 25 des maquettes du lot 68) — où poser la
// bulle d'une visite, et quelles bulles montrer. Fonctions pures, sans DOM, testées à part.

export type Rect = { top: number; left: number; width: number; height: number };
export type Placement = { top: number; left: number; side: "below" | "right" | "left" | "above" | "center" };

const MARGIN = 8;

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(min, value), Math.max(min, max));
}

// À l'ordinateur, la bulle se place sous la zone ; si la place manque, à droite, puis à gauche, puis
// au-dessus ; elle ne recouvre jamais la zone qu'elle encadre tant qu'une place existe ; en dernier
// recours, au centre. Jamais hors de l'écran.
export function placeTourBubble(target: Rect | null, bubble: { width: number; height: number }, viewport: { width: number; height: number }, gap = 12): Placement {
  const center = { top: Math.max(MARGIN, (viewport.height - bubble.height) / 2), left: Math.max(MARGIN, (viewport.width - bubble.width) / 2), side: "center" as const };
  if (!target) return center;
  const maxLeft = viewport.width - bubble.width - MARGIN;
  const maxTop = viewport.height - bubble.height - MARGIN;
  const below = target.top + target.height + gap;
  if (below + bubble.height <= viewport.height - MARGIN) return { top: below, left: clamp(target.left + target.width / 2 - bubble.width / 2, MARGIN, maxLeft), side: "below" };
  const sideTop = clamp(target.top, MARGIN, maxTop);
  const right = target.left + target.width + gap;
  if (right + bubble.width <= viewport.width - MARGIN) return { top: sideTop, left: right, side: "right" };
  const left = target.left - gap - bubble.width;
  if (left >= MARGIN) return { top: sideTop, left, side: "left" };
  const above = target.top - gap - bubble.height;
  if (above >= MARGIN) return { top: above, left: clamp(target.left + target.width / 2 - bubble.width / 2, MARGIN, maxLeft), side: "above" };
  return center;
}

// Une bulle n'est montrée que si sa zone est à l'écran (présente et visible) ; sinon elle est sautée,
// et « N sur M » compte les bulles montrées.
export function visibleTourSteps<T extends { target?: string | undefined }>(steps: T[], isVisible: (target: string) => boolean): T[] {
  return steps.filter((step) => step.target !== undefined && isVisible(step.target));
}
