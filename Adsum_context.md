# Adsum Architecture Context

Adsum is a React Native attendance application for students and faculty. Its central workflow is a teacher-created class session that students discover through cohort filtering and complete through a configurable verification handshake: attendance code, Bluetooth proximity, and GPS location.

## Core Features

### Authentication and roles

- Email/password sign-in and account creation through Supabase Auth.
- Student and teacher account modes, selected during signup.
- Role lookup from the `profiles` table determines the application experience.
- Student signup records academic metadata and a primary device identifier.
- Teacher signup currently uses a client-side admin-key check.

### Student capabilities

- View active classes matching course, year, semester, and batch.
- Mark attendance with a four-digit session code.
- Complete optional BLE and GPS verification when required by the teacher.
- View attendance history, aggregate totals, absences, and percentage.
- View subject-level progress through PostgreSQL RPCs.
- View a calendar heatmap showing daily attendance density, missed classes, and holidays.
- View profile information and sign out.

### Teacher capabilities

- View active sessions, historical session counts, assigned subjects, and profile information.
- Create sessions for assigned subjects.
- Target all students for theory sessions or a specific batch for practical sessions.
- Configure a session as code-only, code plus Bluetooth, or Bluetooth plus GPS.
- Start and end live sessions.
- Broadcast a session-specific BLE signal from the teacher device.
- Generate and rotate attendance codes with pause/resume support.
- Monitor attendance counts in real time.
- Manually mark absent students present, revoke attendance, and inspect suspected device mismatches.
- View subject-level academic reports and per-session attendance counts.

## Component Architecture

### Root application state machine

[`App.tsx`](App.tsx) is the application shell. It does not use React Navigation. Instead, it maintains:

- `session`: the current Supabase Auth session.
- `userRole`: the role loaded from `profiles`.
- `currentScreen`: the active root-level screen key.
- `selectedData`: the selected class or subject passed to the next screen.
- `dashboardTab`: the teacher dashboard tab to restore after reports.

On startup, `App.tsx` restores the Supabase session and subscribes to Auth state changes. It then queries `profiles.role` and renders one of three branches:

```text
No session       -> Auth
Student session  -> StudentDashboard or student workflow screen
Teacher session  -> TeacherDashboard or teacher workflow screen
```

`SafeAreaProvider` wraps the root component. Navigation is implemented by replacing the rendered root screen and passing callbacks such as `onNavigate`, `onBack`, and `onSelectClass`.

### Student flow

```text
StudentDashboard
├── AttendanceGrid       calendar/heatmap presentation
├── Progress             subject-level analytics view
├── MarkAttendance       active session verification workflow
├── AttendanceHistory    attendance records and summary statistics
└── Profile              shared profile and sign-out screen
```

`StudentDashboard` owns the student home/progress/profile tab state and loads the profile, holidays, live sessions, attendance records, and aggregate statistics. It passes the selected live session through `App.tsx` to `MarkAttendance`.

### Teacher flow

```text
TeacherDashboard
├── AddNewClass          assigned-subject and session creation
├── StartSession         live session control and security configuration
│   └── ManualOverride   roster review and manual attendance changes
├── AcademicReports      subject reports and session history
└── Profile              shared profile and sign-out screen
```

`TeacherDashboard` owns the dashboard/profile tab state, loads assigned subjects through `subject_assignments`, and passes selected class or subject data through `App.tsx`. `StartSession` owns the active session lifecycle and opens `ManualOverride` as a modal.

`LiveAttendanceView.tsx` contains an alternative realtime attendance list, but it is not imported or routed by `App.tsx`; the current teacher flow uses the count card in `StartSession` and the `ManualOverride` modal.

### State management model

- State is local to screens through React `useState` and `useEffect`.
- `App.tsx` provides the only cross-screen state bridge.
- Supabase is the shared source of truth for authentication, sessions, attendance, profiles, and reporting data.
- Screens generally refetch after mutations rather than using a centralized client cache.
- Realtime subscriptions refresh selected session or attendance data while the relevant screen is mounted.

## Data & Backend

### Supabase client

[`src/lib/supabase.ts`](src/lib/supabase.ts) creates one Supabase client using environment variables exposed through `react-native-dotenv`. Auth sessions persist in `AsyncStorage`. An AppState listener starts Supabase token refresh while the app is active and stops it when the app is backgrounded.

### Auth and database tables

- `auth.users`: managed by Supabase Auth for credentials and user metadata.
- `profiles`: application identity, role, name/email, student course/year/semester/batch, employee ID, CPRN, and primary device ID.
- `subjects`: subject definitions and target academic cohort metadata.
- `subject_assignments`: teacher-to-subject bridge used to restrict faculty to assigned subjects.
- `sessions`: class instances, teacher and subject references, target cohort, room, GPS coordinates, BLE/security flags, active code, timer state, lifecycle timestamps, and closure state.
- `attendance`: student/session records with status, timestamp, device ID, verification method, and BLE/location verification flags. The application expects uniqueness for one student per session.
- `classrooms`: static room coordinates used when a session uses fixed-location mode.
- `holidays`: dates used by the student attendance calendar.

