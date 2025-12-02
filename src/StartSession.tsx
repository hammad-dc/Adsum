import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Switch,
  Alert,
} from 'react-native';
import {
  ArrowLeft,
  Bluetooth,
  RefreshCw,
  Users,
  Eye,
} from 'lucide-react-native';
import Svg, { Circle } from 'react-native-svg'; // You must install react-native-svg

export default function StartSession({
  classSession = {
    name: 'Data Structures',
    room: 'Lab 301',
    totalStudents: 60,
  },
  onBack,
}: any) {
  const [beaconActive, setBeaconActive] = useState(true);
  const [currentCode, setCurrentCode] = useState('4892');
  const [codeExpiry, setCodeExpiry] = useState(42);
  const [studentsMarked, setStudentsMarked] = useState(12);

  // Timer Logic
  useEffect(() => {
    const timer = setInterval(() => {
      setCodeExpiry(prev => {
        if (prev <= 1) {
          const newCode = Math.floor(1000 + Math.random() * 9000).toString();
          setCurrentCode(newCode);
          return 45;
        }
        return prev - 1;
      });
    }, 1000);

    const studentTimer = setInterval(() => {
      setStudentsMarked(prev =>
        prev < classSession.totalStudents
          ? prev + Math.floor(Math.random() * 2)
          : prev,
      );
    }, 5000);

    return () => {
      clearInterval(timer);
      clearInterval(studentTimer);
    };
  }, []);

  const generateNewCode = () => {
    setCurrentCode(Math.floor(1000 + Math.random() * 9000).toString());
    setCodeExpiry(45);
  };

  // SVG Calculations
  const radius = 100;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference * (1 - codeExpiry / 45);

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={onBack}>
          <ArrowLeft color="#FFF" size={24} />
        </TouchableOpacity>
        <View style={{ marginLeft: 15 }}>
          <Text style={styles.headerTitle}>{classSession.name}</Text>
          <Text style={styles.headerSub}>{classSession.room}</Text>
        </View>
      </View>

      <View style={styles.content}>
        {/* Beacon Status */}
        <View style={styles.card}>
          <View style={styles.rowBetween}>
            <View style={styles.row}>
              <View
                style={[
                  styles.iconCircle,
                  { backgroundColor: beaconActive ? '#4CAF50' : '#BDBDBD' },
                ]}
              >
                <Bluetooth color="#FFF" size={24} />
              </View>
              <View style={{ marginLeft: 12 }}>
                <Text style={styles.cardTitle}>Bluetooth Beacon</Text>
                <Text style={{ color: beaconActive ? '#4CAF50' : '#757575' }}>
                  {beaconActive ? 'Beacon Active' : 'Beacon Inactive'}
                </Text>
              </View>
            </View>
            <Switch
              value={beaconActive}
              onValueChange={setBeaconActive}
              trackColor={{ false: '#E0E0E0', true: '#A5D6A7' }}
              thumbColor={beaconActive ? '#4CAF50' : '#f4f3f4'}
            />
          </View>
        </View>

        {/* Code Display (Circular SVG) */}
        <View style={[styles.card, styles.centerCard]}>
          <Text style={styles.label}>Current Code</Text>
          <View style={styles.circleContainer}>
            <Svg height="240" width="240" viewBox="0 0 240 240">
              {/* Background Circle */}
              <Circle
                cx="120"
                cy="120"
                r="100"
                stroke="#E3F2FD"
                strokeWidth="12"
                fill="none"
              />
              {/* Progress Circle */}
              <Circle
                cx="120"
                cy="120"
                r="100"
                stroke="#FF9800"
                strokeWidth="12"
                fill="none"
                strokeDasharray={circumference}
                strokeDashoffset={strokeDashoffset}
                strokeLinecap="round"
                transform="rotate(-90 120 120)" // Rotate to start from top
              />
            </Svg>
            <View style={styles.codeOverlay}>
              <Text style={styles.codeText}>{currentCode}</Text>
              <Text style={styles.expiryText}>Expires in {codeExpiry}s</Text>
            </View>
          </View>

          <TouchableOpacity
            style={styles.outlineButton}
            onPress={generateNewCode}
          >
            <RefreshCw size={16} color="#757575" style={{ marginRight: 8 }} />
            <Text style={styles.outlineText}>Generate New Code</Text>
          </TouchableOpacity>
        </View>

        {/* Live Attendance Bar */}
        <View style={styles.card}>
          <View style={styles.rowBetween}>
            <View style={styles.row}>
              <Users size={24} color="#2196F3" />
              <View style={{ marginLeft: 12 }}>
                <Text style={styles.label}>Marked Present</Text>
                <Text style={styles.countText}>
                  {studentsMarked} / {classSession.totalStudents}
                </Text>
              </View>
            </View>
            <Text style={styles.percentText}>
              {Math.round((studentsMarked / classSession.totalStudents) * 100)}%
            </Text>
          </View>
          <View style={styles.progressBarBg}>
            <View
              style={[
                styles.progressBarFill,
                {
                  width: `${
                    (studentsMarked / classSession.totalStudents) * 100
                  }%`,
                },
              ]}
            />
          </View>
        </View>
      </View>

      {/* Footer */}
      <View style={styles.footer}>
        <TouchableOpacity
          style={styles.outlineButtonFull}
          onPress={() => Alert.alert('Manual Override')}
        >
          <Text style={styles.blueText}>Mark Manually</Text>
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
  },
  headerTitle: { color: '#FFF', fontSize: 18, fontWeight: 'bold' },
  headerSub: { color: '#BBDEFB', fontSize: 14 },
  content: { padding: 20, flex: 1 },

  card: {
    backgroundColor: '#FFF',
    padding: 20,
    borderRadius: 12,
    marginBottom: 15,
    elevation: 2,
  },
  centerCard: { alignItems: 'center' },
  row: { flexDirection: 'row', alignItems: 'center' },
  rowBetween: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },

  iconCircle: { padding: 10, borderRadius: 25 },
  cardTitle: { fontSize: 16, fontWeight: '600', color: '#212121' },
  label: { color: '#757575', fontSize: 14, marginBottom: 10 },

  // SVG Styles
  circleContainer: {
    position: 'relative',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },
  codeOverlay: { position: 'absolute', alignItems: 'center' },
  codeText: {
    fontSize: 56,
    fontWeight: 'bold',
    color: '#2196F3',
    letterSpacing: 4,
  },
  expiryText: {
    color: '#FF9800',
    fontSize: 14,
    fontWeight: '600',
    marginTop: 5,
  },

  outlineButton: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E0E0E0',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 8,
  },
  outlineText: { color: '#757575', fontWeight: '600' },

  countText: { fontSize: 20, fontWeight: 'bold', color: '#212121' },
  percentText: { fontSize: 24, fontWeight: 'bold', color: '#4CAF50' },
  progressBarBg: {
    height: 8,
    backgroundColor: '#E3F2FD',
    borderRadius: 4,
    marginTop: 15,
    width: '100%',
  },
  progressBarFill: { height: 8, backgroundColor: '#4CAF50', borderRadius: 4 },

  footer: {
    padding: 20,
    backgroundColor: '#FFF',
    borderTopWidth: 1,
    borderColor: '#E0E0E0',
  },
  outlineButtonFull: {
    borderWidth: 1,
    borderColor: '#2196F3',
    padding: 15,
    borderRadius: 8,
    alignItems: 'center',
  },
  blueText: { color: '#2196F3', fontWeight: 'bold', fontSize: 16 },
});
