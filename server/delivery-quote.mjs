const ROUTES_URL = 'https://routes.googleapis.com/directions/v2:computeRoutes';
const METERS_PER_MILE = 1609.344;
const FREE_MILES = 15;
const DOLLARS_PER_EXTRA_MILE = 2;

function sendJson(res, status, body) {
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
  });
  res.end(JSON.stringify(body));
}

async function readDestination(req) {
  let body = '';
  for await (const chunk of req.iterator({ destroyOnReturn: false })) {
    body += chunk;
    if (body.length > 2048) {
      req.resume();
      return undefined;
    }
  }
  const fields = JSON.parse(body);
  const valid = (key, max) => typeof fields?.[key] === 'string'
    && fields[key].trim().length > 0 && fields[key].length <= max;
  if (!valid('street', 160) || !valid('city', 80) || !valid('state', 40)
    || !valid('zip', 10) || !/^\d{5}(-\d{4})?$/.test(fields.zip)) return undefined;
  return [fields.street, fields.city, fields.state, fields.zip, 'USA'].map((part) => part.trim()).join(', ');
}

export function deliveryQuoteMiddleware({ origin, apiKey }) {
  return async (req, res, next) => {
    if (req.url?.split('?')[0] !== '/api/delivery-quote') return next();
    if (req.method !== 'POST') {
      res.setHeader('Allow', 'POST');
      return sendJson(res, 405, { error: 'Use POST to request a delivery quote.' });
    }
    if (!origin || !apiKey) {
      return sendJson(res, 503, { error: 'Delivery quotes are unavailable. The fee can be confirmed by address.' });
    }

    let destination;
    try {
      destination = await readDestination(req);
    } catch {
      return sendJson(res, 400, { error: 'Enter a valid delivery address.' });
    }
    if (!destination) return sendJson(res, 400, { error: 'Enter a valid delivery address.' });

    try {
      const response = await fetch(ROUTES_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Goog-Api-Key': apiKey,
          'X-Goog-FieldMask': 'routes.distanceMeters',
        },
        body: JSON.stringify({
          origin: { address: origin },
          destination: { address: destination },
          travelMode: 'DRIVE',
          routingPreference: 'TRAFFIC_UNAWARE',
        }),
        signal: AbortSignal.timeout(8000),
      });
      if (!response.ok) throw new Error('Route lookup failed');
      const data = await response.json();
      const meters = data.routes?.[0]?.distanceMeters;
      if (typeof meters !== 'number' || !Number.isFinite(meters) || meters < 0) {
        return sendJson(res, 422, { error: 'No driving route was found. Check the address to try again.' });
      }
      const extraMiles = Math.max(0, meters / METERS_PER_MILE - FREE_MILES);
      const feeCents = Math.round(extraMiles * DOLLARS_PER_EXTRA_MILE) * 100;
      return sendJson(res, 200, { feeCents });
    } catch {
      return sendJson(res, 502, { error: 'Delivery quotes are unavailable. The fee can be confirmed by address.' });
    }
  };
}
