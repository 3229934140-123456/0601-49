import { TestSuite } from './test-suite';
import { TestSuiteResult, TestSuiteConfig, TestResult, ResourceLock, TestPreviewResult, TestPreviewItem, FailedRerunPlan, FailedRerunItem } from './types';
import { TestCase } from './test-case';

export class TestRunner {
  private config: Required<TestSuiteConfig>;
  private _resourceLocks: Map<string, ResourceLock> = new Map();

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
      includeCaseIds: config.includeCaseIds ?? [],
    };
  }

  preview(suite: TestSuite): TestPreviewResult {
    const allTestCases = suite.getTestCases();
    let filteredCases = suite.filterByTags(this.config.tags, this.config.excludeTags);

    const onlyTests = filteredCases.filter(tc => tc.meta.only);
    if (onlyTests.length > 0) {
      filteredCases = onlyTests;
    }

    const skippedByTagCount = allTestCases.length - filteredCases.length;

    let skippedByIdsCount = 0;
    if (this.config.includeCaseIds.length > 0) {
      const idSet = new Set(this.config.includeCaseIds);
      const beforeCount = filteredCases.length;
      filteredCases = filteredCases.filter(tc => idSet.has(tc.meta.id));
      skippedByIdsCount = beforeCount - filteredCases.length;
    }

    const skippedCases = filteredCases.filter(tc => tc.meta.skip);
    const runnableCases = filteredCases.filter(tc => !tc.meta.skip);

    const serialTags = this.config.serialTags;
    const items: TestPreviewItem[] = [];
    const allResourceLocks = new Set<string>();
    let serialCount = 0;
    let parallelCount = 0;

    for (const tc of allTestCases) {
      const inTagFiltered = suite.filterByTags(this.config.tags, this.config.excludeTags).some(f => f.meta.id === tc.meta.id);
      const inIdFiltered = this.config.includeCaseIds.length === 0 || this.config.includeCaseIds.includes(tc.meta.id);
      const inFiltered = inTagFiltered && inIdFiltered;
      const isSkipped = tc.meta.skip;

      let willRun = inFiltered && !isSkipped;
      let skipReason: string | undefined;

      if (!inTagFiltered) {
        skipReason = '标签不匹配';
      } else if (!inIdFiltered) {
        skipReason = '不在重跑清单';
      } else if (isSkipped) {
        skipReason = 'skip 标记';
      }

      const hasSerialTag = serialTags.some(tag => tc.hasTag(tag));
      const hasResourceLocks = tc.meta.resourceLocks && tc.meta.resourceLocks.length > 0;
      const isConcurrentDisabled = tc.meta.concurrent === false;

      let isSerial = false;
      let serialReason: string | undefined;

      if (hasSerialTag) {
        isSerial = true;
        serialReason = '串行标签';
      } else if (isConcurrentDisabled) {
        isSerial = true;
        serialReason = '用例禁用并发';
      }

      if (willRun) {
        if (isSerial) {
          serialCount++;
        } else {
          parallelCount++;
        }
      }

      if (hasResourceLocks && tc.meta.resourceLocks) {
        for (const lock of tc.meta.resourceLocks) {
          allResourceLocks.add(lock);
        }
      }

      items.push({
        id: tc.meta.id,
        title: tc.meta.title,
        tags: tc.meta.tags,
        priority: tc.meta.priority,
        willRun,
        skipReason,
        isSerial,
        serialReason,
        resourceLocks: tc.meta.resourceLocks,
        dataSet: tc.dataSet?.name,
      });
    }

    return {
      suiteTitle: suite.title,
      total: allTestCases.length,
      willRun: runnableCases.length,
      skipped: skippedByTagCount + skippedByIdsCount + skippedCases.length,
      skippedByTag: skippedByTagCount,
      skippedBySkipFlag: skippedCases.length,
      skippedByIds: skippedByIdsCount,
      serialCount,
      parallelCount,
      resourceLocks: Array.from(allResourceLocks),
      items,
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

    if (this.config.includeCaseIds.length > 0) {
      const idSet = new Set(this.config.includeCaseIds);
      testCases = testCases.filter(tc => idSet.has(tc.meta.id));
    }

    const filteredByTags = allTestCases.length !== testCases.length || this.config.includeCaseIds.length > 0;
    const originalTotal = allTestCases.length;

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
      const isConcurrentDisabled = tc.meta.concurrent === false;

      if (hasSerialTag || isConcurrentDisabled) {
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
      const totalParallelConcurrency = Math.min(
        Math.max(1, globalConcurrency),
        parallelCases.length
      );
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
    const total = testCases.length;

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
      filteredByTags,
      originalTotal,
    };
  }

  private async _acquireLocks(keys: string[], testCaseId: string): Promise<void> {
    const sortedKeys = [...keys].sort();
    const promises = sortedKeys.map(key => this._acquireLock(key, testCaseId));
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
    const sortedKeys = [...keys].sort();
    for (const key of sortedKeys) {
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

  static getFailedRerunPlan(result: TestSuiteResult): FailedRerunPlan {
    const failedCases = result.results.filter(r => r.status === 'failed' || r.status === 'timeout');
    const items: FailedRerunItem[] = failedCases.map(r => {
      const failedStep = r.steps.find(s => s.status === 'failed' || s.status === 'timeout');
      return {
        id: r.meta.id,
        title: r.meta.title,
        status: r.status as 'failed' | 'timeout',
        tags: r.meta.tags,
        priority: r.meta.priority,
        dataSet: r.dataSet,
        resourceLocks: r.meta.resourceLocks,
        errorMessage: r.error?.message,
        failedStep: failedStep?.name,
      };
    });

    const failedCount = items.filter(i => i.status === 'failed').length;
    const timeoutCount = items.filter(i => i.status === 'timeout').length;

    return {
      total: items.length,
      failedCount,
      timeoutCount,
      items,
    };
  }

  static getFailedCaseIds(result: TestSuiteResult): string[] {
    return result.results
      .filter(r => r.status === 'failed' || r.status === 'timeout')
      .map(r => r.meta.id);
  }
}
