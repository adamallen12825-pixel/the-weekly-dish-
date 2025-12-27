import React, { useState } from 'react';
import { View, Text, ScrollView, StyleSheet } from 'react-native';

let debugInstance = null;

export class DebugLogger {
  static logs = [];
  static maxLogs = 50;

  static log(message, data = null) {
    const timestamp = new Date().toLocaleTimeString();
    const logEntry = {
      time: timestamp,
      message: message,
      data: data ? JSON.stringify(data).substring(0, 200) : null
    };
    
    this.logs.unshift(logEntry);
    if (this.logs.length > this.maxLogs) {
      this.logs.pop();
    }
    
    if (debugInstance) {
      debugInstance.forceUpdate();
    }
  }

  static clear() {
    this.logs = [];
    if (debugInstance) {
      debugInstance.forceUpdate();
    }
  }
}

export default class DebugScreen extends React.Component {
  componentDidMount() {
    debugInstance = this;
  }

  componentWillUnmount() {
    debugInstance = null;
  }

  render() {
    return (
      <View style={styles.container}>
        <Text style={styles.title}>Debug Logs</Text>
        <ScrollView style={styles.scrollView}>
          {DebugLogger.logs.map((log, index) => (
            <View key={index} style={styles.logEntry}>
              <Text style={styles.timestamp}>[{log.time}]</Text>
              <Text style={styles.message}>{log.message}</Text>
              {log.data && <Text style={styles.data}>{log.data}</Text>}
            </View>
          ))}
          {DebugLogger.logs.length === 0 && (
            <Text style={styles.noLogs}>No logs yet...</Text>
          )}
        </ScrollView>
      </View>
    );
  }
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#000',
    padding: 10,
    maxHeight: 200,
    borderTopWidth: 2,
    borderTopColor: '#27ae60',
  },
  title: {
    color: '#27ae60',
    fontSize: 12,
    fontWeight: 'bold',
    marginBottom: 5,
  },
  scrollView: {
    flex: 1,
  },
  logEntry: {
    marginBottom: 5,
    borderBottomWidth: 1,
    borderBottomColor: '#333',
    paddingBottom: 3,
  },
  timestamp: {
    color: '#888',
    fontSize: 10,
  },
  message: {
    color: '#fff',
    fontSize: 11,
  },
  data: {
    color: '#3498db',
    fontSize: 10,
    fontStyle: 'italic',
  },
  noLogs: {
    color: '#666',
    fontSize: 11,
    fontStyle: 'italic',
  },
});