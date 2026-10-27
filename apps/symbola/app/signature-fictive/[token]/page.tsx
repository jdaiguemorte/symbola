import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { findFakeSignature } from "@/modules/quotes/service";
import { fakeSignatureAction } from "./actions";

// DEV-02, ADR 0021 — page publique du faux fournisseur de signature : elle
// remplace la page DocuSeal en développement et pour l'essai guidé (« le
// marié fictif signe sans e-mail à un tiers »). En production, seuls les
// devis d'essai y sont reconnus.
export default async function FakeSignaturePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  if (!/^[0-9a-f-]{36}$/.test(token)) notFound();
  const signature = await findFakeSignature(token);
  if (!signature) notFound();
  const t = await getTranslations("FakeSignature");

  return (
    <main>
      <h1>{t("title", { number: signature.quoteNumber })}</h1>
      <p role="note">{t("fictionalNotice")}</p>
      <p>{t("signerLabel", { name: signature.signerName })}</p>
      {signature.status === "pending" ? (
        <form action={fakeSignatureAction}>
          <input type="hidden" name="token" value={token} />
          <button type="submit" name="decision" value="sign">
            {t("sign")}
          </button>
          <button type="submit" name="decision" value="decline">
            {t("decline")}
          </button>
        </form>
      ) : (
        <p role="status">{signature.status === "signed" ? t("signed") : t("declined")}</p>
      )}
    </main>
  );
}
