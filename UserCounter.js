import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet } from 'react-native';

const UserCounter = () => {
  const [userCount, setUserCount] = useState(null);

  const fetchUserCount = async () => {
    try {
      // Use the web URL directly for the API call
      const response = await fetch('https://theweekly-dish.com/api/users?action=count');
      const data = await response.json();
      if (data.count !== undefined) {
        setUserCount(data.count);
      }
    } catch (error) {
      console.error('Error fetching user count:', error);
    }
  };

  useEffect(() => {
    fetchUserCount();
    // Refresh count every 60 seconds
    const interval = setInterval(fetchUserCount, 60000);
    return () => clearInterval(interval);
  }, []);

  if (userCount === null) {
    return null; // Don't show anything while loading
  }

  return (
    <View style={styles.container}>
      <Text style={styles.count}>{userCount.toLocaleString()}</Text>
      <Text style={styles.label}>users</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 10,
    right: 10,
    backgroundColor: '#3498db',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    flexDirection: 'row',
    alignItems: 'center',
    zIndex: 1000,
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 3,
  },
  count: {
    color: '#fff',
    fontSize: 14,
    fontWeight: 'bold',
    marginRight: 4,
  },
  label: {
    color: '#fff',
    fontSize: 12,
    opacity: 0.9,
  },
});

export default UserCounter;
