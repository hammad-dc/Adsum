import React, {useState} from 'react';
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
import {supabase} from './lib/supabase';
import {Lock, Mail, Eye, EyeOff, ShieldAlert} from 'lucide-react-native';
import DeviceInfo from 'react-native-device-info';

export default function Auth() {
  const [isLoginMode, setIsLoginMode] = useState(true); // Default to Login
  const [email, setEmail] = useState('');
  const [fullName, setFullName] = useState('');
  const [course, setCourse] = useState('');
  const [year, setYear] = useState('');
  const [semester, setSemester] = useState('');
  const [teacherId, setTeacherId] = useState('');
  const [cprn, setCprn] = useState('');
  const [batch, setBatch] = useState('A'); // Default to A

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
        const deviceId = !isTeacherMode ? DeviceInfo.getUniqueIdSync() : 'N/A'; // No need to store for teacher

        const {error} = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: {
              full_name: fullName,
              role: isTeacherMode ? 'teacher' : 'student',
              primary_device_id: deviceId, // LOCK the device here
              course: isTeacherMode ? 'Faculty' : course,
              year: isTeacherMode ? 'N/A' : year,
              semester: isTeacherMode ? 'N/A' : semester, // Finalized for your CE Sem 4 sprint
              cprn: isTeacherMode ? 'N/A' : cprn,
              batch: isTeacherMode ? 'N/A' : batch,
            },
          },
        });
        if (error) throw error;
        Alert.alert('Success', 'Account created!');
      } else {
        const {error} = await supabase.auth.signInWithPassword({
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
      style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.scrollContainer}
        keyboardShouldPersistTaps="handled">
        <View style={styles.headerSection}>
          <Text style={styles.title}>Adsum Attendance</Text>
          <Text style={styles.subtitle}>Secure Classroom Access</Text>
        </View>

        <View style={styles.formSection}>
          <View style={styles.inputWrapper}>
            <Mail size={20} color="#666" style={{marginRight: 10}} />
            <TextInput
              style={styles.input}
              placeholder="Email Address"
              placeholderTextColor="#999"
              onChangeText={setEmail}
              value={email}
              autoCapitalize="none"
            />
          </View>

          {/* 2. Extra fields ONLY show during Signup */}
          {!isLoginMode && (
            <>
              <View style={styles.inputWrapper}>
                <TextInput
                  style={styles.input}
                  placeholder="Full Name"
                  placeholderTextColor="#999"
                  onChangeText={setFullName}
                  value={fullName}
                />
              </View>

              {isTeacherMode ? (
                <View style={styles.inputWrapper}>
                  <TextInput
                    style={styles.input}
                    placeholder="Teacher ID"
                    placeholderTextColor="#999"
                    onChangeText={setTeacherId}
                    value={teacherId}
                  />
                </View>
              ) : (
                <>
                  <View style={styles.inputWrapper}>
                    <TextInput
                      style={styles.input}
                      placeholder="Course (e.g. Computer Engineering)"
                      placeholderTextColor="#999"
                      onChangeText={setCourse}
                      value={course}
                    />
                  </View>
                  <View style={styles.inputWrapper}>
                    <TextInput
                      style={styles.input}
                      placeholder="Year (e.g. SE)"
                      placeholderTextColor="#999"
                      onChangeText={setYear}
                      value={year}
                    />
                  </View>
                  <View style={styles.inputWrapper}>
                    <TextInput
                      style={styles.input}
                      placeholder="Semester (e.g., 4)"
                      placeholderTextColor="#999"
                      keyboardType="number-pad" // Makes it easier to type numbers
                      onChangeText={setSemester}
                      value={semester}
                    />
                  </View>
                  {!isLoginMode && !isTeacherMode && (
                    <View style={styles.inputWrapper}>
                      <TextInput
                        style={styles.input}
                        placeholder="Enter CPRN Number (e.g. 241299)"
                        value={cprn}
                        onChangeText={setCprn}
                        placeholderTextColor="#999"
                      />
                    </View>
                  )}
                  {!isTeacherMode && (
                    <View
                      style={[
                        styles.batchSelectorContainer,
                        {marginTop: 0, marginBottom: 15},
                      ]}>
                      <Text style={styles.label}>Select Your Batch:</Text>
                      <View style={styles.batchRow}>
                        {['A', 'B', 'C'].map(b => (
                          <TouchableOpacity
                            key={b}
                            style={[
                              styles.batchBtn,
                              batch === b && styles.batchBtnActive,
                            ]}
                            onPress={() => setBatch(b)}>
                            <Text
                              style={[
                                styles.batchBtnText,
                                batch === b && styles.batchBtnTextActive,
                              ]}>
                              Batch {b}
                            </Text>
                          </TouchableOpacity>
                        ))}
                      </View>
                    </View>
                  )}
                </>
              )}
            </>
          )}
          <View style={styles.inputWrapper}>
            <Lock size={20} color="#666" style={{marginRight: 10}} />
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
          {!isLoginMode && (
            <>
              <View style={styles.teacherToggle}>
                <Text style={styles.toggleText}>Faculty Mode</Text>
                <Switch
                  value={isTeacherMode}
                  onValueChange={setIsTeacherMode}
                  trackColor={{true: '#2196F3'}}
                />
              </View>

              {isTeacherMode && (
                <View style={[styles.inputWrapper, {borderColor: '#FF9800'}]}>
                  <ShieldAlert
                    size={20}
                    color="#FF9800"
                    style={{marginRight: 10}}
                  />
                  <TextInput
                    style={styles.input}
                    placeholder="Admin Key"
                    onChangeText={setAdminKey}
                    value={adminKey}
                    placeholderTextColor="#999"
                    autoCapitalize="characters"
                  />
                </View>
              )}
            </>
          )}

          {/* TEACHER TOGGLE */}

          <View style={styles.buttonContainer}>
            <TouchableOpacity
              style={[styles.button, styles.loginButton]}
              onPress={() => handleAuth(isLoginMode ? 'LOGIN' : 'SIGNUP')}>
              {loading ? (
                <ActivityIndicator color="#FFF" />
              ) : (
                <Text style={styles.buttonText}>
                  {isLoginMode ? 'Sign In' : 'Create Account'}
                </Text>
              )}
            </TouchableOpacity>

            <TouchableOpacity onPress={() => setIsLoginMode(!isLoginMode)}>
              <Text
                style={{textAlign: 'center', color: '#2196F3', marginTop: 10}}>
                {isLoginMode
                  ? "Don't have an account? Sign Up"
                  : 'Already have an account? Login'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {flex: 1, backgroundColor: '#FFF'},
  scrollContainer: {flexGrow: 1, justifyContent: 'center', padding: 25},
  headerSection: {alignItems: 'center', marginBottom: 40},
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#2196F3',
    marginBottom: 5,
  },
  subtitle: {fontSize: 16, color: '#757575'},
  formSection: {width: '100%'},
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
  batchSelectorContainer: {
    marginVertical: 10,
    marginBottom: 20,
    paddingHorizontal: 5,
  },
  label: {color: '#666', marginBottom: 8, fontSize: 14, fontWeight: '600'},
  batchRow: {flexDirection: 'row', justifyContent: 'space-between', gap: 10},
  batchBtn: {
    flex: 1,
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#DDD',
    alignItems: 'center',
    backgroundColor: '#FFF',
  },
  batchBtnActive: {borderColor: '#2196F3', backgroundColor: '#E3F2FD'},
  batchBtnText: {color: '#757575', fontWeight: 'bold'},
  batchBtnTextActive: {color: '#2196F3'},
  input: {flex: 1, fontSize: 16, color: '#333'},
  buttonContainer: {marginTop: 20, gap: 15},
  button: {
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loginButton: {backgroundColor: '#2196F3', elevation: 2},
  signupButton: {
    backgroundColor: '#FFF',
    borderWidth: 2,
    borderColor: '#2196F3',
  },
  buttonText: {fontSize: 16, fontWeight: 'bold', color: '#FFF'},
  signupText: {color: '#2196F3'},
  teacherToggle: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 15,
    paddingHorizontal: 5,
  },
  toggleText: {fontSize: 16, fontWeight: 'bold', color: '#555'},
});
