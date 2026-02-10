const nodemailer = require("nodemailer");

function getTransport() {
  const { SMTP_HOST, SMTP_PORT, SMTP_SECURE, SMTP_USER, SMTP_PASS } = process.env;
  
  if (!SMTP_HOST || !SMTP_PORT || !SMTP_USER || !SMTP_PASS) {
    return null;
  }

  return nodemailer.createTransport({
    host: SMTP_HOST,
    port: Number(SMTP_PORT),
    secure: String(SMTP_SECURE).toLowerCase() === "true",
    auth: {
      user: SMTP_USER,
      pass: SMTP_PASS,
    },
    // Timeouts to prevent hanging requests
    connectionTimeout: 10000, // 10 seconds
    greetingTimeout: 10000,
    socketTimeout: 15000,
  });
}

async function sendOtpEmail({ to, code }) {
  const transport = getTransport();
  if (!transport) {
    throw new Error("SMTP is not configured. Please set SMTP_* in .env");
  }

  const { SMTP_FROM, SMTP_USER } = process.env;
  const from = SMTP_FROM || SMTP_USER;
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

  await transport.sendMail({ from, to, subject, text, html });
}

module.exports = { sendOtpEmail };
