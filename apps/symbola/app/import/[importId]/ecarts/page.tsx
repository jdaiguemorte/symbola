import { redirect } from "next/navigation";

// IMP-04 — lot 16 (IMP-11, ADR 0041) : les colonnes sans équivalent se décident
// à l'étape « Colonnes », les lignes rejetées s'affichent à « Vérifier et
// confirmer » (avec leur CSV, toujours servi par ecarts/csv). Une ancienne
// adresse reprend l'assistant là où il en est.
export default async function ImportGapsPage({ params }: { params: Promise<{ importId: string }> }) {
  const { importId } = await params;
  redirect(`/import/${encodeURIComponent(importId)}`);
}
