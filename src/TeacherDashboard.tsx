import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  FlatList,
  StatusBar,
} from 'react-native';
import {
  Bell,
  LayoutDashboard,
  FileText,
  User,
  Clock,
  MapPin,
  Users,
  Plus,
} from 'lucide-react-native';
import { supabase } from './lib/supabase'; // Needed for the logout trick

const mockClasses = [
  {
    id: '1',
    name: 'Data Structures - Sec A',
    time: '9:00 AM - 10:00 AM',
    room: 'Lab 301',
    status: 'ongoing',
    totalStudents: 50,
    presentStudents: 23,
  },
  {
    id: '2',
    name: 'Algorithms - Sec B',
    time: '10:15 AM - 11:15 AM',
    room: 'Lab 302',
    status: 'upcoming',
    totalStudents: 45,
    presentStudents: 0,
  },
  {
    id: '3',
    name: 'Data Structures - Sec B',
    time: '11:30 AM - 12:30 PM',
    room: 'Lab 301',
    status: 'upcoming',
    totalStudents: 48,
    presentStudents: 0,
  },
];

export default function TeacherDashboard({
  teacher,
  onNavigate,
  onSelectClass,
}: any) {
  const [activeTab, setActiveTab] = useState('dashboard');

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'ongoing':
        return { bg: '#4CAF50', text: '#FFF' };
      case 'upcoming':
        return { bg: '#E0E0E0', text: '#757575' };
      default:
        return { bg: '#2196F3', text: '#FFF' };
    }
  };

  const renderClassItem = ({ item }: any) => {
    const statusColors = getStatusColor(item.status);
    return (
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <View style={{ flex: 1 }}>
            <Text style={styles.className}>{item.name}</Text>
            <View style={styles.metaRow}>
              <Clock size={14} color="#757575" />
              <Text style={styles.metaText}>{item.time}</Text>
            </View>
            <View style={styles.metaRow}>
              <MapPin size={14} color="#757575" />
              <Text style={styles.metaText}>{item.room}</Text>
            </View>
          </View>
          <View
            style={[styles.statusBadge, { backgroundColor: statusColors.bg }]}
          >
            <Text style={[styles.statusText, { color: statusColors.text }]}>
              {item.status.toUpperCase()}
            </Text>
          </View>
        </View>

        <TouchableOpacity
          style={[
            styles.actionButton,
            {
              backgroundColor: item.status === 'ongoing' ? '#2196F3' : '#fff',
              borderWidth: item.status === 'ongoing' ? 0 : 1,
              borderColor: '#E0E0E0',
            },
          ]}
          onPress={() => onSelectClass && onSelectClass(item)}
        >
          <Text
            style={[
              styles.actionButtonText,
              { color: item.status === 'ongoing' ? '#FFF' : '#333' },
            ]}
          >
            {item.status === 'ongoing' ? 'Manage Session' : 'Start Session'}
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
          {/* Profile Row with Logout Trick */}
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

          {/* FIX 1: Send 'add-class' to match App.tsx */}
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
            <Text style={styles.statLabel}>Classes Today</Text>
            <Text style={[styles.statValue, { color: '#2196F3' }]}>4</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statLabel}>Students Attended</Text>
            <Text style={[styles.statValue, { color: '#4CAF50' }]}>23</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statLabel}>Pending</Text>
            <Text style={[styles.statValue, { color: '#FF9800' }]}>3</Text>
          </View>
        </ScrollView>
      </View>

      {/* Class List */}
      <View style={styles.listContainer}>
        <Text style={styles.sectionTitle}>Today's Classes</Text>
        <FlatList
          data={mockClasses}
          keyExtractor={item => item.id}
          renderItem={renderClassItem}
          contentContainerStyle={{ paddingBottom: 80 }}
        />
      </View>

      {/* Bottom Nav */}
      <View style={styles.bottomNav}>
        {/* Dashboard Button */}
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

        {/* Reports Button (FIX 2: Navigate to Reports/History) */}
        <TouchableOpacity
          style={styles.navItem}
          onPress={() => onNavigate && onNavigate('reports')}
        >
          <FileText size={24} color={'#757575'} />
          <Text style={styles.navText}>Reports</Text>
        </TouchableOpacity>

        {/* Profile Button (FIX 3: Navigate to Profile Screen) */}
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

  listContainer: { flex: 1, padding: 20 },
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
