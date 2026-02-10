const { Resend } = require("resend");

function getResendClient() {
  const { RESEND_API_KEY } = process.env;
  if (!RESEND_API_KEY) {
    return null;
  }
  return new Resend(RESEND_API_KEY);
}

async function sendOtpEmail({ to, code }) {
  const resend = getResendClient();
  if (!resend) {
    throw new Error("Email is not configured. Please set RESEND_API_KEY in .env");
  }

  const { EMAIL_FROM } = process.env;
  const from = EMAIL_FROM || "Homio <onboarding@resend.dev>";
  const subject = "Your Homio verification code";

  const text = `Your Homio verification code is: ${code}\n\nThis code expires in 10 minutes.`;
  const html = `
    <div style="font-family: Arial, sans-serif; line-height: 1.5">
      <h2 style="margin: 0 0 8px">Verify your email</h2>
      <p style="margin: 0 0 12px">Your Homio verification code is:</p>
      <div style="font-size: 28px; font-weight: 700; letter-spacing: 4px; padding: 12px 16px; border: 1px solid #ddd; display: inline-block; border-radius: 10px;">
        ${code}
      </div>
      <p style="margin: 12px 0 0; color:#666">This code expires in 10 minutes.</p>
    </div>
  `;

  await resend.emails.send({ from, to, subject, text, html });
}

module.exports = { sendOtpEmail };
