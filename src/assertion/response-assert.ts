import { Assert, AssertionResult } from './assert';

export interface ApiResponse {
  status: number;
  statusText?: string;
  data?: any;
  headers?: Record<string, string>;
  config?: any;
  request?: any;
}

export interface ResponseAssertionOptions {
  throwOnFailure?: boolean;
}

export class ResponseAssert {
  private _assert: Assert;
  private _response: ApiResponse;

  constructor(response: ApiResponse, options: ResponseAssertionOptions = {}) {
    this._response = response;
    this._assert = new Assert(options.throwOnFailure ?? true);
  }

  get results(): AssertionResult[] {
    return this._assert.results;
  }

  get passed(): boolean {
    return this._assert.passed;
  }

  get failed(): boolean {
    return this._assert.failed;
  }

  status(expected: number): this {
    this._assert.assertEqual(
      this._response.status,
      expected,
      `Expected status code ${expected} but got ${this._response.status}`
    );
    return this;
  }

  statusOk(): this {
    return this.status(200);
  }

  statusCreated(): this {
    return this.status(201);
  }

  statusNoContent(): this {
    return this.status(204);
  }

  statusBadRequest(): this {
    return this.status(400);
  }

  statusUnauthorized(): this {
    return this.status(401);
  }

  statusForbidden(): this {
    return this.status(403);
  }

  statusNotFound(): this {
    return this.status(404);
  }

  statusServerError(): this {
    return this.status(500);
  }

  statusSuccess(): this {
    const isSuccess = this._response.status >= 200 && this._response.status < 300;
    if (!isSuccess) {
      this._assert.assertEqual(
        this._response.status,
        '2xx',
        `Expected success status code (2xx) but got ${this._response.status}`
      );
    }
    return this;
  }

  statusClientError(): this {
    const isClientError = this._response.status >= 400 && this._response.status < 500;
    if (!isClientError) {
      this._assert.assertEqual(
        this._response.status,
        '4xx',
        `Expected client error status code (4xx) but got ${this._response.status}`
      );
    }
    return this;
  }

  statusServerErrorRange(): this {
    const isServerError = this._response.status >= 500 && this._response.status < 600;
    if (!isServerError) {
      this._assert.assertEqual(
        this._response.status,
        '5xx',
        `Expected server error status code (5xx) but got ${this._response.status}`
      );
    }
    return this;
  }

  hasData(): this {
    this._assert.assertDefined(
      this._response.data,
      'Expected response to have data'
    );
    return this;
  }

  dataType(type: string): this {
    this.hasData();
    this._assert.assertType(
      this._response.data,
      type,
      `Expected response data to be of type ${type}`
    );
    return this;
  }

  hasField(path: string): this {
    const value = this._getFieldValue(path);
    this._assert.assertDefined(
      value,
      `Expected response data to have field "${path}"`
    );
    return this;
  }

  fieldEqual(path: string, expected: any): this {
    const actual = this._getFieldValue(path);
    this._assert.assertEqual(
      actual,
      expected,
      `Expected field "${path}" to be ${expected} but got ${actual}`
    );
    return this;
  }

  fieldDeepEqual(path: string, expected: any): this {
    const actual = this._getFieldValue(path);
    this._assert.assertDeepEqual(
      actual,
      expected,
      `Expected field "${path}" to deep equal ${JSON.stringify(expected)}`
    );
    return this;
  }

  fieldType(path: string, type: string): this {
    const value = this._getFieldValue(path);
    this._assert.assertType(
      value,
      type,
      `Expected field "${path}" to be of type ${type}`
    );
    return this;
  }

  fieldContains(path: string, substring: string): this {
    const value = this._getFieldValue(path);
    this._assert.assertContains(
      String(value),
      substring,
      `Expected field "${path}" to contain "${substring}"`
    );
    return this;
  }

  fieldMatch(path: string, regex: RegExp): this {
    const value = this._getFieldValue(path);
    this._assert.assertMatch(
      String(value),
      regex,
      `Expected field "${path}" to match ${regex}`
    );
    return this;
  }

  arrayLength(path: string, length: number): this {
    const value = this._getFieldValue(path);
    if (Array.isArray(value)) {
      this._assert.assertArrayLength(
        value,
        length,
        `Expected array at "${path}" to have length ${length} but got ${value.length}`
      );
    } else {
      this._assert.assertEqual(
        typeof value,
        'array',
        `Expected "${path}" to be an array`
      );
    }
    return this;
  }

  arrayNotEmpty(path: string): this {
    const value = this._getFieldValue(path);
    if (Array.isArray(value)) {
      this._assert.assertGreaterThan(
        value.length,
        0,
        `Expected array at "${path}" to not be empty`
      );
    } else {
      this._assert.assertEqual(
        typeof value,
        'array',
        `Expected "${path}" to be an array`
      );
    }
    return this;
  }

  hasHeader(name: string): this {
    const headers = this._response.headers || {};
    const headerValue = headers[name.toLowerCase()] || headers[name];
    this._assert.assertDefined(
      headerValue,
      `Expected response to have header "${name}"`
    );
    return this;
  }

  headerEqual(name: string, expected: string): this {
    const headers = this._response.headers || {};
    const actual = headers[name.toLowerCase()] || headers[name];
    this._assert.assertEqual(
      actual,
      expected,
      `Expected header "${name}" to be "${expected}" but got "${actual}"`
    );
    return this;
  }

  responseTime(maxMs: number): this {
    const responseTime = (this._response as any).responseTime;
    if (responseTime !== undefined) {
      this._assert.assertLessThanOrEqual(
        responseTime,
        maxMs,
        `Expected response time <= ${maxMs}ms but got ${responseTime}ms`
      );
    }
    return this;
  }

  bodySchema(validator: (data: any) => boolean | { valid: boolean; errors?: string[] }): this {
    const result = validator(this._response.data);
    const isValid = typeof result === 'boolean' ? result : result.valid;
    const errors = typeof result === 'boolean' ? [] : result.errors || [];

    if (!isValid) {
      this._assert.assertEqual(
        'valid schema',
        'invalid schema',
        `Response body schema validation failed: ${errors.join(', ')}`
      );
    }
    return this;
  }

  private _getFieldValue(path: string): any {
    if (!this._response.data) {
      return undefined;
    }

    const parts = path.split('.');
    let value: any = this._response.data;

    for (const part of parts) {
      if (value == null) {
        return undefined;
      }
      if (Array.isArray(value) && /^\d+$/.test(part)) {
        value = value[parseInt(part, 10)];
      } else {
        value = value[part];
      }
    }

    return value;
  }

  static assert(response: ApiResponse): ResponseAssert {
    return new ResponseAssert(response);
  }

  static status(response: ApiResponse, expected: number): void {
    new ResponseAssert(response).status(expected);
  }

  static ok(response: ApiResponse): void {
    new ResponseAssert(response).statusOk();
  }
}
