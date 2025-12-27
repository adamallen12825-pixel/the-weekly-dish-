const express = require('express');
const cors = require('cors');
const { ClerkExpressRequireAuth } = require('@clerk/clerk-sdk-node');
const fetch = require('node-fetch');

const app = express();

// Middleware
app.use(cors({
  origin: ['https://theweekly-dish.com', 'https://www.theweekly-dish.com', 'http://localhost:3000'],
  credentials: true
}));
app.use(express.json({ limit: '50mb' })); // Increase limit for image uploads

// Initialize Square client - using SquareClient from the package
let squareClient;
try {
  const { SquareClient } = require('square');
  
  squareClient = new SquareClient({
    accessToken: process.env.SQUARE_ACCESS_TOKEN,
    environment: 'sandbox'
  });
  console.log('Square client initialized successfully');
} catch (error) {
  console.error('Error initializing Square:', error.message);
}

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', message: 'The Weekly Dish API is running' });
});

// In-memory storage fallback (for development/testing)
// In production, use Vercel KV or another persistent store
const memoryStore = {};

// KV Storage endpoint - GET
app.get('/api/kv', async (req, res) => {
  try {
    const { userId, key } = req.query;

    if (!userId || !key) {
      return res.status(400).json({ error: 'userId and key are required' });
    }

    const storageKey = `${userId}:${key}`;

    // Try Vercel KV first if available
    if (process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN) {
      try {
        const kvResponse = await fetch(`${process.env.KV_REST_API_URL}/get/${storageKey}`, {
          headers: {
            Authorization: `Bearer ${process.env.KV_REST_API_TOKEN}`
          }
        });
        const kvData = await kvResponse.json();
        if (kvData.result) {
          return res.json({ value: JSON.parse(kvData.result) });
        }
        return res.json({ value: null });
      } catch (kvError) {
        console.error('Vercel KV error:', kvError);
      }
    }

    // Fallback to memory store
    const value = memoryStore[storageKey];
    res.json({ value: value || null });
  } catch (error) {
    console.error('KV GET error:', error);
    res.status(500).json({ error: error.message });
  }
});

// KV Storage endpoint - POST (set value)
app.post('/api/kv', async (req, res) => {
  try {
    const { userId, key, value } = req.body;

    if (!userId || !key) {
      return res.status(400).json({ error: 'userId and key are required' });
    }

    const storageKey = `${userId}:${key}`;

    // Try Vercel KV first if available
    if (process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN) {
      try {
        await fetch(`${process.env.KV_REST_API_URL}/set/${storageKey}`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${process.env.KV_REST_API_TOKEN}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ value: JSON.stringify(value) })
        });
        return res.json({ success: true });
      } catch (kvError) {
        console.error('Vercel KV error:', kvError);
      }
    }

    // Fallback to memory store
    memoryStore[storageKey] = value;
    res.json({ success: true });
  } catch (error) {
    console.error('KV POST error:', error);
    res.status(500).json({ error: error.message });
  }
});

