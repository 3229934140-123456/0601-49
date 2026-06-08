import * as fs from 'fs';
import * as path from 'path';
import { TestSuiteResult, ReportHistoryEntry, ReportHistoryIndex, GeneratedReport } from '../core/types';

export interface ReportHistoryConfig {
  outputDir?: string;
  maxHistory?: number;
  projectName?: string;
  environment?: string;
  shareBaseUrl?: string;
}

const HISTORY_INDEX_FILE = 'history.json';
const INDEX_HTML_FILE = 'index.html';

export class ReportHistoryManager {
  private _config: Required<ReportHistoryConfig>;

  constructor(config: ReportHistoryConfig = {}) {
    this._config = {
      outputDir: config.outputDir || './reports',
      maxHistory: config.maxHistory ?? 20,
      projectName: config.projectName || 'AutoTest Platform',
      environment: config.environment || 'test',
      shareBaseUrl: config.shareBaseUrl || '',
    };
  }

  addReport(result: TestSuiteResult, reports: GeneratedReport[]): ReportHistoryEntry {
    this._ensureOutputDir();

    const reportUrls: { html?: string; json?: string; markdown?: string } = {};
    for (const r of reports) {
      const url = r.shareableUrl || r.path;
      if (r.format === 'html') reportUrls.html = url;
      if (r.format === 'json') reportUrls.json = url;
      if (r.format === 'markdown') reportUrls.markdown = url;
    }

    const passRate = result.total > 0 ? (result.passed / result.total) * 100 : 0;
    const failedCaseNames = result.results
      .filter(r => r.status === 'failed' || r.status === 'timeout')
      .map(r => r.meta.title);

    const entry: ReportHistoryEntry = {
      reportId: result.reportId || `report_${result.id}_${Date.now()}`,
      suiteTitle: result.title,
      suiteId: result.id,
      startTime: result.startTime,
      endTime: result.endTime || result.startTime,
      duration: result.duration || 0,
      total: result.total,
      passed: result.passed,
      failed: result.failed,
      skipped: result.skipped,
      timeout: result.timeout || 0,
      passRate,
      reportUrls,
      failedCaseNames,
      environment: result.environment,
      projectName: result.projectName,
    };

    const index = this._loadIndex();
    index.reports.unshift(entry);
    if (index.reports.length > this._config.maxHistory) {
      index.reports = index.reports.slice(0, this._config.maxHistory);
    }
    index.totalReports = index.reports.length;
    index.latestReport = index.reports[0];
    index.passRateTrend = index.reports.slice(0, 10).map(r => r.passRate);
    index.lastUpdated = Date.now();
    index.projectName = this._config.projectName;
    index.environment = this._config.environment;

    this._saveIndex(index);
    this._generateIndexHtml(index);

    return entry;
  }

  getHistory(): ReportHistoryIndex {
    return this._loadIndex();
  }

  getLatestReport(): ReportHistoryEntry | undefined {
    return this._loadIndex().latestReport;
  }

  getReportById(reportId: string): ReportHistoryEntry | undefined {
    return this._loadIndex().reports.find(r => r.reportId === reportId);
  }

  clearHistory(): void {
    const indexPath = path.join(this._config.outputDir, HISTORY_INDEX_FILE);
    const indexHtmlPath = path.join(this._config.outputDir, INDEX_HTML_FILE);
    if (fs.existsSync(indexPath)) fs.unlinkSync(indexPath);
    if (fs.existsSync(indexHtmlPath)) fs.unlinkSync(indexHtmlPath);
  }

  private _loadIndex(): ReportHistoryIndex {
    const indexPath = path.join(this._config.outputDir, HISTORY_INDEX_FILE);
    if (!fs.existsSync(indexPath)) {
      return {
        projectName: this._config.projectName,
        environment: this._config.environment,
        totalReports: 0,
        passRateTrend: [],
        lastUpdated: Date.now(),
        reports: [],
      };
    }
    try {
      const content = fs.readFileSync(indexPath, 'utf-8');
      return JSON.parse(content);
    } catch {
      return {
        projectName: this._config.projectName,
        environment: this._config.environment,
        totalReports: 0,
        passRateTrend: [],
        lastUpdated: Date.now(),
        reports: [],
      };
    }
  }

  private _saveIndex(index: ReportHistoryIndex): void {
    const indexPath = path.join(this._config.outputDir, HISTORY_INDEX_FILE);
    fs.writeFileSync(indexPath, JSON.stringify(index, null, 2), 'utf-8');
  }

