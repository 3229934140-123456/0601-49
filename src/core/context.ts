import { TestContext, TestCaseMeta, TestStep, TestStatus, TestError, TestContextData } from './types';

export class TestContextImpl implements TestContext {
  readonly meta: TestCaseMeta;
  readonly data: TestContextData;
  private _steps: TestStep[] = [];
  private _currentStep?: TestStep;
  private _screenshots: string[] = [];
  private _stepCounter: number = 0;

  constructor(meta: TestCaseMeta) {
    this.meta = meta;
    this.data = {};
  }

  get steps(): ReadonlyArray<TestStep> {
    return this._steps;
  }

  get currentStep(): TestStep | undefined {
    return this._currentStep;
  }

  get screenshots(): string[] {
    return [...this._screenshots];
  }

  set(key: string, value: any): void {
    this.data[key] = value;
  }

  get<T = any>(key: string): T | undefined {
    return this.data[key] as T | undefined;
  }

  async step<T = any>(name: string, fn: () => Promise<T> | T, description?: string): Promise<T> {
    this._stepCounter++;
    const stepId = `step-${this._stepCounter}-${Date.now()}`;
    
    const step: TestStep = {
      id: stepId,
      name,
      description,
      startTime: Date.now(),
      status: 'running',
    };

    this._steps.push(step);
    this._currentStep = step;

    try {
      const result = await fn();
      step.status = 'passed';
      step.output = result;
      step.endTime = Date.now();
      step.duration = step.endTime - step.startTime;
      return result;
    } catch (error: any) {
      step.status = 'failed';
      step.endTime = Date.now();
      step.duration = step.endTime - step.startTime;
      step.error = this._normalizeError(error);
      throw error;
    } finally {
      this._currentStep = undefined;
    }
  }

  log(message: string, ...args: any[]): void {
    const timestamp = new Date().toISOString();
    console.log(`[${timestamp}] [INFO] [${this.meta.id}] ${message}`, ...args);
  }

  warn(message: string, ...args: any[]): void {
    const timestamp = new Date().toISOString();
    console.warn(`[${timestamp}] [WARN] [${this.meta.id}] ${message}`, ...args);
  }

  error(message: string, ...args: any[]): void {
    const timestamp = new Date().toISOString();
    console.error(`[${timestamp}] [ERROR] [${this.meta.id}] ${message}`, ...args);
  }

  attachScreenshot(path: string): void {
    this._screenshots.push(path);
    if (this._currentStep) {
      this._currentStep.screenshot = path;
    }
  }

  getSteps(): TestStep[] {
    return [...this._steps];
  }

  getScreenshots(): string[] {
    return [...this._screenshots];
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
