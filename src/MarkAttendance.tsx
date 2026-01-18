import React, { useState, useEffect } from 'react';
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
import { supabase } from './lib/supabase';
import { manager, requestBluetoothPermissions } from './lib/ble';
import Geolocation from 'react-native-geolocation-service';
import { getDistanceFromLatLonInMeters } from './lib/location';

const SERVICE_UUID = '0000AD50-0000-1000-8000-00805F9B34FB';
const SHORT_UUID = 'AD50';
const MAX_DISTANCE_METERS = 50; // Strict 50m limit

export default function MarkAttendance({ classSession, onBack }: any) {
  const classData = classSession;
  const [step, setStep] = useState(1);
  const [bleFound, setBleFound] = useState(false);
  const [gpsVerified, setGpsVerified] = useState(false);
  const [currentDist, setCurrentDist] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);

  // ✅ FIX #1: Added One-Time Code State
  const [inputCode, setInputCode] = useState('');

  useEffect(() => {
    runChecks();
    return () => {
      manager.stopDeviceScan();
    };
  }, []);

  const runChecks = async () => {
    const blePerm = await requestBluetoothPermissions();
    if (blePerm) scanForTeacher();
    checkLocation();
  };

  const scanForTeacher = () => {
    manager.startDeviceScan(
      null,
      { allowDuplicates: false },
      (error, device) => {
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
      },
    );
    setTimeout(() => manager.stopDeviceScan(), 15000);
  };

  const checkLocation = () => {
    const targetLat = classData.gps_lat;
    const targetLong = classData.gps_long;

    if (!targetLat || targetLat === 0) return;

    Geolocation.getCurrentPosition(
      position => {
        const { latitude, longitude } = position.coords;
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
      { enableHighAccuracy: true, timeout: 20000, maximumAge: 0 },
    );
  };

  const submitAttendance = async () => {
    // ✅ FIX #6: Strict Code Verification
    if (inputCode !== classData.active_code) {
      Alert.alert(
        'Wrong Code',
        'The code you entered does not match the one on the board.',
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
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error('User session lost. Restart app.');

      const { error } = await supabase.from('attendance').insert({
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
        <View style={[styles.centerContainer, { backgroundColor: '#4CAF50' }]}>
          <CheckCircle size={100} color="#FFF" />
          <Text style={styles.successTitle}>Present!</Text>
          <Text style={{ color: '#E8F5E9', marginTop: 10, fontSize: 16 }}>
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

        <Text style={styles.sectionLabel}>1. SECURITY CODE</Text>
        {/* ✅ FIX #1: Code Input Field */}
        <View style={styles.codeCard}>
          <Keyboard size={24} color="#2196F3" />
          <TextInput
            style={styles.codeInput}
            placeholder="Enter 4-digit Code"
            keyboardType="number-pad"
            maxLength={4}
            value={inputCode}
            onChangeText={setInputCode}
          />
        </View>

        <Text style={styles.sectionLabel}>2. SIGNAL CHECKS</Text>
        {/* Bluetooth */}
        <View style={styles.checkCard}>
          <View
            style={[
              styles.iconBox,
              { backgroundColor: bleFound ? '#E8F5E9' : '#FFF3E0' },
            ]}
          >
            <Bluetooth size={24} color={bleFound ? '#4CAF50' : '#FF9800'} />
          </View>
          <View style={{ flex: 1, marginLeft: 15 }}>
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
              { backgroundColor: gpsVerified ? '#E8F5E9' : '#FFEBEE' },
            ]}
          >
            <MapPin size={24} color={gpsVerified ? '#4CAF50' : '#F44336'} />
          </View>
          <View style={{ flex: 1, marginLeft: 15 }}>
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
          }
        >
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
  container: { flex: 1, backgroundColor: '#F5F7FA' },
  centerContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
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
  content: { padding: 20 },
  infoCard: {
    backgroundColor: '#FFF',
    padding: 20,
    borderRadius: 16,
    marginBottom: 20,
    elevation: 2,
    alignItems: 'center',
  },
  className: { fontSize: 22, fontWeight: 'bold', color: '#333' },
  roomName: { fontSize: 16, color: '#757575', marginTop: 4 },
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
  checkTitle: { fontSize: 16, fontWeight: 'bold', color: '#333' },
  checkStatus: { fontSize: 13, color: '#757575' },
  btnPrimary: {
    backgroundColor: '#2196F3',
    padding: 18,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 10,
    elevation: 3,
  },
  btnDisabled: { backgroundColor: '#B0BEC5', elevation: 0 },
  btnText: { color: '#FFF', fontWeight: 'bold', fontSize: 16 },
  successTitle: { fontSize: 28, fontWeight: 'bold', color: '#FFF' },
  btnWhite: {
    backgroundColor: '#FFF',
    paddingVertical: 15,
    paddingHorizontal: 40,
    borderRadius: 30,
    marginTop: 40,
  },
  btnTextGreen: { color: '#4CAF50', fontWeight: 'bold', fontSize: 16 },
});
