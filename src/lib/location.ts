// src/lib/location.ts

// 1. Calculate distance in Meters
export function getDistanceFromLatLonInMeters(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number,
) {
  const R = 6371; // Radius of the earth in km
  const dLat = deg2rad(lat2 - lat1);
  const dLon = deg2rad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(deg2rad(lat1)) *
      Math.cos(deg2rad(lat2)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const d = R * c; // Distance in km
  return d * 1000; // Return meters
}

function deg2rad(deg: number) {
  return deg * (Math.PI / 180);
}

// 2. Define a "Target" Location (The Classroom)
// For testing, we will use the coordinates of "Googleplex" (Default Emulator Location)
// Teacher: 37.4226711, -122.0849872
export const CLASSROOM_LOCATION = {
  latitude: 19.1345,
  longitude: 72.843632,
  radius: 100, // meters allowed
};
