// Walmart service using public data
// Since we don't have API access yet, we'll use web scraping techniques

// Common grocery items mapped to Walmart product IDs
// These are real Walmart product IDs for common items
const WALMART_PRODUCT_MAP = {
  // Dairy
  'milk': '10450114',  // Great Value Whole Milk, 1 Gallon
  'eggs': '10315958',  // Great Value Large White Eggs, 12 count
  'butter': '10448400', // Great Value Salted Butter, 1 lb
  'cheese': '10452443', // Great Value Mild Cheddar Cheese, 8 oz
  'yogurt': '10293667', // Great Value Greek Yogurt
  
  // Meat
  'chicken breast': '10532625', // Boneless Skinless Chicken Breasts
  'ground beef': '37296141',    // All Natural Ground Beef
  'bacon': '13926559',          // Great Value Bacon
  'chicken': '10532625',        // Chicken breasts
  'beef': '37296141',           // Ground beef
  
  // Produce  
  'bananas': '44390948',    // Fresh Bananas
  'apples': '44391025',     // Red Delicious Apples
  'lettuce': '44391090',    // Iceberg Lettuce
  'tomatoes': '44390982',   // Fresh Tomatoes
  'onions': '44391081',     // Yellow Onions
  'potatoes': '44391114',   // Russet Potatoes
  'carrots': '44391022',    // Fresh Carrots
  
  // Bread & Grains
  'bread': '10315752',      // Great Value White Bread
  'rice': '10315883',       // Great Value Long Grain Rice
  'pasta': '10300711',      // Great Value Spaghetti
  'flour': '10311397',      // Great Value All-Purpose Flour
  'tortillas': '10323694',  // Great Value Flour Tortillas
  
  // Pantry
  'sugar': '10314917',      // Great Value Pure Sugar
  'salt': '10448393',       // Great Value Salt
  'oil': '10315832',        // Great Value Vegetable Oil
  'olive oil': '10314353',  // Great Value Olive Oil
  'beans': '10534035',      // Great Value Black Beans
  'tomato sauce': '10415293', // Great Value Tomato Sauce
  
  // Common ingredients
  'garlic': '44391085',     // Fresh Garlic
  'pepper': '10315113',     // Great Value Black Pepper
  'cinnamon': '10292643',   // Great Value Ground Cinnamon
  'vanilla': '10313349',    // Great Value Vanilla Extract
};

const searchWalmartProducts = async (query, zipCode = '72762') => {
  try {
    // Clean and normalize the query
    const cleanQuery = query.toLowerCase().trim();
    
    // Look for direct match first
    if (WALMART_PRODUCT_MAP[cleanQuery]) {
      return {
        success: true,
        products: [{
          name: query,
          price: 0, // Price would come from API
          pricePerUnit: '',
          inStock: true,
          productId: WALMART_PRODUCT_MAP[cleanQuery],
          imageUrl: '',
          addToCartUrl: `https://www.walmart.com/ip/${WALMART_PRODUCT_MAP[cleanQuery]}`
        }]
      };
    }
    
    // Try partial matches
    for (const [key, productId] of Object.entries(WALMART_PRODUCT_MAP)) {
      if (cleanQuery.includes(key) || key.includes(cleanQuery)) {
        return {
          success: true,
          products: [{
            name: query,
            price: 0,
            pricePerUnit: '',
            inStock: true,
            productId: productId,
            imageUrl: '',
            addToCartUrl: `https://www.walmart.com/ip/${productId}`
          }]
        };
      }
    }
    
    // No match found
    return {
      success: true,
      products: []
    };
  } catch (error) {
    console.error('Walmart search error:', error);
    return { success: false, error: error.message };
  }
};

