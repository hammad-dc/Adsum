import React, {useState, useEffect} from 'react';
import AttendanceGrid from './AttendanceGrid'; // Import the new component
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
  Bell,
  Home,
  History,
  User,
  Clock,
  MapPin,
  LogOut,
  FileText,
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

  const [profile, setProfile] = useState<any>(null); // To store real DB data
  const [profileLoading, setProfileLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('home');
  const [classes, setClasses] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const [heatmapData, setHeatmapData] = useState<
    {date: string; count: number}[]
  >([]);

  // 2. Fetch the actual attendance from Supabase
  useEffect(() => {
    const loadData = async () => {
      const {data, error} = await supabase
        .from('attendance')
        .select('created_at')
        .eq('student_id', session.user.id);

      if (data) {
        const counts = data.reduce((acc: Record<string, number>, curr: any) => {
          const date = curr.created_at.split('T')[0];
          acc[date] = (acc[date] || 0) + 1;
          return acc;
        }, {});

        setHeatmapData(
          Object.keys(counts).map(d => ({
            date: d,
            count: counts[d],
          })),
        );
      }
    };
    loadData();
  }, [session.user.id]);

  // 3. Calculate stats for the "Flip" side of the card
  const totalAttended = heatmapData.length;
  const TOTAL_LECTURES_SCHEDULED = 69; // We should make this dynamic later!
  const attendancePercentage =
    TOTAL_LECTURES_SCHEDULED > 0
      ? Math.round((totalAttended / TOTAL_LECTURES_SCHEDULED) * 100)
      : 0;
  useEffect(() => {
    const getProfile = async () => {
      const {data} = await supabase
        .from('profiles')
        .select('*')
        .eq('id', session.user.id)
        .single();
      if (data) setProfile(data);
      setProfileLoading(false);
    };
    getProfile();
  }, [session.user.id]);

  // Default values for Profile Tab
  const email = session?.user?.email || 'user@adsum.com';
  const role = 'Student';
  const id = 'S-2025-001';

  // --- 1. FETCH LIVE CLASSES ---
  const fetchLiveClasses = async () => {
    setLoading(true);
    try {
      const {data, error} = await supabase
        .from('sessions')
        .select('*, subjects(*)')
        .eq('is_active', true)
        .order('created_at', {ascending: false});

      if (error) throw error;
      setClasses(data || []);
    } catch (err) {
      console.error('Error fetching student classes:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLiveClasses();
  }, []);

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

  const renderContent = () => {
    // --- TAB 1: HOME ---
    if (activeTab === 'home') {
      return (
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={loading}
              onRefresh={fetchLiveClasses}
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
            heatmapData={heatmapData}
            attendancePercentage={attendancePercentage}
            totalAttended={totalAttended}
            totalLectures={TOTAL_LECTURES_SCHEDULED}
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

    // --- TAB 2: HISTORY ---
    if (activeTab === 'history') {
      return (
        <View style={styles.centerContainer}>
          <FileText size={60} color="#E0E0E0" />
          <Text style={styles.placeholderText}>History Coming Soon</Text>
          <Text style={{color: '#999', fontSize: 12}}>
            Past attendance records will appear here.
          </Text>
        </View>
      );
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
          <History
            size={24}
            color={activeTab === 'history' ? '#2196F3' : '#757575'}
          />
          <Text
            style={[
              styles.navText,
              activeTab === 'history' && {color: '#2196F3'},
            ]}>
            History
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
  borderBottomRightRadius: 24
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
