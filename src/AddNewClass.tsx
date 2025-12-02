import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Switch,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { ArrowLeft, Calendar, Clock, MapPin, Check } from 'lucide-react-native';
import { supabase } from './lib/supabase';

export default function AddNewClass({ onBack, onClassCreated }: any) {
  const [isAdHoc, setIsAdHoc] = useState(true); // Default to "Instant Class"
  const [loading, setLoading] = useState(false);

  // Form State
  const [subjectName, setSubjectName] = useState('');
  const [subjectCode, setSubjectCode] = useState('');
  const [room, setRoom] = useState('');

  const handleSubmit = async () => {
    if (!subjectName || !room) {
      Alert.alert('Missing Fields', 'Please enter Subject Name and Room.');
      return;
    }

    setLoading(true);
    try {
      // 1. Create a unique Beacon ID for this session
      const newBeaconId = `BEACON-${Math.floor(Math.random() * 10000)}`;
      const initialCode = Math.floor(1000 + Math.random() * 9000).toString();

      // 2. Insert into Supabase 'sessions' table
      // Note: In a real app, we would link this to a 'subjects' table ID.
      // For this MVP, we are inserting raw data to get it working fast.
      const { data, error } = await supabase
        .from('sessions')
        .insert({
          beacon_id: newBeaconId,
          active_code: initialCode,
          is_active: true, // It starts immediately
          // We are storing subject details in a JSON column or simpler structure for MVP
          // If your DB schema is strict, we might need to create a Subject first.
          // Assuming your 'sessions' table has a 'room' column or we just mock it for now.
        })
        .select()
        .single();

      if (error) throw error;

      // 3. Success!
      Alert.alert('Class Created', `Beacon ID: ${newBeaconId} is now active.`);

      // Pass data back to Dashboard to update the list immediately
      const newClass = {
        id: data.id,
        beacon_id: newBeaconId,
        is_active: true,
        subjects: { name: subjectName, code: subjectCode || 'GEN-101' },
      };

      if (onClassCreated) onClassCreated(newClass);
      onBack();
    } catch (err: any) {
      Alert.alert('Error', err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={onBack}>
          <ArrowLeft color="#FFF" size={24} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Create New Class</Text>
      </View>

      <ScrollView style={styles.content}>
        {/* Class Type Toggle */}
        <View style={styles.card}>
          <View style={styles.rowBetween}>
            <View>
              <Text style={styles.label}>Instant Class (Ad-hoc)</Text>
              <Text style={styles.subLabel}>
                Start broadcasting immediately
              </Text>
            </View>
            <Switch
              value={isAdHoc}
              onValueChange={setIsAdHoc}
              trackColor={{ false: '#E0E0E0', true: '#90CAF9' }}
              thumbColor={isAdHoc ? '#2196F3' : '#f4f3f4'}
            />
          </View>
        </View>

        {/* Input Fields */}
        <View style={styles.card}>
          <Text style={styles.sectionHeader}>Class Details</Text>

          <Text style={styles.inputLabel}>Subject Name</Text>
          <TextInput
            style={styles.input}
            placeholder="e.g. Data Structures"
            value={subjectName}
            onChangeText={setSubjectName}
          />

          <Text style={styles.inputLabel}>Subject Code (Optional)</Text>
          <TextInput
            style={styles.input}
            placeholder="e.g. CS-302"
            value={subjectCode}
            onChangeText={setSubjectCode}
          />

          <Text style={styles.inputLabel}>Room Number</Text>
          <View style={styles.inputIconContainer}>
            <MapPin size={20} color="#757575" style={styles.inputIcon} />
            <TextInput
              style={[styles.input, { paddingLeft: 40 }]}
              placeholder="e.g. Lab 301"
              value={room}
              onChangeText={setRoom}
            />
          </View>
        </View>

        {!isAdHoc && (
          <View style={styles.infoBox}>
            <Calendar size={20} color="#2196F3" />
            <Text style={styles.infoText}>
              Scheduled classes feature coming soon. For now, only Instant
              Classes are supported.
            </Text>
          </View>
        )}
      </ScrollView>

      {/* Footer Button */}
      <View style={styles.footer}>
        <TouchableOpacity
          style={styles.createButton}
          onPress={handleSubmit}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="#FFF" />
          ) : (
            <Text style={styles.buttonText}>Start Class Now</Text>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F5F5F5' },
  header: {
    backgroundColor: '#2196F3',
    padding: 20,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 15,
  },
  headerTitle: { color: '#FFF', fontSize: 20, fontWeight: 'bold' },
  content: { padding: 20 },
  card: {
    backgroundColor: '#FFF',
    borderRadius: 12,
    padding: 20,
    marginBottom: 20,
    elevation: 2,
  },
  rowBetween: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  label: { fontSize: 16, fontWeight: 'bold', color: '#212121' },
  subLabel: { fontSize: 12, color: '#757575', marginTop: 2 },
  sectionHeader: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#2196F3',
    marginBottom: 15,
  },
  inputLabel: {
    fontSize: 14,
    color: '#616161',
    marginBottom: 8,
    marginTop: 10,
  },
  input: {
    backgroundColor: '#FAFAFA',
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    color: '#212121',
  },
  inputIconContainer: { position: 'relative', justifyContent: 'center' },
  inputIcon: { position: 'absolute', left: 12, zIndex: 1 },
  infoBox: {
    flexDirection: 'row',
    backgroundColor: '#E3F2FD',
    padding: 15,
    borderRadius: 8,
    gap: 10,
    alignItems: 'center',
  },
  infoText: { color: '#1976D2', fontSize: 13, flex: 1 },
  footer: {
    padding: 20,
    backgroundColor: '#FFF',
    borderTopWidth: 1,
    borderColor: '#E0E0E0',
  },
  createButton: {
    backgroundColor: '#2196F3',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  buttonText: { color: '#FFF', fontSize: 16, fontWeight: 'bold' },
});
