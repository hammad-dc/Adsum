import React, {useState, useEffect} from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  ScrollView,
  StatusBar,
  TextInput,
} from 'react-native';
import {
  ArrowLeft,
  Bluetooth,
  MapPin,
  CheckCircle,
  Keyboard,
} from 'lucide-react-native';
import {supabase} from './lib/supabase';
import {manager, requestBluetoothPermissions} from './lib/ble';
import Geolocation from 'react-native-geolocation-service';
import {getDistanceFromLatLonInMeters} from './lib/location';

const SERVICE_UUID = '0000AD50-0000-1000-8000-00805F9B34FB';
const SHORT_UUID = 'AD50';
const MAX_DISTANCE_METERS = 50; // Strict 50m limit

export default function MarkAttendance({classSession, onBack}: any) {
  const classData = classSession;
  const [step, setStep] = useState(1);
  const [bleFound, setBleFound] = useState(false);
  const [gpsVerified, setGpsVerified] = useState(false);
  const [currentDist, setCurrentDist] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [isError, setIsError] = useState(false);

  // ✅ FIX #1: Added One-Time Code State
  const [inputCode, setInputCode] = useState('');

  useEffect(() => {
    runChecks();
    return () => {
      manager.stopDeviceScan();
    };
  }, []);

  const runChecks = async () => {
    // 1. Fetch current session rules
    const {data: session} = await supabase
      .from('sessions')
      .select('is_hardware_required')
      .eq('id', classData.id)
      .single();

    if (session?.is_hardware_required === false) {
      // ✅ BYPASS: Teacher allowed code-only attendance
      setBleFound(true);
      setGpsVerified(true);
      return;
    }

    // 🛡️ NORMAL: Run full security checks
    const blePerm = await requestBluetoothPermissions();
    if (blePerm) scanForTeacher();
    checkLocation();
  };

  const scanForTeacher = () => {
    manager.startDeviceScan(null, {allowDuplicates: false}, (error, device) => {
      if (error) return;
      if (device && device.serviceUUIDs) {
        const match = device.serviceUUIDs.some(
          uuid =>
            uuid.toUpperCase().includes(SHORT_UUID) ||
            uuid.toUpperCase() === SERVICE_UUID.toUpperCase(),
        );
        if (match) {
          setBleFound(true);
          manager.stopDeviceScan();
        }
      }
    });
    setTimeout(() => manager.stopDeviceScan(), 15000);
  };

  const checkLocation = () => {
    const targetLat = classData.gps_lat;
    const targetLong = classData.gps_long;

    if (!targetLat || targetLat === 0) return;

    Geolocation.getCurrentPosition(
      position => {
        const {latitude, longitude} = position.coords;
        const dist = getDistanceFromLatLonInMeters(
          latitude,
          longitude,
          targetLat,
          targetLong,
        );
        setCurrentDist(Math.round(dist));

        if (dist <= MAX_DISTANCE_METERS) {
          setGpsVerified(true);
        } else {
          setGpsVerified(false);
        }
      },
      error => console.log('GPS Error', error),
      {enableHighAccuracy: true, timeout: 20000, maximumAge: 0},
    );
  };

  const submitAttendance = async () => {
    // 1. Reset state first to force a UI refresh
    setIsError(false);

    if (inputCode !== classData.active_code) {
      // 2. Trigger error state
      setIsError(true);

      // 3. Clear it after a delay so the user sees a "flash" of red
      setTimeout(() => setIsError(false), 2000);

      Alert.alert(
        'Invalid Code',
        `The code ${inputCode} does not match the session code.`,
        [{text: 'Try Again', onPress: () => setInputCode('')}],
      );
      return;
    }

    if (!bleFound && !gpsVerified) {
      Alert.alert('Verification Failed', 'Bluetooth or GPS signal missing.');
      return;
    }

    setLoading(true);
    try {
      const {
        data: {user},
      } = await supabase.auth.getUser();
      if (!user) throw new Error('User session lost. Restart app.');

      const {error} = await supabase.from('attendance').insert({
        session_id: classData.id,
        student_id: user.id,
        status: 'present',
        verification_method: 'biometric', // keeping existing logic
        location_verified: gpsVerified,
        bluetooth_verified: bleFound,
      });

      if (error) {
        if (error.code === '23505') {
          setStep(2);
          return;
        }
        throw error;
      }
      setStep(2);
    } catch (err: any) {
      Alert.alert('Error', err.message);
    } finally {
      setLoading(false);
    }
  };

  if (step === 2) {
    return (
      <View style={styles.container}>
        <StatusBar backgroundColor="#4CAF50" barStyle="light-content" />
        <View style={[styles.centerContainer, {backgroundColor: '#4CAF50'}]}>
          <CheckCircle size={100} color="#FFF" />
          <Text style={styles.successTitle}>Present!</Text>
          <Text style={{color: '#E8F5E9', marginTop: 10, fontSize: 16}}>
            Attendance marked successfully
          </Text>
          <TouchableOpacity style={styles.btnWhite} onPress={onBack}>
            <Text style={styles.btnTextGreen}>Back to Dashboard</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <StatusBar backgroundColor="#2196F3" barStyle="light-content" />
      <View style={styles.header}>
        <TouchableOpacity onPress={onBack}>
          <ArrowLeft color="#FFF" size={24} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Mark Attendance</Text>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.infoCard}>
          <Text style={styles.className}>{classData.class_name}</Text>
          <Text style={styles.roomName}>{classData.room_number}</Text>
        </View>

        <Text style={styles.sectionLabel}>1. SECURITY VERIFICATION</Text>
        <View style={styles.otpOuterContainer}>
          <View style={styles.otpContainer}>
            {[0, 1, 2, 3].map(index => {
              const isFocused = inputCode.length === index;
              const isFilled = inputCode.length > index;

              return (
                <View
                  key={index}
                  style={[
                    styles.otpBox,
                    isFocused && styles.otpBoxActive,
                    isFilled && styles.otpBoxFilled,
                    isError && styles.otpBoxError,
                  ]}>
                  <Text style={styles.otpText}>{inputCode[index] || ''}</Text>
                  {/* Subtle cursor line for the active box */}
                  {isFocused && <View style={styles.activeCursor} />}
                </View>
              );
            })}
          </View>

          <TextInput
            value={inputCode}
            onChangeText={val => {
              const cleaned = val.replace(/[^0-9]/g, '');
              if (cleaned.length <= 4) {
                setInputCode(cleaned);
                setIsError(false); // Reset error status while typing

                // ✅ INSTANT LOGIC: Check as soon as the 4th digit is entered
                if (cleaned.length === 4) {
                  if (cleaned !== classData.active_code) {
                    setIsError(true);
                    // Auto-clear the wrong code after a second so they can try again
                    setTimeout(() => {
                      setIsError(false);
                      setInputCode('');
                    }, 1000);

                    Alert.alert(
                      'Wrong Code',
                      'Verification failed. Try again.',
                    );
                  }
                }
              }
            }}
            keyboardType="number-pad"
            maxLength={4}
            style={styles.hiddenInput}
            autoFocus={true}
          />
        </View>

        <Text style={styles.sectionLabel}>2. SIGNAL CHECKS</Text>
        {/* Bluetooth */}
        <View style={styles.checkCard}>
          <View
            style={[
              styles.iconBox,
              {backgroundColor: bleFound ? '#E8F5E9' : '#FFF3E0'},
            ]}>
            <Bluetooth size={24} color={bleFound ? '#4CAF50' : '#FF9800'} />
          </View>
          <View style={{flex: 1, marginLeft: 15}}>
            <Text style={styles.checkTitle}>Teacher Beacon</Text>
            <Text style={styles.checkStatus}>
              {bleFound ? 'Signal Verified' : 'Scanning...'}
            </Text>
          </View>
          {bleFound ? (
            <CheckCircle color="#4CAF50" />
          ) : (
            <ActivityIndicator size="small" color="#FF9800" />
          )}
        </View>

        {/* GPS */}
        <View style={styles.checkCard}>
          <View
            style={[
              styles.iconBox,
              {backgroundColor: gpsVerified ? '#E8F5E9' : '#FFEBEE'},
            ]}>
            <MapPin size={24} color={gpsVerified ? '#4CAF50' : '#F44336'} />
          </View>
          <View style={{flex: 1, marginLeft: 15}}>
            <Text style={styles.checkTitle}>Location Check</Text>
            <Text style={styles.checkStatus}>
              {gpsVerified
                ? `${currentDist}m (Verified)`
                : currentDist
                ? `${currentDist}m (Too Far)`
                : 'Locating...'}
            </Text>
          </View>
          {gpsVerified ? (
            <CheckCircle color="#4CAF50" />
          ) : (
            <ActivityIndicator size="small" color="#2196F3" />
          )}
        </View>

        <TouchableOpacity
          style={[
            styles.btnPrimary,
            !bleFound && !gpsVerified && styles.btnDisabled,
          ]}
          onPress={submitAttendance}
          // Disabled if verification failed OR code is empty
          disabled={
            (!bleFound && !gpsVerified) || loading || inputCode.length !== 4
          }>
          {loading ? (
            <ActivityIndicator color="#FFF" />
          ) : (
            <Text style={styles.btnText}>Submit Attendance</Text>
          )}
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {flex: 1, backgroundColor: '#F5F7FA'},
  centerContainer: {flex: 1, justifyContent: 'center', alignItems: 'center'},
  header: {
    backgroundColor: '#2196F3',
    padding: 20,
    paddingTop: 40,
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerTitle: {
    color: '#FFF',
    fontSize: 18,
    fontWeight: 'bold',
    marginLeft: 15,
  },
  content: {padding: 20},
  infoCard: {
    backgroundColor: '#FFF',
    padding: 20,
    borderRadius: 16,
    marginBottom: 20,
    elevation: 2,
    alignItems: 'center',
  },
  className: {fontSize: 22, fontWeight: 'bold', color: '#333'},
  roomName: {fontSize: 16, color: '#757575', marginTop: 4},
  sectionLabel: {
    fontSize: 13,
    fontWeight: 'bold',
    color: '#9E9E9E',
    marginBottom: 10,
    marginLeft: 5,
    marginTop: 10,
  },
  checkCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF',
    padding: 15,
    borderRadius: 12,
    marginBottom: 15,
    elevation: 1,
  },
  codeCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF',
    padding: 15,
    borderRadius: 12,
    marginBottom: 15,
    elevation: 1,
    gap: 15,
  },
  codeInput: {
    flex: 1,
    fontSize: 18,
    letterSpacing: 5,
    fontWeight: 'bold',
    color: '#333',
    borderBottomWidth: 1,
    borderColor: '#EEE',
  },
  iconBox: {
    width: 45,
    height: 45,
    borderRadius: 23,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkTitle: {fontSize: 16, fontWeight: 'bold', color: '#333'},
  checkStatus: {fontSize: 13, color: '#757575'},
  btnPrimary: {
    backgroundColor: '#2196F3',
    padding: 18,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 10,
    elevation: 3,
  },
  btnDisabled: {backgroundColor: '#B0BEC5', elevation: 0},
  btnText: {color: '#FFF', fontWeight: 'bold', fontSize: 16},
  successTitle: {fontSize: 28, fontWeight: 'bold', color: '#FFF'},
  btnWhite: {
    backgroundColor: '#FFF',
    paddingVertical: 15,
    paddingHorizontal: 40,
    borderRadius: 30,
    marginTop: 40,
  },
  btnTextGreen: {color: '#4CAF50', fontWeight: 'bold', fontSize: 16},

  otpOuterContainer: {
    backgroundColor: '#FFFFFF',
    padding: 24,
    borderRadius: 20,
    marginBottom: 20,
    // Soft professional shadow
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 10},
    shadowOpacity: 0.05,
    shadowRadius: 15,
    elevation: 5,
  },
  otpContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  otpBox: {
    width: 60,
    height: 75,
    borderRadius: 12,
    backgroundColor: '#F8FAFC',
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  otpBoxActive: {
    borderColor: '#2196F3',
    backgroundColor: '#FFFFFF',
    borderWidth: 2,
    // Lift the active box slightly
    transform: [{translateY: -2}],
  },
  otpBoxFilled: {
    borderColor: '#2196F3',
    backgroundColor: '#F0F9FF',
  },
  otpBoxError: {
    borderColor: '#EF4444',
    backgroundColor: '#FEF2F2',
  },
  otpText: {
    fontSize: 28,
    fontWeight: '700',
    color: '#1E293B',
  },
  activeCursor: {
    position: 'absolute',
    bottom: 15,
    width: 20,
    height: 3,
    backgroundColor: '#2196F3',
    borderRadius: 2,
  },
  hiddenInput: {
    position: 'absolute',
    opacity: 0,
    width: '100%',
    height: '100%',
  },
});
