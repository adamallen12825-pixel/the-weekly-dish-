import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
  Alert,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import apiService from './apiService';

export default function QuickMealScreen({ onBack, userProfile }) {
  const [pantryItems, setPantryItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [mealSuggestion, setMealSuggestion] = useState(null);
  const [recipe, setRecipe] = useState(null);

  useEffect(() => {
    loadPantryItems();
  }, []);

  const loadPantryItems = async () => {
    try {
      const items = await AsyncStorage.getItem('@weekly_dish_pantry');
      if (items) {
        setPantryItems(JSON.parse(items));
      }
    } catch (error) {
      console.error('Error loading pantry items:', error);
    }
  };

  const generateMealFromPantry = async () => {
    if (pantryItems.length === 0) {
      Alert.alert('Empty Pantry', 'Please add items to your pantry first');
      return;
    }

    setLoading(true);
    setMealSuggestion(null);
    setRecipe(null);

    try {
      const result = await apiService.generateQuickMeal(pantryItems, userProfile);
      setMealSuggestion(result.meal);
      setRecipe(result.recipe);
    } catch (error) {
      console.error('Error generating meal:', error);
      Alert.alert('Error', 'Failed to generate meal suggestion. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <TouchableOpacity onPress={onBack}>
        <Text style={styles.backButton}>← Back</Text>
      </TouchableOpacity>

      <Text style={styles.title}>Quick Meal from Pantry</Text>
      <Text style={styles.subtitle}>
        Make something delicious with what you have on hand
      </Text>

      <View style={styles.pantryInfo}>
        <Text style={styles.pantryText}>
          You have {pantryItems.length} items in your pantry
        </Text>
        {pantryItems.length > 0 && (
          <Text style={styles.pantryList}>
            Including: {pantryItems.slice(0, 5).map(item => item.name).join(', ')}
            {pantryItems.length > 5 && '...'}
          </Text>
        )}
      </View>

      <TouchableOpacity 
        style={[styles.generateButton, loading && styles.disabledButton]}
        onPress={generateMealFromPantry}
        disabled={loading}
      >
        {loading ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.buttonText}>
            {mealSuggestion ? 'Get Another Suggestion' : 'Get Meal Suggestion'}
          </Text>
        )}
      </TouchableOpacity>

      {mealSuggestion && (
        <ScrollView style={styles.resultContainer} showsVerticalScrollIndicator={false}>
          <View style={styles.mealCard}>
            <Text style={styles.mealTitle}>{mealSuggestion}</Text>
            
            {recipe && (
              <>
                <View style={styles.section}>
                  <Text style={styles.sectionTitle}>Ingredients from Pantry</Text>
                  {recipe.ingredients?.map((item, index) => (
                    <Text key={index} style={styles.ingredient}>
                      • {item}
                    </Text>
                  ))}
                </View>

                <View style={styles.section}>
                  <Text style={styles.sectionTitle}>Quick Instructions</Text>
                  {recipe.instructions?.map((step, index) => (
                    <View key={index} style={styles.instruction}>
                      <Text style={styles.stepNumber}>Step {index + 1}</Text>
                      <Text style={styles.stepText}>{step}</Text>
                    </View>
                  ))}
                </View>

                {recipe.cookTime && (
                  <View style={styles.timeSection}>
                    <Text style={styles.timeText}>⏱ Ready in {recipe.cookTime}</Text>
                  </View>
                )}

                {recipe.servings && (
                  <Text style={styles.servingsText}>Serves {recipe.servings}</Text>
                )}
              </>
            )}
          </View>
        </ScrollView>
      )}
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
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#7f8c8d',
    marginBottom: 20,
  },
  pantryInfo: {
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 8,
    marginBottom: 20,
  },
  pantryText: {
    fontSize: 16,
    color: '#2c3e50',
    fontWeight: '600',
  },
  pantryList: {
    fontSize: 14,
    color: '#7f8c8d',
    marginTop: 8,
  },
  generateButton: {
    backgroundColor: '#f39c12',
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
    marginBottom: 20,
  },
  disabledButton: {
    opacity: 0.6,
  },
  buttonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  resultContainer: {
    flex: 1,
  },
  mealCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 20,
    marginBottom: 20,
  },
  mealTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#2c3e50',
    marginBottom: 20,
    textAlign: 'center',
  },
  section: {
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#34495e',
    marginBottom: 10,
  },
  ingredient: {
    fontSize: 14,
    color: '#555',
    marginBottom: 4,
  },
  instruction: {
    marginBottom: 12,
  },
  stepNumber: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#f39c12',
    marginBottom: 4,
  },
  stepText: {
    fontSize: 14,
    color: '#555',
    lineHeight: 20,
  },
  timeSection: {
    backgroundColor: '#f8f9fa',
    padding: 12,
    borderRadius: 8,
    marginTop: 10,
    alignItems: 'center',
  },
  timeText: {
    fontSize: 16,
    color: '#2c3e50',
    fontWeight: '600',
  },
  servingsText: {
    fontSize: 14,
    color: '#7f8c8d',
    textAlign: 'center',
    marginTop: 10,
  },
});