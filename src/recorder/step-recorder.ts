import { TestStep, TestStatus, TestError } from '../core/types';

export interface StepRecordOptions {
  description?: string;
  category?: string;
  tags?: string[];
  recordInput?: boolean;
  recordOutput?: boolean;
}

export interface StepRecorderConfig {
  autoRecordInput?: boolean;
  autoRecordOutput?: boolean;
  maxSteps?: number;
}

export class StepRecorder {
  private _steps: TestStep[] = [];
  private _stepCounter: number = 0;
  private _currentStep?: TestStep;
  private _config: Required<StepRecorderConfig>;
  private _stepStack: TestStep[] = [];

  constructor(config: StepRecorderConfig = {}) {
    this._config = {
      autoRecordInput: config.autoRecordInput ?? true,
      autoRecordOutput: config.autoRecordOutput ?? true,
      maxSteps: config.maxSteps ?? 1000,
    };
  }

  get steps(): ReadonlyArray<TestStep> {
    return this._steps;
  }

  get currentStep(): TestStep | undefined {
    return this._currentStep;
  }

  get lastStep(): TestStep | undefined {
    return this._steps[this._steps.length - 1];
  }

  get failedSteps(): TestStep[] {
    return this._steps.filter(s => s.status === 'failed');
  }

  get passedSteps(): TestStep[] {
    return this._steps.filter(s => s.status === 'passed');
  }

  startStep(name: string, input?: any, options: StepRecordOptions = {}): TestStep {
    if (this._steps.length >= this._config.maxSteps) {
      throw new Error(`Step limit exceeded: maximum ${this._config.maxSteps} steps allowed`);
    }

    this._stepCounter++;
    const stepId = `step-${this._stepCounter}-${Date.now()}`;

    const step: TestStep = {
      id: stepId,
      name,
      description: options.description,
      startTime: Date.now(),
      status: 'running',
      input: this._config.autoRecordInput || options.recordInput ? input : undefined,
    };

    if (options.tags) {
      (step as any).tags = options.tags;
    }
    if (options.category) {
      (step as any).category = options.category;
    }

    this._steps.push(step);
    this._currentStep = step;
    this._stepStack.push(step);

    return step;
  }

  endStep(output?: any, status: TestStatus = 'passed'): TestStep {
    const step = this._stepStack.pop();
    if (!step) {
      throw new Error('No active step to end');
    }

    step.endTime = Date.now();
    step.duration = step.endTime - step.startTime;
    step.status = status;

    if (this._config.autoRecordOutput || status !== 'passed') {
      step.output = output;
    }

    this._currentStep = this._stepStack[this._stepStack.length - 1];

    return step;
  }

  failStep(error: any): TestStep {
    const step = this._currentStep;
    if (!step) {
      throw new Error('No active step to fail');
    }

    step.error = this._normalizeError(error);
    return this.endStep(undefined, 'failed');
  }

  async record<T>(
    name: string,
    fn: () => Promise<T> | T,
    input?: any,
    options: StepRecordOptions = {}
  ): Promise<T> {
    this.startStep(name, input, options);

    try {
      const result = await fn();
      this.endStep(result, 'passed');
      return result;
    } catch (error) {
      this.failStep(error);
      throw error;
    }
  }

  recordSync<T>(
    name: string,
    fn: () => T,
    input?: any,
    options: StepRecordOptions = {}
  ): T {
    this.startStep(name, input, options);

    try {
      const result = fn();
      this.endStep(result, 'passed');
      return result;
    } catch (error) {
      this.failStep(error);
      throw error;
    }
  }

  log(message: string, level: 'info' | 'warn' | 'error' = 'info'): void {
    if (this._currentStep) {
      if (!(this._currentStep as any).logs) {
        (this._currentStep as any).logs = [];
      }
      (this._currentStep as any).logs.push({
        timestamp: Date.now(),
        level,
        message,
      });
    }
  }

  attachScreenshot(screenshotPath: string): void {
    if (this._currentStep) {
      this._currentStep.screenshot = screenshotPath;
    }
  }

  getStepById(id: string): TestStep | undefined {
    return this._steps.find(s => s.id === id);
  }

  getStepsByStatus(status: TestStatus): TestStep[] {
    return this._steps.filter(s => s.status === status);
  }

  getStepsByTag(tag: string): TestStep[] {
    return this._steps.filter(s => (s as any).tags?.includes(tag));
  }

  getStepsByCategory(category: string): TestStep[] {
    return this._steps.filter(s => (s as any).category === category);
  }

  reset(): void {
    this._steps = [];
    this._stepCounter = 0;
    this._currentStep = undefined;
    this._stepStack = [];
  }

  toJSON(): TestStep[] {
    return [...this._steps];
  }

  getSummary(): {
    total: number;
    passed: number;
    failed: number;
    skipped: number;
    totalDuration: number;
    avgDuration: number;
  } {
    const total = this._steps.length;
    const passed = this.passedSteps.length;
    const failed = this.failedSteps.length;
    const skipped = this._steps.filter(s => s.status === 'skipped').length;
    const totalDuration = this._steps.reduce((sum, s) => sum + (s.duration || 0), 0);
    const avgDuration = total > 0 ? totalDuration / total : 0;

    return {
      total,
      passed,
      failed,
      skipped,
      totalDuration,
      avgDuration,
    };
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
