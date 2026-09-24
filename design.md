# Adsum Product and Interaction Design

## 1. Product Direction

Adsum is a teacher-led, student-facing attendance system designed around fast classroom workflows and layered proof of presence. The product should feel operational and trustworthy: teachers need immediate session control and exceptions review; students need a short, unambiguous path from an active class to verified attendance.

The current visual language is based on:

- Blue as the primary action and navigation color.
- Green for verified, live, or healthy states.
- Orange for pending, scheduled, or attention-required states.
- Red for failed checks, missed attendance, or destructive actions.
- Neutral gray for disabled, bypassed, or unavailable states.
- Cards, bottom navigation, compact status badges, and modal detail views for repeated operational information.

## Visual Design System

### Color tokens

The current interface uses semantic colors consistently across dashboards, forms, verification cards, reports, and attendance states:

| Token            | Value                 | Usage                                                                                               |
| ---------------- | --------------------- | --------------------------------------------------------------------------------------------------- |
| Primary blue     | `#2196F3`             | Main headers, primary buttons, links, active navigation, selected controls, and progress highlights |
| Success green    | `#4CAF50`             | Verified attendance, live sessions, successful checks, and healthy metrics                          |
| Warning orange   | `#FF9800`             | Scheduled sessions, pending checks, attention states, and missing biometric hardware                |
| Error red        | `#F44336`             | Failed BLE/GPS checks, missed attendance, destructive actions, and low attendance                   |
| Practical purple | `#9C27B0`             | Practical or batch-targeted session labels                                                          |
| Page background  | `#F5F5F5` / `#F5F7FA` | Screen backgrounds and low-emphasis surfaces                                                        |
| Surface white    | `#FFFFFF`             | Cards, forms, modals, navigation bars, and primary content surfaces                                 |
| Secondary text   | `#757575`             | Metadata, helper text, timestamps, and inactive navigation                                          |
| Disabled gray    | `#9E9E9E` / `#B0BEC5` | Disabled controls, bypassed checks, unavailable states, and disabled actions                        |

Status colors should communicate meaning, not decoration. A status must remain understandable through its label or icon as well as its color.

### Typography

- Use bold or semibold text for screen titles, student names, class names, metric values, and status labels.
- Use compact secondary text for room numbers, timestamps, subject codes, helper text, and verification explanations.
- Use uppercase labels sparingly for security sections, session states, and report metadata.
- Keep primary content dark gray or near-black and reserve saturated colors for actions and status communication.
- Long class names and subject names should use wrapping or bounded lines rather than forcing horizontal overflow.

### Buttons and controls

#### Primary buttons

Primary actions use a blue filled button with white bold text, generous vertical padding, a rounded corner radius, and a subtle elevation. Examples include `Mark Attendance`, `Go Live Now`, `Submit Attendance`, and `Create Account`.

#### Secondary and outline buttons

Secondary actions use a white or transparent surface with a blue border and blue text. Examples include `Retry Verification` and secondary session actions. They should not compete visually with the primary action.

#### Destructive buttons

Ending a class, revoking attendance, and signing out use red text or a light red surface. Destructive actions require confirmation when they change attendance or session state.

#### Icon buttons

Back, search, filter, close, refresh, visibility, and navigation actions use recognizable icons from `lucide-react-native`. Icon buttons should have a sufficient touch area and should not rely on color alone.

#### Selection controls

- Student academic fields use native `Picker` controls for branch, year, and semester so stored values remain canonical.
- Batch selection uses compact segmented buttons for `A`, `B`, and `C`.
- Teacher security settings use an explicit selection prompt for Code Only, Code + Bluetooth, and Full Signal + GPS.
- Binary settings such as Live Signal and Geofence Mode use switches, with Geofence Mode visually subordinate to the Live Signal parent control.

### Cards and surfaces

- Cards use a white surface on a light gray page background.
- Repeated content uses rounded corners, moderate padding, and light elevation.
- Cards group one coherent concept: a class, metric, verification check, profile details, subject report, or roster entry.
- Avoid placing unrelated cards inside one another.
- Use a clear header/content/action hierarchy inside each card.
- Status badges sit near the item they describe and use short labels such as `LIVE`, `SCHEDULED`, `Verified`, `Manual`, or `Failed`.

### Screen-specific UI patterns

#### Authentication

The auth screen uses a centered form with rounded light-gray input containers, leading icons for email/password, a password visibility toggle, a prominent blue submit button, and a text link for switching between login and signup. Signup adds academic pickers, CPRN, batch selection, and faculty-only authorization fields.

#### Student dashboard

The student home uses a blue rounded header with identity information, followed by the attendance heatmap and today's schedule. Active class cards show class name, theory/practical classification, date/time, room, status, and a full-width attendance action. Scheduled classes use a disabled gray action labeled `Waiting for Teacher...`.

#### Teacher dashboard

The teacher dashboard uses a blue identity header, compact metric cards, recent-session cards, assigned-subject cards, and a bottom navigation bar. Session cards show status badges, date/time, room, target type, and a context-sensitive `Manage Session` or `View Report` action.

