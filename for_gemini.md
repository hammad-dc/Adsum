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

}: any) {

  const [profile, setProfile] = useState<any>(null);

  const [activeTab, setActiveTab] = useState('dashboard');

  const [classes, setClasses] = useState<any[]>([]);

  const [loading, setLoading] = useState(true);

  const [assignedSubjects, setAssignedSubjects] = useState<any[]>([]); // For the bottom list



  const teacherEmailSeed = getProfileSeed(teacher);



  const fetchClasses = async () => {

    setLoading(true);



    console.log('🔍 Fetching for Teacher ID:', teacher.id); // DEBUG



    try {

      const {data: activeSessions, error: sessErr} = await supabase

        .from('sessions')

        .select('*, subjects(*)')

        .eq('teacher_id', teacher.id)

        .eq('is_active', true)

        .order('created_at', {ascending: false});



      const {data: assignedSubjects, error: subErr} = await supabase

        .from('subjects')

        .select('*')

        .eq('teacher_id', teacher.id);



      console.log('📚 Assigned Subjects Found:', assignedSubjects?.length);



      console.log('📡 Live Sessions Found:', activeSessions?.length);

      if (sessErr || subErr) throw sessErr || subErr;

      // if (sessError) throw sessError;



      setClasses(activeSessions || []);

      setAssignedSubjects(assignedSubjects || []);

    } catch (err) {

      console.error('Fetch failed:', err);

    } finally {

      setLoading(false);

    }

  };



  useEffect(() => {

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



    fetchClasses();

    fetchTeacherProfile();

  }, [teacher?.id]); // ✅ Re-run if teacher ID changes/loads



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

                onPress={() => onNavigate && onNavigate('add-class')}>

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



          <ScrollView

            contentContainerStyle={{flexGrow: 1}} // Allows the content to stretch and scroll

            showsVerticalScrollIndicator={false}>

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

                      // 🎯 Pass the subject data as an object

                      onNavigate &&

                      onNavigate('add-class', {initialSubject: item})

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



    if (activeTab === 'reports') {

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

              <Text style={styles.menuText}>Download Attendance Reports</Text>

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

}import React, {useState, useEffect} from 'react';

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

}: any) {

  const [profile, setProfile] = useState<any>(null);

  const [activeTab, setActiveTab] = useState('dashboard');

  const [classes, setClasses] = useState<any[]>([]);

  const [loading, setLoading] = useState(true);

  const [assignedSubjects, setAssignedSubjects] = useState<any[]>([]); // For the bottom list



  const teacherEmailSeed = getProfileSeed(teacher);



  const fetchClasses = async () => {

    setLoading(true);



    console.log('🔍 Fetching for Teacher ID:', teacher.id); // DEBUG



    try {

      const {data: activeSessions, error: sessErr} = await supabase

        .from('sessions')

        .select('*, subjects(*)')

        .eq('teacher_id', teacher.id)

        .eq('is_active', true)

        .order('created_at', {ascending: false});



      const {data: assignedSubjects, error: subErr} = await supabase

        .from('subjects')

        .select('*')

        .eq('teacher_id', teacher.id);



      console.log('📚 Assigned Subjects Found:', assignedSubjects?.length);



      console.log('📡 Live Sessions Found:', activeSessions?.length);

      if (sessErr || subErr) throw sessErr || subErr;

      // if (sessError) throw sessError;



      setClasses(activeSessions || []);

      setAssignedSubjects(assignedSubjects || []);

    } catch (err) {

      console.error('Fetch failed:', err);

    } finally {

      setLoading(false);

    }

  };



  useEffect(() => {

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



    fetchClasses();

    fetchTeacherProfile();

  }, [teacher?.id]); // ✅ Re-run if teacher ID changes/loads



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

                onPress={() => onNavigate && onNavigate('add-class')}>

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



          <ScrollView

            contentContainerStyle={{flexGrow: 1}} // Allows the content to stretch and scroll

            showsVerticalScrollIndicator={false}>

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

                      // 🎯 Pass the subject data as an object

                      onNavigate &&

                      onNavigate('add-class', {initialSubject: item})

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



    if (activeTab === 'reports') {

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

              <Text style={styles.menuText}>Download Attendance Reports</Text>

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


import React, {useEffect, useState} from 'react';
import {View, ActivityIndicator, StyleSheet} from 'react-native';
import {Session} from '@supabase/supabase-js';
import {supabase} from './src/lib/supabase';

import Auth from './src/Auth';
import StudentDashboard from './src/StudentDashboard';
import TeacherDashboard from './src/TeacherDashboard';
import StartSession from './src/StartSession';
import MarkAttendance from './src/MarkAttendance';
import AddNewClass from './src/AddNewClass';
import AttendanceHistory from './src/AttendanceHistory';
import Profile from './src/Profile';
import ManualOverride from './src/ManualOverride';

export default function App() {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [userRole, setUserRole] = useState<'student' | 'teacher' | null>(null);

  const [currentScreen, setCurrentScreen] = useState('dashboard');
  const [selectedData, setSelectedData] = useState<any>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({data: {session}}) => {
      checkUserRole(session);
    });

    const {
      data: {subscription},
    } = supabase.auth.onAuthStateChange((_event, session) => {
      checkUserRole(session);
    });

    return () => subscription.unsubscribe();
  }, []);

  // NEW: Fetch Real Role from DB
  const checkUserRole = async (session: Session | null) => {
    if (!session) {
      setSession(null);
      setUserRole(null);
      setLoading(false);
      return;
    }

    try {
      const {data, error} = await supabase
        .from('profiles')
        .select('role')
        .eq('id', session.user.id)
        .single();

      if (data) {

        setUserRole(data.role);
      } else {
       
        setUserRole('student');
      }
      // if (data) setUserRole(data.role);
      // else setUserRole('student'); // Default fallback

      setSession(session);
    } catch (e) {
      console.error('Role fetch error:', e);
    } finally {
      setLoading(false);
      setCurrentScreen('dashboard'); // Reset nav
      setSelectedData(null);
    }
  };

  if (loading)
    return (
      <View style={styles.container}>
        <ActivityIndicator size="large" color="#2196F3" />
      </View>
    );

  if (!session) return <Auth />;

  // helper to go back home
  const goHome = () => {
    setCurrentScreen('dashboard');
    setSelectedData(null);
  };

  // --- TEACHER FLOW ---
  if (userRole === 'teacher') {
    if (currentScreen === 'add-class')
      return <AddNewClass onBack={goHome} onClassCreated={goHome} />;

    if (currentScreen === 'start-session' && selectedData) {
      return <StartSession classSession={selectedData} onBack={goHome} />;
    }

    if (currentScreen === 'profile')
      return <Profile session={session} role="Faculty" onBack={goHome} />;

    return (
      <TeacherDashboard
        teacher={{
          id: session.user.id, // ✅ CRITICAL: Add this line!
          name:
            session.user.user_metadata?.name || "Faculty Member",
          email: session.user.email,
        }}
        onNavigate={setCurrentScreen}
        onSelectClass={(data: any) => {
          setSelectedData(data);
          setCurrentScreen('start-session');
        }}
      />
    );
  }

  // --- STUDENT FLOW ---
  if (currentScreen === 'mark-attendance' && selectedData) {
    return (
      <MarkAttendance
        classSession={selectedData}
        onBack={goHome}
        onSuccess={goHome}
      />
    );
  }
  if (currentScreen === 'history') return <AttendanceHistory onBack={goHome} />;
  if (currentScreen === 'profile')
    return <Profile session={session} role="Student" onBack={goHome} />;

  return (
    <StudentDashboard
      session={session}
      onNavigate={(screen: string, data: any) => {
        if (data) setSelectedData(data);
        setCurrentScreen(screen);
      }}
    />
  );
}

const styles = StyleSheet.create({
  container: {flex: 1, justifyContent: 'center', alignItems: 'center'},
});
