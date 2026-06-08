import {
  AutoTestPlatform,
  TestCase,
  TestSuite,
  DataGenerator,
  AccountGenerator,
  OrderGenerator,
  StepRecorder,
  Assert,
  ResponseAssert,
  ScreenshotManager,
  RetryStrategy,
  ReportGenerator,
  NotificationManager,
  ParameterizedTestCase,
  parameterize,
} from '../index';

async function main() {
  console.log('=== 自动化测试平台示例 - 增强版 V2 ===\n');

  exampleDataGenerator();
  console.log('');

  exampleStepRecorder();
  console.log('');

  exampleAssertion();
  console.log('');

  await exampleRetryStrategy();
  console.log('');

  await exampleParameterizedTests();
  console.log('');

  await examplePreviewAndTagFilter();
  console.log('');

  await exampleFullTestSuite();
}

function exampleDataGenerator() {
  console.log('【1. 测试数据生成示例】');
  console.log('');
  console.log('--- 通用数据生成 ---');
  console.log('  随机字符串:', DataGenerator.randomString());
  console.log('  随机邮箱:', DataGenerator.randomEmail());
  console.log('  随机手机号:', DataGenerator.randomPhone());
  console.log('  随机数字 (1-100):', DataGenerator.randomNumber(1, 100));
  console.log('  随机 UUID:', DataGenerator.randomUUID());
  console.log('');

  console.log('--- 批量生成账号 (3个) ---');
  const accounts = AccountGenerator.generateBatch(3, { usernamePrefix: 'test_' });
  accounts.forEach((acc, i) => {
    console.log(`  [${i + 1}] ${acc.username} / ${acc.email} / ${acc.role}`);
  });
  console.log('');

  console.log('--- 批量生成订单 (2个) ---');
  const orders = OrderGenerator.generateBatch(2);
  orders.forEach((order, i) => {
    console.log(`  [${i + 1}] ${order.orderNo} - ¥${order.totalAmount} - ${order.status}`);
    console.log(`     商品数量: ${order.items.length}件`);
  });
}

function exampleStepRecorder() {
  console.log('【2. 步骤记录示例】');
  console.log('');

  const recorder = new StepRecorder();

  recorder.recordSync('初始化测试数据', () => {
    return { userId: 'user_001' };
  }, { count: 100 });

  try {
    recorder.recordSync('失败的步骤', () => {
      throw new Error('模拟错误');
    });
  } catch (e) {
  }

  recorder.recordSync('验证结果', () => {
    return { success: true };
  });

  const summary = recorder.getSummary();
  console.log('  总步骤数:', summary.total);
  console.log('  通过:', summary.passed, ', 失败:', summary.failed);
  console.log('  总耗时:', summary.totalDuration, 'ms');
}

function exampleAssertion() {
  console.log('【3. 接口断言示例】');
  console.log('');

  console.log('--- 基础断言 ---');
  try {
    Assert.assertEqual(2 + 2, 4);
    console.log('  ✅ 2 + 2 = 4 断言通过');
  } catch (e) {
    console.log('  ❌ 断言失败');
  }

  console.log('');
  console.log('--- 响应断言 ---');
  const mockResponse = {
    status: 200,
    data: {
      code: 0,
      message: 'success',
      data: {
        id: 123,
        name: 'test',
        items: [1, 2, 3],
      },
    },
  };

  try {
    const assert = new ResponseAssert(mockResponse, { throwOnFailure: false });
    assert
      .status(200)
      .hasData()
      .fieldEqual('code', 0)
      .fieldEqual('data.name', 'test')
      .fieldType('data.id', 'number')
      .arrayLength('data.items', 3);

    console.log('  断言总数:', assert.results.length);
    console.log('  通过:', assert.passed, ', 失败:', assert.failed);
  } catch (e) {
    console.log('  ❌ 断言失败');
  }
}

