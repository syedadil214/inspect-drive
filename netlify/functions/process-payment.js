const { Client, Environment } = require('square');
const crypto = require('crypto');

const squareClient = new Client({
  accessToken: process.env.SQUARE_ACCESS_TOKEN,
  environment: process.env.SQUARE_ENVIRONMENT === 'production'
    ? Environment.Production
    : Environment.Sandbox
});

const JSON_HEADERS = {
  'Content-Type': 'application/json',
  'Cache-Control': 'no-store'
};

// Valid prices in pence
const PRICES = {
  'Basic Report': 3999,
  'Standard Report': 4999,
  'Premium Report': 5999
};

const SQUARE_ERROR_MESSAGES = {
  GENERIC_DECLINE: 'The card was declined by the bank. Please try a different card or contact your bank.',
  CARD_DECLINED: 'The card was declined. Please try a different card.',
  CARD_DECLINED_VERIFICATION_REQUIRED: 'This card requires additional verification. Please try again and complete the bank verification step.',
  CVV_FAILURE: 'The card security code is incorrect.',
  ADDRESS_VERIFICATION_FAILURE: 'The billing postcode could not be verified.',
  EXPIRATION_FAILURE: 'The card expiry date is incorrect.',
  INSUFFICIENT_FUNDS: 'The card has insufficient funds.',
  INVALID_ACCOUNT: 'The card account is invalid. Please use a different card.'
};

exports.handler = async (event) => {
  // Only allow POST
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers: JSON_HEADERS,
      body: JSON.stringify({ success: false, error: 'Method not allowed' })
    };
  }

  try {
    if (!process.env.SQUARE_ACCESS_TOKEN || !process.env.SQUARE_LOCATION_ID) {
      return {
        statusCode: 500,
        headers: JSON_HEADERS,
        body: JSON.stringify({ success: false, error: 'Payment service is not configured.' })
      };
    }

    const body = JSON.parse(event.body || '{}');
    const { sourceId, amountPence, currency, planName, customerName, customerEmail, postalCode } = body;

    // Validate required fields
    if (!sourceId || !amountPence || !currency || !planName) {
      return {
        statusCode: 400,
        headers: JSON_HEADERS,
        body: JSON.stringify({ success: false, error: 'Missing required fields.' })
      };
    }

    // Validate amount matches plan
    const expected = PRICES[planName];
    if (!expected || expected !== amountPence) {
      return {
        statusCode: 400,
        headers: JSON_HEADERS,
        body: JSON.stringify({ success: false, error: 'Invalid plan or amount.' })
      };
    }

    if (currency !== 'GBP') {
      return {
        statusCode: 400,
        headers: JSON_HEADERS,
        body: JSON.stringify({ success: false, error: 'Unsupported currency.' })
      };
    }

    if (!Number.isInteger(amountPence) || amountPence <= 0) {
      return {
        statusCode: 400,
        headers: JSON_HEADERS,
        body: JSON.stringify({ success: false, error: 'Invalid payment amount.' })
      };
    }

    // Create payment
    const { result } = await squareClient.paymentsApi.createPayment({
      sourceId,
      idempotencyKey: crypto.randomUUID(),
      amountMoney: {
        amount: BigInt(amountPence),
        currency
      },
      locationId: process.env.SQUARE_LOCATION_ID,
      buyerEmailAddress: customerEmail,
      billingAddress: { postalCode },
      note: `${planName} for ${customerName}`
    });

    return {
      statusCode: 200,
      headers: JSON_HEADERS,
      body: JSON.stringify({
        success: true,
        paymentId: result.payment.id,
        status: result.payment.status,
        receiptUrl: result.payment.receiptUrl
      })
    };

  } catch (err) {
    console.error('Payment error:', err);
    const squareErrors = err.result?.errors;
    let message = 'Payment failed. Please try a different card.';
    let statusCode = 500;

    if (err instanceof SyntaxError) {
      message = 'Invalid payment request payload.';
      statusCode = 400;
    }

    if (squareErrors?.length) {
      const squareError = squareErrors[0];
      message = SQUARE_ERROR_MESSAGES[squareError.code] || squareError.detail || message;
      statusCode = 402;
    }
    return {
      statusCode,
      headers: JSON_HEADERS,
      body: JSON.stringify({ success: false, error: message })
    };
  }
};
