/**
 * Geofence utilities — haversine distance calculation and office boundary check.
 *
 * The haversine formula gives the great-circle distance between two points on
 * Earth's surface given their lat/lng coordinates in decimal degrees.
 */

const EARTH_RADIUS_METERS = 6_371_000;

function toRadians(degrees: number): number {
  return (degrees * Math.PI) / 180;
}

/**
 * Returns the distance in metres between two lat/lng coordinates.
 */
export function haversineDistance(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number,
): number {
  const dLat = toRadians(lat2 - lat1);
  const dLng = toRadians(lng2 - lng1);

  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRadians(lat1)) *
      Math.cos(toRadians(lat2)) *
      Math.sin(dLng / 2) ** 2;

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return EARTH_RADIUS_METERS * c;
}

export interface GeofenceResult {
  distanceMeters: number;
  withinGeofence: boolean;
}

/**
 * Checks whether the given coordinates are within the office geofence.
 *
 * @param lat - submitted latitude
 * @param lng - submitted longitude
 * @param officeLat - office latitude (from env)
 * @param officeLng - office longitude (from env)
 * @param radiusMeters - geofence radius in metres (from env)
 */
export function checkGeofence(
  lat: number,
  lng: number,
  officeLat: number,
  officeLng: number,
  radiusMeters: number,
): GeofenceResult {
  const distanceMeters = haversineDistance(lat, lng, officeLat, officeLng);
  return {
    distanceMeters: Math.round(distanceMeters),
    withinGeofence: distanceMeters <= radiusMeters,
  };
}
