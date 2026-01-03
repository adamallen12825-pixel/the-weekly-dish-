import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Image,
  ScrollView,
  Alert
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import PantryScreen from './PantryScreen';
import UserCounter from './UserCounter';

const STORAGE_KEYS = {
  PANTRY_SETUP_COMPLETE: '@weekly_dish_pantry_setup_complete',
};

export default function PantrySetupScreen({ onComplete, onSkip }) {
  const [showPantryScreen, setShowPantryScreen] = useState(false);

  const completePantrySetup = async () => {
    try {
      await AsyncStorage.setItem(STORAGE_KEYS.PANTRY_SETUP_COMPLETE, 'true');
      onComplete();
    } catch (error) {
      console.error('Error saving pantry setup:', error);
    }
  };

  const skipForLater = () => {
    Alert.alert(
      'Skip Pantry Setup?',
      'You can set up your pantry later from the main menu. Without pantry data, meal plans may suggest items you already have.',
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Skip for Now', 
          onPress: async () => {
            await AsyncStorage.setItem(STORAGE_KEYS.PANTRY_SETUP_COMPLETE, 'skipped');
            onSkip();
          }
        }
      ]
    );
  };

  if (showPantryScreen) {
    return (
      <PantryScreen 
        onBack={() => {
          completePantrySetup();
        }}
        isSetupMode={true}
        onFinishSetup={completePantrySetup}
      />
    );
  }

  return (
    <View style={{flex: 1}}>
      <UserCounter />
      <ScrollView contentContainerStyle={styles.container}>
      <Image source={require('./assets/logo.png')} style={styles.logo} />
      
      <Text style={styles.title}>Set Up Your Pantry</Text>
      <Text style={styles.subtitle}>
        Let's quickly scan what you already have at home
      </Text>

      <View style={styles.benefitsContainer}>
        <Text style={styles.benefitHeader}>Why this is important:</Text>
        
        <View style={styles.benefitItem}>
          <Text style={styles.benefitIcon}>💰</Text>
          <View style={styles.benefitText}>
            <Text style={styles.benefitTitle}>Save Money</Text>
            <Text style={styles.benefitDescription}>
              Never buy items you already have at home
            </Text>
          </View>
        </View>

        <View style={styles.benefitItem}>
          <Text style={styles.benefitIcon}>🎯</Text>
          <View style={styles.benefitText}>
            <Text style={styles.benefitTitle}>Smart Meal Plans</Text>
            <Text style={styles.benefitDescription}>
              Get recipes that use what's in your pantry first
            </Text>
          </View>
        </View>

        <View style={styles.benefitItem}>
          <Text style={styles.benefitIcon}>⏱️</Text>
          <View style={styles.benefitText}>
            <Text style={styles.benefitTitle}>Track Expiration</Text>
            <Text style={styles.benefitDescription}>
              Never waste food - use items before they expire
            </Text>
          </View>
        </View>
      </View>

      <View style={styles.instructionsContainer}>
        <Text style={styles.instructionsHeader}>Quick Setup (2-3 minutes):</Text>
        <Text style={styles.instruction}>1. Take photos of your pantry shelves</Text>
        <Text style={styles.instruction}>2. Scan barcodes for accurate products</Text>
        <Text style={styles.instruction}>3. Items are identified automatically</Text>
        <Text style={styles.instruction}>4. Verify any items that need confirmation</Text>
      </View>

      <TouchableOpacity 
        style={styles.primaryButton}
        onPress={() => setShowPantryScreen(true)}
      >
        <Text style={styles.primaryButtonText}>Start Pantry Setup</Text>
      </TouchableOpacity>

      <TouchableOpacity 
        style={styles.skipButton}
        onPress={skipForLater}
      >
        <Text style={styles.skipButtonText}>Skip for Later</Text>
      </TouchableOpacity>

      <Text style={styles.disclaimer}>
        You can always update your pantry later from the main menu
      </Text>
    </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    backgroundColor: '#f5f5f5',
    padding: 20,
    paddingTop: 50,
    alignItems: 'center',
  },
  logo: {
    width: 120,
    height: 120,
    marginBottom: 20,
    resizeMode: 'contain',
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#2c3e50',
    marginBottom: 10,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 16,
    color: '#7f8c8d',
    marginBottom: 30,
    textAlign: 'center',
    paddingHorizontal: 20,
  },
  benefitsContainer: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 20,
    marginBottom: 20,
    width: '100%',
    elevation: 2,
  },
  benefitHeader: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#2c3e50',
    marginBottom: 15,
  },
  benefitItem: {
    flexDirection: 'row',
    marginBottom: 15,
    alignItems: 'center',
  },
  benefitIcon: {
    fontSize: 24,
    marginRight: 15,
  },
  benefitText: {
    flex: 1,
  },
  benefitTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#2c3e50',
    marginBottom: 2,
  },
  benefitDescription: {
    fontSize: 14,
    color: '#7f8c8d',
  },
  instructionsContainer: {
    backgroundColor: '#ebf5fb',
    borderRadius: 12,
    padding: 20,
    marginBottom: 30,
    width: '100%',
  },
  instructionsHeader: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#2c3e50',
    marginBottom: 10,
  },
  instruction: {
    fontSize: 14,
    color: '#34495e',
    marginBottom: 5,
    paddingLeft: 10,
  },
  primaryButton: {
    backgroundColor: '#27ae60',
    paddingVertical: 16,
    paddingHorizontal: 40,
    borderRadius: 8,
    marginBottom: 15,
    width: '100%',
    elevation: 3,
  },
  primaryButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  skipButton: {
    paddingVertical: 12,
    paddingHorizontal: 30,
    marginBottom: 20,
  },
  skipButtonText: {
    color: '#95a5a6',
    fontSize: 16,
    textDecorationLine: 'underline',
  },
  disclaimer: {
    fontSize: 12,
    color: '#95a5a6',
    textAlign: 'center',
    fontStyle: 'italic',
  },
});