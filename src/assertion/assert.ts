export interface AssertionResult {
  passed: boolean;
  message: string;
  expected?: any;
  actual?: any;
  path?: string;
}

export interface AssertionError extends Error {
  results?: AssertionResult[];
  expected?: any;
  actual?: any;
}

export class Assert {
  private _results: AssertionResult[] = [];
  private _throwOnFailure: boolean;

  constructor(throwOnFailure: boolean = true) {
    this._throwOnFailure = throwOnFailure;
  }

  get results(): AssertionResult[] {
    return [...this._results];
  }

  get passed(): boolean {
    return this._results.every(r => r.passed);
  }

  get failed(): boolean {
    return this._results.some(r => !r.passed);
  }

  get failureCount(): number {
    return this._results.filter(r => !r.passed).length;
  }

  assertEqual(actual: any, expected: any, message?: string): this {
    const passed = actual === expected;
    this._addResult({
      passed,
      message: message || `Expected ${expected} but got ${actual}`,
      expected,
      actual,
    });
    return this;
  }

  assertNotEqual(actual: any, expected: any, message?: string): this {
    const passed = actual !== expected;
    this._addResult({
      passed,
      message: message || `Expected not ${expected} but got ${actual}`,
      expected: `not ${expected}`,
      actual,
    });
    return this;
  }

  assertDeepEqual(actual: any, expected: any, message?: string): this {
    const passed = this._deepEqual(actual, expected);
    this._addResult({
      passed,
      message: message || 'Deep equality assertion failed',
      expected,
      actual,
    });
    return this;
  }

  assertTrue(value: any, message?: string): this {
    const passed = value === true;
    this._addResult({
      passed,
      message: message || `Expected true but got ${value}`,
      expected: true,
      actual: value,
    });
    return this;
  }

  assertFalse(value: any, message?: string): this {
    const passed = value === false;
    this._addResult({
      passed,
      message: message || `Expected false but got ${value}`,
      expected: false,
      actual: value,
    });
    return this;
  }

  assertTruthy(value: any, message?: string): this {
    const passed = !!value;
    this._addResult({
      passed,
      message: message || `Expected truthy value but got ${value}`,
      expected: 'truthy',
      actual: value,
    });
    return this;
  }

  assertFalsy(value: any, message?: string): this {
    const passed = !value;
    this._addResult({
      passed,
      message: message || `Expected falsy value but got ${value}`,
      expected: 'falsy',
      actual: value,
    });
    return this;
  }

  assertNull(value: any, message?: string): this {
    const passed = value === null;
    this._addResult({
      passed,
      message: message || `Expected null but got ${value}`,
      expected: null,
      actual: value,
    });
    return this;
  }

  assertNotNull(value: any, message?: string): this {
    const passed = value !== null;
    this._addResult({
      passed,
      message: message || `Expected not null but got null`,
      expected: 'not null',
      actual: null,
    });
    return this;
  }

  assertUndefined(value: any, message?: string): this {
    const passed = value === undefined;
    this._addResult({
      passed,
      message: message || `Expected undefined but got ${value}`,
      expected: undefined,
      actual: value,
    });
    return this;
  }

  assertDefined(value: any, message?: string): this {
    const passed = value !== undefined;
    this._addResult({
      passed,
      message: message || `Expected defined value but got undefined`,
      expected: 'defined',
      actual: undefined,
    });
    return this;
  }

  assertGreaterThan(actual: number, expected: number, message?: string): this {
    const passed = actual > expected;
    this._addResult({
      passed,
      message: message || `Expected ${actual} > ${expected}`,
      expected: `> ${expected}`,
      actual,
    });
    return this;
  }

  assertLessThan(actual: number, expected: number, message?: string): this {
    const passed = actual < expected;
    this._addResult({
      passed,
      message: message || `Expected ${actual} < ${expected}`,
      expected: `< ${expected}`,
      actual,
    });
    return this;
  }

  assertGreaterThanOrEqual(actual: number, expected: number, message?: string): this {
    const passed = actual >= expected;
    this._addResult({
      passed,
      message: message || `Expected ${actual} >= ${expected}`,
      expected: `>= ${expected}`,
      actual,
    });
    return this;
  }

  assertLessThanOrEqual(actual: number, expected: number, message?: string): this {
    const passed = actual <= expected;
    this._addResult({
      passed,
      message: message || `Expected ${actual} <= ${expected}`,
      expected: `<= ${expected}`,
      actual,
    });
    return this;
  }

  assertContains(str: string, substring: string, message?: string): this {
    const passed = str.includes(substring);
    this._addResult({
      passed,
      message: message || `Expected string to contain "${substring}"`,
      expected: `contains "${substring}"`,
      actual: str,
    });
    return this;
  }

  assertMatch(str: string, regex: RegExp, message?: string): this {
    const passed = regex.test(str);
    this._addResult({
      passed,
      message: message || `Expected string to match ${regex}`,
      expected: regex.toString(),
      actual: str,
    });
    return this;
  }

  assertArrayIncludes<T>(array: T[], item: T, message?: string): this {
    const passed = array.includes(item);
    this._addResult({
      passed,
      message: message || `Expected array to include item`,
      expected: item,
      actual: array,
    });
    return this;
  }

