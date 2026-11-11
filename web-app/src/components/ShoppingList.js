import React, { useState, useEffect, useMemo, useCallback } from 'react';
import kvService from '../services/kvService';
import './ShoppingList.css';

// Walmart has no public way to fill a cart from another site without their
// API approval, so the fastest honest route is a guided "Shop Mode": one tap
// opens each item's Walmart search (in the Walmart app on a phone), one tap
// confirms it, and progress is saved to the account so a list planned on a
// computer can be shopped from a phone.
const WALMART_TAB = 'weekly-dish-walmart';

const walmartUrl = (item) =>
  `https://www.walmart.com/search?q=${encodeURIComponent(item.searchTerm || item.name || '')}`;

const itemKey = (category, item) => `${category}|${item.name}`;

const quantityLabel = (item) => [item.quantity, item.unit].filter((v) => v !== undefined && v !== '').join(' ');

// "3 lb Bananas" for things bought by weight or count, and
// "2 × Chicken Thighs Family Pack (4.7 lb pack)" for packaged products.
const SIMPLE_UNIT = /^[a-z.]{1,8}$/i;
function itemParts(item) {
  const name = item.name || '';
  const unit = String(item.unit || '').trim();
  const quantity = item.quantity === undefined || item.quantity === '' ? 1 : item.quantity;
  if (unit && SIMPLE_UNIT.test(unit) && !name.toLowerCase().includes(unit.toLowerCase())) {
    return { lead: `${quantity} ${unit}`, name, detail: '' };
  }
  const repeated = !unit || name.toLowerCase().includes(unit.toLowerCase());
  return { lead: Number(quantity) === 1 ? '' : `${quantity} ×`, name, detail: repeated ? '' : unit };
}
const itemLabel = (item) => {
  const { lead, name, detail } = itemParts(item);
  return `${lead ? `${lead} ` : ''}${name}${detail ? ` (${detail})` : ''}`;
};

