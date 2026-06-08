export * from './core';
export * from './data';
export * from './recorder';
export * from './assertion';
export * from './screenshot';
export * from './retry';
export * from './report';
export * from './notification';
export * from './parameterized';

import { TestCase, TestSuite, TestRunner } from './core';
import { TestSuiteConfig, TestPreviewResult, FailedRerunPlan, ReportDiff } from './core';
import { ReportGenerator, ReportGeneratorOptions, GeneratedReport, ReportHistoryManager } from './report';
import { NotificationManager, NotificationOptions } from './notification';
import { TestSuiteResult, NotificationErrorRecord, NotificationDeliveryRecord } from './core/types';

export interface AutoTestPlatformConfig {
  runner?: TestSuiteConfig;
  report?: ReportGeneratorOptions;
  notification?: NotificationOptions;
}

export interface RunSuiteResult {
  result: TestSuiteResult;
  reports: GeneratedReport[];
  notificationErrors: NotificationErrorRecord[];
  notificationDeliveries: NotificationDeliveryRecord[];
}

export class AutoTestPlatform {
  private _runner: TestRunner;
  private _reportGenerator: ReportGenerator;
  private _notificationManager: NotificationManager;
  private _suites: TestSuite[] = [];

  constructor(config: AutoTestPlatformConfig = {}) {
    this._runner = new TestRunner(config.runner);
    this._reportGenerator = new ReportGenerator(config.report);
    this._notificationManager = new NotificationManager(config.notification);
  }

  createSuite(title: string, id?: string): TestSuite {
    const suite = new TestSuite(title, id);
    this._suites.push(suite);
    return suite;
  }

  previewSuite(suite: TestSuite): TestPreviewResult {
    return this._runner.preview(suite);
  }

  async runSuite(suite: TestSuite): Promise<RunSuiteResult> {
    const result = await this._runner.run(suite);

    const deliveries = await this._notificationManager.notify(result);
    result.notificationDeliveries = deliveries;

    const notificationErrors = deliveries
      .filter(d => d.status === 'failed')
      .map(d => ({
        notifierName: d.notifierName,
        error: d.lastError || 'Unknown error',
        timestamp: d.sentAt,
      }));
    if (notificationErrors.length > 0) {
      result.notificationErrors = notificationErrors;
    }

    const reports = await this._reportGenerator.generate(result);

    return {
      result,
      reports,
      notificationErrors,
      notificationDeliveries: deliveries,
    };
  }

  async runAllSuites(): Promise<Array<{ suite: TestSuite } & RunSuiteResult>> {
    const allResults = [];

    for (const suite of this._suites) {
      const runResult = await this.runSuite(suite);
      allResults.push({ suite, ...runResult });
    }

    return allResults;
  }

  getFailedRerunPlan(result: TestSuiteResult): FailedRerunPlan {
    return TestRunner.getFailedRerunPlan(result);
  }

  getReportHistory() {
    return this._reportGenerator.getHistory();
  }

  getLatestReportDiff(): ReportDiff | undefined {
    return this._reportGenerator.historyManager?.getLatestDiff();
  }

  getReportDiff(baseReportId: string, targetReportId: string): ReportDiff | undefined {
    return this._reportGenerator.historyManager?.getReportDiff(baseReportId, targetReportId);
  }

  withRunnerConfig(config: Partial<TestSuiteConfig>): AutoTestPlatform {
    const mergedConfig = { ...this._runner['config'], ...config };
    this._runner = new TestRunner(mergedConfig);
    return this;
  }

  get runner(): TestRunner {
    return this._runner;
  }

  get reportGenerator(): ReportGenerator {
    return this._reportGenerator;
  }

  get notificationManager(): NotificationManager {
    return this._notificationManager;
  }

  get suites(): TestSuite[] {
    return [...this._suites];
  }
}

export default AutoTestPlatform;
