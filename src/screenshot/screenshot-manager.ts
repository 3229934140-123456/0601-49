import * as fs from 'fs';
import * as path from 'path';

export interface ScreenshotOptions {
  fullPage?: boolean;
  width?: number;
  height?: number;
  quality?: number;
  type?: 'png' | 'jpeg' | 'webp';
  clip?: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  encoding?: 'base64' | 'binary';
}

export interface ScreenshotResult {
  path: string;
  type: string;
  size: number;
  timestamp: number;
  name: string;
}

export interface ScreenshotManagerConfig {
  outputDir?: string;
  defaultType?: 'png' | 'jpeg' | 'webp';
  defaultQuality?: number;
  maxScreenshots?: number;
  autoSave?: boolean;
}

export type ScreenshotCaptureFn = (options: ScreenshotOptions) => Promise<Buffer | string>;

export class ScreenshotManager {
  private _config: Required<ScreenshotManagerConfig>;
  private _screenshots: ScreenshotResult[] = [];
  private _counter: number = 0;
  private _captureFn?: ScreenshotCaptureFn;
  private _currentTestId?: string;

  constructor(config: ScreenshotManagerConfig = {}) {
    this._config = {
      outputDir: config.outputDir || './screenshots',
      defaultType: config.defaultType || 'png',
      defaultQuality: config.defaultQuality ?? 80,
      maxScreenshots: config.maxScreenshots ?? 100,
      autoSave: config.autoSave ?? true,
    };

    this._ensureOutputDir();
  }

  get screenshots(): ScreenshotResult[] {
    return [...this._screenshots];
  }

  get count(): number {
    return this._screenshots.length;
  }

  setCaptureFunction(fn: ScreenshotCaptureFn): void {
    this._captureFn = fn;
  }

  setCurrentTestId(testId: string): void {
    this._currentTestId = testId;
  }

  async capture(
    name: string,
    options: ScreenshotOptions = {}
  ): Promise<ScreenshotResult> {
    if (!this._captureFn) {
      throw new Error(
        'No capture function set. Use setCaptureFunction() to provide a screenshot capture implementation.'
      );
    }

    if (this._screenshots.length >= this._config.maxScreenshots) {
      throw new Error(
        `Screenshot limit exceeded: maximum ${this._config.maxScreenshots} screenshots allowed`
      );
    }

    this._counter++;
    const type = options.type || this._config.defaultType;
    const quality = options.quality ?? this._config.defaultQuality;

    const timestamp = Date.now();
    const safeName = name.replace(/[^a-zA-Z0-9_-]/g, '_');
    const testPrefix = this._currentTestId ? `${this._currentTestId}_` : '';
    const fileName = `${testPrefix}${this._counter.toString().padStart(3, '0')}_${safeName}_${timestamp}.${type}`;
    const filePath = path.join(this._config.outputDir, fileName);

    const buffer = await this._captureFn({
      ...options,
      type,
      quality,
    });

    const imageBuffer = typeof buffer === 'string' ? Buffer.from(buffer, 'base64') : buffer;

    if (this._config.autoSave) {
      this._saveImage(filePath, imageBuffer);
    }

    const result: ScreenshotResult = {
      path: filePath,
      type,
      size: imageBuffer.length,
      timestamp,
      name,
    };

    this._screenshots.push(result);
    return result;
  }

  captureSync(
    name: string,
    buffer: Buffer | string,
    options: { type?: 'png' | 'jpeg' | 'webp' } = {}
  ): ScreenshotResult {
    if (this._screenshots.length >= this._config.maxScreenshots) {
      throw new Error(
        `Screenshot limit exceeded: maximum ${this._config.maxScreenshots} screenshots allowed`
      );
    }

    this._counter++;
    const type = options.type || this._config.defaultType;

    const timestamp = Date.now();
    const safeName = name.replace(/[^a-zA-Z0-9_-]/g, '_');
    const testPrefix = this._currentTestId ? `${this._currentTestId}_` : '';
    const fileName = `${testPrefix}${this._counter.toString().padStart(3, '0')}_${safeName}_${timestamp}.${type}`;
    const filePath = path.join(this._config.outputDir, fileName);

    const imageBuffer = typeof buffer === 'string' ? Buffer.from(buffer, 'base64') : buffer;

    if (this._config.autoSave) {
      this._saveImage(filePath, imageBuffer);
    }

    const result: ScreenshotResult = {
      path: filePath,
      type,
      size: imageBuffer.length,
      timestamp,
      name,
    };

    this._screenshots.push(result);
    return result;
  }

  getScreenshotByName(name: string): ScreenshotResult | undefined {
    return this._screenshots.find(s => s.name === name);
  }

  getScreenshotsByTimeRange(start: number, end: number): ScreenshotResult[] {
    return this._screenshots.filter(s => s.timestamp >= start && s.timestamp <= end);
  }

  getLatestScreenshot(): ScreenshotResult | undefined {
    return this._screenshots[this._screenshots.length - 1];
  }

  deleteScreenshot(index: number): boolean {
    if (index >= 0 && index < this._screenshots.length) {
      const screenshot = this._screenshots[index];
      try {
        if (fs.existsSync(screenshot.path)) {
          fs.unlinkSync(screenshot.path);
        }
      } catch (e) {
        // Ignore deletion errors
      }
      this._screenshots.splice(index, 1);
      return true;
    }
    return false;
  }

  clear(): void {
    for (const screenshot of this._screenshots) {
      try {
        if (fs.existsSync(screenshot.path)) {
          fs.unlinkSync(screenshot.path);
        }
      } catch (e) {
        // Ignore deletion errors
      }
    }
    this._screenshots = [];
    this._counter = 0;
  }

  toJSON(): ScreenshotResult[] {
    return this._screenshots.map(s => ({ ...s }));
  }

  getSummary(): {
    total: number;
    totalSize: number;
    avgSize: number;
    types: Record<string, number>;
  } {
    const total = this._screenshots.length;
    const totalSize = this._screenshots.reduce((sum, s) => sum + s.size, 0);
    const avgSize = total > 0 ? totalSize / total : 0;

    const types: Record<string, number> = {};
    for (const s of this._screenshots) {
      types[s.type] = (types[s.type] || 0) + 1;
    }

    return {
      total,
      totalSize,
      avgSize,
      types,
    };
  }

  private _ensureOutputDir(): void {
    const dir = this._config.outputDir;
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  }

  private _saveImage(filePath: string, buffer: Buffer): void {
    const dir = path.dirname(filePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(filePath, buffer);
  }
}
