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
    const address = clean(body.address, 500);
    const registrationNumber = clean(body.registrationNumber, 20).toUpperCase();
    const vehicleModel = clean(body.vehicleModel, 120);
    const phone = clean(body.phone, 40);
    const notes = clean(body.notes, 1200);

    if (!name || !address || !registrationNumber || !vehicleModel) {
      return {
        statusCode: 400,
        headers: JSON_HEADERS,
        body: JSON.stringify({
          success: false,
          error: 'Name, address, registration number, and vehicle model are required.'
        })
      };
    }

    await sendMail({
      to: getMailTo(),
      subject: `New vehicle history request: ${registrationNumber}`,
      text: [
        'New vehicle history request',
        '',
        `Name: ${name}`,
        `Address: ${address}`,
        `Vehicle registration: ${registrationNumber}`,
        `Vehicle model: ${vehicleModel}`,
        phone ? `Phone: ${phone}` : '',
        notes ? `Notes: ${notes}` : ''
      ].filter(Boolean).join('\n'),
      html: `
        <h2>New vehicle history request</h2>
        <p><strong>Name:</strong> ${escapeHtml(name)}</p>
        <p><strong>Address:</strong> ${escapeHtml(address).replace(/\n/g, '<br>')}</p>
        <p><strong>Vehicle registration:</strong> ${escapeHtml(registrationNumber)}</p>
        <p><strong>Vehicle model:</strong> ${escapeHtml(vehicleModel)}</p>
        ${phone ? `<p><strong>Phone:</strong> ${escapeHtml(phone)}</p>` : ''}
        ${notes ? `<p><strong>Notes:</strong> ${escapeHtml(notes).replace(/\n/g, '<br>')}</p>` : ''}
      `
    });

    return {
      statusCode: 200,
      headers: JSON_HEADERS,
      body: JSON.stringify({ success: true })
    };
  } catch (err) {
    console.error('Vehicle enquiry email error:', err);
    const statusCode = err instanceof SyntaxError ? 400 : 500;
    const message = err instanceof SyntaxError
      ? 'Invalid vehicle request payload.'
      : 'Vehicle request could not be sent right now.';

    return {
      statusCode,
      headers: JSON_HEADERS,
      body: JSON.stringify({ success: false, error: message })
    };
  }
};