function ShoppingList({ user }) {
  const [shoppingList, setShoppingList] = useState(null);
  const [checkedItems, setCheckedItems] = useState({});
  const [addingToPantry, setAddingToPantry] = useState(false);
  const [loadError, setLoadError] = useState('');
  const [shopMode, setShopMode] = useState(false);
  const [position, setPosition] = useState(0);
  const [opened, setOpened] = useState(false);

  const sections = useMemo(
    () => (shoppingList ? shoppingList.shoppingList?.sections || shoppingList.sections || [] : []),
    [shoppingList]
  );

  // Every item in store order, for Shop Mode.
  const allItems = useMemo(
    () =>
      sections.flatMap((section) =>
        (section.items || []).map((item) => ({ ...item, category: section.category, key: itemKey(section.category, item) }))
      ),
    [sections]
  );

  // Identifies this particular list, so ticks from an older list are not reused.
  const listId = useMemo(
    () => (shoppingList ? shoppingList.generatedAt || `${allItems.length}:${shoppingList.totalCost}` : ''),
    [shoppingList, allItems.length]
  );

  useEffect(() => {
    if (!user) return;
    const loadData = async () => {
      try {
        const [storedList, progress] = await Promise.all([
          kvService.get(user.id, 'currentShoppingList', true),
          kvService.get(user.id, 'shoppingProgress', true),
        ]);
        setLoadError('');
        if (storedList) {
          setShoppingList(storedList);
          const id = storedList.generatedAt || '';
          if (progress && progress.listId === id && progress.checked) setCheckedItems(progress.checked);
        }
      } catch (error) {
        setLoadError('We could not load your shopping list. Check your connection and refresh the page.');
      }
    };
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  const saveProgress = useCallback(
    (checked) => {
      if (!user || !listId) return;
      kvService.set(user.id, 'shoppingProgress', { listId, checked }).catch(() => {});
    },
    [user, listId]
  );

  const setChecked = (key, value) => {
    setCheckedItems((prev) => {
      const next = { ...prev };
      if (value) next[key] = true;
      else delete next[key];
      saveProgress(next);
      return next;
    });
  };

  const remaining = allItems.filter((item) => !checkedItems[item.key]);
  const doneCount = allItems.length - remaining.length;

  // --- Shop Mode -----------------------------------------------------------

  const startShopMode = () => {
    const firstUnchecked = allItems.findIndex((item) => !checkedItems[item.key]);
    setPosition(firstUnchecked === -1 ? 0 : firstUnchecked);
    setOpened(false);
    setShopMode(true);
  };

  const goTo = (index) => {
    setPosition(Math.max(0, Math.min(allItems.length - 1, index)));
    setOpened(false);
  };

  const openAtWalmart = (item) => {
    // One named tab is reused for every item so a desktop browser does not
    // fill up with tabs. The opener link is cut so the other site cannot
    // reach back into this page.
    const tab = window.open(walmartUrl(item), WALMART_TAB);
    if (tab) tab.opener = null;
    setOpened(true);
  };

  // Tick the item (or skip it) and move to the next one that is not done.
  // Skipped items come round again after the end of the list.
  const markAndAdvance = (item, added) => {
    const checked = added ? { ...checkedItems, [item.key]: true } : checkedItems;
    if (added) {
      setCheckedItems(checked);
      saveProgress(checked);
    }
    setOpened(false);

    for (let step = 1; step < allItems.length; step += 1) {
      const index = (position + step) % allItems.length;
      if (!checked[allItems[index].key]) {
        setPosition(index);
        return;
      }
    }
    // Nothing else is left.
    if (checked[item.key]) setPosition(allItems.length); // finished screen
    else setShopMode(false);
  };

  // --- other actions -------------------------------------------------------

  const listAsText = () =>
    sections
      .map(
        (section) =>
          `${section.category}\n${(section.items || [])
            .map((item) => `- ${itemLabel(item)}`)
            .join('\n')}`
      )
      .join('\n\n');

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(listAsText());
      alert('Shopping list copied.');
    } catch {
      alert('Copy failed on this browser. Use Print instead.');
    }
  };

  const handleSendToPhone = async () => {
    const url = `${window.location.origin}/dashboard?tab=shopping`;
    if (navigator.share) {
      try {
        await navigator.share({ title: 'My Weekly Dish shopping list', text: listAsText(), url });
      } catch {
        // The share sheet was dismissed.
      }
    } else {
      handleCopy();
    }
  };

  const handleAddToPantry = async () => {
    if (!shoppingList) return;
    setAddingToPantry(true);
    try {
      const currentPantry = (await kvService.get(user.id, 'pantry', true)) || [];
      const stamp = Date.now();
      const newPantryItems = allItems.map((item, index) => ({
        id: `${stamp}-${index}`,
        name: item.name,
        category: item.category,
        quantity: quantityLabel(item) || '1',
        dateAdded: new Date().toISOString(),
        fromShoppingList: true,
      }));

      await kvService.set(user.id, 'pantry', [...currentPantry, ...newPantryItems]);
      await kvService.delete(user.id, 'currentShoppingList');
      await kvService.delete(user.id, 'shoppingProgress');
      setShoppingList(null);
      setCheckedItems({});
      alert(`✅ Added ${newPantryItems.length} items to your pantry.\n\nYour shopping list has been cleared.`);
    } catch (error) {
      alert('We could not add the items to your pantry. Please try again.');
    } finally {
      setAddingToPantry(false);
    }
  };

  if (loadError) {
    return (
      <div className="shopping-list-container">
        <h2>Shopping List</h2>
        <p className="load-error" role="alert">{loadError}</p>
      </div>
    );
  }

  if (!shoppingList) {
    return (
      <div className="shopping-list-container">
        <h2>Shopping List</h2>
        <p className="empty-message">No shopping list yet. Generate and accept a meal plan first!</p>
      </div>
    );
  }

  const total = Number(shoppingList.totalCost) || 0;
  const budget = Number(shoppingList.weeklyBudget) || 0;
  const overBy = budget > 0 ? total - budget : 0;
  const current = allItems[position];

  return (
    <div className="shopping-list-container">
      <h2>Shopping List</h2>

      <div className="list-header">
        <div className="budget-info">
          <span>Estimated total: ${total.toFixed(2)}</span>
          <span>Budget: ${budget.toFixed(2)}</span>
        </div>
        {overBy > 0.5 && (
          <p className="over-budget">
            About ${overBy.toFixed(2)} over budget. Swap a pricier meal in your plan, or check the tips below.
          </p>
        )}
        <p className="price-note">Prices are estimates; your Walmart cart shows the real total.</p>
      </div>

      <div className="shop-panel">
        <div className="shop-panel-text">
          <strong>🛒 Walmart Shop Mode</strong>
          <span>
            We line up each item for you. One tap opens it at Walmart{' '}
            (in the Walmart app on your phone), one tap ticks it off. Sign in to Walmart first so your cart is saved.
          </span>
          {doneCount > 0 && (
            <span className="shop-progress-text">
              {doneCount} of {allItems.length} items done
            </span>
          )}
        </div>
        <button className="shop-start-btn" onClick={startShopMode} disabled={allItems.length === 0}>
          {doneCount > 0 && remaining.length > 0 ? 'Continue shopping' : 'Start shopping'}
        </button>
      </div>

      <div className="list-tools">
        <button onClick={handleSendToPhone}>📱 Send to phone</button>
        <button onClick={handleCopy}>📋 Copy list</button>
        <button onClick={() => window.print()}>🖨️ Print</button>
      </div>

      <div className="shopping-sections">
        {sections.map((section) => (
          <div key={section.category} className="category-section">
            <h3>{section.category}</h3>
            <div className="items-list">
              {(section.items || []).map((item) => {
                const key = itemKey(section.category, item);
                const isChecked = Boolean(checkedItems[key]);
                return (
                  <label key={key} className={`shopping-item ${isChecked ? 'checked' : ''}`}>
                    <input type="checkbox" checked={isChecked} onChange={(e) => setChecked(key, e.target.checked)} />
                    <span className="item-name">{itemLabel(item)}</span>
                    <span className="item-price">${(Number(item.estimatedPrice) || 0).toFixed(2)}</span>
                    <a
                      className="item-find"
                      href={walmartUrl(item)}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={(e) => e.stopPropagation()}
                      title={`Find at Walmart: ${item.name}`}
                    >
                      Find
                    </a>
                  </label>
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

      <div className="walmart-section">
        <button onClick={handleAddToPantry} disabled={addingToPantry} className="add-to-pantry-btn">
          {addingToPantry ? 'Adding...' : '📦 Groceries are home: add everything to my pantry'}
        </button>
      </div>

      {shopMode && (
        <div className="shop-mode" role="dialog" aria-modal="true" aria-label="Walmart Shop Mode">
          <div className="shop-mode-card">
            <div className="shop-mode-top">
              <span>
                {current ? `Item ${position + 1} of ${allItems.length}` : 'All done'}
              </span>
              <button className="shop-close" onClick={() => setShopMode(false)} aria-label="Close Shop Mode">
                ✕
              </button>
            </div>
            <div className="shop-bar">
              <div className="shop-bar-fill" style={{ width: `${allItems.length ? (doneCount / allItems.length) * 100 : 0}%` }} />
            </div>

            {current ? (
              <>
                <div className="shop-category">{current.category}</div>
                <div className="shop-item-name">{current.name}</div>
                <div className="shop-item-meta">
                  Buy {quantityLabel(current) || '1'} · about ${(Number(current.estimatedPrice) || 0).toFixed(2)}
                  {checkedItems[current.key] ? ' · ✓ done' : ''}
                </div>

                {!opened ? (
                  <button className="shop-primary" onClick={() => openAtWalmart(current)}>
                    Find at Walmart
                  </button>
                ) : (
                  <>
                    <button className="shop-primary added" onClick={() => markAndAdvance(current, true)}>
                      ✓ Added to cart — next item
                    </button>
                    <button className="shop-link" onClick={() => openAtWalmart(current)}>
                      Open Walmart again
                    </button>
                  </>
                )}

                <div className="shop-secondary">
                  <button onClick={() => goTo(position - 1)} disabled={position === 0}>
                    ← Back
                  </button>
                  <button onClick={() => markAndAdvance(current, true)}>Already have it</button>
                  <button onClick={() => markAndAdvance(current, false)}>Skip →</button>
                </div>
                <p className="shop-hint">
                  Add the item to your Walmart cart, then come back here. Your progress is saved, so you can stop and
                  pick up later on any device.
                </p>
              </>
            ) : (
              <>
                <div className="shop-item-name">🎉 That's everything!</div>
                <p className="shop-hint">Head to your Walmart cart to choose pickup or delivery and check out.</p>
                <a className="shop-primary as-link" href="https://www.walmart.com/cart" target={WALMART_TAB} rel="noopener noreferrer">
                  Open my Walmart cart
                </a>
                <button className="shop-link" onClick={() => setShopMode(false)}>
                  Back to my list
                </button>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default ShoppingList;
