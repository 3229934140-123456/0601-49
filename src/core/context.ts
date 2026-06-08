import { TestContext, TestCaseMeta, TestStep, TestStatus, TestError, TestContextData, DataSetMeta } from './types';

export class TestContextImpl implements TestContext {
  readonly meta: TestCaseMeta;
  readonly data: TestContextData;
  readonly dataSet?: DataSetMeta;
  private _steps: TestStep[] = [];
  private _currentStep?: TestStep;
  private _screenshots: string[] = [];
  private _stepCounter: number = 0;
  private _stepStack: TestStep[] = [];

  constructor(meta: TestCaseMeta, dataSet?: DataSetMeta) {
    this.meta = meta;
    this.data = {};
    this.dataSet = dataSet;
    if (dataSet) {
      this.data['dataSet'] = dataSet.data;
      this.data['dataIndex'] = dataSet.index;
    }
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
      logs: [],
    };

    this._steps.push(step);
    this._currentStep = step;
    this._stepStack.push(step);

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
      this._stepStack.pop();
      this._currentStep = this._stepStack[this._stepStack.length - 1];
    }
  }

  log(message: string, ...args: any[]): void {
    const timestamp = Date.now();
    const formattedMessage = args.length > 0 ? `${message} ${args.map(String).join(' ')}` : message;

    if (this._currentStep && this._currentStep.logs) {
      this._currentStep.logs.push({
        timestamp,
        level: 'info',
        message: formattedMessage,
      });
    }

    const timeStr = new Date(timestamp).toISOString();
    console.log(`[${timeStr}] [INFO] [${this.meta.id}] ${formattedMessage}`);
  }

  warn(message: string, ...args: any[]): void {
    const timestamp = Date.now();
    const formattedMessage = args.length > 0 ? `${message} ${args.map(String).join(' ')}` : message;

    if (this._currentStep && this._currentStep.logs) {
      this._currentStep.logs.push({
        timestamp,
        level: 'warn',
        message: formattedMessage,
      });
    }

    const timeStr = new Date(timestamp).toISOString();
    console.warn(`[${timeStr}] [WARN] [${this.meta.id}] ${formattedMessage}`);
  }

  error(message: string, ...args: any[]): void {
    const timestamp = Date.now();
    const formattedMessage = args.length > 0 ? `${message} ${args.map(String).join(' ')}` : message;

    if (this._currentStep && this._currentStep.logs) {
      this._currentStep.logs.push({
        timestamp,
        level: 'error',
        message: formattedMessage,
      });
    }

    const timeStr = new Date(timestamp).toISOString();
    console.error(`[${timeStr}] [ERROR] [${this.meta.id}] ${formattedMessage}`);
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
}
