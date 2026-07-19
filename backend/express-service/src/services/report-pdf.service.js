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

const PAGE = { size: "A4", margin: 40 };
const FOOTER_RESERVE = 34; // vertical space kept free at the bottom for the footer

// ── Small safe helpers ──────────────────────────────────────────────────────
const s = (v, fallback = "—") => {
  if (v === null || v === undefined) return fallback;
  const str = String(v).trim();
  return str.length ? str : fallback;
};
const arr = (v) => (Array.isArray(v) ? v.filter((x) => x !== null && x !== undefined && String(x).trim()) : []);
// Values that carry no information — printing them just inflates the report.
const PLACEHOLDER =
  /^(—|-|n\/?a|none|null|undefined|not\s+(assessed|attempted|available|applicable|demonstrated|provided|evaluated)\b.*)$/i;

/** True when a value is worth printing (keeps absent data out of the PDF). */
const hasVal = (v) => {
  if (v === null || v === undefined) return false;
  const t = String(v).trim();
  return t !== "" && !PLACEHOLDER.test(t);
};
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
      doc.rect(0, 0, doc.page.width, 62).fill(COLORS.brand);
      doc
        .fillColor(COLORS.white)
        .font("Helvetica-Bold")
        .fontSize(17)
        .text("TRUEHIRE AI INTERVIEW REPORT", left, 18, { width: contentW });
      doc
        .font("Helvetica")
        .fontSize(8.5)
        .fillColor("#dbeafe")
        .text("Confidential candidate assessment", left, 40, { width: contentW });
      doc.y = 76;
      doc.fillColor(COLORS.ink);

      // ── Section heading (filled bar) ────────────────────────────────────
      const heading = (title) => {
        ensure(34);
        const y = doc.y;
        doc.rect(left, y, contentW, 19).fill(COLORS.brandLight);
        doc.rect(left, y, 3, 19).fill(COLORS.brand);
        doc
          .fillColor(COLORS.brand)
          .font("Helvetica-Bold")
          .fontSize(9.5)
          .text(title.toUpperCase(), left + 11, y + 5.5, { width: contentW - 20 });
        doc.fillColor(COLORS.ink);
        doc.y = y + 19 + 4;
      };

      // ── Key/value grid (two columns) ────────────────────────────────────
      const kvGrid = (pairs) => {
        const colW = contentW / 2;
        const rowH = 14;
        for (let i = 0; i < pairs.length; i += 2) {
          ensure(rowH);
          const y = doc.y;
          const cells = [pairs[i], pairs[i + 1]].filter(Boolean);
          cells.forEach((pair, ci) => {
            const x = left + ci * colW;
            doc.font("Helvetica-Bold").fontSize(7.5).fillColor(COLORS.sub).text(pair[0].toUpperCase(), x, y + 2, { width: 76, lineBreak: false });
            doc.font("Helvetica").fontSize(8).fillColor(COLORS.ink).text(s(pair[1]), x + 78, y + 1.5, { width: colW - 86, lineBreak: false, ellipsis: true });
          });
          doc.y = y + rowH;
        }
        doc.moveDown(0.3);
      };

      // ── Two-column label/value table (per-round competencies) ───────────
      // Rows without a real value are dropped so absent data never takes up
      // space. Returns false when there was nothing to draw.
      const table = (allRows) => {
        const rows = allRows.filter(([, v]) => hasVal(v));
        if (!rows.length) return false;
        const labelW = 122;
        const valX = left + labelW;
        const valW = contentW - labelW;
        rows.forEach(([label, value], idx) => {
          const text = s(value);
          const vh = doc.font("Helvetica").fontSize(8.5).heightOfString(text, { width: valW - 14 });
          const rowH = Math.max(15, vh + 5);
          ensure(rowH);
          const y = doc.y;
          if (idx % 2 === 0) doc.rect(left, y, contentW, rowH).fill(COLORS.zebra);
          doc.rect(left, y, contentW, rowH).lineWidth(0.5).stroke(COLORS.line);
          doc.font("Helvetica-Bold").fontSize(8).fillColor(COLORS.ink).text(label, left + 7, y + 3.5, { width: labelW - 11 });
          doc.font("Helvetica").fontSize(8.5).fillColor(COLORS.ink).text(text, valX + 7, y + 3.5, { width: valW - 14 });
          doc.y = y + rowH;
        });
        doc.moveDown(0.3);
        return true;
      };

      // ── Bullet list — renders nothing (and reports false) when empty ─────
      const bullets = (items) => {
        const list = arr(items);
        if (!list.length) return false;
        list.forEach((item) => {
          const text = s(item);
          const th = doc.font("Helvetica").fontSize(8.5).heightOfString(text, { width: contentW - 20 });
          ensure(th + 6);
          const y = doc.y;
          doc.circle(left + 5, y + 4.5, 1.6).fill(COLORS.brand);
          doc.font("Helvetica").fontSize(8.5).fillColor(COLORS.ink).text(text, left + 13, y, { width: contentW - 20 });
          doc.y = Math.max(doc.y, y + th) + 1.5;
        });
        doc.moveDown(0.2);
        return true;
      };

      /** Sub-heading + bullet list; skipped entirely when the list is empty. */
      const bulletBlock = (title, items) => {
        if (!arr(items).length) return false;
        ensure(16);
        doc.font("Helvetica-Bold").fontSize(8.5).fillColor(COLORS.ink).text(title, left, doc.y);
        doc.moveDown(0.15);
        bullets(items);
        return true;
      };

      // ── Paragraph ───────────────────────────────────────────────────────
      const paragraph = (text) => {
        const t = s(text, "");
        if (!t) return false;
        const th = doc.font("Helvetica").fontSize(9).heightOfString(t, { width: contentW });
        ensure(th);
        doc.font("Helvetica").fontSize(9).fillColor(COLORS.ink).text(t, left, doc.y, { width: contentW, align: "justify" });
        doc.moveDown(0.3);
        return true;
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
        ensure(50);
        const y = doc.y;
        const boxH = 42;
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
          doc.font("Helvetica-Bold").fontSize(7).fillColor(COLORS.sub).text(label, x + 10, y + 8, { width: col - 16, lineBreak: false });
          doc.font("Helvetica-Bold").fontSize(11.5).fillColor(color).text(value, x + 10, y + 21, { width: col - 16 });
        });
        doc.fillColor(COLORS.ink);
        doc.y = y + boxH + 8;
      }
      paragraph(report.overall_summary);

      // Renders `title` + body only when the body actually has content, so a
      // section with no data never occupies space (or a whole page).
      const section = (title, body) => {
        const y0 = doc.y;
        const page0 = doc.bufferedPageRange().count;
        heading(title);
        if (!body()) {
          // Nothing was drawn → roll the heading back.
          if (doc.bufferedPageRange().count === page0) doc.y = y0;
          return false;
        }
        return true;
      };

      // =====================================================================
      // RESUME ANALYSIS
      // =====================================================================
      const ra = report.resume_analysis || {};
      section("Resume Analysis", () => {
        let drew = table([
          ["Resume Score", num(ra.resume_score) ? `${num(ra.resume_score).toFixed(0)}/100` : ""],
          ["Skills Detected", arr(ra.skills_detected).join(", ")],
          ["Technologies", arr(ra.technologies).join(", ")],
        ]);
        drew = bulletBlock("Projects", ra.projects) || drew;
        drew = bulletBlock("Strengths", ra.strengths) || drew;
        drew = bulletBlock("Weaknesses", ra.weaknesses) || drew;
        return drew;
      });

      // =====================================================================
      // OA ROUND
      // =====================================================================
      const oa = report.oa_round || {};
      section("OA Round", () =>
        table([
          ["Score", num(oa.score) ? `${num(oa.score).toFixed(0)}/100` : ""],
          ["Questions Attempted", num(oa.questions_attempted) ? String(oa.questions_attempted) : ""],
          ["Correct Answers", num(oa.correct_answers) ? String(oa.correct_answers) : ""],
          ["Time Management", oa.time_management],
          ["Problem Solving", oa.problem_solving],
          ["AI Feedback", oa.ai_feedback],
        ])
      );

      // =====================================================================
      // TECHNICAL ROUND
      // =====================================================================
      const tr = report.technical_round || {};
      section("Technical Round", () =>
        table([
          ["Coding Skills", tr.coding_skills],
          ["DSA", tr.dsa],
          ["Frontend", tr.frontend],
          ["Backend", tr.backend],
          ["Database", tr.database],
          ["API Design", tr.api_design],
          ["Debugging", tr.debugging],
          ["AI Feedback", tr.ai_feedback],
        ])
      );

      // =====================================================================
      // HR ROUND
      // =====================================================================
      const hr = report.hr_round || {};
      section("HR Round", () =>
        table([
          ["Communication", hr.communication],
          ["Confidence", hr.confidence],
          ["Leadership", hr.leadership],
          ["Teamwork", hr.teamwork],
          ["Behaviour", hr.behaviour],
          ["AI Feedback", hr.ai_feedback],
        ])
      );

      // =====================================================================
      // OVERALL STRENGTHS / IMPROVEMENTS / RECOMMENDATIONS / SUMMARY
      // =====================================================================
      section("Overall Strengths", () => bullets(report.strengths));
      section("Areas of Improvement", () =>
        bullets(arr(report.areas_to_improve).length ? report.areas_to_improve : report.weaknesses)
      );
      section("Learning Recommendations", () => bullets(report.learning_recommendations));
      section("AI Career Suggestions", () => bullets(report.career_suggestions));
      section("Final Summary", () => paragraph(report.final_summary || report.overall_summary));

      // =====================================================================
      // FOOTER on every page (bufferPages)
      // =====================================================================
      // IMPORTANT: every footer draw must use `lineBreak: false`. Without it
      // pdfkit's line wrapper decides the next line doesn't fit near the page
      // bottom and calls continueOnNewPage — appending a BLANK page per page
      // (which is what was doubling the report's length).
      const range = doc.bufferedPageRange(); // { start, count }
      const genTs = s(candidate.generatedAt, new Date().toISOString());
      const footOpts = { lineBreak: false, height: 10 };
      for (let i = range.start; i < range.start + range.count; i++) {
        doc.switchToPage(i);
        const fy = doc.page.height - doc.page.margins.bottom - 20;
        doc.lineWidth(0.5).moveTo(left, fy).lineTo(right, fy).stroke(COLORS.line);
        doc
          .font("Helvetica")
          .fontSize(7.5)
          .fillColor(COLORS.sub)
          .text(
            `Generated by TrueHire AI  ·  Interview ID: ${s(candidate.interviewId)}  ·  ${genTs}  ·  Report ${candidate.reportVersion ? "v" + candidate.reportVersion : "v1"}`,
            left,
            fy + 6,
            { ...footOpts, width: contentW - 70 }
          );
        doc.text(`Page ${i - range.start + 1} of ${range.count}`, right - 65, fy + 6, {
          ...footOpts,
          width: 65,
          align: "right",
        });
      }
      // Flush so no further pages can be appended after the footers.
      doc.flushPages();

      doc.end();
    } catch (err) {
      reject(err);
    }
  });
}
