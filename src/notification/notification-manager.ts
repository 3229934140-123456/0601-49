import { TestSuiteResult } from '../core/types';
import { NotificationConfig } from '../core/types';

export type NotificationType = 'success' | 'failure' | 'always';

export interface NotificationMessage {
  title: string;
  content: string;
  data?: any;
  type: NotificationType;
  timestamp: number;
}

export interface WebhookPayload {
  event: string;
  projectId?: string;
  result: TestSuiteResult;
  summary: {
    total: number;
    passed: number;
    failed: number;
    skipped: number;
    passRate: number;
    duration: number;
  };
  timestamp: number;
}

export interface NotificationOptions extends NotificationConfig {
  notifiers?: Notifier[];
}

export interface Notifier {
  name: string;
  send(message: NotificationMessage, result?: TestSuiteResult): Promise<void> | void;
}

export class WebhookNotifier implements Notifier {
  readonly name: string = 'webhook';
  private _webhookUrl: string;
  private _projectId?: string;

  constructor(webhookUrl: string, projectId?: string) {
    this._webhookUrl = webhookUrl;
    this._projectId = projectId;
  }

  async send(message: NotificationMessage, result?: TestSuiteResult): Promise<void> {
    try {
      const payload: WebhookPayload = {
        event: message.type,
        projectId: this._projectId,
        result: result!,
        summary: result ? this._buildSummary(result) : {
          total: 0,
          passed: 0,
          failed: 0,
          skipped: 0,
          passRate: 0,
          duration: 0,
        },
        timestamp: message.timestamp,
      };

      await this._sendHttpRequest(payload);
    } catch (error) {
      console.error(`[WebhookNotifier] Failed to send notification: ${error}`);
    }
  }

  private async _sendHttpRequest(payload: WebhookPayload): Promise<void> {
    try {
      const axios = await import('axios');
      await axios.default.post(this._webhookUrl, payload, {
        headers: {
          'Content-Type': 'application/json',
        },
        timeout: 10000,
      });
    } catch (error: any) {
      if (error?.code === 'MODULE_NOT_FOUND') {
        console.warn('[WebhookNotifier] axios not available, using fetch fallback');
        await this._sendWithFetch(payload);
      } else {
        throw error;
      }
    }
  }

  private async _sendWithFetch(payload: WebhookPayload): Promise<void> {
    if (typeof fetch !== 'undefined') {
      const response = await fetch(this._webhookUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
    } else {
      throw new Error('No HTTP client available. Install axios or use a browser environment.');
    }
  }

  private _buildSummary(result: TestSuiteResult): {
    total: number;
    passed: number;
    failed: number;
    skipped: number;
    passRate: number;
    duration: number;
  } {
    const passRate = result.total > 0 ? (result.passed / result.total) * 100 : 0;
    return {
      total: result.total,
      passed: result.passed,
      failed: result.failed,
      skipped: result.skipped,
      passRate,
      duration: result.duration || 0,
    };
  }
}

export class CallbackNotifier implements Notifier {
  readonly name: string = 'callback';
  private _callback: (result: TestSuiteResult) => Promise<void> | void;

  constructor(callback: (result: TestSuiteResult) => Promise<void> | void) {
    this._callback = callback;
  }

  async send(message: NotificationMessage, result?: TestSuiteResult): Promise<void> {
    if (result) {
      await this._callback(result);
    }
  }
}

export class ConsoleNotifier implements Notifier {
  readonly name: string = 'console';

  send(message: NotificationMessage): void {
    const timestamp = new Date(message.timestamp).toLocaleString('zh-CN');
    const prefix = message.type === 'success' ? '✅' : message.type === 'failure' ? '❌' : '📢';
    
    console.log(`[${timestamp}] ${prefix} ${message.title}`);
    if (message.content) {
      console.log(message.content);
    }
  }
}

export class NotificationManager {
  private _config: Required<Omit<NotificationOptions, 'notifiers' | 'callback'>> & {
    notifiers: Notifier[];
  };

