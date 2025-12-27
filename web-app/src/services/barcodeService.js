// Import local database for instant lookup
import { lookupBarcodeLocal } from '../data/productDatabase';

const API_URL = process.env.REACT_APP_API_URL || 'https://weekly-dish-api.vercel.app';

export const lookupBarcode = async (barcode) => {
  try {
    // Clean the barcode
    const cleanBarcode = barcode.replace(/\s/g, '').replace(/[^0-9]/g, '');
    console.log('Looking up barcode:', cleanBarcode);
    
    // FIRST: Check local database for instant lookup
    const localProduct = lookupBarcodeLocal(cleanBarcode);
    if (localProduct) {
      console.log('Found in local database:', localProduct.name);
      return localProduct;
    }
    
    // SECOND: Use our Vercel backend API which checks multiple sources
    console.log('Not in local database, checking via API...');
    
    try {
      const response = await fetch(`${API_URL}/api/barcode/${cleanBarcode}`);
      const data = await response.json();
      
      if (data.success || data.product) {
        const product = data.product;
        return {
          name: product.name || `Product ${cleanBarcode}`,
          brand: product.brand || 'Unknown Brand',
          quantity: product.quantity || '1 item',
          category: product.category || 'Other',
          barcode: cleanBarcode,
          description: product.description || '',
          imageUrl: product.imageUrl || null
        };
      }
    } catch (apiError) {
      console.log('API lookup failed:', apiError);
    }
    
    // Return basic info if API fails
    return {
      name: `Unknown Product (${cleanBarcode})`,
      brand: 'Unknown',
      quantity: '1 item',
      category: 'Other',
      barcode: cleanBarcode,
      error: 'Product not found'
    };
    
  } catch (error) {
    console.error('Barcode lookup error:', error);
    
    // Return basic info on error
    return {
      name: `Product ${barcode}`,
      brand: 'Unknown',
      quantity: '1 item',
      category: 'Other',
      barcode: barcode,
      error: error.message
    };
  }
};

// Alternative: Use RapidAPI's Barcode Lookup (also has free tier)
// Sign up at: https://rapidapi.com/go-bar-code-go-bar-code-default/api/barcode-lookup
export const lookupBarcodeRapidAPI = async (barcode) => {
  const options = {
    method: 'GET',
    headers: {
      'X-RapidAPI-Key': 'YOUR_RAPIDAPI_KEY', // Get from RapidAPI
      'X-RapidAPI-Host': 'barcode-lookup.p.rapidapi.com'
    }
  };
  
  try {
    const response = await fetch(`https://barcode-lookup.p.rapidapi.com/v3/products?barcode=${barcode}`, options);
    const data = await response.json();
    
    if (data.products && data.products.length > 0) {
      const product = data.products[0];
      return {
        name: product.title,
        brand: product.brand,
        quantity: '1 item',
        category: product.category || 'General',
        barcode: barcode,
      };
    }
  } catch (error) {
    console.error('RapidAPI lookup failed:', error);
  }
  
  return null;
};