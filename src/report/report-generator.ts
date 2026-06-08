import * as fs from 'fs';
import * as path from 'path';
import { TestSuiteResult, TestResult, TestStep, RetryRecord, ReportConfig } from '../core/types';
import { NotificationErrorRecord } from '../core/types';
import { ReportHistoryManager } from './report-history';

export interface ReportGeneratorOptions extends ReportConfig {
  enableHistory?: boolean;
  maxHistory?: number;
  historyIndexFileName?: string;
}

export interface GeneratedReport {
  format: string;
  path: string;
  size: number;
  shareableUrl?: string;
}

export class ReportGenerator {
  private _config: Required<ReportGeneratorOptions>;
  private _historyManager?: ReportHistoryManager;

  constructor(config: ReportGeneratorOptions = {}) {
    this._config = {
      outputDir: config.outputDir || './reports',
      format: config.format || ['html', 'json'],
      includeScreenshots: config.includeScreenshots ?? true,
      shareable: config.shareable ?? false,
      shareBaseUrl: config.shareBaseUrl || '',
      reportTitle: config.reportTitle || '测试报告',
      projectName: config.projectName || 'AutoTest Platform',
      environment: config.environment || 'test',
      metadata: config.metadata || {},
      showStepDetails: config.showStepDetails ?? true,
      showScreenshots: config.showScreenshots ?? true,
      showRetryRecords: config.showRetryRecords ?? true,
      showSkipped: config.showSkipped ?? true,
      enableHistory: config.enableHistory ?? true,
      maxHistory: config.maxHistory ?? 20,
      historyIndexFileName: config.historyIndexFileName || 'index.html',
    };

    if (this._config.enableHistory) {
      this._historyManager = new ReportHistoryManager({
        outputDir: this._config.outputDir,
        maxHistory: this._config.maxHistory,
        projectName: this._config.projectName,
        environment: this._config.environment,
        shareBaseUrl: this._config.shareBaseUrl,
      });
    }
  }

  async generate(result: TestSuiteResult): Promise<GeneratedReport[]> {
    this._ensureOutputDir();

    const reportId = `report_${result.id}_${Date.now()}`;
    result.reportId = reportId;
    result.projectName = this._config.projectName;
    result.environment = this._config.environment;

    const reports: GeneratedReport[] = [];

    for (const format of this._config.format) {
      let report: GeneratedReport;

      switch (format) {
        case 'html':
          report = this._generateHtmlReport(result, reportId);
          break;
        case 'json':
          report = this._generateJsonReport(result, reportId);
          break;
        case 'markdown':
          report = this._generateMarkdownReport(result, reportId);
          break;
        default:
          continue;
      }

      if (this._config.shareable && this._config.shareBaseUrl) {
        const fileName = path.basename(report.path);
        report.shareableUrl = `${this._config.shareBaseUrl.replace(/\/$/, '')}/${fileName}`;
      }

      reports.push(report);
    }

    const reportUrls: { html?: string; json?: string; markdown?: string } = {};
    for (const r of reports) {
      const url = r.shareableUrl || r.path;
      if (r.format === 'html') reportUrls.html = url;
      if (r.format === 'json') reportUrls.json = url;
      if (r.format === 'markdown') reportUrls.markdown = url;
    }
    result.reportUrls = reportUrls;

    if (this._historyManager) {
      this._historyManager.addReport(result, reports);
    }

    return reports;
  }

  get historyManager(): ReportHistoryManager | undefined {
    return this._historyManager;
  }

  getHistory() {
    return this._historyManager?.getHistory();
  }

  getLatestReport() {
    return this._historyManager?.getLatestReport();
  }

  private _generateHtmlReport(result: TestSuiteResult, reportId: string): GeneratedReport {
    const html = this._buildHtmlReport(result);
    const filePath = path.join(this._config.outputDir!, `${reportId}.html`);

    fs.writeFileSync(filePath, html, 'utf-8');

    return {
      format: 'html',
      path: filePath,
      size: Buffer.byteLength(html, 'utf-8'),
    };
  }

