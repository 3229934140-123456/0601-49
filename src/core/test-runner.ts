import { TestSuite } from './test-suite';
import { TestSuiteResult, TestSuiteConfig, TestResult, ResourceLock } from './types';
import { TestCase } from './test-case';

export class TestRunner {
  private config: Required<TestSuiteConfig>;
  private _resourceLocks: Map<string, ResourceLock> = new Map();
  private _runningLock: object = {};

  constructor(config: TestSuiteConfig = {}) {
    this.config = {
      timeout: config.timeout ?? 30000,
      retries: config.retries ?? 0,
      concurrency: config.concurrency ?? 1,
      tags: config.tags ?? [],
      excludeTags: config.excludeTags ?? [],
      bail: config.bail ?? false,
      serialTags: config.serialTags ?? [],
      includeSkippedInReport: config.includeSkippedInReport ?? true,
    };
  }

  async run(suite: TestSuite): Promise<TestSuiteResult> {
    const startTime = Date.now();
    const allTestCases = suite.getTestCases();

    let testCases = suite.filterByTags(this.config.tags, this.config.excludeTags);

    const onlyTests = testCases.filter(tc => tc.meta.only);
    if (onlyTests.length > 0) {
      testCases = onlyTests;
    }

    const skippedCases = testCases.filter(tc => tc.meta.skip);
    const runnableCases = testCases.filter(tc => !tc.meta.skip);
    const skippedDetails = skippedCases.map(tc => tc.createSkippedResult());

    for (const hook of suite.getBeforeAllHooks()) {
      await hook();
    }

    const results: TestResult[] = [];
    const serialTags = this.config.serialTags;
    const globalConcurrency = this.config.concurrency;

    const serialCases: TestCase[] = [];
    const parallelCases: TestCase[] = [];

    for (const tc of runnableCases) {
      const hasSerialTag = serialTags.some(tag => tc.hasTag(tag));
      const hasResourceLocks = tc.meta.resourceLocks && tc.meta.resourceLocks.length > 0;
      const isConcurrentDisabled = tc.meta.concurrent === false;

      if (hasSerialTag || hasResourceLocks || isConcurrentDisabled) {
        serialCases.push(tc);
      } else {
        parallelCases.push(tc);
      }
    }

    const runTestCase = async (testCase: TestCase): Promise<TestResult> => {
      for (const hook of suite.getBeforeEachHooks()) {
        await hook();
      }

      if (testCase.meta.resourceLocks && testCase.meta.resourceLocks.length > 0) {
        await this._acquireLocks(testCase.meta.resourceLocks, testCase.meta.id);
      }

      try {
        const result = await testCase.run({
          retries: testCase.meta.retries ?? this.config.retries,
          timeout: testCase.meta.timeout ?? this.config.timeout,
        });
        return result;
      } finally {
        if (testCase.meta.resourceLocks && testCase.meta.resourceLocks.length > 0) {
          this._releaseLocks(testCase.meta.resourceLocks);
        }

        for (const hook of suite.getAfterEachHooks()) {
          await hook();
        }
      }
    };

    for (const tc of serialCases) {
      const result = await runTestCase(tc);
      results.push(result);

      if (this.config.bail && result.status === 'failed') {
        break;
      }
    }

    if (!(this.config.bail && results.some(r => r.status === 'failed'))) {
      const totalParallelConcurrency = Math.min(globalConcurrency, parallelCases.length);
      let currentIndex = 0;

      const runNext = async (): Promise<void> => {
        while (currentIndex < parallelCases.length) {
          const index = currentIndex++;
          const testCase = parallelCases[index];

          const result = await runTestCase(testCase);
          results.push(result);

          if (this.config.bail && result.status === 'failed') {
            currentIndex = parallelCases.length;
            break;
          }
        }
      };

      const workers: Promise<void>[] = [];
      for (let i = 0; i < totalParallelConcurrency; i++) {
        workers.push(runNext());
      }
      await Promise.all(workers);
    }

    for (const hook of suite.getAfterAllHooks()) {
      await hook();
    }

    const endTime = Date.now();
    const allResults = [...skippedDetails, ...results];
    const passed = results.filter(r => r.status === 'passed').length;
    const failed = results.filter(r => r.status === 'failed').length;
    const timeout = results.filter(r => r.status === 'timeout').length;
    const skipped = skippedDetails.length;
    const total = allTestCases.length;

    const finalResults = this.config.includeSkippedInReport
      ? allResults
      : results;

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
      timeout,
      results: finalResults,
      skippedDetails: this.config.includeSkippedInReport ? skippedDetails : undefined,
    };
  }

  private async _acquireLocks(keys: string[], testCaseId: string): Promise<void> {
    const promises = keys.map(key => this._acquireLock(key, testCaseId));
    await Promise.all(promises);
  }

  private _acquireLock(key: string, testCaseId: string): Promise<void> {
    return new Promise((resolve) => {
      let lock = this._resourceLocks.get(key);

      if (!lock) {
        lock = {
          key,
          queue: [],
        };
        this._resourceLocks.set(key, lock);
      }

      if (!lock.holder) {
        lock.holder = testCaseId;
        resolve();
      } else {
        lock.queue.push({ resolve, testCaseId });
      }
    });
  }

  private _releaseLocks(keys: string[]): void {
    for (const key of keys) {
      this._releaseLock(key);
    }
  }

  private _releaseLock(key: string): void {
    const lock = this._resourceLocks.get(key);
    if (!lock) return;

    const next = lock.queue.shift();
    if (next) {
      lock.holder = next.testCaseId;
      next.resolve();
    } else {
      lock.holder = undefined;
    }
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

  setSerialTags(tags: string[]): void {
    this.config.serialTags = tags;
  }

  getResourceLockKeys(): string[] {
    return Array.from(this._resourceLocks.keys());
  }
}
