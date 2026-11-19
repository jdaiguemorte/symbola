// Lot 55 (MSG-04 révisée, D1 ; ADR 0101) — « Adresse d'envoi » : l'adresse d'où partent les e-mails de
// l'organisation, sur le domaine d'envoi de Symbola (proposée depuis son nom, modifiable par la
// Propriétaire), et l'adresse où arrivent les réponses (son adresse de contact).
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { ScreenHelp } from "@/app/screen-help";
import { requirePlanner } from "@/lib/guards";
import { getSenderAddress } from "@/modules/hub/service";
import { SenderAddressForm } from "./sender-address-form";

export default async function SenderAddressPage() {
  const auth = await requirePlanner();
  const t = await getTranslations("SenderAddress");
  const tHelp = await getTranslations("Help");
  const sender = await getSenderAddress(auth.user.organizationId);
  return (
    <main>
      <h1>{t("title")}</h1>
      <ScreenHelp title={tHelp("senderAddress.title")} body={tHelp("senderAddress.body")} />
      <p>{t("intro")}</p>
      <section className="card stack" aria-labelledby="sender-current-title">
        <h2 id="sender-current-title">{t("currentTitle")}</h2>
        <p>
          <strong>{sender.address}</strong>
        </p>
        {sender.mode === "shared" ? <p className="notice">{t("sharedMode")}</p> : null}
        <p>{sender.replyTo ? t("replyTo", { email: sender.replyTo }) : t("noReplyTo")}</p>
        <p>
          <Link href="/parametres">{t("contactLink")}</Link>
        </p>
      </section>
      {auth.user.role === "owner" ? (
        <section className="card" aria-labelledby="sender-edit-title">
          <h2 id="sender-edit-title">{t("editTitle")}</h2>
          <SenderAddressForm localPart={sender.localPart} domain={sender.domain} />
        </section>
      ) : (
        <p>{t("ownerOnly")}</p>
      )}
      <p>
        <Link href="/parametres/envois">{t("journalLink")}</Link>
      </p>
    </main>
  );
}
