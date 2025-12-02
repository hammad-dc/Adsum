import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Image,
  TextInput,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { ArrowLeft, Search, Check } from 'lucide-react-native';
import { supabase } from './lib/supabase';

export default function ManualOverride({
  classSession,
  onBack,
  onComplete,
}: any) {
  const [students, setStudents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // 1. Fetch ALL Students + Check who is already present
  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      // A. Get all students
      const { data: allStudents } = await supabase
        .from('profiles')
        .select('*')
        .eq('role', 'student');

      // B. Get already marked
      const { data: present } = await supabase
        .from('attendance')
        .select('student_id')
        .eq('session_id', classSession.id);

      const presentIds = new Set(present?.map(p => p.student_id));

      // C. Merge
      const list =
        allStudents?.map(s => ({
          ...s,
          isPresent: presentIds.has(s.id),
        })) || [];

      setStudents(list);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const toggleSelection = (id: string) => {
    const newSet = new Set(selectedIds);
    if (newSet.has(id)) newSet.delete(id);
    else newSet.add(id);
    setSelectedIds(newSet);
  };

  const submitManual = async () => {
    if (selectedIds.size === 0) return;

    try {
      const records = Array.from(selectedIds).map(studentId => ({
        session_id: classSession.id,
        student_id: studentId,
        status: 'present',
        verification_method: 'manual',
      }));

      const { error } = await supabase.from('attendance').insert(records);
      if (error) throw error;

      Alert.alert('Success', `Marked ${selectedIds.size} students present.`);
      onComplete(); // Go back to Live View
    } catch (err: any) {
      Alert.alert('Error', err.message);
    }
  };

  const renderItem = ({ item }: any) => {
    if (item.isPresent) return null; // Hide already present students (Optional)

    const isSelected = selectedIds.has(item.id);
    return (
      <TouchableOpacity
        style={[styles.card, isSelected && styles.cardSelected]}
        onPress={() => toggleSelection(item.id)}
      >
        <Image
          source={{
            uri: `https://api.dicebear.com/9.x/avataaars/png?seed=${
              item.full_name || item.email
            }`,
          }}
          style={styles.avatar}
        />
        <View style={{ flex: 1 }}>
          <Text style={styles.name}>{item.full_name || 'Unknown Student'}</Text>
          <Text style={styles.subText}>{item.student_id || item.email}</Text>
        </View>
        <View style={[styles.checkbox, isSelected && styles.checkboxSelected]}>
          {isSelected && <Check size={16} color="#FFF" />}
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={styles.row}>
          <TouchableOpacity onPress={onBack}>
            <ArrowLeft color="#FFF" size={24} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Manual Entry</Text>
        </View>
        <View style={styles.searchBox}>
          <Search size={20} color="#757575" />
          <TextInput
            placeholder="Search..."
            style={styles.input}
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
        </View>
      </View>

      <View style={styles.content}>
        {loading ? (
          <ActivityIndicator color="#2196F3" />
        ) : (
          <FlatList
            data={students.filter(s =>
              s.full_name?.toLowerCase().includes(searchQuery.toLowerCase()),
            )}
            renderItem={renderItem}
            keyExtractor={item => item.id}
          />
        )}
      </View>

      {selectedIds.size > 0 && (
        <View style={styles.footer}>
          <TouchableOpacity style={styles.submitButton} onPress={submitManual}>
            <Text style={styles.submitText}>
              Mark {selectedIds.size} Present
            </Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F5F5F5' },
  header: { backgroundColor: '#2196F3', padding: 20, paddingBottom: 15 },
  headerTitle: {
    color: '#FFF',
    fontSize: 20,
    fontWeight: 'bold',
    marginLeft: 15,
  },
  row: { flexDirection: 'row', alignItems: 'center' },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF',
    borderRadius: 8,
    paddingHorizontal: 10,
    marginTop: 15,
    height: 45,
  },
  input: { flex: 1, marginLeft: 10, color: '#333' },
  content: { flex: 1, padding: 15 },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF',
    padding: 15,
    borderRadius: 12,
    marginBottom: 10,
    elevation: 1,
  },
  cardSelected: {
    backgroundColor: '#E3F2FD',
    borderColor: '#2196F3',
    borderWidth: 1,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#EEE',
    marginRight: 15,
  },
  name: { fontSize: 16, fontWeight: 'bold', color: '#333' },
  subText: { color: '#757575', fontSize: 13 },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#CCC',
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxSelected: { backgroundColor: '#2196F3', borderColor: '#2196F3' },
  footer: {
    padding: 15,
    backgroundColor: '#FFF',
    borderTopWidth: 1,
    borderColor: '#EEE',
  },
  submitButton: {
    padding: 15,
    borderRadius: 12,
    backgroundColor: '#4CAF50',
    alignItems: 'center',
  },
  submitText: { color: '#FFF', fontWeight: 'bold', fontSize: 16 },
});
