import React, {useState} from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Dimensions,
} from 'react-native';

export default function AttendanceGrid({
  heatmapData,
  attendancePercentage,
  totalAttended,
  totalLectures,
}: any) {
  const [isFlipped, setIsFlipped] = useState(false);

  const currentDate = new Date();
  const currentMonth = currentDate.getMonth();
  const currentYear = currentDate.getFullYear();
  const monthNames = [
    'January',
    'February',
    'March',
    'April',
    'May',
    'June',
    'July',
    'August',
    'September',
    'October',
    'November',
    'December',
  ];

  const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
  const firstDayOfMonth = new Date(currentYear, currentMonth, 1).getDay(); // Sunday = 0
  const dayLabels = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

  // Logic: (ScreenWidth - CardMargins - CardPadding - (7 * 2 * Margin)) / 7
  const screenWidth = Dimensions.get('window').width;
  const squareSize = (screenWidth - 32 - 40 - 56) / 7; // Fixed 4px margin logic

  return (
    <View style={styles.attendanceCard}>
      <TouchableOpacity
        activeOpacity={0.9}
        onPress={() => setIsFlipped(!isFlipped)}>
        {!isFlipped ? (
          <View>
            <View style={styles.cardHeaderRow}>
              <Text style={styles.cardTitle}>
                {monthNames[currentMonth]} Attendance
              </Text>
              <View style={styles.monthBadge}>
                <Text style={styles.monthBadgeText}>{daysInMonth} Days</Text>
              </View>
            </View>

            {/* Labels Row */}
            <View style={styles.dayLabelsRow}>
              {dayLabels.map((label, i) => (
                <Text
                  key={i}
                  style={[styles.dayLabelText, {width: squareSize}]}>
                  {label}
                </Text>
              ))}
            </View>

            {/* Calendar Grid */}
            <View style={styles.calendarGrid}>
              {/* Spacer squares for correct day alignment */}
              {Array.from({length: firstDayOfMonth}).map((_, i) => (
                <View
                  key={`spacer-${i}`}
                  style={{width: squareSize, height: squareSize, margin: 4}}
                />
              ))}

              {Array.from({length: daysInMonth}).map((_, index) => {
                const day = index + 1;
                const dateStr = new Date(currentYear, currentMonth, day)
                  .toISOString()
                  .split('T')[0];
                const hasAttendance = heatmapData?.some(
                  (d: any) => d.date === dateStr && d.count > 0,
                );

                return (
                  <View
                    key={day}
                    style={[
                      styles.calendarCell,
                      {width: squareSize, height: squareSize},
                      hasAttendance ? styles.attendedCell : styles.absentCell,
                    ]}>
                    <Text
                      style={[
                        styles.dayNumber,
                        hasAttendance && styles.dayNumberAttended,
                      ]}>
                      {day}
                    </Text>
                  </View>
                );
              })}
            </View>
          </View>
        ) : (
          <View style={styles.statsView}>
            <Text style={styles.cardTitle}>Performance Summary</Text>
            <View style={styles.statRow}>
              <View style={styles.statItem}>
                <Text style={styles.statValue}>{attendancePercentage}%</Text>
                <Text style={styles.statLabel}>Attendance</Text>
              </View>
              <View style={styles.statItem}>
                <Text style={styles.statValue}>
                  {totalAttended}/{totalLectures}
                </Text>
                <Text style={styles.statLabel}>Sessions</Text>
              </View>
            </View>
          </View>
        )}
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  attendanceCard: {
    backgroundColor: '#FFF',
    borderRadius: 20,
    padding: 20,
    marginHorizontal: 16,
    marginTop: -35,
    elevation: 8,
  },
  cardHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 15,
  },
  cardTitle: {fontSize: 16, fontWeight: 'bold', color: '#333'},
  monthBadge: {
    backgroundColor: '#E3F2FD',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  monthBadgeText: {color: '#2196F3', fontSize: 11, fontWeight: 'bold'},
  dayLabelsRow: {
    flexDirection: 'row',
    justifyContent: 'flex-start',
    marginBottom: 8,
  },
  dayLabelText: {
    textAlign: 'center',
    fontSize: 11,
    color: '#BBB',
    fontWeight: 'bold',
    marginHorizontal: 4,
  },
  calendarGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'flex-start',
  },
  calendarCell: {
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#F0F0F0',
    margin: 4,
  },
  absentCell: {backgroundColor: '#FAFAFA'},
  attendedCell: {backgroundColor: '#4CAF50', borderColor: '#4CAF50'},
  dayNumber: {fontSize: 10, color: '#999', fontWeight: 'bold'},
  dayNumberAttended: {color: '#FFF'},
  statsView: {height: 160, justifyContent: 'center', alignItems: 'center'},
  statRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    width: '100%',
  },
  statItem: {alignItems: 'center'},
  statValue: {fontSize: 32, fontWeight: 'bold', color: '#2196F3'},
  statLabel: {fontSize: 12, color: '#757575'},
});
