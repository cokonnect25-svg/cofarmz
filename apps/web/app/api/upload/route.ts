export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { randomUUID } from 'crypto';

const MAX_IMAGE_SIZE = 10 * 1024 * 1024;  // 10MB
const MAX_VIDEO_SIZE = 100 * 1024 * 1024; // Keep in sync with the reel picker

const VIDEO_MIME_TYPES: Record<string, string> = {
  mp4: 'video/mp4',
  mov: 'video/quicktime',
  m4v: 'video/x-m4v',
  webm: 'video/webm',
  avi: 'video/x-msvideo',
  mkv: 'video/x-matroska',
  '3gp': 'video/3gpp',
  '3g2': 'video/3gpp2',
  mpeg: 'video/mpeg',
  mpg: 'video/mpeg',
};

function getFileExtension(fileName: string) {
  const extension = fileName.split('.').pop()?.toLowerCase().replace(/[^a-z0-9]/g, '');
  return extension || '';
}

const r2 = new S3Client({
  region: 'auto',
  endpoint: `https://${process.env.CLOUDFLARE_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: process.env.CLOUDFLARE_R2_ACCESS_KEY_ID!,
    secretAccessKey: process.env.CLOUDFLARE_R2_SECRET_ACCESS_KEY!,
  },
});

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get('file') as File | null;

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    const ext = getFileExtension(file.name);
    const suppliedMimeType = file.type?.toLowerCase() || '';
    const isVideo = suppliedMimeType.startsWith('video/') || ext in VIDEO_MIME_TYPES;
    const mimeType = isVideo
      ? (suppliedMimeType.startsWith('video/') ? suppliedMimeType : VIDEO_MIME_TYPES[ext])
      : (suppliedMimeType || 'image/jpeg');
    const maxSize = isVideo ? MAX_VIDEO_SIZE : MAX_IMAGE_SIZE;

    if (file.size > maxSize) {
      const maxSizeMB = maxSize / (1024 * 1024);
      return NextResponse.json(
        { error: `File too large (max ${maxSizeMB}MB)` },
        { status: 413 }
      );
    }

    const safeExt = ext || (isVideo ? 'mp4' : 'jpg');
    const folder = isVideo ? 'videos' : 'images';
    const key = `${folder}/${randomUUID()}.${safeExt}`;

    const buffer = Buffer.from(await file.arrayBuffer());

    await r2.send(
      new PutObjectCommand({
        Bucket: process.env.CLOUDFLARE_R2_BUCKET_NAME!,
        Key: key,
        Body: buffer,
        ContentType: mimeType,
        ContentLength: buffer.length,
      })
    );

    const r2PublicUrl = process.env.CLOUDFLARE_R2_PUBLIC_URL || process.env.NEXT_PUBLIC_R2_PUBLIC_URL;
    const publicUrl = `${r2PublicUrl}/${key}`;

    console.log('[Upload API] Uploaded to R2:', { key, size: file.size, mimeType, isVideo });

    return NextResponse.json({
      url: publicUrl,
      success: true,
      filename: file.name,
      key,
      isVideo,
    });
  } catch (error) {
    console.error('[Upload API] Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Upload failed' },
      { status: 500 }
    );
  }
}

