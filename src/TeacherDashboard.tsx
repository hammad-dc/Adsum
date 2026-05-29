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
  Mail,
  Shield,
  BookOpen,
} from 'lucide-react-native';
import {supabase} from './lib/supabase';

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

const getProfileSeed = (teacher: any) => {
  return teacher.email || teacher.id || 'teacher@adsum.com';
};

export default function TeacherDashboard({
  teacher,
  onNavigate,
  onSelectClass,
  initialTab,
}: any) {
  const [profile, setProfile] = useState<any>(null);
  const [activeTab, setActiveTab] = useState(initialTab || 'dashboard');
  const [classes, setClasses] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [assignedSubjects, setAssignedSubjects] = useState<any[]>([]); // For the bottom list

  const teacherEmailSeed = getProfileSeed(teacher);
  const [totalSessions, setTotalSessions] = useState(0);

  const fetchClasses = async () => {
    setLoading(true);
    try {
      const {count: historyCount, error: countErr} = await supabase
        .from('sessions')
        .select('*', {count: 'exact', head: true})
        .eq('teacher_id', teacher.id);

      if (countErr) throw countErr;
      setTotalSessions(historyCount || 0);

      // Fetch active sessions (Ongoing)
      const {data: activeSessions} = await supabase
        .from('sessions')
        .select('*, subjects(*)')
        .eq('teacher_id', teacher.id)
        .is('closed_at', null);

      // 2. 🎯 FIX: Fetch Subjects via the Assignment Bridge Table
      const {data: assignments, error: subErr} = await supabase
        .from('subject_assignments')
        .select(
          `
        subjects (
          id, name, code, target_course, target_year, target_semester, type
        )
      `,
        )
        .eq('teacher_id', teacher.id);

      if (subErr) throw subErr;

      // Transform the joined data into a clean array
      const mappedSubjects =
        assignments?.map(a => a.subjects).filter(Boolean) || [];

      setClasses(activeSessions || []);
      setAssignedSubjects(mappedSubjects); // Now only shows relevant subjects
    } catch (err) {
      console.error('Fetch failed:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchTeacherProfile = async () => {
    if (!teacher?.id) return; // ✅ Don't fetch if ID is missing yet

    const {data, error} = await supabase
      .from('profiles')
      .select('name, employee_id, email')
      .eq('id', teacher.id)
      .single();

    if (error) {
      console.error('Profile fetch error:', error.message);
    } else if (data) {
      setProfile(data);
    }
  };
  useEffect(() => {
    if (initialTab) setActiveTab(initialTab);

    if (teacher?.id) {
      fetchClasses();
      fetchTeacherProfile();
    }
  }, [teacher?.id, initialTab]);

  const onRefresh = async () => {
    setRefreshing(true);
    try {
      // Re-run both fetchers to update everything
      await Promise.all([fetchClasses(), fetchTeacherProfile()]);
    } catch (err) {
      console.error('Refresh failed:', err);
    } finally {
      setRefreshing(false); // Stop the spinner
    }
  };

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
    // Directly trigger the standardized navigation key[cite: 2]
    onNavigate && onNavigate('academic-reports');
  };

  const getStatusColor = (isActive: boolean) => {
    return isActive
      ? {bg: '#4CAF50', text: '#FFF', label: 'ONGOING'}
      : {bg: '#E0E0E0', text: '#757575', label: 'COMPLETED'};
  };

  const renderClassItem = ({item}: any) => {
    const status = getStatusColor(item.closed_at === null);
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
            <Text
              style={{
                fontSize: 12,
                fontWeight: 'bold',
                color: item.target_batch === 'ALL' ? '#2196F3' : '#9C27B0',
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
              backgroundColor: !item.closed_at ? '#2196F3' : '#fff',
              borderWidth: !item.closed_at ? 0 : 1,
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
              closed_at: item.closed_at,
              target_semester: item.target_semester,
              target_batch: item.target_batch,
            })
          }>
          <Text
            style={[
              styles.actionButtonText,
              {color: !item.closed_at ? '#FFF' : '#333'},
            ]}>
            {!item.closed_at ? 'Manage Session' : 'View Report'}
          </Text>
        </TouchableOpacity>
      </View>
    );
  };

  const renderContent = () => {
    if (activeTab === 'dashboard') {
      return (
        <>
          <View style={styles.header}>
            <View style={styles.headerTop}>
              <View style={styles.profileRow}>
                <Image
                  source={{
                    uri: `https://api.dicebear.com/9.x/initials/png?seed=${
                      profile?.name || teacher.name || teacher.email
                    }&backgroundColor=2196F3&chars=2`,
                  }}
                  style={styles.avatar}
                />
                <View>
                  <Text style={styles.teacherName}>
                    {profile?.name || teacher.name}
                  </Text>
                  <Text style={{color: '#BBDEFB', fontSize: 12}}>
                    Teacher Dashboard
                  </Text>
                </View>
              </View>
              <TouchableOpacity
                style={styles.addButton}
                onPress={() =>
                  onNavigate && onNavigate('add-class', {teacherId: teacher.id})
                }>
                <Plus color="#2196F3" size={24} />
              </TouchableOpacity>
            </View>
          </View>

          <View style={styles.statsContainer}>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{paddingRight: 20}}>
              <View style={styles.statCard}>
                <Text style={styles.statLabel}>Total Classes</Text>
                <Text style={[styles.statValue, {color: '#2196F3'}]}>
                  {totalSessions}
                </Text>
              </View>
              <View style={styles.statCard}>
                <Text style={styles.statLabel}>Active Now</Text>
                <Text style={[styles.statValue, {color: '#4CAF50'}]}>
                  {classes.filter(c => c.closed_at === null).length}
                </Text>
              </View>
            </ScrollView>
          </View>

          <ScrollView
            contentContainerStyle={{flexGrow: 1}} // Allows the content to stretch and scroll
            showsVerticalScrollIndicator={false}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={onRefresh}
                colors={['#2196F3']} // Adsum Blue
              />
            }>
            <View style={styles.listContainer}>
              {/* --- UPPER PART: ONGOING SESSIONS --- */}
              <Text style={styles.sectionTitle}>Ongoing Sessions</Text>
              <View style={styles.ongoingWrapper}>
                {classes && classes.length > 0 ? (
                  classes.map(item => (
                    <View key={`ongoing-${item.id}`}>
                      {renderClassItem({item})}
                    </View>
                  ))
                ) : (
                  <Text style={styles.emptyText}>
                    No sessions active right now.
                  </Text>
                )}
              </View>

              {/* --- LOWER PART: ASSIGNED SUBJECTS --- */}
              <Text style={[styles.sectionTitle, {marginTop: 25}]}>
                Your Assigned Subjects
              </Text>

              {/* ✅ Convert FlatList to .map() to fix the scrolling bug */}
              <View style={styles.assignedWrapper}>
                {assignedSubjects?.map(item => (
                  <TouchableOpacity
                    key={`assigned-${item.id}`}
                    style={styles.subjectCard}
                    onPress={() =>
                      onNavigate &&
                      onNavigate('add-class', {
                        initialSubject: item,
                        teacherId: teacher.id, // 🎯 Also pass it here
                      })
                    }>
                    <View style={styles.subjectIcon}>
                      <BookOpen color="#2196F3" size={20} />
                    </View>
                    <View style={{flex: 1}}>
                      <Text style={styles.subjectName}>{item.name}</Text>
                      <Text style={styles.subjectMeta}>
                        {item.type} • Sem {item.target_semester}
                      </Text>
                    </View>
                    <Plus color="#2196F3" size={20} />
                  </TouchableOpacity>
                ))}
              </View>

              {/* ✅ Extra space at the bottom to ensure the last item clears the Nav Bar */}
              <View style={{height: 120}} />
            </View>
          </ScrollView>
        </>
      );
    }

    if (activeTab === 'profile') {
      return (
        <ScrollView contentContainerStyle={styles.profileContainer}>
          <View style={styles.profileHeader}>
            <Image
              source={{
                uri: `https://api.dicebear.com/9.x/initials/png?seed=${
                  profile?.name || teacher.name
                }&backgroundColor=2196F3&chars=2`,
              }}
              style={styles.bigAvatar}
            />
            <Text style={styles.bigName}>
              {profile?.name || teacher.name || 'Loading Name...'}
            </Text>
            <Text style={styles.roleText}>Faculty Member</Text>
          </View>

          <View style={styles.infoCard}>
            <InfoRow
              icon={User}
              label="Faculty ID"
              value={
                profile?.employee_id ||
                `ID for ${teacher.id.substring(0, 5)}...`
              }
            />
            <InfoRow
              icon={Mail}
              label="Email Address"
              value={profile?.email || teacher.email}
            />
            <InfoRow
              icon={Shield}
              label="Designation"
              value="Assistant Professor"
            />
            <InfoRow
              icon={BookOpen}
              label="Total Sessions"
              value={`${classes.length} Classes Created`}
              isLast={true}
            />
          </View>

          <View style={styles.menuSection}>
            <TouchableOpacity
              style={styles.menuItem}
              onPress={handleReportClick}>
              <FileText size={20} color="#555" />
              <Text style={styles.menuText}>Academic Reports</Text>
            </TouchableOpacity>
          </View>

          <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
            <LogOut size={20} color="#F44336" />
            <Text style={styles.logoutText}>Sign Out of Adsum</Text>
          </TouchableOpacity>

          <Text style={styles.versionText}>Adsum Faculty v1.0.4</Text>
        </ScrollView>
      );
    }
  };

  return (
    <View style={styles.container}>
      <StatusBar backgroundColor="#2196F3" barStyle="light-content" />
      {renderContent()}

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

        <TouchableOpacity style={styles.navItem} onPress={handleReportClick}>
          <FileText size={24} color="#757575" />
          <Text style={styles.navText}>Reports</Text>
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
    paddingTop: 20,
    paddingHorizontal: 20,
    paddingBottom: 20,
    borderBottomLeftRadius: 20,
    borderBottomRightRadius: 20,
    elevation: 5,
  },
  headerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
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
  emptyText: {
    textAlign: 'center',
    color: '#999',
    marginTop: 20,
    fontSize: 14,
    fontStyle: 'italic',
  },
  ongoingWrapper: {
    marginBottom: 10,
  },
  assignedWrapper: {
    marginTop: 10,
    paddingVertical: 5,
  },
  subjectCard: {
    backgroundColor: '#FFF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
    elevation: 2,
    borderLeftWidth: 4,
    borderLeftColor: '#2196F3',
    width: '100%', // Highlights it's a "create" action
  },
  subjectIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#E3F2FD',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  subjectName: {fontSize: 16, fontWeight: 'bold', color: '#333'},
  subjectMeta: {fontSize: 12, color: '#757575', marginTop: 2},
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
  infoDivider: {height: 1, backgroundColor: '#EEE'},
  infoLabel: {fontSize: 12, color: '#757575'}, // ✅ Added missing style
  infoValue: {fontSize: 16, color: '#212121', fontWeight: '600'}, // ✅ Added missing style
});