  constructor(options: NotificationOptions = {}) {
    const notifiers: Notifier[] = options.notifiers || [];

    if (options.webhookUrl) {
      notifiers.push(new WebhookNotifier(options.webhookUrl, options.projectId));
    }

    if (options.callback) {
      notifiers.push(new CallbackNotifier(options.callback));
    }

    if (notifiers.length === 0) {
      notifiers.push(new ConsoleNotifier());
    }

    this._config = {
      webhookUrl: options.webhookUrl || '',
      projectId: options.projectId || '',
      channels: options.channels || [],
      onSuccess: options.onSuccess ?? true,
      onFailure: options.onFailure ?? true,
      notifiers,
    };
  }

  addNotifier(notifier: Notifier): void {
    this._config.notifiers.push(notifier);
  }

  removeNotifier(name: string): boolean {
    const index = this._config.notifiers.findIndex(n => n.name === name);
    if (index !== -1) {
      this._config.notifiers.splice(index, 1);
      return true;
    }
    return false;
  }

  async notify(result: TestSuiteResult): Promise<void> {
    const hasFailures = result.failed > 0;
    const type: NotificationType = hasFailures ? 'failure' : 'success';

    const shouldNotify = 
      (hasFailures && this._config.onFailure) ||
      (!hasFailures && this._config.onSuccess);

    if (!shouldNotify) {
      return;
    }

    const message: NotificationMessage = {
      title: hasFailures ? `测试失败 - ${result.title}` : `测试通过 - ${result.title}`,
      content: this._buildMessageContent(result),
      type,
      timestamp: Date.now(),
      data: result,
    };

    const promises = this._config.notifiers.map(n => 
      Promise.resolve(n.send(message, result))
    );

    await Promise.allSettled(promises);
  }

  async notifySuccess(result: TestSuiteResult): Promise<void> {
    if (!this._config.onSuccess) return;

    const message: NotificationMessage = {
      title: `测试通过 - ${result.title}`,
      content: this._buildMessageContent(result),
      type: 'success',
      timestamp: Date.now(),
      data: result,
    };

    const promises = this._config.notifiers.map(n => 
      Promise.resolve(n.send(message, result))
    );

    await Promise.allSettled(promises);
  }

  async notifyFailure(result: TestSuiteResult): Promise<void> {
    if (!this._config.onFailure) return;

    const message: NotificationMessage = {
      title: `测试失败 - ${result.title}`,
      content: this._buildMessageContent(result),
      type: 'failure',
      timestamp: Date.now(),
      data: result,
    };

    const promises = this._config.notifiers.map(n => 
      Promise.resolve(n.send(message, result))
    );

    await Promise.allSettled(promises);
  }

  private _buildMessageContent(result: TestSuiteResult): string {
    const passRate = result.total > 0 ? ((result.passed / result.total) * 100).toFixed(1) : '0';
    const duration = this._formatDuration(result.duration);

    const lines = [
      `套件: ${result.title}`,
      `总数: ${result.total}`,
      `通过: ${result.passed}`,
      `失败: ${result.failed}`,
      `跳过: ${result.skipped}`,
      `通过率: ${passRate}%`,
      `耗时: ${duration}`,
    ];

    const failedCases = result.results.filter(r => r.status === 'failed' || r.status === 'timeout');
    if (failedCases.length > 0) {
      lines.push('', '失败用例:');
      for (const fc of failedCases.slice(0, 10)) {
        lines.push(`  - ${fc.meta.title}`);
      }
      if (failedCases.length > 10) {
        lines.push(`  ... 还有 ${failedCases.length - 10} 个失败用例`);
      }
    }

    return lines.join('\n');
  }

  private _formatDuration(ms?: number): string {
    if (ms === undefined || ms === null) return '-';
    if (ms < 1000) return `${ms}ms`;
    if (ms < 60000) return `${(ms / 1000).toFixed(2)}s`;
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${minutes}m ${secs}s`;
  }

  get notifiers(): Notifier[] {
    return [...this._config.notifiers];
  }
}
