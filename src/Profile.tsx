import React from 'react';
import {useEffect, useState} from 'react';
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
import {supabase} from './lib/supabase';

export default function Profile({session, onBack}: any) {
  // Note: 'role' prop passed from App.tsx

  const email = session?.user?.email;
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    const fetchProfile = async () => {
      try {
        const {data, error} = await supabase
          .from('profiles')
          .select('*')
          .eq('id', session.user.id)
          .single();

        if (data) setProfile(data);
      } catch (err) {
        console.error('Profile fetch error:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchProfile();
  }, [session.user.id]);
  if (loading)
    return (
      <View style={styles.container}>
        <Text>Loading...</Text>
      </View>
    );

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.avatarContainer}>
          <Image
            source={{
              uri: `https://api.dicebear.com/9.x/initials/png?seed=${
                profile?.email || email
              }&backgroundColor=2196F3&chars=2`,
            }}
            style={styles.avatar}
          />
          {/* Displays Real Name from DB instead of email prefix */}
          <Text style={styles.name}>{profile?.name || 'Loading...'}</Text>
          <Text style={styles.role}>
            {profile?.role === 'teacher' ? 'Faculty' : 'Student'}
          </Text>
        </View>

        <View style={styles.card}>
          <View style={styles.infoRow}>
            <Mail size={20} color="#757575" />
            <Text style={{marginLeft: 10, fontSize: 16}}>
              {profile?.email || email}
            </Text>
          </View>

          <View style={styles.divider} />

          {/* NEW: Conditional ID/Course Row */}
          <View style={styles.infoRow}>
            {profile?.role === 'teacher' ? (
              <>
                <Shield size={20} color="#757575" />
                <View style={{marginLeft: 10}}>
                  <Text style={styles.infoLabel}>Teacher ID</Text>
                  <Text style={styles.infoValue}>
                    {profile?.employee_id || 'N/A'}
                  </Text>
                </View>
              </>
            ) : (
              <>
                <BookOpen size={20} color="#757575" />
                <View style={{marginLeft: 10}}>
                  <Text style={styles.infoLabel}>Course & Year</Text>
                  <Text style={styles.infoValue}>
                    {profile?.course} - {profile?.year}
                  </Text>
                </View>
              </>
            )}
          </View>
        </View>

        {/* ... Logout Button ... */}
        <TouchableOpacity
          style={styles.logoutButton}
          onPress={() => supabase.auth.signOut()}>
          <LogOut size={20} color="#FFF" style={{marginRight: 10}} />
          <Text style={styles.logoutText}>Sign Out</Text>
        </TouchableOpacity>

        <Text style={styles.version}>
          Adsum v1.0.4 - Zero Hardware Attendance
        </Text>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {flex: 1, backgroundColor: '#F5F5F5'},
  header: {
    backgroundColor: '#2196F3',
    padding: 20,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  headerTitle: {color: '#FFF', fontSize: 20, fontWeight: 'bold'},
  content: {padding: 20},

  avatarContainer: {alignItems: 'center', marginBottom: 25},
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
  role: {fontSize: 16, color: '#757575'},

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
  infoLabel: {fontSize: 12, color: '#757575'},
  infoValue: {fontSize: 16, color: '#212121', fontWeight: '500'},
  divider: {height: 1, backgroundColor: '#EEE', marginVertical: 5},

  logoutButton: {
    backgroundColor: '#FF5252',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 15,
    borderRadius: 12,
    elevation: 2,
  },
  logoutText: {color: '#FFF', fontSize: 16, fontWeight: 'bold'},
  version: {
    textAlign: 'center',
    color: '#BDBDBD',
    marginTop: 20,
    fontSize: 12,
  },
});
