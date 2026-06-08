export type RetryStatus = 'pending' | 'retrying' | 'success' | 'failed' | 'aborted';

export interface RetryOptions {
  maxRetries?: number;
  delayMs?: number;
  backoff?: 'fixed' | 'exponential' | 'linear';
  backoffMultiplier?: number;
  maxDelayMs?: number;
  timeoutMs?: number;
  retryOn?: (error: any, attempt: number) => boolean;
  abortOn?: (error: any, attempt: number) => boolean;
  onRetry?: (error: any, attempt: number, delay: number) => void;
  onSuccess?: (result: any, attempt: number) => void;
  onFailure?: (error: any, attempt: number) => void;
}

export interface RetryResult<T> {
  status: RetryStatus;
  result?: T;
  error?: any;
  attempt: number;
  totalRetries: number;
  totalDuration: number;
}

export class RetryStrategy {
  private _options: Required<Omit<RetryOptions, 'onRetry' | 'onSuccess' | 'onFailure'>> & {
    onRetry?: RetryOptions['onRetry'];
    onSuccess?: RetryOptions['onSuccess'];
    onFailure?: RetryOptions['onFailure'];
  };

  constructor(options: RetryOptions = {}) {
    this._options = {
      maxRetries: options.maxRetries ?? 3,
      delayMs: options.delayMs ?? 1000,
      backoff: options.backoff ?? 'fixed',
      backoffMultiplier: options.backoffMultiplier ?? 2,
      maxDelayMs: options.maxDelayMs ?? 30000,
      timeoutMs: options.timeoutMs ?? 60000,
      retryOn: options.retryOn || (() => true),
      abortOn: options.abortOn || (() => false),
      onRetry: options.onRetry,
      onSuccess: options.onSuccess,
      onFailure: options.onFailure,
    };
  }

  async execute<T>(fn: () => Promise<T> | T): Promise<RetryResult<T>> {
    const startTime = Date.now();
    let attempt = 0;
    let lastError: any;

    while (attempt <= this._options.maxRetries) {
      attempt++;

      try {
        const result = await this._executeWithTimeout(fn);
        
        this._options.onSuccess?.(result, attempt);
        
        return {
          status: 'success',
          result,
          attempt,
          totalRetries: attempt - 1,
          totalDuration: Date.now() - startTime,
        };
      } catch (error: any) {
        lastError = error;

        if (this._options.abortOn(error, attempt)) {
          return {
            status: 'aborted',
            error,
            attempt,
            totalRetries: attempt - 1,
            totalDuration: Date.now() - startTime,
          };
        }

        if (!this._options.retryOn(error, attempt)) {
          break;
        }

        if (attempt > this._options.maxRetries) {
          break;
        }

        const elapsed = Date.now() - startTime;
        if (this._options.timeoutMs && elapsed >= this._options.timeoutMs) {
          break;
        }

        const delay = this._calculateDelay(attempt);
        this._options.onRetry?.(error, attempt, delay);
        
        await this._sleep(delay);

        if (this._options.timeoutMs && (Date.now() - startTime) >= this._options.timeoutMs) {
          break;
        }
      }
    }

    this._options.onFailure?.(lastError, attempt);

    return {
      status: 'failed',
      error: lastError,
      attempt,
      totalRetries: attempt - 1,
      totalDuration: Date.now() - startTime,
    };
  }

  private async _executeWithTimeout<T>(fn: () => Promise<T> | T): Promise<T> {
    if (!this._options.timeoutMs) {
      return fn();
    }

    return new Promise<T>((resolve, reject) => {
      const timer = setTimeout(() => {
        const error = new Error('Operation timed out');
        error.name = 'TimeoutError';
        reject(error);
      }, this._options.timeoutMs);

      Promise.resolve(fn())
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

  private _calculateDelay(attempt: number): number {
    let delay: number;
    const baseDelay = this._options.delayMs;

    switch (this._options.backoff) {
      case 'exponential':
        delay = baseDelay * Math.pow(this._options.backoffMultiplier, attempt - 1);
        break;
      case 'linear':
        delay = baseDelay * attempt;
        break;
      case 'fixed':
      default:
        delay = baseDelay;
        break;
    }

    return Math.min(delay, this._options.maxDelayMs);
  }

  private _sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  static async retry<T>(fn: () => Promise<T> | T, options: RetryOptions = {}): Promise<RetryResult<T>> {
    const strategy = new RetryStrategy(options);
    return strategy.execute(fn);
  }

  static withFixedDelay(maxRetries: number, delayMs: number): RetryStrategy {
    return new RetryStrategy({ maxRetries, delayMs, backoff: 'fixed' });
  }

  static withExponentialBackoff(maxRetries: number, delayMs: number, multiplier: number = 2): RetryStrategy {
    return new RetryStrategy({ maxRetries, delayMs, backoff: 'exponential', backoffMultiplier: multiplier });
  }

  static withLinearBackoff(maxRetries: number, delayMs: number): RetryStrategy {
    return new RetryStrategy({ maxRetries, delayMs, backoff: 'linear' });
  }
}
