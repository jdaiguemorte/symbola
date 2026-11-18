// Lot 49 (INV-03, INV-04 ; D4, D10 ; migration 0152, accord de Julien du 18/11/2026) — la contrainte
// des natures de modèles d'e-mails, élargie aux deux natures des invités : la base les accepte, et
// refuse toujours une nature inconnue, même sous la RLS du rôle applicatif. PostgreSQL réel.
import { randomUUID } from "node:crypto";
import { afterAll, describe, expect, it } from "vitest";
import { createAppConnection } from "./client";
import { emailTemplates } from "./schema/hub";
import { withOrganization } from "./with-organization";

const { sql, db } = createAppConnection();

afterAll(async () => {
  await sql.end();
});

async function refusal(kind: string): Promise<string> {
  const organizationId = randomUUID();
  try {
    await withOrganization(db, organizationId, (tx) => tx.insert(emailTemplates).values({ organizationId, kind: kind as "guest_invitation", locale: "fr", subject: "Objet", body: "Texte {{lien}}" }));
    return "accepté";
  } catch (error) {
    const cause = (error as { cause?: { constraint_name?: string } }).cause;
    return cause?.constraint_name ?? String(error);
  }
}

describe("MSG-01 (lot 49) — Natures des modèles d'e-mails", () => {
  it("l'invitation et la relance des invités sont des natures admises", async () => {
    expect(await refusal("guest_invitation")).toBe("accepté");
    expect(await refusal("guest_reminder")).toBe("accepté");
  });

  it("une nature inconnue reste refusée par la base", async () => {
    expect(await refusal("nature_inconnue")).toBe("email_templates_kind_check");
    expect(await refusal("guest_invitations")).toBe("email_templates_kind_check");
  });
});

describe("MSG-01 (lot 44, D7) — Nature « Nouvelle demande de contact »", () => {
  it("prospect_form_received est admise ; une nature voisine reste refusée", async () => {
    expect(await refusal("prospect_form_received")).toBe("accepté");
    expect(await refusal("prospect_form")).toBe("email_templates_kind_check");
  });
});

describe("MSG-01 (lot 43, D10) — Natures de la proposition et du règlement", () => {
  it("proposition envoyée, relance avant expiration, RIB du règlement et relance d'impayé sont admises ; une nature voisine reste refusée", async () => {
    for (const kind of ["proposal_sent", "proposal_expiry_reminder", "payment_details", "invoice_reminder"]) expect(await refusal(kind)).toBe("accepté");
    expect(await refusal("invoice_reminders")).toBe("email_templates_kind_check");
    expect(await refusal("payment_link")).toBe("email_templates_kind_check");
  });
});