// KV Storage endpoint - DELETE
app.delete('/api/kv', async (req, res) => {
  try {
    const { userId, key } = req.query;

    if (!userId || !key) {
      return res.status(400).json({ error: 'userId and key are required' });
    }

    const storageKey = `${userId}:${key}`;

    // Try Vercel KV first if available
    if (process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN) {
      try {
        await fetch(`${process.env.KV_REST_API_URL}/del/${storageKey}`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${process.env.KV_REST_API_TOKEN}`
          }
        });
        return res.json({ success: true });
      } catch (kvError) {
        console.error('Vercel KV error:', kvError);
      }
    }

    // Fallback to memory store
    delete memoryStore[storageKey];
    res.json({ success: true });
  } catch (error) {
    console.error('KV DELETE error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Anthropic API Proxy - to avoid CORS issues
app.post('/api/claude', async (req, res) => {
  try {
    console.log('Claude API request received');
    const { messages, max_tokens = 4000, temperature = 0.7 } = req.body;

    if (!messages || !Array.isArray(messages)) {
      console.error('Invalid messages:', messages);
      return res.status(400).json({ error: 'Invalid request: messages array required' });
    }

    const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
    console.log('API Key present:', !!ANTHROPIC_API_KEY);
    console.log('API Key length:', ANTHROPIC_API_KEY?.length);
    console.log('API Key starts with:', ANTHROPIC_API_KEY?.substring(0, 10));

    if (!ANTHROPIC_API_KEY) {
      console.error('CRITICAL: ANTHROPIC_API_KEY is not set in environment variables!');
      return res.status(500).json({
        error: 'API key not configured. Please set ANTHROPIC_API_KEY in Vercel environment variables.'
      });
    }

    // Convert OpenAI-style messages to Anthropic format
    const systemMessage = messages.find(m => m.role === 'system');
    const userMessages = messages.filter(m => m.role !== 'system');

    const anthropicMessages = userMessages.map(msg => ({
      role: msg.role === 'user' ? 'user' : 'assistant',
      content: msg.content
    }));

    // Anthropic requires first message to be from user
    if (anthropicMessages.length > 0 && anthropicMessages[0].role !== 'user') {
      console.error('First message must be from user, got:', anthropicMessages[0].role);
      return res.status(400).json({ error: 'First message must be from user' });
    }

    console.log('Sending to Anthropic:', {
      messageCount: anthropicMessages.length,
      hasSystem: !!systemMessage,
      firstRole: anthropicMessages[0]?.role
    });

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-3-sonnet-20240229',
        max_tokens,
        temperature,
        system: systemMessage ? systemMessage.content : undefined,
        messages: anthropicMessages
      })
    });

    console.log('Anthropic response status:', response.status);
    const data = await response.json();

    if (!response.ok) {
      console.error('Anthropic API Error:', response.status, JSON.stringify(data));
      return res.status(response.status).json(data);
    }

    console.log('Success! Returning data to client');
    res.json(data);
  } catch (error) {
    console.error('Claude proxy error:', error.message, error.stack);
    res.status(500).json({ error: error.message, stack: error.stack });
  }
});

// OpenAI API Proxy
app.post('/api/openai', async (req, res) => {
  try {
    console.log('OpenAI API request received');
    const { messages, max_tokens = 16000, temperature = 0.7, model = 'gpt-4o' } = req.body;

    if (!messages || !Array.isArray(messages)) {
      console.error('Invalid messages:', messages);
      return res.status(400).json({ error: 'Invalid request: messages array required' });
    }

    const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
    console.log('OpenAI API Key present:', !!OPENAI_API_KEY);

    if (!OPENAI_API_KEY) {
      console.error('CRITICAL: OPENAI_API_KEY is not set in environment variables!');
      return res.status(500).json({
        error: 'API key not configured. Please set OPENAI_API_KEY in Vercel environment variables.'
      });
    }

    console.log('Sending to OpenAI:', {
      messageCount: messages.length,
      model
    });

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${OPENAI_API_KEY}`
      },
      body: JSON.stringify({
        model,
        messages,
        max_tokens,
        temperature
      })
    });

    console.log('OpenAI response status:', response.status);
    const data = await response.json();

    if (!response.ok) {
      console.error('OpenAI API Error:', response.status, JSON.stringify(data));
      return res.status(response.status).json(data);
    }

    console.log('Success! Returning data to client');
    res.json(data);
  } catch (error) {
    console.error('OpenAI proxy error:', error.message, error.stack);
    res.status(500).json({ error: error.message, stack: error.stack });
  }
});

