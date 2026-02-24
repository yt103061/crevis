import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3'

export function createR2Client() {
  return new S3Client({
    region: 'auto',
    endpoint: `https://${process.env.CLOUDFLARE_R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: process.env.CLOUDFLARE_R2_ACCESS_KEY_ID!,
      secretAccessKey: process.env.CLOUDFLARE_R2_SECRET_ACCESS_KEY!,
    },
  })
}

export async function uploadToR2(
  key: string,
  body: Buffer,
  contentType: string
): Promise<string> {
  const client = createR2Client()
  const bucketName = process.env.CLOUDFLARE_R2_BUCKET_NAME!

  await client.send(
    new PutObjectCommand({
      Bucket: bucketName,
      Key: key,
      Body: body,
      ContentType: contentType,
    })
  )

  const publicUrl = process.env.CLOUDFLARE_R2_PUBLIC_URL
  if (publicUrl) {
    return `${publicUrl}/${key}`
  }

  return `https://pub-${process.env.CLOUDFLARE_R2_ACCOUNT_ID}.r2.dev/${key}`
}
