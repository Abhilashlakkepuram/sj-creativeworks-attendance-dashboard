const nodemailer = require("nodemailer");
const { Resend } = require("resend");

// ─────────────────────────────────────────────────────
// ✅ RESEND CONFIGURATION
// ─────────────────────────────────────────────────────
let resend;
if (process.env.RESEND_API_KEY) {
  resend = new Resend(process.env.RESEND_API_KEY);
  console.log("🟢 Resend API initialized.");
}

// ─────────────────────────────────────────────────────
// ✅ SMTP CONFIGURATION (ZOHO FALLBACK)
// ─────────────────────────────────────────────────────
const createTransporter = (port) => {
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST || "smtp.zoho.com",
    port: port,
    secure: port === 465, // SSL for 465, STARTTLS for 587/others
    auth: {
      user: process.env.SMTP_EMAIL,
      pass: process.env.SMTP_PASSWORD
    },
    tls: { rejectUnauthorized: false },
    connectionTimeout: 10000, // 10s connection timeout
    greetingTimeout: 10000,
    socketTimeout: 15000
  });
};

// Initial transporter (prefers 465 if configured, otherwise 587)
let transporter = createTransporter(parseInt(process.env.SMTP_PORT) || 587);

// Verify SMTP on startup as a background check
transporter.verify((error) => {
  if (error) {
    console.warn(`⚠️ SMTP Connection Check (Port ${transporter.options.port}) failed: ${error.message}`);
  } else {
    console.log(`🟢 SMTP Server is ready (Port ${transporter.options.port})`);
  }
});

/**
 * High-reliability email sender
 * Prefers Resend API, falls back to SMTP (Zoho), then falls back to Port 587.
 */
const sendEmail = async (to, subject, html) => {
  let lastError = "Unknown error";
  // 1️⃣ TRY RESEND (Preferred if key is set)
  if (resend) {
    try {
      console.log(`📡 Sending via Resend to: ${to}`);
      const { data, error } = await resend.emails.send({
        from: "SJ Creativeworks <onboarding@resend.dev>", // ⚠️ Default onboarding domain
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

  // 2️⃣ TRY PRIMARY SMTP (ZOHO)
  try {
    console.log(`📡 Sending via SMTP to: ${to} (Port ${transporter.options.port})`);
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

    // 3️⃣ TRY SMTP AUTO-FALLBACK (e.g. 465 -> 587)
    if (transporter.options.port !== 587) {
      console.warn(`⚠️ SMTP Port ${transporter.options.port} failed. Trying 587 fallback...`);
      const fallbackTransporter = createTransporter(587);
      try {
        await fallbackTransporter.sendMail({
          from: `"SJ Creativeworks" <${process.env.SMTP_EMAIL}>`,
          to,
          subject,
          html
        });
        transporter = fallbackTransporter; // Upgrade global transporter for next time
        console.log("✅ Email sent via SMTP Fallback (Port 587).");
        return { success: true };
      } catch (fallbackError) {
        console.error("❌ All email methods (Resend & SMTP) failed.");
        lastError = fallbackError.message;
      }
    } else {
      console.error("❌ SMTP failed and no more fallbacks available.");
    }

    return { error: true, errorMessage: lastError };
  }
};

module.exports = sendEmail;