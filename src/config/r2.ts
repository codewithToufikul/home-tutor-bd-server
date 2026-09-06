import { S3Client, PutObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { randomUUID } from 'crypto';
import path from 'path';

// Cloudflare R2 — S3-compatible storage
const R2_ACCOUNT_ID = process.env.R2_ACCOUNT_ID || '';
const R2_ACCESS_KEY_ID = process.env.R2_ACCESS_KEY_ID || '';
const R2_SECRET_ACCESS_KEY = process.env.R2_SECRET_ACCESS_KEY || '';
const R2_BUCKET_NAME = process.env.R2_BUCKET_NAME || 'hometutorproviderbd';
const R2_PUBLIC_URL = (process.env.R2_PUBLIC_URL || 'https://pub-8938eeb47e524fce9966ed8c6bfba531.r2.dev').replace(/\/$/, '');

export const r2Client = new S3Client({
  region: 'auto',
  endpoint: `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: R2_ACCESS_KEY_ID,
    secretAccessKey: R2_SECRET_ACCESS_KEY,
  },
});

/**
 * Upload a file buffer to Cloudflare R2
 * @param fileBuffer  - Node.js Buffer of the file
 * @param folder      - Folder path inside the bucket (e.g. 'home-tutor-bd/documents')
 * @param originalName - Original file name (used to preserve extension)
 * @param contentType - MIME type (e.g. 'image/jpeg', 'application/pdf')
 * @returns { url: string; key: string }
 */
export const uploadToR2 = async (
  fileBuffer: Buffer,
  folder: string = 'home-tutor-bd/documents',
  originalName: string = 'file',
  contentType: string = 'application/octet-stream',
): Promise<{ url: string; key: string }> => {
  const ext = path.extname(originalName) || '';
  const uniqueKey = `${folder}/${Date.now()}-${randomUUID()}${ext}`;

  await r2Client.send(
    new PutObjectCommand({
      Bucket: R2_BUCKET_NAME,
      Key: uniqueKey,
      Body: fileBuffer,
      ContentType: contentType,
    }),
  );

  const url = `${R2_PUBLIC_URL}/${uniqueKey}`;
  return { url, key: uniqueKey };
};

/**
 * Delete an object from Cloudflare R2 by its key
 * @param key - R2 object key (e.g. 'home-tutor-bd/documents/file.jpg')
 */
export const deleteFromR2 = async (key: string): Promise<void> => {
  try {
    await r2Client.send(
      new DeleteObjectCommand({
        Bucket: R2_BUCKET_NAME,
        Key: key,
      }),
    );
  } catch (err) {
    console.warn(`Failed to delete R2 object (${key}):`, err);
  }
};

export default r2Client;