  private _generateIndexHtml(index: ReportHistoryIndex): void {
    const html = this._buildIndexHtml(index);
    const filePath = path.join(this._config.outputDir, INDEX_HTML_FILE);
    fs.writeFileSync(filePath, html, 'utf-8');
  }

  private _buildIndexHtml(index: ReportHistoryIndex): string {
    const latest = index.latestReport;
    const trend = index.passRateTrend;

    const trendBars = trend.map((rate, i) => {
      const height = Math.max(4, (rate / 100) * 120);
      const color = rate >= 80 ? '#27ae60' : rate >= 60 ? '#f39c12' : '#e74c3c';
      return `
        <div class="trend-bar" style="height: ${height}px; background: ${color};" title="第${trend.length - i}次: ${rate.toFixed(1)}%"></div>
      `;
    }).join('');

    const reportRows = index.reports.map(r => {
      const passRateColor = r.passRate >= 80 ? '#27ae60' : r.passRate >= 60 ? '#f39c12' : '#e74c3c';
      const statusColor = r.failed > 0 ? '#e74c3c' : '#27ae60';
      const statusText = r.failed > 0 ? '失败' : '通过';

      const htmlLink = r.reportUrls.html
        ? `<a href="${this._resolveUrl(r.reportUrls.html)}" target="_blank" class="link-btn">HTML</a>`
        : '';
      const jsonLink = r.reportUrls.json
        ? `<a href="${this._resolveUrl(r.reportUrls.json)}" target="_blank" class="link-btn">JSON</a>`
        : '';
      const mdLink = r.reportUrls.markdown
        ? `<a href="${this._resolveUrl(r.reportUrls.markdown)}" target="_blank" class="link-btn">Markdown</a>`
        : '';

      const failedList = r.failedCaseNames.length > 0
        ? `<div class="failed-list">${r.failedCaseNames.slice(0, 3).map(name => `<span class="failed-tag">${this._escapeHtml(name)}</span>`).join('')}${r.failedCaseNames.length > 3 ? ` <span class="more-failed">+${r.failedCaseNames.length - 3}</span>` : ''}</div>`
        : '<div class="failed-list empty">无失败用例 🎉</div>';

      return `
        <tr>
          <td style="text-align: center;">
            <span class="status-badge" style="background: ${statusColor};">${statusText}</span>
          </td>
          <td>${this._escapeHtml(r.suiteTitle)}</td>
          <td style="text-align: center;">${r.total}</td>
          <td style="text-align: center; color: #27ae60;">${r.passed}</td>
          <td style="text-align: center; color: #e74c3c;">${r.failed}</td>
          <td style="text-align: center; color: #95a5a6;">${r.skipped}</td>
          <td style="text-align: center; color: #e67e22;">${r.timeout}</td>
          <td style="text-align: center; font-weight: bold; color: ${passRateColor};">${r.passRate.toFixed(1)}%</td>
          <td style="text-align: center;">${this._formatDuration(r.duration)}</td>
          <td style="white-space: nowrap;">${new Date(r.startTime).toLocaleString('zh-CN')}</td>
          <td>
            ${htmlLink} ${jsonLink} ${mdLink}
          </td>
        </tr>
        <tr class="detail-row">
          <td colspan="11">
            ${failedList}
          </td>
        </tr>
      `;
    }).join('');

    return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${this._config.projectName} - 测试报告中心</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #f5f7fa; color: #333; padding: 20px; }
    .container { max-width: 1200px; margin: 0 auto; }
    .header { background: #fff; border-radius: 8px; padding: 24px; margin-bottom: 20px; box-shadow: 0 2px 8px rgba(0,0,0,0.1); }
    .header h1 { font-size: 24px; margin-bottom: 8px; }
    .header .meta { color: #666; font-size: 14px; }
    .summary { display: grid; grid-template-columns: repeat(4, 1fr); gap: 16px; margin-bottom: 20px; }
    .summary-card { background: #fff; border-radius: 8px; padding: 20px; box-shadow: 0 2px 8px rgba(0,0,0,0.1); }
    .summary-card .label { font-size: 13px; color: #666; margin-bottom: 8px; }
    .summary-card .value { font-size: 28px; font-weight: bold; }
    .summary-card.latest .value { color: ${latest ? (latest.failed > 0 ? '#e74c3c' : '#27ae60') : '#999'}; }
    .summary-card.total .value { color: #3498db; }
    .summary-card.avg .value { color: #9b59b6; }
    .trend-section { background: #fff; border-radius: 8px; padding: 20px; margin-bottom: 20px; box-shadow: 0 2px 8px rgba(0,0,0,0.1); }
    .trend-section h2 { font-size: 18px; margin-bottom: 16px; }
    .trend-chart { display: flex; align-items: flex-end; gap: 8px; height: 140px; padding: 10px 0; border-bottom: 2px solid #eee; }
    .trend-bar { flex: 1; min-width: 20px; border-radius: 4px 4px 0 0; transition: all 0.3s; }
    .trend-bar:hover { opacity: 0.8; }
    .section { background: #fff; border-radius: 8px; padding: 20px; box-shadow: 0 2px 8px rgba(0,0,0,0.1); }
    .section h2 { font-size: 18px; margin-bottom: 16px; }
    table { width: 100%; border-collapse: collapse; font-size: 13px; }
    th, td { padding: 10px 12px; text-align: left; border-bottom: 1px solid #eee; }
    th { background: #fafbfc; font-weight: 600; color: #555; font-size: 12px; text-transform: uppercase; }
    tr:hover { background: #f6f8fa; }
    .detail-row td { background: #fafbfc; padding: 8px 12px; }
    .status-badge { display: inline-block; padding: 4px 12px; border-radius: 20px; font-size: 12px; font-weight: bold; color: #fff; }
    .link-btn { display: inline-block; padding: 4px 10px; background: #e1ecf4; color: #39739d; border-radius: 4px; font-size: 12px; text-decoration: none; margin-right: 4px; }
    .link-btn:hover { background: #d0e3f1; }
    .failed-list { margin-top: 4px; }
    .failed-list.empty { color: #999; font-size: 12px; }
    .failed-tag { display: inline-block; background: #fee; color: #c0392b; padding: 2px 8px; border-radius: 3px; font-size: 11px; margin-right: 4px; }
    .more-failed { font-size: 11px; color: #999; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>📊 ${this._config.projectName} - 测试报告中心</h1>
      <div class="meta">
        <span>🌍 环境: ${this._config.environment}</span>
        <span style="margin-left: 20px;">📅 最近更新: ${new Date(index.lastUpdated).toLocaleString('zh-CN')}</span>
      </div>
    </div>

    <div class="summary">
      <div class="summary-card latest">
        <div class="label">最新执行状态</div>
        <div class="value">${latest ? (latest.failed > 0 ? '失败' : '通过') : '-'}</div>
      </div>
      <div class="summary-card total">
        <div class="label">历史报告数</div>
        <div class="value">${index.totalReports}</div>
      </div>
      <div class="summary-card avg">
        <div class="label">平均通过率</div>
        <div class="value">${trend.length > 0 ? (trend.reduce((a, b) => a + b, 0) / trend.length).toFixed(1) : '0'}%</div>
      </div>
      <div class="summary-card">
        <div class="label">报告保留</div>
        <div class="value">最近 ${this._config.maxHistory} 份</div>
      </div>
    </div>

    ${trend.length > 0 ? `
    <div class="trend-section">
      <h2>📈 通过率趋势 (最近 ${trend.length} 次)</h2>
      <div class="trend-chart">
        ${trendBars}
      </div>
    </div>` : ''}

    <div class="section">
      <h2>📋 历史报告列表</h2>
      <table>
        <thead>
          <tr>
            <th style="width: 70px;">状态</th>
            <th>套件名称</th>
            <th style="width: 60px;">总数</th>
            <th style="width: 60px;">通过</th>
            <th style="width: 60px;">失败</th>
            <th style="width: 60px;">跳过</th>
            <th style="width: 60px;">超时</th>
            <th style="width: 80px;">通过率</th>
            <th style="width: 80px;">耗时</th>
            <th style="width: 160px;">执行时间</th>
            <th style="width: 180px;">报告</th>
          </tr>
        </thead>
        <tbody>
          ${reportRows || '<tr><td colspan="11" style="text-align: center; color: #999; padding: 40px;">暂无历史报告</td></tr>'}
        </tbody>
      </table>
    </div>
  </div>
</body>
</html>`;
  }

  private _resolveUrl(url: string): string {
    if (url.startsWith('http://') || url.startsWith('https://')) return url;
    return path.basename(url);
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

  private _formatDuration(ms?: number): string {
    if (ms === undefined || ms === null) return '-';
    if (ms < 1000) return `${ms}ms`;
    if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${minutes}m ${secs}s`;
  }

  private _ensureOutputDir(): void {
    const dir = this._config.outputDir;
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  }
}
