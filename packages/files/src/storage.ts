// Client de stockage objet compatible S3 (Garage, ADR 0015 — remplace
// MinIO ; SOC-08). Bucket privé : jamais d'ACL publique, téléchargement
// uniquement par lien signé à durée limitée.
import { GetObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
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
