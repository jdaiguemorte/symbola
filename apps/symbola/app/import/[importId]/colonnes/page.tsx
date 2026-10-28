import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { createAppConnection } from "@symbola/db/client";
import { HelpButton } from "@symbola/ui";
import { getImportColumns } from "@/modules/hub/service";
import { getPlannerAuthContext } from "@/lib/auth-context";
import { isValidId } from "../../access";
import { ImportSteps } from "../../import-steps";
import { ColumnsForm } from "./columns-form";

// IMP-02 — étape « colonnes » : correspondance proposée pour chaque colonne,
// à valider, corriger ou ignorer.
export default async function ImportColumnsPage({ params }: { params: Promise<{ importId: string }> }) {
  const auth = await getPlannerAuthContext();
  if (auth.status === "unauthenticated") redirect("/login");
  if (auth.status === "mfa_required") redirect("/mfa");
  if (auth.status === "forbidden") redirect(auth.role === "client" ? "/espace" : "/");
  if (!auth.user.organizationId) redirect("/");

  const { importId } = await params;
  if (!isValidId(importId)) notFound();
  const { sql, db } = createAppConnection();
  let view;
  try {
    view = await getImportColumns(db, auth.user.organizationId, importId);
  } finally {
    await sql.end();
  }
  if (!view) notFound();

  const t = await getTranslations("Import");
  const tHelp = await getTranslations("Help");

  return (
    <main>
      <h1>{t("columnsTitle", { fileName: view.fileName })}</h1>
      <HelpButton title={tHelp("importColumns.title")} body={tHelp("importColumns.body")} />
      <ImportSteps current={1} />
      <p>{t("columnsIntro", { threshold: view.lowConfidenceThreshold })}</p>
      <ColumnsForm view={view} />
      <p>
        <Link href={`/import/${view.importId}`}>{t("backToDraft")}</Link>
      </p>
    </main>
  );
}
