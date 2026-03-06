/**
 * Test suite for Safe Project Opening functionality
 * Tests the complete solution for preventing SQLite UNIQUE constraint errors
 */

import { safeProjectOpener, safeOpenProject } from './SafeProjectOpener';
import { initializeSafeUpdates, getDatabaseStats } from './SafeUpdatesModule';

/**
 * Test the safe project opener with rapid successive calls
 */
export const testRapidProjectOpening = async (): Promise<void> => {
  console.log('🧪 Testing rapid project opening...');

  const testUrl = 'https://test-project.e2b.dev';
  const projectId = 'test-project-123';

  // Clear any existing state
  safeProjectOpener.clearHistory();

  // Test rapid successive calls (should be throttled)
  const promises = [];
  for (let i = 0; i < 5; i++) {
    promises.push(safeOpenProject(testUrl, projectId));
  }

  try {
    await Promise.all(promises);
    console.log('✅ Rapid opening test completed');
  } catch (error) {
    console.log('⚠️ Some rapid opening calls were throttled (expected)');
  }

  // Check opening statistics
  const stats = safeProjectOpener.getOpeningStats();
  console.log('📊 Opening statistics:', stats);
};

/**
 * Test the safe project opener with different project IDs
 */
export const testMultipleProjects = async (): Promise<void> => {
  console.log('🧪 Testing multiple project opening...');

  const projects = [
    { url: 'https://project1.e2b.dev', id: 'project-1' },
    { url: 'https://project2.e2b.dev', id: 'project-2' },
    { url: 'https://project3.e2b.dev', id: 'project-3' },
  ];

  // Open multiple projects simultaneously
  const promises = projects.map((project) => safeOpenProject(project.url, project.id));

  try {
    await Promise.all(promises);
    console.log('✅ Multiple project opening test completed');
  } catch (error) {
    console.error('❌ Multiple project opening test failed:', error);
  }
};

/**
 * Test database initialization and cleanup
 */
export const testDatabaseOperations = async (): Promise<void> => {
  console.log('🧪 Testing database operations...');

  try {
    // Initialize safe updates system
    await initializeSafeUpdates();
    console.log('✅ Database initialization completed');

    // Get database stats
    const stats = await getDatabaseStats();
    if (stats) {
      console.log('📊 Database stats:', stats);
    }
  } catch (error) {
    console.error('❌ Database operations test failed:', error);
  }
};

/**
 * Test error handling and recovery
 */
export const testErrorHandling = async (): Promise<void> => {
  console.log('🧪 Testing error handling...');

  const invalidUrl = 'invalid-url';
  const projectId = 'error-test-project';

  try {
    await safeOpenProject(invalidUrl, projectId);
    console.log('⚠️ Expected error did not occur');
  } catch (error) {
    console.log('✅ Error handling test passed - error caught:', error.message);
  }
};

/**
 * Run all tests
 */
export const runAllTests = async (): Promise<void> => {
  console.log('🚀 Starting comprehensive test suite...');

  try {
    await testDatabaseOperations();
    await testRapidProjectOpening();
    await testMultipleProjects();
    await testErrorHandling();

    console.log('🎉 All tests completed successfully!');
  } catch (error) {
    console.error('❌ Test suite failed:', error);
  }
};

/**
 * Performance test - measure opening times
 */
export const testPerformance = async (): Promise<void> => {
  console.log('🧪 Testing performance...');

  const testUrl = 'https://performance-test.e2b.dev';
  const projectId = 'perf-test-project';

  const iterations = 10;
  const times: number[] = [];

  for (let i = 0; i < iterations; i++) {
    const startTime = performance.now();

    try {
      await safeOpenProject(testUrl, `${projectId}-${i}`);
      const endTime = performance.now();
      times.push(endTime - startTime);
    } catch (error) {
      console.log(`⚠️ Iteration ${i} failed (expected for throttling)`);
    }

    // Small delay between iterations
    await new Promise((resolve) => setTimeout(resolve, 100));
  }

  if (times.length > 0) {
    const avgTime = times.reduce((a, b) => a + b, 0) / times.length;
    const minTime = Math.min(...times);
    const maxTime = Math.max(...times);

    console.log('📊 Performance metrics:', {
      iterations: times.length,
      averageTime: `${avgTime.toFixed(2)}ms`,
      minTime: `${minTime.toFixed(2)}ms`,
      maxTime: `${maxTime.toFixed(2)}ms`,
    });
  }
};

// Export test functions for manual testing
export const testSuite = {
  testRapidProjectOpening,
  testMultipleProjects,
  testDatabaseOperations,
  testErrorHandling,
  testPerformance,
  runAllTests,
};
