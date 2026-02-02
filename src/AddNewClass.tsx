import React, { useState, useEffect } from 'react';
import Geolocation from 'react-native-geolocation-service';
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
import { ArrowLeft, Calendar, MapPin, BookOpen } from 'lucide-react-native';
import { supabase } from './lib/supabase';

export default function AddNewClass({ onBack, onClassCreated }: any) {
  const [isAdHoc, setIsAdHoc] = useState(true);
  const [loading, setLoading] = useState(false);

  // ✅ FIX: Pre-filled with defaults so chips appear INSTANTLY
  const [savedSubjects, setSavedSubjects] = useState<any[]>([
    { id: 991, name: 'DSGT', code: 'CS301' },
    { id: 992, name: 'DLCA', code: 'CS302' },
    { id: 993, name: 'Data Structures', code: 'CS303' },
    { id: 994, name: 'Computer Graphics', code: 'CS304' },
  ]);

  const [subjectName, setSubjectName] = useState('');
  const [room, setRoom] = useState('');
  const [selectedSubjectId, setSelectedSubjectId] = useState<number | null>(
    null,
  );

  useEffect(() => {
    fetchSubjects();
  }, []);

  const fetchSubjects = async () => {
    const { data, error } = await supabase.from('subjects').select('*');
    if (!error && data && data.length > 0) {
      // Combine defaults with real DB data
      setSavedSubjects(prev => [...prev, ...data]);
    }
  };

  const selectSubject = (subject: any) => {
    setSubjectName(subject.name);
    // Auto-fill room if logic allows, or keep empty
    if (subject.name === 'DSGT') setRoom('Room 304');
    else if (subject.name === 'DLCA') setRoom('Lab 1');
    else setRoom('');

    setSelectedSubjectId(subject.id);
  };

  const handleSubmit = async () => {
  if (!subjectName || !room) {
    Alert.alert('Missing Fields', 'Please select a subject or type a name and room.');
    return;
  }

  setLoading(true);

  // 1. Get current GPS coordinates first
  Geolocation.getCurrentPosition(
    async (position) => {
      const { latitude, longitude } = position.coords;
      
      try {
        const { data: { user } } = await supabase.auth.getUser();
        const newBeaconId = `BEACON-${Math.floor(Math.random() * 10000)}`;
        const initialCode = Math.floor(1000 + Math.random() * 9000).toString();

        // 2. Insert into Supabase WITH the coordinates
        const { data, error } = await supabase
          .from('sessions')
          .insert({
            beacon_id: newBeaconId,
            active_code: initialCode,
            is_active: true,
            class_name: subjectName,
            room_number: room,
            teacher_id: user?.id,
            gps_lat: latitude,   // ✅ Added
            gps_long: longitude, // ✅ Added
            subject_id: selectedSubjectId && selectedSubjectId < 900 ? selectedSubjectId : null,
          })
          .select()
          .single();

        if (error) throw error;

        if (onClassCreated) {
          onClassCreated({ ...data, class_name: subjectName, room_number: room });
        }
        onBack();
      } catch (err: any) {
        Alert.alert('Database Error', err.message);
      } finally {
        setLoading(false);
      }
    },
    (error) => {
      setLoading(false);
      Alert.alert('GPS Error', 'Could not get your location. Please check if GPS is on.');
      console.error(error);
    },
    { enableHighAccuracy: true, timeout: 15000, maximumAge: 10000 }
  );
};

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={onBack}>
          <ArrowLeft color="#FFF" size={24} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Start Class</Text>
      </View>

      <ScrollView style={styles.content}>
        <View style={styles.card}>
          <View style={styles.rowBetween}>
            <View>
              <Text style={styles.label}>Instant Mode</Text>
              <Text style={styles.subLabel}>Broadcast immediately</Text>
            </View>
            <Switch
              value={isAdHoc}
              onValueChange={setIsAdHoc}
              trackColor={{ false: '#E0E0E0', true: '#90CAF9' }}
              thumbColor={isAdHoc ? '#2196F3' : '#f4f3f4'}
            />
          </View>
        </View>

        {/* ✅ FIX: Quick Select is BACK and visible immediately */}
        <View style={styles.quickSelectContainer}>
          <Text style={styles.sectionHeader}>Quick Select</Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.chipScroll}
          >
            {savedSubjects.map((sub, index) => (
              <TouchableOpacity
                key={`${sub.id}-${index}`}
                style={[
                  styles.chip,
                  selectedSubjectId === sub.id && styles.chipActive,
                ]}
                onPress={() => selectSubject(sub)}
              >
                <BookOpen
                  size={14}
                  color={selectedSubjectId === sub.id ? '#FFF' : '#2196F3'}
                />
                <Text
                  style={[
                    styles.chipText,
                    selectedSubjectId === sub.id && styles.chipTextActive,
                  ]}
                >
                  {sub.name}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>

        <View style={styles.card}>
          <Text style={styles.inputLabel}>Subject Name</Text>
          <TextInput
            style={styles.input}
            placeholder="e.g. Data Structures"
            value={subjectName}
            onChangeText={t => {
              setSubjectName(t);
              setSelectedSubjectId(null);
            }}
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
      </ScrollView>

      <View style={styles.footer}>
        <TouchableOpacity
          style={styles.createButton}
          onPress={handleSubmit}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="#FFF" />
          ) : (
            <Text style={styles.buttonText}>Go Live Now</Text>
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
    fontSize: 14,
    fontWeight: 'bold',
    color: '#757575',
    marginBottom: 10,
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
  quickSelectContainer: { marginBottom: 15 },
  chipScroll: { flexDirection: 'row' },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 20,
    marginRight: 10,
    borderWidth: 1,
    borderColor: '#2196F3',
    gap: 6,
  },
  chipActive: { backgroundColor: '#2196F3' },
  chipText: { color: '#2196F3', fontWeight: '600' },
  chipTextActive: { color: '#FFF' },
});