  private _generateJsonReport(result: TestSuiteResult, reportId: string): GeneratedReport {
    const reportData = {
      meta: {
        reportId,
        title: this._config.reportTitle,
        project: this._config.projectName,
        environment: this._config.environment,
        generatedAt: new Date().toISOString(),
        shareable: this._config.shareable,
        ...this._config.metadata,
      },
      result,
    };

    const json = JSON.stringify(reportData, null, 2);
    const filePath = path.join(this._config.outputDir!, `${reportId}.json`);

    fs.writeFileSync(filePath, json, 'utf-8');

    return {
      format: 'json',
      path: filePath,
      size: Buffer.byteLength(json, 'utf-8'),
    };
  }

  private _generateMarkdownReport(result: TestSuiteResult, reportId: string): GeneratedReport {
    const md = this._buildMarkdownReport(result);
    const filePath = path.join(this._config.outputDir!, `${reportId}.md`);

    fs.writeFileSync(filePath, md, 'utf-8');

    return {
      format: 'markdown',
      path: filePath,
      size: Buffer.byteLength(md, 'utf-8'),
    };
  }

  private _buildHtmlReport(result: TestSuiteResult): string {
    const passRate = result.total > 0 ? ((result.passed / result.total) * 100).toFixed(1) : '0';
    const statusColor = result.failed > 0 ? '#e74c3c' : '#27ae60';
    const statusText = result.failed > 0 ? '失败' : '通过';

    const failedResults = result.results.filter(r => r.status === 'failed' || r.status === 'timeout');
    const passedResults = result.results.filter(r => r.status === 'passed');
    const skippedResults = result.skippedDetails || result.results.filter(r => r.status === 'skipped');

    const failedCasesHtml = failedResults.map(r => this._buildTestCaseHtml(r)).join('');
    const passedCasesHtml = passedResults.map(r => this._buildTestCaseHtml(r)).join('');
    const skippedCasesHtml = skippedResults.length > 0 && this._config.showSkipped
      ? skippedResults.map(r => this._buildTestCaseHtml(r)).join('')
      : '';

    const notificationErrorsHtml = (result.notificationErrors && result.notificationErrors.length > 0)
      ? this._buildNotificationErrorsHtml(result.notificationErrors)
      : '';

    const shareUrlHtml = this._config.shareable && this._config.shareBaseUrl && result.reportUrls?.html
      ? `<div>🔗 分享地址: <a href="${result.reportUrls.html}" target="_blank" style="color: #0366d6; text-decoration: none;">${result.reportUrls.html}</a></div>`
      : '';

    const historyUrlHtml = this._config.enableHistory
      ? `<div>📚 历史报告: <a href="${this._config.historyIndexFileName}" style="color: #0366d6; text-decoration: none;">查看全部历史</a></div>`
      : '';

    const filteredNoticeHtml = result.filteredByTags && result.originalTotal
      ? `<div style="margin-top: 8px; padding: 8px 12px; background: #fff3e0; border-radius: 4px; font-size: 13px; color: #e65100;">
           ⚠️ 本次按标签筛选执行，共 ${result.originalTotal} 个用例，实际参与 ${result.total} 个（已排除 ${result.originalTotal - result.total} 个未匹配标签的用例）
         </div>`
      : '';

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
    .header .meta { color: #666; font-size: 14px; line-height: 1.8; }
    .summary { display: grid; grid-template-columns: repeat(6, 1fr); gap: 16px; margin-bottom: 20px; }
    .summary-card { background: #fff; border-radius: 8px; padding: 20px; text-align: center; box-shadow: 0 2px 8px rgba(0,0,0,0.1); }
    .summary-card .value { font-size: 32px; font-weight: bold; margin-bottom: 4px; }
    .summary-card .label { font-size: 14px; color: #666; }
    .summary-card.passed .value { color: #27ae60; }
    .summary-card.failed .value { color: #e74c3c; }
    .summary-card.skipped .value { color: #95a5a6; }
    .summary-card.timeout .value { color: #e67e22; }
    .summary-card.total .value { color: #3498db; }
    .summary-card.rate .value { color: ${statusColor}; }
    .status-badge { display: inline-block; padding: 4px 12px; border-radius: 20px; font-size: 12px; font-weight: bold; color: #fff; }
    .status-badge.passed { background: #27ae60; }
    .status-badge.failed { background: #e74c3c; }
    .status-badge.skipped { background: #95a5a6; }
    .status-badge.timeout { background: #e67e22; }
    .section { background: #fff; border-radius: 8px; padding: 20px; margin-bottom: 20px; box-shadow: 0 2px 8px rgba(0,0,0,0.1); }
    .section h2 { font-size: 18px; margin-bottom: 16px; display: flex; align-items: center; gap: 10px; }
    .section .count { background: #e1ecf4; color: #39739d; padding: 2px 10px; border-radius: 12px; font-size: 13px; font-weight: normal; }
    .test-case { border: 1px solid #e1e4e8; border-radius: 6px; margin-bottom: 12px; overflow: hidden; }
    .test-case-header { padding: 16px; background: #fafbfc; display: flex; justify-content: space-between; align-items: center; cursor: pointer; user-select: none; }
    .test-case-header:hover { background: #f0f3f6; }
    .test-case-title { display: flex; align-items: center; gap: 12px; flex: 1; min-width: 0; }
    .test-case-title h3 { font-size: 15px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .test-case-meta { font-size: 12px; color: #666; display: flex; gap: 16px; align-items: center; flex-shrink: 0; }
    .test-case-body { padding: 16px; display: none; border-top: 1px solid #e1e4e8; background: #fff; }
    .test-case.open .test-case-body { display: block; }
    .data-set-badge { background: #e8f5e9; color: #2e7d32; padding: 2px 8px; border-radius: 3px; font-size: 11px; }
    .steps { margin-top: 12px; }
    .step { border-left: 3px solid #ddd; margin-bottom: 8px; background: #fafbfc; }
    .step.passed { border-left-color: #27ae60; }
    .step.failed { border-left-color: #e74c3c; }
    .step.timeout { border-left-color: #e67e22; }
    .step-header { padding: 10px 14px; display: flex; justify-content: space-between; align-items: center; cursor: pointer; user-select: none; }
    .step-header:hover { background: #f0f3f6; }
    .step-name { font-weight: 600; font-size: 13px; }
    .step-duration { font-size: 11px; color: #999; }
    .step-body { padding: 12px 14px; display: none; border-top: 1px solid #e8ecef; font-size: 12px; }
    .step.open .step-body { display: block; }
    .step-section { margin-bottom: 10px; }
    .step-section:last-child { margin-bottom: 0; }
    .step-section-title { font-weight: 600; color: #555; margin-bottom: 4px; font-size: 11px; text-transform: uppercase; }
    .step-section-content { background: #f6f8fa; padding: 8px 10px; border-radius: 4px; font-family: 'Monaco', 'Consolas', monospace; font-size: 11px; white-space: pre-wrap; word-break: break-all; }
    .step-section-content.expected { background: #e8f5e9; color: #2e7d32; }
    .step-section-content.actual { background: #ffebee; color: #c62828; }
    .assert-diff { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
    .error-box { background: #fee; border: 1px solid #fcc; border-radius: 4px; padding: 12px; margin-top: 8px; font-family: 'Monaco', 'Consolas', monospace; font-size: 12px; white-space: pre-wrap; word-break: break-all; color: #c0392b; }
    .retry-section { margin-top: 12px; padding: 12px; background: #fff8e1; border-radius: 4px; border: 1px solid #ffe082; }
    .retry-section h4 { font-size: 13px; color: #f57f17; margin-bottom: 8px; }
    .retry-item { padding: 8px; background: #fff; border-radius: 4px; margin-bottom: 6px; font-size: 12px; }
    .retry-item .attempt { font-weight: bold; color: #e65100; }
    .tags { display: flex; gap: 6px; flex-wrap: wrap; margin-top: 8px; }
    .tag { background: #e1ecf4; color: #39739d; padding: 2px 8px; border-radius: 3px; font-size: 11px; }
    .priority { display: inline-block; padding: 2px 8px; border-radius: 3px; font-size: 11px; font-weight: bold; }
    .priority.critical { background: #ffebee; color: #c62828; }
    .priority.high { background: #fff3e0; color: #e65100; }
    .priority.medium { background: #fff8e1; color: #f57f17; }
    .priority.low { background: #e8f5e9; color: #2e7d32; }
    .screenshot-thumb { max-width: 200px; max-height: 150px; border: 1px solid #ddd; border-radius: 4px; cursor: pointer; }
    .notification-error { background: #fff3e0; border-left: 4px solid #ff9800; padding: 10px 14px; margin-bottom: 8px; font-size: 13px; }
    .notification-error .name { font-weight: bold; color: #e65100; }
    .notification-error .msg { color: #666; margin-top: 4px; font-size: 12px; }
    .toggle-icon { transition: transform 0.2s; font-size: 12px; color: #999; }
    .test-case.open .toggle-icon { transform: rotate(90deg); }
    .step.open .toggle-icon { transform: rotate(90deg); }
    .tabs { display: flex; gap: 0; margin-bottom: 16px; border-bottom: 2px solid #e1e4e8; }
    .tab { padding: 10px 20px; cursor: pointer; font-size: 14px; color: #666; border-bottom: 2px solid transparent; margin-bottom: -2px; }
    .tab.active { color: #0366d6; border-bottom-color: #0366d6; font-weight: 600; }
    .tab:hover { color: #0366d6; }
    .tab-content { display: none; }
    .tab-content.active { display: block; }
    .fail-summary-card { background: #fff5f5; border: 1px solid #feb2b2; border-radius: 6px; padding: 12px; margin-bottom: 12px; }
    .fail-summary-card h4 { color: #c53030; font-size: 13px; margin-bottom: 8px; }
    .fail-summary-item { font-size: 12px; color: #742a2a; margin-bottom: 4px; }
    .fail-summary-item strong { color: #c53030; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>${this._config.reportTitle}</h1>
      <div class="meta">
        <div>📦 项目: ${this._config.projectName} | 🌍 环境: ${this._config.environment}</div>
        <div>📋 套件: ${result.title} | 📅 生成时间: ${new Date().toLocaleString('zh-CN')}</div>
        <div>⏱️ 总耗时: ${this._formatDuration(result.duration)} | 报告ID: ${result.reportId || '-'}</div>
        ${shareUrlHtml}
        ${historyUrlHtml}
      </div>
      ${filteredNoticeHtml}
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
      <div class="summary-card timeout">
        <div class="value">${result.timeout || 0}</div>
        <div class="label">超时</div>
      </div>
      <div class="summary-card skipped">
        <div class="value">${result.skipped}</div>
        <div class="label">跳过</div>
      </div>
      <div class="summary-card rate">
        <div class="value">${passRate}%</div>
        <div class="label">通过率</div>
      </div>
    </div>

    ${notificationErrorsHtml}

    <div class="section">
      <div class="tabs">
        <div class="tab active" onclick="switchTab('failed', this)">❌ 失败 (${failedResults.length})</div>
        <div class="tab" onclick="switchTab('passed', this)">✅ 通过 (${passedResults.length})</div>
        ${this._config.showSkipped && skippedResults.length > 0 ? `<div class="tab" onclick="switchTab('skipped', this)">⏭️ 跳过 (${skippedResults.length})</div>` : ''}
        <div class="tab" onclick="switchTab('all', this)">📋 全部 (${result.results.length})</div>
      </div>

      <div id="tab-failed" class="tab-content active">
        ${failedResults.length > 0 ? failedCasesHtml : '<p style="color: #666; text-align: center; padding: 20px;">没有失败的用例 🎉</p>'}
      </div>

      <div id="tab-passed" class="tab-content">
        ${passedResults.length > 0 ? passedCasesHtml : '<p style="color: #666; text-align: center; padding: 20px;">没有通过的用例</p>'}
      </div>

      ${this._config.showSkipped && skippedResults.length > 0 ? `
      <div id="tab-skipped" class="tab-content">
        ${skippedCasesHtml}
      </div>` : ''}

      <div id="tab-all" class="tab-content">
        ${result.results.map(r => this._buildTestCaseHtml(r)).join('')}
      </div>
    </div>
  </div>

  <script>
    function switchTab(tabName, el) {
      document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
      document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
      el.classList.add('active');
      document.getElementById('tab-' + tabName).classList.add('active');
    }

    function toggleTestCase(el) {
      el.closest('.test-case').classList.toggle('open');
    }

    function toggleStep(el) {
      el.closest('.step').classList.toggle('open');
    }
  </script>
</body>
</html>`;
  }

  private _buildTestCaseHtml(result: TestResult): string {
    const tagsHtml = result.meta.tags.map(t => `<span class="tag">${t}</span>`).join('');
    const priorityClass = `priority ${result.meta.priority}`;

    const dataSetHtml = result.dataSet
      ? `<span class="data-set-badge" title="${this._escapeHtml(result.dataSet.summary)}">${result.dataSet.name}</span>`
      : '';

    const stepsHtml = this._config.showStepDetails
      ? result.steps.map(s => this._buildStepHtml(s)).join('')
      : '';

    const errorHtml = result.error
      ? `<div class="error-box">
          <strong>${this._escapeHtml(result.error.name)}: ${this._escapeHtml(result.error.message)}</strong>
          ${result.error.stack ? `\n${this._escapeHtml(result.error.stack)}` : ''}
        </div>`
      : '';

    const retryHtml = this._config.showRetryRecords && result.retryRecords && result.retryRecords.length > 0
      ? this._buildRetryRecordsHtml(result.retryRecords)
      : '';

    const screenshotHtml = this._config.showScreenshots && result.screenshots.length > 0
      ? this._buildScreenshotsHtml(result.screenshots)
      : '';

    const dataSummaryHtml = result.dataSet
      ? `<div class="step-section">
          <div class="step-section-title">测试数据</div>
          <div class="step-section-content">${this._escapeHtml(result.dataSet.summary)}</div>
        </div>`
      : '';

    const failSummaryHtml = (result.status === 'failed' || result.status === 'timeout')
      ? this._buildFailSummaryCard(result)
      : '';

    return `
    <div class="test-case ${result.status}">
      <div class="test-case-header" onclick="toggleTestCase(this)">
        <div class="test-case-title">
          <span class="toggle-icon">▶</span>
          <span class="status-badge ${result.status}">${this._getStatusText(result.status)}</span>
          <h3>${this._escapeHtml(result.meta.title)}</h3>
          ${dataSetHtml}
          <span class="${priorityClass}">${result.meta.priority}</span>
        </div>
        <div class="test-case-meta">
          <span>⏱️ ${this._formatDuration(result.duration)}</span>
          <span>🔄 ${result.retryCount}次重试</span>
          <span>📝 ${result.steps.length}步骤</span>
        </div>
      </div>
      <div class="test-case-body">
        <div class="tags">${tagsHtml}</div>
        ${result.meta.description ? `<p style="margin-top: 8px; color: #666; font-size: 13px;">${this._escapeHtml(result.meta.description)}</p>` : ''}
        ${failSummaryHtml}
        ${dataSummaryHtml}
        ${errorHtml}
        ${retryHtml}
        ${screenshotHtml}
        ${stepsHtml ? `<div class="steps"><h4 style="margin-bottom: 8px; font-size: 13px;">📋 步骤详情 (${result.steps.length})</h4>${stepsHtml}</div>` : ''}
      </div>
    </div>`;
  }

  private _buildFailSummaryCard(result: TestResult): string {
    const failedStep = result.steps.find(s => s.status === 'failed' || s.status === 'timeout');
    const dataSummary = result.dataSet?.summary || '-';
    const errorName = result.error?.name || '-';
    const errorMsg = result.error?.message || '-';

    return `
    <div class="fail-summary-card">
      <h4>⚠️ 失败摘要</h4>
      <div class="fail-summary-item"><strong>失败步骤:</strong> ${failedStep ? this._escapeHtml(failedStep.name) : '-'}</div>
      <div class="fail-summary-item"><strong>错误类型:</strong> ${this._escapeHtml(errorName)}</div>
      <div class="fail-summary-item"><strong>错误信息:</strong> ${this._escapeHtml(errorMsg)}</div>
      ${result.dataSet ? `<div class="fail-summary-item"><strong>测试数据:</strong> <code>${this._escapeHtml(dataSummary)}</code></div>` : ''}
      ${result.retryCount > 0 ? `<div class="fail-summary-item"><strong>重试次数:</strong> ${result.retryCount} 次</div>` : ''}
    </div>`;
  }

  private _buildStepHtml(step: TestStep): string {
    const inputHtml = step.input !== undefined
      ? `<div class="step-section">
          <div class="step-section-title">输入/参数</div>
          <div class="step-section-content">${this._formatJson(step.input)}</div>
        </div>`
      : '';

    const outputHtml = step.output !== undefined
      ? `<div class="step-section">
          <div class="step-section-title">输出/结果</div>
          <div class="step-section-content">${this._formatJson(step.output)}</div>
        </div>`
      : '';

    const hasAssertDiff = step.error && step.error.expected !== undefined && step.error.actual !== undefined;
    const assertDiffHtml = hasAssertDiff
      ? `<div class="step-section">
          <div class="step-section-title" style="color: #c0392b;">断言对比</div>
          <div class="assert-diff">
            <div>
              <div class="step-section-title" style="color: #2e7d32;">预期值</div>
              <div class="step-section-content expected">${this._formatJson(step.error!.expected)}</div>
            </div>
            <div>
              <div class="step-section-title" style="color: #c62828;">实际值</div>
              <div class="step-section-content actual">${this._formatJson(step.error!.actual)}</div>
            </div>
          </div>
        </div>`
      : '';

    const errorHtml = step.error
      ? `<div class="step-section">
          <div class="step-section-title" style="color: #c0392b;">错误</div>
          <div class="step-section-content" style="background: #fee; color: #c0392b;">
            ${this._escapeHtml(step.error.name)}: ${this._escapeHtml(step.error.message)}
          </div>
        </div>`
      : '';

    const logsHtml = step.logs && step.logs.length > 0
      ? `<div class="step-section">
          <div class="step-section-title">日志 (${step.logs.length})</div>
          <div class="step-section-content">${step.logs.map(l => `[${new Date(l.timestamp).toLocaleTimeString()}] [${l.level.toUpperCase()}] ${this._escapeHtml(l.message)}`).join('\n')}</div>
        </div>`
      : '';

    const screenshotHtml = step.screenshot
      ? `<div class="step-section">
          <div class="step-section-title">截图</div>
          <img src="${step.screenshot}" class="screenshot-thumb" alt="screenshot" onclick="window.open('${step.screenshot}')"/>
        </div>`
      : '';

    const hasDetails = step.input !== undefined || step.output !== undefined || step.error ||
      (step.logs && step.logs.length > 0) || step.screenshot || hasAssertDiff;

    return `
    <div class="step ${step.status}">
      <div class="step-header" onclick="toggleStep(this)">
        <span class="step-name">
          <span class="toggle-icon" style="margin-right: 6px;">${hasDetails ? '▶' : ''}</span>
          ${this._escapeHtml(step.name)}
        </span>
        <span class="step-duration">${this._formatDuration(step.duration)}</span>
      </div>
      ${hasDetails ? `<div class="step-body">
        ${inputHtml}
        ${outputHtml}
        ${assertDiffHtml}
        ${errorHtml}
        ${logsHtml}
        ${screenshotHtml}
      </div>` : ''}
    </div>`;
  }

  private _buildRetryRecordsHtml(records: RetryRecord[]): string {
    const items = records.map(r => `
      <div class="retry-item">
        <span class="attempt">第 ${r.attempt} 次重试</span>
        <span style="color: #999; margin-left: 10px;">${new Date(r.timestamp).toLocaleTimeString()}</span>
        <div style="margin-top: 6px; color: #c0392b; font-family: monospace; font-size: 11px;">
          ${this._escapeHtml(r.error.name)}: ${this._escapeHtml(r.error.message)}
        </div>
      </div>
    `).join('');

    return `
    <div class="retry-section">
      <h4>🔄 重试记录 (${records.length} 次)</h4>
      ${items}
    </div>`;
  }

  private _buildScreenshotsHtml(screenshots: string[]): string {
    const thumbs = screenshots.map(s => `
      <img src="${s}" class="screenshot-thumb" alt="screenshot" onclick="window.open('${s}')" style="margin-right: 10px; margin-bottom: 10px;"/>
    `).join('');

    return `<div style="margin-top: 12px;">
      <h4 style="font-size: 13px; margin-bottom: 8px;">📸 截图 (${screenshots.length})</h4>
      ${thumbs}
    </div>`;
  }

  private _buildNotificationErrorsHtml(errors: NotificationErrorRecord[]): string {
    const items = errors.map(e => `
      <div class="notification-error">
        <div class="name">⚠️ 通知失败 - ${this._escapeHtml(e.notifierName)}</div>
        <div class="msg">${this._escapeHtml(e.error)}</div>
        <div class="msg" style="color: #999;">时间: ${new Date(e.timestamp).toLocaleString('zh-CN')}</div>
      </div>
    `).join('');

    return `<div class="section">
      <h2>⚠️ 通知异常 <span class="count">${errors.length}</span></h2>
      ${items}
    </div>`;
  }

  private _buildMarkdownReport(result: TestSuiteResult): string {
    const passRate = result.total > 0 ? ((result.passed / result.total) * 100).toFixed(1) : '0';

    let md = `# ${this._config.reportTitle}\n\n`;
    md += `- **项目**: ${this._config.projectName}\n`;
    md += `- **环境**: ${this._config.environment}\n`;
    md += `- **套件**: ${result.title}\n`;
    md += `- **生成时间**: ${new Date().toLocaleString('zh-CN')}\n`;
    md += `- **总耗时**: ${this._formatDuration(result.duration)}\n`;
    md += `- **报告ID**: ${result.reportId || '-'}\n`;
    if (result.reportUrls?.html) {
      md += `- **HTML 报告**: ${result.reportUrls.html}\n`;
    }
    if (result.reportUrls?.json) {
      md += `- **JSON 报告**: ${result.reportUrls.json}\n`;
    }
    if (result.reportUrls?.markdown) {
      md += `- **Markdown 报告**: ${result.reportUrls.markdown}\n`;
    }
    if (this._config.enableHistory) {
      md += `- **历史报告**: ${this._config.historyIndexFileName}\n`;
    }
    md += `\n`;

    if (result.filteredByTags && result.originalTotal) {
      md += `> ⚠️ 本次按标签筛选执行，共 **${result.originalTotal}** 个用例，实际参与 **${result.total}** 个（已排除 ${result.originalTotal - result.total} 个未匹配标签的用例）\n\n`;
    }

    md += `## 概览\n\n`;
    md += `| 指标 | 数值 |\n`;
    md += `|------|------|\n`;
    md += `| 总数 | ${result.total} |\n`;
    md += `| ✅ 通过 | ${result.passed} |\n`;
    md += `| ❌ 失败 | ${result.failed} |\n`;
    md += `| ⏰ 超时 | ${result.timeout || 0} |\n`;
    md += `| ⏭️ 跳过 | ${result.skipped} |\n`;
    md += `| 📊 通过率 | ${passRate}% |\n\n`;

    if (result.notificationErrors && result.notificationErrors.length > 0) {
      md += `## ⚠️ 通知异常\n\n`;
      for (const e of result.notificationErrors) {
        md += `- **${e.notifierName}**: ${e.error}\n`;
      }
      md += `\n`;
    }

    const failedResults = result.results.filter(r => r.status === 'failed' || r.status === 'timeout');
    const passedResults = result.results.filter(r => r.status === 'passed');
    const skippedResults = result.skippedDetails || result.results.filter(r => r.status === 'skipped');

    if (failedResults.length > 0) {
      md += `## ❌ 失败用例 (${failedResults.length})\n\n`;
      for (const r of failedResults) {
        md += this._buildTestCaseMarkdown(r);
      }
    }

    if (passedResults.length > 0) {
      md += `## ✅ 通过用例 (${passedResults.length})\n\n`;
      for (const r of passedResults.slice(0, 20)) {
        md += `- ${this._getStatusIcon(r.status)} **${r.meta.title}** - ${this._formatDuration(r.duration)}\n`;
      }
      if (passedResults.length > 20) {
        md += `- ... 还有 ${passedResults.length - 20} 个用例\n`;
      }
      md += `\n`;
    }

    if (this._config.showSkipped && skippedResults.length > 0) {
      md += `## ⏭️ 跳过用例 (${skippedResults.length})\n\n`;
      for (const r of skippedResults) {
        md += `- ⏭️ **${r.meta.title}**\n`;
        if (r.meta.description) {
          md += `  - ${r.meta.description}\n`;
        }
      }
      md += `\n`;
    }

    return md;
  }

  private _buildTestCaseMarkdown(result: TestResult): string {
    let md = `### ${this._getStatusIcon(result.status)} ${result.meta.title}\n\n`;
    md += `- **状态**: ${this._getStatusText(result.status)}\n`;
    md += `- **优先级**: ${result.meta.priority}\n`;
    md += `- **耗时**: ${this._formatDuration(result.duration)}\n`;
    md += `- **重试次数**: ${result.retryCount}\n`;
    if (result.meta.tags.length > 0) {
      md += `- **标签**: ${result.meta.tags.join(', ')}\n`;
    }
    if (result.dataSet) {
      md += `- **数据集**: ${result.dataSet.name}\n`;
      md += `- **数据摘要**: \`${result.dataSet.summary}\`\n`;
    }
    if (result.meta.description) {
      md += `- **描述**: ${result.meta.description}\n`;
    }
    md += `\n`;

    if (result.error) {
      md += `#### ❌ 错误信息\n\n`;
      md += `\`\`\`\n${result.error.name}: ${result.error.message}\n${result.error.stack || ''}\n\`\`\`\n\n`;
    }

    if (this._config.showRetryRecords && result.retryRecords && result.retryRecords.length > 0) {
      md += `#### 🔄 重试记录\n\n`;
      for (const record of result.retryRecords) {
        md += `- **第 ${record.attempt} 次**: ${record.error.name} - ${record.error.message}\n`;
      }
      md += `\n`;
    }

    if (this._config.showStepDetails && result.steps.length > 0) {
      md += `#### 步骤详情\n\n`;
      md += `| 步骤 | 状态 | 耗时 | 说明 |\n`;
      md += `|------|------|------|------|\n`;
      for (const step of result.steps) {
        md += `| ${step.name} | ${this._getStatusIcon(step.status)} ${this._getStatusText(step.status)} | ${this._formatDuration(step.duration)} | ${step.description || '-'} |\n`;
      }
      md += `\n`;
    }

    return md;
  }

  private _formatJson(value: any): string {
    try {
      if (typeof value === 'string') return this._escapeHtml(value);
      return this._escapeHtml(JSON.stringify(value, null, 2));
    } catch {
      return this._escapeHtml(String(value));
    }
  }

  private _escapeHtml(text: string): string {
    if (text === null || text === undefined) return '';
    return String(text)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
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
