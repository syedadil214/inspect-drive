const nodemailer = require('nodemailer');

const DEFAULT_MAIL_TO = 'Support@inpectdrive.com';

function escapeHtml(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function getMailFrom() {
  return process.env.MAIL_FROM || process.env.SMTP_USER || '';
}

function getMailTo() {
  return process.env.MAIL_TO || process.env.CONTACT_EMAIL || DEFAULT_MAIL_TO;
}

function isMailConfigured() {
  return Boolean(process.env.SMTP_HOST && getMailFrom() && getMailTo());
}

function createTransporter() {
  if (!isMailConfigured()) {
    throw new Error('Email service is not configured.');
  }

  const port = Number(process.env.SMTP_PORT || 587);
  const auth = process.env.SMTP_USER && process.env.SMTP_PASS
    ? {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS
      }
    : undefined;

  return nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port,
    secure: String(process.env.SMTP_SECURE || '').toLowerCase() === 'true' || port === 465,
    auth
  });
}

async function sendMail(options) {
  const transporter = createTransporter();
  return transporter.sendMail({
    from: getMailFrom(),
    ...options
  });
}

module.exports = {
  DEFAULT_MAIL_TO,
  escapeHtml,
  getMailFrom,
  getMailTo,
  isMailConfigured,
  sendMail
};
