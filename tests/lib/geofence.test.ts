import { haversineDistance, checkGeofence } from '../../src/lib/geofence';

describe('haversineDistance', () => {
  it('returns 0 for identical coordinates', () => {
    expect(haversineDistance(6.4281, 3.4219, 6.4281, 3.4219)).toBe(0);
  });

  it('returns a positive distance for different coordinates', () => {
    const dist = haversineDistance(6.4281, 3.4219, 6.4291, 3.4219);
    expect(dist).toBeGreaterThan(0);
  });

  it('is symmetric — distance A→B equals B→A', () => {
    const d1 = haversineDistance(6.4281, 3.4219, 6.5000, 3.5000);
    const d2 = haversineDistance(6.5000, 3.5000, 6.4281, 3.4219);
    expect(Math.abs(d1 - d2)).toBeLessThan(0.001);
  });

  it('returns approximately 1111m for 0.01 degree latitude shift', () => {
    // ~111m per 0.001 degrees latitude
    const dist = haversineDistance(6.0, 3.0, 6.001, 3.0);
    expect(dist).toBeGreaterThan(100);
    expect(dist).toBeLessThan(120);
  });
});

describe('checkGeofence', () => {
  const officeLat = 6.4281;
  const officeLng = 3.4219;
  const radiusMeters = 100;

  it('returns withinGeofence=true when coordinates match the office exactly', () => {
    const result = checkGeofence(officeLat, officeLng, officeLat, officeLng, radiusMeters);
    expect(result.withinGeofence).toBe(true);
    expect(result.distanceMeters).toBe(0);
  });

  it('returns withinGeofence=true when coordinates are within the radius', () => {
    // ~50m north of office
    const result = checkGeofence(6.4285, officeLng, officeLat, officeLng, radiusMeters);
    expect(result.withinGeofence).toBe(true);
    expect(result.distanceMeters).toBeLessThanOrEqual(radiusMeters);
  });

  it('returns withinGeofence=false when coordinates are outside the radius', () => {
    // ~1km away
    const result = checkGeofence(6.4381, officeLng, officeLat, officeLng, radiusMeters);
    expect(result.withinGeofence).toBe(false);
    expect(result.distanceMeters).toBeGreaterThan(radiusMeters);
  });

  it('returns a rounded integer distanceMeters', () => {
    const result = checkGeofence(6.4291, 3.4229, officeLat, officeLng, radiusMeters);
    expect(Number.isInteger(result.distanceMeters)).toBe(true);
  });

  it('respects a custom radius', () => {
    // ~1km north of office — well within a 5km radius
    const largeRadius = 5_000;
    const result = checkGeofence(6.4381, officeLng, officeLat, officeLng, largeRadius);
    expect(result.withinGeofence).toBe(true);
  });
});
