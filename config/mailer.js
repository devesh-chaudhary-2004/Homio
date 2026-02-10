const brevo = require("@getbrevo/brevo");

async function sendOtpEmail({ to, code }) {
  const { BREVO_API_KEY, EMAIL_FROM_NAME, EMAIL_FROM_ADDRESS } = process.env;
  
  if (!BREVO_API_KEY) {
    throw new Error("Email is not configured. Please set BREVO_API_KEY in .env");
  }

  const apiInstance = new brevo.TransactionalEmailsApi();
  apiInstance.setApiKey(brevo.TransactionalEmailsApiApiKeys.apiKey, BREVO_API_KEY);

  const subject = "Your Homio verification code";
  const textContent = `Your Homio verification code is: ${code}\n\nThis code expires in 10 minutes.`;
  const htmlContent = `
    <div style="font-family: Arial, sans-serif; line-height: 1.5">
      <h2 style="margin: 0 0 8px">Verify your email</h2>
      <p style="margin: 0 0 12px">Your Homio verification code is:</p>
      <div style="font-size: 28px; font-weight: 700; letter-spacing: 4px; padding: 12px 16px; border: 1px solid #ddd; display: inline-block; border-radius: 10px;">
        ${code}
      </div>
      <p style="margin: 12px 0 0; color:#666">This code expires in 10 minutes.</p>
    </div>
  `;

  const sendSmtpEmail = new brevo.SendSmtpEmail();
  sendSmtpEmail.subject = subject;
  sendSmtpEmail.htmlContent = htmlContent;
  sendSmtpEmail.textContent = textContent;
  sendSmtpEmail.sender = { 
    name: EMAIL_FROM_NAME || "Homio", 
    email: EMAIL_FROM_ADDRESS || "noreply@homio.com" 
  };
  sendSmtpEmail.to = [{ email: to }];

  await apiInstance.sendTransacEmail(sendSmtpEmail);
}

module.exports = { sendOtpEmail };
