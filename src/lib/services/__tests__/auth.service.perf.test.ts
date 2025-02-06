import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { AuthService } from '../auth.service';
import { runConcurrentTests, formatPerformanceResult } from '../../utils/performance.test';
import connectToMongoDB from '../../db/mongodb';
import mongoose, { Document } from 'mongoose';
import type { UserDocument } from '../../db/models-v2/user';
import { getUserModel } from '../../db/models-v2/user';
import { AuthServerService } from "@/lib/services/auth.server";

const TEST_TIMEOUT = 30000; // 30 seconds

describe('AuthService Performance Tests', () => {
  beforeAll(async () => {
    // Ensure we have a single connection throughout the tests
    await connectToMongoDB();
  }, TEST_TIMEOUT);

  afterAll(async () => {
    await mongoose.disconnect();
  });

  it('should handle concurrent getCurrentUser requests efficiently', async () => {
    const UserModel = await getUserModel();
    // Create a test user if not exists
    const testUser = await UserModel.findOne({}) as (UserDocument & Document) | null;
    const userId = testUser?.id || 'nonexistent-user';

    const result = await runConcurrentTests(
      'getCurrentUser',
      () => AuthServerService.getCurrentUser(userId),
      20, // Test with 20 concurrent requests
      50  // 50ms delay between requests
    );

    console.log(formatPerformanceResult(result));

    // Performance assertions
    expect(result.averageDuration).toBeLessThan(1000); // Should respond within 1000ms on average
    expect(result.successRate).toBeGreaterThan(0.9); // 90% success rate
  }, TEST_TIMEOUT);

  it('should handle concurrent getUserByUsername requests efficiently', async () => {
    const UserModel = await getUserModel();
    const testUser = await UserModel.findOne({}) as (UserDocument & Document) | null;
    const username = testUser?.username || 'nonexistent-user';

    const result = await runConcurrentTests(
      'getUserByUsername',
      () => AuthServerService.getUserByUsername(username),
      20,
      50
    );

    console.log(formatPerformanceResult(result));

    expect(result.averageDuration).toBeLessThan(1000);
    expect(result.successRate).toBeGreaterThan(0.9);
  }, TEST_TIMEOUT);

  it('should handle concurrent getUserByEmail requests efficiently', async () => {
    const UserModel = await getUserModel();
    const testUser = await UserModel.findOne({}) as (UserDocument & Document) | null;
    const email = testUser?.email || 'nonexistent@example.com';

    const result = await runConcurrentTests(
      'getUserByEmail',
      () => AuthServerService.getUserByEmail(email),
      20,
      50
    );

    console.log(formatPerformanceResult(result));

    expect(result.averageDuration).toBeLessThan(1000);
    expect(result.successRate).toBeGreaterThan(0.9);
  }, TEST_TIMEOUT);

  it('should handle concurrent batch user requests efficiently', async () => {
    const UserModel = await getUserModel();
    const testUsers = (await UserModel.find().limit(5)) as (UserDocument & Document)[];
    const userIds = testUsers.map(user => user.id);

    const result = await runConcurrentTests(
      'batchGetUsers',
      () => Promise.all(userIds.map((id: string) => AuthServerService.getCurrentUser(id))),
      10, // Lower concurrency due to multiple requests per operation
      100
    );

    console.log(formatPerformanceResult(result));

    expect(result.averageDuration).toBeLessThan(2000); // Allow more time for batch operations
    expect(result.successRate).toBeGreaterThan(0.9);
  }, TEST_TIMEOUT);
}); 