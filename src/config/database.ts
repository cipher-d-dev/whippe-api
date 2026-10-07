import mongoose from 'mongoose';
import { env } from './env';

export async function connectDatabase(): Promise<void> {
  try {
    await mongoose.connect(env.MONGODB_URI, {
      // Let Mongoose manage its connection pool; no extra options needed for Mongoose 8+
    });
    console.log('✅  MongoDB connected');
  } catch (err) {
    console.error('❌  MongoDB connection failed:', err);
    process.exit(1);
  }
}

export async function disconnectDatabase(): Promise<void> {
  await mongoose.disconnect();
  console.log('MongoDB disconnected');
}

// Surface connection events for operational visibility
mongoose.connection.on('disconnected', () => {
  console.warn('⚠️   MongoDB disconnected');
});

mongoose.connection.on('reconnected', () => {
  console.log('✅  MongoDB reconnected');
});

mongoose.connection.on('error', (err) => {
  console.error('MongoDB error:', err);
});
