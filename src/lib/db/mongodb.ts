import mongoose from 'mongoose';

// Load environment variables
const MONGODB_URI = process.env.MONGODB_URI_V2;

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
  try {
    // If we already have a connection, return it
    if (cached.conn) {
      return cached.conn;
    }

    // If we're already connecting, wait for the connection
    if (cached.promise) {
      return await cached.promise;
    }

    // Set up connection event handlers only once
    if (!cached.conn) {
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
        if (mongoose.connection.readyState === 1) {
          await mongoose.connection.close();
        }
        process.exit(0);
      });
    }

    // Create new connection
    if (!MONGODB_URI) {
      throw new Error('MongoDB URI is not defined');
    }

    cached.promise = mongoose.connect(MONGODB_URI, options);
    cached.conn = await cached.promise;
    
    return cached.conn;
  } catch (error) {
    console.error('Error connecting to MongoDB:', error);
    cached.promise = null;
    throw error;
  }
}

export default connectToMongoDB; 