import PDFDocument from "pdfkit";

/**
 * Professional PDF generator for the TrueHire AI Interview Report.
 *
 * Pure programmatic layout with pdfkit (no headless browser / system binaries).
 * `generateReportPdf` returns a Promise<Buffer> so the caller can upload it to
 * storage and attach it to an email — the SAME buffer is reused everywhere, so
 * the PDF is generated exactly once per interview session.
 *
 * The function is defensive: every field is read through safe getters so a
 * partially-filled AI report never throws while rendering.
 */

// ── Corporate palette ───────────────────────────────────────────────────────
const COLORS = {
  brand: "#4f46e5",
  brandLight: "#eef2ff",
  ink: "#1f2937",
  sub: "#6b7280",
  line: "#e5e7eb",
  good: "#16a34a",
  warn: "#d97706",
  bad: "#dc2626",
  white: "#ffffff",
  zebra: "#f9fafb",
};

const PAGE = { size: "A4", margin: 50 };
const FOOTER_RESERVE = 46; // vertical space kept free at the bottom for the footer

// ── Small safe helpers ──────────────────────────────────────────────────────
const s = (v, fallback = "—") => {
  if (v === null || v === undefined) return fallback;
  const str = String(v).trim();
  return str.length ? str : fallback;
};
const arr = (v) => (Array.isArray(v) ? v.filter((x) => x !== null && x !== undefined && String(x).trim()) : []);
const num = (v) => (typeof v === "number" && !Number.isNaN(v) ? v : Number(v) || 0);

function scoreColor(score) {
  const n = num(score);
  if (n >= 75) return COLORS.good;
  if (n >= 50) return COLORS.warn;
  return COLORS.bad;
}

/**
 * @param {object} report   - FinalCandidateReport JSON (from FastAPI/LangGraph)
 * @param {object} candidate - { name, email, resumeName, interviewId, interviewDate, reportVersion }
 * @returns {Promise<Buffer>}
 */
