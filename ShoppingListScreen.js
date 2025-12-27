import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

export default function ShoppingListScreen({ onBack }) {
  const [shoppingList, setShoppingList] = useState(null);
  const [loading, setLoading] = useState(true);
  const [userProfile, setUserProfile] = useState(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [listData, profileData] = await Promise.all([
        AsyncStorage.getItem('@weekly_dish_shopping_list'),
        AsyncStorage.getItem('@weekly_dish_user_profile')
      ]);
      
      console.log('Raw shopping list data from storage:', listData ? 'Found' : 'Not found');
      
      if (profileData) {
        setUserProfile(JSON.parse(profileData));
      }
      
      if (listData) {
        const list = JSON.parse(listData);
        console.log('Parsed shopping list structure:', Object.keys(list));
        console.log('Has sections?', list.sections ? 'Yes' : 'No');
        console.log('Has shoppingList?', list.shoppingList ? 'Yes' : 'No');
        if (list.sections) {
          console.log('Number of sections:', list.sections.length);
        }
        setShoppingList(list);
      } else {
        console.log('No shopping list found in storage');
      }
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  };

  // Refresh list when screen comes into focus
  useEffect(() => {
    const interval = setInterval(() => {
      loadData();
    }, 2000); // Check every 2 seconds for updates

    return () => clearInterval(interval);
  }, []);

  if (loading) {
    return (
      <View style={styles.container}>
        <TouchableOpacity onPress={onBack}>
          <Text style={styles.backButton}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Shopping List</Text>
        <View style={styles.centerContent}>
          <ActivityIndicator size="large" color="#3498db" />
        </View>
      </View>
    );
  }

  if (!shoppingList) {
    return (
      <View style={styles.container}>
        <TouchableOpacity onPress={onBack}>
          <Text style={styles.backButton}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Shopping List</Text>
        
        <View style={styles.emptyState}>
          <Text style={styles.emptyText}>No shopping list yet</Text>
          <Text style={styles.emptySubtext}>
            Generate a meal plan and accept it to create your shopping list
          </Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <TouchableOpacity onPress={onBack}>
        <Text style={styles.backButton}>← Back</Text>
      </TouchableOpacity>
      
      <Text style={styles.title}>Shopping List</Text>
      
      <ScrollView style={styles.listContainer}>
        {/* Debug info */}
        {console.log('Rendering shopping list, sections:', shoppingList.sections?.length || 0)}
        
        {/* Handle both structures: sections array or shoppingList object */}
        {shoppingList.sections && shoppingList.sections.length > 0 ? (
          shoppingList.sections.map((section, index) => {
            console.log(`Rendering section ${index}:`, section.category, 'with', section.items?.length || 0, 'items');
            return (
              <View key={index} style={styles.section}>
                <Text style={styles.sectionTitle}>{section.category}</Text>
                {section.items?.map((item, itemIndex) => (
                  <View key={itemIndex} style={styles.item}>
                    <View style={styles.itemInfo}>
                      <Text style={styles.itemName}>
                        {item.quantity || item.amount} {item.unit || ''} {item.name || item.item}
                      </Text>
                    </View>
                    <Text style={styles.itemPrice}>
                      ${(() => {
                        let price = item.price || item.estimatedPrice || item.cost || 0;
                        // Handle string prices like "$11.97"
                        if (typeof price === 'string') {
                          price = parseFloat(price.replace('$', '').replace(',', ''));
                        }
                        return !isNaN(price) && price > 0 ? price.toFixed(2) : '0.00';
                      })()}
                    </Text>
                  </View>
                ))}
              </View>
            );
          })
        ) : (
          <View style={styles.emptyState}>
            <Text style={styles.emptyText}>Shopping list is empty</Text>
            <Text style={styles.emptySubtext}>Sections found: {shoppingList.sections?.length || 0}</Text>
          </View>
        )}
        
        <View style={styles.totalSection}>
          <Text style={styles.totalText}>
            Total: ${(() => {
              // First try to calculate from individual items (most accurate)
              let calculatedTotal = 0;
              if (shoppingList.sections && shoppingList.sections.length > 0) {
                shoppingList.sections.forEach(section => {
                  if (section.items) {
                    section.items.forEach(item => {
                      let itemPrice = item.price || item.estimatedPrice || item.cost || 0;
                      if (typeof itemPrice === 'string') {
                        itemPrice = parseFloat(itemPrice.replace('$', '').replace(',', ''));
                      }
                      if (!isNaN(itemPrice)) {
                        calculatedTotal += itemPrice;
                      }
                    });
                  }
                });
              }
              
              // Use calculated total if we have it
              if (calculatedTotal > 0) {
                console.log('ShoppingListScreen using calculated total:', calculatedTotal);
                return calculatedTotal.toFixed(2);
              }
              
              // Otherwise fall back to provided total
              let total = shoppingList.totals?.estimatedCost || shoppingList.totalCost || shoppingList.totalEstimatedCost || shoppingList.totals?.estimatedTotal || 0;
              if (typeof total === 'string') {
                total = parseFloat(total.replace('$', '').replace(',', ''));
              }
              return !isNaN(total) && total > 0 ? total.toFixed(2) : '0.00';
            })()}
          </Text>
          {userProfile && (
            <>
              <Text style={styles.budgetText}>
                Budget: ${userProfile.weeklyBudget}
              </Text>
              {(() => {
                // Calculate total from items (same as above)
                let calculatedTotal = 0;
                if (shoppingList.sections && shoppingList.sections.length > 0) {
                  shoppingList.sections.forEach(section => {
                    if (section.items) {
                      section.items.forEach(item => {
                        let itemPrice = item.price || item.estimatedPrice || item.cost || 0;
                        if (typeof itemPrice === 'string') {
                          itemPrice = parseFloat(itemPrice.replace('$', '').replace(',', ''));
                        }
                        if (!isNaN(itemPrice)) {
                          calculatedTotal += itemPrice;
                        }
                      });
                    }
                  });
                }
                
                // Use calculated or fall back to provided total
                let total = calculatedTotal > 0 ? calculatedTotal : 0;
                if (total === 0) {
                  let providedTotal = shoppingList.totalCost || shoppingList.totalEstimatedCost || 0;
                  if (typeof providedTotal === 'string') {
                    providedTotal = parseFloat(providedTotal.replace('$', '').replace(',', ''));
                  }
                  total = providedTotal;
                }
                
                const budget = parseFloat(userProfile.weeklyBudget);
                const isUnderBudget = total <= budget;
                const difference = Math.abs(budget - total);
                
                return (
                  <Text style={[styles.budgetStatus, isUnderBudget ? styles.underBudget : styles.overBudget]}>
                    {isUnderBudget ? `✓ Within Budget ($${difference.toFixed(2)} under)` : `⚠ Over Budget ($${difference.toFixed(2)} over)`}
                  </Text>
                );
              })()}
            </>
          )}
        </View>
        
        {(shoppingList.moneySavingTips || shoppingList.savingTips) && (
          <View style={styles.tipsSection}>
            <Text style={styles.tipsTitle}>Money-Saving Tips</Text>
            {(() => {
              const tips = shoppingList.moneySavingTips || shoppingList.savingTips;
              
              if (Array.isArray(tips)) {
                return tips.map((tip, index) => (
                  <Text key={index} style={styles.tipsText}>• {tip}</Text>
                ));
              } else if (typeof tips === 'object') {
                // Handle object format (tip1, tip2, etc.)
                return Object.values(tips).map((tip, index) => (
                  <Text key={index} style={styles.tipsText}>• {tip}</Text>
                ));
              } else if (typeof tips === 'string') {
                return <Text style={styles.tipsText}>{tips}</Text>;
              }
              return null;
            })()}
          </View>
        )}
      </ScrollView>
      
      <TouchableOpacity style={styles.walmartButton}>
        <Text style={styles.walmartButtonText}>Add to Walmart Cart</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
    padding: 20,
  },
  backButton: {
    fontSize: 16,
    color: '#3498db',
    marginBottom: 20,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#2c3e50',
    marginBottom: 20,
  },
  centerContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 30,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#7f8c8d',
    textAlign: 'center',
    marginBottom: 10,
  },
  emptySubtext: {
    fontSize: 14,
    color: '#95a5a6',
    textAlign: 'center',
  },
  listContainer: {
    flex: 1,
  },
  section: {
    backgroundColor: '#fff',
    padding: 15,
    borderRadius: 8,
    marginBottom: 10,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#27ae60',
    marginBottom: 10,
  },
  item: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#ecf0f1',
  },
  itemInfo: {
    flex: 1,
  },
  itemName: {
    fontSize: 14,
    color: '#2c3e50',
  },
  itemPrice: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#34495e',
  },
  totalSection: {
    backgroundColor: '#2c3e50',
    padding: 20,
    borderRadius: 8,
    marginTop: 10,
    marginBottom: 10,
  },
  totalText: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 5,
  },
  budgetText: {
    fontSize: 14,
    color: '#ecf0f1',
    marginBottom: 5,
  },
  budgetStatus: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  underBudget: {
    color: '#2ecc71',
  },
  overBudget: {
    color: '#e74c3c',
  },
  tipsSection: {
    backgroundColor: '#e8f5e9',
    padding: 15,
    borderRadius: 8,
    marginBottom: 20,
  },
  tipsTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#27ae60',
    marginBottom: 5,
  },
  tipsText: {
    fontSize: 14,
    color: '#2e7d32',
    lineHeight: 20,
  },
  walmartButton: {
    backgroundColor: '#0071ce',
    padding: 15,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 10,
  },
  walmartButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
});