import { TestCase } from './test-case';
import { TestSuiteResult, TestSuiteConfig, TestResult } from './types';

export class TestSuite {
  readonly id: string;
  readonly title: string;
  private _testCases: TestCase[] = [];
  private _beforeAll: Array<() => Promise<void> | void> = [];
  private _afterAll: Array<() => Promise<void> | void> = [];
  private _beforeEach: Array<() => Promise<void> | void> = [];
  private _afterEach: Array<() => Promise<void> | void> = [];

  constructor(title: string, id?: string) {
    this.title = title;
    this.id = id || `suite-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
  }

  addTestCase(testCase: TestCase): this {
    this._testCases.push(testCase);
    return this;
  }

  addTestCases(testCases: TestCase[]): this {
    this._testCases.push(...testCases);
    return this;
  }

  beforeAll(fn: () => Promise<void> | void): this {
    this._beforeAll.push(fn);
    return this;
  }

  afterAll(fn: () => Promise<void> | void): this {
    this._afterAll.push(fn);
    return this;
  }

  beforeEach(fn: () => Promise<void> | void): this {
    this._beforeEach.push(fn);
    return this;
  }

  afterEach(fn: () => Promise<void> | void): this {
    this._afterEach.push(fn);
    return this;
  }

  getTestCases(): TestCase[] {
    return [...this._testCases];
  }

  getBeforeAllHooks(): Array<() => Promise<void> | void> {
    return [...this._beforeAll];
  }

  getAfterAllHooks(): Array<() => Promise<void> | void> {
    return [...this._afterAll];
  }

  getBeforeEachHooks(): Array<() => Promise<void> | void> {
    return [...this._beforeEach];
  }

  getAfterEachHooks(): Array<() => Promise<void> | void> {
    return [...this._afterEach];
  }

  filterByTags(tags: string[], excludeTags: string[] = []): TestCase[] {
    return this._testCases.filter(tc => {
      if (tags.length > 0 && !tc.hasAnyTag(tags)) return false;
      if (excludeTags.length > 0 && tc.hasAnyTag(excludeTags)) return false;
      return true;
    });
  }
}
