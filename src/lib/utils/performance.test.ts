import { performance } from 'perf_hooks';

export interface PerformanceResult {
  operationName: string;
  duration: number;
  success: boolean;
  error?: any;
}

export interface BatchPerformanceResult {
  operationName: string;
  averageDuration: number;
  minDuration: number;
  maxDuration: number;
  successRate: number;
  totalRequests: number;
  failedRequests: number;
  results: PerformanceResult[];
}

export async function measureOperation(
  operationName: string,
  operation: () => Promise<any>
): Promise<PerformanceResult> {
  const start = performance.now();
  try {
    await operation();
    const duration = performance.now() - start;
    return {
      operationName,
      duration,
      success: true,
    };
  } catch (error) {
    const duration = performance.now() - start;
    return {
      operationName,
      duration,
      success: false,
      error,
    };
  }
}

export async function runConcurrentTests(
  operationName: string,
  operation: () => Promise<any>,
  concurrency: number = 10,
  delayBetweenBatches: number = 100
): Promise<BatchPerformanceResult> {
  const results: PerformanceResult[] = [];
  
  // Run operations in batches
  for (let i = 0; i < concurrency; i++) {
    const result = await measureOperation(operationName, operation);
    results.push(result);
    
    if (i < concurrency - 1) {
      await new Promise(resolve => setTimeout(resolve, delayBetweenBatches));
    }
  }

  // Calculate statistics
  const durations = results.map(r => r.duration);
  const failedRequests = results.filter(r => !r.success).length;
  
  return {
    operationName,
    averageDuration: durations.reduce((a, b) => a + b, 0) / durations.length,
    minDuration: Math.min(...durations),
    maxDuration: Math.max(...durations),
    successRate: (results.length - failedRequests) / results.length,
    totalRequests: results.length,
    failedRequests,
    results,
  };
}

export function formatPerformanceResult(result: BatchPerformanceResult): string {
  return `
Performance Test Results for ${result.operationName}:
----------------------------------------
Average Duration: ${result.averageDuration.toFixed(2)}ms
Min Duration: ${result.minDuration.toFixed(2)}ms
Max Duration: ${result.maxDuration.toFixed(2)}ms
Success Rate: ${(result.successRate * 100).toFixed(1)}%
Total Requests: ${result.totalRequests}
Failed Requests: ${result.failedRequests}
----------------------------------------
`;
} 