async function exampleRetryStrategy() {
  console.log('【4. 失败重试示例】');
  console.log('');

  let attempt = 0;

  const result = await RetryStrategy.retry(
    () => {
      attempt++;
      console.log(`  第 ${attempt} 次尝试...`);
      if (attempt < 3) {
        throw new Error('临时错误');
      }
      return '成功';
    },
    {
      maxRetries: 3,
      delayMs: 100,
      backoff: 'exponential',
      onRetry: (err, attemptNum, delay) => {
        console.log(`    重试中... (第${attemptNum}次, 延迟${delay}ms)`);
      },
    }
  );

  console.log('  最终状态:', result.status);
  console.log('  总重试次数:', result.totalRetries);
  console.log('  结果:', result.result);
}

async function exampleParameterizedTests() {
  console.log('【5. 参数化测试示例】');
  console.log('');

  const testData = [
    { username: 'user_a', password: 'pass123', expectedRole: 'admin' },
    { username: 'user_b', password: 'pass456', expectedRole: 'user' },
    { username: 'user_c', password: 'pass789', expectedRole: 'guest' },
  ];

  console.log('--- 方式1: ParameterizedTestCase 类 ---');
  const paramTest = new ParameterizedTestCase(
    {
      title: '用户登录测试',
      description: '参数化测试不同用户登录',
      tags: ['登录', '参数化'],
      priority: 'high',
      dataSummary: (data) => `${data.username} / ${data.expectedRole}`,
      dataName: (data, index) => `用户${index + 1}: ${data.username}`,
    },
    async (ctx) => {
      const data = ctx.get('dataSet');
      await ctx.step('验证用户名', async () => {
        Assert.assertTruthy(data.username);
      });
      await ctx.step('验证角色', async () => {
        Assert.assertTruthy(data.expectedRole);
      });
    }
  );

  paramTest.withData(testData);
  const testCases = paramTest.buildTestCases();
  console.log('  生成了', testCases.length, '个参数化用例');
  testCases.forEach((tc, i) => {
    console.log(`  [${i + 1}] ${tc.meta.title}`);
  });

  console.log('');
  console.log('--- 方式2: parameterize 快捷函数 ---');
  const quickCases = parameterize(
    [1, 2, 3, 4, 5],
    {
      title: '数字校验',
      dataSummary: (n) => `数字 ${n}`,
      dataName: (n) => `n=${n}`,
    },
    async (ctx) => {
      const n = ctx.get('dataSet');
      await ctx.step('校验大于0', () => {
        Assert.assertGreaterThan(n, 0);
      });
    }
  );
  console.log('  生成了', quickCases.length, '个参数化用例');
}

async function examplePreviewAndTagFilter() {
  console.log('【6. 执行预览与标签筛选示例】');
  console.log('');

  const platform = new AutoTestPlatform({
    runner: {
      tags: ['订单'],
      concurrency: 3,
      serialTags: ['串行'],
    },
    report: {
      outputDir: './test-reports',
      enableHistory: true,
    },
  });

  const suite = platform.createSuite('预览演示套件');

  suite.addTestCases([
    new TestCase(
      { title: '用户登录', tags: ['登录', '用户'], priority: 'high' },
      async () => {}
    ),
    new TestCase(
      { title: '创建订单', tags: ['订单', '创建'], priority: 'critical', resourceLocks: ['order:1'] },
      async () => {}
    ),
    new TestCase(
      { title: '查询订单', tags: ['订单', '查询'], priority: 'medium', resourceLocks: ['order:2'] },
      async () => {}
    ),
    new TestCase(
      { title: '删除订单', tags: ['订单', '删除'], priority: 'high', skip: true },
      async () => {}
    ),
    new TestCase(
      { title: '串行任务', tags: ['串行', '任务'], priority: 'low' },
      async () => {}
    ),
  ]);

  const preview = platform.previewSuite(suite);

  console.log('  套件:', preview.suiteTitle);
  console.log('  总用例数:', preview.total);
  console.log('  将会执行:', preview.willRun);
  console.log('  总共跳过:', preview.skipped, '(标签过滤:', preview.skippedByTag, '+ skip标记:', preview.skippedBySkipFlag, ')');
  console.log('  串行执行:', preview.serialCount, '个');
  console.log('  并发执行:', preview.parallelCount, '个');
  console.log('  涉及资源锁:', preview.resourceLocks.length > 0 ? preview.resourceLocks.join(', ') : '无');
  console.log('');
  console.log('  用例详情:');
  preview.items.forEach(item => {
    const icon = item.willRun ? '✅' : '⏭️';
    const serialInfo = item.isSerial ? ` [串行: ${item.serialReason}]` : '';
    const lockInfo = item.resourceLocks && item.resourceLocks.length > 0
      ? ` [资源锁: ${item.resourceLocks.join(',')}]`
      : '';
    const skipInfo = item.skipReason ? ` (跳过原因: ${item.skipReason})` : '';
    console.log(`    ${icon} ${item.title}${serialInfo}${lockInfo}${skipInfo}`);
  });
}

