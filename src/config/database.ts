import mongoose from 'mongoose';
import { env } from './env';
import { IDatabaseConnectionOptions } from '../types';

let isConnected = false;

export const connectDatabase = async (
  options?: IDatabaseConnectionOptions
): Promise<typeof mongoose> => {
  const uri = options?.uri || env.MONGODB_URI;

  if (isConnected && mongoose.connection.readyState === 1) {
    console.log('[Database] MongoDB is already connected.');
    return mongoose;
  }

  try {
    mongoose.connection.on('connected', () => {
      isConnected = true;
      console.log('[Database] MongoDB connection established successfully.');
    });

    mongoose.connection.on('error', (err) => {
      isConnected = false;
      console.error('[Database] MongoDB connection error:', err);
    });

    mongoose.connection.on('disconnected', () => {
      isConnected = false;
      console.warn('[Database] MongoDB connection lost / disconnected.');
    });

    const conn = await mongoose.connect(uri, {
      serverSelectionTimeoutMS: 5000,
    });

    isConnected = true;
    console.log(`[Database] Connected to MongoDB host: ${conn.connection.host}`);
    return conn;
  } catch (error) {
    isConnected = false;
    console.error('[Database] Failed to connect to MongoDB:', error);
    throw error;
  }
};

export const disconnectDatabase = async (): Promise<void> => {
  if (!isConnected && mongoose.connection.readyState === 0) {
    return;
  }

  try {
    await mongoose.connection.close();
    isConnected = false;
    console.log('[Database] MongoDB connection closed gracefully.');
  } catch (error) {
    console.error('[Database] Error while closing MongoDB connection:', error);
  }
};

export const isDbConnected = (): boolean => {
  return mongoose.connection.readyState === 1;
};
