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
  dataSet?: DataSetMeta;
  resourceLocks?: string[];
}

export interface DataSetMeta {
  name: string;
  index: number;
  data: any;
  summary: string;
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
  retryAttempt?: number;
  logs?: Array<{ timestamp: number; level: string; message: string }>;
}

export interface TestError {
  name: string;
  message: string;
  stack?: string;
  expected?: any;
  actual?: any;
}

export interface RetryRecord {
  attempt: number;
  error: TestError;
  timestamp: number;
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
  retryRecords?: RetryRecord[];
  screenshots: string[];
  dataSet?: DataSetMeta;
  isParameterized?: boolean;
  parameterizedIndex?: number;
  parameterizedTotal?: number;
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
  timeout: number;
  results: TestResult[];
  skippedDetails?: TestResult[];
  notificationErrors?: NotificationErrorRecord[];
  environment?: string;
  projectName?: string;
  reportId?: string;
  reportUrls?: {
    html?: string;
    json?: string;
    markdown?: string;
  };
  filteredByTags?: boolean;
  originalTotal?: number;
}

export interface NotificationErrorRecord {
  notifierName: string;
  error: string;
  timestamp: number;
}

export interface TestContextData {
  [key: string]: any;
}

export interface TestContext {
  readonly meta: TestCaseMeta;
  readonly data: TestContextData;
  readonly steps: ReadonlyArray<TestStep>;
  readonly currentStep?: TestStep;
  readonly dataSet?: DataSetMeta;

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
  serialTags?: string[];
  includeSkippedInReport?: boolean;
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
  shareBaseUrl?: string;
  reportTitle?: string;
  projectName?: string;
  environment?: string;
  metadata?: Record<string, any>;
  showStepDetails?: boolean;
  showScreenshots?: boolean;
  showRetryRecords?: boolean;
  showSkipped?: boolean;
}

export interface ResourceLock {
  key: string;
  holder?: string;
  queue: Array<{ resolve: () => void; testCaseId: string }>;
}

export interface ParameterizedTestCaseConfig {
  title?: string;
  description?: string;
  tags?: string[];
  priority?: 'low' | 'medium' | 'high' | 'critical';
  timeout?: number;
  retries?: number;
  dataSummary?: (data: any, index: number) => string;
  dataName?: (data: any, index: number) => string;
}

export interface TestPreviewItem {
  id: string;
  title: string;
  tags: string[];
  priority: string;
  willRun: boolean;
  skipReason?: string;
  isSerial?: boolean;
  serialReason?: string;
  resourceLocks?: string[];
  dataSet?: string;
}

export interface TestPreviewResult {
  suiteTitle: string;
  total: number;
  willRun: number;
  skipped: number;
  skippedByTag: number;
  skippedBySkipFlag: number;
  serialCount: number;
  parallelCount: number;
  resourceLocks: string[];
  items: TestPreviewItem[];
}

export interface ReportHistoryEntry {
  reportId: string;
  suiteTitle: string;
  suiteId: string;
  startTime: number;
  endTime: number;
  duration: number;
  total: number;
  passed: number;
  failed: number;
  skipped: number;
  timeout: number;
  passRate: number;
  reportUrls: {
    html?: string;
    json?: string;
    markdown?: string;
  };
  failedCaseNames: string[];
  environment?: string;
  projectName?: string;
}

export interface ReportHistoryIndex {
  projectName: string;
  environment: string;
  totalReports: number;
  latestReport?: ReportHistoryEntry;
  passRateTrend: number[];
  lastUpdated: number;
  reports: ReportHistoryEntry[];
}
