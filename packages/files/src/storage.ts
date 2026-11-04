// Client de stockage objet compatible S3 (Garage, ADR 0015 — remplace
// MinIO ; SOC-08). Bucket privé : jamais d'ACL publique, téléchargement
// uniquement par lien signé à durée limitée.
import { DeleteObjectCommand, GetObjectCommand, HeadBucketCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { parseEnv } from "@symbola/env";

export function createStorageClient() {
  const env = parseEnv(process.env);

  const client = new S3Client({
    endpoint: `${env.S3_USE_SSL ? "https" : "http"}://${env.S3_ENDPOINT}:${env.S3_PORT}`,
    region: env.S3_REGION,
    credentials: {
      accessKeyId: env.S3_ACCESS_KEY,
      secretAccessKey: env.S3_SECRET_KEY,
    },
    forcePathStyle: true, // requis par Garage/MinIO (pas de sous-domaines par bucket)
  });

  return { client, bucket: env.S3_BUCKET };
}

export async function uploadPrivateObject(
  storage: ReturnType<typeof createStorageClient>,
  input: { key: string; body: Buffer; contentType: string },
): Promise<void> {
  await storage.client.send(
    new PutObjectCommand({
      Bucket: storage.bucket,
      Key: input.key,
      Body: input.body,
      ContentType: input.contentType,
    }),
  );
}

export async function getSignedDownloadUrl(
  storage: ReturnType<typeof createStorageClient>,
  key: string,
  expiresInSeconds: number,
): Promise<string> {
  const command = new GetObjectCommand({ Bucket: storage.bucket, Key: key });
  return getSignedUrl(storage.client, command, { expiresIn: expiresInSeconds });
}

export class PrivateObjectNotFoundError extends Error {
  constructor() {
    super("objet absent du stockage");
    this.name = "PrivateObjectNotFoundError";
  }
}

export type PrivateObject = { data: Buffer; contentType: string | null };

// Lecture côté serveur d'un objet privé, sans jamais l'exposer par une URL :
// logo intégré au PDF du programme (EVT-05), et téléchargements servis par
// l'app après contrôle des droits (ADR 0027) — Garage n'est joignable que
// depuis le réseau Docker de l'environnement.
export async function readPrivateObject(storage: ReturnType<typeof createStorageClient>, key: string): Promise<PrivateObject> {
  try {
    const response = await storage.client.send(new GetObjectCommand({ Bucket: storage.bucket, Key: key }));
    if (!response.Body) throw new PrivateObjectNotFoundError();
    return { data: Buffer.from(await response.Body.transformToByteArray()), contentType: response.ContentType ?? null };
  } catch (error) {
    if (error instanceof Error && (error.name === "NoSuchKey" || error.name === "NotFound")) throw new PrivateObjectNotFoundError();
    throw error;
  }
}

export async function getPrivateObject(storage: ReturnType<typeof createStorageClient>, key: string): Promise<Buffer> {
  return (await readPrivateObject(storage, key)).data;
}

// Suppression d'un objet privé (AIDE-02 : devis joint à un événement
// d'essai, supprimé avec l'essai). Supprimer un objet absent ne lève pas
// d'erreur (comportement S3).
export async function deletePrivateObject(storage: ReturnType<typeof createStorageClient>, key: string): Promise<void> {
  await storage.client.send(new DeleteObjectCommand({ Bucket: storage.bucket, Key: key }));
}

// Vérification de disponibilité du stockage (SOC-11, page /health) : le
// bucket existe et les clés de l'app y ont accès.
export async function checkBucket(storage: ReturnType<typeof createStorageClient>): Promise<void> {
  await storage.client.send(new HeadBucketCommand({ Bucket: storage.bucket }));
}
