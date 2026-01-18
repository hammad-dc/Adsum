import React, {useState, useEffect} from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  FlatList,
  StatusBar,
  RefreshControl,
  Alert,
} from 'react-native';
import {
  LayoutDashboard,
  FileText,
  User,
  Clock,
  MapPin,
  Plus,
  LogOut,
  BarChart2,
} from 'lucide-react-native';
import {supabase} from './lib/supabase';

// Helper function to safely get the profile email for avatar/seed
const getProfileSeed = (teacher: any) => {
  // We must assume the teacher prop contains the email or ID for the seed
  return teacher.email || teacher.id || 'teacher@adsum.com';
};

export default function TeacherDashboard({
  teacher,
  onNavigate,
  onSelectClass,
}: any) {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [classes, setClasses] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const teacherEmailSeed = getProfileSeed(teacher); // Get seed once

  // --- 1. SMART FETCH (Gets Data + Relations) ---
  const fetchClasses = async () => {
    setLoading(true);
    try {
      const {data, error} = await supabase
        .from('sessions')
        .select('*, subjects(*)')
        .order('created_at', {ascending: false});

      if (error) {
        console.error('Supabase Error:', error.message);
      } else {
        setClasses(data || []);
      }
    } catch (err) {
      console.error('Fetch failed:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchClasses();
  }, []);

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

  const handleReportClick = () => {
    Alert.alert(
      'Coming Soon',
      'Detailed analytics and attendance reports will be available in the next update!',
      [{text: 'Okay'}],
    );
  };

  const getStatusColor = (isActive: boolean) => {
    return isActive
      ? {bg: '#4CAF50', text: '#FFF', label: 'ONGOING'}
      : {bg: '#E0E0E0', text: '#757575', label: 'COMPLETED'};
  };

  const renderClassItem = ({item}: any) => {
    const status = getStatusColor(item.is_active);
    const displayName =
      item.class_name || item.subjects?.name || 'Untitled Class';
    const displayRoom = item.room_number || 'Room TBD';
    const timeString = new Date(item.created_at).toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit',
    });

    return (
      <View style={styles.card}>
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

          <View style={[styles.statusBadge, {backgroundColor: status.bg}]}>
            <Text style={[styles.statusText, {color: status.text}]}>
              {status.label}
            </Text>
          </View>
        </View>

        <TouchableOpacity
          style={[
            styles.actionButton,
            {
              backgroundColor: item.is_active ? '#2196F3' : '#fff',
              borderWidth: item.is_active ? 0 : 1,
              borderColor: '#E0E0E0',
            },
          ]}
          onPress={() =>
            onSelectClass &&
            onSelectClass({
              id: item.id,
              name: displayName,
              room: displayRoom,
              beacon_id: item.beacon_id,
              active_code: item.active_code,
              is_active: item.is_active,
            })
          }>
          <Text
            style={[
              styles.actionButtonText,
              {color: item.is_active ? '#FFF' : '#333'},
            ]}>
            {item.is_active ? 'Manage Session' : 'View Report'}
          </Text>
        </TouchableOpacity>
      </View>
    );
  };

  // --- RENDER CONTENT BASED ON TAB ---
  const renderContent = () => {
    if (activeTab === 'dashboard') {
      return (
        <>
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.headerTop}>
              {/* ✅ FIX: Removed unnecessary onPress={logout} here */}
              <View style={styles.profileRow}>
                <Image
                  source={{
                    uri:
                      teacher?.profilePic ||
                      `https://api.dicebear.com/9.x/initials/png?seed=${
                        teacher?.email || 'Teacher'
                      }&backgroundColor=2196F3`,
                  }}
                  style={styles.avatar}
                />
                <View>
                  <Text style={styles.teacherName}>{teacher.name}</Text>
                  <Text style={{color: '#BBDEFB', fontSize: 12}}>
                    Teacher Dashboard
                  </Text>
                </View>
              </View>
              <TouchableOpacity
                style={styles.addButton}
                onPress={() => onNavigate && onNavigate('add-class')}>
                <Plus color="#2196F3" size={24} />
              </TouchableOpacity>
            </View>
          </View>

          {/* Stats */}
          <View style={styles.statsContainer}>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{paddingRight: 20}}>
              <View style={styles.statCard}>
                <Text style={styles.statLabel}>Total Classes</Text>
                <Text style={[styles.statValue, {color: '#2196F3'}]}>
                  {classes.length}
                </Text>
              </View>
              <View style={styles.statCard}>
                <Text style={styles.statLabel}>Active Now</Text>
                <Text style={[styles.statValue, {color: '#4CAF50'}]}>
                  {classes.filter(c => c.is_active).length}
                </Text>
              </View>
            </ScrollView>
          </View>

          {/* List */}
          <View style={styles.listContainer}>
            <Text style={styles.sectionTitle}>Your Classes</Text>
            <FlatList
              data={classes}
              keyExtractor={item => item.id.toString()}
              renderItem={renderClassItem}
              contentContainerStyle={{paddingBottom: 100}}
              refreshControl={
                <RefreshControl
                  refreshing={loading}
                  onRefresh={fetchClasses}
                  colors={['#2196F3']}
                />
              }
              ListEmptyComponent={
                <Text
                  style={{textAlign: 'center', marginTop: 50, color: '#999'}}>
                  No classes created yet.
                </Text>
              }
            />
          </View>
        </>
      );
    }

    if (activeTab === 'reports') {
      // Simple Placeholder for Reports Tab
      return (
        <View style={styles.centerContainer}>
          <BarChart2 size={60} color="#E0E0E0" />
          <Text style={styles.placeholderText}>Reports Coming Soon</Text>
          <TouchableOpacity
            style={styles.btnOutline}
            onPress={handleReportClick}>
            <Text style={{color: '#2196F3', fontWeight: 'bold'}}>
              Check Details
            </Text>
          </TouchableOpacity>
        </View>
      );
    }

    if (activeTab === 'profile') {
      // Improved Profile Tab
      return (
        <ScrollView contentContainerStyle={styles.profileContainer}>
          <View style={styles.profileHeader}>
            <Image
              source={{
                // ✅ FIX: Using the safely defined seed
                uri: `https://api.dicebear.com/9.x/initials/png?seed=${teacherEmailSeed}&backgroundColor=2196F3&chars=2`,
              }}
              style={styles.bigAvatar}
            />
            <Text style={styles.bigName}>{teacher.name}</Text>
            <Text style={styles.roleText}>Faculty Member</Text>
          </View>

          <View style={styles.menuSection}>
            <TouchableOpacity
              style={styles.menuItem}
              onPress={handleReportClick}>
              <FileText size={20} color="#555" />
              <Text style={styles.menuText}>My Reports</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.menuItem}>
              <User size={20} color="#555" />
              <Text style={styles.menuText}>Account Settings</Text>
            </TouchableOpacity>
          </View>

          <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
            <LogOut size={20} color="#F44336" />
            <Text style={styles.logoutText}>Sign Out</Text>
          </TouchableOpacity>

          <Text style={styles.versionText}>Adsum Teacher v1.0</Text>
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
          onPress={() => setActiveTab('dashboard')}>
          <LayoutDashboard
            size={24}
            color={activeTab === 'dashboard' ? '#2196F3' : '#757575'}
          />
          <Text
            style={[
              styles.navText,
              activeTab === 'dashboard' && {color: '#2196F3'},
            ]}>
            Dashboard
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.navItem}
          onPress={() => setActiveTab('reports')}>
          <FileText
            size={24}
            color={activeTab === 'reports' ? '#2196F3' : '#757575'}
          />
          <Text
            style={[
              styles.navText,
              activeTab === 'reports' && {color: '#2196F3'},
            ]}>
            Reports
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
  header: {
    backgroundColor: '#2196F3',
    paddingTop: 20,        // Keeps space for status bar
    paddingHorizontal: 20, // Keeps side spacing
    paddingBottom: 20,     // ✅ REDUCED from 30 to 20 (Shrinks the bottom gap)
    borderBottomLeftRadius: 20,
    borderBottomRightRadius: 20,
    elevation: 5,          // Adds a nice shadow effect
  },
  headerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,      // ✅ Adds a little space between buttons and the new Title
  },
  // Add this new style for the text you want to write
  headerTitle: {
    color: '#FFF',
    fontSize: 22,
    fontWeight: 'bold',
    marginTop: 5,
  },
  profileRow: {flexDirection: 'row', alignItems: 'center', gap: 12},
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#E1E1E1',
  },
  teacherName: {color: '#FFF', fontSize: 18, fontWeight: 'bold'},
  addButton: {backgroundColor: '#FFF', padding: 8, borderRadius: 20},

  statsContainer: {marginTop: -25, paddingHorizontal: 15},
  statCard: {
    backgroundColor: '#FFF',
    padding: 15,
    borderRadius: 12,
    marginRight: 12,
    minWidth: 130,
    elevation: 3,
  },
  statLabel: {color: '#757575', fontSize: 12, marginBottom: 5},
  statValue: {fontSize: 24, fontWeight: 'bold'},

  listContainer: {flex: 1, padding: 20, marginTop: -10},
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#212121',
    marginBottom: 15,
  },

  card: {
    backgroundColor: '#FFF',
    borderRadius: 12,
    padding: 15,
    marginBottom: 15,
    elevation: 2,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 15,
  },
  className: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#212121',
    marginBottom: 5,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 5,
    gap: 4,
  },
  metaText: {color: '#757575', fontSize: 13},
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    height: 24,
    justifyContent: 'center',
  },
  statusText: {fontSize: 10, fontWeight: 'bold'},
  actionButton: {padding: 12, borderRadius: 8, alignItems: 'center'},
  actionButtonText: {fontWeight: 'bold', fontSize: 14},

  bottomNav: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    padding: 12,
    backgroundColor: '#FFF',
    borderTopWidth: 1,
    borderTopColor: '#E0E0E0',
    position: 'absolute',
    bottom: 0,
    width: '100%',
  },
  navItem: {alignItems: 'center'},
  navText: {fontSize: 12, color: '#757575', marginTop: 4},

  // New Styles for Profile & Reports Tabs
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
    marginBottom: 20,
  },
  btnOutline: {
    borderWidth: 1,
    borderColor: '#2196F3',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 20,
  },

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

  menuSection: {
    backgroundColor: '#FFF',
    borderRadius: 12,
    padding: 10,
    marginBottom: 20,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  menuText: {fontSize: 16, marginLeft: 15, color: '#333'},

  logoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFEBEE',
    padding: 15,
    borderRadius: 12,
  },
  logoutText: {
    color: '#F44336',
    fontWeight: 'bold',
    marginLeft: 10,
    fontSize: 16,
  },
  versionText: {textAlign: 'center', color: '#BBB', marginTop: 20},
});