  assertArrayLength(array: any[], length: number, message?: string): this {
    const passed = array.length === length;
    this._addResult({
      passed,
      message: message || `Expected array length ${length} but got ${array.length}`,
      expected: length,
      actual: array.length,
    });
    return this;
  }

  assertObjectHasKey(obj: object, key: string, message?: string): this {
    const passed = key in obj;
    this._addResult({
      passed,
      message: message || `Expected object to have key "${key}"`,
      expected: `has key "${key}"`,
      actual: Object.keys(obj),
    });
    return this;
  }

  assertObjectKeys(obj: object, keys: string[], message?: string): this {
    const objKeys = Object.keys(obj).sort();
    const expectedKeys = [...keys].sort();
    const passed = this._deepEqual(objKeys, expectedKeys);
    this._addResult({
      passed,
      message: message || 'Object keys do not match',
      expected: keys,
      actual: objKeys,
    });
    return this;
  }

  assertType(value: any, type: string, message?: string): this {
    const actualType = typeof value;
    const passed = actualType === type;
    this._addResult({
      passed,
      message: message || `Expected type ${type} but got ${actualType}`,
      expected: type,
      actual: actualType,
    });
    return this;
  }

  assertThrows(fn: () => any, expectedError?: string | RegExp, message?: string): this {
    try {
      fn();
      this._addResult({
        passed: false,
        message: message || 'Expected function to throw',
        expected: 'throws',
        actual: 'no error',
      });
    } catch (error: any) {
      let passed = true;
      let errMessage = message || 'Function threw as expected';

      if (expectedError) {
        if (typeof expectedError === 'string') {
          passed = error.message === expectedError;
          errMessage = message || `Expected error message "${expectedError}" but got "${error.message}"`;
        } else if (expectedError instanceof RegExp) {
          passed = expectedError.test(error.message);
          errMessage = message || `Expected error to match ${expectedError} but got "${error.message}"`;
        }
      }

      this._addResult({
        passed,
        message: errMessage,
        expected: expectedError,
        actual: error?.message,
      });
    }
    return this;
  }

  private _addResult(result: AssertionResult): void {
    this._results.push(result);
    if (!result.passed && this._throwOnFailure) {
      const error = new Error(result.message) as AssertionError;
      error.results = this._results;
      error.expected = result.expected;
      error.actual = result.actual;
      error.name = 'AssertionError';
      throw error;
    }
  }

  private _deepEqual(a: any, b: any): boolean {
    if (a === b) return true;
    if (a == null || b == null) return false;
    if (typeof a !== typeof b) return false;

    if (typeof a === 'object') {
      if (Array.isArray(a) && Array.isArray(b)) {
        if (a.length !== b.length) return false;
        for (let i = 0; i < a.length; i++) {
          if (!this._deepEqual(a[i], b[i])) return false;
        }
        return true;
      }

      if (Array.isArray(a) !== Array.isArray(b)) return false;

      const keysA = Object.keys(a);
      const keysB = Object.keys(b);
      if (keysA.length !== keysB.length) return false;

      for (const key of keysA) {
        if (!keysB.includes(key)) return false;
        if (!this._deepEqual(a[key], b[key])) return false;
      }
      return true;
    }

    return false;
  }

  static assertEqual(actual: any, expected: any, message?: string): void {
    new Assert().assertEqual(actual, expected, message);
  }

  static assertNotEqual(actual: any, expected: any, message?: string): void {
    new Assert().assertNotEqual(actual, expected, message);
  }

  static assertDeepEqual(actual: any, expected: any, message?: string): void {
    new Assert().assertDeepEqual(actual, expected, message);
  }

  static assertTrue(value: any, message?: string): void {
    new Assert().assertTrue(value, message);
  }

  static assertFalse(value: any, message?: string): void {
    new Assert().assertFalse(value, message);
  }

  static assertTruthy(value: any, message?: string): void {
    new Assert().assertTruthy(value, message);
  }

  static assertFalsy(value: any, message?: string): void {
    new Assert().assertFalsy(value, message);
  }

  static assertNull(value: any, message?: string): void {
    new Assert().assertNull(value, message);
  }

  static assertNotNull(value: any, message?: string): void {
    new Assert().assertNotNull(value, message);
  }

  static assertDefined(value: any, message?: string): void {
    new Assert().assertDefined(value, message);
  }

  static assertGreaterThan(actual: number, expected: number, message?: string): void {
    new Assert().assertGreaterThan(actual, expected, message);
  }

  static assertLessThan(actual: number, expected: number, message?: string): void {
    new Assert().assertLessThan(actual, expected, message);
  }

  static assertGreaterThanOrEqual(actual: number, expected: number, message?: string): void {
    new Assert().assertGreaterThanOrEqual(actual, expected, message);
  }

  static assertLessThanOrEqual(actual: number, expected: number, message?: string): void {
    new Assert().assertLessThanOrEqual(actual, expected, message);
  }

  static assertContains(str: string, substring: string, message?: string): void {
    new Assert().assertContains(str, substring, message);
  }

  static assertMatch(str: string, regex: RegExp, message?: string): void {
    new Assert().assertMatch(str, regex, message);
  }

  static assertArrayLength(array: any[], length: number, message?: string): void {
    new Assert().assertArrayLength(array, length, message);
  }

  static assertType(value: any, type: string, message?: string): void {
    new Assert().assertType(value, type, message);
  }
}
