// Lot 71f (EVT-02 ; maquette 09), repris au lot 72e : ce que la Synthèse d'un mariage repris montre en plus.
import type { ChecklistBlock } from "@/lib/takeover/checklist-rules";
import type { UnallocatedTotals } from "@/modules/budget/service";

export type CockpitTakeover = {
  block: ChecklistBlock;
  hrefs: { budget: string; tasksTakeover: string; tasksTemplate: string; program: string; clients: string; guests: string };
  reviewHref: string;
  review: boolean;
  unallocated: UnallocatedTotals | null;
  retained: number;
  signed: number;
};
