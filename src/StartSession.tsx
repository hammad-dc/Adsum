import React, {useState, useEffect} from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Switch,
  Alert,
  ScrollView,
  BackHandler,
} from 'react-native';
import {requestBluetoothPermissions} from './lib/ble';
import {ArrowLeft, Pause, RefreshCw, Radio, Eye, Radius} from 'lucide-react-native';
import Svg, {Circle} from 'react-native-svg';
import BLEAdvertiser from 'react-native-ble-advertiser';
import Geolocation from 'react-native-geolocation-service';
import {supabase} from './lib/supabase';
import ManualOverride from './ManualOverride';

const APP_UUID = '0000AD50-0000-1000-8000-00805F9B34FB';

export default function StartSession({classSession, onBack}: any) {
  const [className, setClassName] = useState(
    classSession?.class_name || classSession?.name || 'Loading Class...',
  );

  const [beaconActive, setBeaconActive] = useState(false);
  const [currentCode, setCurrentCode] = useState(
    classSession?.active_code || '4892',
  );
  const [codeExpiry, setCodeExpiry] = useState(45);
  const [timerRunning, setTimerRunning] = useState(true);

  const [attendeeCount, setAttendeeCount] = useState(0);
  const [totalStudents, setTotalStudents] = useState(0);
  const [showManual, setShowManual] = useState(false);

  // --- 1. Main Initialization Effect (Runs Once) ---
  useEffect(() => {
    if (!classSession) return;

    const fetchClassName = async () => {
      const {data} = await supabase
        .from('class_sessions') // Verify this table name in your DB
        .select('class_name, name, subject')
        .eq('id', classSession.id)
        .single();
      if (data) {
        setClassName(
          data.class_name || data.name || data.subject || 'Unknown Class',
        );
      }
    };
    fetchClassName();

    // A. Startup Sequence
    const initialize = async () => {
      const granted = await requestBluetoothPermissions();
      if (!granted) {
        Alert.alert(
          'Permission Error',
          'Bluetooth permissions are missing. Please allow "Nearby Devices" in Settings.',
        );
        return;
      }

      BLEAdvertiser.setCompanyId(0xff);

      if (classSession.is_active) {
        startBroadcast();
      }
    };

    initialize();

    // B. Supabase Real-time Sync
    fetchCounts();
    const sub = supabase
      .channel('live-room')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'attendance',
          filter: `session_id=eq.${classSession.id}`,
        },
        payload => fetchCounts(),
      )
      .subscribe();

    // C. Hardware Back Button Handler
    const backHandler = BackHandler.addEventListener(
      'hardwareBackPress',
      () => {
        onBack();
        return true;
      },
    );

    // D. Cleanup (Stop everything when leaving screen)
    return () => {
      stopBroadcast();
      supabase.removeChannel(sub);
      backHandler.remove();
    };
  }, []); // Empty dependency array = Runs only on mount

  // --- 2. Timer Effect (Runs only when timer state changes) ---
  useEffect(() => {
    let timer: NodeJS.Timeout;

    if (timerRunning) {
      timer = setInterval(() => {
        setCodeExpiry(prev => {
          if (prev <= 1) {
            generateNewCode();
            return 45;
          }
          return prev - 1;
        });
      }, 1000);
    }

    return () => clearInterval(timer);
  }, [timerRunning]);

  // --- Helper Functions ---

  const generateNewCode = () => {
    const newCode = Math.floor(1000 + Math.random() * 9000).toString();
    setCurrentCode(newCode);
    supabase
      .from('sessions')
      .update({active_code: newCode})
      .eq('id', classSession.id)
      .then();
    setCodeExpiry(45);
  };

  const fetchCounts = async () => {
    const {count: present} = await supabase
      .from('attendance')
      .select('*', {count: 'exact', head: true})
      .eq('session_id', classSession.id);
    setAttendeeCount(present || 0);

    const {count: total} = await supabase
      .from('profiles')
      .select('*', {count: 'exact', head: true})
      .eq('role', 'student');
    setTotalStudents(total || 0);
  };

  const updateLocation = () => {
    Geolocation.getCurrentPosition(
      pos =>
        supabase
          .from('sessions')
          .update({
            gps_lat: pos.coords.latitude,
            gps_long: pos.coords.longitude,
          })
          .eq('id', classSession.id)
          .then(),
      err => console.log(err),
      {enableHighAccuracy: true},
    );
  };

  const startBroadcast = async () => {
    try {
      console.log('Starting broadcast...');

      // Stop previous signal to prevent hardware clash
      await BLEAdvertiser.stopBroadcast().catch(() => {});

      // Safety Delay for Android Bluetooth hardware
      await new Promise<void>(resolve => setTimeout(() => resolve(), 500));

      await BLEAdvertiser.broadcast(APP_UUID, [12, 34], {
        advertiseMode: 1,
        txPowerLevel: 3,
        connectable: false,
        includeDeviceName: false,
        includeTxPowerLevel: false,
      });

      console.log('Broadcast active');
      setBeaconActive(true);
      updateLocation();
    } catch (e: any) {
      console.log('Broadcast Error:', e);
      setBeaconActive(false);
      Alert.alert(
        'Signal Error',
        'Ensure Bluetooth and GPS are ON in your phone settings.',
      );
    }
  };

  const stopBroadcast = async () => {
    try {
      await BLEAdvertiser.stopBroadcast();
      setBeaconActive(false);
    } catch (e) {}
  };

  const finalizeClass = async () => {
    Alert.alert('End Class?', 'Stop beacon and save attendance?', [
      {text: 'Cancel', style: 'cancel'},
      {
        text: 'End Class',
        style: 'destructive',
        onPress: async () => {
          await stopBroadcast();
          await supabase
            .from('sessions')
            .update({is_active: false})
            .eq('id', classSession.id);
          onBack();
        },
      },
    ]);
  };

  if (!classSession) return null;

  // --- UI Render Calculations ---
  const CIRCLE_SIZE = 220;
  const RADIUS = 95;
  const STROKE_WIDTH = 15;
  const circumference = 2 * Math.PI * RADIUS;
  const strokeDashoffset = circumference * (1 - codeExpiry / 45);
  const center = CIRCLE_SIZE / 2; //Autocalculates center
  const percentage =
    totalStudents > 0 ? Math.round((attendeeCount / totalStudents) * 100) : 0;

  // ... inside your component, find "return (" and replace it with this:

  return (
    <View style={styles.container}>
      {/* ---------------- SLIM HEADER ---------------- */}
      <View style={styles.header}>
        <View style={styles.headerTop}>
          <TouchableOpacity onPress={onBack} style={{padding: 5}}>
            <ArrowLeft color="#FFF" size={32} />
          </TouchableOpacity>
        </View>

        {/* ✅ BIG CLASS NAME (Uses the new variable) */}
        <Text style={styles.headerTitle} numberOfLines={2} adjustsFontSizeToFit>
          {className}
        </Text>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* ---------------- SIGNAL CARD ---------------- */}
        <View style={styles.card}>
          <View style={styles.rowBetween}>
            <View style={styles.row}>
              <View
                style={[
                  styles.iconCircle,
                  {backgroundColor: beaconActive ? '#4CAF50' : '#EEEEEE'},
                ]}>
                <Radio color={beaconActive ? '#FFF' : '#757575'} size={20} />
              </View>
              <View style={{marginLeft: 12}}>
                <Text style={styles.cardTitle}>Live Signal</Text>
                <Text
                  style={{
                    color: beaconActive ? '#4CAF50' : '#757575',
                    fontSize: 11,
                    fontWeight: '600',
                  }}>
                  {beaconActive ? 'Bluetooth & GPS Active' : 'Signal is OFF'}
                </Text>
              </View>
            </View>
            <Switch
              value={beaconActive}
              trackColor={{false: '#E0E0E0', true: '#A5D6A7'}}
              thumbColor={beaconActive ? '#4CAF50' : '#f4f3f4'}
              onValueChange={val => (val ? startBroadcast() : stopBroadcast())}
              style={{transform: [{scaleX: 1.2}, {scaleY: 1.2}]}}
            />
          </View>
        </View>

        {/* ---------------- TIMER CARD (Spaced Out) ---------------- */}
        <View style={[styles.card, styles.centerCard]}>
          <Text style={styles.label}>Attendance Code</Text>

          <TouchableOpacity
            activeOpacity={0.8}
            onPress={() => setTimerRunning(!timerRunning)}
            style={{
              justifyContent: 'center',
              alignItems: 'center',
              marginBottom: 20, 
              marginTop: 20, 
            }}>
            <Svg height={CIRCLE_SIZE} width={CIRCLE_SIZE} viewBox={`0 0 ${CIRCLE_SIZE} ${CIRCLE_SIZE}`}>
              <Circle
                cx={center}
                cy={center}
                r={RADIUS}
                stroke="#F5F5F5"
                strokeWidth={STROKE_WIDTH}
                fill="none"
              />
              <Circle
                cx={center}
                cy={center}
                r={RADIUS}
                stroke={timerRunning ? '#FF9800' : '#BDBDBD'}
                strokeWidth={STROKE_WIDTH}
                fill="none"
                strokeDasharray={circumference}
                strokeDashoffset={strokeDashoffset}
                strokeLinecap="round"
                transform={`rotate(-90 ${center} ${center})`}
              />
            </Svg>

            <View style={{position: 'absolute', alignItems: 'center'}}>
              <Text style={[styles.codeText, !timerRunning && {color: '#CCC'}]}>
                {currentCode}
              </Text>
              {timerRunning ? (
                <>
                  <Text style={styles.expiryText}>{codeExpiry}s left</Text>
                  <Text style={{fontSize: 12, color: '#BDBDBD', marginTop: 4}}>
                    (Tap to Pause)
                  </Text>
                </>
              ) : (
                <View style={{alignItems: 'center', marginTop: 2}}>
                  <Pause size={12} color="#757575" />
                  <Text
                    style={{
                      fontSize: 12,
                      color: '#4CAF50',
                      marginTop: 2,
                      fontWeight: 'bold',
                    }}>
                    Tap to Resume
                  </Text>
                </View>
              )}
            </View>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.outlineButton}
            onPress={generateNewCode}>
            <RefreshCw size={14} color="#757575" style={{marginRight: 6}} />
            <Text style={styles.outlineText}>New Code</Text>
          </TouchableOpacity>
        </View>

        {/* ---------------- PROGRESS BAR ---------------- */}
        <View style={styles.card}>
          <View style={styles.rowBetween}>
            <Text style={styles.statLabel}>
              Present:{' '}
              <Text style={{fontWeight: 'bold', color: '#2196F3'}}>
                {attendeeCount}
              </Text>{' '}
              / {totalStudents}
            </Text>
            <Text style={styles.percentText}>{percentage}%</Text>
          </View>
          <View style={styles.progressBarBg}>
            <View style={[styles.progressBarFill, {width: `${percentage}%`}]} />
          </View>
        </View>

        {/* ---------------- FOOTER (Spread Out) ---------------- */}
        <View style={{marginTop: 10}}>
          <TouchableOpacity
            style={styles.footerButton}
            onPress={() => setShowManual(true)}>
            <Eye size={24} color="#555" style={{marginRight: 8}} />
            <Text style={styles.footerText}>Class List / Manual Attendance</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.footerButton,
              {
                borderColor: '#FFEBEE',
                backgroundColor: '#FFEBEE',
                marginTop: 15,
              },
            ]}
            onPress={finalizeClass}>
            <Text
              style={[
                styles.footerText,
                {color: '#D32F2F', fontWeight: 'bold'},
              ]}>
              End Class & Submit
            </Text>
          </TouchableOpacity>
        </View>

        <View style={{height: 50}} />
      </ScrollView>

      <ManualOverride
        visible={showManual}
        onClose={() => setShowManual(false)}
        classSession={classSession}
        onUpdate={fetchCounts}
      />
    </View>
  );
}

