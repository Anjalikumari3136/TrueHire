import multer from "multer";
import prisma from "../config/prisma.js";
import supabase from "../config/supabase.js";

// ── Multer (memory storage — file stays in RAM, no disk writes) ────────────
const ALLOWED_TYPES = [
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
];
const MAX_SIZE = 5 * 1024 * 1024; // 5 MB

export const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_SIZE },
  fileFilter: (_req, file, cb) => {
    if (ALLOWED_TYPES.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error("Only PDF and DOCX files are allowed."), false);
    }
  },
});

const BUCKET = "resumes";
const SIGNED_URL_EXPIRY = 60 * 60; // 1 hour in seconds

// ── Helper: upload buffer to Supabase Storage (private bucket) ─────────────
async function uploadToSupabase(userId, file) {
  const timestamp = Date.now();
  const safeName = file.originalname.replace(/\s+/g, "_");
  const storagePath = `${userId}_${timestamp}_${safeName}`;

  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(storagePath, file.buffer, {
      contentType: file.mimetype,
      upsert: false,
    });

  if (error) throw new Error(`Supabase upload failed: ${error.message}`);

  return { storagePath };
}

async function getSignedUrl(storagePath) {
  const { data, error } = await supabase.storage
    .from(BUCKET)
    .createSignedUrl(storagePath, SIGNED_URL_EXPIRY);

  if (error) throw new Error(`Failed to generate signed URL: ${error.message}`);
  return data.signedUrl;
}
async function deleteFromSupabase(storagePath) {
  try {
    await supabase.storage.from(BUCKET).remove([storagePath]);
  } catch {
    console.warn("Could not delete old resume from Supabase Storage.");
  }
}

export async function uploadResume(req, res) {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: "No file uploaded." });
    }

    const userId = req.user.id;

    // If a resume already exists, delete the old file from storage first
    const existing = await prisma.resume.findUnique({ where: { userId } });
    if (existing?.resumeUrl) {
      await deleteFromSupabase(existing.resumeUrl);
    }

    const { storagePath } = await uploadToSupabase(userId, req.file);
    const resume = await prisma.resume.upsert({
      where: { userId },
      update: {
        resumeName: req.file.originalname,
        resumeUrl: storagePath,
        fileSize: req.file.size,
        uploadedAt: new Date(),
      },
      create: {
        userId,
        resumeName: req.file.originalname,
        resumeUrl: storagePath,
        fileSize: req.file.size,
      },
    });

    // Generate a fresh signed URL to return to the client
    const signedUrl = await getSignedUrl(storagePath);

    return res.status(200).json({ success: true, resume: { ...resume, signedUrl } });
  } catch (err) {
    console.error("uploadResume error:", err);
    return res.status(500).json({ success: false, message: err.message || "Upload failed." });
  }
}

// ── GET /api/resume/me ─────────────────────────────────────────────────────
export async function getMyResume(req, res) {
  try {
    const userId = req.user.id;

    const resume = await prisma.resume.findUnique({ where: { userId } });

    if (!resume) {
      return res.status(200).json({ success: true, hasResume: false, resume: null });
    }

    // Generate a fresh signed URL from the stored path
    const signedUrl = await getSignedUrl(resume.resumeUrl);

    return res.status(200).json({ success: true, hasResume: true, resume: { ...resume, signedUrl } });
  } catch (err) {
    console.error("getMyResume error:", err);
    return res.status(500).json({ success: false, message: "Failed to fetch resume." });
  }
}

// ── PUT /api/resume/update ─────────────────────────────────────────────────
export async function updateResume(req, res) {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: "No file uploaded." });
    }

    const userId = req.user.id;

    // Fetch existing resume to get old storage path
    const existing = await prisma.resume.findUnique({ where: { userId } });

    // Delete old file from Supabase using the stored path (if exists)
    if (existing?.resumeUrl) {
      await deleteFromSupabase(existing.resumeUrl);
    }

    // Upload new file
    const { storagePath } = await uploadToSupabase(userId, req.file);

    // Upsert: create if not exists, update if exists
    const resume = await prisma.resume.upsert({
      where: { userId },
      update: {
        resumeName: req.file.originalname,
        resumeUrl: storagePath,   // stores the private path
        fileSize: req.file.size,
        uploadedAt: new Date(),
      },
      create: {
        userId,
        resumeName: req.file.originalname,
        resumeUrl: storagePath,   // stores the private path
        fileSize: req.file.size,
      },
    });

    // Generate a fresh signed URL to return to the client
    const signedUrl = await getSignedUrl(storagePath);

    return res.status(200).json({ success: true, resume: { ...resume, signedUrl } });
  } catch (err) {
    console.error("updateResume error:", err);
    return res.status(500).json({ success: false, message: err.message || "Update failed." });
  }
}
