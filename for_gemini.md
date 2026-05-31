# here are the two columns from attendance table
## here the proxy suspected thing is not working i guess cause in the 63 i did proxy from other device which isnt reflected here but in real ui it is shown proxy also i want to make it an info button this lecture could be a proxy we need to tell the teacher to like talk with student the system works fine i guess also i required we have to correct this attendance table
id,session_id,student_id,status,verification_method,gps_lat,gps_long,marked_at,bluetooth_verified,location_verified,device_id,is_proxy_suspected
63,46,a21e3bf5-4426-4c86-9a04-9b7188e16179,present,code_only,,,2026-05-30 19:04:26.215961+00,true,true,178cf8426ae8f876,false
64,45,a21e3bf5-4426-4c86-9a04-9b7188e16179,present,code_only,,,2026-05-30 19:06:16.665095+00,true,true,85bbdbbc0611abb1,false
# This is my manual override code 
import React, {useState, useEffect} from 'react';
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
  Modal,
  BackHandler,
} from 'react-native';
import {
  ArrowLeft,
  Search,
  CheckCircle,
  XCircle,
  AlertTriangle,
} from 'lucide-react-native';
import {supabase} from './lib/supabase';

export default function ManualOverride({
  visible,
  onClose,
  classSession,
  onUpdate,
  onBack,
}: any) {
  const [students, setStudents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // 1. Fetch Data
  // --- 1. REFACTORED: SAFE DATA ACCESS ---
  // --- REFACTORED FOR ARRAY ACCESS ---
  const fetchData = async () => {
    try {
      setLoading(true);

      const {data: currentSession, error: sessionError} = await supabase
        .from('sessions')
        .select(
          `
        target_batch,
        subjects!inner (
          target_course,
          target_year,
          target_semester
        )
      `,
        )
        .eq('id', classSession.id)
        .single();

      if (sessionError || !currentSession) {
        console.error('Session fetch error:', sessionError);
        return;
      }

      // Access the first element of the subjects array
      // Supabase often returns joins as arrays unless strictly typed otherwise
      const subjectData = Array.isArray(currentSession.subjects)
        ? currentSession.subjects[0]
        : currentSession.subjects;

      if (!subjectData) {
        console.error('No subject data found for this session');
        return;
      }

      let studentQuery = supabase
        .from('profiles')
        .select('*')
        .eq('role', 'student')
        .eq('course', subjectData.target_course) // Accessing properties safely
        .eq('year', subjectData.target_year) // Accessing properties safely
        .eq('semester', subjectData.target_semester); // Accessing properties safely

      if (currentSession.target_batch !== 'ALL') {
        studentQuery = studentQuery.eq('batch', currentSession.target_batch);
      }

      const {data: allStudents} = await studentQuery.order('name');
      const {data: present} = await supabase
        .from('attendance')
        .select('student_id, device_id') // Added device_id for security checks
        .eq('session_id', classSession.id);

      // E. Map attendance status and flag suspected proxies
      const presentMap = new Map(
        present?.map(p => [p.student_id, p.device_id]),
      );

      const list =
        allStudents?.map(s => ({
          ...s,
          isPresent: presentMap.has(s.id),
          // Flag if the device used doesn't match the student's primary device
          isProxySuspected:
            presentMap.has(s.id) &&
            s.primary_device_id !== (presentMap.get(s.id) || ''),
        })) || [];
      setStudents(list);

      // ... rest of your mapping logic ...
    } catch (err) {
      console.error('Manual Override Fetch Error:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const backAction = () => {
      if (visible) {
        // 🎯 Use 'onClose' instead of 'onBack'
        if (onClose) {
          onClose();
          return true; // Prevents the app from closing
        }
      }
      return false;
    };
    // 2. Register the listener
    const backHandler = BackHandler.addEventListener(
      'hardwareBackPress',
      backAction,
    );

    if (visible) fetchData();
    return () => backHandler.remove();
  }, [visible]);

  // 2. MARK PRESENT (Bulk)
  const submitMarkPresent = async () => {
    if (selectedIds.size === 0) return;
    try {
      const records = Array.from(selectedIds).map(studentId => ({
        session_id: classSession.id,
        student_id: studentId,
        status: 'present',
        verification_method: 'manual',
      }));

      await supabase.from('attendance').insert(records);

      Alert.alert('Success', `Marked ${selectedIds.size} students present.`);
      setSelectedIds(new Set()); // Clear selection
      fetchData(); // Refresh list
      if (onUpdate) onUpdate(); // Update the main screen count!
    } catch (err: any) {
      Alert.alert('Error', err.message);
    }
  };

  // 3. REMOVE STUDENT (Specific Action)
  const removeStudent = async (studentId: string, name: string) => {
    Alert.alert(
      'Revoke Attendance?',
      `Are you sure you want to mark ${name} as Absent/Suspicious?`,
      [
        {text: 'Cancel', style: 'cancel'},
        {
          text: 'Mark Absent',
          style: 'destructive',
          onPress: async () => {
            await supabase
              .from('attendance')
              .delete()
              .eq('session_id', classSession.id)
              .eq('student_id', studentId);
            fetchData(); // Refresh UI
            if (onUpdate) onUpdate(); // Update main screen
          },
        },
      ],
    );
  };

  const toggleSelection = (id: string) => {
    const newSet = new Set(selectedIds);
    if (newSet.has(id)) newSet.delete(id);
    else newSet.add(id);
    setSelectedIds(newSet);
  };

  const renderItem = ({item}: any) => {
    const isSelected = selectedIds.has(item.id); //

    return (
      <View style={styles.card}>
        <View style={[styles.row, {alignItems: 'flex-start'}]}>
          <Image
            source={{
              uri: `https://api.dicebear.com/9.x/initials/png?seed=${item.name}`,
            }}
            style={[styles.avatar, {marginTop: 5}]} //
          />

          {/* 🎯 Name Section - No more truncating */}
          <View style={{flex: 1, marginRight: 10}}>
            <Text style={styles.name}>{item.name}</Text>
            <Text style={styles.subText}>{item.student_id}</Text>
          </View>

          {/* 🎯 Badge Column - Stacked Vertically */}
          <View style={{alignItems: 'flex-end', gap: 4, minWidth: 90}}>
            {item.isPresent ? (
              <TouchableOpacity
                style={styles.verifiedBadge}
                onPress={() => removeStudent(item.id, item.name)} //
              >
                <CheckCircle size={16} color="#4CAF50" />
                <Text style={styles.verifiedText}>Verified</Text>
              </TouchableOpacity>
            ) : (
              <TouchableOpacity onPress={() => toggleSelection(item.id)}>
                {isSelected ? (
                  <CheckCircle size={24} color="#2196F3" />
                ) : (
                  <View style={styles.circle} />
                )}
              </TouchableOpacity>
            )}

            {/* ⚠️ Proxy Flag appears directly UNDER the Verified status */}
            {item.isProxySuspected && (
              <View style={[styles.proxyBadge, {marginRight: 0, marginTop: 2}]}>
                <AlertTriangle size={12} color="#FF9800" />
                <Text style={styles.proxyText}>Proxy?</Text>
              </View>
            )}
          </View>
        </View>
      </View>
    );
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}>
      <View style={styles.container}>
        <View style={styles.header}>
          <View style={styles.row}>
            <TouchableOpacity onPress={onClose}>
              <ArrowLeft color="#FFF" size={24} />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>Class Register</Text>
          </View>
          <View style={styles.searchBox}>
            <Search size={20} color="#757575" />
            <TextInput
              placeholder="Search Name or ID..."
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
                s.name?.toLowerCase().includes(searchQuery.toLowerCase()),
              )}
              renderItem={renderItem}
              keyExtractor={item => item.id}
              contentContainerStyle={{paddingBottom: 100}}
            />
          )}
        </View>
        {selectedIds.size > 0 && (
          <View style={styles.footer}>
            <TouchableOpacity
              style={styles.submitButton}
              onPress={submitMarkPresent}>
              <Text style={styles.submitText}>
                Mark {selectedIds.size} Students Present
              </Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {flex: 1, backgroundColor: '#F5F7FA'},
  header: {
    backgroundColor: '#2196F3',
    padding: 20,
    paddingTop: 20,
    paddingBottom: 15,
  },
  headerTitle: {
    color: '#FFF',
    fontSize: 20,
    fontWeight: 'bold',
    marginLeft: 15,
  },
  row: {flexDirection: 'row', alignItems: 'center'},
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF',
    borderRadius: 12,
    paddingHorizontal: 10,
    marginTop: 15,
    height: 45,
  },
  input: {flex: 1, marginLeft: 10},
  content: {flex: 1, padding: 15},
  card: {
    backgroundColor: '#FFF',
    padding: 15,
    borderRadius: 12,
    marginBottom: 10,
    elevation: 1,
  },
  avatar: {
    width: 45,
    height: 45,
    borderRadius: 23,
    backgroundColor: '#EEE',
    marginRight: 15,
  },
  name: {fontSize: 16, fontWeight: 'bold', color: '#333', lineHeight: 22},
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  proxyBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF3E0',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: '#FFE0B2',
    marginLeft: 8,
  },
  proxyText: {
    color: '#E65100',
    fontSize: 10,
    fontWeight: 'bold',
    marginLeft: 4,
  },
  subText: {color: '#757575', fontSize: 12},
  circle: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#CCC',
  },

  // Restored the clean look for verified
  verifiedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#E8F5E9',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    justifyContent: 'center',
  },
  verifiedText: {fontSize: 12, color: '#4CAF50', fontWeight: 'bold'},

  footer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: 20,
    backgroundColor: '#FFF',
    borderTopWidth: 1,
    borderColor: '#EEE',
  },
  submitButton: {
    padding: 16,
    borderRadius: 12,
    backgroundColor: '#2196F3',
    alignItems: 'center',
    elevation: 3,
  },
  submitText: {color: '#FFF', fontWeight: 'bold', fontSize: 16},
});