// ================= SLIM & SPREAD STYLES =================
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F2F4F7',
  },

  // --- HEADER (SLIMMED DOWN) ---
  header: {
    backgroundColor: '#2196F3',
    flexDirection: 'row',       // Align items side-by-side
    alignItems: 'center',       // Center vertically
    paddingTop: 10,
    paddingHorizontal: 16,
    paddingBottom: 8,
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
    elevation: 4,
    zIndex: 1,
  },
  headerTop: {
    marginBottom: 0, // Removed gap between arrow and text
    alignItems: 'flex-start',
  },
  headerTitle: {
    color: '#FFF',
    fontSize: 26,      // Big font
    fontWeight: 'bold',
    letterSpacing: 0.3,
    marginLeft: 15,    // ✅ Add space between Arrow and Name
    flex: 1,
  },
  // headerSub removed

  // --- CONTENT (SPREAD OUT) ---
  scrollContent: {
    padding: 16,
    paddingTop: 25,
    flexGrow: 1, // Helps content stretch
  },

  // --- CARDS (Increased spacing between them) ---
  card: {
    backgroundColor: '#FFF',
    borderRadius: 16,
    padding: 20,       // ✅ INCREASED padding from 16 to 24
    marginBottom: 20,
    elevation: 2,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 5,
    shadowOffset: {width: 0, height: 2},
  },
  centerCard: {
    alignItems: 'center',
  },

  // --- ROW HELPERS ---
  row: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  rowBetween: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    width: '100%',
  },

  // --- SIGNAL ICONS ---
  iconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
  cardTitle: {
    fontSize: 17,
    fontWeight: 'bold',
    color: '#333',
  },

  // --- TIMER TEXT ---
  label: {
    fontSize: 14,
    color: '#999',
    marginBottom: 8,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  codeText: {
    fontSize: 38,
    fontWeight: 'bold',
    color: '#2196F3',
    letterSpacing: 1,
  },
  expiryText: {
    fontSize: 13,
    color: '#FF9800',
    fontWeight: '600',
    marginTop: 2,
  },

  // --- BUTTONS ---
  outlineButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#E0E0E0',
    marginTop: 15, // Increased space above button
  },
  outlineText: {
    color: '#757575',
    fontSize: 13,
    fontWeight: '600',
  },

  // --- PROGRESS BAR ---
  statLabel: {
    fontSize: 14,
    color: '#555',
    fontWeight: '500',
  },
  percentText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#4CAF50',
  },
  progressBarBg: {
    height: 8,
    backgroundColor: '#F1F1F1',
    borderRadius: 4,
    marginTop: 10,
    width: '100%',
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: '#4CAF50',
    borderRadius: 4,
  },

  // --- FOOTER BUTTONS ---
  footerButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFF',
    paddingVertical: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  footerText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#555',
  },
});
