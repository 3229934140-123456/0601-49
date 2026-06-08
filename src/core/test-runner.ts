import { TestSuite } from './test-suite';
import { TestSuiteResult, TestSuiteConfig, TestResult } from './types';

export class TestRunner {
  private config: Required<TestSuiteConfig>;

  constructor(config: TestSuiteConfig = {}) {
    this.config = {
      timeout: config.timeout ?? 30000,
      retries: config.retries ?? 0,
      concurrency: config.concurrency ?? 1,
      tags: config.tags ?? [],
      excludeTags: config.excludeTags ?? [],
      bail: config.bail ?? false,
    };
  }

  async run(suite: TestSuite): Promise<TestSuiteResult> {
    const startTime = Date.now();
    const results: TestResult[] = [];

    let testCases = suite.filterByTags(this.config.tags, this.config.excludeTags);

    const onlyTests = testCases.filter(tc => tc.meta.only);
    if (onlyTests.length > 0) {
      testCases = onlyTests;
    }

    testCases = testCases.filter(tc => !tc.meta.skip);

    for (const hook of suite.getBeforeAllHooks()) {
      await hook();
    }

    const concurrency = this.config.concurrency;
    const total = testCases.length;
    let currentIndex = 0;

    const runNext = async (): Promise<void> => {
      while (currentIndex < total) {
        const index = currentIndex++;
        const testCase = testCases[index];

        for (const hook of suite.getBeforeEachHooks()) {
          await hook();
        }

        const result = await testCase.run({
          retries: testCase.meta.retries ?? this.config.retries,
          timeout: testCase.meta.timeout ?? this.config.timeout,
        });
        results[index] = result;

        for (const hook of suite.getAfterEachHooks()) {
          await hook();
        }

        if (this.config.bail && result.status === 'failed') {
          currentIndex = total;
          break;
        }
      }
    };

    const workers: Promise<void>[] = [];
    const workerCount = Math.min(concurrency, total);
    for (let i = 0; i < workerCount; i++) {
      workers.push(runNext());
    }
    await Promise.all(workers);

    for (const hook of suite.getAfterAllHooks()) {
      await hook();
    }

    const endTime = Date.now();
    const passed = results.filter(r => r.status === 'passed').length;
    const failed = results.filter(r => r.status === 'failed' || r.status === 'timeout').length;
    const skipped = total - results.filter(r => r.status !== 'skipped').length;

    return {
      id: suite.id,
      title: suite.title,
      startTime,
      endTime,
      duration: endTime - startTime,
      total,
      passed,
      failed,
      skipped,
      results,
    };
  }

  setConcurrency(concurrency: number): void {
    this.config.concurrency = concurrency;
  }

  setTimeout(timeout: number): void {
    this.config.timeout = timeout;
  }

  setRetries(retries: number): void {
    this.config.retries = retries;
  }
}
