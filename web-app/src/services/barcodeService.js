// Import local database for instant lookup
import { lookupBarcodeLocal } from '../data/productDatabase';

// Same-origin API (consolidated onto the main site).
const API_URL = process.env.REACT_APP_API_URL || '';

export const lookupBarcode = async (barcode) => {
  try {
    // Clean the barcode
    const cleanBarcode = barcode.replace(/\s/g, '').replace(/[^0-9]/g, '');
    
    // FIRST: Check local database for instant lookup
    const localProduct = lookupBarcodeLocal(cleanBarcode);
    if (localProduct) {
      return localProduct;
    }
    
    // SECOND: Use our Vercel backend API which checks multiple sources
    
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
