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
  ActivityIndicator,
  Modal,
  Dimensions,
  StatusBar,
} from 'react-native';
import {manager, requestBluetoothPermissions} from './lib/ble';
import {
  ArrowLeft,
  Pause,
  RefreshCw,
  Radio,
  Eye,
  Radius,
  Info,
} from 'lucide-react-native';
import Svg, {Circle} from 'react-native-svg';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import BLEAdvertiser from 'react-native-ble-advertiser';
import Geolocation from 'react-native-geolocation-service';
import {supabase} from './lib/supabase';
import ManualOverride from './ManualOverride';

const {width: SCREEN_WIDTH} = Dimensions.get('window');
const APP_UUID = '0000AD50-0000-1000-8000-00805F9B34FB';

export default function StartSession({classSession, onBack, onNavigate}: any) {
  // Inside export default function StartSession
  const insets = useSafeAreaInsets();
  const [loading, setLoading] = useState(false);
  const [sessionStarted, setSessionStarted] = useState(false);
  const [className, setClassName] = useState(
    classSession?.class_name || classSession?.name || 'Loading Class...',
  );
  const [isAdHoc, setIsAdHoc] = useState(
    classSession?.is_live_location || false,
  );
  const [beaconActive, setBeaconActive] = useState(false);
  const [currentCode, setCurrentCode] = useState(
    classSession?.active_code || '----',
  );
  const [codeExpiry, setCodeExpiry] = useState(0);
  const [timerRunning, setTimerRunning] = useState(false);
  const [attendeeCount, setAttendeeCount] = useState(0);
  const [totalStudents, setTotalStudents] = useState(0);
  const [showManual, setShowManual] = useState(false);
  const [showBatchPicker, setShowBatchPicker] = useState(false);
  const [selectedBatch, setSelectedBatch] = useState('ALL');

  const updateLocation = () => {
    Geolocation.getCurrentPosition(
      pos => {
        supabase
          .from('sessions')
          .update({
            gps_lat: pos.coords.latitude,
            gps_long: pos.coords.longitude,
          })
          .eq('id', classSession.id)
          .then();
      },
      err => console.log('GPS ERROR:', err),
      {enableHighAccuracy: true, timeout: 15000, maximumAge: 0},
    );
  };

  const startBroadcast = async () => {
    try {
      setLoading(true); // 🎯 Show loading state while hardware starts
      console.log('1. Loading started, requesting permissions...');
      // 1. Double check permissions first
      const granted = await requestBluetoothPermissions();
      console.log('2. Permissions resolved! Granted:', granted);
      
      if (!granted) throw new Error('Permissions missing');

      // 2. Stop any existing broadcast safely
      await BLEAdvertiser.stopBroadcast().catch(() => {});

      // 3. 🎯 CRITICAL: Give Android hardware a second to breathe
      await new Promise(resolve => setTimeout(resolve, 800));

      const major = Math.floor(classSession.id / 65536);
      const minor = classSession.id % 65536;

      BLEAdvertiser.setCompanyId(0xff);
      await BLEAdvertiser.broadcast(APP_UUID, [major, minor], {
        advertiseMode: 1,
        txPowerLevel: 3,
        connectable: false,
        includeDeviceName: false,
      });

      console.log('Broadcast active');
      setBeaconActive(true);
      updateLocation(); //
    } catch (e: any) {
      console.log('Broadcast Error:', e);
      setBeaconActive(false);
      // 🎯 If it fails, give a more specific alert
      Alert.alert(
        'Signal Error',
        'Please toggle your Bluetooth OFF and then ON again to reset the adapter.',
      );
    } finally {
      setLoading(false);
    }
  };

  const stopBroadcast = async () => {
    try {
      await BLEAdvertiser.stopBroadcast();
      setBeaconActive(false);
    } catch (e) {}
  };

  const initialize = async () => {
    const {data: sessData, error} = await supabase
      .from('sessions')
      .select(
        'is_active, active_code, timer_state, frozen_seconds, expires_at, is_live_location,is_hardware_required',
      )
      .eq('id', classSession.id)
      .single();

    if (sessData) {
      // 🎯 If is_active is false, we show "TAP TO START"
      setSessionStarted(sessData.is_active);
      setCurrentCode(sessData.active_code || '----');

      // 🎯 THE MISSING LINK: Restore the Master Switch (Live Signal)
      setBeaconActive(sessData.is_hardware_required || false);

      // Maintain Geofence preference from DB
      setIsAdHoc(sessData.is_live_location || false);

      if (sessData.is_active) {
        // 🎯 Resume logic only if session is already live
        if (sessData.timer_state === 'RUNNING' && sessData.expires_at) {
          const now = new Date().getTime();
          const expiry = new Date(sessData.expires_at).getTime();
          setCodeExpiry(Math.max(0, Math.floor((expiry - now) / 1000)));
          setTimerRunning(true);
        } else {
          setCodeExpiry(sessData.frozen_seconds || 120);
          setTimerRunning(false);
        }
      } else {
        // 🎯 New session defaults
        setCodeExpiry(120);
        setTimerRunning(false);
      }
    }
    fetchCounts();
  };

  const generateNewCode = async () => {
    const newCode = Math.floor(1000 + Math.random() * 9000).toString();
    const nextExpiry = new Date();
    nextExpiry.setSeconds(nextExpiry.getSeconds() + 120);

    setCurrentCode(newCode);
    setCodeExpiry(120);

    await supabase
      .from('sessions')
      .update({
        active_code: newCode,
        expires_at: nextExpiry.toISOString(),
        frozen_seconds: 120,
        timer_state: 'RUNNING',
      })
      .eq('id', classSession.id);
  };

  const fetchCounts = async () => {
    const {count: present} = await supabase
      .from('attendance')
      .select('*', {count: 'exact', head: true})
      .eq('session_id', classSession.id);
    setAttendeeCount(present || 0);

    const activeSemester = classSession.target_semester;
    const query = supabase
      .from('profiles')
      .select('*', {count: 'exact', head: true})
      .eq('role', 'student')
      .eq('semester', activeSemester);

    if (selectedBatch !== 'ALL') {
      query.eq('batch', selectedBatch);
    }
    const {count: total} = await query;
    setTotalStudents(total || 0);
  };

  const handleStartClass = () => {
    // 1. If it's a Lab, we MUST pick a batch first
    if (classSession?.type === 'Lab' || classSession?.subject_type === 'Lab') {
      setShowBatchPicker(true);
    } else {
      // 2. If it's Theory, default to ALL and proceed with hardware check
      setSelectedBatch('ALL');
      triggerSecurityMenu();
    }
  };

  const triggerSecurityMenu = () => {
    // This satisfies your "ask the user what to do" requirement
    Alert.alert(
      '⚠️ Security Setup',
      'Choose the verification level for this class:',
      [
        {
          text: 'Code Only (No Security)',
          onPress: () => confirmStart(false, false),
        },
        {
          text: 'Code + Bluetooth',
          onPress: () => confirmStart(true, false),
        },
        {
          text: 'Full (Signal + GPS)',
          onPress: () => confirmStart(true, true),
        },
        {text: 'Cancel', style: 'cancel'},
      ],
    );
  };

  const confirmStart = async (useSignal: boolean, useGPS: boolean) => {
    setLoading(true);
    try {
      // 1. Set local UI states
      setSessionStarted(true);
      setTimerRunning(true);
      setBeaconActive(useSignal);
      setIsAdHoc(useGPS);

      // 2. Calculate the first expiry point (Current Time + 120s)
      const firstExpiry = new Date();
      firstExpiry.setSeconds(firstExpiry.getSeconds() + 120);

      // 3. Update Supabase to transition the class to 'Active' lifecycle
      await supabase
        .from('sessions')
        .update({
          is_active: true,
          is_hardware_required: useSignal,
          is_live_location: useGPS,
          target_batch: selectedBatch,
          timer_state: 'RUNNING',
          expires_at: firstExpiry.toISOString(),
          frozen_seconds: 120,
        })
        .eq('id', classSession.id);

      // 4. Fire up hardware only if requested
      if (useSignal) {
        await startBroadcast(); // This now internally checks useGPS/isAdHoc
      }
    } catch (error) {
      console.error('Initialization failed:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleModeToggle = async (newValue: boolean) => {
    setLoading(true);
    setIsAdHoc(newValue);

    try {
      if (newValue) {
        // 📡 LIVE MODE: Get fresh GPS
        Geolocation.getCurrentPosition(
          async pos => {
            await supabase
              .from('sessions')
              .update({
                is_live_location: true,
                gps_lat: pos.coords.latitude,
                gps_long: pos.coords.longitude,
              })
              .eq('id', classSession.id);
            setLoading(false);
          },
          err => {
            setLoading(false);
            setIsAdHoc(false);
            Alert.alert('GPS Error', 'Using Fixed Mode instead.');
          },
          {enableHighAccuracy: true, timeout: 15000, maximumAge: 0},
        );
      } else {
        // 🏛️ FIXED MODE: Fetch original room coords from 'classrooms' table
        const {data: roomData} = await supabase
          .from('classrooms')
          .select('gps_lat, gps_long')
          .eq('room_name', classSession.room_number)
          .single();

        await supabase
          .from('sessions')
          .update({
            is_live_location: false,
            gps_lat: roomData?.gps_lat,
            gps_long: roomData?.gps_long,
          })
          .eq('id', classSession.id);

        setLoading(false);
      }
    } catch (e) {
      setLoading(false);
      setIsAdHoc(!newValue);
    }
  };
  //19.1344299
  //72.8437617

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
            .update({
              is_active: false,
              closed_at: new Date().toISOString(), // records the current date
            })
            .eq('id', classSession.id);
          onBack('dashboard');
        },
      },
    ]);
  };

  if (!classSession) return null;

  // --- UI Render Calculations ---
  const CIRCLE_SIZE = SCREEN_WIDTH * 0.58;
  const STROKE_WIDTH = 14;
  const RADIUS = (CIRCLE_SIZE - STROKE_WIDTH) / 2;
  const circumference = 2 * Math.PI * RADIUS;
  const strokeDashoffset = circumference * (1 - codeExpiry / 120);
  const center = CIRCLE_SIZE / 2; //Autocalculates center
  const percentage =
    totalStudents > 0 ? Math.round((attendeeCount / totalStudents) * 100) : 0;

  const toggleTimer = async () => {
    const willBeRunning = !timerRunning;
    setTimerRunning(willBeRunning);

    if (willBeRunning) {
      // 🎯 RESUMING: Set a future "Death Date" based on current countdown
      const newExpiry = new Date();
      newExpiry.setSeconds(newExpiry.getSeconds() + codeExpiry);

      await supabase
        .from('sessions')
        .update({
          timer_state: 'RUNNING',
          expires_at: newExpiry.toISOString(),
        })
        .eq('id', classSession.id);
    } else {
      // 🎯 PAUSING: Freeze the current second in the DB
      await supabase
        .from('sessions')
        .update({
          timer_state: 'PAUSED',
          frozen_seconds: codeExpiry,
          expires_at: null, // Clear the goalpost
        })
        .eq('id', classSession.id);
    }
  };

  useEffect(() => {
    const subscription = manager.onStateChange(state => {
      // 🎯 Only act if the session is LIVE and the beacon should be active
      if (sessionStarted && beaconActive) {
        if (state === 'PoweredOff') {
          // This handles the mid-session manual Bluetooth turn-off
          Alert.alert(
            '⚠️ Signal Lost',
            'Your Bluetooth was turned off. Students can no longer verify their location.',
          );
        } else if (state === 'PoweredOn' && !loading) {
          // Only attempt a restart if we aren't already stuck in a loading state
          startBroadcast();
        }
      }
    });
    return () => subscription.remove();
  }, [beaconActive, sessionStarted]); // 🚀 Runs every time the toggle changes

  // --- 1. Main Initialization Effect (Runs Once) ---
  useEffect(() => {
    if (!classSession?.id) return;

    initialize();

    // D. Real-time Subscription
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
        () => fetchCounts(),
      )
      .subscribe();

    const onBackPress = () => {
      onBack('dashboard'); // Call your app's back function
      return true; // Prevents the app from closing entirely
    };
    const backHandler = BackHandler.addEventListener(
      'hardwareBackPress',
      onBackPress,
    );

    return () => {
      stopBroadcast();
      supabase.removeChannel(sub);
      backHandler.remove();
    };
  }, [classSession.id]); // Triggered by session ID
  // Dependency on ID is safer
  // --- 2. Timer Effect (Runs only when timer state changes) ---
  useEffect(() => {
    let timer: NodeJS.Timeout;

    // ✅ FIX: Only run the interval if the session has actually started AND timer isn't paused
    if (sessionStarted && timerRunning) {
      timer = setInterval(() => {
        setCodeExpiry(prev => {
          if (prev <= 1) {
            generateNewCode();
            return 120;
          }
          return prev - 1;
        });
      }, 1000);
    }

    return () => clearInterval(timer);
  }, [sessionStarted, timerRunning]);

  // --- Helper Functions ---

  return (
    <View style={styles.container}>
      {/* ---------------- HEADER ---------------- */}
      <View style={[styles.header, {paddingTop: insets.top + 16}]}>
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
        {/* ---------------- LOCATION SECURITY MODE ---------------- */}
        <View style={styles.card}>
          <View style={styles.rowBetween}>
            <View style={styles.rowFill}>
              {/* ✅ Uses new rowFill style */}
              <View
                style={[
                  styles.iconCircle,
                  {
                    backgroundColor:
                      isAdHoc && beaconActive ? '#2196F3' : '#EEEEEE',
                  },
                ]}>
                <Radius color={isAdHoc ? '#fff' : '#757575'} size={20} />
              </View>
              {/* ✅ This View now has flex: 1 to protect the switch */}
              <View style={{marginLeft: 12, flex: 1}}>
                <View
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 6,
                  }}>
                  <Text style={styles.cardTitle}>Geofence Mode</Text>
                  <TouchableOpacity
                    onPress={() =>
                      Alert.alert(
                        'Geofence Security Mode', // ✅ Alert Title
                        '• LOCKED: Uses the official college coordinates for this room. Best for preventing location cheating.\n\n• LIVE: Uses your current phone GPS. Best for outdoor lectures or temporary room changes.', // ✅ Alert Message
                      )
                    }
                    style={{padding: 4}}>
                    <Info size={18} color={isAdHoc ? '#757575' : '#2196F3'} />
                  </TouchableOpacity>
                </View>
                <Text
                  style={{color: '#757575', fontSize: 11}}
                  numberOfLines={1}>
                  {isAdHoc
                    ? ' Verified by Teacher Location'
                    : ' Verified by Room Location'}
                </Text>
              </View>
            </View>

            {/* ✅ Switch is now anchored safely to the right */}
            <View style={styles.switchContainer}>
              {loading ? (
                <ActivityIndicator size="small" color="#2196F3" />
              ) : (
                <Switch
                  // 🎯 Visuals stay locked to the Master Switch
                  value={sessionStarted && beaconActive ? isAdHoc : false}
                  thumbColor={
                    isAdHoc && sessionStarted && beaconActive
                      ? '#2196F3'
                      : '#f4f3f4'
                  }
                  // 🎯 Removed 'disabled' prop so we can intercept the tap
                  onValueChange={val => {
                    // 1. Check if class has even started
                    if (!sessionStarted) {
                      Alert.alert(
                        'Class Not Started',
                        "Please tap the 'Start Class' circle before adjusting settings.",
                      );
                      return;
                    }

                    // 2. 🎯 THE FEEDBACK: Check if Master Switch is off
                    if (!beaconActive) {
                      Alert.alert(
                        'Live Signal Required',
                        "You must turn on the 'Live Signal' first to use Geofence Mode.",
                      );
                      return;
                    }

                    // 3. If everything is active, proceed with your normal logic
                    handleModeToggle(val);
                  }}
                />
              )}
            </View>
          </View>
        </View>

        {/* ---------------- SIGNAL CARD ---------------- */}
        <View style={styles.card}>
          <View style={styles.rowBetween}>
            <View style={styles.rowFill}>
              <View
                style={[
                  styles.iconCircle,
                  // 🎯 Only blue if BOTH toggles are active
                  {
                    backgroundColor:
                      isAdHoc && beaconActive ? '#2196F3' : '#EEEEEE',
                  },
                ]}>
                <Radius
                  color={isAdHoc && beaconActive ? '#fff' : '#757575'}
                  size={20}
                />
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

            <View style={styles.switchContainer}>
              {/* Geofence Mode Card */}
              <Switch
                value={sessionStarted ? beaconActive : false}
                disabled={!sessionStarted}
                thumbColor={
                  beaconActive && sessionStarted ? '#4CAF50' : '#f4f3f4'
                }
                onValueChange={async val => {
                  // 1. Update local state
                  setBeaconActive(val);

                  // 2. Sync Master Switch to Supabase
                  await supabase
                    .from('sessions')
                    .update({is_hardware_required: val})
                    .eq('id', classSession.id);

                  if (val) {
                    startBroadcast();
                  } else {
                    stopBroadcast();
                    // 3. 🎯 THE KILL SWITCH: If Live Signal turns off, force Geofence off
                    if (isAdHoc) {
                      setIsAdHoc(false);
                      await supabase
                        .from('sessions')
                        .update({is_live_location: false})
                        .eq('id', classSession.id);
                    }
                  }
                }}
              />
            </View>
          </View>
        </View>

        {/* ---------------- TIMER CARD (Spaced Out) ---------------- */}
        <View style={[styles.card, styles.centerCard]}>
          <Text style={styles.label}>Attendance Code</Text>

          <TouchableOpacity
            activeOpacity={0.8}
            onPress={sessionStarted ? toggleTimer : handleStartClass}
            style={styles.circleContainer}>
            <Svg
              height={CIRCLE_SIZE}
              width={CIRCLE_SIZE}
              viewBox={`0 0 ${CIRCLE_SIZE} ${CIRCLE_SIZE}`}>
              {/* Background Circle */}
              <Circle
                cx={center}
                cy={center}
                r={RADIUS}
                stroke="#F5F5F5"
                strokeWidth={STROKE_WIDTH}
                fill="none"
              />

              {/* Progress Circle (Rotating) */}
              <Circle
                cx={center}
                cy={center}
                r={RADIUS}
                stroke={
                  !sessionStarted
                    ? '#2196F3'
                    : timerRunning
                    ? '#FF9800'
                    : '#BDBDBD'
                }
                strokeWidth={STROKE_WIDTH}
                fill="none"
                strokeDasharray={circumference}
                strokeDashoffset={sessionStarted ? strokeDashoffset : 0}
                strokeLinecap="round"
                transform={`rotate(-90 ${center} ${center})`}
              />
            </Svg>

            {/* CENTER CONTENT: Where the magic happens */}
            <View style={styles.absoluteCenter}>
              {!sessionStarted ? (
                <>
                  <Text style={styles.startLabel}>TAP TO</Text>
                  <Text style={styles.startActionText}>START CLASS</Text>
                </>
              ) : (
                <>
                  {/* Large Rotating Code */}
                  <Text
                    style={[
                      styles.codeText,
                      {fontSize: 48, fontWeight: '900'},
                      !timerRunning && {color: '#CCC'},
                    ]}>
                    {currentCode}
                  </Text>

                  {/* Dynamic Interaction Label */}
                  <Text
                    style={{
                      fontSize: 12,
                      color: '#757575',
                      fontWeight: 'bold',
                      letterSpacing: 1,
                    }}>
                    {timerRunning ? 'CLICK TO PAUSE' : 'CLICK TO RESUME'}
                  </Text>

                  {/* Seconds Countdown */}
                  <Text
                    style={{
                      fontSize: 14,
                      color: timerRunning ? '#FF9800' : '#BDBDBD',
                      marginTop: 4,
                    }}>
                    {codeExpiry}s left
                  </Text>
                </>
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

        {/* ---------------- MERGED STATS & CLASS LIST CARD ---------------- */}
        <TouchableOpacity
          style={styles.card}
          activeOpacity={0.7}
          onPress={() => setShowManual(true)}>
          <View style={styles.rowBetween}>
            <View>
              <Text style={styles.statLabel}>
                Present:{' '}
                <Text style={{fontWeight: 'bold', color: '#2196F3'}}>
                  {attendeeCount}
                </Text>{' '}
                / {totalStudents}
              </Text>
              <Text style={{color: '#999', fontSize: 11, marginTop: 2}}>
                Tap to see who is present
              </Text>
            </View>
            <View style={{flexDirection: 'row', alignItems: 'center', gap: 8}}>
              <Text style={styles.percentText}>{percentage}%</Text>
              <Eye size={20} color="#2196F3" />
            </View>
          </View>

          <View style={styles.progressBarBg}>
            <View style={[styles.progressBarFill, {width: `${percentage}%`}]} />
          </View>
        </TouchableOpacity>

        {/* ---------------- SLIM END CLASS BUTTON ---------------- */}
        <View style={{marginTop: 5}}>
          <TouchableOpacity
            style={[
              styles.footerButton,
              {borderColor: '#FFEBEE', backgroundColor: '#FFEBEE'},
            ]}
            onPress={finalizeClass}>
            <Text
              style={[
                styles.footerText,
                {color: '#D32F2F', fontWeight: 'bold'},
              ]}>
              End Class & Submit Attendance
            </Text>
          </TouchableOpacity>
        </View>

        <View style={{height: 50}} />
      </ScrollView>
      <Modal visible={showBatchPicker} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.batchCard}>
            <Text style={styles.batchTitle}>Select Practical Batch</Text>
            <Text style={styles.batchSub}>
              Only students in this batch will see the session.
            </Text>

            <View style={styles.batchRow}>
              {['A', 'B', 'C'].map(b => (
                <TouchableOpacity
                  key={b}
                  style={[
                    styles.batchBtn,
                    selectedBatch === b && styles.batchBtnActive,
                  ]}
                  onPress={() => setSelectedBatch(b)}>
                  <Text
                    style={[
                      styles.batchBtnText,
                      selectedBatch === b && styles.batchBtnTextActive,
                    ]}>
                    Batch {b}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <TouchableOpacity
              style={styles.confirmBtn}
              onPress={() => {
                setShowBatchPicker(false);
                triggerSecurityMenu();
              }}>
              <Text style={styles.confirmBtnText}>
                Start Session for Batch {selectedBatch}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
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
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingBottom: 16,
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
    elevation: 4,
  },
  headerTop: {
    marginBottom: 0, // Removed gap between arrow and text
    alignItems: 'flex-start',
  },
  headerTitle: {
    color: '#FFF',
    fontSize: 22, // Big font
    fontWeight: '600',
    letterSpacing: 0.3,
    marginLeft: 12, // ✅ Add space between Arrow and Name
    flex: 1,
    lineHeight: 28,
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
    padding: 20, // ✅ INCREASED padding from 16 to 24
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
  absoluteCenter: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
    height: '100%', // 🎯 Forces perfect vertical/horizontal centering
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
    fontSize: SCREEN_WIDTH * 0.12,
    fontWeight: '900',
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
  toggleModeText: {
    fontSize: 9,
    fontWeight: 'bold',
    marginBottom: 2,
    letterSpacing: 0.5,
  },
  switchContainer: {
    marginLeft: 10,
    minWidth: 60,
    alignItems: 'flex-end',
    justifyContent: 'center',
  },
  rowFill: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1, // ✅ Ensures this side takes only available space
  },
  circleContainer: {
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
    marginTop: 20,
    position: 'relative', // ✅ Essential for absolute positioning of text
  },
  startLabel: {
    fontSize: 12,
    color: '#757575',
    fontWeight: '600',
    letterSpacing: 1,
  },
  startActionText: {
    fontSize: 18,
    color: '#2196F3',
    fontWeight: 'bold',
    marginTop: 2,
  },

  // --- BATCH PICKER MODAL ---
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    padding: 20,
  },
  batchCard: {
    backgroundColor: '#FFF',
    borderRadius: 20,
    padding: 24,
    alignItems: 'center',
  },
  batchTitle: {fontSize: 20, fontWeight: 'bold', color: '#333'},
  batchSub: {fontSize: 13, color: '#757575', marginTop: 4, textAlign: 'center'},
  batchRow: {flexDirection: 'row', gap: 12, marginVertical: 25},
  batchBtn: {
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  batchBtnActive: {backgroundColor: '#2196F3', borderColor: '#2196F3'},
  batchBtnText: {fontWeight: '600', color: '#757575'},
  batchBtnTextActive: {color: '#FFF'},
  confirmBtn: {
    backgroundColor: '#2196F3',
    width: '100%',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  confirmBtnText: {color: '#FFF', fontWeight: 'bold', fontSize: 16},
});