const generateWalmartCartUrl = (items, storeId) => {
  // Walmart add-to-cart URL - multiple possible formats to try
  
  console.log('generateWalmartCartUrl called with', items?.length || 0, 'items');
  
  if (!items || items.length === 0) {
    console.log('No items provided, returning base cart URL');
    return 'https://www.walmart.com/cart';
  }
  
  // Method 1: Using the pac (pre-assembled cart) endpoint
  // This is what Walmart affiliate links use
  // Format: https://goto.walmart.com/c/[tracking]/[publisher]/[url]
  // Or direct: https://www.walmart.com/pac?id=productId&qty=quantity
  
  // Method 2: Using checkout/pac with multiple items
  // Format: https://www.walmart.com/checkout/pac?products=id1:qty1,id2:qty2
  
  // Method 3: Using cart with specific format
  // Format: https://www.walmart.com/cart?item=productId&qty=1
  
  // Let's try the pac (pre-assembled cart) format which is most reliable
  const productsList = items
    .filter(item => {
      const hasId = !!item.productId;
      if (!hasId) console.log('Item missing productId:', item);
      return hasId;
    })
    .slice(0, 10) // Limit to 10 items for URL length
    .map(item => {
      const qty = Math.ceil(parseFloat(item.quantity) || 1);
      return `${item.productId}:${qty}`;
    })
    .join(',');
  
  console.log('Products list string:', productsList);
  
  if (!productsList) {
    console.log('No valid items with productIds, returning base cart URL');
    return 'https://www.walmart.com/cart';
  }
  
  // Try different URL formats - test which one works
  // Format 1: Direct cart with items parameter (most common)
  const cartUrl1 = `https://www.walmart.com/cart?items=${productsList}`;
  
  // Format 2: Using the PAC endpoint
  const cartUrl2 = `https://www.walmart.com/pac?products=${productsList}`;
  
  // Format 3: Using action=addItems
  const cartUrl3 = `https://www.walmart.com/cart?action=addItems&items=${productsList}`;
  
  console.log('Cart URL Format 1 (items):', cartUrl1);
  console.log('Cart URL Format 2 (PAC):', cartUrl2);
  console.log('Cart URL Format 3 (action):', cartUrl3);
  
  // Try format 1 first as it's most commonly used
  return cartUrl1;
};

const findNearbyStores = async (zipCode) => {
  try {
    // Simple placeholder - GPT will handle the actual store lookup
    // We just need to let the user proceed with their ZIP code
    return {
      success: true,
      stores: [
        {
          storeId: 'auto',
          displayName: 'Your Local Walmart',
          address: 'Will be determined by ZIP',
          city: 'Your City',
          state: '--',
          zip: zipCode,
          distance: 'Nearby'
        }
      ]
    };
  } catch (error) {
    console.error('Store lookup error:', error);
    return { success: false, error: error.message };
  }
};

const matchItemToWalmartProduct = async (itemName, quantity, zipCode) => {
  // Smart matching algorithm to find the best Walmart product
  // for a given shopping list item
  
  try {
    // Parse quantity and item name
    let cleanName = itemName.toLowerCase();
    let parsedQuantity = quantity;
    
    // Extract quantity from item name if present (e.g., "2 lbs chicken")
    const qtyMatch = cleanName.match(/^(\d+(?:\.\d+)?)\s*(lbs?|pounds?|oz|ounces?|cups?|gallons?|quarts?)?\s+(.+)/);
    if (qtyMatch) {
      parsedQuantity = parseFloat(qtyMatch[1]);
      cleanName = qtyMatch[3];
    }
    
    // Remove common modifiers and units
    cleanName = cleanName
      .replace(/\b(fresh|organic|large|small|medium|whole|ground|boneless|skinless|sliced|chopped|diced)\b/gi, '')
      .replace(/\b(lbs?|pounds?|oz|ounces?|cups?|gallons?|quarts?|packages?|bags?|cans?|bottles?|jars?)\b/gi, '')
      .replace(/[0-9]+\s*(lbs?|oz|g|kg|ml|l)?/gi, '')
      .replace(/\s+/g, ' ')
      .trim();
    
    // Search for the product
    const results = await searchWalmartProducts(cleanName, zipCode);
    
    if (results.success && results.products.length > 0) {
      // Return the best match
      return {
        success: true,
        product: results.products[0],
        originalItem: itemName,
        quantity: parsedQuantity || 1
      };
    }
    
    // Try with just the main ingredient
    const mainIngredient = cleanName.split(' ').pop();
    const fallbackResults = await searchWalmartProducts(mainIngredient, zipCode);
    
    if (fallbackResults.success && fallbackResults.products.length > 0) {
      return {
        success: true,
        product: fallbackResults.products[0],
        originalItem: itemName,
        quantity: parsedQuantity || 1
      };
    }
    
    return {
      success: false,
      originalItem: itemName,
      quantity: parsedQuantity || 1,
      message: 'Product not found'
    };
  } catch (error) {
    console.error('Product matching error:', error);
    return {
      success: false,
      originalItem: itemName,
      error: error.message
    };
  }
};

