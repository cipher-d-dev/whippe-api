// Set minimum required environment variables so imports of env.ts don't crash
// during unit tests. Tests mock the database and services directly — these
// values are never used for real connections in unit tests.

process.env['NODE_ENV'] = 'test';
process.env['MONGODB_URI'] = 'mongodb://localhost:27017/whippe-test';
process.env['JWT_SECRET'] = 'test-secret-that-is-at-least-32-characters-long';
process.env['FRONTEND_URL'] = 'http://localhost:3000';
process.env['OFFICE_LAT'] = '6.4281';
process.env['OFFICE_LNG'] = '3.4219';
process.env['GOOGLE_CLIENT_ID'] = 'test-google-client-id';
process.env['GOOGLE_CLIENT_SECRET'] = 'test-google-client-secret';
process.env['GOOGLE_CALLBACK_URL'] = 'http://localhost:5000/api/v1/auth/google/callback';
