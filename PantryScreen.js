import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  Alert,
  StyleSheet,
  Modal,
  TextInput,
  FlatList,
  Image,
  ActivityIndicator
} from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system';
import AsyncStorage from '@react-native-async-storage/async-storage';
import apiService from './apiService';
import UserCounter from './UserCounter';

const STORAGE_KEYS = {
  PANTRY_ITEMS: '@weekly_dish_pantry',
  PANTRY_HISTORY: '@weekly_dish_pantry_history',
};

export default function PantryScreen({ onBack, isSetupMode = false, onFinishSetup }) {
  const [pantryItems, setPantryItems] = useState([]);
  const [showCamera, setShowCamera] = useState(false);
  const [showScanner, setShowScanner] = useState(false);
  const [scanMode, setScanMode] = useState('photo'); // 'photo' or 'barcode'
  const [processing, setProcessing] = useState(false);
  const [verificationModal, setVerificationModal] = useState(false);
  const [itemsToVerify, setItemsToVerify] = useState([]);
  const [currentVerifyIndex, setCurrentVerifyIndex] = useState(0);
  const [capturedPhotos, setCapturedPhotos] = useState([]);
  const [showPhotoReview, setShowPhotoReview] = useState(false);
  const [processingProgress, setProcessingProgress] = useState('');
  const cameraRef = useRef(null);
  const [permission, requestPermission] = useCameraPermissions();

  useEffect(() => {
    loadPantryItems();
    if (!permission?.granted) {
      requestPermission();
    }
  }, []);

  const loadPantryItems = async () => {
    try {
      const saved = await AsyncStorage.getItem(STORAGE_KEYS.PANTRY_ITEMS);
      if (saved) {
        setPantryItems(JSON.parse(saved));
      }
    } catch (error) {
      console.error('Error loading pantry:', error);
    }
  };

  const savePantryItems = async (items) => {
    try {
      await AsyncStorage.setItem(STORAGE_KEYS.PANTRY_ITEMS, JSON.stringify(items));
      setPantryItems(items);
    } catch (error) {
      console.error('Error saving pantry:', error);
    }
  };

  const processImagesWithGPT = async (imageUris) => {
    setProcessing(true);
    try {
      console.log(`Processing ${imageUris.length} images...`);
      
      // Convert all images to base64
      const base64Images = await Promise.all(
        imageUris.map(uri => 
          FileSystem.readAsStringAsync(uri, {
            encoding: FileSystem.EncodingType.Base64,
          })
        )
      );

      // Process images one by one with error handling for each
      let allItems = [];
      let successCount = 0;
      let failCount = 0;
      
      for (let i = 0; i < base64Images.length; i++) {
        try {
          const progressText = `Processing image ${i + 1} of ${base64Images.length}...\nThis could take a while, please be patient!`;
          console.log(progressText);
          setProcessingProgress(progressText);
          
          const gptResponse = await apiService.analyzeImage(base64Images[i]);
          console.log(`GPT Response for image ${i + 1}:`, JSON.stringify(gptResponse));
          
          if (gptResponse.items && gptResponse.items.length > 0) {
            console.log(`Found ${gptResponse.items.length} items in image ${i + 1}`);
            allItems = [...allItems, ...gptResponse.items];
            successCount++;
          } else {
            console.log(`No items found in image ${i + 1} - Response:`, gptResponse);
          }
        } catch (imageError) {
          console.error(`Failed to process image ${i + 1}:`, imageError);
          failCount++;
          // Continue with next image instead of failing completely
        }
      }
      
      if (failCount > 0) {
        Alert.alert(
          'Partial Success',
          `Processed ${successCount} of ${imageUris.length} images. ${failCount} failed.`
        );
      }
      
      if (allItems.length === 0) {
        Alert.alert('No Items Found', 'No items were detected in the images.');
        setCapturedPhotos([]);
        setShowPhotoReview(false);
        setProcessing(false);
        return;
      }

      // Log all detected items for debugging
      console.log('All detected items:', allItems.map(item => `${item.name} (${item.brand})`));
      
      // Filter items that need verification (confidence < 7)
      const needsVerification = allItems.filter(item => item.confidence < 7);
      const autoAccepted = allItems.filter(item => item.confidence >= 7);

      console.log(`Auto-accepting ${autoAccepted.length} items, ${needsVerification.length} need verification`);

      // Add auto-accepted items immediately (NO duplicate checking - user can manage that)
      if (autoAccepted.length > 0) {
        const newItems = [...pantryItems, ...autoAccepted.map(item => ({
          ...item,
          id: Date.now() + Math.random(),
          dateAdded: new Date().toISOString(),
          status: 'in_stock',
        }))];
        await savePantryItems(newItems);
      }

      // Show verification modal for low confidence items
      if (needsVerification.length > 0) {
        setItemsToVerify(needsVerification);
        setCurrentVerifyIndex(0);
        setVerificationModal(true);
      }

      Alert.alert(
        'Items Detected',
        `Found ${allItems.length} items. ${autoAccepted.length} added automatically, ${needsVerification.length} need verification.`
      );

      // Clear captured photos after processing
      setCapturedPhotos([]);
      setShowPhotoReview(false);

    } catch (error) {
      console.error('Error processing images:', error);
      Alert.alert('Error', 'Failed to process images');
    } finally {
      setProcessing(false);
      setProcessingProgress('');
      setShowCamera(false);
    }
  };

  const handleBarCodeScanned = async ({ type, data }) => {
    setShowScanner(false);
    setProcessing(true);

    try {
      // Call UPC API to get product details
      const productInfo = await apiService.lookupBarcode(data);
      
      const newItem = {
        ...productInfo,
        dateAdded: new Date().toISOString(),
        status: 'in_stock',
        id: Date.now(),
      };

      const newItems = [...pantryItems, newItem];
      await savePantryItems(newItems);
      
      Alert.alert('Product Added', `${productInfo.name} has been added to your pantry`);
    } catch (error) {
      Alert.alert('Error', 'Failed to process barcode');
    } finally {
      setProcessing(false);
    }
  };

  const takePicture = async () => {
    try {
      if (cameraRef.current) {
        const photo = await cameraRef.current.takePictureAsync({
          quality: 0.5,  // Reduced quality for faster processing
          base64: false,
        });
        
        // Add photo to captured list - no alert, just update the UI
        setCapturedPhotos([...capturedPhotos, photo.uri]);
      } else {
        Alert.alert('Error', 'Camera not ready');
      }
    } catch (error) {
      console.error('Error taking picture:', error);
      Alert.alert('Error', 'Failed to take picture');
    }
  };

  const pickImage = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsMultipleSelection: true,
      quality: 0.8,
    });

    if (!result.canceled) {
      const imageUris = result.assets.map(asset => asset.uri);
      await processImagesWithGPT(imageUris);
    }
  };

  const verifyItem = (accepted) => {
    if (accepted) {
      const item = itemsToVerify[currentVerifyIndex];
      const newItem = {
        ...item,
        id: Date.now() + Math.random(),
        dateAdded: new Date().toISOString(),
        status: 'in_stock',
      };
      const newItems = [...pantryItems, newItem];
      savePantryItems(newItems);
    }

    if (currentVerifyIndex < itemsToVerify.length - 1) {
      setCurrentVerifyIndex(currentVerifyIndex + 1);
    } else {
      setVerificationModal(false);
      setItemsToVerify([]);
    }
  };

  const removeItem = (itemId) => {
    Alert.alert(
      'Remove Item',
      'Are you sure you want to remove this item from your pantry?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: async () => {
            const newItems = pantryItems.filter(item => item.id !== itemId);
            await savePantryItems(newItems);
          }
        }
      ]
    );
  };

  const updateQuantity = async (itemId, change) => {
    const newItems = pantryItems.map(item => {
      if (item.id === itemId) {
        const currentQty = parseInt(item.quantity) || 1;
        const newQty = Math.max(0, currentQty + change);
        return { ...item, quantity: `${newQty} ${item.quantity.replace(/[0-9]/g, '').trim()}` };
      }
      return item;
    });
    await savePantryItems(newItems);
  };

  if (showCamera) {
    return (
      <View style={styles.container}>
        <UserCounter />
        <CameraView
          style={styles.camera}
          ref={cameraRef}
          facing="back"
        />
        <View style={styles.cameraOverlay}>
          <View style={styles.cameraTopBar}>
            <Text style={styles.cameraText}>
              {capturedPhotos.length > 0 
                ? `${capturedPhotos.length} photo(s) taken` 
                : 'Position pantry items in frame'}
            </Text>
          </View>
          
          {capturedPhotos.length > 0 && (
            <ScrollView 
              horizontal 
              style={styles.photoThumbnails}
              showsHorizontalScrollIndicator={false}
            >
              {capturedPhotos.map((uri, index) => (
                <Image 
                  key={index} 
                  source={{ uri }} 
                  style={styles.thumbnail} 
                />
              ))}
            </ScrollView>
          )}
          
          <View style={styles.cameraButtons}>
            <TouchableOpacity
              style={styles.cameraButton}
              onPress={() => {
                setCapturedPhotos([]);
                setShowCamera(false);
              }}
            >
              <Text style={styles.cameraButtonText}>Cancel</Text>
            </TouchableOpacity>
            
            <TouchableOpacity
              style={styles.cameraCaptureButton}
              onPress={takePicture}
            >
              <View style={styles.captureButtonInner} />
            </TouchableOpacity>
            
            {capturedPhotos.length > 0 && (
              <TouchableOpacity
                style={[styles.cameraButton, styles.doneButton]}
                onPress={() => {
                  setShowCamera(false);
                  processImagesWithGPT(capturedPhotos);
                }}
              >
                <Text style={styles.cameraButtonText}>Done ({capturedPhotos.length})</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      </View>
    );
  }

  if (showScanner) {
    return (
      <View style={styles.container}>
        <UserCounter />
        <CameraView
          style={styles.scanner}
          onBarcodeScanned={handleBarCodeScanned}
          barcodeScannerSettings={{
            barcodeTypes: ['qr', 'ean13', 'ean8', 'upc_a', 'upc_e'],
          }}
          facing="back"
        />
        <View style={styles.scannerOverlay}>
          <Text style={styles.scannerText}>Scan product barcode</Text>
          <View style={styles.scannerFrame} />
          <TouchableOpacity
            style={styles.scannerButton}
            onPress={() => setShowScanner(false)}
          >
            <Text style={styles.cameraButtonText}>Cancel</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <UserCounter />
      <TouchableOpacity onPress={onBack}>
        <Text style={styles.backButton}>← Back</Text>
      </TouchableOpacity>

      <Text style={styles.title}>{isSetupMode ? 'Pantry Setup' : 'My Pantry'}</Text>
      <Text style={styles.subtitle}>{pantryItems.length} items tracked</Text>
      
      {isSetupMode && pantryItems.length > 0 && (
        <TouchableOpacity
          style={styles.finishSetupButton}
          onPress={onFinishSetup}
        >
          <Text style={styles.finishSetupButtonText}>✓ Finish Setup</Text>
        </TouchableOpacity>
      )}

      {isSetupMode && pantryItems.length === 0 && (
        <View style={styles.setupInstructions}>
          <Text style={styles.setupInstructionsText}>
            Add items to your pantry by taking photos, uploading images, or scanning barcodes.
            Once you've added your items, you can finish setup.
          </Text>
        </View>
      )}

      <View style={styles.actionButtons}>
        <TouchableOpacity
          style={styles.actionButton}
          onPress={() => setShowCamera(true)}
          disabled={!permission?.granted}
        >
          <Text style={styles.actionButtonText}>📸 Take Photo</Text>
        </TouchableOpacity>
        
        <TouchableOpacity
          style={styles.actionButton}
          onPress={pickImage}
        >
          <Text style={styles.actionButtonText}>🖼️ Upload Photo</Text>
        </TouchableOpacity>
        
        <TouchableOpacity
          style={styles.actionButton}
          onPress={() => setShowScanner(true)}
          disabled={!permission?.granted}
        >
          <Text style={styles.actionButtonText}>📊 Scan Barcode</Text>
        </TouchableOpacity>
      </View>

      {processing && (
        <View style={styles.processingContainer}>
          <ActivityIndicator size="large" color="#3498db" />
          <Text style={styles.processingText}>
            {processingProgress || 'Processing images...'}
          </Text>
        </View>
      )}

      <FlatList
        data={pantryItems}
        keyExtractor={item => item.id.toString()}
        renderItem={({ item }) => (
          <View style={styles.pantryItem}>
            <View style={styles.itemInfo}>
              <Text style={styles.itemName}>{item.name}</Text>
              <Text style={styles.itemDetails}>
                {item.brand} • {item.quantity} • {item.category}
              </Text>
            </View>
            <View style={styles.itemActions}>
              <TouchableOpacity
                onPress={() => updateQuantity(item.id, -1)}
                style={styles.quantityButton}
              >
                <Text>-</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => updateQuantity(item.id, 1)}
                style={styles.quantityButton}
              >
                <Text>+</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => removeItem(item.id)}
                style={styles.removeButton}
              >
                <Text style={styles.removeText}>×</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>
              No items in pantry yet.{'\n'}
              Take a photo or scan barcodes to get started!
            </Text>
          </View>
        }
      />

      <Modal
        visible={verificationModal}
        transparent={true}
        animationType="slide"
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            {itemsToVerify.length > 0 && currentVerifyIndex < itemsToVerify.length && (
              <>
                <Text style={styles.modalTitle}>Confirmation Needed</Text>
                <Text style={styles.modalSubtitle}>
                  The Weekly Dish needs confirmation about this item
                </Text>
                <Text style={styles.modalText}>
                  Is this correct?{'\n\n'}
                  Name: {itemsToVerify[currentVerifyIndex].name}{'\n'}
                  Brand: {itemsToVerify[currentVerifyIndex].brand}{'\n'}
                  Quantity: {itemsToVerify[currentVerifyIndex].quantity}
                </Text>
                <View style={styles.modalButtons}>
                  <TouchableOpacity
                    style={[styles.modalButton, styles.rejectButton]}
                    onPress={() => verifyItem(false)}
                  >
                    <Text style={styles.modalButtonText}>No, Skip</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.modalButton, styles.acceptButton]}
                    onPress={() => verifyItem(true)}
                  >
                    <Text style={styles.modalButtonText}>Yes, Add</Text>
                  </TouchableOpacity>
                </View>
                <Text style={styles.modalProgress}>
                  Item {currentVerifyIndex + 1} of {itemsToVerify.length}
                </Text>
              </>
            )}
          </View>
        </View>
      </Modal>
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
    marginBottom: 5,
  },
  subtitle: {
    fontSize: 16,
    color: '#7f8c8d',
    marginBottom: 20,
  },
  actionButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  actionButton: {
    flex: 1,
    backgroundColor: '#3498db',
    padding: 12,
    borderRadius: 8,
    marginHorizontal: 5,
    alignItems: 'center',
  },
  actionButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: 'bold',
  },
  processingContainer: {
    padding: 20,
    alignItems: 'center',
  },
  processingText: {
    marginTop: 10,
    fontSize: 14,
    color: '#7f8c8d',
    textAlign: 'center',
    lineHeight: 20,
  },
  pantryItem: {
    backgroundColor: '#fff',
    padding: 15,
    borderRadius: 8,
    marginBottom: 10,
    flexDirection: 'row',
    justifyContent: 'space-between',
    elevation: 2,
  },
  itemInfo: {
    flex: 1,
  },
  itemName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#2c3e50',
  },
  itemDetails: {
    fontSize: 14,
    color: '#7f8c8d',
    marginTop: 2,
  },
  confidenceText: {
    fontSize: 12,
    color: '#95a5a6',
    marginTop: 2,
  },
  itemActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  quantityButton: {
    width: 30,
    height: 30,
    backgroundColor: '#ecf0f1',
    borderRadius: 15,
    justifyContent: 'center',
    alignItems: 'center',
    marginHorizontal: 5,
  },
  removeButton: {
    width: 30,
    height: 30,
    backgroundColor: '#e74c3c',
    borderRadius: 15,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 10,
  },
  removeText: {
    color: '#fff',
    fontSize: 20,
    fontWeight: 'bold',
  },
  emptyContainer: {
    padding: 40,
    alignItems: 'center',
  },
  emptyText: {
    textAlign: 'center',
    color: '#7f8c8d',
    fontSize: 16,
  },
  camera: {
    flex: 1,
  },
  cameraOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'space-between',
    padding: 20,
  },
  cameraTopBar: {
    backgroundColor: 'rgba(0,0,0,0.5)',
    padding: 10,
    borderRadius: 8,
    marginTop: 40,
  },
  cameraText: {
    color: '#fff',
    fontSize: 18,
    textAlign: 'center',
  },
  photoThumbnails: {
    position: 'absolute',
    bottom: 120,
    left: 20,
    right: 20,
    maxHeight: 80,
  },
  thumbnail: {
    width: 60,
    height: 60,
    borderRadius: 8,
    marginRight: 10,
    borderWidth: 2,
    borderColor: '#fff',
  },
  cameraButtons: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    paddingBottom: 20,
  },
  cameraButton: {
    backgroundColor: 'rgba(0,0,0,0.5)',
    padding: 15,
    borderRadius: 8,
  },
  cameraCaptureButton: {
    width: 70,
    height: 70,
    borderRadius: 35,
    backgroundColor: '#fff',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 4,
    borderColor: '#3498db',
  },
  captureButtonInner: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#3498db',
  },
  doneButton: {
    backgroundColor: '#27ae60',
  },
  cameraButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  scanner: {
    flex: 1,
  },
  scannerOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
  },
  scannerText: {
    color: '#fff',
    fontSize: 18,
    backgroundColor: 'rgba(0,0,0,0.5)',
    padding: 10,
    borderRadius: 8,
    marginBottom: 20,
  },
  scannerFrame: {
    width: 250,
    height: 250,
    borderWidth: 2,
    borderColor: '#3498db',
    backgroundColor: 'transparent',
  },
  scannerButton: {
    backgroundColor: 'rgba(0,0,0,0.5)',
    padding: 15,
    borderRadius: 8,
    marginTop: 30,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 25,
    width: '85%',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#2c3e50',
    marginBottom: 5,
  },
  modalSubtitle: {
    fontSize: 14,
    color: '#e74c3c',
    marginBottom: 15,
  },
  modalText: {
    fontSize: 16,
    color: '#34495e',
    marginBottom: 20,
  },
  modalButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  modalButton: {
    flex: 1,
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
    marginHorizontal: 5,
  },
  rejectButton: {
    backgroundColor: '#95a5a6',
  },
  acceptButton: {
    backgroundColor: '#27ae60',
  },
  modalButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  modalProgress: {
    textAlign: 'center',
    marginTop: 15,
    color: '#7f8c8d',
  },
  finishSetupButton: {
    backgroundColor: '#27ae60',
    padding: 15,
    borderRadius: 8,
    alignItems: 'center',
    marginBottom: 15,
  },
  finishSetupButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  setupInstructions: {
    backgroundColor: '#ebf5fb',
    padding: 15,
    borderRadius: 8,
    marginBottom: 15,
  },
  setupInstructionsText: {
    fontSize: 14,
    color: '#2980b9',
    textAlign: 'center',
    lineHeight: 20,
  },
});