async function exampleFullTestSuite() {
  console.log('');
  console.log('【7. 完整测试套件示例】');
  console.log('');

  const platform = new AutoTestPlatform({
    runner: {
      concurrency: 3,
      retries: 1,
      timeout: 5000,
      serialTags: ['串行'],
      includeSkippedInReport: true,
    },
    report: {
      outputDir: './test-reports',
      format: ['html', 'json', 'markdown'],
      reportTitle: '订单系统测试报告 - V2增强版',
      projectName: '订单系统',
      environment: 'test',
      shareable: true,
      shareBaseUrl: 'https://reports.example.com/share',
      showStepDetails: true,
      showScreenshots: true,
      showRetryRecords: true,
      showSkipped: true,
      enableHistory: true,
      maxHistory: 10,
    },
    notification: {
      onSuccess: true,
      onFailure: true,
    },
  });

  const suite = platform.createSuite('订单流程测试 - V2增强版');

  const testAccounts = AccountGenerator.generateBatch(5);
  const testOrders = OrderGenerator.generateBatch(10);

  suite.beforeAll(async () => {
    console.log('  [前置准备] 初始化测试环境...');
    console.log('  [前置准备] 生成了', testAccounts.length, '个测试账号');
    console.log('  [前置准备] 生成了', testOrders.length, '个测试订单');
  });

  suite.afterAll(async () => {
    console.log('  [后置清理] 清理测试数据...');
  });

  const testCase1 = new TestCase(
    {
      title: '用户登录测试',
      description: '测试用户登录功能是否正常',
      tags: ['登录', '用户'],
      priority: 'high',
    },
    async (ctx) => {
      ctx.set('accounts', testAccounts);

      await ctx.step('输入用户名密码', async () => {
        return { username: 'test_user', password: '******' };
      });

      await ctx.step('验证登录结果', async () => {
        return { success: true, token: 'mock_token_123' };
      });

      ctx.log('登录成功');
    }
  );

  const testCase2 = new TestCase(
    {
      title: '创建订单测试 - 订单A',
      description: '测试创建订单接口 - 使用资源锁 order:A',
      tags: ['订单', '创建'],
      priority: 'critical',
      resourceLocks: ['order:A'],
    },
    async (ctx) => {
      const orderData = await ctx.step('准备订单数据', async () => {
        return testOrders[0];
      });

      await ctx.step('提交订单', async () => {
        return { orderId: orderData.id, status: 'created' };
      });

      await ctx.step('验证订单状态', async () => {
        Assert.assertEqual('paid', 'paid');
      });
    }
  );

  const testCase3 = new TestCase(
    {
      title: '创建订单测试 - 订单B',
      description: '测试创建订单接口 - 使用资源锁 order:B（与order:A可并发）',
      tags: ['订单', '创建'],
      priority: 'critical',
      resourceLocks: ['order:B'],
    },
    async (ctx) => {
      const orderData = await ctx.step('准备订单数据', async () => {
        return testOrders[1];
      });

      await ctx.step('提交订单', async () => {
        return { orderId: orderData.id, status: 'created' };
      });

      await ctx.step('验证订单状态', async () => {
        Assert.assertEqual('paid', 'paid');
      });
    }
  );

  const testCase4 = new TestCase(
    {
      title: '查询订单列表测试',
      description: '测试订单列表查询',
      tags: ['订单', '查询'],
      priority: 'medium',
    },
    async (ctx) => {
      await ctx.step('查询订单列表', async () => {
        return { total: 10, list: testOrders };
      });

      await ctx.step('验证返回数据', async () => {
        Assert.assertGreaterThan(testOrders.length, 0);
      });
    }
  );

  const testCase5 = new TestCase(
    {
      title: '会失败的测试用例（带断言对比）',
      description: '用于演示失败场景、重试和断言预期/实际值对比',
      tags: ['演示'],
      priority: 'low',
      retries: 1,
    },
    async (ctx) => {
      await ctx.step('执行操作', async () => {
        Assert.assertEqual(100, 200);
      });
    }
  );

  const testCase6 = new TestCase(
    {
      title: '被跳过的测试用例',
      description: '这个用例会被跳过，用于演示跳过统计',
      tags: ['演示', '跳过'],
      priority: 'low',
      skip: true,
    },
    async (ctx) => {
      await ctx.step('不会执行的步骤', async () => {
      });
    }
  );

  const testCase7 = new TestCase(
    {
      title: '串行执行的测试用例',
      description: '带有串行标签，会串行执行',
      tags: ['串行', '演示'],
      priority: 'medium',
    },
    async (ctx) => {
      await ctx.step('执行串行操作', async () => {
        return { ok: true };
      });
    }
  );

  const paramTestCases = parameterize(
    [
      { account: testAccounts[0], shouldPass: true },
      { account: testAccounts[1], shouldPass: true },
      { account: testAccounts[2], shouldPass: false },
    ],
    {
      title: '参数化-账号登录',
      description: '用不同账号测试登录',
      tags: ['参数化', '登录'],
      priority: 'high',
      dataSummary: (d) => `${d.account.username}, shouldPass=${d.shouldPass}`,
      dataName: (d) => d.account.username,
    },
    async (ctx) => {
      const data = ctx.get('dataSet') as any;
      await ctx.step('用户登录', async () => {
        return { username: data.account.username };
      });

      await ctx.step('验证登录结果', async () => {
        if (!data.shouldPass) {
          const error = new Error('登录失败（预期内）') as any;
          error.expected = 'success';
          error.actual = 'failed';
          throw error;
        }
        return { success: true };
      });
    }
  );

  suite.addTestCases([
    testCase1,
    testCase2,
    testCase3,
    testCase4,
    testCase5,
    testCase6,
    testCase7,
    ...paramTestCases,
  ]);

  console.log('  📋 执行预览:');
  const preview = platform.previewSuite(suite);
  console.log('     总用例:', preview.total, ', 将执行:', preview.willRun, ', 跳过:', preview.skipped);
  console.log('     串行:', preview.serialCount, ', 并发:', preview.parallelCount);
  console.log('');

  console.log('  🚀 开始执行测试套件...');
  console.log('');

  const { result, reports, notificationErrors, notificationDeliveries } = await platform.runSuite(suite);

  console.log('');
  console.log('  === 测试结果 ===');
  console.log('  总数:', result.total, '(原始总数:', result.originalTotal, ')');
  if (result.filteredByTags) {
    console.log('  ⚠️  已按标签筛选，排除了', result.originalTotal! - result.total, '个用例');
  }
  console.log('  通过:', result.passed);
  console.log('  失败:', result.failed);
  console.log('  超时:', result.timeout || 0);
  console.log('  跳过:', result.skipped);
  const passRate = result.total > 0 ? ((result.passed / result.total) * 100).toFixed(1) : '0';
  console.log('  通过率:', passRate + '%');
  const durationSec = result.duration ? (result.duration / 1000).toFixed(2) : '0';
  console.log('  总耗时:', durationSec + 's');
  console.log('');

  console.log('  生成的报告:');
  reports.forEach(report => {
    const sizeKb = (report.size / 1024).toFixed(2);
    console.log('    -', report.format + ':', report.path, '(' + sizeKb + ' KB)');
    if (report.shareableUrl) {
      console.log('      🔗 分享地址:', report.shareableUrl);
    }
  });
  console.log('');

  console.log('  📬 通知投递记录:');
  notificationDeliveries.forEach(d => {
    const icon = d.status === 'success' ? '✅' : '⚠️';
    const statusText = d.status === 'success' ? '成功' : '失败';
    console.log('    ' + icon, d.notifierName + ':', statusText);
    console.log('       发送时间:', new Date(d.sentAt).toLocaleString('zh-CN'));
    if (d.retryCount > 0) console.log('       重试次数:', d.retryCount);
    if (d.durationMs !== undefined) console.log('       耗时:', d.durationMs + 'ms');
    if (d.lastError) console.log('       错误:', d.lastError);
  });
  console.log('');

  if (notificationErrors.length > 0) {
    console.log('  ⚠️ 通知异常:');
    notificationErrors.forEach(e => {
      console.log('    -', e.notifierName + ':', e.error);
    });
    console.log('  (注: 通知失败详情已写入报告文件)');
    console.log('');
  }

  const history = platform.getReportHistory();
  if (history) {
    console.log('  📚 历史报告:');
    console.log('    总报告数:', history.totalReports);
    console.log('    最近通过率趋势:', history.passRateTrend.map(r => r.toFixed(0) + '%').join(' → '));
    console.log('    最新报告:', history.latestReport?.suiteTitle || '-');
    console.log('    历史索引页:', 'test-reports/index.html');

    if (history.latestDiff) {
      const diff = history.latestDiff;
      console.log('');
      console.log('  🔍 最近两次对比:');
      console.log('    通过率变化:', (diff.passRateChange > 0 ? '+' : '') + diff.passRateChange.toFixed(1) + '%');
      console.log('    🆕 新增失败:', diff.newFailedCases.length + ' 个');
      if (diff.newFailedCases.length > 0) {
        diff.newFailedCases.forEach(name => console.log('      -', name));
      }
      console.log('    💚 已恢复:', diff.recoveredCases.length + ' 个');
      if (diff.recoveredCases.length > 0) {
        diff.recoveredCases.forEach(name => console.log('      -', name));
      }
      console.log('    🔴 持续失败:', diff.persistentFailedCases.length + ' 个');
      if (diff.persistentFailedCases.length > 0) {
        diff.persistentFailedCases.forEach(name => console.log('      -', name));
      }
    }
    console.log('');
  }

  console.log('  🔄 失败重跑清单:');
  const rerunPlan = platform.getFailedRerunPlan(result);
  console.log('    总失败数:', rerunPlan.total, '(失败:', rerunPlan.failedCount, ', 超时:', rerunPlan.timeoutCount, ')');
  if (rerunPlan.items.length > 0) {
    rerunPlan.items.forEach(item => {
      const icon = item.status === 'failed' ? '❌' : '⏰';
      const dataInfo = item.dataSet ? ` [${item.dataSet.name}]` : '';
      console.log('    ' + icon, item.title + dataInfo);
      console.log('       ID:', item.id);
      console.log('       标签:', item.tags.join(', ') || '无');
      console.log('       优先级:', item.priority);
      if (item.resourceLocks && item.resourceLocks.length > 0) {
        console.log('       资源锁:', item.resourceLocks.join(', '));
      }
      if (item.failedStep) console.log('       失败步骤:', item.failedStep);
      if (item.errorMessage) console.log('       错误:', item.errorMessage);
    });
  }
  console.log('');

  console.log('  用例详情:');
  result.results.forEach(r => {
    const icon = r.status === 'passed' ? '✅' : r.status === 'skipped' ? '⏭️' : '❌';
    const dataSetInfo = r.dataSet ? ` [${r.dataSet.name}]` : '';
    const lockInfo = r.meta.resourceLocks && r.meta.resourceLocks.length > 0
      ? ` [🔒${r.meta.resourceLocks.join(',')}]`
      : '';
    console.log('    ' + icon + ' ' + r.meta.title + dataSetInfo + lockInfo + ' (' + r.meta.priority + ') - ' + r.steps.length + ' 个步骤');
    if (r.error) {
      console.log('       错误:', r.error.message);
      if (r.error.expected !== undefined && r.error.actual !== undefined) {
        console.log('       预期值:', r.error.expected, ', 实际值:', r.error.actual);
      }
    }
    if (r.retryCount > 0) {
      console.log('       重试次数:', r.retryCount);
    }
  });

  console.log('');
  console.log('  跳过用例详情:');
  if (result.skippedDetails && result.skippedDetails.length > 0) {
    result.skippedDetails.forEach(r => {
      console.log('    ⏭️', r.meta.title, '-', r.meta.description || '无描述');
    });
  } else {
    console.log('    无');
  }
}

main().catch(console.error);
