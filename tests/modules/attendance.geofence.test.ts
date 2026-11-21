import { getGeofence, POOR_ACCURACY_THRESHOLD_METERS } from '../../src/modules/attendance/attendance.service';

describe('getGeofence', () => {
  it('returns the same office zone that check-ins are judged against', () => {
    // Values come from tests/setup.ts; the radius uses the env default.
    expect(getGeofence()).toEqual({
      latitude: 6.4281,
      longitude: 3.4219,
      radiusMeters: 500,
      poorAccuracyThresholdMeters: POOR_ACCURACY_THRESHOLD_METERS,
    });
  });
});
