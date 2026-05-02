const {
  escapeHtml,
  getMailTo,
  isMailConfigured,
  sendMail
} = require('./email-service');

const JSON_HEADERS = {
  'Content-Type': 'application/json',
  'Cache-Control': 'no-store'
};

function clean(value, maxLength) {
  return String(value || '').trim().slice(0, maxLength);
}

function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers: JSON_HEADERS,
      body: JSON.stringify({ success: false, error: 'Method not allowed' })
    };
  }

  try {
    if (!isMailConfigured()) {
      return {
        statusCode: 500,
        headers: JSON_HEADERS,
        body: JSON.stringify({ success: false, error: 'Email service is not configured.' })
      };
    }

    const body = JSON.parse(event.body || '{}');
    const name = clean(body.name, 80);
    const email = clean(body.email, 120);
    const subject = clean(body.subject || 'General Enquiry', 120);
    const message = clean(body.message, 4000);

    if (!name || !email || !message) {
      return {
        statusCode: 400,
        headers: JSON_HEADERS,
        body: JSON.stringify({ success: false, error: 'Name, email, and message are required.' })
      };
    }

    if (!isValidEmail(email)) {
      return {
        statusCode: 400,
        headers: JSON_HEADERS,
        body: JSON.stringify({ success: false, error: 'Please enter a valid email address.' })
      };
    }

    await sendMail({
      to: getMailTo(),
      replyTo: email,
      subject: `Inspect Drive enquiry: ${subject}`,
      text: [
        `Name: ${name}`,
        `Email: ${email}`,
        `Subject: ${subject}`,
        '',
        message
      ].join('\n'),
      html: `
        <h2>New Inspect Drive enquiry</h2>
        <p><strong>Name:</strong> ${escapeHtml(name)}</p>
        <p><strong>Email:</strong> ${escapeHtml(email)}</p>
        <p><strong>Subject:</strong> ${escapeHtml(subject)}</p>
        <p><strong>Message:</strong></p>
        <p>${escapeHtml(message).replace(/\n/g, '<br>')}</p>
      `
    });

    return {
      statusCode: 200,
      headers: JSON_HEADERS,
      body: JSON.stringify({ success: true })
    };
  } catch (err) {
    console.error('Email send error:', err);
    const statusCode = err instanceof SyntaxError ? 400 : 500;
    const message = err instanceof SyntaxError
      ? 'Invalid email request payload.'
      : 'Message could not be sent right now.';

    return {
      statusCode,
      headers: JSON_HEADERS,
      body: JSON.stringify({ success: false, error: message })
    };
  }
};
