import React, {useState, useEffect} from 'react';
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
  PermissionsAndroid, // 👈 ADD THIS
  Platform,
  BackHandler,
} from 'react-native';
import {ArrowLeft, Calendar, MapPin, BookOpen} from 'lucide-react-native';
import {supabase} from './lib/supabase';

export default function AddNewClass({onBack, onClassCreated, params}: any) {
  const [isAdHoc, setIsAdHoc] = useState(true);
  const [loading, setLoading] = useState(false);

  // ✅ FIX: Pre-filled with defaults so chips appear INSTANTLY
  const [savedSubjects, setSavedSubjects] = useState<any[]>([
    {id: 991, name: 'DSGT', code: 'CS301'},
    {id: 992, name: 'DLCA', code: 'CS302'},
    {id: 993, name: 'Data Structures', code: 'CS303'},
    {id: 994, name: 'Computer Graphics', code: 'CS304'},
  ]);

  const [subjectName, setSubjectName] = useState('');
  const [room, setRoom] = useState('');
  const [selectedSubjectId, setSelectedSubjectId] = useState<number | null>(
    null,
  );
  const [targetCourse, setTargetCourse] = useState('Computer Engineering');
  const [targetYear, setTargetYear] = useState('SE'); // FE, SE, TE, BE
  const [targetSemester, setTargetSemester] = useState(4);
  const [selectedBatch, setSelectedBatch] = useState('ALL'); // ALL, A, B, or C
  const [subjects, setSubjects] = useState<any[]>([]);

  const teacherId = params?.teacherId;
  useEffect(() => {
    const backAction = () => {
      if (onBack) {
        onBack(); // Run the back navigation prop passed from the parent
        return true; // "true" means: I handled it, don't close the app.
      }
      return false; // "false" means: I didn't handle it, let the OS decide.
    };

    // 2. Register the listener
    const backHandler = BackHandler.addEventListener(
      'hardwareBackPress',
      backAction,
    );
    fetchMySubjects();
    return () => backHandler.remove();
  }, [onBack, teacherId]);

  const fetchMySubjects = async () => {
    if (!teacherId) return; // 🎯 Safety check
    try {
      // 🎯 JOIN logic: Get subjects THROUGH the assignment bridge
      const {data, error} = await supabase
        .from('subject_assignments')
        .select(
          `
        subjects (
          id, name, code, target_course, target_year, target_semester, type
        )
      `,
        )
        .eq('teacher_id', params?.teacherId || teacherId); // Ensure you pass teacherId in props

      if (error) throw error;

      // Transform joined data: [{subjects: {...}}, {subjects: {...}}] -> [{...}, {...}]
      const mappedData = data?.map(item => item.subjects).filter(Boolean) || [];

      setSubjects(mappedData);
    } catch (err) {
      console.error('Error fetching assigned subjects:', err);
    }
  };

  useEffect(() => {
    if (params?.initialSubject) {
      console.log('Auto-filling subject:', params.initialSubject.name);
      selectSubject(params.initialSubject); // This fills all the fields for you
    }
  }, [params]);

  const selectSubject = (subject: any) => {
    setSubjectName(subject.name);
    setSelectedSubjectId(subject.id);

    if (subject.target_course) setTargetCourse(subject.target_course);
    if (subject.target_year) setTargetYear(subject.target_year);
    if (subject.target_semester) setTargetSemester(subject.target_semester);

    const isPractical =
      subject.type === 'Lab' || subject.name.toLowerCase().includes('lab');

    if (isPractical) {
      setRoom(subject.default_room || 'Lab 1');
      setSelectedBatch('A'); // Default to first batch for Labs
    } else {
      setRoom(subject.default_room || 'Room 304');
      setSelectedBatch('ALL'); // Force 'ALL' for Theory
    }
  };

  const handleSubmit = async () => {
    if (!subjectName || !room) {
      Alert.alert(
        'Missing Fields',
        'Please select a subject or type a name and room.',
      );
      return;
    }

    setLoading(true);
    let isPermissionGranted = false;
    try {
      if (Platform.OS === 'android') {
        const granted = await PermissionsAndroid.request(
          PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
          {
            title: 'Adsum Geofence Access',
            message:
              'Adsum needs access to your GPS location to verify you are starting the session from the correct classroom. This prevents proxy attendance.',
            buttonNeutral: 'Ask Me Later',
            buttonNegative: 'Cancel',
            buttonPositive: 'OK',
          },
        );

        if (granted === PermissionsAndroid.RESULTS.GRANTED) {
          isPermissionGranted = true;
        } else if (granted === PermissionsAndroid.RESULTS.DENIED) {
        } else if (granted === PermissionsAndroid.RESULTS.NEVER_ASK_AGAIN) {
          Alert.alert(
            'Permission Required',
            'You have denied location access permanently. Please go to your phone settings and enable Location permissions manually for Adsum.',
          );
        }
      } else {
        // Handle iOS if needed later
        isPermissionGranted = true;
      }
    } catch (err) {
      console.warn(err);
    }

    // Stop if permission was not granted
    if (!isPermissionGranted) {
      setLoading(false);
      return; // 🛑 Halt flow
    }

    // 1. Get current GPS coordinates first
    Geolocation.getCurrentPosition(
      async position => {
        const {latitude, longitude} = position.coords;

        try {
          const {
            data: {user},
          } = await supabase.auth.getUser();
          const newBeaconId = `BEACON-${Math.floor(Math.random() * 10000)}`;
          const initialCode = Math.floor(
            1000 + Math.random() * 9000,
          ).toString();

          // 2. Insert into Supabase WITH the coordinates
          const {data, error} = await supabase
            .from('sessions')
            .insert({
              class_name: subjectName,
              room_number: room,
              teacher_id: user?.id,
              subject_id:
                selectedSubjectId && selectedSubjectId < 900
                  ? selectedSubjectId
                  : null,
              target_course: targetCourse,
              target_year: targetYear,
              target_semester: targetSemester,
              target_batch: selectedBatch,
              beacon_id: newBeaconId,
              active_code: initialCode,
              is_active: true,
              gps_lat: latitude, // ✅ Added
              gps_long: longitude, // ✅ Added
            })
            .select()
            .single();

          if (error) throw error;

          if (onClassCreated) {
            onClassCreated({
              ...data,
              class_name: subjectName,
              room_number: room,
            });
          }
          onBack();
        } catch (err: any) {
          Alert.alert('Database Error', err.message);
        } finally {
          setLoading(false);
        }
      },
      error => {
        setLoading(false);
        Alert.alert(
          'GPS Error',
          'Could not get your location. Please check if GPS is on.',
        );
        console.error(error);
      },
      {enableHighAccuracy: true, timeout: 15000, maximumAge: 10000},
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
        {/* <View style={styles.card}>
          <View style={styles.rowBetween}>
            <View>
              <Text style={styles.label}>Instant Mode</Text>
              <Text style={styles.subLabel}>Broadcast immediately</Text>
            </View>
            <Switch
              value={isAdHoc}
              onValueChange={setIsAdHoc}
              trackColor={{false: '#E0E0E0', true: '#90CAF9'}}
              thumbColor={isAdHoc ? '#2196F3' : '#f4f3f4'}
            />
          </View>
        </View> */}

        {/* ✅ FIX: Quick Select is BACK and visible immediately */}
        <View style={styles.quickSelectContainer}>
          <Text style={styles.sectionHeader}>
            Quick Select Assigned Subject
          </Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.quickSelectScroll}>
            {subjects.length > 0 ? (
              subjects.map(sub => (
                <TouchableOpacity
                  key={sub.id}
                  style={[
                    styles.subjectChip,
                    selectedSubjectId === sub.id && styles.subjectChipActive,
                  ]}
                  onPress={() => selectSubject(sub)}>
                  <Text
                    style={[
                      styles.chipText,
                      selectedSubjectId === sub.id && styles.chipTextActive,
                    ]}>
                    {sub.code} {/* 🎯 Use Code (e.g. CSC402) for the chip UI */}
                  </Text>
                </TouchableOpacity>
              ))
            ) : (
              <Text style={styles.emptyText}>No subjects assigned to you.</Text>
            )}
          </ScrollView>
        </View>

        {/* --- 🎯 TARGET AUDIENCE SECTION --- */}
        <View style={styles.card}>
          <Text style={styles.sectionHeader}>Target Students</Text>

          {/* 🎯 Only show Batch Selection if it's NOT a Theory lecture */}
          {selectedBatch !== 'ALL' ? (
            <View style={styles.rowBetween}>
              <Text style={styles.label}>Batch Selection: </Text>
              <View style={styles.batchContainer}>
                {['A', 'B', 'C'].map(b => (
                  <TouchableOpacity
                    key={b}
                    onPress={() => setSelectedBatch(b)}
                    style={[
                      styles.miniChip,
                      selectedBatch === b && styles.miniChipActive,
                    ]}>
                    <Text
                      style={[
                        styles.miniChipText,
                        selectedBatch === b && styles.miniChipTextActive,
                      ]}>
                      {b}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          ) : (
            <View style={styles.theoryLockBox}>
              <BookOpen size={16} color="#4CAF50" />
              <Text style={styles.theoryLockText}>
                Full Class (Theory) - No Batch Selection Required
              </Text>
            </View>
          )}
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
              style={[styles.input, {paddingLeft: 40}]}
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
          disabled={loading}>
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
  container: {flex: 1, backgroundColor: '#F5F5F5'},
  header: {
    backgroundColor: '#2196F3',
    padding: 20,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 15,
  },
  headerTitle: {color: '#FFF', fontSize: 20, fontWeight: 'bold'},
  content: {padding: 20},
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
  label: {fontSize: 16, fontWeight: 'bold', color: '#212121'},
  subLabel: {fontSize: 12, color: '#757575', marginTop: 2},
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
  inputIconContainer: {position: 'relative', justifyContent: 'center'},
  inputIcon: {position: 'absolute', left: 12, zIndex: 1},
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
  buttonText: {color: '#FFF', fontSize: 16, fontWeight: 'bold'},
  quickSelectContainer: {
    marginBottom: 20,
    paddingHorizontal: 5,
  },
  quickSelectScroll: {
    marginTop: 10,
    paddingBottom: 5,
  },
  emptyText: {
    fontSize: 13,
    color: '#999',
    fontStyle: 'italic',
    marginTop: 10,
    textAlign: 'center',
  },
  subjectChip: {
    padding: 12,
    backgroundColor: '#F5F5F5',
    borderRadius: 12,
    marginRight: 10,
    minWidth: 100,
    alignItems: 'center',
  },
  subjectChipActive: {
    backgroundColor: '#2196F3',
  },
  chipSubName: {
    fontSize: 10,
    color: '#757575',
    marginTop: 2,
  },
  chipScroll: {flexDirection: 'row'},
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
  chipActive: {backgroundColor: '#2196F3'},
  chipText: {color: '#2196F3', fontWeight: '600'},
  chipTextActive: {color: '#FFF'},
  batchContainer: {
    flexDirection: 'row',
    gap: 8,
  },
  miniChip: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E0E0E0',
    backgroundColor: '#F5F5F5',
  },
  miniChipActive: {
    backgroundColor: '#2196F3',
    borderColor: '#2196F3',
  },
  miniChipText: {
    fontSize: 16,
    color: '#757575',
    fontWeight: 'bold',
  },
  miniChipTextActive: {
    color: '#FFF',
  },
  theoryLockBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F5F5F5', // Light gray background
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E0E0E0',
    marginTop: 5,
    gap: 8,
  },
  theoryLockText: {
    fontSize: 13,
    color: '#4CAF50', // Success green to indicate it's auto-handled
    fontWeight: '600',
    flex: 1,
  },
  targetInfoBox: {
    marginTop: 15,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#F0F0F0',
  },
});
