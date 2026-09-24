# Adsum Architecture Context

Adsum is a React Native attendance application for students and faculty. Its central workflow is a teacher-created class session that students discover through exact academic-cohort filtering and complete through a configurable verification handshake: attendance code, Bluetooth proximity, GPS location, and optional biometric confirmation.

## Core Features

### Authentication and roles

- Email/password sign-in and account creation through Supabase Auth.
- Student and teacher account modes, selected during signup.
- Student academic details use controlled values: Computer Engineering, EXTC, AI & ML, IoT, or IT; FE, SE, TE, or BE; and semesters 1 through 8.
- Role lookup from `profiles.role` determines the application experience.
- Student signup records academic metadata, CPRN, batch, and a primary device identifier.
- Teacher signup currently uses a client-side admin-key check.

### Student capabilities

- View active classes matching course, year, semester, and batch.
- Distinguish scheduled sessions from live sessions and wait until the teacher starts the class before marking attendance.
- Mark attendance with a four-digit session code.
- Complete optional BLE and GPS verification when required by the teacher, with permission prompts, explicit failure states, distance feedback, and retry controls.
- Confirm identity with device biometrics when available; record missing biometric hardware for teacher review.
- View attendance history, aggregate totals, absences, and percentage.
- View subject-level progress and recent attendance trends using the full cohort-session denominator.
- View a calendar heatmap showing daily attendance density, missed classes, and holidays.
- View profile information and sign out.

### Teacher capabilities

- View recent sessions, historical session counts, assigned subjects, and profile information.
- View analytics including roster-based averages, trends, attendance distribution, at-risk students, subject summaries, and best/worst sessions.
- Create sessions for assigned subjects.
- Target all students for theory sessions or a specific batch for practical sessions.
- Configure a session as code-only, code plus Bluetooth, or Bluetooth plus GPS.
- Start and end live sessions.
- Broadcast a session-specific BLE signal from the teacher device.
- Generate and rotate attendance codes with pause/resume support.
- Monitor attendance counts in real time.
- Manually mark absent students present, revoke attendance, and inspect suspected device mismatches.
- Review missing-biometric attendance flags in the class register.
- View subject-level academic reports and per-session attendance counts.

## Component Architecture

### Root application state machine

[`App.tsx`](App.tsx) is the application shell. It does not use React Navigation. Instead, it maintains:

