exports.handler = async () => {
  const applicationId = process.env.SQUARE_APPLICATION_ID;
  const locationId = process.env.SQUARE_LOCATION_ID;
  const environment = process.env.SQUARE_ENVIRONMENT === 'production'
    ? 'production'
    : 'sandbox';

  if (!applicationId || !locationId) {
    return {
      statusCode: 500,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-store'
      },
      body: JSON.stringify({
        success: false,
        error: 'Square frontend configuration is missing.'
      })
    };
  }

  return {
    statusCode: 200,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-store'
    },
    body: JSON.stringify({
      success: true,
      applicationId,
      locationId,
      environment
    })
  };
};
