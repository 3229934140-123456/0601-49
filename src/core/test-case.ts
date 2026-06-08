import { TestCaseMeta, TestCaseFn, TestResult, TestStatus, TestError, RetryRecord, DataSetMeta } from './types';
import { TestContextImpl } from './context';

export class TestCase {
  readonly meta: TestCaseMeta;
  private _fn: TestCaseFn;
  private _dataSet?: DataSetMeta;

  constructor(meta: Partial<TestCaseMeta> & { title: string }, fn: TestCaseFn, dataSet?: DataSetMeta) {
    this.meta = {
      id: meta.id || `tc-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
      title: meta.title,
      description: meta.description,
      tags: meta.tags || [],
      priority: meta.priority || 'medium',
      timeout: meta.timeout,
      retries: meta.retries,
      concurrent: meta.concurrent ?? true,
      skip: meta.skip ?? false,
      only: meta.only ?? false,
      resourceLocks: meta.resourceLocks,
      dataSet: meta.dataSet || dataSet,
    };
    this._fn = fn;
    this._dataSet = dataSet || meta.dataSet;
  }

  hasTag(tag: string): boolean {
    return this.meta.tags.includes(tag);
  }

  hasAnyTag(tags: string[]): boolean {
    return tags.some(tag => this.hasTag(tag));
  }

  hasAllTags(tags: string[]): boolean {
    return tags.every(tag => this.hasTag(tag));
  }

  get dataSet(): DataSetMeta | undefined {
    return this._dataSet;
  }

  async run(options?: { retries?: number; timeout?: number }): Promise<TestResult> {
    const retries = options?.retries ?? this.meta.retries ?? 0;
    const timeout = options?.timeout ?? this.meta.timeout;

    let retryCount = 0;
    const retryRecords: RetryRecord[] = [];
    let lastError: TestError | undefined;
    let lastContext: TestContextImpl | undefined;

    const startTime = Date.now();

    do {
      const ctx = new TestContextImpl(this.meta, this._dataSet);
      lastContext = ctx;

      try {
        let result: any;

        if (timeout) {
          result = await this._runWithTimeout(ctx, timeout);
        } else {
          result = await this._fn(ctx);
        }

        return {
          meta: this.meta,
          status: 'passed',
          startTime,
          endTime: Date.now(),
          duration: Date.now() - startTime,
          steps: ctx.getSteps(),
          retryCount,
          retryRecords: retryRecords.length > 0 ? retryRecords : undefined,
          screenshots: ctx.getScreenshots(),
          dataSet: this._dataSet,
          isParameterized: !!this._dataSet,
        };
      } catch (error: any) {
        lastError = this._normalizeError(error);

        if (retryCount < retries) {
          retryRecords.push({
            attempt: retryCount + 1,
            error: { ...lastError },
            timestamp: Date.now(),
          });
          retryCount++;
          continue;
        }

        const status = error?.name === 'TimeoutError' ? 'timeout' : 'failed';

        return {
          meta: this.meta,
          status,
          startTime,
          endTime: Date.now(),
          duration: Date.now() - startTime,
          steps: ctx.getSteps(),
          error: lastError,
          retryCount,
          retryRecords: retryRecords.length > 0 ? retryRecords : undefined,
          screenshots: ctx.getScreenshots(),
          dataSet: this._dataSet,
          isParameterized: !!this._dataSet,
        };
      }
    } while (retryCount <= retries);

    return {
      meta: this.meta,
      status: 'failed',
      startTime,
      endTime: Date.now(),
      duration: Date.now() - startTime,
      steps: lastContext?.getSteps() || [],
      error: lastError,
      retryCount,
      retryRecords: retryRecords.length > 0 ? retryRecords : undefined,
      screenshots: lastContext?.getScreenshots() || [],
      dataSet: this._dataSet,
      isParameterized: !!this._dataSet,
    };
  }

  private async _runWithTimeout(ctx: TestContextImpl, timeout: number): Promise<any> {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        const error = new Error(`Test timed out after ${timeout}ms`);
        error.name = 'TimeoutError';
        reject(error);
      }, timeout);

      Promise.resolve(this._fn(ctx))
        .then(result => {
          clearTimeout(timer);
          resolve(result);
        })
        .catch(err => {
          clearTimeout(timer);
          reject(err);
        });
    });
  }

  private _normalizeError(error: any): TestError {
    if (error instanceof Error) {
      const testError: TestError = {
        name: error.name,
        message: error.message,
        stack: error.stack,
      };
      if ((error as any).expected !== undefined) {
        testError.expected = (error as any).expected;
      }
      if ((error as any).actual !== undefined) {
        testError.actual = (error as any).actual;
      }
      return testError;
    }
    return {
      name: 'UnknownError',
      message: String(error),
    };
  }

  createSkippedResult(): TestResult {
    const now = Date.now();
    return {
      meta: this.meta,
      status: 'skipped',
      startTime: now,
      endTime: now,
      duration: 0,
      steps: [],
      retryCount: 0,
      screenshots: [],
      dataSet: this._dataSet,
      isParameterized: !!this._dataSet,
    };
  }
}
