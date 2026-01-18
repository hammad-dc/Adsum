import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Switch,
} from 'react-native';
import { supabase } from './lib/supabase';
import { Lock, Mail, Eye, EyeOff, ShieldAlert } from 'lucide-react-native';

export default function Auth() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  // NEW: Teacher Mode Toggle
  const [isTeacherMode, setIsTeacherMode] = useState(false);
  const [adminKey, setAdminKey] = useState(''); // Secret key to become a teacher

  async function handleAuth(type: 'LOGIN' | 'SIGNUP') {
    if (!email || !password) {
      Alert.alert('Missing Fields', 'Please enter email and password.');
      return;
    }

    if (type === 'SIGNUP' && isTeacherMode && adminKey !== 'ADMIN') {
      Alert.alert(
        'Unauthorized',
        'Invalid Admin Key. You cannot create a teacher account.',
      );
      return;
    }

    setLoading(true);
    try {
      if (type === 'SIGNUP') {
        const role = isTeacherMode ? 'teacher' : 'student';
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: { full_name: isTeacherMode ? 'Faculty' : 'Student', role },
          },
        });
        if (error) throw error;
        Alert.alert('Success', 'Account created! Please sign in.');
      } else {
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (error) throw error;
      }
    } catch (err: any) {
      Alert.alert('Error', err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={styles.container}
    >
      <ScrollView
        contentContainerStyle={styles.scrollContainer}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.headerSection}>
          <Text style={styles.title}>Adsum Attendance</Text>
          <Text style={styles.subtitle}>Secure Classroom Access</Text>
        </View>

        <View style={styles.formSection}>
          <View style={styles.inputWrapper}>
            <Mail size={20} color="#666" style={{ marginRight: 10 }} />
            <TextInput
              style={styles.input}
              placeholder="Email Address"
              placeholderTextColor="#999"
              onChangeText={setEmail}
              value={email}
              autoCapitalize="none"
            />
          </View>

          <View style={styles.inputWrapper}>
            <Lock size={20} color="#666" style={{ marginRight: 10 }} />
            <TextInput
              style={styles.input}
              placeholder="Password"
              placeholderTextColor="#999"
              secureTextEntry={!showPassword}
              onChangeText={setPassword}
              value={password}
            />
            <TouchableOpacity onPress={() => setShowPassword(!showPassword)}>
              {showPassword ? (
                <EyeOff size={20} color="#666" />
              ) : (
                <Eye size={20} color="#666" />
              )}
            </TouchableOpacity>
          </View>

          {/* TEACHER TOGGLE */}
          <View style={styles.teacherToggle}>
            <Text style={styles.toggleText}>Faculty Mode</Text>
            <Switch
              value={isTeacherMode}
              onValueChange={setIsTeacherMode}
              trackColor={{ true: '#2196F3' }}
            />
          </View>

          {/* ADMIN KEY INPUT (Only if Teacher Mode is ON) */}
          {isTeacherMode && (
            <View style={[styles.inputWrapper, { borderColor: '#FF9800' }]}>
              <ShieldAlert
                size={20}
                color="#FF9800"
                style={{ marginRight: 10 }}
              />
              <TextInput
                style={styles.input}
                placeholder="Enter Admin Key (hint: ADMIN)"
                placeholderTextColor="#999"
                onChangeText={setAdminKey}
                value={adminKey}
                autoCapitalize="characters"
              />
            </View>
          )}

          <View style={styles.buttonContainer}>
            <TouchableOpacity
              style={[styles.button, styles.loginButton]}
              onPress={() => handleAuth('LOGIN')}
            >
              {loading ? (
                <ActivityIndicator color="#FFF" />
              ) : (
                <Text style={styles.buttonText}>Sign In</Text>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.button, styles.signupButton]}
              onPress={() => handleAuth('SIGNUP')}
            >
              <Text style={[styles.buttonText, styles.signupText]}>
                Create Account
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFF' },
  scrollContainer: { flexGrow: 1, justifyContent: 'center', padding: 25 },
  headerSection: { alignItems: 'center', marginBottom: 40 },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#2196F3',
    marginBottom: 5,
  },
  subtitle: { fontSize: 16, color: '#757575' },
  formSection: { width: '100%' },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F5F7FA',
    borderRadius: 12,
    paddingHorizontal: 15,
    marginBottom: 15,
    borderWidth: 1,
    borderColor: '#EEE',
    height: 55,
  },
  input: { flex: 1, fontSize: 16, color: '#333' },
  buttonContainer: { marginTop: 20, gap: 15 },
  button: {
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loginButton: { backgroundColor: '#2196F3', elevation: 2 },
  signupButton: {
    backgroundColor: '#FFF',
    borderWidth: 2,
    borderColor: '#2196F3',
  },
  buttonText: { fontSize: 16, fontWeight: 'bold', color: '#FFF' },
  signupText: { color: '#2196F3' },
  teacherToggle: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 15,
    paddingHorizontal: 5,
  },
  toggleText: { fontSize: 16, fontWeight: 'bold', color: '#555' },
});
