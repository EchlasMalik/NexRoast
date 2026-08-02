import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";

let client: S3Client | undefined;

function getClient(): S3Client {
  if (client) return client;

  const accountId = process.env.R2_ACCOUNT_ID;
  const accessKeyId = process.env.R2_ACCESS_KEY;
  const secretAccessKey = process.env.R2_SECRET_KEY;

  if (!accountId || !accessKeyId || !secretAccessKey) {
    throw new Error(
      "R2 is not configured: set R2_ACCOUNT_ID, R2_ACCESS_KEY, and R2_SECRET_KEY.",
    );
  }

  client = new S3Client({
    region: "auto",
    endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
    credentials: { accessKeyId, secretAccessKey },
  });
  return client;
}

/**
 * Uploads `body` to the configured R2 bucket under `key` and returns its
 * public URL. Requires R2_PUBLIC_URL (the bucket's public r2.dev subdomain or
 * a custom domain) since R2, unlike S3, has no predictable public URL format
 * derivable from the account ID and bucket name alone.
 */
export async function uploadScreenshot(
  key: string,
  body: Buffer,
): Promise<string> {
  const bucket = process.env.R2_BUCKET;
  const publicUrl = process.env.R2_PUBLIC_URL;

  if (!bucket) throw new Error("R2 is not configured: set R2_BUCKET.");
  if (!publicUrl) throw new Error("R2 is not configured: set R2_PUBLIC_URL.");

  await getClient().send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      Body: body,
      ContentType: "image/png",
    }),
  );

  const base = publicUrl.endsWith("/") ? publicUrl : `${publicUrl}/`;
  return new URL(key, base).toString();
}
