// Local product database - common grocery items
// This gets loaded instantly, no API calls needed
export const productDatabase = {
  // Coca-Cola products
  "049000006346": { name: "Coca-Cola Classic", brand: "Coca-Cola", category: "Beverages" },
  "049000042566": { name: "Sprite", brand: "Coca-Cola", category: "Beverages" },
  "049000050103": { name: "Coca-Cola Zero Sugar", brand: "Coca-Cola", category: "Beverages" },
  "049000028904": { name: "Diet Coke", brand: "Coca-Cola", category: "Beverages" },
  
  // Pepsi products
  "012000001291": { name: "Pepsi", brand: "PepsiCo", category: "Beverages" },
  "012000001390": { name: "Diet Pepsi", brand: "PepsiCo", category: "Beverages" },
  "012000001437": { name: "Mountain Dew", brand: "PepsiCo", category: "Beverages" },
  
  // Milk & Dairy
  "041483001011": { name: "Whole Milk", brand: "Great Value", category: "Dairy" },
  "041483001028": { name: "2% Milk", brand: "Great Value", category: "Dairy" },
  "041483001035": { name: "1% Milk", brand: "Great Value", category: "Dairy" },
  "041483001042": { name: "Skim Milk", brand: "Great Value", category: "Dairy" },
  
  // Bread
  "072945100328": { name: "White Bread", brand: "Wonder", category: "Grains" },
  "072945100335": { name: "Wheat Bread", brand: "Wonder", category: "Grains" },
  "073410001004": { name: "White Bread", brand: "Nature's Own", category: "Grains" },
  
  // Eggs
  "041415000018": { name: "Large Eggs (Dozen)", brand: "Great Value", category: "Dairy" },
  "041415000025": { name: "Large Eggs (18 count)", brand: "Great Value", category: "Dairy" },
  
  // Cereal
  "038000001437": { name: "Frosted Flakes", brand: "Kellogg's", category: "Grains" },
  "038000001291": { name: "Rice Krispies", brand: "Kellogg's", category: "Grains" },
  "016000275287": { name: "Cheerios", brand: "General Mills", category: "Grains" },
  "016000124127": { name: "Lucky Charms", brand: "General Mills", category: "Grains" },
  
  // Campbell's Soup
  "051000000019": { name: "Chicken Noodle Soup", brand: "Campbell's", category: "Canned" },
  "051000000026": { name: "Tomato Soup", brand: "Campbell's", category: "Canned" },
  "051000012562": { name: "Cream of Mushroom Soup", brand: "Campbell's", category: "Canned" },
  
  // Pasta
  "076808280401": { name: "Spaghetti", brand: "Barilla", category: "Grains" },
  "076808280357": { name: "Penne", brand: "Barilla", category: "Grains" },
  "041000001277": { name: "Elbow Macaroni", brand: "Great Value", category: "Grains" },
  
  // Chips & Snacks
  "028400642255": { name: "Lay's Classic Potato Chips", brand: "Lay's", category: "Snacks" },
  "028400642248": { name: "Lay's BBQ Chips", brand: "Lay's", category: "Snacks" },
  "028400642217": { name: "Lay's Sour Cream & Onion", brand: "Lay's", category: "Snacks" },
  "028400097000": { name: "Doritos Nacho Cheese", brand: "Doritos", category: "Snacks" },
  "028400097017": { name: "Doritos Cool Ranch", brand: "Doritos", category: "Snacks" },
  
  // Oreos & Cookies
  "044000032029": { name: "Oreo Original", brand: "Nabisco", category: "Snacks" },
  "044000032036": { name: "Oreo Double Stuf", brand: "Nabisco", category: "Snacks" },
  "044000031961": { name: "Chips Ahoy! Original", brand: "Nabisco", category: "Snacks" },
  
  // Ketchup & Condiments
  "013000001090": { name: "Tomato Ketchup", brand: "Heinz", category: "Condiments" },
  "013000001106": { name: "Yellow Mustard", brand: "Heinz", category: "Condiments" },
  "048001213487": { name: "Mayonnaise", brand: "Hellmann's", category: "Condiments" },
  "041321005114": { name: "Ranch Dressing", brand: "Hidden Valley", category: "Condiments" },
  
  // Peanut Butter & Jelly
  "051500255162": { name: "Creamy Peanut Butter", brand: "Jif", category: "Condiments" },
  "051500255179": { name: "Crunchy Peanut Butter", brand: "Jif", category: "Condiments" },
  "051500016107": { name: "Grape Jelly", brand: "Smucker's", category: "Condiments" },
  "051500016114": { name: "Strawberry Jam", brand: "Smucker's", category: "Condiments" },
  
  // Water & Beverages
  "012000001031": { name: "Aquafina Water", brand: "Aquafina", category: "Beverages" },
  "049000042511": { name: "Dasani Water", brand: "Dasani", category: "Beverages" },
  "012000001451": { name: "Gatorade Fruit Punch", brand: "Gatorade", category: "Beverages" },
  "012000001468": { name: "Gatorade Lemon-Lime", brand: "Gatorade", category: "Beverages" },
  
  // Frozen Pizza
  "071921001230": { name: "Pepperoni Pizza", brand: "DiGiorno", category: "Frozen" },
  "071921001247": { name: "Four Cheese Pizza", brand: "DiGiorno", category: "Frozen" },
  "072180635105": { name: "Pepperoni Pizza", brand: "Red Baron", category: "Frozen" },
  
  // Ice Cream
  "076840100002": { name: "Vanilla Ice Cream", brand: "Blue Bell", category: "Frozen" },
  "076840100019": { name: "Chocolate Ice Cream", brand: "Blue Bell", category: "Frozen" },
  "048000121011": { name: "Vanilla Ice Cream", brand: "Breyers", category: "Frozen" },
  
  // Yogurt
  "053600000277": { name: "Greek Yogurt Plain", brand: "Chobani", category: "Dairy" },
  "053600000284": { name: "Greek Yogurt Strawberry", brand: "Chobani", category: "Dairy" },
  "070470003045": { name: "Yogurt Strawberry", brand: "Yoplait", category: "Dairy" },
  
  // Cheese
  "041498113111": { name: "American Cheese Slices", brand: "Kraft", category: "Dairy" },
  "041498113128": { name: "Cheddar Cheese Slices", brand: "Kraft", category: "Dairy" },
  "041498111117": { name: "Shredded Mozzarella", brand: "Kraft", category: "Dairy" },
  
  // Butter
  "034500151108": { name: "Salted Butter", brand: "Land O'Lakes", category: "Dairy" },
  "034500151115": { name: "Unsalted Butter", brand: "Land O'Lakes", category: "Dairy" },
  
  // Hot Dogs & Sausages
  "044700012802": { name: "Original Wieners", brand: "Oscar Mayer", category: "Meat" },
  "044700012819": { name: "Beef Franks", brand: "Oscar Mayer", category: "Meat" },
  "077782001013": { name: "Smoked Sausage", brand: "Hillshire Farm", category: "Meat" },
  
  // Bacon
  "044700013106": { name: "Original Bacon", brand: "Oscar Mayer", category: "Meat" },
  "037600104510": { name: "Bacon", brand: "Hormel", category: "Meat" },
  
  // Canned Vegetables
  "024000163008": { name: "Green Beans", brand: "Del Monte", category: "Canned" },
  "024000163015": { name: "Corn", brand: "Del Monte", category: "Canned" },
  "024000163022": { name: "Sweet Peas", brand: "Del Monte", category: "Canned" },
  
  // Rice
  "011152134284": { name: "Long Grain White Rice", brand: "Uncle Ben's", category: "Grains" },
  "054800420013": { name: "Instant Rice", brand: "Minute Rice", category: "Grains" },
  
  // Medicine & Health
  "305730154329": { name: "Advil Ibuprofen Tablets", brand: "Advil", category: "Health" },
  "305730154402": { name: "Advil PM", brand: "Advil", category: "Health" },
  "305730154987": { name: "Advil Ibuprofen Tablets", brand: "Advil", category: "Health" },
  "300450181008": { name: "Tylenol Extra Strength", brand: "Tylenol", category: "Health" },
  "300450181015": { name: "Tylenol Regular Strength", brand: "Tylenol", category: "Health" },
  "323900014015": { name: "Vicks VapoRub", brand: "Vicks", category: "Health" },
  "323900014008": { name: "Vicks NyQuil", brand: "Vicks", category: "Health" },
  "323900014022": { name: "Vicks DayQuil", brand: "Vicks", category: "Health" },
  
  // Toothpaste
  "037000974161": { name: "Crest Pro-Health Toothpaste", brand: "Crest", category: "Health" },
  "035000974082": { name: "Colgate Total Toothpaste", brand: "Colgate", category: "Health" },
  
  // Shampoo
  "037000834922": { name: "Head & Shoulders Classic Clean", brand: "Head & Shoulders", category: "Health" },
  "037000834939": { name: "Head & Shoulders Dry Scalp", brand: "Head & Shoulders", category: "Health" },
  
  // Add more products as needed...
};

// Function to lookup barcode locally first
export function lookupBarcodeLocal(barcode) {
  // Clean the barcode
  const cleanBarcode = barcode.replace(/\s/g, '').replace(/[^0-9]/g, '');
  
  // Check if we have it in our database
  const product = productDatabase[cleanBarcode];
  
  if (product) {
    return {
      ...product,
      barcode: cleanBarcode,
      quantity: '1 item',
      found: true
    };
  }
  
  // Not found locally
  return null;
}