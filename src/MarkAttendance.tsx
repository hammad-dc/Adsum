import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native';
import {
  ArrowLeft,
  Bluetooth,
  MapPin,
  Check,
  AlertCircle,
  ChevronDown,
  Loader, // Ensure this is just 'Loader', not 'Loader2'
} from 'lucide-react-native';
import { supabase } from './lib/supabase';

export default function MarkAttendance({
  classSession = { name: 'Data Structures', room: 'Lab 301' },
  onBack,
  onSuccess,
}: any) {
  const [bluetoothStatus, setBluetoothStatus] = useState<
    'searching' | 'connected' | 'failed'
  >('searching');
  const [locationStatus, setLocationStatus] = useState<
    'searching' | 'verified' | 'failed'
  >('searching');
  const [code, setCode] = useState(['', '', '', '']);
  const [codeExpiry, setCodeExpiry] = useState(38);
  const [showHelp, setShowHelp] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // FIX: Explicitly type the ref array
  const inputRefs = useRef<(TextInput | null)[]>([]);

  useEffect(() => {
    // Mock Checks
    setTimeout(() => setBluetoothStatus('connected'), 2000);
    setTimeout(() => setLocationStatus('verified'), 1500);

    const timer = setInterval(() => {
      setCodeExpiry(prev => (prev <= 1 ? 45 : prev - 1));
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const handleCodeChange = (text: string, index: number) => {
    if (text.length > 1) return;
    const newCode = [...code];
    newCode[index] = text;
    setCode(newCode);

    // Auto-focus next
    if (text && index < 3) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  const handleSubmit = async () => {
    const enteredCode = code.join('');

    // --- DEBUGGING: Uncomment this if you are still stuck ---
    // Alert.alert("Debug Info", `You typed: ${enteredCode}\nReal Code: ${classSession.active_code}`);

    // 1. VALIDATION CHECK
    // If the database code is empty or doesn't match what you typed -> FAIL
    if (!classSession.active_code || enteredCode !== classSession.active_code) {
      Alert.alert('Wrong Code', 'The code you entered is incorrect.');
      setCode(['', '', '', '']); // Clear boxes
      inputRefs.current[0]?.focus(); // Focus first box
      return; // <--- STOP HERE! Do not proceed to save.
    }

    setIsSubmitting(true);

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error('No user found');

      // 2. CHECK DUPLICATES
      // Did this student already mark attendance for this session?
      const { data: existing } = await supabase
        .from('attendance')
        .select('*')
        .eq('session_id', classSession.id)
        .eq('student_id', user.id)
        .single();

      if (existing) {
        Alert.alert(
          'Duplicate',
          'You have already marked attendance for this class.',
        );
        if (onSuccess) onSuccess();
        return;
      }

      // 3. SUCCESS: SAVE TO DB
      const { error } = await supabase.from('attendance').insert({
        session_id: classSession.id,
        student_id: user.id,
        status: 'present',
        verification_method: 'code',
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

  const renderStatusStep = (
    type: 'bt' | 'gps',
    status: string,
    label: string,
    subLabel: string,
  ) => {
    let color =
      status === 'searching'
        ? '#FF9800'
        : status === 'verified' || status === 'connected'
        ? '#4CAF50'
        : '#F44336';
    let Icon =
      status === 'verified' || status === 'connected' ? Check : AlertCircle;

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
            <Text style={styles.headerTitle}>{classSession.name}</Text>
            <Text style={styles.headerSub}>{classSession.room}</Text>
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
              bluetoothStatus === 'connected'
                ? 'Connected to Teacher'
                : 'Ensure Bluetooth is On',
            )}
            <View style={{ height: 10 }} />
            {renderStatusStep(
              'gps',
              locationStatus,
              locationStatus === 'verified'
                ? 'Location Verified'
                : 'Checking GPS...',
              locationStatus === 'verified'
                ? 'Accuracy: 12m'
                : 'Stand inside the room',
            )}
          </View>

          {/* OTP Input */}
          <View style={styles.card}>
            <Text style={styles.centerLabel}>Enter Code from Board</Text>
            <Text style={styles.timerText}>Code expires in {codeExpiry}s</Text>

            <View style={styles.otpContainer}>
              {code.map((digit, index) => (
                <TextInput
                  key={index}
                  // FIX: Explicit Ref Type Casting
                  ref={ref => {
                    if (ref) inputRefs.current[index] = ref;
                  }}
                  style={styles.otpBox}
                  keyboardType="numeric"
                  maxLength={1}
                  value={digit}
                  onChangeText={text => handleCodeChange(text, index)}
                  onKeyPress={({ nativeEvent }) => {
                    if (
                      nativeEvent.key === 'Backspace' &&
                      !code[index] &&
                      index > 0
                    ) {
                      inputRefs.current[index - 1]?.focus();
                    }
                  }}
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

          <TouchableOpacity
            style={styles.helpCard}
            onPress={() => setShowHelp(!showHelp)}
          >
            <Text style={{ color: '#212121' }}>Troubleshooting</Text>
            <ChevronDown size={20} color="#757575" />
          </TouchableOpacity>
          {showHelp && (
            <View style={styles.helpContent}>
              <Text style={styles.helpText}>• Turn on Bluetooth</Text>
              <Text style={styles.helpText}>• Allow Location Permissions</Text>
            </View>
          )}
        </ScrollView>

        <View style={styles.footer}>
          <TouchableOpacity
            style={[
              styles.submitButton,
              (!code.every(d => d !== '') || bluetoothStatus !== 'connected') &&
                styles.disabledButton,
            ]}
            onPress={handleSubmit}
            disabled={!code.every(d => d !== '') || isSubmitting}
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
  helpCard: {
    backgroundColor: '#FFF',
    padding: 15,
    borderRadius: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    elevation: 1,
  },
  helpContent: {
    padding: 15,
    backgroundColor: '#FAFAFA',
    marginTop: 2,
    borderRadius: 8,
  },
  helpText: { color: '#757575', marginBottom: 5 },
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
