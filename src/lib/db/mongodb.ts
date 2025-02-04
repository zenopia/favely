import mongoose from 'mongoose';

const MONGODB_URI = process.env.MONGODB_URI_V2;

if (!MONGODB_URI) {
  throw new Error('Please define the MONGODB_URI_V2 environment variable inside .env.local');
}

interface MongooseCache {
  conn: typeof mongoose | null;
  promise: Promise<typeof mongoose> | null;
}

declare global {
  var mongoose: MongooseCache | undefined;
}

const options: mongoose.ConnectOptions = {
  maxPoolSize: 10,        // Maximum number of connections in the pool
  minPoolSize: 5,         // Minimum number of connections in the pool
  socketTimeoutMS: 45000, // How long to wait for responses
  connectTimeoutMS: 10000,// How long to wait for initial connection
  serverSelectionTimeoutMS: 5000, // How long to wait for server selection
  heartbeatFrequencyMS: 10000,    // How often to check connection health
  retryWrites: true,              // Automatically retry failed writes
  w: 'majority',                  // Write concern
  wtimeoutMS: 2500,              // Write concern timeout
};

let cached: MongooseCache = global.mongoose || { conn: null, promise: null };

if (!global.mongoose) {
  global.mongoose = cached;
}

async function connectToMongoDB(): Promise<typeof mongoose> {
  if (cached.conn) {
    console.log('Using existing MongoDB connection');
    return cached.conn;
  }

  if (!cached.promise) {
    console.log('Creating new MongoDB connection');
    cached.promise = mongoose.connect(MONGODB_URI, options)
      .then((mongoose) => {
        return mongoose;
      })
      .catch((error) => {
        console.error('MongoDB connection error:', error);
        throw error;
      });
  }

  try {
    cached.conn = await cached.promise;
    console.log('Successfully connected to MongoDB');
    return cached.conn;
  } catch (error) {
    cached.promise = null;
    throw error;
  }
}

// Monitor connection events
mongoose.connection.on('connected', () => {
  console.log('MongoDB connection established');
});

mongoose.connection.on('error', (err) => {
  console.error('MongoDB connection error:', err);
});

mongoose.connection.on('disconnected', () => {
  console.log('MongoDB connection disconnected');
});

process.on('SIGINT', async () => {
  await mongoose.connection.close();
  process.exit(0);
});

export default connectToMongoDB; 