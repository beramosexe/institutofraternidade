import {
  DeleteObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { r2Client, R2_BUCKET_NAME } from "./client.server";

export async function uploadObject(
  key: string,
  body: Uint8Array | Buffer,
  contentType?: string,
) {
  await r2Client.send(
    new PutObjectCommand({
      Bucket: R2_BUCKET_NAME,
      Key: key,
      Body: body,
      ContentType: contentType,
    }),
  );

  return key;
}

export async function getSignedUploadUrl(
  key: string,
  expiresIn = 900,
  contentType?: string,
) {
  return getSignedUrl(
    r2Client,
    new PutObjectCommand({
      Bucket: R2_BUCKET_NAME,
      Key: key,
      ContentType: contentType,
    }),
    { expiresIn },
  );
}

export async function getSignedDownloadUrl(
  key: string,
  expiresIn = 3600,
) {
  return getSignedUrl(
    r2Client,
    new GetObjectCommand({
      Bucket: R2_BUCKET_NAME,
      Key: key,
    }),
    { expiresIn },
  );
}

export async function deleteObject(key: string) {
  await r2Client.send(
    new DeleteObjectCommand({
      Bucket: R2_BUCKET_NAME,
      Key: key,
    }),
  );
}

export async function objectExists(key: string) {
  try {
    await r2Client.send(
      new HeadObjectCommand({
        Bucket: R2_BUCKET_NAME,
        Key: key,
      }),
    );

    return true;
  } catch {
    return false;
  }
}