#### Live session control

`StartSession` emphasizes the attendance code with a large circular timer. Security controls appear as compact cards above the timer. The present count and progress percentage form a tappable summary surface that opens manual roster review. The end-session action is visually separated and destructive.

#### Student verification

`MarkAttendance` presents the four-digit code as four visual OTP cells. BLE and GPS appear as separate verification cards with an icon, title, explanatory status, and right-side indicator. Checking, verified, too-far, failed, and bypassed states use distinct text, icon, and surface treatments. Retry is shown only after a bounded verification failure.

#### Manual roster review

`ManualOverride` uses a searchable class-register list. Each row shows an avatar, student name, CPRN, and vertically stacked status badges. Verified, manual, proxy-suspected, missing-sensor, and selectable-unmarked states must remain visually distinct without obscuring the student's identity.

#### Analytics and reports

Analytics uses metric cards, compact trend controls, progress bars, distribution buckets, and risk lists. Reports use subject cards with percentage badges and progress bars. Zero-session subjects use a subdued `N/A` state rather than displaying a misleading 100% value. Session history opens in a slide-up modal.

### Navigation

- Student bottom navigation contains Home, Progress, and Profile.
- Teacher navigation contains Dashboard, Analytics, Reports, and Profile.
- The active item uses primary blue; inactive items use secondary gray.
- Navigation bars use a white surface, top separation, and enough bottom spacing for touch comfort.
- Hardware back behavior should dismiss an open modal before navigating away from the parent screen.

### Responsive and accessibility rules

- Keep touch targets comfortably large, especially icon buttons, picker controls, switches, and batch selectors.
- Prevent status badges, long names, and verification messages from overlapping action controls.
- Keep layouts usable on narrow screens by allowing text to wrap and controls to flow onto multiple rows.
- Pair status colors with text or icons so verification and attendance state remain understandable to users with reduced color perception.
- Preserve stable dimensions for OTP cells, metric cards, progress bars, and timer controls to avoid layout shifts during state changes.

## 2. Roles and Primary Journeys

### Student journey

```text
Sign in
  -> Student Dashboard
  -> Active class matching academic cohort
  -> Mark Attendance
  -> Enter four-digit code
  -> Check BLE and GPS when required
  -> Optional biometric confirmation
  -> Attendance success or duplicate-attendance state
```

Secondary student journeys:

- Home: calendar heatmap and today's active schedule.
- Progress: subject totals, absent-session denominator, and time-window trends.
- Profile: CPRN, course, academic year, email, and sign out.
- Attendance History: session records, totals, present/absent filter, and percentage.

### Teacher journey

```text
Sign in
  -> Teacher Dashboard
  -> Assigned subject or new class
  -> Create scheduled session
  -> Start session
  -> Choose security mode
  -> Broadcast code/BLE/GPS policy
  -> Monitor attendance
  -> Review exceptions or manually correct roster
  -> End class
```

Secondary teacher journeys:

- Dashboard: recent sessions and assigned subjects.
- Analytics: roster-based trends, distribution, at-risk students, and subject performance.
- Reports: subject summaries and session-history modal.
- Profile: faculty identity, sessions, reports shortcut, and sign out.

## 3. Navigation and Information Architecture

The application uses a lightweight root state machine rather than a navigation library.

```text
App
├── Auth
├── StudentDashboard
│   ├── Home
│   ├── Progress
│   └── Profile
├── MarkAttendance
├── AttendanceHistory
├── TeacherDashboard
│   ├── Dashboard
│   ├── Analytics
│   └── Profile
├── AddNewClass
├── StartSession
│   └── ManualOverride modal
├── AcademicReports
└── Profile
```

`currentScreen` and `selectedData` are the cross-screen navigation contract. Dashboard tabs remain local to the dashboard components. Hardware back handlers are implemented per screen or modal and should always dismiss the most local transient view first.

## 4. Authentication and Signup Design

### Login

The login surface should remain minimal: email, password, password visibility control, and a single primary Sign In action.

### Student signup

Student signup uses controlled values to protect exact cohort matching:

- Branch picker: `Computer Engineering`, `EXTC`, `AI & ML`, `IoT`, `IT`.
- Year picker: `FE`, `SE`, `TE`, `BE`.
- Semester picker: `1` through `8`.
- CPRN text input.
- Batch segmented selection: `A`, `B`, or `C`.

These values are stored in the profile and compared against session targeting. The UI should not reintroduce free-text entry for these fields without a normalization layer.

### Teacher signup

Teacher signup collects full name, teacher ID, and the current faculty authorization key. The existing client-side admin key is an intentional current limitation, but production authorization should move to a trusted backend boundary.

## 5. Session State Design

Sessions have a clear lifecycle:

| State            | Meaning                                | Student action                 | Teacher action            |
| ---------------- | -------------------------------------- | ------------------------------ | ------------------------- |
| Scheduled        | Session created but not started        | Wait                           | Start and choose security |
| Live             | Session active with BLE/GPS security   | Verify and mark attendance     | Monitor and manage        |
| Live (Code Only) | Session active without hardware checks | Enter code and mark attendance | Monitor and manage        |
| Completed        | Session closed                         | View history/progress          | View reports              |

