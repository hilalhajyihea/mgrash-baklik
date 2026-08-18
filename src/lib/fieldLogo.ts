import sharp from "sharp";

const MAX_BYTES = 2 * 1024 * 1024;

const EXT_MIME: Record<string, string> = {
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  webp: "image/webp",
  svg: "image/svg+xml",
};

const ALLOWED_MIME = new Set(Object.values(EXT_MIME));

function extFromName(name: string): string | null {
  const m = /\.([a-z0-9]+)$/i.exec(name.trim());
  return m ? m[1]!.toLowerCase() : null;
}

function sniffMime(buf: Buffer): string | null {
  if (
    buf.length >= 8 &&
    buf[0] === 0x89 &&
    buf[1] === 0x50 &&
    buf[2] === 0x4e &&
    buf[3] === 0x47
  ) {
    return "image/png";
  }
  if (buf.length >= 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) {
    return "image/jpeg";
  }
  if (
    buf.length >= 12 &&
    buf.toString("ascii", 0, 4) === "RIFF" &&
    buf.toString("ascii", 8, 12) === "WEBP"
  ) {
    return "image/webp";
  }
  const head = buf.subarray(0, Math.min(buf.length, 256)).toString("utf8").trimStart();
  if (head.startsWith("<svg") || head.startsWith("<?xml")) {
    return "image/svg+xml";
  }
  return null;
}

function resolveMime(file: File, raw: Buffer): string | null {
  const sniffed = sniffMime(raw);
  if (sniffed && ALLOWED_MIME.has(sniffed)) return sniffed;

  const fromExt = extFromName(file.name || "");
  if (fromExt && EXT_MIME[fromExt]) return EXT_MIME[fromExt]!;

  const declared = (file.type || "").trim();
  if (declared && ALLOWED_MIME.has(declared)) return declared;

  return null;
}

export function logoApiUrl(slug: string) {
  return `/api/fields/${encodeURIComponent(slug)}/logo?v=${Date.now()}`;
}

export function publicLogoUrl(slug: string, logoMimeType?: string | null) {
  if (!logoMimeType) return null;
  return `/api/fields/${encodeURIComponent(slug)}/logo`;
}

/**
 * Normalize uploads and store as PNG so logos display reliably in <img>.
 */
export async function readLogoUpload(file: File): Promise<{
  data: Buffer;
  mimeType: string;
}> {
  if (file.size <= 0 || file.size > MAX_BYTES) {
    throw new Error("يجب ألا يتجاوز حجم الملف 2MB");
  }

  const raw = Buffer.from(await file.arrayBuffer());
  const mime = resolveMime(file, raw);
  if (!mime) {
    throw new Error("صيغة غير مدعومة (PNG / JPG / WEBP / SVG)");
  }

  try {
    const png = await sharp(raw, { density: 300 })
      .resize({
        width: 1600,
        height: 480,
        fit: "contain",
        background: { r: 0, g: 0, b: 0, alpha: 0 },
      })
      .png()
      .toBuffer();

    return { data: png, mimeType: "image/png" };
  } catch {
    throw new Error("تعذّر معالجة ملف الشعار. جرّبوا PNG شفافًا.");
  }
}
