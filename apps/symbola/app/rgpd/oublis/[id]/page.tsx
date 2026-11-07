import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { z } from "zod";
import { createAppConnection } from "@symbola/db/client";
import { ScreenHelp } from "@/app/screen-help";
import { getPrivacyErasure, PrivacyErasureNotFoundError, type PrivacyErasureView } from "@/modules/hub/service";
import { getPlannerAuthContext } from "@/lib/auth-context";
import { retryErasureAction } from "../../erasure-actions";
import { buildErasureProof } from "../proof";

// RGPD-03 — une demande d'oubli traitée : accusé de chaque module (la
// demande n'est close que quand tous ont répondu), relance des modules en
// échec, preuve horodatée (PDF) et modèle de réponse à la personne.
export default async function ErasurePage({ params }: { params: Promise<{ id: string }> }) {
  const auth = await getPlannerAuthContext();
  if (auth.status === "unauthenticated") redirect("/login");
  if (auth.status === "mfa_required") redirect("/mfa");
  if (auth.status === "forbidden") redirect(auth.role === "client" ? "/espace" : "/");
  if (!auth.user.organizationId) redirect("/");
  const t = await getTranslations("Privacy");
  const tHelp = await getTranslations("Help");
  if (auth.user.role !== "owner") {
    return (
      <main>
        <h1>{t("erasuresTitle")}</h1>
        <p>{t("ownerOnly")}</p>
      </main>
    );
  }
  const id = z.uuid().safeParse((await params).id);
  if (!id.success) notFound();
  const { sql, db } = createAppConnection();
  let erasure: PrivacyErasureView;
  try {
    erasure = await getPrivacyErasure(db, auth.user.organizationId, id.data);
  } catch (error) {
    if (error instanceof PrivacyErasureNotFoundError) notFound();
    throw error;
  } finally {
    await sql.end();
  }
  const proof = await buildErasureProof(auth.user.organizationId, erasure);

  return (
    <main>
      <p>
        <Link href="/rgpd">{t("backToSearch")}</Link>
      </p>
      <h1>{t("erasurePageTitle", { person: erasure.request.personLabel })}</h1>
      <ScreenHelp title={tHelp("privacyErasure.title")} body={tHelp("privacyErasure.body")} />
      <p role="status">{t(`erasureStatus.${erasure.status}`)}</p>
      {proof.lines.map((line) => (
        <p key={line}>{line}</p>
      ))}

      <section aria-labelledby="erasure-acks">
        <h2 id="erasure-acks">{proof.acksTitle}</h2>
        <ul>
          {proof.acks.map((ack) => (
            <li key={ack}>{ack}</li>
          ))}
        </ul>
        {erasure.status !== "completed" ? (
          <form action={retryErasureAction}>
            <input type="hidden" name="erasureId" value={erasure.id} />
            <button type="submit">{t("erasureRetry")}</button>
          </form>
        ) : null}
      </section>

      <section aria-labelledby="erasure-items">
        <h2 id="erasure-items">{proof.itemsTitle}</h2>
        <ul>
          {proof.rows.map((row, index) => (
            <li key={index}>
              {row.module} · {row.kind} : {row.fate} ({row.count})
            </li>
          ))}
        </ul>
        <h3>{proof.keptTitle}</h3>
        <ul>
          {proof.kept.map((line) => (
            <li key={line}>{line}</li>
          ))}
        </ul>
      </section>

      <p>
        <a href={`/rgpd/oublis/${erasure.id}/preuve`}>{t("proofDownload")}</a>
      </p>

      {erasure.status === "completed" ? (
        <section aria-labelledby="erasure-response">
          <h2 id="erasure-response">{proof.responseTitle}</h2>
          <p>{t("responseIntro")}</p>
          <label>
            {t("responseSubject")}
            <input type="text" readOnly value={proof.response.subject} />
          </label>
          <label>
            {t("responseBody")}
            <textarea readOnly rows={14} value={proof.response.body} />
          </label>
        </section>
      ) : null}
    </main>
  );
}