- `session`: the current Supabase Auth session.
- `userRole`: the role loaded from `profiles`.
- `currentScreen`: the active root-level screen key.
- `selectedData`: the selected class or subject passed to the next screen.
- `dashboardTab`: the teacher dashboard tab to restore after reports or analytics.

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
├── Progress             roster-based subject analytics and trends
├── MarkAttendance       code/BLE/GPS/biometric verification workflow
├── AttendanceHistory    attendance records and summary statistics
└── Profile              shared profile and sign-out screen
```

`StudentDashboard` owns the student home/progress/profile tab state. It loads the profile, holidays, matching sessions, attendance records, and aggregate statistics. It passes the selected session through `App.tsx` to `MarkAttendance`.

### Teacher flow

```text
TeacherDashboard
├── AddNewClass          assigned-subject and session creation
├── StartSession         live session control and security configuration
│   └── ManualOverride   roster review and manual attendance changes
├── TeacherAnalytics     roster-based teacher analytics
├── AcademicReports      subject reports and session history
└── Profile              shared profile and sign-out screen
```

`TeacherDashboard` owns dashboard, analytics, and profile tab state. It loads assigned subjects through `subject_assignments` and passes selected class or subject data through `App.tsx`. `StartSession` owns the active session lifecycle and opens `ManualOverride` as a modal. `AcademicReport` provides subject summaries and session-history details.

`LiveAttendanceView.tsx` contains an alternative realtime attendance list, but it is not imported or routed by `App.tsx`; the current teacher flow uses the count card in `StartSession` and the `ManualOverride` modal.

### State management model

- State is local to screens through React `useState`, `useEffect`, and `useCallback`.
- `App.tsx` provides the only cross-screen state bridge.
- Supabase is the shared source of truth for authentication, sessions, attendance, profiles, and reporting data.
- Screens generally refetch after mutations rather than using a centralized client cache.
- Realtime subscriptions refresh selected session or attendance data while the relevant screen is mounted.
- Teacher analytics and student progress derive roster-based denominators so students who never create an attendance row still count as absent.

## Data & Backend

### Supabase client

[`src/lib/supabase.ts`](src/lib/supabase.ts) creates one Supabase client using environment variables exposed through `react-native-dotenv`. Auth sessions persist in `AsyncStorage`. An AppState listener starts Supabase token refresh while the app is active and stops it when the app is backgrounded.

### Auth and database tables

- `auth.users`: managed by Supabase Auth for credentials and signup metadata.
- `profiles`: application identity, role, name/email, student course/year/semester/batch, employee ID, CPRN, and primary device ID.
- `subjects`: subject definitions and target academic cohort metadata.
- `subject_assignments`: teacher-to-subject bridge used to restrict faculty to assigned subjects.
- `sessions`: class instances, teacher and subject references, target cohort, room, GPS coordinates, BLE/security flags, active code, timer state, lifecycle timestamps, and closure state.
- `attendance`: student/session records with status, timestamp, device ID, verification method, and BLE/location verification flags. The application expects uniqueness for one student per session.
- `classrooms`: static room coordinates used when a session uses fixed-location mode.
- `holidays`: dates used by the student attendance calendar.

`attendance.student_id` is the internal profile/Auth UUID relationship. `profiles.cprn` is the human-readable student identifier shown in teacher-facing views.

### Database queries and RPCs

The screens use Supabase table queries with nested relationship selects for subjects, profiles, and attendance. Server-side functions provide aggregate calculations:

- `get_student_stats`: overall attended and possible session counts.
- `get_subject_wise_stats`: legacy subject progress RPC retained in the project.
- `get_teacher_subject_reports`: teacher subject summaries, including expected enrollment and presence totals.

Current `Progress` additionally calculates subject totals and absent sessions client-side from all matching cohort sessions. `TeacherAnalytics` performs client-side roster, trend, risk, distribution, and subject aggregation.

### Realtime channels

- `MarkAttendance` subscribes to `UPDATE` events for its current `sessions` row so a changed attendance code can reach the student screen.
- `StartSession` subscribes to attendance changes for its current session and refreshes present-student counts.
- `Progress` subscribes to changes for the current student's attendance rows and refreshes analytics.
- `LiveAttendanceView` subscribes to attendance inserts for its current session, although the component is currently unused by routing.

### External and native integrations

- `react-native-ble-advertiser`: teacher-side BLE advertising.
- `react-native-ble-plx`: student-side BLE scanning through the shared manager in [`src/lib/ble.ts`](src/lib/ble.ts).
- `react-native-geolocation-service`: teacher and student GPS acquisition.
- `react-native-device-info`: primary/current device identifier capture.
- `@react-native-picker/picker`: controlled student branch, year, and semester selection.
- `react-native-biometrics`: optional biometric confirmation before attendance submission.
- DiceBear HTTP URLs: generated initials avatars used by several screens.
- `react-native-svg`: circular session timer and analytics/progress visuals.

## Key Mechanisms

### Session creation and cohort routing

`AddNewClass` loads subjects assigned to the teacher and optionally pre-fills fields from a selected subject. It reads fixed room coordinates from `classrooms` and inserts an inactive `sessions` row. Theory sessions target `ALL`; practical sessions require batch selection. Student and teacher dashboards filter sessions using the same academic and batch metadata.

### Session state model

Sessions begin inactive and scheduled. Teachers explicitly choose code-only, code plus Bluetooth, or full signal plus GPS security before activation. The dashboards distinguish scheduled, live, code-only, and completed sessions. Students cannot open attendance for a scheduled session.

### Teacher session lifecycle

`StartSession` transitions a session from created/inactive to active, persists the selected security settings, starts optional BLE advertising, and controls session closure. The teacher can pause or resume the rolling-code timer. Timer state is persisted using `timer_state`, `expires_at`, and `frozen_seconds`, allowing the screen to reconstruct the countdown after navigation.

### Session-specific BLE handshake

The teacher advertises the Adsum UUID and encodes the numeric session ID into 16-bit BLE major/minor values. `MarkAttendance` repeatedly performs short scans, decodes manufacturer data, and searches for the expected byte signature containing the current session's encoded values.

A BLE attempt has explicit `checking`, `verified`, and `failed` states. The scan burst stops after a few seconds, the overall attempt expires after a fixed timeout, intervals and timeout handles are cleared on success/failure/unmount, and `Retry Verification` starts a fresh attempt. Bluetooth permissions and Bluetooth-off recovery are handled through [`src/lib/ble.ts`](src/lib/ble.ts) and Android/iOS platform APIs.

### GPS verification

`src/lib/location.ts` calculates distance using the Haversine formula. When enabled, the student must be within 50 meters of the coordinates fetched from the session. GPS has explicit `checking`, `verified`, `too_far`, and `failed` states. Android location permission is requested before the position request, and errors distinguish unavailable GPS services and denied permissions. Retry runs the permission and location checks again.

Teachers can use fixed classroom coordinates or update the session with the teacher's current location for live-location mode. The teacher's Live Signal switch acts as the parent control for geofence mode.

### Attendance code verification

`StartSession` generates a random four-digit code and persists its expiration state. `MarkAttendance` validates the entered code against the live session code and receives rotations through a Supabase session-update subscription.

### Biometric confirmation and review

`MarkAttendance` checks whether a device biometric sensor is available. Hardware-protected sessions request biometric confirmation when possible. If a sensor is unavailable, attendance can continue after a notice and is recorded with `missing_sensor`. Code-only sessions record `code_only` when a sensor is available or `co_&_missing_sensor` when it is not. `ManualOverride` surfaces missing-sensor attendance as a `No Sensor` flag.

### Device identity and proxy review

Student signup stores a primary device identifier. Attendance inserts also store the current device identifier. `ManualOverride` compares the attendance device to the profile's primary device and displays a proxy warning for mismatches unless the record was manually entered. This remains review-oriented detection, not a database-enforced rejection.

### Manual attendance correction

`ManualOverride` fetches the session's target cohort, merges it with attendance records, and presents the complete class register sorted by CPRN. Teachers can select absent students for a bulk manual insert or revoke an existing record. Manual records use `verification_method: 'manual'` and are excluded from proxy suspicion checks.

### Analytics denominator design

Student progress and teacher analytics use all sessions matching the relevant course, year, semester, and batch, not only sessions that contain attendance rows. This prevents missed sessions from disappearing from percentages. Teacher analytics additionally builds per-session rosters and derives at-risk students, subject summaries, attendance distributions, trend windows, and best/worst sessions.

### Screen-lifetime asynchronous work

Timers, BLE scans/advertising, GPS requests, biometric prompts, Supabase realtime channels, and Android hardware-back handlers are created by mounted screens and cleaned up on unmount. The codebase does not implement a separate background service architecture, so these mechanisms are not designed to continue reliably after the app process is suspended or terminated.

## Current Architectural Boundaries

The following boundaries are currently intentional and can be addressed later:

- The application has a clear role-based screen split, but no centralized navigation stack or shared state store.
- Supabase provides both persistence and realtime coordination; the client performs most workflow orchestration.
- Security configuration is persisted per session, but teacher signup authorization is currently a client-side check.
- Device mismatch warnings support teacher review, but the current client does not block mismatched-device attendance at insertion time.
- Current working screens use `profiles.name`, `profiles.cprn`, and `attendance.student_id` as the practical naming convention, but some legacy/unused components still contain older field assumptions.
- `LiveAttendanceView` is currently unused and duplicates part of the `StartSession`/`ManualOverride` workflow.
- The repository contains a root render smoke test, but specialized coverage for Supabase workflows, realtime updates, BLE, GPS, timers, biometrics, and device identity is limited.


# to be built now
Adsum Offline Hardware Architecture: ESP32 Integration
Core Concept & Architecture
The offline architecture shifts the initial attendance verification from the cloud to a localized, offline hardware node (the ESP32) physically present in the classroom. This ensures attendance can be securely logged even if students have poor cellular reception, while preventing proxy attendance from outside the room.

The ESP32 utilizes the NimBLE Bluetooth stack to perform Concurrent Multi-Role BLE operations, acting as both the broadcaster and the scanner simultaneously.

The Beacon (Broadcaster): The ESP32 continuously broadcasts a rolling cryptographic nonce (Machine Code) every 3 seconds.

The Handshake: A student's React Native app scans for this nonce. Once found, the app signs the nonce with the student's ID and broadcasts the payload aggressively at 10Hz.

The Harvester (Scanner): The ESP32 listens for these 10Hz payloads, validates the cryptographically signed packet, and logs the student ID to its internal flash memory.

The Acknowledgment: The ESP32 temporarily echoes a 2-byte receipt of the student's ID in its broadcast. The student's app detects this receipt, instantly kills its 10Hz advertiser, and displays the success screen.

Physical Feedback: A wired RGB LED on the ESP32 flashes green for 200ms for every successful handshake, providing immediate visual confirmation on the teacher's desk.

ESP32 Firmware & Build Requirements
To execute this, the ESP32 (WROOM-32 or S3) firmware must be developed in C++ using the Arduino IDE or PlatformIO. The firmware requires four distinct modules:

Concurrent BLE Tasks: Two independent RTOS tasks running simultaneously—one managing the 3-second rolling code advertisement, and the other constantly listening for incoming student payloads.

Flash Storage Manager: A module utilizing SPIFFS or LittleFS to write verified student IDs to the 4MB non-volatile flash memory in a JSON array. This ensures data survives power cycles or accidental unplugs during a lecture.

Cryptographic Validator: A lightweight hashing function to verify that the incoming payload matches the current 3-second nonce, preventing replay attacks.

Supabase Sync Bridge: An admin-triggered protocol (via a hidden Wi-Fi AP or a secure BLE handshake with the Teacher's device) that dumps the offline JSON payload to the teacher's phone, which then bulk-inserts the records into your existing Supabase attendance table.

Limitations & Security Constraints for Adsum Context
When integrating this into the broader Adsum platform, the following edge cases and limitations must be documented and mitigated:

BLE Packet Collisions: In a packed lecture hall of 75+ students under the Mumbai University NEP 2020 batch sizes, 50 phones simultaneously spamming payloads at 10Hz will cause heavy 2.4GHz spectrum noise. The ESP32 scanner needs an efficient queue and buffer system to process simultaneous hits without dropping packets.

The "Single Point of Failure" Sync: Until the teacher bridges the ESP32 to the internet to upload the records to Supabase, the attendance exists only on a ₹400 microchip. If the flash memory corrupts before the sync, the session data is permanently lost.

Relay Attacks: If a student inside the classroom texts the rolling nonce to a friend outside, the friend could theoretically sign it and broadcast it from down the hall. The 3-second Time-To-Live (TTL) on the nonce heavily limits this, but physical geofencing logic in the app should remain active as a secondary check.

Storage Management: The ESP32 memory must be explicitly cleared after a successful Supabase sync to prevent overflow during subsequent lectures.

Cross-Platform Advertising Quirks: iOS heavily restricts background BLE advertising compared to Android. The student's Adsum app will likely need to be in the foreground with the screen unlocked for the 10Hz payload transmission to work reliably on iPhones.