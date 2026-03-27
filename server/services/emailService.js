const nodemailer = require("nodemailer");

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: process.env.SMTP_PORT,
  secure: true, // Port 465 requires secure: true
  pool: true,   // Reuse connections
  auth: {
    user: process.env.SMTP_EMAIL,
    pass: process.env.SMTP_PASSWORD
  },
  tls: {
    rejectUnauthorized: false // Helps with certificate issues common on some networks
  }
});

const sendEmail = async (to, subject, html) => {
  try {
    await transporter.sendMail({
      from: `"SJ Creativeworks" <${process.env.SMTP_EMAIL}>`,
      to,
      subject,
      html
    });
    console.log("Email sent to:", to);
  } catch (error) {
    console.error("Email Error:", error.message);
  }
};

module.exports = sendEmail;