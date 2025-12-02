import React, { useState, useEffect } from 'react';
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
  ActivityIndicator,
} from 'react-native';
import {
  LayoutDashboard,
  FileText,
  User,
  Clock,
  MapPin,
  Plus,
} from 'lucide-react-native';
import { supabase } from './lib/supabase';

export default function TeacherDashboard({
  teacher,
  onNavigate,
  onSelectClass,
}: any) {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [classes, setClasses] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // --- 1. SMART FETCH (Gets Data + Relations) ---
  const fetchClasses = async () => {
    setLoading(true);
    try {
      // Fetch everything: Direct columns AND linked subjects
      const { data, error } = await supabase
        .from('sessions')
        .select('*, subjects(*)')
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Supabase Error:', error.message);
      } else {
        console.log('Fetched Classes:', data); // View this in your Metro terminal!
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

  const getStatusColor = (isActive: boolean) => {
    return isActive
      ? { bg: '#4CAF50', text: '#FFF', label: 'ONGOING' }
      : { bg: '#E0E0E0', text: '#757575', label: 'COMPLETED' };
  };

  const renderClassItem = ({ item }: any) => {
    const status = getStatusColor(item.is_active);

    // --- THE FIX: Check ALL possible name locations ---
    // 1. Try the direct text column (New way)
    // 2. Try the linked subject relation (Old way)
    // 3. Fallback to "Untitled"
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
          <View style={{ flex: 1 }}>
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

          <View style={[styles.statusBadge, { backgroundColor: status.bg }]}>
            <Text style={[styles.statusText, { color: status.text }]}>
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
              totalStudents: 0,
            })
          }
        >
          <Text
            style={[
              styles.actionButtonText,
              { color: item.is_active ? '#FFF' : '#333' },
            ]}
          >
            {item.is_active ? 'Manage Session' : 'View Report'}
          </Text>
        </TouchableOpacity>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <StatusBar backgroundColor="#2196F3" barStyle="light-content" />

      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerTop}>
          <TouchableOpacity
            style={styles.profileRow}
            onPress={() => supabase.auth.signOut()}
          >
            <Image source={{ uri: teacher.profilePic }} style={styles.avatar} />
            <View>
              <Text style={styles.teacherName}>{teacher.name}</Text>
              <Text style={{ color: '#BBDEFB', fontSize: 12 }}>
                (Tap to Logout)
              </Text>
            </View>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.addButton}
            onPress={() => onNavigate && onNavigate('add-class')}
          >
            <Plus color="#2196F3" size={24} />
          </TouchableOpacity>
        </View>
      </View>

      {/* Stats */}
      <View style={styles.statsContainer}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ paddingRight: 20 }}
        >
          <View style={styles.statCard}>
            <Text style={styles.statLabel}>Total Classes</Text>
            <Text style={[styles.statValue, { color: '#2196F3' }]}>
              {classes.length}
            </Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statLabel}>Active Now</Text>
            <Text style={[styles.statValue, { color: '#4CAF50' }]}>
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
          contentContainerStyle={{ paddingBottom: 80 }}
          refreshControl={
            <RefreshControl
              refreshing={loading}
              onRefresh={fetchClasses}
              colors={['#2196F3']}
            />
          }
          ListEmptyComponent={
            <Text style={{ textAlign: 'center', marginTop: 50, color: '#999' }}>
              No classes created yet.
            </Text>
          }
        />
      </View>

      {/* Bottom Nav */}
      <View style={styles.bottomNav}>
        <TouchableOpacity
          style={styles.navItem}
          onPress={() => setActiveTab('dashboard')}
        >
          <LayoutDashboard
            size={24}
            color={activeTab === 'dashboard' ? '#2196F3' : '#757575'}
          />
          <Text
            style={[
              styles.navText,
              activeTab === 'dashboard' && { color: '#2196F3' },
            ]}
          >
            Dashboard
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.navItem}
          onPress={() => onNavigate && onNavigate('reports')}
        >
          <FileText size={24} color={'#757575'} />
          <Text style={styles.navText}>Reports</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.navItem}
          onPress={() => onNavigate && onNavigate('profile')}
        >
          <User size={24} color={'#757575'} />
          <Text style={styles.navText}>Profile</Text>
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
    paddingBottom: 30,
    borderBottomLeftRadius: 20,
    borderBottomRightRadius: 20,
  },
  headerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  profileRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#E1E1E1',
  },
  teacherName: { color: '#FFF', fontSize: 18, fontWeight: 'bold' },
  addButton: { backgroundColor: '#FFF', padding: 8, borderRadius: 20 },

  statsContainer: { marginTop: -25, paddingHorizontal: 15 },
  statCard: {
    backgroundColor: '#FFF',
    padding: 15,
    borderRadius: 12,
    marginRight: 12,
    minWidth: 130,
    elevation: 3,
  },
  statLabel: { color: '#757575', fontSize: 12, marginBottom: 5 },
  statValue: { fontSize: 24, fontWeight: 'bold' },

  listContainer: { flex: 1, padding: 20, marginTop: -10 },
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
  metaText: { color: '#757575', fontSize: 13 },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    height: 24,
    justifyContent: 'center',
  },
  statusText: { fontSize: 10, fontWeight: 'bold' },
  actionButton: { padding: 12, borderRadius: 8, alignItems: 'center' },
  actionButtonText: { fontWeight: 'bold', fontSize: 14 },

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
  navItem: { alignItems: 'center' },
  navText: { fontSize: 12, color: '#757575', marginTop: 4 },
});
