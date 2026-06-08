export type TestStatus = 'pending' | 'running' | 'passed' | 'failed' | 'skipped' | 'timeout';

export type TestCaseFn = (ctx: TestContext) => Promise<void> | void;

export interface TestCaseMeta {
  id: string;
  title: string;
  description?: string;
  tags: string[];
  priority: 'low' | 'medium' | 'high' | 'critical';
  timeout?: number;
  retries?: number;
  concurrent?: boolean;
  skip?: boolean;
  only?: boolean;
}

export interface TestStep {
  id: string;
  name: string;
  description?: string;
  input?: any;
  output?: any;
  startTime: number;
  endTime?: number;
  duration?: number;
  status: TestStatus;
  error?: TestError;
  screenshot?: string;
}

export interface TestError {
  name: string;
  message: string;
  stack?: string;
  expected?: any;
  actual?: any;
}

export interface TestResult {
  meta: TestCaseMeta;
  status: TestStatus;
  startTime: number;
  endTime?: number;
  duration?: number;
  steps: TestStep[];
  error?: TestError;
  retryCount: number;
  screenshots: string[];
}

export interface TestSuiteResult {
  id: string;
  title: string;
  startTime: number;
  endTime?: number;
  duration?: number;
  total: number;
  passed: number;
  failed: number;
  skipped: number;
  results: TestResult[];
}

export interface TestContextData {
  [key: string]: any;
}

export interface TestContext {
  readonly meta: TestCaseMeta;
  readonly data: TestContextData;
  readonly steps: ReadonlyArray<TestStep>;
  readonly currentStep?: TestStep;
  
  set(key: string, value: any): void;
  get<T = any>(key: string): T | undefined;
  
  step<T = any>(name: string, fn: () => Promise<T> | T, description?: string): Promise<T>;
  
  log(message: string, ...args: any[]): void;
  warn(message: string, ...args: any[]): void;
  error(message: string, ...args: any[]): void;
  
  attachScreenshot(path: string): void;
}

export interface TestSuiteConfig {
  timeout?: number;
  retries?: number;
  concurrency?: number;
  tags?: string[];
  excludeTags?: string[];
  bail?: boolean;
}

export interface NotificationConfig {
  webhookUrl?: string;
  projectId?: string;
  channels?: string[];
  onSuccess?: boolean;
  onFailure?: boolean;
  callback?: (result: TestSuiteResult) => Promise<void> | void;
}

export interface ReportConfig {
  outputDir?: string;
  format?: ('html' | 'json' | 'markdown')[];
  includeScreenshots?: boolean;
  shareable?: boolean;
}
