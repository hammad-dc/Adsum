import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  ScrollView,
  Alert,
} from 'react-native';
import {
  ArrowLeft,
  Mail,
  Phone,
  User,
  LogOut,
  BookOpen,
  Shield,
} from 'lucide-react-native';
import { supabase } from './lib/supabase';

export default function Profile({ session, onBack }: any) {
  const email = session?.user?.email || 'user@adsum.com';
  // Logic: Check role based on email (simple check for now)
  const isTeacher = email.toLowerCase().includes('teacher');
  const role = isTeacher ? 'Faculty Member' : 'Student';
  const id = isTeacher ? 'T-100' : 'S-2025-001';

  const handleLogout = async () => {
    const { error } = await supabase.auth.signOut();
    if (error) Alert.alert('Error', error.message);
    // App.tsx will handle the state change automatically
  };

  const InfoRow = ({ icon: Icon, label, value }: any) => (
    <View style={styles.infoRow}>
      <View style={styles.iconBox}>
        <Icon size={20} color="#757575" />
      </View>
      <View>
        <Text style={styles.infoLabel}>{label}</Text>
        <Text style={styles.infoValue}>{value}</Text>
      </View>
    </View>
  );

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={onBack}>
          <ArrowLeft color="#FFF" size={24} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Profile</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        {/* Avatar Section */}
        <View style={styles.avatarContainer}>
          <Image
            source={{
              uri: `https://api.dicebear.com/9.x/avataaars/png?seed=${email}`,
            }}
            style={styles.avatar}
          />
          <Text style={styles.name}>{email.split('@')[0]}</Text>
          <Text style={styles.role}>{role}</Text>
        </View>

        {/* Details Card */}
        <View style={styles.card}>
          <InfoRow
            icon={User}
            label={isTeacher ? 'Teacher ID' : 'Student ID'}
            value={id}
          />
          <View style={styles.divider} />
          <InfoRow icon={Mail} label="Email Address" value={email} />
          <View style={styles.divider} />
          <InfoRow
            icon={Shield}
            label="Department"
            value="Computer Engineering"
          />
          {isTeacher && (
            <>
              <View style={styles.divider} />
              <InfoRow
                icon={BookOpen}
                label="Subjects"
                value="Data Structures, Algorithms"
              />
            </>
          )}
        </View>

        {/* Logout Button */}
        <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
          <LogOut size={20} color="#FFF" style={{ marginRight: 10 }} />
          <Text style={styles.logoutText}>Logout</Text>
        </TouchableOpacity>

        <Text style={styles.version}>Adsum App v1.0.0</Text>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F5F5F5' },
  header: {
    backgroundColor: '#2196F3',
    padding: 20,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  headerTitle: { color: '#FFF', fontSize: 20, fontWeight: 'bold' },
  content: { padding: 20 },

  avatarContainer: { alignItems: 'center', marginBottom: 25 },
  avatar: {
    width: 100,
    height: 100,
    borderRadius: 50,
    borderWidth: 4,
    borderColor: '#FFF',
    marginBottom: 10,
  },
  name: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#212121',
    textTransform: 'capitalize',
  },
  role: { fontSize: 16, color: '#757575' },

  card: {
    backgroundColor: '#FFF',
    borderRadius: 12,
    padding: 20,
    elevation: 2,
    marginBottom: 25,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 15,
    paddingVertical: 10,
  },
  iconBox: {
    width: 40,
    height: 40,
    backgroundColor: '#F5F5F5',
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  infoLabel: { fontSize: 12, color: '#757575' },
  infoValue: { fontSize: 16, color: '#212121', fontWeight: '500' },
  divider: { height: 1, backgroundColor: '#EEE', marginVertical: 5 },

  logoutButton: {
    backgroundColor: '#FF5252',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 15,
    borderRadius: 12,
    elevation: 2,
  },
  logoutText: { color: '#FFF', fontSize: 16, fontWeight: 'bold' },
  version: {
    textAlign: 'center',
    color: '#BDBDBD',
    marginTop: 20,
    fontSize: 12,
  },
});
