import React, {useRef, useState, useEffect, useCallback} from 'react';
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
  BackHandler,
  Linking,
  Platform,
  PermissionsAndroid,
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
import DeviceInfo from 'react-native-device-info';

const SERVICE_UUID = '0000AD50-0000-1000-8000-00805F9B34FB';
const SHORT_UUID = 'AD50';
const MAX_DISTANCE_METERS = 50; // Strict 50m limit

export default function MarkAttendance({classSession: classData, onBack}: any) {
  const bleIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const bleTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const [step, setStep] = useState(1);
  const [bleFound, setBleFound] = useState(false);
  const [gpsVerified, setGpsVerified] = useState(false);
  const [currentDist, setCurrentDist] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [isError, setIsError] = useState(false);
  const [isHardwareRequired, setIsHardwareRequired] = useState(true);
  const [isAlreadyMarked, setIsAlreadyMarked] = useState(false);
  const [liveCode, setLiveCode] = useState(classData.active_code);
  const [bleStatus, setBleStatus] = useState<
    'checking' | 'verified' | 'failed'
  >('checking');
  const [gpsStatus, setGpsStatus] = useState<
    'checking' | 'verified' | 'too_far' | 'failed'
  >('checking');
  //  Added One-Time Code State
  const [inputCode, setInputCode] = useState('');

  const decodeBase64ToBytes = (base64Str: string): number[] => {
    const chars =
      'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
    const lookup = new Uint8Array(256);
    for (let i = 0; i < chars.length; i++) lookup[chars.charCodeAt(i)] = i;

    const bufferLength = base64Str.length * 0.75;
    const bytes = new Uint8Array(bufferLength);
    let p = 0;

    for (let i = 0; i < base64Str.length; i += 4) {
      const base64Bytes = [
        lookup[base64Str.charCodeAt(i)],
        lookup[base64Str.charCodeAt(i + 1)],
        lookup[base64Str.charCodeAt(i + 2)],
        lookup[base64Str.charCodeAt(i + 3)],
      ];

      const bytesValue =
        (base64Bytes[0] << 18) |
        (base64Bytes[1] << 12) |
        (base64Bytes[2] << 6) |
        base64Bytes[3];
      bytes[p++] = (bytesValue >> 16) & 255;
      bytes[p++] = (bytesValue >> 8) & 255;
      bytes[p++] = bytesValue & 255;
    }
    return Array.from(bytes);
  };

  useEffect(() => {
    const channel = supabase
      .channel(`session_${classData.id}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'sessions',
          filter: `id=eq.${classData.id}`,
        },
        payload => {
          if (payload.new.active_code) {
            setLiveCode(payload.new.active_code);
          }
        },
      )
      .subscribe();

    runChecks();
    const backAction = () => {
      onBack(); // Trigger the standard back navigation passed as a prop
      return true; // Tells Android we handled the press
    };

    const backHandler = BackHandler.addEventListener(
      'hardwareBackPress',
      backAction,
    );

    return () => {
      supabase.removeChannel(channel);
      manager.stopDeviceScan(); // Stop BLE scan
      backHandler.remove(); // Stop listening for back button

      // This ensures the loop is permanently killed when leaving the screen
      if (bleIntervalRef.current) {
        clearInterval(bleIntervalRef.current);
        bleIntervalRef.current = null;
      }

      if (bleTimeoutRef.current) {
        clearTimeout(bleTimeoutRef.current);
        bleTimeoutRef.current = null;
      }
    };
  }, [classData.id]);

  const scanForTeacher = useCallback(() => {
    setBleStatus('checking');

    const expectedMajor = Math.floor(classData.id / 65536);
    const expectedMinor = classData.id % 65536;

    const performScan = async () => {
      const state = await manager.state();
      if (state !== 'PoweredOn') return;

      // Anti-Spam tracker for the terminal
      const loggedDevicesInBurst = new Set();

      manager.startDeviceScan(null, {}, (error, device) => {
        if (error) return;
        if (!device?.id || !device?.manufacturerData) return;

        try {
          const decodedBytes = decodeBase64ToBytes(device.manufacturerData);

          let isMatch = false;

          // UNIVERSAL SCANNER: Slide through the array looking for our exact 4-byte signature
          // This works no matter how many random bytes Samsung or Xiaomi injects at the start
          for (let i = 0; i < decodedBytes.length - 3; i++) {
            if (
              decodedBytes[i] === 255 &&
              decodedBytes[i + 1] === 0 &&
              decodedBytes[i + 2] === expectedMajor &&
              decodedBytes[i + 3] === expectedMinor
            ) {
              isMatch = true;
              break; // Sequence found, stop looking
            }
          }

          if (isMatch) {
            console.log(
              `✅ MATCH FOUND FOR CLASS ${
                classData.id
              }! Array was: [${decodedBytes.join(', ')}]`,
            );

            setBleFound(true);
            setBleStatus('verified');

            if (bleTimeoutRef.current) {
              clearTimeout(bleTimeoutRef.current);
              bleTimeoutRef.current = null;
            }

            manager.stopDeviceScan();
            if (bleIntervalRef.current) {
              clearInterval(bleIntervalRef.current);
              bleIntervalRef.current = null;
            }
          }
          // Optional: Only log devices that have our Company ID (255) but didn't match the class, to help debug
          else if (decodedBytes.includes(255)) {
            if (!loggedDevicesInBurst.has(device.id)) {
              loggedDevicesInBurst.add(device.id);
              console.log(
                `🔎 Saw Adsum App, but wrong class. Array: [${decodedBytes.join(
                  ', ',
                )}]`,
              );
            }
          }
        } catch (e) {
          // Silently ignore parse errors
        }
      });

      // Pause hardware scanner after 3 seconds
      setTimeout(() => manager.stopDeviceScan(), 3000);
    };

    performScan();

    bleTimeoutRef.current = setTimeout(() => {
      setBleStatus('failed');
      manager.stopDeviceScan();

      if (bleIntervalRef.current) {
        clearInterval(bleIntervalRef.current);
        bleIntervalRef.current = null;
      }

      bleTimeoutRef.current = null;
      //bluetooth scanning turns of after below given seconds
    }, 20000);

    bleIntervalRef.current = setInterval(performScan, 5000);
  }, [classData.id, bleFound]);

  const requestLocationPermission = async () => {
    if (Platform.OS === 'android') {
      try {
        const granted = await PermissionsAndroid.request(
          PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
          {
            title: 'Location Permission Required',
            message:
              'Adsum needs access to your GPS to verify you are inside the classroom geofence.',
            buttonNeutral: 'Ask Me Later',
            buttonNegative: 'Cancel',
            buttonPositive: 'Allow',
          },
        );
        return granted === PermissionsAndroid.RESULTS.GRANTED;
      } catch (err) {
        console.warn(err);
        return false;
      }
    }
    return true; // iOS handles permissions natively via Info.plist
  };
  const runChecks = useCallback(async () => {
    const {data: session} = await supabase
      .from('sessions')
      .select('is_hardware_required, gps_lat, gps_long')
      .eq('id', classData.id)
      .single();

    const hardwareNeeded = session?.is_hardware_required ?? true;
    setIsHardwareRequired(hardwareNeeded);

    if (!hardwareNeeded) {
      setBleFound(true);
      setGpsVerified(true);
      return;
    }
    //Check Bluetooth State First
    const bleState = await manager.state();
    if (bleState === 'PoweredOff') {
      Alert.alert(
        'Bluetooth is Off',
        'Please turn on Bluetooth to connect to the teacher beacon.',
        [
          {
            text: 'Cancel',
            style: 'cancel',
            onPress: () => setBleStatus('failed'),
          },
          {
            text: 'Open Settings',
            onPress: () =>
              Platform.OS === 'ios'
                ? Linking.openURL('App-Prefs:Bluetooth')
                : Linking.sendIntent('android.settings.BLUETOOTH_SETTINGS'),
          },
        ],
      );
      return; // Stop execution until they turn it on
    }
    const blePerm = await requestBluetoothPermissions();
    if (blePerm) scanForTeacher();
    else setBleStatus('failed');

    const locPerm = await requestLocationPermission();
    if (locPerm) checkLocation(session?.gps_lat, session?.gps_long);
    else setGpsStatus('failed');
    
  }, [classData.id, scanForTeacher]);

  const checkLocation = (targetLat: number, targetLong: number) => {

    setGpsStatus('checking');
    setGpsVerified(false);
    setCurrentDist(null);

    if (!targetLat || !targetLong) {
      setGpsStatus('failed');
      return;
    }

    Geolocation.getCurrentPosition(
      position => {
        const {latitude, longitude} = position.coords;

        const dist = getDistanceFromLatLonInMeters(
          latitude,
          longitude,
          targetLat,
          targetLong,
        );

        const roundedDistance = Math.round(dist);
        setCurrentDist(roundedDistance);

        if (dist <= MAX_DISTANCE_METERS) {
          setGpsVerified(true);
          setGpsStatus('verified');
        } else {
          setGpsVerified(false);
          setGpsStatus('too_far');
        }
      },
      error => {
        console.log('GPS Error', error);
        setGpsVerified(false);
        setGpsStatus('failed');

        // Code 2: POSITION_UNAVAILABLE (GPS is physically turned off)
        if (error.code === 2) {
          Alert.alert(
            'Location is Off',
            "Please swipe down and turn on your phone's Location/GPS services to mark attendance.",
          );
        }
        // Code 1: PERMISSION_DENIED (User blocked the permission popup)
        else if (error.code === 1) {
          Alert.alert(
            'Permission Denied',
            'Adsum needs Location permissions to verify you are in the classroom.',
          );
        }
      },

      {
        enableHighAccuracy: true,
        //gps scanning turns off after below given seconds
        timeout: 20000,
        maximumAge: 0,
      },
    );
  };

  const retryVerification = async () => {
    manager.stopDeviceScan();

    if (bleIntervalRef.current) {
      clearInterval(bleIntervalRef.current);
      bleIntervalRef.current = null;
    }

    if (bleTimeoutRef.current) {
      clearTimeout(bleTimeoutRef.current);
      bleTimeoutRef.current = null;
    }

    setBleFound(false);
    setGpsVerified(false);
    setCurrentDist(null);
    setBleStatus('checking');
    setGpsStatus('checking');

    runChecks();
  };
  const submitAttendance = async () => {
    setIsError(false);

    // 1. Validate Code
    if (inputCode !== liveCode) {
      setIsError(true);
      setTimeout(() => setIsError(false), 2000);
      Alert.alert('Invalid Code', 'The code does not match the session.');
      return;
    }

    // 2. Enforce Hardware Checks ONLY if required
    if (isHardwareRequired) {
      if (!bleFound) {
        Alert.alert(
          'Bluetooth Missing',
          'Teacher beacon not found. Move closer.',
        );
        return;
      }
      if (!gpsVerified) {
        Alert.alert('GPS Error', 'You are outside the classroom geofence.');
        return;
      }
    }

    setLoading(true);
    try {
      const {
        data: {user},
      } = await supabase.auth.getUser();
      if (!user) throw new Error('User session lost.');

      const currentDeviceId = DeviceInfo.getUniqueIdSync();

      const {error} = await supabase.from('attendance').insert({
        session_id: classData.id,
        student_id: user.id,
        status: 'present',
        device_id: currentDeviceId,
        verification_method: isHardwareRequired ? 'biometric' : 'code_only',
        location_verified: gpsVerified,
        bluetooth_verified: bleFound,
      });

      if (error) {
        if (error.code === '23505') {
          // Handle unique constraint
          setIsAlreadyMarked(true);
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
    const theme = isAlreadyMarked
      ? {
          color: '#2196F3',
          title: 'Already Marked!',
          sub: 'You have already recorded your attendance for this session.',
          btnText: '#2196F3',
        }
      : {
          color: '#4CAF50',
          title: 'Present!',
          sub: 'Attendance marked successfully',
          btnText: '#4CAF50',
        };

    return (
      <View style={styles.container}>
        <StatusBar backgroundColor={theme.color} barStyle="light-content" />
        <View style={[styles.centerContainer, {backgroundColor: theme.color}]}>
          <CheckCircle size={100} color="#FFF" />
          <Text style={styles.successTitle}>{theme.title}</Text>
          <Text
            style={{
              color: '#E8F5E9',
              marginTop: 10,
              fontSize: 16,
              textAlign: 'center',
              paddingHorizontal: 30,
            }}>
            {theme.sub}
          </Text>
          <TouchableOpacity style={styles.btnWhite} onPress={() => onBack()}>
            <Text style={[styles.btnTextGreen, {color: theme.btnText}]}>
              Back to Dashboard
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <StatusBar backgroundColor="#2196F3" barStyle="light-content" />
      <View style={styles.header}>
        <TouchableOpacity onPress={() => onBack()}>
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
                  {/*cursor line for the active box */}
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
                setIsError(false);

                if (cleaned.length === 4) {
                  if (cleaned !== classData.active_code) {
                    setIsError(true);
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
        {/* Bluetooth Card */}
        {/* Bluetooth Card */}
        <View
          style={[
            styles.checkCard,
            !isHardwareRequired && {backgroundColor: '#F5F5F5'},
          ]}>
          <View
            style={[
              styles.iconBox,
              {
                backgroundColor: !isHardwareRequired
                  ? '#EEEEEE'
                  : bleStatus === 'verified'
                  ? '#E8F5E9'
                  : bleStatus === 'failed'
                  ? '#FFEBEE'
                  : '#FFF3E0',
              },
            ]}>
            <Bluetooth
              size={24}
              color={
                !isHardwareRequired
                  ? '#9E9E9E'
                  : bleStatus === 'verified'
                  ? '#4CAF50'
                  : bleStatus === 'failed'
                  ? '#D32F2F'
                  : '#FF9800'
              }
            />
          </View>
          <View style={{flex: 1, marginLeft: 15}}>
            <Text
              style={[
                styles.checkTitle,
                !isHardwareRequired && {color: '#757575'},
              ]}>
              Teacher Beacon
            </Text>
            <Text style={styles.checkStatus}>
              {!isHardwareRequired
                ? 'Security Bypassed'
                : bleStatus === 'verified'
                ? 'Signal Verified'
                : bleStatus === 'failed'
                ? 'Beacon not found. Move closer and retry.'
                : 'Searching for teacher beacon...'}
            </Text>
          </View>
          {isHardwareRequired ? (
            bleStatus === 'verified' ? (
              <CheckCircle color="#4CAF50" />
            ) : bleStatus === 'failed' ? (
              <Text style={styles.failedStatus}>Failed</Text>
            ) : (
              <ActivityIndicator size="small" color="#FF9800" />
            )
          ) : (
            <CheckCircle color="#9E9E9E" />
          )}
        </View>

        {/* GPS Card */}
        <View
          style={[
            styles.checkCard,
            !isHardwareRequired && {backgroundColor: '#F5F5F5'},
          ]}>
          <View
            style={[
              styles.iconBox,
              {
                backgroundColor: !isHardwareRequired
                  ? '#EEEEEE'
                  : gpsStatus === 'verified'
                  ? '#E8F5E9'
                  : gpsStatus === 'failed' || gpsStatus === 'too_far'
                  ? '#FFEBEE'
                  : '#E3F2FD',
              },
            ]}>
            <MapPin
              size={24}
              color={
                !isHardwareRequired
                  ? '#9E9E9E'
                  : gpsStatus === 'verified'
                  ? '#4CAF50'
                  : gpsStatus === 'failed' || gpsStatus === 'too_far'
                  ? '#D32F2F'
                  : '#2196F3'
              }
            />
          </View>
          <View style={{flex: 1, marginLeft: 15}}>
            <Text
              style={[
                styles.checkTitle,
                !isHardwareRequired && {color: '#757575'},
              ]}>
              Location Check
            </Text>
            <Text style={styles.checkStatus}>
              {!isHardwareRequired
                ? 'Geofence Disabled'
                : gpsStatus === 'verified'
                ? `${currentDist}m away (Verified)`
                : gpsStatus === 'too_far'
                ? `${currentDist}m away. Move within ${MAX_DISTANCE_METERS}m`
                : gpsStatus === 'failed'
                ? 'Location failed. Check GPS permission and try again.'
                : 'Checking your location...'}
            </Text>
          </View>
          {isHardwareRequired ? (
            gpsStatus === 'verified' ? (
              <CheckCircle color="#4CAF50" />
            ) : gpsStatus === 'failed' || gpsStatus === 'too_far' ? (
              <Text style={styles.failedStatus}>Failed</Text>
            ) : (
              <ActivityIndicator size="small" color="#2196F3" />
            )
          ) : (
            <CheckCircle color="#9E9E9E" />
          )}
        </View>

        {isHardwareRequired &&
          (bleStatus === 'failed' ||
            gpsStatus === 'failed' ||
            gpsStatus === 'too_far') && (
            <TouchableOpacity
              style={styles.retryButton}
              onPress={retryVerification}>
              <Text style={styles.retryText}>Retry Verification</Text>
            </TouchableOpacity>
          )}
        <TouchableOpacity
          style={[
            styles.btnPrimary,
            isHardwareRequired &&
              (!bleFound || !gpsVerified) &&
              styles.btnDisabled,
          ]}
          onPress={submitAttendance}
          // Disabled if verification failed OR code is empty
          disabled={
            loading ||
            inputCode.length !== 4 ||
            (isHardwareRequired && (!bleFound || !gpsVerified))
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
  retryButton: {
    borderWidth: 1,
    borderColor: '#2196F3',
    padding: 14,
    borderRadius: 12,
    alignItems: 'center',
    marginBottom: 15,
  },
  retryText: {
    color: '#2196F3',
    fontWeight: 'bold',
  },
  failedStatus: {
    color: '#D32F2F',
    fontSize: 12,
    fontWeight: 'bold',
  },
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
    width: '22%',
    aspectRatio: 0.8,
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