The teacher's security setup offers:

- Code Only
- Code + Bluetooth
- Full Signal + GPS

The Live Signal switch is the parent control for geofence mode. Geofence mode must not appear independently active while the parent signal is disabled.

## 6. Attendance Verification Experience

### Verification sequence

1. The student sees the class and room.
2. The student enters a four-digit code.
3. The app checks the current session code, including realtime rotations.
4. If required, BLE scans for the session-specific beacon payload.
5. If required, GPS checks the distance to the session coordinates.
6. If available, biometric confirmation is requested.
7. Attendance is inserted with verification metadata.

### BLE states

- `checking`: show a spinner and `Searching for teacher beacon...`.
- `verified`: show a green check and `Signal Verified`.
- `failed`: stop scan intervals and timers, show `Beacon not found. Move closer and retry.`, and show `Retry Verification`.

Retry must clear existing BLE intervals and timeout handles before starting a new attempt. A failed state must never continue scanning in the background.

### GPS states

- `checking`: show a blue location state and `Checking your location...`.
- `verified`: show the measured distance and `Verified`.
- `too_far`: show the measured distance and the required radius, for example `180m away. Move within 50m`.
- `failed`: distinguish permission/service failures through alerts and show a retry action.

The GPS check is a one-time position request for an attendance attempt, not continuous background tracking.

### Biometric states

- Sensor available and successful: record biometric verification.
- Sensor unavailable: allow the configured attendance flow to continue, but record a missing-sensor method and expose a teacher-facing warning.
- Prompt cancelled or failed: stop submission and explain that identity confirmation is required.

## 7. Teacher Monitoring and Exceptions

`StartSession` prioritizes high-signal controls:

- Session code and timer.
- Security mode and geofence controls.
- Present count and percentage.
- Session end action.

`ManualOverride` is the exception-management surface. It should make the following visually distinct:

- Verified attendance.
- Manual attendance.
- Suspected device mismatch.
- Missing biometric sensor.
- Unmarked students available for selection.

The roster is sorted by CPRN and supports name search. Destructive attendance revocation requires confirmation.

## 8. Analytics and Reporting Design

### Student analytics

Student progress uses all matching cohort sessions as the denominator, including sessions where no attendance row exists. This makes missed sessions visible instead of silently excluding them. The progress view supports 7-day, 30-day, and semester trend windows.

### Teacher analytics

Teacher analytics is roster-based and includes:

- Total students in the teacher's session cohorts.
- Average attendance.
- Period-over-period change.
- Today's absentees.
- Conducted sessions versus created sessions.
- Attendance distribution buckets: 90-100%, 75-89%, 60-74%, and below 60%.
- At-risk student list.
- Subject-level attendance.
- Best and worst sessions.
- Trend windows for 7 days, 30 days, and semester.

### Academic reports

Academic reports provide subject cards with attendance percentage, zero-session `N/A` state, and a slide-up session-history modal. Session history shows date/time, theory or batch targeting, and present counts.

## 9. Data and Naming Contract

The user-facing data contract should remain explicit:

```text
profiles.id             internal Auth/profile UUID
profiles.name           display name
profiles.cprn           human-readable student identifier
profiles.course         canonical branch value
profiles.year           FE, SE, TE, or BE
profiles.semester       semester value 1 through 8
profiles.batch          A, B, or C
attendance.student_id   foreign-key-style profile UUID
attendance.session_id   session UUID/ID
```

CPRN is for display and sorting. It must not replace `attendance.student_id` as the relationship key.

## 10. Native and Backend Design

- Supabase Auth manages identity and persisted sessions.
- Supabase PostgreSQL stores profiles, subjects, assignments, sessions, attendance, classrooms, and holidays.
- Supabase Realtime synchronizes session codes, attendance counts, and student progress refreshes.
- BLE advertising runs on the teacher device; BLE scanning runs on the student device.
- GPS uses fixed classroom coordinates by default and teacher live location when enabled.
- AsyncStorage persists Supabase auth state.
- AppState controls Supabase token refresh.
- Device information supports primary-device capture and proxy review.

No background service architecture currently exists. BLE, GPS, timers, biometric prompts, realtime channels, and hardware-back handlers are screen-lifetime behaviors.

## 11. Design Principles for Future Changes

- Preserve exact academic option values because session visibility depends on string equality.
- Keep scheduled and live session states visually and behaviorally distinct.
- Every asynchronous verification mechanism needs a visible checking state, a bounded failure state, cleanup, and retry behavior.
- Never allow a failed verification state to keep scanning or polling silently.
- Show the reason for a blocked attendance action near the affected verification card.
- Keep teacher exception handling explicit and auditable rather than hiding suspicious or incomplete verification.
- Prefer database relationships and canonical field names over UI aliases.
- Keep denominator logic roster-based wherever absence must be represented.
- Treat client-side role authorization as temporary until replaced with server-side enforcement.
