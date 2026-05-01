# Inspect Drive Payments

## Local payment testing

Square Web Payments SDK only works on HTTPS or localhost.

Run:

```bash
npm run dev
```

Then open:

```text
http://localhost:8888
```

Do not open `index.html` directly with `file://`.

`npm run dev` uses the Express server and exposes:

- `/`
- `/api/square-config`
- `/api/process-payment`

## Required environment variables

Set these in Hostinger Node.js app environment variables or a local `.env.local` file:

```text
SQUARE_ACCESS_TOKEN=your-square-access-token
SQUARE_APPLICATION_ID=your-square-application-id
SQUARE_LOCATION_ID=your-square-location-id
SQUARE_ENVIRONMENT=sandbox
```

For production payments, all three Square values must come from the same live Square application/location and the environment must be:

```text
SQUARE_ENVIRONMENT=production
```

After deploying, open these URLs on the production domain and confirm they return JSON, not an HTML page:

- `https://your-domain/api/square-config`
- `https://your-domain/health`

If `/api/square-config` shows `<!DOCTYPE html>`, the frontend is reaching the static page instead of the Express API. In Hostinger, deploy this as a Node.js app and set the startup file/command to:

```bash
npm start
```

The Express app also keeps the old Netlify-style routes available for compatibility:

- `/.netlify/functions/square-config`
- `/.netlify/functions/process-payment`

