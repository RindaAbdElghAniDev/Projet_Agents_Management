const nodemailer = require('nodemailer');

let transporter;

// Le transporteur n'est créé qu'une seule fois (pas à chaque envoi)
const getTransporter = () => {
  if (!transporter) {
    transporter = nodemailer.createTransport({
      host: process.env.EMAIL_HOST,
      port: Number(process.env.EMAIL_PORT),
      secure: Number(process.env.EMAIL_PORT) === 465,
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASSWORD,
      },
    });
  }
  return transporter;
};

const sendPasswordResetEmail = async (to, name, resetUrl) => {
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 480px; margin: 0 auto; color: #1f2937;">
      <h2 style="color: #2563eb;">Agent Management System</h2>
      <p>Bonjour ${name},</p>
      <p>Une demande de réinitialisation de votre mot de passe a été effectuée.</p>
      <p>Cliquez sur le bouton ci-dessous pour créer un nouveau mot de passe :</p>
      <p style="text-align: center; margin: 32px 0;">
        <a href="${resetUrl}" style="background: #2563eb; color: #fff; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: 600;">
          Réinitialiser mon mot de passe
        </a>
      </p>
      <p>Ce lien expire dans 30 minutes.</p>
      <p>Si vous n'êtes pas à l'origine de cette demande, vous pouvez ignorer cet email.</p>
      <p>Cordialement,<br />Agent Management System</p>
    </div>
  `;

  await getTransporter().sendMail({
    from: process.env.EMAIL_FROM,
    to,
    subject: 'Réinitialisation de votre mot de passe',
    html,
  });
};

module.exports = { sendPasswordResetEmail };