import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Modal,
  StyleSheet,
  ScrollView,
  TextInput,
} from 'react-native';

export function CustomNumberPicker({ value, onChange, min = 0, max = 100, label }) {
  const [showModal, setShowModal] = useState(false);
  const [tempValue, setTempValue] = useState(value);

  const handleSelect = (num) => {
    setTempValue(num);
    onChange(num);
    setShowModal(false);
  };

  const quickNumbers = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10];

  return (
    <>
      <TouchableOpacity
        style={styles.selector}
        onPress={() => setShowModal(true)}
      >
        <Text style={styles.selectorText}>
          {value || 'Select'} {label}
        </Text>
        <Text style={styles.arrow}>▼</Text>
      </TouchableOpacity>

      <Modal
        visible={showModal}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowModal(false)}
      >
        <TouchableOpacity 
          style={styles.modalOverlay} 
          activeOpacity={1}
          onPress={() => setShowModal(false)}
        >
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Select {label}</Text>
            
            <View style={styles.quickSelect}>
              {quickNumbers.filter(n => n >= min && n <= max).map(num => (
                <TouchableOpacity
                  key={num}
                  style={[
                    styles.quickButton,
                    parseInt(value) === num && styles.selectedButton
                  ]}
                  onPress={() => handleSelect(num.toString())}
                >
                  <Text style={[
                    styles.quickButtonText,
                    parseInt(value) === num && styles.selectedText
                  ]}>
                    {num}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {max > 10 && (
              <>
                <Text style={styles.orText}>Or enter a number:</Text>
                <View style={styles.inputRow}>
                  <TextInput
                    style={styles.numberInput}
                    value={tempValue}
                    onChangeText={setTempValue}
                    keyboardType="numeric"
                    placeholder={`${min}-${max}`}
                    maxLength={3}
                  />
                  <TouchableOpacity
                    style={styles.setButton}
                    onPress={() => {
                      const num = parseInt(tempValue);
                      if (num >= min && num <= max) {
                        handleSelect(tempValue);
                      }
                    }}
                  >
                    <Text style={styles.setButtonText}>Set</Text>
                  </TouchableOpacity>
                </View>
              </>
            )}

            <TouchableOpacity
              style={styles.closeButton}
              onPress={() => setShowModal(false)}
            >
              <Text style={styles.closeButtonText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>
    </>
  );
}

export function AgeInputGroup({ count, ages, onChange, label, maxAge = 100 }) {
  const handleAgeChange = (index, value) => {
    const newAges = [...ages];
    newAges[index] = value;
    onChange(newAges);
  };

  const handleRangeChange = (value) => {
    onChange([value]);
  };

  if (count === 0) return null;

  if (count > 5) {
    return (
      <View style={styles.ageGroup}>
        <Text style={styles.ageLabel}>{label} Age Range</Text>
        <TextInput
          style={styles.rangeInput}
          value={ages[0] || ''}
          onChangeText={(value) => handleRangeChange(value)}
          placeholder="e.g., 5-12 or 25-35"
        />
      </View>
    );
  }

  return (
    <View style={styles.ageGroup}>
      <Text style={styles.ageLabel}>{label} Ages</Text>
      <View style={styles.ageInputs}>
        {Array.from({ length: count }, (_, i) => (
          <View key={i} style={styles.singleAge}>
            <Text style={styles.ageNumber}>{label} {i + 1}:</Text>
            <TextInput
              style={styles.ageInput}
              value={ages[i] || ''}
              onChangeText={(value) => handleAgeChange(i, value)}
              keyboardType="numeric"
              placeholder="Age"
              maxLength={3}
            />
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  selector: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#bdc3c7',
    borderRadius: 8,
    padding: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  selectorText: {
    fontSize: 16,
    color: '#2c3e50',
  },
  arrow: {
    fontSize: 12,
    color: '#7f8c8d',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    paddingBottom: 40,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#2c3e50',
    marginBottom: 20,
    textAlign: 'center',
  },
  quickSelect: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    marginBottom: 20,
  },
  quickButton: {
    width: 50,
    height: 50,
    margin: 5,
    backgroundColor: '#ecf0f1',
    borderRadius: 25,
    justifyContent: 'center',
    alignItems: 'center',
  },
  selectedButton: {
    backgroundColor: '#3498db',
  },
  quickButtonText: {
    fontSize: 16,
    color: '#2c3e50',
    fontWeight: '600',
  },
  selectedText: {
    color: '#fff',
  },
  orText: {
    fontSize: 14,
    color: '#7f8c8d',
    textAlign: 'center',
    marginBottom: 10,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
  },
  numberInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#bdc3c7',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    marginRight: 10,
  },
  setButton: {
    backgroundColor: '#27ae60',
    paddingHorizontal: 30,
    paddingVertical: 12,
    borderRadius: 8,
  },
  setButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  closeButton: {
    backgroundColor: '#95a5a6',
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  closeButtonText: {
    color: '#fff',
    fontSize: 16,
  },
  ageGroup: {
    marginTop: 15,
    backgroundColor: '#f8f9fa',
    padding: 15,
    borderRadius: 8,
  },
  ageLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#2c3e50',
    marginBottom: 10,
  },
  ageInputs: {
    gap: 10,
  },
  singleAge: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  ageNumber: {
    fontSize: 14,
    color: '#7f8c8d',
    width: 70,
  },
  ageInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#bdc3c7',
    borderRadius: 6,
    padding: 8,
    fontSize: 14,
    backgroundColor: '#fff',
  },
  rangeInput: {
    borderWidth: 1,
    borderColor: '#bdc3c7',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    backgroundColor: '#fff',
  },
});