### Database queries and RPCs

The screens use Supabase table queries with nested relationship selects for subjects, profiles, and attendance. Server-side functions provide aggregate calculations:

- `get_student_stats`: overall attended and possible session counts.
- `get_subject_wise_stats`: student progress grouped by subject.
- `get_teacher_subject_reports`: teacher subject summaries, including expected enrollment and presence totals.

### Realtime channels

- `MarkAttendance` subscribes to `UPDATE` events for its current `sessions` row so a changed attendance code can reach the student screen.
- `StartSession` subscribes to attendance changes for its current session and refreshes present-student counts.
- `LiveAttendanceView` subscribes to attendance inserts for its current session, although the component is currently unused by routing.

### External and native integrations

- `react-native-ble-advertiser`: teacher-side BLE advertising.
- `react-native-ble-plx`: student-side BLE scanning through the shared manager in [`src/lib/ble.ts`](src/lib/ble.ts).
- `react-native-geolocation-service`: teacher and student GPS acquisition.
- `react-native-device-info`: primary/current device identifier capture.
- DiceBear HTTP URLs: generated initials avatars used by several screens.
- `react-native-svg`: circular session timer and progress visuals.

## Key Mechanisms

### Session creation and cohort routing

`AddNewClass` loads subjects assigned to the teacher and optionally pre-fills fields from a selected subject. It reads fixed room coordinates from `classrooms` and inserts an inactive `sessions` row. Theory sessions target `ALL`; practical sessions require batch selection. `StudentDashboard` filters active sessions using the same academic and batch metadata.

### Teacher session lifecycle

`StartSession` transitions a session from created/inactive to active, persists the selected security settings, starts optional BLE advertising, and controls session closure. The teacher can pause or resume the rolling-code timer. Timer state is persisted using `timer_state`, `expires_at`, and `frozen_seconds`, allowing the screen to reconstruct the countdown after navigation.

### Session-specific BLE handshake

The teacher advertises the Adsum UUID and encodes the numeric session ID into 16-bit BLE major/minor values. `MarkAttendance` repeatedly performs short scans, decodes manufacturer data, and searches for the expected byte signature containing the current session's encoded values. This prevents a student from accepting an unrelated nearby Adsum session.

Bluetooth permissions are requested in [`src/lib/ble.ts`](src/lib/ble.ts). The active scan/advertising work is controlled by screen effects and cleanup handlers.

### GPS verification

`src/lib/location.ts` calculates distance using the Haversine formula. When enabled, the student must be within 50 meters of the coordinates stored on the session. Teachers can use fixed classroom coordinates or update the session with the teacher's current location for live-location mode.

### Attendance code verification

`StartSession` generates a random four-digit code and persists its expiration state. `MarkAttendance` validates the entered code against the current session code before inserting attendance. Session updates are subscribed to so the student can receive code rotations while remaining on the screen.

### Device identity and proxy review

Student signup stores a primary device identifier. Attendance inserts also store the current device identifier. `ManualOverride` compares the attendance device to the profile's primary device and displays a proxy warning for mismatches unless the record was manually entered. In the current client flow this is review-oriented detection, not a database-enforced rejection.
below is what is stored in primary device id
Android: It retrieves the ANDROID_ID, a unique 64-bit alphanumeric string generated when the user first sets up the device.
iOS: It retrieves the identifierForVendor (IDFV), a unique UUID assigned to the device.
### Manual attendance correction

`ManualOverride` fetches the session's target cohort, merges it with attendance records, and presents the complete class register. Teachers can select absent students for a bulk manual insert or revoke an existing record. Manual records use `verification_method: 'manual'` and are excluded from proxy suspicion checks.

### Screen-lifetime asynchronous work

Timers, BLE scans/advertising, GPS requests, Supabase realtime channels, and Android hardware-back handlers are created by mounted screens and cleaned up on unmount. The codebase does not implement a separate background service architecture, so these mechanisms are not designed to continue reliably after the app process is suspended or terminated.

## Current Architectural Boundaries
//these are mostly intentional we will fix them later on 
- The application has a clear role-based screen split, but no centralized navigation stack or shared state store.
- Supabase provides both persistence and realtime coordination; the client performs most workflow orchestration.
- Security configuration is persisted per session, but teacher signup authorization is currently a client-side check.
- Device mismatch warnings support teacher review, but the current client does not block mismatched-device attendance at insertion time.
- Field naming is not completely uniform across screens and nested queries, especially around profile names and student identifiers; database relationships should remain the source of truth when extending the app.
- The repository contains a root render smoke test, but specialized coverage for Supabase workflows, realtime updates, BLE, GPS, timers, and device identity is limited.
