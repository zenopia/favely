require('dotenv').config({ path: '.env.local' });

// Set test environment variables if not already set
process.env.MONGODB_URI_V2 = process.env.MONGODB_URI_V2 || 'mongodb://localhost:27017/rankshare_test';
process.env.NODE_ENV = 'test';

// Increase timeout for all tests
jest.setTimeout(30000); 