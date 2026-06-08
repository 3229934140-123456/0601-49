import { TestCase } from '../core/test-case';
import { TestCaseFn, DataSetMeta, ParameterizedTestCaseConfig, TestResult } from '../core/types';

export class ParameterizedTestCase {
  private _baseMeta: ParameterizedTestCaseConfig;
  private _fn: TestCaseFn;
  private _dataSets: any[] = [];
  private _dataSummaryFn?: (data: any, index: number) => string;
  private _dataNameFn?: (data: any, index: number) => string;

  constructor(config: ParameterizedTestCaseConfig, fn: TestCaseFn) {
    this._baseMeta = { ...config };
    this._fn = fn;
    if (config.dataSummary) this._dataSummaryFn = config.dataSummary;
    if (config.dataName) this._dataNameFn = config.dataName;
  }

  withData(dataSets: any[]): this {
    this._dataSets = [...dataSets];
    return this;
  }

  withDataSummary(fn: (data: any, index: number) => string): this {
    this._dataSummaryFn = fn;
    return this;
  }

  withDataName(fn: (data: any, index: number) => string): this {
    this._dataNameFn = fn;
    return this;
  }

  get dataSetCount(): number {
    return this._dataSets.length;
  }

  buildTestCases(): TestCase[] {
    const testCases: TestCase[] = [];
    const total = this._dataSets.length;

    for (let i = 0; i < total; i++) {
      const data = this._dataSets[i];
      const dataName = this._dataNameFn ? this._dataNameFn(data, i) : `数据集 #${i + 1}`;
      const dataSummary = this._dataSummaryFn ? this._dataSummaryFn(data, i) : this._defaultSummary(data);

      const dataSetMeta: DataSetMeta = {
        name: dataName,
        index: i,
        data,
        summary: dataSummary,
      };

      const baseTitle = this._baseMeta.title || '参数化测试';
      const title = `${baseTitle} - ${dataName}`;

      const testCase = new TestCase(
        {
          ...this._baseMeta,
          title,
          dataSet: dataSetMeta,
        },
        this._fn
      );

      testCases.push(testCase);
    }

    return testCases;
  }

  async runAll(options?: { retries?: number; timeout?: number }): Promise<TestResult[]> {
    const testCases = this.buildTestCases();
    const results: TestResult[] = [];

    for (const tc of testCases) {
      const result = await tc.run(options);
      result.parameterizedIndex = tc.dataSet?.index;
      result.parameterizedTotal = testCases.length;
      results.push(result);
    }

    return results;
  }

  private _defaultSummary(data: any): string {
    if (typeof data === 'string' || typeof data === 'number' || typeof data === 'boolean') {
      return String(data);
    }
    if (data === null || data === undefined) {
      return String(data);
    }
    try {
      return JSON.stringify(data);
    } catch {
      return '[Object]';
    }
  }

  static fromData<T>(
    dataSets: T[],
    config: ParameterizedTestCaseConfig,
    fn: TestCaseFn
  ): ParameterizedTestCase {
    const p = new ParameterizedTestCase(config, fn);
    p.withData(dataSets);
    return p;
  }
}

export function parameterize<T>(
  dataSets: T[],
  config: ParameterizedTestCaseConfig,
  fn: TestCaseFn
): TestCase[] {
  return ParameterizedTestCase.fromData(dataSets, config, fn).buildTestCases();
}

export function parameterizeSuite(
  title: string,
  dataSets: any[],
  testFn: (data: any, index: number) => TestCase | TestCase[]
): TestCase[] {
  const allCases: TestCase[] = [];
  for (let i = 0; i < dataSets.length; i++) {
    const result = testFn(dataSets[i], i);
    if (Array.isArray(result)) {
      allCases.push(...result);
    } else {
      allCases.push(result);
    }
  }
  return allCases;
}
