import * as fs from 'fs';
import * as path from 'path';
import { TestSuiteResult, TestResult, TestStep } from '../core/types';
import { ReportConfig } from '../core/types';

export interface ReportGeneratorOptions extends ReportConfig {
  reportTitle?: string;
  projectName?: string;
  environment?: string;
  metadata?: Record<string, any>;
}

export interface GeneratedReport {
  format: string;
  path: string;
  size: number;
  shareableUrl?: string;
}

export class ReportGenerator {
  private _config: Required<ReportGeneratorOptions>;

  constructor(config: ReportGeneratorOptions = {}) {
    this._config = {
      outputDir: config.outputDir || './reports',
      format: config.format || ['html', 'json'],
      includeScreenshots: config.includeScreenshots ?? true,
      shareable: config.shareable ?? false,
      reportTitle: config.reportTitle || '测试报告',
      projectName: config.projectName || 'AutoTest Platform',
      environment: config.environment || 'test',
      metadata: config.metadata || {},
    };
  }

  async generate(result: TestSuiteResult): Promise<GeneratedReport[]> {
    this._ensureOutputDir();

    const reports: GeneratedReport[] = [];

    for (const format of this._config.format) {
      let report: GeneratedReport;
      
      switch (format) {
        case 'html':
          report = this._generateHtmlReport(result);
          break;
        case 'json':
          report = this._generateJsonReport(result);
          break;
        case 'markdown':
          report = this._generateMarkdownReport(result);
          break;
        default:
          continue;
      }

      reports.push(report);
    }

    return reports;
  }

  private _generateHtmlReport(result: TestSuiteResult): GeneratedReport {
    const html = this._buildHtmlReport(result);
    const filePath = path.join(
      this._config.outputDir!,
      `report_${result.id}_${Date.now()}.html`
    );
    
    fs.writeFileSync(filePath, html, 'utf-8');
    
    return {
      format: 'html',
      path: filePath,
      size: Buffer.byteLength(html, 'utf-8'),
    };
  }

  private _generateJsonReport(result: TestSuiteResult): GeneratedReport {
    const reportData = {
      meta: {
        title: this._config.reportTitle,
        project: this._config.projectName,
        environment: this._config.environment,
        generatedAt: new Date().toISOString(),
        ...this._config.metadata,
      },
      result,
    };

    const json = JSON.stringify(reportData, null, 2);
    const filePath = path.join(
      this._config.outputDir!,
      `report_${result.id}_${Date.now()}.json`
    );
    
    fs.writeFileSync(filePath, json, 'utf-8');
    
    return {
      format: 'json',
      path: filePath,
      size: Buffer.byteLength(json, 'utf-8'),
    };
  }

  private _generateMarkdownReport(result: TestSuiteResult): GeneratedReport {
    const md = this._buildMarkdownReport(result);
    const filePath = path.join(
      this._config.outputDir!,
      `report_${result.id}_${Date.now()}.md`
    );
    
    fs.writeFileSync(filePath, md, 'utf-8');
    
    return {
      format: 'markdown',
      path: filePath,
      size: Buffer.byteLength(md, 'utf-8'),
    };
  }

