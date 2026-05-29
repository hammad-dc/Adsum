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
  holidays,
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
  // Get screen width
  const screenWidth = Dimensions.get('window').width;

  // Calculate exact available space
  const cardMargins = 32; // marginHorizontal: 16 (16 * 2)
  const cardPadding = 40; // padding: 20 inside the card (20 * 2)
  const cellMargins = 8; // margin: 4 on each cell (4 * 2)

  // Divide by 7 days to get the perfect square size
  const squareSize =
    Math.floor((screenWidth - cardMargins - cardPadding) / 7) - cellMargins;

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
                  style={[
                    styles.dayLabelText,
                    {width: squareSize, marginHorizontal: 4},
                  ]}>
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
                const yearStr = currentYear;
                const monthStr = String(currentMonth + 1).padStart(2, '0');
                const dayStr = String(day).padStart(2, '0');
                const dateStr = `${yearStr}-${monthStr}-${dayStr}`;

                const date = new Date(currentYear, currentMonth, day);
                const isHoliday = holidays?.includes(dateStr);
                const isSunday = date.getDay() === 0;

                // 1. Find Data for this day
                const dayData = heatmapData?.find(
                  (d: any) => d.date === dateStr,
                );
                const attendedCount = dayData?.count || 0;
                const totalForDay = dayData?.total || 0; // Standard daily count

                const isMissedClass = totalForDay > 0 && attendedCount === 0;

                // 2. Color Scaling Logic
                const densityColors = [
                  '#FAFAFA', // 0 (Default empty)
                  '#BBDEFB', // 1 lecture
                  '#64B5F6', // 2 lectures
                  '#2196F3', // 3 lectures
                  '#1565C0', // 4+ lectures
                ];
                const colorIndex = Math.min(attendedCount, 4);

                // Determine final background color
                let cellBgColor = '#FAFAFA'; // Default no class
                if (isHoliday) {
                  cellBgColor = '#F1F1F1';
                } else if (isMissedClass) {
                  cellBgColor = '#FFEBEE'; // 🔴 LIGHT RED FOR MISSED CLASSES
                } else if (totalForDay > 0) {
                  cellBgColor = densityColors[colorIndex];
                }

                return (
                  <View
                    key={day}
                    style={[
                      styles.calendarCell,
                      {
                        width: squareSize,
                        height: squareSize,
                        backgroundColor: cellBgColor,
                        position: 'relative',
                        justifyContent: 'center',
                        alignItems: 'center',
                        paddingVertical: 2,
                      },
                    ]}>
                    {/* Day Number */}
                    <Text
                      style={[
                        styles.dayNumber,
                        colorIndex > 2 ? {color: '#FFF'} : {},
                        isHoliday ? styles.dayNumberHoliday : {},
                        isMissedClass
                          ? {color: '#D32F2F', fontWeight: 'bold'}
                          : {}, // Make date text dark red
                      ]}>
                      {day}
                    </Text>

                    {/* 4. Show fraction for ANY day that had a class, even if it's 0/1 */}
                    {totalForDay > 0 && (
                      <Text
                        style={[
                          styles.densityText,
                          colorIndex > 2 ? {color: '#FFF'} : {color: '#555'},
                          isMissedClass ? {color: '#D32F2F'} : {}, // Make fraction dark red
                        ]}>
                        {attendedCount}/{totalForDay}
                      </Text>
                    )}
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
    width: '100%',
  },
  dayNumber: {
    fontSize: 12,
    fontWeight: '600',
    color: '#757575',
  },
  densityText: {
    fontSize: 7, // Keep it very small
    fontWeight: 'bold',
    position: 'absolute',
    bottom: 2,
  },
  // Ensure your holiday style matches your new gray
  holidayCell: {
    backgroundColor: '#F1F1F1',
  },
  calendarCell: {
    // Keeps the cells perfectly square
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#F0F0F0',
    margin: 4,
  },
  absentCell: {backgroundColor: '#FAFAFA'},
  attendedCell: {backgroundColor: '#4CAF50', borderColor: '#4CAF50'},

  dayNumberAttended: {color: '#FFF'},

  dayNumberHoliday: {
    color: '#BDBDBD',
    fontSize: 10,
    fontWeight: '400',
  },
  statsView: {
    paddingVertical: 20, // Replaced hardcoded height: 160
    justifyContent: 'center',
    alignItems: 'center',
  },
  statRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    width: '100%',
  },
  statItem: {alignItems: 'center'},
  statValue: {fontSize: 32, fontWeight: 'bold', color: '#2196F3'},
  statLabel: {fontSize: 12, color: '#757575'},
});
