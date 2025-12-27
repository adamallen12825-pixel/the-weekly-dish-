// API keys should be set in Vercel environment variables
const API_KEYS = {
  OPENAI_API_KEY: process.env.OPENAI_API_KEY,
  WALMART_API_KEY: process.env.WALMART_API_KEY,
  WALMART_CLIENT_ID: process.env.WALMART_CLIENT_ID,
  UPC_DATABASE_KEY: process.env.UPC_DATABASE_KEY,
};

const API_ENDPOINTS = {
  OPENAI_VISION: 'https://api.openai.com/v1/chat/completions',
  OPENAI_CHAT: 'https://api.openai.com/v1/chat/completions',
  WALMART_SEARCH: 'https://developer.api.walmart.com/api-proxy/service/affil/product/v2/search',
  WALMART_PRODUCT: 'https://developer.api.walmart.com/api-proxy/service/affil/product/v2/items',
  UPC_LOOKUP: 'https://api.upcitemdb.com/prod/trial/lookup',
};

export { API_KEYS, API_ENDPOINTS };