const processShoppingList = async (shoppingList, zipCode) => {
  // Process entire shopping list and match to Walmart products
  const results = {
    matchedItems: [],
    unmatchedItems: [],
    totalPrice: 0,
    cartUrl: ''
  };
  
  try {
    console.log('Processing shopping list:', shoppingList);
    
    if (!shoppingList || !Array.isArray(shoppingList)) {
      console.error('Invalid shopping list format:', shoppingList);
      return results;
    }
    
    // Process each item in the shopping list
    for (const section of shoppingList) {
      console.log('Processing section:', section.category);
      
      if (!section.items || !Array.isArray(section.items)) {
        console.log('No items in section:', section);
        continue;
      }
      
      for (const item of section.items) {
        console.log('Processing item:', item);
        
        // Check if GPT already provided a Walmart ID
        if (item.walmartId) {
          console.log('Found Walmart ID:', item.walmartId);
          const matchedItem = {
            name: item.name,
            productId: item.walmartId,
            quantity: Math.ceil(parseFloat(item.quantity) || 1),
            originalName: item.name,
            price: parseFloat(item.estimatedPrice || item.price?.replace('$', '') || 0)
          };
          console.log('Adding matched item:', matchedItem);
          results.matchedItems.push(matchedItem);
          results.totalPrice += matchedItem.price;
        } else {
          // Fall back to our matching algorithm
          const match = await matchItemToWalmartProduct(
            item.name,
            item.quantity,
            zipCode
          );
          
          if (match.success) {
            results.matchedItems.push({
              ...match.product,
              quantity: Math.ceil(parseFloat(item.quantity) || 1),
              originalName: item.name
            });
            results.totalPrice += match.product.price * (parseFloat(item.quantity) || 1);
          } else {
            results.unmatchedItems.push({
              name: item.name,
              quantity: item.quantity,
              reason: match.message
            });
          }
        }
      }
    }
    
    // Generate cart URL if we have matched items
    console.log('Total matched items:', results.matchedItems.length);
    if (results.matchedItems.length > 0) {
      console.log('Generating cart URL for items:', results.matchedItems.slice(0, 3)); // Log first 3 items to avoid clutter
      try {
        results.cartUrl = generateWalmartCartUrl(
          results.matchedItems,
          null // No specific store ID needed
        );
        console.log('Generated cart URL:', results.cartUrl);
      } catch (error) {
        console.error('Error generating cart URL:', error);
        results.cartUrl = 'https://www.walmart.com/cart';
      }
    } else {
      console.log('No matched items to generate cart URL');
    }
    
    console.log('Final results summary:', {
      matchedCount: results.matchedItems.length,
      unmatchedCount: results.unmatchedItems.length,
      totalPrice: results.totalPrice,
      hasCartUrl: !!results.cartUrl
    });
    return results;
  } catch (error) {
    console.error('Shopping list processing error:', error);
    return {
      ...results,
      error: error.message
    };
  }
};

export {
  searchWalmartProducts,
  generateWalmartCartUrl,
  findNearbyStores,
  matchItemToWalmartProduct,
  processShoppingList
};