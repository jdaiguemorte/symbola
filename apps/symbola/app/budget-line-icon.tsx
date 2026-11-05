// Lot 12 (EVT-14 / EVT-17) — icône d'une ligne du budget (lieu, traiteur,
// photographe…), dans le style de la charte (lucide). Présentation seulement :
// la clé vient des données de l'organisation (modèles de départ ou choix de
// la planner). Sans icône, les initiales de la ligne.
import {
  Armchair,
  BedDouble,
  Bus,
  Cake,
  Camera,
  CircleDot,
  Flower2,
  Gem,
  Landmark,
  Mail,
  Mic,
  Music,
  Scissors,
  Shirt,
  Sparkles,
  Speaker,
  Users,
  UtensilsCrossed,
  Video,
  type LucideIcon,
} from "lucide-react";
import { BUDGET_LINE_ICONS, type BudgetLineIcon as IconKey } from "@symbola/starter-templates";

const ICONS: Record<IconKey, LucideIcon> = {
  venue: Landmark,
  catering: UtensilsCrossed,
  camera: Camera,
  video: Video,
  music: Music,
  flower: Flower2,
  decoration: Sparkles,
  officiant: Mic,
  cake: Cake,
  beauty: Scissors,
  stationery: Mail,
  transport: Bus,
  lodging: BedDouble,
  sound: Speaker,
  staff: Users,
  furniture: Armchair,
  attire: Shirt,
  rings: Gem,
  other: CircleDot,
};

export const ICON_KEYS = BUDGET_LINE_ICONS;

function initials(label: string): string {
  return label
    .split(/[\s/-]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word[0]!.toLocaleUpperCase("fr"))
    .join("");
}

// label : nom de la ligne, donné aux lecteurs d'écran et en infobulle.
export function BudgetLineIcon({ icon, label, decorative = false }: { icon: string | null; label: string; decorative?: boolean }) {
  const Icon = icon && icon in ICONS ? ICONS[icon as IconKey] : null;
  const a11y = decorative ? { "aria-hidden": true as const } : { role: "img" as const, "aria-label": label, title: label };
  return (
    <span className="line-icon" {...a11y}>
      {Icon ? <Icon size={16} strokeWidth={1.75} aria-hidden="true" /> : <span aria-hidden="true">{initials(label)}</span>}
    </span>
  );
}
