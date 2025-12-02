import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  PermissionsAndroid,
} from 'react-native';
import {
  ArrowLeft,
  Bluetooth,
  MapPin,
  Check,
  AlertCircle,
  ChevronDown,
  Loader,
} from 'lucide-react-native';
import { supabase } from './lib/supabase';
import Geolocation from 'react-native-geolocation-service';
import {
  CLASSROOM_LOCATION,
  getDistanceFromLatLonInMeters,
} from './lib/location';

export default function MarkAttendance({
  classSession,
  onBack,
  onSuccess,
}: any) {
  const [bluetoothStatus, setBluetoothStatus] = useState<
    'searching' | 'connected' | 'failed'
  >('searching');
  const [locationStatus, setLocationStatus] = useState<
    'searching' | 'verified' | 'failed'
  >('searching');
  const [distance, setDistance] = useState<number | null>(null);
  const [code, setCode] = useState(['', '', '', '']);
  const [codeExpiry, setCodeExpiry] = useState(45);
  const [showHelp, setShowHelp] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const inputRefs = useRef<(TextInput | null)[]>([]);

  useEffect(() => {
    // 1. Bluetooth (Still Mock for now)
    setTimeout(() => setBluetoothStatus('connected'), 1000);

    // 2. Real GPS Check
    checkLocation();

    const timer = setInterval(() => {
      setCodeExpiry(prev => (prev <= 1 ? 45 : prev - 1));
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const checkLocation = async () => {
    try {
      // A. Request Permission
      if (Platform.OS === 'android') {
        const granted = await PermissionsAndroid.request(
          PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
        );
        if (granted !== PermissionsAndroid.RESULTS.GRANTED) {
          setLocationStatus('failed');
          Alert.alert('Permission Denied', 'Location access is required.');
          return;
        }
      }

      // B. Get Position
      Geolocation.getCurrentPosition(
        position => {
          const { latitude, longitude } = position.coords;

          // C. Calculate Distance
          const dist = getDistanceFromLatLonInMeters(
            latitude,
            longitude,
            CLASSROOM_LOCATION.latitude,
            CLASSROOM_LOCATION.longitude,
          );

          setDistance(Math.round(dist));

          if (dist <= CLASSROOM_LOCATION.radius) {
            setLocationStatus('verified');
          } else {
            setLocationStatus('failed');
          }
        },
        error => {
          console.log(error.code, error.message);
          setLocationStatus('failed');
        },
        { enableHighAccuracy: true, timeout: 15000, maximumAge: 10000 },
      );
    } catch (err) {
      setLocationStatus('failed');
    }
  };

  const handleCodeChange = (text: string, index: number) => {
    if (text.length > 1) return;
    const newCode = [...code];
    newCode[index] = text;
    setCode(newCode);
    if (text && index < 3) inputRefs.current[index + 1]?.focus();
  };

  const handleSubmit = async () => {
    // Block if location failed (Security Feature)
    if (locationStatus !== 'verified') {
      Alert.alert(
        'Location Error',
        `You are ${distance}m away. You must be within ${CLASSROOM_LOCATION.radius}m.`,
      );
      return;
    }

    const enteredCode = code.join('');

    // Validate Code
    if (!classSession.active_code || enteredCode !== classSession.active_code) {
      Alert.alert('Wrong Code', 'The code you entered is incorrect.');
      setCode(['', '', '', '']);
      inputRefs.current[0]?.focus();
      return;
    }

    setIsSubmitting(true);

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error('No user found');

      // Check Duplicates
      const { data: existing } = await supabase
        .from('attendance')
        .select('*')
        .eq('session_id', classSession.id)
        .eq('student_id', user.id)
        .single();

      if (existing) {
        Alert.alert('Duplicate', 'You have already marked attendance.');
        if (onSuccess) onSuccess();
        return;
      }

      // Save to DB
      const { error } = await supabase.from('attendance').insert({
        session_id: classSession.id,
        student_id: user.id,
        status: 'present',
        verification_method: 'gps_code',
        gps_lat: 0, // Placeholder
        gps_long: 0, // Placeholder
      });

      if (error) throw error;

      Alert.alert('Success', 'Attendance Marked! ✅');
      if (onSuccess) onSuccess();
    } catch (err: any) {
      Alert.alert('Error', err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  // --- UI Components ---
  const renderStatusStep = (
    type: 'bt' | 'gps',
    status: string,
    label: string,
    subLabel: string,
  ) => {
    let color =
      status === 'searching'
        ? '#FF9800'
        : status === 'verified'
        ? '#4CAF50'
        : '#F44336';
    let Icon = status === 'verified' ? Check : AlertCircle;

    return (
      <View style={styles.statusCard}>
        <View style={[styles.statusIconCircle, { backgroundColor: color }]}>
          {status === 'searching' ? (
            <ActivityIndicator color="#FFF" size="small" />
          ) : (
            <Icon color="#FFF" size={16} />
          )}
        </View>
        <View style={{ marginLeft: 12 }}>
          <View style={styles.row}>
            {type === 'bt' ? (
              <Bluetooth size={16} color="#757575" />
            ) : (
              <MapPin size={16} color="#757575" />
            )}
            <Text style={styles.statusLabel}>{label}</Text>
          </View>
          <Text style={styles.statusSub}>{subLabel}</Text>
        </View>
      </View>
    );
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={{ flex: 1 }}
    >
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={onBack}>
            <ArrowLeft color="#FFF" size={24} />
          </TouchableOpacity>
          <View style={{ flex: 1, alignItems: 'center' }}>
            <Text style={styles.headerTitle}>
              {classSession.subjects?.name || classSession.class_name}
            </Text>
            <Text style={styles.headerSub}>
              {classSession.room_number || 'Room TBD'}
            </Text>
          </View>
          <View style={{ width: 24 }} />
        </View>

        <ScrollView contentContainerStyle={styles.content}>
          <View style={{ marginBottom: 20 }}>
            {renderStatusStep(
              'bt',
              bluetoothStatus,
              bluetoothStatus === 'connected'
                ? 'Classroom Detected'
                : 'Searching Beacon...',
              'Proximity Verified',
            )}
            <View style={{ height: 10 }} />

            {/* GPS STATUS */}
            {renderStatusStep(
              'gps',
              locationStatus,
              locationStatus === 'verified'
                ? 'Location Verified'
                : locationStatus === 'failed'
                ? 'Location Mismatch'
                : 'Checking GPS...',
              locationStatus === 'verified'
                ? `Within ${distance}m of class`
                : distance
                ? `You are ${distance}m away!`
                : 'Locating...',
            )}
          </View>

          <View style={styles.card}>
            <Text style={styles.centerLabel}>Enter Code from Board</Text>
            <Text style={styles.timerText}>Code expires in {codeExpiry}s</Text>

            <View style={styles.otpContainer}>
              {code.map((digit, index) => (
                <TextInput
                  key={index}
                  ref={ref => {
                    if (ref) inputRefs.current[index] = ref;
                  }}
                  style={styles.otpBox}
                  keyboardType="numeric"
                  maxLength={1}
                  value={digit}
                  onChangeText={text => handleCodeChange(text, index)}
                />
              ))}
            </View>
            <View style={styles.timerBarBg}>
              <View
                style={[
                  styles.timerBarFill,
                  { width: `${(codeExpiry / 45) * 100}%` },
                ]}
              />
            </View>
          </View>
        </ScrollView>

        <View style={styles.footer}>
          <TouchableOpacity
            style={[
              styles.submitButton,
              locationStatus !== 'verified' && styles.disabledButton,
            ]}
            onPress={handleSubmit}
            disabled={locationStatus !== 'verified' || isSubmitting}
          >
            {isSubmitting ? (
              <ActivityIndicator color="#FFF" />
            ) : (
              <Text style={styles.submitText}>Submit Attendance</Text>
            )}
          </TouchableOpacity>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F5F5F5' },
  header: {
    backgroundColor: '#2196F3',
    padding: 20,
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerTitle: { color: '#FFF', fontSize: 18, fontWeight: 'bold' },
  headerSub: { color: '#BBDEFB', fontSize: 14 },
  content: { padding: 20 },
  statusCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF',
    padding: 15,
    borderRadius: 12,
    elevation: 1,
  },
  statusIconCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  statusLabel: { color: '#212121', fontWeight: '600' },
  statusSub: { color: '#757575', fontSize: 12, marginTop: 2 },
  card: {
    backgroundColor: '#FFF',
    padding: 20,
    borderRadius: 12,
    alignItems: 'center',
    elevation: 2,
    marginBottom: 15,
  },
  centerLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#212121',
    marginBottom: 5,
  },
  timerText: { color: '#FF9800', fontSize: 14, marginBottom: 20 },
  otpContainer: { flexDirection: 'row', gap: 10, marginBottom: 20 },
  otpBox: {
    width: 50,
    height: 50,
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 8,
    textAlign: 'center',
    fontSize: 24,
    color: '#212121',
    backgroundColor: '#FAFAFA',
  },
  timerBarBg: {
    width: '100%',
    height: 6,
    backgroundColor: '#E3F2FD',
    borderRadius: 3,
  },
  timerBarFill: { height: 6, backgroundColor: '#FF9800', borderRadius: 3 },
  footer: {
    padding: 20,
    backgroundColor: '#FFF',
    borderTopWidth: 1,
    borderColor: '#E0E0E0',
  },
  submitButton: {
    backgroundColor: '#2196F3',
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
  },
  disabledButton: { backgroundColor: '#BDBDBD' },
  submitText: { color: '#FFF', fontWeight: 'bold', fontSize: 16 },
});
