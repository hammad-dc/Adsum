import { BleManager } from 'react-native-ble-plx';
import { PermissionsAndroid, Platform } from 'react-native';

export const manager = new BleManager();

// 👇 THIS MUST MATCH THE TEACHER UUID EXACTLY
const TARGET_SERVICE_UUID = '0000AD50-0000-1000-8000-00805F9B34FB';

export const requestBluetoothPermissions = async () => {
  if (Platform.OS === 'ios') return true;

  // Android 12+ (API 31+)
  if (Platform.OS === 'android' && (Platform.Version as number) >= 31) {
    const result = await PermissionsAndroid.requestMultiple([
      PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN,
      PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT,
      PermissionsAndroid.PERMISSIONS.BLUETOOTH_ADVERTISE, // ✅ ADDED THIS: Required for Teacher mode
      PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
    ]);

    return (
      result['android.permission.BLUETOOTH_SCAN'] ===
        PermissionsAndroid.RESULTS.GRANTED &&
      result['android.permission.BLUETOOTH_CONNECT'] ===
        PermissionsAndroid.RESULTS.GRANTED &&
      result['android.permission.BLUETOOTH_ADVERTISE'] ===
        PermissionsAndroid.RESULTS.GRANTED // ✅ CHECK THIS TOO
    );
  }

  // Android < 12
  const granted = await PermissionsAndroid.request(
    PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
  );
  return granted === PermissionsAndroid.RESULTS.GRANTED;
};

export const scanForTeacher = (
  targetBeaconId: string | null,
  onFound: () => void,
  onFail: (error: string) => void,
) => {
  console.log('🔍 Scanning for Teacher Beacon:', TARGET_SERVICE_UUID);

  manager.startDeviceScan(null, { allowDuplicates: true }, (error, device) => {
    if (error) {
      console.log('Scan Error:', error);
      return;
    }

    if (device && device.serviceUUIDs) {
      if (
        device.serviceUUIDs.includes(TARGET_SERVICE_UUID.toLowerCase()) ||
        device.serviceUUIDs.includes(TARGET_SERVICE_UUID.toUpperCase())
      ) {
        console.log('✅ ADSUM BEACON FOUND!', device.id);
        manager.stopDeviceScan();
        onFound();
      }
    }
  });

  setTimeout(() => {
    console.log('Scan timeout.');
    manager.stopDeviceScan();
  }, 15000);
};
