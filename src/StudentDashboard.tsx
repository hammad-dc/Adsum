import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  StatusBar,
} from 'react-native';
import { Bell, Home, History, User, Clock, MapPin } from 'lucide-react-native';
import Svg, { Circle } from 'react-native-svg';

// Mock Data
const MOCK_CLASSES = [
  {
    id: '1',
    name: 'Data Structures',
    time: '9:00 AM - 10:00 AM',
    room: 'Lab 301',
    status: 'ongoing',
  },
  {
    id: '2',
    name: 'Database Management',
    time: '10:15 AM - 11:15 AM',
    room: 'Room 204',
    status: 'upcoming',
  },
  {
    id: '3',
    name: 'Algorithms',
    time: '11:30 AM - 12:30 PM',
    room: 'Lab 302',
    status: 'upcoming',
  },
  {
    id: '4',
    name: 'Operating Systems',
    time: '2:00 PM - 3:00 PM',
    room: 'Room 301',
    status: 'upcoming',
  },
];

export default function StudentDashboard({ session, onNavigate }: any) {
  const [activeTab, setActiveTab] = useState('home');

  // --- Chart Calculations ---
  const size = 100;
  const strokeWidth = 10;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const progress = 0.87; // 87%
  const strokeDashoffset = circumference * (1 - progress);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'ongoing':
        return { bg: '#4CAF50', text: '#FFFFFF', label: 'Ongoing' };
      case 'upcoming':
        return { bg: '#E0E0E0', text: '#757575', label: 'Upcoming' };
      default:
        return { bg: '#E0E0E0', text: '#757575', label: status };
    }
  };

  const renderContent = () => {
    if (activeTab === 'home') {
      return (
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {/* Blue Header Section */}
          <View style={styles.headerContainer}>
            <View style={styles.headerContent}>
              <View style={styles.userInfo}>
                <Image
                  source={{
                    uri: 'https://api.dicebear.com/9.x/avataaars/png?seed=Rahul',
                  }}
                  style={styles.avatar}
                />
                <View>
                  <Text style={styles.userName}>Rahul Sharma</Text>
                  <Text style={styles.userId}>Student ID: S-2025</Text>
                </View>
              </View>
              <TouchableOpacity style={styles.iconButton}>
                <Bell color="#FFF" size={24} />
              </TouchableOpacity>
            </View>

            {/* Attendance Summary Card (Overlapping) */}
            <View style={styles.summaryCard}>
              <View style={{ flex: 1 }}>
                <Text style={styles.summaryLabel}>Overall Attendance</Text>
                <Text style={styles.summaryPercent}>87%</Text>
                <Text style={styles.summarySub}>60 out of 69 classes</Text>
              </View>

              <View
                style={{
                  width: 100,
                  height: 100,
                  transform: [{ rotate: '-90deg' }],
                }}
              >
                <Svg width={size} height={size}>
                  <Circle
                    cx={size / 2}
                    cy={size / 2}
                    r={radius}
                    stroke="#E3F2FD"
                    strokeWidth={strokeWidth}
                    fill="none"
                  />
                  <Circle
                    cx={size / 2}
                    cy={size / 2}
                    r={radius}
                    stroke="#2196F3"
                    strokeWidth={strokeWidth}
                    fill="none"
                    strokeDasharray={circumference}
                    strokeDashoffset={strokeDashoffset}
                    strokeLinecap="round"
                  />
                </Svg>
              </View>
            </View>
          </View>

          {/* List Section */}
          <View style={styles.listSection}>
            <Text style={styles.sectionTitle}>Today's Schedule</Text>

            {MOCK_CLASSES.map(item => {
              const statusColors = getStatusColor(item.status);
              return (
                <View key={item.id} style={styles.classCard}>
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
                      style={[
                        styles.statusPill,
                        { backgroundColor: statusColors.bg },
                      ]}
                    >
                      <Text
                        style={[
                          styles.statusText,
                          { color: statusColors.text },
                        ]}
                      >
                        {statusColors.label}
                      </Text>
                    </View>
                  </View>

                  {item.status === 'ongoing' && (
                    <TouchableOpacity
                      style={styles.markButton}
                      onPress={() =>
                        onNavigate && onNavigate('mark-attendance', item)
                      }
                    >
                      <Text style={styles.markButtonText}>Mark Attendance</Text>
                    </TouchableOpacity>
                  )}
                </View>
              );
            })}
          </View>
          <View style={{ height: 100 }} />
        </ScrollView>
      );
    }
    return (
      <View style={styles.centerContainer}>
        <Text>Coming Soon</Text>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <StatusBar backgroundColor="#2196F3" barStyle="light-content" />

      {renderContent()}

      {/* Bottom Navigation */}
      <View style={styles.bottomNav}>
        <TouchableOpacity
          style={styles.navItem}
          onPress={() => setActiveTab('home')}
        >
          <Home
            size={24}
            color={activeTab === 'home' ? '#2196F3' : '#757575'}
          />
          <Text
            style={[
              styles.navText,
              activeTab === 'home' && { color: '#2196F3' },
            ]}
          >
            Home
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.navItem}
          onPress={() => onNavigate && onNavigate('history', null)}
        >
          <History
            size={24}
            color={activeTab === 'history' ? '#2196F3' : '#757575'}
          />
          <Text
            style={[
              styles.navText,
              activeTab === 'history' && { color: '#2196F3' },
            ]}
          >
            History
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.navItem}
          onPress={() => onNavigate && onNavigate('profile', null)}
        >
          <User
            size={24}
            color={activeTab === 'profile' ? '#2196F3' : '#757575'}
          />
          <Text
            style={[
              styles.navText,
              activeTab === 'profile' && { color: '#2196F3' },
            ]}
          >
            Profile
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F5F5F5' },
  scrollContent: { paddingBottom: 20 },
  centerContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },

  headerContainer: {
    backgroundColor: '#2196F3',
    paddingTop: 20,
    paddingBottom: 80,
    paddingHorizontal: 24,
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
  },
  headerContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  userInfo: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  avatar: { width: 48, height: 48, borderRadius: 24, backgroundColor: '#FFF' },
  userName: { fontSize: 20, fontWeight: 'bold', color: '#FFF' },
  userId: { fontSize: 14, color: '#BBDEFB' },
  iconButton: { padding: 4 },

  summaryCard: {
    position: 'absolute',
    bottom: -50,
    left: 24,
    right: 24,
    backgroundColor: '#FFF',
    borderRadius: 16,
    padding: 20,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 10,
  },
  summaryLabel: { fontSize: 14, color: '#757575', marginBottom: 4 },
  summaryPercent: { fontSize: 36, fontWeight: 'bold', color: '#2196F3' },
  summarySub: { fontSize: 12, color: '#757575', marginTop: 4 },

  listSection: {
    marginTop: 70,
    paddingHorizontal: 24,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#212121',
    marginBottom: 16,
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
  metaText: { fontSize: 14, color: '#757575' },

  statusPill: { paddingHorizontal: 12, paddingVertical: 4, borderRadius: 12 },
  statusText: { fontSize: 12, fontWeight: 'bold' },

  markButton: {
    backgroundColor: '#2196F3',
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 16,
  },
  markButtonText: { color: '#FFF', fontWeight: 'bold', fontSize: 16 },

  bottomNav: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#FFF',
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: '#E0E0E0',
    elevation: 10,
  },
  navItem: { alignItems: 'center' },
  navText: { fontSize: 12, marginTop: 4, color: '#757575' },
});
