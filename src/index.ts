export * from './core';
export * from './data';
export * from './recorder';
export * from './assertion';
export * from './screenshot';
export * from './retry';
export * from './report';
export * from './notification';

import { TestCase, TestSuite, TestRunner } from './core';
import { TestSuiteConfig } from './core';
import { ReportGenerator, ReportGeneratorOptions } from './report';
import { NotificationManager, NotificationOptions } from './notification';

export interface AutoTestPlatformConfig {
  runner?: TestSuiteConfig;
  report?: ReportGeneratorOptions;
  notification?: NotificationOptions;
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

  async runSuite(suite: TestSuite) {
    const result = await this._runner.run(suite);
    
    const reports = await this._reportGenerator.generate(result);
    
    await this._notificationManager.notify(result);
    
    return {
      result,
      reports,
    };
  }

  async runAllSuites() {
    const allResults = [];
    
    for (const suite of this._suites) {
      const { result, reports } = await this.runSuite(suite);
      allResults.push({ suite, result, reports });
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
