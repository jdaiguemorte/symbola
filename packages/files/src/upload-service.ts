// Orchestration de l'envoi d'un fichier (SOC-08) : taille maximale
// (paramétrable par l'appelant, jamais codée en dur — CLAUDE.md §2.5),
// type vérifié par le contenu, analyse antivirus, puis stockage privé.
// Refus clair à chaque étape, sans upload partiel en cas de rejet.
import { randomUUID } from "node:crypto";
import { parseEnv } from "@symbola/env";
import { scanBuffer } from "./clamav-client";
import { detectFileType } from "./magic-bytes";
import { createStorageClient, uploadPrivateObject } from "./storage";

export type UploadFileInput = {
  organizationId: string;
  buffer: Buffer;
  maxSizeBytes: number;
};

export type UploadFileResult =
  | { status: "rejected"; reason: "too_large" | "unsupported_type" | "infected"; signature?: string }
  | { status: "uploaded"; key: string; mime: string; size: number };

export async function uploadFile(input: UploadFileInput): Promise<UploadFileResult> {
  if (input.buffer.length > input.maxSizeBytes) {
    return { status: "rejected", reason: "too_large" };
  }

  const detected = detectFileType(input.buffer);
  if (!detected) {
    return { status: "rejected", reason: "unsupported_type" };
  }

  const env = parseEnv(process.env);
  const scan = await scanBuffer(input.buffer, { host: env.CLAMAV_HOST, port: env.CLAMAV_PORT });
  if (scan.infected) {
    return { status: "rejected", reason: "infected", signature: scan.signature };
  }

  const key = `${input.organizationId}/${randomUUID()}.${detected.extension}`;
  const storage = createStorageClient();
  await uploadPrivateObject(storage, { key, body: input.buffer, contentType: detected.mime });

  return { status: "uploaded", key, mime: detected.mime, size: input.buffer.length };
}
