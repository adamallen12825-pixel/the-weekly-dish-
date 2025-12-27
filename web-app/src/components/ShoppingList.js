import React, { useState, useEffect } from 'react';
import { processShoppingList } from '../services/walmartService';
import kvService from '../services/kvService';
import './ShoppingList.css';

function ShoppingList({ user }) {
  const [shoppingList, setShoppingList] = useState(null);
  const [checkedItems, setCheckedItems] = useState({});
  const [processingWalmart, setProcessingWalmart] = useState(false);
  const [walmartCart, setWalmartCart] = useState(null);
  const [addingToPantry, setAddingToPantry] = useState(false);

  // Helper function to load data from cloud storage
  const loadUserData = async (key) => {
    if (!user) return null;
    try {
      return await kvService.get(user.id, key);
    } catch (error) {
      console.error(`Error loading ${key}:`, error);
      return null;
    }
  };

  // Helper function to save data to cloud storage
  const saveUserData = async (key, value) => {
    if (!user) return;
    try {
      if (value === null || value === undefined) {
        // Delete from storage when value is null
        await kvService.delete(user.id, key);
      } else {
        await kvService.set(user.id, key, value);
      }
    } catch (error) {
      console.error(`Error saving ${key}:`, error);
    }
  };

  useEffect(() => {
    if (!user) return;
    
    const loadData = async () => {
      // Load shopping list from cloud storage
      const storedShoppingList = await loadUserData('currentShoppingList');
      
      if (storedShoppingList) {
        console.log('Loading fresh shopping list from storage');
        setShoppingList(storedShoppingList);
      }
    };
    
    loadData();
  }, [user]);

  const toggleItem = (itemId) => {
    setCheckedItems(prev => ({
      ...prev,
      [itemId]: !prev[itemId]
    }));
  };

  const getItemId = (category, index) => `${category}-${index}`;

  const handlePrint = () => {
    window.print();
  };

  const handleAddToPantry = async () => {
    if (!shoppingList) {
      alert('No shopping list to add to pantry');
      return;
    }

    setAddingToPantry(true);
    
    try {
      // Get current pantry items
      const currentPantry = await loadUserData('pantry') || [];
      
      // Get all items from shopping list sections
      const sections = shoppingList.shoppingList?.sections || shoppingList.sections || [];
      const newPantryItems = [];
      
      sections.forEach(section => {
        section.items.forEach(item => {
          // Create pantry item from shopping list item
          const pantryItem = {
            id: Date.now().toString() + Math.random(),
            name: item.name || item.item,
            category: section.category,
            quantity: item.quantity || '1',
            unit: item.unit || '',
            dateAdded: new Date().toISOString(),
            fromShoppingList: true
          };
          newPantryItems.push(pantryItem);
        });
      });
      
      // Combine with existing pantry items
      const updatedPantry = [...currentPantry, ...newPantryItems];
      
      // Save to user-specific localStorage
      await saveUserData('pantry', updatedPantry);
      
      // Clear shopping list after adding to pantry
      await saveUserData('currentShoppingList', null);
      setShoppingList(null);
      setCheckedItems({});
      
      alert(`✅ Success! Added ${newPantryItems.length} items to your pantry.\n\nYour shopping list has been cleared.`);
    } catch (error) {
      console.error('Error adding to pantry:', error);
      alert('Failed to add items to pantry. Please try again.');
    } finally {
      setAddingToPantry(false);
    }
  };

  const handleAddToWalmartCart = async () => {
    // Show coming soon message instead of processing
    alert('🛒 Walmart Integration Coming Soon!\n\nWe\'re working on automatic cart integration. For now, please use the 🔗 links next to each item to search for products on Walmart.com.\n\nThis feature will be available soon!');
    return;
    
    // Original code commented out for when API is ready
    /*
    const profile = loadUserData('profile') || {};
    
    if (!profile.zipCode) {
      alert('Please set your ZIP code in profile settings first');
      return;
    }

    setProcessingWalmart(true);
    try {
      const sections = shoppingList.shoppingList?.sections || shoppingList.sections || [];
      const result = await processShoppingList(sections, profile.zipCode);
      
      setWalmartCart(result);
      
      if (result.cartUrl && result.cartUrl !== 'https://www.walmart.com/cart') {
        window.open(result.cartUrl, '_blank');
      } else {
        alert('No items could be matched to Walmart products. Try regenerating your meal plan to get Walmart product IDs.');
      }
    } catch (error) {
      console.error('Error processing Walmart cart:', error);
      alert('Failed to create Walmart cart. Please try again.');
    } finally {
      setProcessingWalmart(false);
    }
    */
  };

  if (!shoppingList) {
    return (
      <div className="shopping-list-container">
        <h2>Shopping List</h2>
        <p className="empty-message">
          No shopping list available. Generate a meal plan first!
        </p>
      </div>
    );
  }

  const sections = shoppingList.shoppingList?.sections || 
                   shoppingList.sections || 
                   [];

  return (
    <div className="shopping-list-container">
      <div className="walmart-notice" style={{
        backgroundColor: '#e8f4fd',
        border: '1px solid #0071ce',
        borderRadius: '8px',
        padding: '15px',
        marginBottom: '20px',
        fontSize: '14px',
        lineHeight: '1.5'
      }}>
        <div style={{ marginBottom: '10px', fontWeight: 'bold', color: '#0071ce' }}>
          🛒 Walmart Shopping Tips
        </div>
        <div style={{ color: '#555' }}>
          • <strong>Sign in to Walmart.com first!</strong> Your cart will save between tabs<br/>
          • <strong>Click any item</strong> to search for it on Walmart.com<br/>
          • <strong>Check the box</strong> to mark items you've added to your cart<br/>
          • Prices shown are estimates and will be accurate once Walmart API integration is complete<br/>
          • Soon: Your entire shopping list will automatically sync to Walmart's app with one click!
        </div>
      </div>
      
      <h2>Shopping List</h2>
      
      <div className="list-header">
        <div className="budget-info">
          <span>Total: ${shoppingList.totalCost?.toFixed(2) || '0.00'}</span>
          <span>Budget: ${shoppingList.weeklyBudget || '100.00'}</span>
        </div>
        <button
          onClick={handlePrint}
          className="print-btn"
          style={{
            padding: '8px 16px',
            fontSize: '14px',
            fontWeight: 'bold',
            color: '#333',
            backgroundColor: '#f0f0f0',
            border: '1px solid #ddd',
            borderRadius: '6px',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '5px'
          }}
        >
          🖨️ Print List
        </button>
      </div>

      <div className="shopping-sections">
        {sections.map((section, sectionIdx) => (
          <div key={sectionIdx} className="category-section">
            <h3>{section.category}</h3>
            <div className="items-list">
              {section.items.map((item, idx) => {
                const itemId = getItemId(section.category, idx);
                const isChecked = checkedItems[itemId];
                
                return (
                  <div 
                    key={idx} 
                    className={`shopping-item ${isChecked ? 'checked' : ''}`}
                    style={{ 
                      display: 'flex', 
                      alignItems: 'center',
                      cursor: 'pointer'
                    }}
                  >
                    <input 
                      type="checkbox" 
                      checked={isChecked || false}
                      onChange={() => toggleItem(itemId)}
                      onClick={(e) => e.stopPropagation()}
                      style={{ 
                        marginRight: '10px',
                        cursor: 'pointer'
                      }}
                    />
                    <a
                      href={`https://www.walmart.com/search?q=${encodeURIComponent(item.name)}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="item-details"
                      style={{ 
                        flex: 1,
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        textDecoration: 'none',
                        color: 'inherit',
                        padding: '5px'
                      }}
                      title={`Search Walmart for: ${item.name}`}
                    >
                      <span className="item-name">
                        {item.quantity} {item.unit} {item.name}
                      </span>
                      <span className="item-price">
                        ${item.estimatedPrice?.toFixed(2) || '0.00'}
                      </span>
                    </a>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      {shoppingList.moneySavingTips && shoppingList.moneySavingTips.length > 0 && (
        <div className="tips-section">
          <h3>💡 Money Saving Tips</h3>
          <ul>
            {shoppingList.moneySavingTips.map((tip, idx) => (
              <li key={idx}>{tip}</li>
            ))}
          </ul>
        </div>
      )}

      <div className="walmart-section" style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '15px',
        marginTop: '30px'
      }}>
        <button
          onClick={handleAddToWalmartCart}
          disabled={processingWalmart}
          className="walmart-cart-btn"
          style={{
            padding: '12px 24px',
            fontSize: '16px',
            fontWeight: 'bold',
            color: 'white',
            backgroundColor: '#0071ce',
            border: 'none',
            borderRadius: '8px',
            cursor: processingWalmart ? 'not-allowed' : 'pointer',
            opacity: processingWalmart ? 0.6 : 1,
          }}
        >
          {processingWalmart ? 'Processing...' : '🛒 Order from Walmart (Coming Soon)'}
        </button>
        
        <button
          onClick={handleAddToPantry}
          disabled={addingToPantry}
          className="add-to-pantry-btn"
          style={{
            padding: '12px 24px',
            fontSize: '16px',
            fontWeight: 'bold',
            color: 'white',
            backgroundColor: '#4CAF50',
            border: 'none',
            borderRadius: '8px',
            cursor: addingToPantry ? 'not-allowed' : 'pointer',
            opacity: addingToPantry ? 0.6 : 1,
          }}
        >
          {addingToPantry ? 'Adding...' : '📦 Add Shopping List to Pantry (After Ordering)'}
        </button>
        
        {walmartCart && (
          <div className="walmart-results">
            <p>{walmartCart.matchedItems?.length || 0} items matched to Walmart products</p>
            {walmartCart.unmatchedItems?.length > 0 && (
              <p className="unmatched-warning">
                {walmartCart.unmatchedItems.length} items need manual search
              </p>
            )}
          </div>
        )}
      </div>

    </div>
  );
}

export default ShoppingList;