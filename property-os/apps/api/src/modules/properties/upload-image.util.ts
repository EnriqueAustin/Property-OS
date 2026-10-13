import { BadRequestException } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { writeFileSync } from 'fs';
import { join } from 'path';

/**
 * Image upload hardening (audit S8).
 *
 * The client's declared MIME type and original filename are NOT trusted.
 * Instead the real image type is detected from the file's magic bytes, the
 * stored extension is derived from the detected type, and the filename is a
 * random UUID. Anything that is not a genuine jpeg/png/webp/gif is rejected,
 * so `evil.html` sent as `image/png` can never be written to `/uploads`.
 */

export interface DetectedImage {
  mime: string;
  ext: string;
}

/**
 * Detect a supported image type from the leading bytes of a buffer.
 * Returns `null` when the content does not match a supported image signature.
 */
export function detectImageType(buf: Buffer): DetectedImage | null {
  if (!buf || buf.length < 12) return null;

  // JPEG: FF D8 FF
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) {
    return { mime: 'image/jpeg', ext: 'jpg' };
  }

  // PNG: 89 50 4E 47 0D 0A 1A 0A
  if (
    buf[0] === 0x89 &&
    buf[1] === 0x50 &&
    buf[2] === 0x4e &&
    buf[3] === 0x47 &&
    buf[4] === 0x0d &&
    buf[5] === 0x0a &&
    buf[6] === 0x1a &&
    buf[7] === 0x0a
  ) {
    return { mime: 'image/png', ext: 'png' };
  }

  // GIF: "GIF87a" or "GIF89a"
  if (
    buf[0] === 0x47 &&
    buf[1] === 0x49 &&
    buf[2] === 0x46 &&
    buf[3] === 0x38 &&
    (buf[4] === 0x37 || buf[4] === 0x39) &&
    buf[5] === 0x61
  ) {
    return { mime: 'image/gif', ext: 'gif' };
  }

  // WEBP: "RIFF" .... "WEBP"
  if (
    buf[0] === 0x52 &&
    buf[1] === 0x49 &&
    buf[2] === 0x46 &&
    buf[3] === 0x46 &&
    buf[8] === 0x57 &&
    buf[9] === 0x45 &&
    buf[10] === 0x42 &&
    buf[11] === 0x50
  ) {
    return { mime: 'image/webp', ext: 'webp' };
  }

  return null;
}

/**
 * Validate in-memory uploaded files by magic bytes, write each one to disk
 * under a random UUID filename with an extension derived from the detected
 * type, and return the generated filenames. Rejects (and writes nothing) if
 * any file is not a supported image.
 */
export function persistUploadedImages(
  files: Express.Multer.File[],
  uploadsDir: string,
): string[] {
  const detected = files.map((file) => {
    const type = detectImageType(file.buffer);
    if (!type) {
      throw new BadRequestException(
        'Only valid jpg, png, webp, and gif images are allowed',
      );
    }
    return { file, type };
  });

  const filenames: string[] = [];
  for (const { file, type } of detected) {
    const filename = `${randomUUID()}.${type.ext}`;
    writeFileSync(join(uploadsDir, filename), file.buffer);
    filenames.push(filename);
  }
  return filenames;
}
