import { TestCaseMeta, TestCaseFn, TestResult, TestStatus, TestError } from './types';
import { TestContextImpl } from './context';

export class TestCase {
  readonly meta: TestCaseMeta;
  private _fn: TestCaseFn;

  constructor(meta: Partial<TestCaseMeta> & { title: string }, fn: TestCaseFn) {
    this.meta = {
      id: meta.id || `tc-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
      title: meta.title,
      description: meta.description,
      tags: meta.tags || [],
      priority: meta.priority || 'medium',
      timeout: meta.timeout,
      retries: meta.retries,
      concurrent: meta.concurrent ?? false,
      skip: meta.skip ?? false,
      only: meta.only ?? false,
    };
    this._fn = fn;
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

  async run(options?: { retries?: number; timeout?: number }): Promise<TestResult> {
    const retries = options?.retries ?? this.meta.retries ?? 0;
    const timeout = options?.timeout ?? this.meta.timeout;

    let retryCount = 0;
    let lastError: TestError | undefined;
    let lastContext: TestContextImpl | undefined;

    const startTime = Date.now();

    do {
      const ctx = new TestContextImpl(this.meta);
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
          screenshots: ctx.getScreenshots(),
        };
      } catch (error: any) {
        lastError = this._normalizeError(error);
        
        if (retryCount < retries) {
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
          screenshots: ctx.getScreenshots(),
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
      screenshots: lastContext?.getScreenshots() || [],
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
      return {
        name: error.name,
        message: error.message,
        stack: error.stack,
      };
    }
    return {
      name: 'UnknownError',
      message: String(error),
    };
  }
}
