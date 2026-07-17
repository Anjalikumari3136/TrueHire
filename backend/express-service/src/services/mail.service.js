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
