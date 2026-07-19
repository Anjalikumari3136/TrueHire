import nodemailer from "nodemailer";

const transporter = nodemailer.createTransport({
  host: "smtp.gmail.com",
  port: 465,       //secure smtp port for gmail
  secure: true,          // SSL
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});       


export async function sendOTPEmail(to, otp, purpose = "signup") {
  const isReset = purpose === "reset";

  const subject = isReset
    ? "TrueHire — Password Reset OTP"
    : "TrueHire — Verify Your Email";

  const purposeText = isReset
    ? "reset your password"
    : "verify your email and complete registration";

  const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="UTF-8" />
        <title>${subject}</title>
      </head>
      <body style="margin:0;padding:0;background:#0f0f1a;font-family:'Segoe UI',Arial,sans-serif;">
        <table width="100%" cellpadding="0" cellspacing="0" style="background:#0f0f1a;padding:40px 0;">
          <tr>
            <td align="center">
              <table width="520" cellpadding="0" cellspacing="0" style="background:linear-gradient(135deg,#161628,#1e1e3a);border-radius:16px;border:1px solid rgba(99,102,241,0.25);overflow:hidden;">
                <!-- Header -->
                <tr>
                  <td style="padding:32px 40px 24px;border-bottom:1px solid rgba(99,102,241,0.15);">
                    <h1 style="margin:0;font-size:22px;font-weight:700;color:#ffffff;letter-spacing:-0.5px;">
                      <span style="color:#818cf8;">True</span>Hire
                    </h1>
                  </td>
                </tr>
                <!-- Body -->
                <tr>
                  <td style="padding:36px 40px;">
                    <p style="margin:0 0 8px;color:#94a3b8;font-size:14px;text-transform:uppercase;letter-spacing:1px;">Your OTP Code</p>
                    <p style="margin:0 0 28px;color:#e2e8f0;font-size:15px;line-height:1.6;">
                      Use the code below to ${purposeText}. This code is valid for <strong style="color:#818cf8;">10 minutes</strong>.
                    </p>
                    <!-- OTP Box -->
                    <div style="background:rgba(99,102,241,0.12);border:1.5px solid rgba(99,102,241,0.4);border-radius:12px;padding:28px;text-align:center;margin-bottom:28px;">
                      <span style="font-size:42px;font-weight:800;letter-spacing:12px;color:#818cf8;">${otp}</span>
                    </div>
                    <p style="margin:0;color:#64748b;font-size:13px;line-height:1.6;">
                      If you did not request this, please ignore this email. Do not share this OTP with anyone.
                    </p>
                  </td>
                </tr>
                <!-- Footer -->
                <tr>
                  <td style="padding:20px 40px;border-top:1px solid rgba(99,102,241,0.15);">
                    <p style="margin:0;color:#475569;font-size:12px;">© 2026 TrueHire · Automated email — please do not reply.</p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
      </body>
    </html>
  `;

  await transporter.sendMail({
    from: `"TrueHire" <${process.env.EMAIL_USER}>`,
    to,
    subject,
    html,
  });
}

/**
 * Send the completed interview report to the candidate with the generated PDF
 * attached. Reuses the SAME shared `transporter` above — no new transporter,
 * no duplicated configuration.
 *
 * @param {object} params
 * @param {string} params.to             Candidate email
 * @param {string} params.candidateName  Candidate display name
 * @param {Buffer} params.pdfBuffer      The generated report PDF (attached)
 * @param {string} [params.interviewId]  Interview session id (shown in the mail)
 * @param {string} [params.dashboardUrl] Link for the "View Dashboard" button
 */
export async function sendInterviewReportEmail({
  to,
  candidateName,
  pdfBuffer,
  interviewId = "",
  dashboardUrl = process.env.CLIENT_URL || "http://localhost:5173",
}) {
  const safeName = String(candidateName || "Candidate").trim() || "Candidate";
  // Filename that works reliably across Gmail / Outlook / other clients.
  const attachmentName = `TrueHire_Interview_Report_${safeName.replace(/[^a-zA-Z0-9]+/g, "_")}.pdf`;
  const dashboardLink = `${String(dashboardUrl).replace(/\/+$/, "")}/dashboard`;

  const html = `
    <!DOCTYPE html>
    <html>
      <head><meta charset="UTF-8" /><title>Your TrueHire Interview Report</title></head>
      <body style="margin:0;padding:0;background:#0f0f1a;font-family:'Segoe UI',Arial,sans-serif;">
        <table width="100%" cellpadding="0" cellspacing="0" style="background:#0f0f1a;padding:40px 0;">
          <tr><td align="center">
            <table width="560" cellpadding="0" cellspacing="0" style="background:linear-gradient(135deg,#161628,#1e1e3a);border-radius:16px;border:1px solid rgba(99,102,241,0.25);overflow:hidden;">
              <tr><td style="padding:32px 40px 20px;border-bottom:1px solid rgba(99,102,241,0.15);">
                <h1 style="margin:0;font-size:22px;font-weight:700;color:#ffffff;letter-spacing:-0.5px;">
                  <span style="color:#818cf8;">True</span>Hire
                </h1>
              </td></tr>
              <tr><td style="padding:32px 40px;">
                <p style="margin:0 0 16px;color:#e2e8f0;font-size:16px;">Hello ${safeName},</p>
                <p style="margin:0 0 14px;color:#e2e8f0;font-size:15px;line-height:1.6;"><strong style="color:#818cf8;">Congratulations!</strong> Your AI Interview Assessment has been completed successfully.</p>
                <p style="margin:0 0 14px;color:#cbd5e1;font-size:15px;line-height:1.6;">Your personalized interview report is now ready. We've attached your detailed Interview Report (PDF) to this email.</p>
                <p style="margin:0 0 8px;color:#94a3b8;font-size:14px;">The report includes:</p>
                <ul style="margin:0 0 20px;padding-left:20px;color:#cbd5e1;font-size:14px;line-height:1.9;">
                  <li>Overall Interview Score</li>
                  <li>Resume Analysis</li>
                  <li>OA Evaluation</li>
                  <li>Technical Evaluation</li>
                  <li>HR Evaluation</li>
                  <li>Strengths &amp; Weaknesses</li>
                  <li>AI Recommendations</li>
                  <li>Hiring Recommendation</li>
                </ul>
                <p style="margin:0 0 24px;color:#cbd5e1;font-size:15px;line-height:1.6;">You can also log in to your TrueHire dashboard to view or download the report anytime.</p>
                <table cellpadding="0" cellspacing="0"><tr><td style="border-radius:10px;background:linear-gradient(135deg,#6366f1,#818cf8);">
                  <a href="${dashboardLink}" target="_blank" style="display:inline-block;padding:13px 30px;color:#ffffff;font-size:15px;font-weight:600;text-decoration:none;border-radius:10px;">View Dashboard →</a>
                </td></tr></table>
              </td></tr>
              <tr><td style="padding:20px 40px;border-top:1px solid rgba(99,102,241,0.15);">
                <p style="margin:0 0 4px;color:#94a3b8;font-size:13px;">Regards,<br/><strong style="color:#cbd5e1;">TrueHire Team</strong></p>
                ${interviewId ? `<p style="margin:8px 0 0;color:#475569;font-size:11px;">Interview ID: ${interviewId}</p>` : ""}
              </td></tr>
            </table>
          </td></tr>
        </table>
      </body>
    </html>
  `;

  await transporter.sendMail({
    from: `"TrueHire" <${process.env.EMAIL_USER}>`,
    to,
    subject: "🎉 Your TrueHire Interview Report is Ready",
    html,
    attachments: [
      {
        filename: attachmentName,
        content: pdfBuffer,
        contentType: "application/pdf",
      },
    ],
  });
}
