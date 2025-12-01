import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

const App = () => {
  return (
    <View style={styles.container}>
      <Text style={styles.text}>Hello Adsum!</Text>
      <Text style={styles.subText}>My Attendance App is running.</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center', // Centers vertically
    alignItems: 'center', // Centers horizontally
    backgroundColor: '#FFFFFF',
  },
  text: {
    fontSize: 30,
    fontWeight: 'bold',
    color: '#2196F3', // The blue color from your Figma design
  },
  subText: {
    fontSize: 16,
    color: '#666666',
    marginTop: 10,
  },
});

export default App;
