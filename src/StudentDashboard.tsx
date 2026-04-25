import React, {useState, useEffect} from 'react';
import AttendanceGrid from './AttendanceGrid'; // Import the new component
import Progress from './Progress';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  StatusBar,
  RefreshControl,
  ActivityIndicator,
  Alert,
} from 'react-native';
import {
  Home,
  TrendingUp,
  User,
  Clock,
  MapPin,
  LogOut,
  Mail,
  Shield,
  BookOpen,
  Hash,
} from 'lucide-react-native';
import {supabase} from './lib/supabase';

// Helper component for clean Profile rows
const InfoRow = ({icon: Icon, label, value, isLast = false}: any) => (
  <View>
    <View style={styles.infoRow}>
      <Icon size={20} color="#757575" />
      <View style={{marginLeft: 10}}>
        <Text style={styles.infoLabel}>{label}</Text>
        <Text style={styles.infoValue}>{value}</Text>
      </View>
    </View>
    {!isLast && <View style={styles.infoDivider} />}
  </View>
);

export default function StudentDashboard({session, onNavigate}: any) {
  // --- 1. STATE MANAGEMENT ---
  const [profile, setProfile] = useState<any>(null);
  const [profileLoading, setProfileLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('home');
  const [classes, setClasses] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [heatmapData, setHeatmapData] = useState<
    {date: string; count: number; total: number}[]
  >([]);
  const [stats, setStats] = useState({attended: 0, total: 0});
  const [holidays, setHolidays] = useState<string[]>([]);

  // --- 2. TOP-LEVEL DATA FETCHING FUNCTIONS ---
  // (Moved outside of useEffect so onRefresh can call them)

  const getProfile = async () => {
    setProfileLoading(true);
    try {
      const {data, error} = await supabase
        .from('profiles')
        .select('*')
        .eq('id', session.user.id)
        .single();
      if (data) setProfile(data);
    } catch (err) {
      console.error('Profile Load Error:', err);
    } finally {
      setProfileLoading(false);
    }
  };

  const loadHolidays = async () => {
    try {
      const {data} = await supabase.from('holidays').select('holiday_date');
      if (data) setHolidays(data.map(item => item.holiday_date));
    } catch (err) {
      console.error('Holiday Fetch Error:', err);
    }
  };

  const fetchPerformanceStats = async () => {
    try {
      const {data, error} = await supabase.rpc('get_student_stats', {
        p_student_id: session.user.id,
      });
      if (data && data[0]) {
        setStats({
          attended: parseInt(data[0].attended_count),
          total: parseInt(data[0].total_possible_count),
        });
      }
    } catch (err) {
      console.error('Stats Fetch Error:', err);
    }
  };

  const loadData = async () => {
    if (!profile) return;
    try {
      // Fetch attendance (Numerator)
      const {data: attData} = await supabase
        .from('attendance')
        .select('marked_at')
        .eq('student_id', session.user.id);

      // Fetch sessions held (Denominator)
      const {data: sessData} = await supabase
        .from('sessions')
        .select('id, created_at')
        .eq('target_course', profile.course)
        .eq('target_year', profile.year)
        .eq('target_semester', profile.semester)
        .or(`target_batch.eq.ALL,target_batch.eq.${profile.batch}`);

      const finalMap: any = {};

      sessData?.forEach(s => {
        const date = s.created_at.split('T')[0];
        if (!finalMap[date]) finalMap[date] = {attended: 0, held: 0};
        finalMap[date].held += 1;
      });

      attData?.forEach(a => {
        const date = a.marked_at.split('T')[0];
        if (!finalMap[date]) finalMap[date] = {attended: 0, held: 0};
        finalMap[date].attended += 1;
        // Ensure denominator is never smaller than numerator
        if (finalMap[date].attended > finalMap[date].held)
          finalMap[date].held = finalMap[date].attended;
      });

      const formattedData = Object.keys(finalMap).map(date => ({
        date: date,
        count: finalMap[date].attended,
        total: finalMap[date].held,
      }));

      setHeatmapData(formattedData);
    } catch (err) {
      console.error('Heatmap Data Error:', err);
    }
  };

  const fetchLiveClasses = async () => {
    if (!profile?.semester) return;
    setLoading(true);
    try {
      const {data} = await supabase
        .from('sessions')
        .select('*, subjects!inner(*)')
        .eq('is_active', true)
        .eq('subjects.target_course', profile.course)
        .eq('subjects.target_year', profile.year)
        .eq('subjects.target_semester', profile.semester)
        .or(`target_batch.eq.ALL,target_batch.eq.${profile.batch}`)
        .order('created_at', {ascending: false});

      setClasses(data || []);
    } catch (err) {
      console.error('Live Class Error:', err);
    } finally {
      setLoading(false);
    }
  };

  // --- 3. THE RELOAD LOGIC ---
  const onRefresh = async () => {
    setRefreshing(true); // Start the spinner
    try {
      await Promise.all([
        getProfile(),
        loadHolidays(),
        fetchPerformanceStats(),
        loadData(),
        fetchLiveClasses(),
      ]);
    } catch (err) {
      console.error('Refresh failed:', err);
    } finally {
      setRefreshing(false); // Stop the spinner
    }
  };

  // --- 4. LIFECYCLE (useEffect) ---

  // Initial load
  useEffect(() => {
    getProfile();
    loadHolidays();
  }, [session.user.id]);

  // Load secondary data once profile is ready
  useEffect(() => {
    if (profile) {
      loadData();
      fetchLiveClasses();
      fetchPerformanceStats();
    }
  }, [profile]);

  // --- 5. RENDER HELPERS ---
  const attendancePercentage =
    stats.total > 0 ? Math.round((stats.attended / stats.total) * 100) : 100;

  // --- CONSISTENT LOGOUT LOGIC ---
  const handleLogout = async () => {
    Alert.alert('Sign Out', 'Are you sure you want to log out?', [
      {text: 'Cancel', style: 'cancel'},
      {
        text: 'Log Out',
        style: 'destructive',
        onPress: async () => await supabase.auth.signOut(),
      },
    ]);
  };

  const getStatusColor = (status: string) => {
    return {bg: '#4CAF50', text: '#FFFFFF', label: 'Ongoing'};
  };
  const email = session?.user?.email || 'user@adsum.com'; //
  const role = 'Student'; //

  const renderContent = () => {
    // --- TAB 1: HOME ---
    if (activeTab === 'home') {
      return (
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing} // 🎯 USE THIS instead of 'loading'
              onRefresh={onRefresh} // 🎯 USE THIS instead of 'fetchLiveClasses'
              colors={['#2196F3']}
            />
          }>
          {/* Header */}
          <View style={styles.headerContainer}>
            <View style={styles.headerContent}>
              <View style={styles.userInfo}>
                <Image
                  source={{
                    uri: `https://api.dicebear.com/9.x/initials/png?seed=${profile?.name}&backgroundColor=2196F3&chars=2`,
                  }}
                  style={styles.avatar}
                />
                <View>
                  <Text style={styles.userName}>
                    {profile?.name || session.user.email?.split('@')[0]}
                  </Text>
                  <Text style={styles.userId}>Student Dashboard</Text>
                </View>
              </View>
            </View>
          </View>
          <AttendanceGrid
            holidays={holidays}
            heatmapData={heatmapData}
            attendancePercentage={attendancePercentage}
            totalAttended={stats.attended}
            totalLectures={stats.total}
          />

          {/* List Section */}
          <View style={styles.listSection}>
            <View
              style={{
                flexDirection: 'row',
                justifyContent: 'space-between',
                alignItems: 'center',
              }}>
              <Text style={styles.sectionTitle}>Today's Schedule</Text>
              {loading && <ActivityIndicator size="small" color="#2196F3" />}
            </View>

            {!loading && classes.length === 0 && (
              <View style={{padding: 20, alignItems: 'center'}}>
                <Text style={{color: '#999'}}>
                  No active classes right now.
                </Text>
              </View>
            )}

            {classes.map(item => {
              const statusColors = getStatusColor('ongoing');
              const displayName =
                item.class_name || item.subjects?.name || 'Untitled Class';
              const displayRoom = item.room_number || 'Room TBD';
              const timeString = new Date(item.created_at).toLocaleTimeString(
                [],
                {hour: '2-digit', minute: '2-digit'},
              );

              return (
                <View key={item.id} style={styles.classCard}>
                  <View style={styles.cardHeader}>
                    <View style={{flex: 1}}>
                      <Text style={styles.className}>{displayName}</Text>

                      <Text
                        style={{
                          fontSize: 12,
                          fontWeight: 'bold',
                          color:
                            item.target_batch === 'ALL' ? '#2196F3' : '#9C27B0',
                          marginBottom: 4,
                        }}>
                        {item.target_batch === 'ALL'
                          ? 'Theory Lecture'
                          : `Practical - Batch ${item.target_batch}`}
                      </Text>
                      <View style={styles.metaRow}>
                        <Clock size={14} color="#757575" />
                        <Text style={styles.metaText}>{timeString}</Text>
                      </View>
                      <View style={styles.metaRow}>
                        <MapPin size={14} color="#757575" />
                        <Text style={styles.metaText}>{displayRoom}</Text>
                      </View>
                    </View>
                    <View
                      style={[
                        styles.statusPill,
                        {backgroundColor: statusColors.bg},
                      ]}>
                      <Text
                        style={[styles.statusText, {color: statusColors.text}]}>
                        {statusColors.label}
                      </Text>
                    </View>
                  </View>

                  <TouchableOpacity
                    style={styles.markButton}
                    onPress={() =>
                      onNavigate && onNavigate('mark-attendance', item)
                    }>
                    <Text style={styles.markButtonText}>Mark Attendance</Text>
                  </TouchableOpacity>
                </View>
              );
            })}
          </View>
          <View style={{height: 100}} />
        </ScrollView>
      );
    }

    // --- TAB 2: Progress ---
    if (activeTab === 'history') {
      return <Progress profile={profile} session={session} />;
    }

    // --- TAB 3: PROFILE (Polished Look) ---
    if (activeTab === 'profile') {
      return (
        <ScrollView contentContainerStyle={styles.profileContainer}>
          {/* 1. Profile Header */}
          <View style={styles.profileHeader}>
            <Image
              // ✅ FIX 2: Updated Profile Tab Avatar (The one you asked for!)
              source={{
                uri: email
                  ? `https://api.dicebear.com/9.x/initials/png?seed=${profile?.name}&backgroundColor=2196F3&chars=2`
                  : 'https://via.placeholder.com/150', //backup image,
              }}
              style={styles.bigAvatar}
            />
            <Text style={styles.bigName}>
              {profile?.name || email.split('@')[0]}
            </Text>
            <Text style={styles.roleText}>{role}</Text>
          </View>

          {/* 2. Details Card */}
          <View style={styles.infoCard}>
            {/* Use DB Name or fallback to email prefix */}
            {/* <InfoRow
              icon={User}
              label="Full Name"
              value={profile?.name || email.split('@')[0]}
            /> */}
            <InfoRow
              icon={Hash}
              label="CPRN Number"
              value={profile?.cprn || 'Not Assigned'}
            />
            <InfoRow icon={Mail} label="Email Address" value={email} />
            {/* Dynamic Course & Year from Supabase */}
            <InfoRow
              icon={Shield}
              label="Department/Course"
              value={profile?.course || 'Not Set'}
            />
            <InfoRow
              icon={BookOpen}
              label="Academic Year"
              value={profile?.year || 'N/A'}
              isLast={true}
            />
          </View>

          {/* 3. Logout Button */}
          <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
            <LogOut size={22} color="#FFF" style={{marginRight: 15}} />
            <Text style={styles.logoutText}>Sign Out of Adsum</Text>
          </TouchableOpacity>

          <Text style={styles.versionText}>Adsum Student v1.0</Text>
        </ScrollView>
      );
    }
  };

  return (
    <View style={styles.container}>
      <StatusBar backgroundColor="#2196F3" barStyle="light-content" />
      {renderContent()}

      {/* Bottom Nav */}
      <View style={styles.bottomNav}>
        <TouchableOpacity
          style={styles.navItem}
          onPress={() => setActiveTab('home')}>
          <Home
            size={24}
            color={activeTab === 'home' ? '#2196F3' : '#757575'}
          />
          <Text
            style={[
              styles.navText,
              activeTab === 'home' && {color: '#2196F3'},
            ]}>
            Home
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.navItem}
          onPress={() => setActiveTab('history')}>
          <TrendingUp // or keep the History icon if you prefer
            size={24}
            color={activeTab === 'history' ? '#2196F3' : '#757575'}
          />
          <Text
            style={[
              styles.navText,
              activeTab === 'history' && {color: '#2196F3'},
            ]}>
            Progress
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.navItem}
          onPress={() => setActiveTab('profile')}>
          <User
            size={24}
            color={activeTab === 'profile' ? '#2196F3' : '#757575'}
          />
          <Text
            style={[
              styles.navText,
              activeTab === 'profile' && {color: '#2196F3'},
            ]}>
            Profile
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {flex: 1, backgroundColor: '#F5F5F5'},
  scrollContent: {paddingBottom: 20},
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingBottom: 50,
  },
  placeholderText: {
    fontSize: 18,
    color: '#999',
    marginTop: 15,
    marginBottom: 5,
  },

  headerContainer: {
    backgroundColor: '#2196F3',
    paddingTop: 20, // Reduced for a slimmer look
    paddingBottom: 45, // Reduced to pull the card up
    paddingHorizontal: 20,
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
  },
  headerContent: {
    flexDirection: 'row',
    // justifyContent: 'space-between',
    gap: 12,
    alignItems: 'center',
    // marginBottom: 20,
  },

  userInfo: {flexDirection: 'row', alignItems: 'center', gap: 12},
  avatar: {width: 48, height: 48, borderRadius: 24, backgroundColor: '#FFF'},
  userName: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#FFF',
    textTransform: 'capitalize',
    lineHeight: 24,
  },
  userId: {fontSize: 14, color: '#BBDEFB'},
  iconButton: {padding: 4},

  listSection: {marginTop: 15, paddingHorizontal: 20},
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#212121',
    marginBottom: 12,
  },

  classCard: {
    backgroundColor: '#FFF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    elevation: 2,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  className: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#212121',
    marginBottom: 6,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 4,
  },
  metaText: {fontSize: 14, color: '#757575'},
  statusPill: {paddingHorizontal: 12, paddingVertical: 4, borderRadius: 12},
  statusText: {fontSize: 12, fontWeight: 'bold'},

  markButton: {
    backgroundColor: '#2196F3',
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 16,
  },
  markButtonText: {color: '#FFF', fontWeight: 'bold', fontSize: 16},

  bottomNav: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#FFF',
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingVertical: 12,
    borderTopWidth: 0,
    elevation: 10,
  },
  navItem: {alignItems: 'center'},
  navText: {fontSize: 12, marginTop: 4, color: '#757575'},

  // --- POLISHED PROFILE STYLES ---
  profileContainer: {padding: 20, paddingBottom: 100},
  profileHeader: {alignItems: 'center', marginTop: 20, marginBottom: 40},
  bigAvatar: {
    width: 100,
    height: 100,
    borderRadius: 50,
    borderWidth: 4,
    borderColor: '#FFF',
    marginBottom: 15,
  },
  bigName: {fontSize: 24, fontWeight: 'bold', color: '#333'},
  roleText: {fontSize: 16, color: '#757575'},

  infoCard: {
    backgroundColor: '#FFF',
    borderRadius: 12,
    paddingHorizontal: 20,
    paddingVertical: 10,
    elevation: 2,
    marginBottom: 25,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    gap: 15,
  },
  infoLabel: {fontSize: 12, color: '#757575'},
  infoValue: {fontSize: 16, color: '#212121', fontWeight: '600'},
  infoDivider: {height: 1, backgroundColor: '#EEE'},

  logoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FF5252',
    padding: 16,
    borderRadius: 12,
    elevation: 4,
  },
  logoutText: {
    color: '#FFF',
    fontWeight: 'bold',
    marginLeft: 10,
    fontSize: 16,
  },
  versionText: {textAlign: 'center', color: '#BBB', marginTop: 20},
});
