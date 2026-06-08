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
import { TestSuiteConfig } from './core';
import { ReportGenerator, ReportGeneratorOptions, GeneratedReport } from './report';
import { NotificationManager, NotificationOptions } from './notification';
import { TestSuiteResult, NotificationErrorRecord } from './core/types';

export interface AutoTestPlatformConfig {
  runner?: TestSuiteConfig;
  report?: ReportGeneratorOptions;
  notification?: NotificationOptions;
}

export interface RunSuiteResult {
  result: TestSuiteResult;
  reports: GeneratedReport[];
  notificationErrors: NotificationErrorRecord[];
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

  async runSuite(suite: TestSuite): Promise<RunSuiteResult> {
    const result = await this._runner.run(suite);

    const reports = await this._reportGenerator.generate(result);

    const notificationErrors = await this._notificationManager.notify(result);

    if (notificationErrors.length > 0) {
      result.notificationErrors = notificationErrors;
    }

    return {
      result,
      reports,
      notificationErrors,
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
