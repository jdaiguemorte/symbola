// Lot 60 (L60-PLA-01) — nom et dimensions d'un espace, en mètres (rectangle par défaut).
export function SpaceSizeFields({ nameLabel, widthLabel, depthLabel, namePlaceholder, defaults }: { nameLabel: string; widthLabel: string; depthLabel: string; namePlaceholder?: string; defaults?: { name: string; widthCm: number; depthCm: number } }) {
  return (
    <div className="plan-space-fields">
      <label>
        {nameLabel}
        <input name="name" required maxLength={80} defaultValue={defaults?.name ?? ""} {...(namePlaceholder ? { placeholder: namePlaceholder } : {})} />
      </label>
      <label>
        {widthLabel}
        <input name="width" type="number" required min={1} max={1000} step={0.1} inputMode="decimal" defaultValue={defaults ? defaults.widthCm / 100 : ""} />
      </label>
      <label>
        {depthLabel}
        <input name="depth" type="number" required min={1} max={1000} step={0.1} inputMode="decimal" defaultValue={defaults ? defaults.depthCm / 100 : ""} />
      </label>
    </div>
  );
}
