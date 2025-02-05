import mongoose from 'mongoose';

// Load environment variables
const MONGODB_URI = process.env.MONGODB_URI_V2;

// Debug environment variables
if (process.env.NODE_ENV !== 'production') {
  console.log('Environment:', {
    NODE_ENV: process.env.NODE_ENV,
    hasMongoURI: !!MONGODB_URI,
  });
}

if (!MONGODB_URI) {
  if (process.env.NODE_ENV === 'production') {
    throw new Error(
      'MongoDB URI is not defined. Please ensure MONGODB_URI_V2 is set in your environment variables.\n' +
      'Add it to your .env.local file like this:\n' +
      'MONGODB_URI_V2=mongodb+srv://your-connection-string'
    );
  } else {
    console.warn('Warning: MONGODB_URI_V2 is not defined in development environment');
  }
}

interface MongooseCache {
  conn: mongoose.Mongoose | null;
  promise: Promise<mongoose.Mongoose> | null;
}

declare global {
  var mongoose: MongooseCache | undefined;
}

const options: mongoose.ConnectOptions = {
  maxPoolSize: 10,
  minPoolSize: 5,
  socketTimeoutMS: 45000,
  connectTimeoutMS: 10000,
  serverSelectionTimeoutMS: 5000,
  heartbeatFrequencyMS: 10000,
  retryWrites: true,
  w: 'majority',
  wtimeoutMS: 2500,
};

let cached: MongooseCache = global.mongoose || { conn: null, promise: null };

if (!global.mongoose) {
  global.mongoose = cached;
}

async function connectToMongoDB(): Promise<mongoose.Mongoose> {
  if (cached.conn) {
    return cached.conn;
  }

  if (!cached.promise) {
    cached.promise = mongoose.connect(MONGODB_URI, options).then((mongoose) => {
      return mongoose;
    });
  }

  try {
    cached.conn = await cached.promise;
  } catch (e) {
    cached.promise = null;
    throw e;
  }

  return cached.conn;
}

export default connectToMongoDB;