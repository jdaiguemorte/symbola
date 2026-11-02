// RGPD-03 — contenu de la preuve horodatée d'une demande d'oubli et du
// modèle de réponse à la personne, à partir de la trace du hub (aucun libellé
// de fiche : natures, sorts, motifs et dates seulement). Pur : les libellés
// traduits et le modèle de réponse sont fournis par l'appelant.
import type { PrivacyErasureView } from "@/modules/hub/service";

export type ProofLabels = {
  title: string;
  person: string;
  request: string;
  validatedAt: string;
  completion: string;
  acksTitle: string;
  itemsTitle: string;
  keptTitle: string;
  keptNone: string;
  responseTitle: string;
  columns: { module: string; kind: string; fate: string; count: string };
  module: (module: string) => string;
  kind: (kind: string) => string;
  fate: (fate: string) => string;
  ack: (ack: PrivacyErasureView["acks"][number]) => string;
  keptLine: (kind: string, until: string, basis: string) => string;
  basis: (basis: string) => string;
  date: (date: string) => string;
  page: (current: number, total: number) => string;
};

export type ProofModel = {
  language: string;
  organizationName: string;
  title: string;
  lines: string[];
  acksTitle: string;
  acks: string[];
  itemsTitle: string;
  columns: ProofLabels["columns"];
  rows: { module: string; kind: string; fate: string; count: string }[];
  keptTitle: string;
  kept: string[];
  responseTitle: string;
  response: { subject: string; body: string };
  page: ProofLabels["page"];
};

// Remplit les variables {nom} du modèle ; une variable inconnue reste telle quelle.
export function fillTemplate(template: string, values: Record<string, string>): string {
  return template.replace(/\{(\w+)\}/g, (match, name: string) => values[name] ?? match);
}

// Données conservées : une ligne par nature, motif et date de fin.
export function keptSummary(erasure: PrivacyErasureView, labels: Pick<ProofLabels, "keptLine" | "kind" | "basis" | "date" | "keptNone">): string[] {
  const lines = new Map<string, string>();
  for (const item of erasure.items) {
    if (item.fate !== "kept" || !item.keptUntil || !item.legalBasis) continue;
    const line = labels.keptLine(labels.kind(item.kind), labels.date(item.keptUntil), labels.basis(item.legalBasis));
    lines.set(line, line);
  }
  return lines.size > 0 ? [...lines.values()] : [labels.keptNone];
}

export function buildErasureProofModel(input: {
  erasure: PrivacyErasureView;
  organizationName: string;
  language: string;
  labels: ProofLabels;
  response: { subject: string; body: string };
}): ProofModel {
  const { erasure, labels } = input;
  const counts = new Map<string, { module: string; kind: string; fate: string; count: number }>();
  for (const item of erasure.items) {
    const key = `${item.module}:${item.kind}:${item.fate}`;
    const current = counts.get(key) ?? { module: item.module, kind: item.kind, fate: item.fate, count: 0 };
    current.count += 1;
    counts.set(key, current);
  }
  const kept = keptSummary(erasure, labels);
  return {
    language: input.language,
    organizationName: input.organizationName,
    title: labels.title,
    lines: [labels.person, labels.request, labels.validatedAt, labels.completion],
    acksTitle: labels.acksTitle,
    acks: [...new Set(erasure.items.map((item) => item.module))].map((module) => {
      const ack = erasure.acks.find((candidate) => candidate.module === module);
      return labels.ack(ack ?? { module, status: "failed", at: "", count: 0 });
    }),
    itemsTitle: labels.itemsTitle,
    columns: labels.columns,
    rows: [...counts.values()].map((row) => ({ module: labels.module(row.module), kind: labels.kind(row.kind), fate: labels.fate(row.fate), count: String(row.count) })),
    keptTitle: labels.keptTitle,
    kept,
    responseTitle: labels.responseTitle,
    response: input.response,
    page: labels.page,
  };
}
