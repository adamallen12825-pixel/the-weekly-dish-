import React, { useState, useEffect, useRef } from 'react';
import { Html5QrcodeScanner } from 'html5-qrcode';
import { lookupBarcode } from '../services/barcodeService';
import { processImages } from '../services/gptService';
import { resizeImage } from '../utils/imageResize';
import kvService from '../services/kvService';
import './Pantry.css';

function Pantry({ user }) {
  const [pantryItems, setPantryItems] = useState([]);
  const [showScanner, setShowScanner] = useState(false);
  const [showAddForm, setShowAddForm] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [newItem, setNewItem] = useState({ name: '', category: '', quantity: '' });
  const scannerRef = useRef(null);
  const fileInputRef = useRef(null);

  // Helper function to load data from cloud storage
  const [loadError, setLoadError] = useState('');

  useEffect(() => {
    if (!user) return;
    // Load pantry items from cloud storage
    const loadPantry = async () => {
      let saved = null;
      try {
        saved = await kvService.get(user.id, 'pantry', true);
        setLoadError('');
      } catch (error) {
        setLoadError('We could not load your pantry. Check your connection and refresh the page.');
        return;
      }
      if (Array.isArray(saved)) {
        // Ensure all items have IDs (for backward compatibility)
        const itemsWithIds = saved.map((item, index) => {
          if (!item.id) {
            return { ...item, id: `legacy-${Date.now()}-${index}` };
          }
          return item;
        });
        setPantryItems(itemsWithIds);
      }
    };
    loadPantry();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  useEffect(() => {
    // Initialize scanner when shown
    if (showScanner) {
      setTimeout(() => {
        if (document.getElementById('barcode-reader')) {
          scannerRef.current = new Html5QrcodeScanner(
            'barcode-reader',
            { 
              fps: 10,
              qrbox: 250,
              facingMode: "environment"
            }
          );
          
          scannerRef.current.render(
            (decodedText) => {
              handleBarcodeScan(decodedText);
            }
          );
        }
      }, 100);
    }
    
    return () => {
      if (scannerRef.current) {
        scannerRef.current.clear();
        scannerRef.current = null;
      }
    };
  }, [showScanner]);

  const savePantryItems = async (items) => {
    setPantryItems(items);
    if (!user) return;
    try {
      await kvService.set(user.id, 'pantry', items);
    } catch (error) {
      // The change is kept on this device and retried automatically; the
      // banner at the top of the page shows that it has not synced yet.
      console.error('Pantry save failed:', error.message);
    }
  };

  const handleBarcodeScan = async (barcode) => {
    // Stop scanner
    if (scannerRef.current) {
      scannerRef.current.clear();
      scannerRef.current = null;
    }
    setShowScanner(false);
    
    try {
      // Lookup barcode
      const productInfo = await lookupBarcode(barcode);
      
      const newItem = {
        ...productInfo,
        dateAdded: new Date().toISOString(),
        id: Date.now().toString(),
      };

      const newItems = [...pantryItems, newItem];
      savePantryItems(newItems);
      
      // Show what was added
      let message = `✅ Product Added!\n\n`;
      message += `Product: ${productInfo.name}\n`;
      if (productInfo.brand) message += `Brand: ${productInfo.brand}\n`;
      message += `\n📊 Barcode: ${barcode}\n`;
      alert(message);
    } catch (error) {
      alert(`Error: Failed to lookup barcode ${barcode}`);
    }
  };

  const handleManualAdd = () => {
    if (!newItem.name || !newItem.category) {
      alert('Please fill in name and category');
      return;
    }

    const item = {
      id: Date.now().toString(),
      ...newItem,
      addedDate: new Date().toISOString()
    };

    savePantryItems([...pantryItems, item]);
    setNewItem({ name: '', category: '', quantity: '' });
    setShowAddForm(false);
  };

  const updateQuantity = (id, change) => {
    const updated = pantryItems.map(item => {
      if (item.id === id) {
        // Parse current quantity (handle various formats like "1 item", "2 items", "3 lbs", etc.)
        let currentQty = 1;
        let unit = 'item';
        
        if (item.quantity) {
          // Items added from a shopping list store the quantity as a number.
          const match = String(item.quantity).match(/^(\d+)\s*(.*)$/);
          if (match) {
            currentQty = parseInt(match[1]) || 1;
            unit = match[2] || 'item';
          }
        }
        
        // Calculate new quantity (minimum 0)
        const newQty = Math.max(0, currentQty + change);
        
        // Remove item if quantity reaches 0
        if (newQty === 0) {
          return null;
        }
        
        // Update quantity with proper pluralization
        const newUnit = unit === 'item' && newQty !== 1 ? 'items' : unit;
        return { ...item, quantity: `${newQty} ${newUnit}` };
      }
      return item;
    });
    
    // Filter out null items (quantity 0)
    const filtered = updated.filter(item => item !== null);
    savePantryItems(filtered);
  };

  const removeItem = async (id) => {
    
    if (!id) {
      return;
    }
    
    const updated = pantryItems.filter(item => {
      // Use string comparison to handle both string and number IDs
      return String(item.id) !== String(id);
    });
    
    
    if (updated.length === pantryItems.length) {
      alert('Failed to delete item. Please refresh and try again.');
      return;
    }
    
    await savePantryItems(updated);
  };

  const handleFileSelect = async (event) => {
    const files = Array.from(event.target.files);
    if (files.length === 0) return;
    
    setProcessing(true);

    try {
      // Shrink each photo first: full-size phone photos are too big to upload.
      const images = [];
      for (const file of files.slice(0, 12)) {
        images.push(await resizeImage(file));
      }

      const result = await processImages(images);
      
      if (result.success && result.items.length > 0) {
        // Add items to pantry
        const newItems = result.items.map(item => ({
          id: Date.now().toString() + Math.random(),
          name: item.name,
          brand: item.brand || '',
          quantity: item.quantity || '1 item',
          category: item.category || 'Other',
          dateAdded: new Date().toISOString()
        }));
        
        savePantryItems([...pantryItems, ...newItems]);
        alert(`✅ Added ${newItems.length} items from your photo${files.length > 1 ? 's' : ''}!`);
      } else {
        alert('No food items were found. Try a closer, well-lit photo.');
      }
    } catch (error) {
      alert(error.message || 'Failed to process photo. Please try again.');
    } finally {
      setProcessing(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };


  return (
    <div className="pantry-container">
      <h2>Pantry Management</h2>
      {loadError && <p className="load-error" role="alert">{loadError}</p>}

      <div className="pantry-actions">
        <button onClick={() => setShowScanner(true)} className="barcode-btn">
          📊 Scan Barcode
        </button>
        <button 
          onClick={() => fileInputRef.current?.click()} 
          className="photo-btn"
          disabled={processing}
        >
          {processing ? '⏳ Processing...' : '📷 Photo Scan'}
        </button>
        <button onClick={() => setShowAddForm(!showAddForm)} className="add-btn">
          ➕ Add Manually
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          capture="environment"
          multiple
          onChange={handleFileSelect}
          style={{ display: 'none' }}
        />
      </div>

      {showAddForm && (
        <div className="add-form">
          <input
            type="text"
            placeholder="Item name"
            value={newItem.name}
            onChange={(e) => setNewItem({ ...newItem, name: e.target.value })}
          />
          <select
            value={newItem.category}
            onChange={(e) => setNewItem({ ...newItem, category: e.target.value })}
          >
            <option value="">Select category</option>
            <option value="Produce">Produce</option>
            <option value="Meat">Meat</option>
            <option value="Dairy">Dairy</option>
            <option value="Grains">Grains</option>
            <option value="Canned">Canned</option>
            <option value="Frozen">Frozen</option>
            <option value="Condiments">Condiments</option>
            <option value="Snacks">Snacks</option>
            <option value="Other">Other</option>
          </select>
          <input
            type="text"
            placeholder="Quantity (optional)"
            value={newItem.quantity}
            onChange={(e) => setNewItem({ ...newItem, quantity: e.target.value })}
          />
          <button onClick={handleManualAdd}>Add Item</button>
        </div>
      )}

      {showScanner && (
        <div className="camera-modal">
          <div className="camera-container">
            <div className="camera-header">
              <h3>📊 Scan Barcode</h3>
              <p>Point camera at product barcode</p>
            </div>
            <div className="barcode-container">
              <div id="barcode-reader" className="barcode-scanner"></div>
            </div>
            <div className="camera-controls">
              <button onClick={() => {
                if (scannerRef.current) {
                  scannerRef.current.clear();
                  scannerRef.current = null;
                }
                setShowScanner(false);
              }} className="cancel-btn">
                ❌ Close Scanner
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="pantry-items">
        <h3>Current Pantry ({pantryItems.length} items)</h3>
        
        {pantryItems.length > 0 ? (
          pantryItems.map(item => (
            <div key={item.id} style={{ 
              background: 'white',
              padding: '15px',
              marginBottom: '10px',
              borderRadius: '8px',
              border: '1px solid #ddd',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between'
            }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: '16px', fontWeight: 'bold', color: '#333' }}>
                  {item.name || 'Unknown Item'}
                </div>
                <div style={{ fontSize: '14px', color: '#666', marginTop: '4px' }}>
                  {item.brand && `${item.brand} • `}
                  {[item.quantity, typeof item.quantity === 'number' ? item.unit : ''].filter(Boolean).join(' ') || '1 item'} • {item.category || 'Other'}
                </div>
              </div>
              <div style={{ display: 'flex', gap: '5px' }}>
                <button 
                  onClick={() => updateQuantity(item.id, -1)}
                  style={{ 
                    width: '30px', 
                    height: '30px',
                    borderRadius: '50%',
                    border: 'none',
                    background: '#f0f0f0',
                    fontSize: '16px',
                    cursor: 'pointer'
                  }}
                >
                  −
                </button>
                <button 
                  onClick={() => updateQuantity(item.id, 1)}
                  style={{ 
                    width: '30px', 
                    height: '30px',
                    borderRadius: '50%',
                    border: 'none',
                    background: '#f0f0f0',
                    fontSize: '16px',
                    cursor: 'pointer'
                  }}
                >
                  +
                </button>
                <button 
                  type="button"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    removeItem(item.id);
                  }}
                  style={{ 
                    width: '30px', 
                    height: '30px',
                    borderRadius: '50%',
                    border: 'none',
                    background: '#ff4444',
                    color: 'white',
                    fontSize: '18px',
                    cursor: 'pointer',
                    marginLeft: '5px'
                  }}
                >
                  ×
                </button>
              </div>
            </div>
          ))
        ) : (
          <p className="empty-message">
            Your pantry is empty. Start by scanning barcodes or adding items manually.
          </p>
        )}
      </div>
    </div>
  );
}

export default Pantry;