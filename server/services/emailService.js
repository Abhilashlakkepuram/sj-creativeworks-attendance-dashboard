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
  console.warn("⚠️ Resend package unavailable, using SMTP only:", e.message);
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
    tls: { rejectUnauthorized: false },
    connectionTimeout: 5000,
    greetingTimeout: 5000,
    socketTimeout: 10000
  });
};

// Initial transporter
let transporter = createTransporter(parseInt(process.env.SMTP_PORT) || 465);

// Verify SMTP on startup
transporter.verify((error) => {
  if (error) {
    console.warn(`⚠️ SMTP Connection Check (Port ${transporter.options.port}) failed: ${error.message}`);
    console.warn("💡 If using Gmail, make sure you're using an App Password (not your regular password).");
    console.warn("   Generate one at: https://myaccount.google.com/apppasswords");
  } else {
    console.log(`🟢 SMTP Server is ready (Port ${transporter.options.port}) via ${process.env.SMTP_HOST || "smtp.gmail.com"}`);
  }
});

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
  let lastError = "Unknown error";

  // 1️⃣ TRY RESEND (only if key is configured)
  if (resend) {
    try {
      console.log(`📡 Sending via Resend to: ${to}`);
      const { data, error } = await resend.emails.send({
        from: process.env.RESEND_FROM || `SJ Creativeworks <onboarding@resend.dev>`,
        to: [to],
        subject,
        html
      });

      if (data && data.id) {
        console.log("✅ Email sent via Resend:", data.id);
        return { success: true };
      }

      console.error("❌ Resend API Error:", error?.message || error);
      lastError = error?.message || error;
      console.log("🔄 Switching to SMTP fallback...");
    } catch (e) {
      console.error("❌ Resend exception:", e.message);
      lastError = e.message;
      console.log("🔄 Switching to SMTP fallback...");
    }
  }

  // 2️⃣ TRY PRIMARY SMTP (Gmail / Zoho / any)
  try {
    console.log(`📡 Sending via SMTP (${process.env.SMTP_HOST || "smtp.gmail.com"}) to: ${to}`);
    await transporter.sendMail({
      from: `"SJ Creativeworks" <${process.env.SMTP_EMAIL}>`,
      to,
      subject,
      html
    });
    console.log("✅ Email sent via SMTP.");
    return { success: true };
  } catch (error) {
    lastError = error.message;
    console.error(`❌ SMTP Port ${transporter.options.port} failed:`, error.message);

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
        lastError = fallbackError.message;
      }
    } else {
      console.error(`❌ SMTP failed and no more fallbacks available. Last error: ${lastError}`);
    }

    return { error: true, errorMessage: lastError };
  }
};

module.exports = sendEmail;