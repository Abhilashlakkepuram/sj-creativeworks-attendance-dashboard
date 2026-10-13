const nodemailer = require("nodemailer");

// ─────────────────────────────────────────────────────
// ✅ RESEND CONFIGURATION (lazy, guarded)
// ─────────────────────────────────────────────────────
let resend;
try {
  if (process.env.RESEND_API_KEY && process.env.RESEND_API_KEY.trim() !== "") {
    const { Resend } = require("resend");
    resend = new Resend(process.env.RESEND_API_KEY);
    console.log("🟢 Resend API initialized.");
  } else {
    console.log("ℹ️ Resend API key not set. Using SMTP only.");
  }
} catch (e) {
    console.warn("⚠️ Resend initialization failed, using SMTP only.");
}

// ─────────────────────────────────────────────────────
// ✅ SMTP CONFIGURATION (Gmail or Zoho)
// ─────────────────────────────────────────────────────
const createTransporter = (port) => {
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST || "smtp.gmail.com",
    port: port,
    secure: port === 465, // SSL for 465, STARTTLS for 587
    auth: {
      user: process.env.SMTP_EMAIL,
      pass: process.env.SMTP_PASSWORD
    },
    connectionTimeout: 5000,
    greetingTimeout: 5000,
    socketTimeout: 10000
  });
};

// Initial transporter
let transporter = createTransporter(parseInt(process.env.SMTP_PORT) || 465);

/**
 * High-reliability email sender
 * Prefers Resend API (if key set), falls back to SMTP (Gmail/Zoho).
 *
 * For Gmail (no domain needed):
 *   SMTP_HOST=smtp.gmail.com
 *   SMTP_PORT=465
 *   SMTP_EMAIL=yourgmail@gmail.com
 *   SMTP_PASSWORD=your_16_char_app_password  ← NOT your regular password
 */
const sendEmail = async (to, subject, html) => {
  // 1️⃣ TRY RESEND (only if key is configured)
  if (resend) {
    try {
      const { data } = await resend.emails.send({
        from: process.env.RESEND_FROM || `SJ Creativeworks <onboarding@resend.dev>`,
        to: [to],
        subject,
        html
      });

      if (data && data.id) {
        return { success: true };
      }

      console.warn("Resend delivery failed; trying SMTP fallback.");
    } catch (e) {
      console.warn("Resend delivery failed; trying SMTP fallback.");
    }
  }

  // 2️⃣ TRY PRIMARY SMTP (Gmail / Zoho / any)
  try {
    await transporter.sendMail({
      from: `"SJ Creativeworks" <${process.env.SMTP_EMAIL}>`,
      to,
      subject,
      html
    });
    console.log("✅ Email sent via SMTP.");
    return { success: true };
  } catch (error) {
    console.warn("SMTP delivery failed.");

    // 3️⃣ TRY SMTP PORT FALLBACK (465 -> 587)
    if (transporter.options.port !== 587) {
      console.warn(`⚠️ Trying Port 587 fallback...`);
      const fallbackTransporter = createTransporter(587);
      try {
        await fallbackTransporter.sendMail({
          from: `"SJ Creativeworks" <${process.env.SMTP_EMAIL}>`,
          to,
          subject,
          html
        });
        transporter = fallbackTransporter;
        console.log("✅ Email sent via SMTP Fallback (Port 587).");
        return { success: true };
      } catch (fallbackError) {
        console.error("❌ All email methods failed.");
      }
    } else {
      console.error("SMTP failed and no more fallbacks available.");
    }

    return { error: true, errorMessage: "Email delivery failed" };
  }
};

module.exports = sendEmail;
