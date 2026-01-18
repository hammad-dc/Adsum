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

export default function Profile({ session, role, onBack }: any) {
  // Note: 'role' prop passed from App.tsx
  const email = session?.user?.email;
  const name = email?.split('@')[0] || 'User';

  const handleLogout = async () => {
    await supabase.auth.signOut();
  };

  return (
    <View style={styles.container}>
      {/* ... Header ... */}
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.avatarContainer}>
          <Image
            source={{
              uri: `https://api.dicebear.com/9.x/initials/png?seed=${email}&backgroundColor=2196F3&chars=2`,
            }}
            style={styles.avatar}
          />
          <Text style={styles.name}>{name}</Text>
          <Text style={styles.role}>{role}</Text>
        </View>

        <View style={styles.card}>
          <View style={styles.infoRow}>
            <Mail size={20} color="#757575" />
            <Text style={{ marginLeft: 10, fontSize: 16 }}>{email}</Text>
          </View>
          <View
            style={{ height: 1, backgroundColor: '#EEE', marginVertical: 10 }}
          />
          <View style={styles.infoRow}>
            <User size={20} color="#757575" />
            <Text style={{ marginLeft: 10, fontSize: 16 }}>{role} Account</Text>
          </View>
        </View>

        {/* ... Logout Button ... */}
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
