// Barcode -> product lookup. No personal data involved, so no auth is required,
// but CORS is locked to our own origins. Uses the free Open Food Facts API,
// falling back to UPC Database if a key is configured.

const { applyCors } = require('../_lib/auth');
const { createLogger, errFields } = require('../_lib/log');
const rateLimit = require('../_lib/rateLimit');

// Never let a slow third-party lookup hang the request.
const LOOKUP_TIMEOUT_MS = 6000;

module.exports = async (req, res) => {
  const log = createLogger('barcode', req);
  if (applyCors(req, res, 'GET,OPTIONS')) return;
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed', reqId: log.reqId });
  }

  const raw = req.query.barcode || '';
  const cleanBarcode = String(raw).replace(/[^0-9]/g, '');
  if (cleanBarcode.length < 6 || cleanBarcode.length > 14) {
    return res.status(400).json({ success: false, error: 'Invalid barcode', reqId: log.reqId });
  }
  try {
    if (await rateLimit.enforce(req, res, { bucket: 'barcode', id: rateLimit.clientIp(req), max: 60, windowSeconds: 60 })) return;
  } catch (error) {
    log.warn('rate limit unavailable', errFields(error));
  }
  log.info('lookup', { barcode: cleanBarcode });

  // Open Food Facts (free, no key).
  try {
    const response = await fetch(
      `https://world.openfoodfacts.org/api/v0/product/${cleanBarcode}.json`,
      { signal: AbortSignal.timeout(LOOKUP_TIMEOUT_MS) }
    );
    const data = await response.json();
    if (data.status === 1 && data.product) {
      const p = data.product;
      return res.status(200).json({
        success: true,
        product: {
          name: p.product_name || p.product_name_en || `Product ${cleanBarcode}`,
          brand: p.brands || 'Unknown Brand',
          quantity: p.quantity || '1 item',
          category: p.categories ? p.categories.split(',')[0] : 'Other',
          barcode: cleanBarcode,
          description: p.generic_name || '',
          imageUrl: p.image_url || p.image_front_url || null,
        },
      });
    }
  } catch (err) {
    log.warn('Open Food Facts lookup failed', errFields(err));
  }

  // Optional UPC Database fallback.
  if (process.env.UPC_DATABASE_KEY) {
    try {
      const response = await fetch(`https://api.upcdatabase.org/product/${cleanBarcode}`, {
        headers: {
          Accept: 'application/json',
          Authorization: `Bearer ${process.env.UPC_DATABASE_KEY}`,
        },
        signal: AbortSignal.timeout(LOOKUP_TIMEOUT_MS),
      });
      if (response.ok) {
        const data = await response.json();
        if (data.success && data.product) {
          return res.status(200).json({
            success: true,
            product: {
              name: data.product.title || `Product ${cleanBarcode}`,
              brand: data.product.brand || 'Unknown Brand',
              quantity: '1 item',
              category: data.product.category || 'Other',
              barcode: cleanBarcode,
              description: data.product.description || '',
              imageUrl: data.product.image || null,
            },
          });
        }
      }
    } catch (err) {
      log.warn('UPC Database lookup failed', errFields(err));
    }
  }

  return res.status(200).json({
    success: false,
    error: 'Product not found',
    product: {
      name: `Unknown Product (${cleanBarcode})`,
      brand: 'Unknown',
      quantity: '1 item',
      category: 'Other',
      barcode: cleanBarcode,
      description: '',
    },
  });
};