// Claude Vision API Proxy
app.post('/api/claude/vision', async (req, res) => {
  try {
    const { image, prompt } = req.body;

    if (!image || !prompt) {
      return res.status(400).json({ error: 'Invalid request: image and prompt required' });
    }

    const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
    console.log('Vision API Key present:', !!ANTHROPIC_API_KEY);

    if (!ANTHROPIC_API_KEY) {
      console.error('CRITICAL: ANTHROPIC_API_KEY is not set for vision endpoint!');
      return res.status(500).json({
        error: 'API key not configured. Please set ANTHROPIC_API_KEY in Vercel environment variables.'
      });
    }

    // Remove data URL prefix if present
    const base64Image = image.replace(/^data:image\/\w+;base64,/, '');

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-3-sonnet-20240229',
        max_tokens: 4000,
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'image',
                source: {
                  type: 'base64',
                  media_type: 'image/jpeg',
                  data: base64Image
                }
              },
              {
                type: 'text',
                text: prompt
              }
            ]
          }
        ]
      })
    });

    const data = await response.json();

    if (!response.ok) {
      console.error('Anthropic Vision API Error:', data);
      return res.status(response.status).json(data);
    }

    res.json(data);
  } catch (error) {
    console.error('Claude vision proxy error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Create subscription
app.post('/api/payments/create-subscription', async (req, res) => {
  try {
    if (!squareClient) {
      return res.status(500).json({ success: false, error: 'Payment system not available' });
    }
    
    const { sourceId, userId, email, planId } = req.body;

    // First, create or get customer
    const customersApi = squareClient.customersApi;
    let customer;
    
    try {
      // Search for existing customer by email
      const searchResponse = await customersApi.searchCustomers({
        filter: {
          emailAddress: {
            exact: email
          }
        }
      });
      
      if (searchResponse.result.customers && searchResponse.result.customers.length > 0) {
        customer = searchResponse.result.customers[0];
      } else {
        // Create new customer
        const createCustomerResponse = await customersApi.createCustomer({
          givenName: email.split('@')[0],
          emailAddress: email,
          referenceId: userId
        });
        customer = createCustomerResponse.result.customer;
      }
    } catch (error) {
      console.error('Customer creation error:', error);
      return res.status(500).json({ success: false, error: 'Failed to create customer' });
    }

    // Create card on file
    const cardsApi = squareClient.cardsApi;
    try {
      const cardResponse = await cardsApi.createCard({
        sourceId: sourceId,
        card: {
          customerId: customer.id
        }
      });
      
      const cardId = cardResponse.result.card.id;

      // Create subscription
      const subscriptionsApi = squareClient.subscriptionsApi;
      const subscriptionResponse = await subscriptionsApi.createSubscription({
        locationId: process.env.SQUARE_LOCATION_ID,
        planId: planId || process.env.SQUARE_SUBSCRIPTION_PLAN_ID, // You'll create this in Square Dashboard
        customerId: customer.id,
        cardId: cardId,
        timezone: 'America/New_York'
      });

      res.json({
        success: true,
        subscription: subscriptionResponse.result.subscription,
        customerId: customer.id
      });
    } catch (error) {
      console.error('Subscription creation error:', error);
      res.status(500).json({ success: false, error: 'Failed to create subscription' });
    }
  } catch (error) {
    console.error('General error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Check subscription status
app.get('/api/payments/subscription-status/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    
    // Search for customer by reference ID (userId)
    const customersApi = squareClient.customersApi;
    const searchResponse = await customersApi.searchCustomers({
      filter: {
        referenceId: {
          exact: userId
        }
      }
    });
    
    if (!searchResponse.result.customers || searchResponse.result.customers.length === 0) {
      return res.json({ hasActiveSubscription: false });
    }
    
    const customer = searchResponse.result.customers[0];
    
    // Get customer's subscriptions
    const subscriptionsApi = squareClient.subscriptionsApi;
    const subscriptionsResponse = await subscriptionsApi.searchSubscriptions({
      filter: {
        customerIds: [customer.id]
      }
    });
    
    // Check if any subscription is active
    const hasActiveSubscription = subscriptionsResponse.result.subscriptions?.some(
      sub => sub.status === 'ACTIVE' || sub.status === 'PENDING'
    ) || false;
    
    res.json({ 
      hasActiveSubscription,
      subscriptions: subscriptionsResponse.result.subscriptions 
    });
  } catch (error) {
    console.error('Subscription status check error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Cancel subscription
app.post('/api/payments/cancel-subscription', async (req, res) => {
  try {
    const { userId } = req.body;
    
    // Find customer
    const customersApi = squareClient.customersApi;
    const searchResponse = await customersApi.searchCustomers({
      filter: {
        referenceId: {
          exact: userId
        }
      }
    });
    
    if (!searchResponse.result.customers || searchResponse.result.customers.length === 0) {
      return res.status(404).json({ error: 'Customer not found' });
    }
    
    const customer = searchResponse.result.customers[0];
    
    // Get active subscriptions
    const subscriptionsApi = squareClient.subscriptionsApi;
    const subscriptionsResponse = await subscriptionsApi.searchSubscriptions({
      filter: {
        customerIds: [customer.id]
      }
    });
    
    // Cancel all active subscriptions
    const cancelPromises = subscriptionsResponse.result.subscriptions
      ?.filter(sub => sub.status === 'ACTIVE')
      .map(sub => subscriptionsApi.cancelSubscription(sub.id)) || [];
    
    await Promise.all(cancelPromises);
    
    res.json({ success: true, message: 'Subscription cancelled' });
  } catch (error) {
    console.error('Subscription cancellation error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Customer portal (redirect to Square's customer portal)
app.post('/api/payments/customer-portal', async (req, res) => {
  try {
    const { userId } = req.body;
    
    // For Square, you would typically create a custom portal or use Square's dashboard
    // This is a placeholder - Square doesn't have a built-in customer portal like Stripe
    const portalUrl = `https://squareup.com/dashboard/customers`; // You'd build a custom portal
    
    res.json({ portalUrl });
  } catch (error) {
    console.error('Portal error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Barcode lookup endpoint
app.get('/api/barcode/:barcode', async (req, res) => {
  try {
    const { barcode } = req.params;
    
    // Clean the barcode
    const cleanBarcode = barcode.replace(/\s/g, '').replace(/[^0-9]/g, '');
    console.log('Looking up barcode:', cleanBarcode);
    
    // Try Open Food Facts API (free, no key needed)
    try {
      const fetch = require('node-fetch');
      const response = await fetch(`https://world.openfoodfacts.org/api/v0/product/${cleanBarcode}.json`);
      const data = await response.json();
      
      if (data.status === 1 && data.product) {
        const product = data.product;
        return res.json({
          success: true,
          product: {
            name: product.product_name || product.product_name_en || `Product ${cleanBarcode}`,
            brand: product.brands || 'Unknown Brand',
            quantity: product.quantity || '1 item',
            category: product.categories ? product.categories.split(',')[0] : 'Other',
            barcode: cleanBarcode,
            description: product.generic_name || '',
            imageUrl: product.image_url || product.image_front_url || null
          }
        });
      }
    } catch (offError) {
      console.log('Open Food Facts API failed:', offError);
    }
    
    // If not found in Open Food Facts, try UPC Database API
    // Note: You can sign up for a free API key at https://upcdatabase.org/api
    const UPC_DATABASE_KEY = process.env.UPC_DATABASE_KEY;
    
    if (UPC_DATABASE_KEY) {
      try {
        const fetch = require('node-fetch');
        const response = await fetch(`https://api.upcdatabase.org/product/${cleanBarcode}`, {
          headers: {
            'Accept': 'application/json',
            'Authorization': `Bearer ${UPC_DATABASE_KEY}`
          }
        });
        
        if (response.ok) {
          const data = await response.json();
          if (data.success && data.product) {
            return res.json({
              success: true,
              product: {
                name: data.product.title || `Product ${cleanBarcode}`,
                brand: data.product.brand || 'Unknown Brand',
                quantity: '1 item',
                category: data.product.category || 'Other',
                barcode: cleanBarcode,
                description: data.product.description || '',
                imageUrl: data.product.image || null
              }
            });
          }
        }
      } catch (upcError) {
        console.log('UPC Database API failed:', upcError);
      }
    }
    
    // If all APIs fail, return not found
    res.json({
      success: false,
      error: 'Product not found',
      product: {
        name: `Unknown Product (${cleanBarcode})`,
        brand: 'Unknown',
        quantity: '1 item',
        category: 'Other',
        barcode: cleanBarcode,
        description: ''
      }
    });
    
  } catch (error) {
    console.error('Barcode lookup error:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message,
      product: {
        name: `Product ${req.params.barcode}`,
        brand: 'Unknown',
        quantity: '1 item',
        category: 'Other',
        barcode: req.params.barcode
      }
    });
  }
});

// Square webhook handler
app.post('/api/webhooks/square', async (req, res) => {
  try {
    const { type, data } = req.body;
    
    switch (type) {
      case 'subscription.created':
      case 'subscription.updated':
        // Handle subscription updates
        console.log('Subscription updated:', data.object.subscription);
        // Update your database here
        break;
        
      case 'subscription.canceled':
        // Handle cancellation
        console.log('Subscription canceled:', data.object.subscription);
        // Update your database here
        break;
        
      case 'invoice.payment_succeeded':
        // Handle successful payment
        console.log('Payment succeeded:', data.object.invoice);
        break;
        
      case 'invoice.payment_failed':
        // Handle failed payment
        console.log('Payment failed:', data.object.invoice);
        // Notify user
        break;
    }
    
    res.json({ received: true });
  } catch (error) {
    console.error('Webhook error:', error);
    res.status(400).json({ error: error.message });
  }
});

// Export for Vercel
module.exports = app;

// For local development
if (process.env.NODE_ENV !== 'production') {
  const PORT = process.env.PORT || 5000;
  app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
  });
}