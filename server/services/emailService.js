const nodemailer = require("nodemailer");

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: parseInt(process.env.SMTP_PORT) || 587,
  secure: process.env.SMTP_PORT === "465", // Only true for 465
  auth: {
    user: process.env.SMTP_EMAIL,
    pass: process.env.SMTP_PASSWORD
  },
  tls: {
    rejectUnauthorized: false
  },
  timeout: 10000, // 10s connection timeout
  debug: true,    // 🔥 Show full SMTP traffic in logs
  logger: true    // 🔥 Use built-in logger
});

// Verify transport on startup
transporter.verify((error, success) => {
  if (error) {
    console.error("🔥 SMTP Connection Error:", error.message);
  } else {
    console.log("🟢 SMTP Server is ready (OTP capability active)");
  }
});

const sendEmail = async (to, subject, html) => {
  try {
    console.log(`📡 Attempting to send email from ${process.env.SMTP_EMAIL} to: ${to}`);
    
    const info = await transporter.sendMail({
      from: `"${process.env.SMTP_FROM_NAME || 'SJ Creativeworks'}" <${process.env.SMTP_EMAIL}>`,
      to,
      subject,
      html
    });
    
    console.log("✅ Email sent successfully:", info.messageId);
    return info;
  } catch (error) {
    console.error("❌ Nodemailer Error Detail:", {
      message: error.message,
      code: error.code,
      command: error.command,
      response: error.response,
      responseCode: error.responseCode
    });
    throw error;
  }
};

module.exports = sendEmail;