export function generateReportPdf(report = {}, candidate = {}) {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({ size: PAGE.size, margin: PAGE.margin, bufferPages: true });
      const chunks = [];
      doc.on("data", (c) => chunks.push(c));
      doc.on("end", () => resolve(Buffer.concat(chunks)));
      doc.on("error", reject);

      const left = doc.page.margins.left;
      const right = doc.page.width - doc.page.margins.right;
      const contentW = right - left;
      const pageBottom = () => doc.page.height - doc.page.margins.bottom - FOOTER_RESERVE;

      // Ensure there's room for a block of height `h`; otherwise start a new page.
      const ensure = (h) => {
        if (doc.y + h > pageBottom()) doc.addPage();
      };

      // ── Report title band (first page) ──────────────────────────────────
      doc.rect(0, 0, doc.page.width, 96).fill(COLORS.brand);
      doc
        .fillColor(COLORS.white)
        .font("Helvetica-Bold")
        .fontSize(22)
        .text("TRUEHIRE AI INTERVIEW REPORT", left, 34, { width: contentW });
      doc
        .font("Helvetica")
        .fontSize(10)
        .fillColor("#dbeafe")
        .text("Confidential candidate assessment", left, 64, { width: contentW });
      doc.y = 120;
      doc.fillColor(COLORS.ink);

      // ── Section heading (filled bar) ────────────────────────────────────
      const heading = (title) => {
        ensure(40);
        const y = doc.y;
        doc.rect(left, y, contentW, 26).fill(COLORS.brandLight);
        doc.rect(left, y, 4, 26).fill(COLORS.brand);
        doc
          .fillColor(COLORS.brand)
          .font("Helvetica-Bold")
          .fontSize(12)
          .text(title.toUpperCase(), left + 14, y + 7, { width: contentW - 20 });
        doc.fillColor(COLORS.ink);
        doc.y = y + 26 + 10;
      };

      // ── Key/value grid (two columns) ────────────────────────────────────
      const kvGrid = (pairs) => {
        const colW = contentW / 2;
        const rowH = 20;
        for (let i = 0; i < pairs.length; i += 2) {
          ensure(rowH);
          const y = doc.y;
          const cells = [pairs[i], pairs[i + 1]].filter(Boolean);
          cells.forEach((pair, ci) => {
            const x = left + ci * colW;
            doc.font("Helvetica-Bold").fontSize(9).fillColor(COLORS.sub).text(pair[0].toUpperCase(), x, y, { width: 120 });
            doc.font("Helvetica").fontSize(10).fillColor(COLORS.ink).text(s(pair[1]), x + 122, y, { width: colW - 132 });
          });
          doc.y = y + rowH;
        }
        doc.moveDown(0.4);
      };

      // ── Two-column label/value table (per-round competencies) ───────────
      const table = (rows) => {
        const labelW = 150;
        const valX = left + labelW;
        const valW = contentW - labelW;
        rows.forEach(([label, value], idx) => {
          const text = s(value);
          const vh = doc.font("Helvetica").fontSize(10).heightOfString(text, { width: valW - 16 });
          const rowH = Math.max(22, vh + 10);
          ensure(rowH);
          const y = doc.y;
          if (idx % 2 === 0) doc.rect(left, y, contentW, rowH).fill(COLORS.zebra);
          doc.rect(left, y, contentW, rowH).lineWidth(0.5).stroke(COLORS.line);
          doc.font("Helvetica-Bold").fontSize(9.5).fillColor(COLORS.ink).text(label, left + 8, y + 6, { width: labelW - 12 });
          doc.font("Helvetica").fontSize(10).fillColor(COLORS.ink).text(text, valX + 8, y + 6, { width: valW - 16 });
          doc.y = y + rowH;
        });
        doc.moveDown(0.6);
      };

      // ── Bullet list ─────────────────────────────────────────────────────
      const bullets = (items, empty = "No items recorded.") => {
        const list = arr(items);
        if (!list.length) {
          ensure(18);
          doc.font("Helvetica-Oblique").fontSize(10).fillColor(COLORS.sub).text(empty, left + 4, doc.y, { width: contentW - 8 });
          doc.moveDown(0.6);
          doc.fillColor(COLORS.ink);
          return;
        }
        list.forEach((item) => {
          const text = s(item);
          const th = doc.font("Helvetica").fontSize(10).heightOfString(text, { width: contentW - 24 });
          ensure(th + 6);
          const y = doc.y;
          doc.circle(left + 6, y + 6, 2).fill(COLORS.brand);
          doc.font("Helvetica").fontSize(10).fillColor(COLORS.ink).text(text, left + 16, y, { width: contentW - 24 });
          doc.y = Math.max(doc.y, y + th) + 4;
        });
        doc.moveDown(0.4);
      };

      // ── Paragraph ───────────────────────────────────────────────────────
      const paragraph = (text) => {
        const t = s(text, "");
        if (!t) return;
        const th = doc.font("Helvetica").fontSize(10.5).heightOfString(t, { width: contentW });
        ensure(th);
        doc.font("Helvetica").fontSize(10.5).fillColor(COLORS.ink).text(t, left, doc.y, { width: contentW, align: "justify" });
        doc.moveDown(0.6);
      };

      // =====================================================================
      // CANDIDATE INFORMATION
      // =====================================================================
      heading("Candidate Information");
      kvGrid([
        ["Name", candidate.name],
        ["Email", candidate.email],
        ["Resume", candidate.resumeName],
        ["Interview ID", candidate.interviewId],
        ["Interview Date", candidate.interviewDate],
        ["Report Version", candidate.reportVersion ? `v${candidate.reportVersion}` : "v1"],
      ]);

      // =====================================================================
      // OVERALL PERFORMANCE
      // =====================================================================
      heading("Overall Performance");
      {
        ensure(64);
        const y = doc.y;
        const boxH = 56;
        doc.rect(left, y, contentW, boxH).lineWidth(1).stroke(COLORS.line);
        const col = contentW / 3;
        const cells = [
          ["OVERALL SCORE", `${num(report.overall_score).toFixed(0)}/100`, scoreColor(report.overall_score)],
          ["OVERALL RATING", s(report.performance_rating), COLORS.brand],
          ["HIRING RECOMMENDATION", s(report.hiring_recommendation || report.final_recommendation), COLORS.ink],
        ];
        cells.forEach(([label, value, color], i) => {
          const x = left + i * col;
          if (i > 0) doc.moveTo(x, y + 10).lineTo(x, y + boxH - 10).lineWidth(0.5).stroke(COLORS.line);
          doc.font("Helvetica-Bold").fontSize(8).fillColor(COLORS.sub).text(label, x + 12, y + 12, { width: col - 20 });
          doc.font("Helvetica-Bold").fontSize(14).fillColor(color).text(value, x + 12, y + 28, { width: col - 20 });
        });
        doc.fillColor(COLORS.ink);
        doc.y = y + boxH + 12;
      }
      paragraph(report.overall_summary);

      // =====================================================================
      // RESUME ANALYSIS
      // =====================================================================
      const ra = report.resume_analysis || {};
      heading("Resume Analysis");
      table([
        ["Resume Score", `${num(ra.resume_score).toFixed(0)}/100`],
        ["Skills Detected", arr(ra.skills_detected).join(", ")],
        ["Technologies", arr(ra.technologies).join(", ")],
      ]);
      doc.font("Helvetica-Bold").fontSize(10).fillColor(COLORS.ink).text("Projects", left, doc.y); doc.moveDown(0.2);
      bullets(ra.projects, "No projects listed.");
      doc.font("Helvetica-Bold").fontSize(10).fillColor(COLORS.ink).text("Strengths", left, doc.y); doc.moveDown(0.2);
      bullets(ra.strengths);
      doc.font("Helvetica-Bold").fontSize(10).fillColor(COLORS.ink).text("Weaknesses", left, doc.y); doc.moveDown(0.2);
      bullets(ra.weaknesses);

      // =====================================================================
      // OA ROUND
      // =====================================================================
      const oa = report.oa_round || {};
      heading("OA Round");
      table([
        ["Score", `${num(oa.score).toFixed(0)}/100`],
        ["Questions Attempted", s(oa.questions_attempted, "0")],
        ["Correct Answers", s(oa.correct_answers, "0")],
        ["Time Management", oa.time_management],
        ["Problem Solving", oa.problem_solving],
        ["AI Feedback", oa.ai_feedback],
      ]);

      // =====================================================================
      // TECHNICAL ROUND
      // =====================================================================
      const tr = report.technical_round || {};
      heading("Technical Round");
      table([
        ["Coding Skills", tr.coding_skills],
        ["DSA", tr.dsa],
        ["Frontend", tr.frontend],
        ["Backend", tr.backend],
        ["Database", tr.database],
        ["API Design", tr.api_design],
        ["Debugging", tr.debugging],
        ["AI Feedback", tr.ai_feedback],
      ]);

      // =====================================================================
      // HR ROUND
      // =====================================================================
      const hr = report.hr_round || {};
      heading("HR Round");
      table([
        ["Communication", hr.communication],
        ["Confidence", hr.confidence],
        ["Leadership", hr.leadership],
        ["Teamwork", hr.teamwork],
        ["Behaviour", hr.behaviour],
        ["AI Feedback", hr.ai_feedback],
      ]);

      // =====================================================================
      // OVERALL STRENGTHS / IMPROVEMENTS / RECOMMENDATIONS / SUMMARY
      // =====================================================================
      heading("Overall Strengths");
      bullets(report.strengths);

      heading("Areas of Improvement");
      bullets(report.areas_to_improve && report.areas_to_improve.length ? report.areas_to_improve : report.weaknesses);

      heading("Learning Recommendations");
      bullets(report.learning_recommendations);

      heading("AI Career Suggestions");
      bullets(report.career_suggestions);

      heading("Final Summary");
      paragraph(report.final_summary || report.overall_summary);

      // =====================================================================
      // FOOTER on every page (bufferPages)
      // =====================================================================
      const range = doc.bufferedPageRange(); // { start, count }
      const genTs = s(candidate.generatedAt, new Date().toISOString());
      for (let i = range.start; i < range.start + range.count; i++) {
        doc.switchToPage(i);
        const fy = doc.page.height - doc.page.margins.bottom - 24;
        doc.lineWidth(0.5).moveTo(left, fy).lineTo(right, fy).stroke(COLORS.line);
        doc
          .font("Helvetica")
          .fontSize(8)
          .fillColor(COLORS.sub)
          .text(
            `Generated by TrueHire AI  ·  Interview ID: ${s(candidate.interviewId)}  ·  ${genTs}  ·  Report ${candidate.reportVersion ? "v" + candidate.reportVersion : "v1"}`,
            left,
            fy + 6,
            { width: contentW - 60, lineBreak: false }
          );
        doc.text(`Page ${i - range.start + 1} of ${range.count}`, right - 60, fy + 6, { width: 60, align: "right" });
      }

      doc.end();
    } catch (err) {
      reject(err);
    }
  });
}
