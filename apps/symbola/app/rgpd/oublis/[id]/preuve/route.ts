// RGPD-03 — preuve horodatée d'une demande d'oubli (PDF), rendue à la
// demande depuis la trace du hub. Titulaire seulement, son organisation.
import { createElement, type ReactElement } from "react";
import { renderToBuffer, type DocumentProps } from "@react-pdf/renderer";
import { z } from "zod";
import { appDatabase } from "@symbola/db/client";
import { getPrivacyErasure, PrivacyErasureNotFoundError, type PrivacyErasureView } from "@/modules/hub/service";
import { ownerContext } from "../../../owner-access";
import { buildErasureProof } from "../../proof";
import { ProofPdfDocument } from "../../proof-pdf";
import { pdfSafe } from "@/lib/pdf-text";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }): Promise<Response> {
  const owner = await ownerContext();
  if (!owner) return new Response(null, { status: 403 });
  const parsed = z.uuid().safeParse((await params).id);
  if (!parsed.success) return new Response(null, { status: 404 });
  const db = appDatabase();
  let erasure: PrivacyErasureView;
  try {
    erasure = await getPrivacyErasure(db, owner.organizationId, parsed.data);
  } catch (error) {
    if (error instanceof PrivacyErasureNotFoundError) return new Response(null, { status: 404 });
    throw error;
  }
  const model = await buildErasureProof(owner.organizationId, erasure);
  const pdf = await renderToBuffer(createElement(ProofPdfDocument, { model: pdfSafe(model) }) as unknown as ReactElement<DocumentProps>);
  return new Response(new Uint8Array(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="preuve-oubli-${erasure.id}.pdf"`,
      "Cache-Control": "no-store",
    },
  });
}
