import supabase from "../config/supabase.js";

/**
 * Storage service for generated interview-report PDFs.
 *
 * Reuses the SAME Supabase service-role client the résumé feature uses. PDFs go
 * into a dedicated PRIVATE bucket (`reports`) — never public. Files are served
 * back only through an authenticated, ownership-checked Express endpoint that
 * streams the bytes, so report files are never exposed via a public URL.
 */

const BUCKET = "reports";

let bucketReady = false;

/** Ensure the private `reports` bucket exists (idempotent). */
async function ensureBucket() {
  if (bucketReady) return;
  const { data, error } = await supabase.storage.getBucket(BUCKET);
  if (data && !error) {
    bucketReady = true;
    return;
  }
  const { error: createErr } = await supabase.storage.createBucket(BUCKET, {
    public: false,
  });
  // Ignore "already exists" races; surface anything else.
  if (createErr && !/exist/i.test(createErr.message || "")) {
    throw new Error(`Failed to ensure reports bucket: ${createErr.message}`);
  }
  bucketReady = true;
}

/**
 * Upload a report PDF buffer and return its permanent storage path.
 * The path is stable per interview session, so the same PDF is reused
 * everywhere (dashboard view, download, email attachment).
 *
 * @param {string} userId
 * @param {string} interviewId
 * @param {Buffer} pdfBuffer
 * @returns {Promise<string>} storagePath
 */
export async function uploadReportPdf(userId, interviewId, pdfBuffer) {
  await ensureBucket();
  const storagePath = `${userId}/${interviewId}.pdf`;

  const { error } = await supabase.storage.from(BUCKET).upload(storagePath, pdfBuffer, {
    contentType: "application/pdf",
    upsert: true, // regenerating the same session overwrites in place (still one PDF per session)
  });

  if (error) throw new Error(`Supabase report upload failed: ${error.message}`);
  return storagePath;
}

/**
 * Download a stored report PDF as a Buffer (for authenticated streaming).
 * @param {string} storagePath
 * @returns {Promise<Buffer>}
 */
export async function downloadReportPdf(storagePath) {
  const { data, error } = await supabase.storage.from(BUCKET).download(storagePath);
  if (error) throw new Error(`Supabase report download failed: ${error.message}`);
  const arrayBuffer = await data.arrayBuffer();
  return Buffer.from(arrayBuffer);
}
