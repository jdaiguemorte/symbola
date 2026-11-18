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

// Lot 47 (PRE-03, PAR-05 ; D9 ; migration 0160, accord de Julien du 18/11/2026).
describe("PAR-05 (lot 47) — Natures des modèles d'e-mails des prestataires", () => {
  it("le brief, sa relance et la feuille de route sont des natures admises", async () => {
    expect(await refusal("vendor_brief")).toBe("accepté");
    expect(await refusal("vendor_brief_reminder")).toBe("accepté");
    expect(await refusal("vendor_roadmap")).toBe("accepté");
  });

  it("une nature voisine inconnue reste refusée", async () => {
    expect(await refusal("vendor_briefs")).toBe("email_templates_kind_check");
  });
});