  private _buildHtmlReport(result: TestSuiteResult): string {
    const passedRate = result.total > 0 ? ((result.passed / result.total) * 100).toFixed(1) : '0';
    const statusColor = result.failed > 0 ? '#e74c3c' : '#27ae60';
    const statusText = result.failed > 0 ? '失败' : '通过';

    const testCasesHtml = result.results.map(r => this._buildTestCaseHtml(r)).join('');

    return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${this._config.reportTitle}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #f5f7fa; color: #333; padding: 20px; }
    .container { max-width: 1200px; margin: 0 auto; }
    .header { background: #fff; border-radius: 8px; padding: 24px; margin-bottom: 20px; box-shadow: 0 2px 8px rgba(0,0,0,0.1); }
    .header h1 { font-size: 24px; margin-bottom: 8px; }
    .header .meta { color: #666; font-size: 14px; }
    .summary { display: grid; grid-template-columns: repeat(5, 1fr); gap: 16px; margin-bottom: 20px; }
    .summary-card { background: #fff; border-radius: 8px; padding: 20px; text-align: center; box-shadow: 0 2px 8px rgba(0,0,0,0.1); }
    .summary-card .value { font-size: 32px; font-weight: bold; margin-bottom: 4px; }
    .summary-card .label { font-size: 14px; color: #666; }
    .summary-card.passed .value { color: #27ae60; }
    .summary-card.failed .value { color: #e74c3c; }
    .summary-card.skipped .value { color: #95a5a6; }
    .summary-card.total .value { color: #3498db; }
    .summary-card.rate .value { color: ${statusColor}; }
    .status-badge { display: inline-block; padding: 4px 12px; border-radius: 20px; font-size: 12px; font-weight: bold; color: #fff; }
    .status-badge.passed { background: #27ae60; }
    .status-badge.failed { background: #e74c3c; }
    .status-badge.skipped { background: #95a5a6; }
    .status-badge.timeout { background: #e67e22; }
    .test-cases { background: #fff; border-radius: 8px; padding: 20px; box-shadow: 0 2px 8px rgba(0,0,0,0.1); }
    .test-cases h2 { font-size: 18px; margin-bottom: 16px; }
    .test-case { border: 1px solid #e1e4e8; border-radius: 6px; margin-bottom: 12px; overflow: hidden; }
    .test-case-header { padding: 16px; background: #fafbfc; display: flex; justify-content: space-between; align-items: center; cursor: pointer; }
    .test-case-header:hover { background: #f0f3f6; }
    .test-case-title { display: flex; align-items: center; gap: 12px; }
    .test-case-title h3 { font-size: 16px; }
    .test-case-meta { font-size: 12px; color: #666; }
    .test-case-body { padding: 16px; display: none; border-top: 1px solid #e1e4e8; }
    .test-case.open .test-case-body { display: block; }
    .steps { margin-top: 12px; }
    .step { padding: 12px; border-left: 3px solid #ddd; margin-bottom: 8px; background: #fafbfc; }
    .step.passed { border-left-color: #27ae60; }
    .step.failed { border-left-color: #e74c3c; }
    .step-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px; }
    .step-name { font-weight: 600; }
    .step-duration { font-size: 12px; color: #999; }
    .step-details { font-size: 13px; color: #666; }
    .error-box { background: #fee; border: 1px solid #fcc; border-radius: 4px; padding: 12px; margin-top: 8px; font-family: monospace; font-size: 12px; white-space: pre-wrap; word-break: break-all; }
    .tags { display: flex; gap: 6px; flex-wrap: wrap; }
    .tag { background: #e1ecf4; color: #39739d; padding: 2px 8px; border-radius: 3px; font-size: 11px; }
    .priority { display: inline-block; padding: 2px 8px; border-radius: 3px; font-size: 11px; font-weight: bold; }
    .priority.critical { background: #ffebee; color: #c62828; }
    .priority.high { background: #fff3e0; color: #e65100; }
    .priority.medium { background: #fff8e1; color: #f57f17; }
    .priority.low { background: #e8f5e9; color: #2e7d32; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>${this._config.reportTitle}</h1>
      <div class="meta">
        项目: ${this._config.projectName} | 环境: ${this._config.environment} | 
        套件: ${result.title} | 生成时间: ${new Date().toLocaleString('zh-CN')}
      </div>
    </div>

    <div class="summary">
      <div class="summary-card total">
        <div class="value">${result.total}</div>
        <div class="label">总数</div>
      </div>
      <div class="summary-card passed">
        <div class="value">${result.passed}</div>
        <div class="label">通过</div>
      </div>
      <div class="summary-card failed">
        <div class="value">${result.failed}</div>
        <div class="label">失败</div>
      </div>
      <div class="summary-card skipped">
        <div class="value">${result.skipped}</div>
        <div class="label">跳过</div>
      </div>
      <div class="summary-card rate">
        <div class="value">${passedRate}%</div>
        <div class="label">通过率</div>
      </div>
    </div>

    <div class="test-cases">
      <h2>测试用例详情</h2>
      ${testCasesHtml}
    </div>
  </div>
  <script>
    document.querySelectorAll('.test-case-header').forEach(header => {
      header.addEventListener('click', () => {
        header.parentElement.classList.toggle('open');
      });
    });
  </script>
</body>
</html>`;
  }

  private _buildTestCaseHtml(result: TestResult): string {
    const stepsHtml = result.steps.map(s => this._buildStepHtml(s)).join('');
    const tagsHtml = result.meta.tags.map(t => `<span class="tag">${t}</span>`).join('');
    const priorityClass = `priority ${result.meta.priority}`;
    const errorHtml = result.error ? `
      <div class="error-box">
        <strong>${result.error.name}: ${result.error.message}</strong>
        ${result.error.stack ? `\n${result.error.stack}` : ''}
      </div>
    ` : '';

    return `
    <div class="test-case ${result.status}">
      <div class="test-case-header">
        <div class="test-case-title">
          <span class="status-badge ${result.status}">${this._getStatusText(result.status)}</span>
          <h3>${result.meta.title}</h3>
          <span class="${priorityClass}">${result.meta.priority}</span>
        </div>
        <div class="test-case-meta">
          ${this._formatDuration(result.duration)} | 重试: ${result.retryCount}次
        </div>
      </div>
      <div class="test-case-body">
        <div class="tags">${tagsHtml}</div>
        ${result.meta.description ? `<p style="margin-top: 8px; color: #666;">${result.meta.description}</p>` : ''}
        ${errorHtml}
        <div class="steps">
          <h4 style="margin-bottom: 8px; font-size: 14px;">步骤 (${result.steps.length})</h4>
          ${stepsHtml}
        </div>
      </div>
    </div>`;
  }

  private _buildStepHtml(step: TestStep): string {
    const errorHtml = step.error ? `
      <div class="error-box">
        ${step.error.name}: ${step.error.message}
      </div>
    ` : '';

    return `
    <div class="step ${step.status}">
      <div class="step-header">
        <span class="step-name">${step.name}</span>
        <span class="step-duration">${this._formatDuration(step.duration)}</span>
      </div>
      ${step.description ? `<div class="step-details">${step.description}</div>` : ''}
      ${errorHtml}
    </div>`;
  }

  private _buildMarkdownReport(result: TestSuiteResult): string {
    const passedRate = result.total > 0 ? ((result.passed / result.total) * 100).toFixed(1) : '0';

    let md = `# ${this._config.reportTitle}\n\n`;
    md += `- **项目**: ${this._config.projectName}\n`;
    md += `- **环境**: ${this._config.environment}\n`;
    md += `- **套件**: ${result.title}\n`;
    md += `- **生成时间**: ${new Date().toLocaleString('zh-CN')}\n`;
    md += `- **总耗时**: ${this._formatDuration(result.duration)}\n\n`;

    md += `## 概览\n\n`;
    md += `| 指标 | 数值 |\n`;
    md += `|------|------|\n`;
    md += `| 总数 | ${result.total} |\n`;
    md += `| ✅ 通过 | ${result.passed} |\n`;
    md += `| ❌ 失败 | ${result.failed} |\n`;
    md += `| ⏭️ 跳过 | ${result.skipped} |\n`;
    md += `| 📊 通过率 | ${passedRate}% |\n\n`;

    md += `## 测试用例\n\n`;

    for (const r of result.results) {
      const statusIcon = this._getStatusIcon(r.status);
      md += `### ${statusIcon} ${r.meta.title}\n\n`;
      md += `- **状态**: ${this._getStatusText(r.status)}\n`;
      md += `- **优先级**: ${r.meta.priority}\n`;
      md += `- **耗时**: ${this._formatDuration(r.duration)}\n`;
      md += `- **重试次数**: ${r.retryCount}\n`;
      if (r.meta.tags.length > 0) {
        md += `- **标签**: ${r.meta.tags.join(', ')}\n`;
      }
      if (r.meta.description) {
        md += `- **描述**: ${r.meta.description}\n`;
      }
      md += `\n`;

      if (r.error) {
        md += `#### ❌ 错误信息\n\n`;
        md += `\`\`\`\n${r.error.name}: ${r.error.message}\n${r.error.stack || ''}\n\`\`\`\n\n`;
      }

      if (r.steps.length > 0) {
        md += `#### 步骤详情\n\n`;
        md += `| 步骤 | 状态 | 耗时 | 说明 |\n`;
        md += `|------|------|------|------|\n`;
        for (const step of r.steps) {
          const stepIcon = this._getStatusIcon(step.status);
          md += `| ${step.name} | ${stepIcon} ${this._getStatusText(step.status)} | ${this._formatDuration(step.duration)} | ${step.description || '-'} |\n`;
        }
        md += `\n`;
      }
    }

    return md;
  }

  private _getStatusText(status: string): string {
    const map: Record<string, string> = {
      passed: '通过',
      failed: '失败',
      skipped: '跳过',
      pending: '待执行',
      running: '执行中',
      timeout: '超时',
    };
    return map[status] || status;
  }

  private _getStatusIcon(status: string): string {
    const map: Record<string, string> = {
      passed: '✅',
      failed: '❌',
      skipped: '⏭️',
      pending: '⏳',
      running: '🔄',
      timeout: '⏰',
    };
    return map[status] || '❓';
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

  private _ensureOutputDir(): void {
    const dir = this._config.outputDir!;
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  }

  static async generate(result: TestSuiteResult, config?: ReportGeneratorOptions): Promise<GeneratedReport[]> {
    const generator = new ReportGenerator(config);
    return generator.generate(result);
  }
}
