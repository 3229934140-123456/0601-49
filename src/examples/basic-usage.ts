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
  console.log('=== 自动化测试平台示例 - 增强版 ===\n');

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

async function exampleFullTestSuite() {
  console.log('【6. 完整测试套件示例】');
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
      reportTitle: '订单系统测试报告 - 增强版',
      projectName: '订单系统',
      environment: 'test',
      shareable: true,
      shareBaseUrl: 'https://reports.example.com/share',
      showStepDetails: true,
      showScreenshots: true,
      showRetryRecords: true,
      showSkipped: true,
    },
    notification: {
      onSuccess: true,
      onFailure: true,
    },
  });

  const suite = platform.createSuite('订单流程测试 - 增强版');

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
      title: '创建订单测试',
      description: '测试创建订单接口',
      tags: ['订单', '创建'],
      priority: 'critical',
      resourceLocks: ['order_resource'],
    },
    async (ctx) => {
      const orderData = await ctx.step('准备订单数据', async () => {
        return testOrders[0];
      });

      await ctx.step('提交订单', async () => {
        return { orderId: orderData.id, status: 'created' };
      });

      await ctx.step('验证订单状态', async () => {
        const assert = new ResponseAssert(
          { status: 200, data: { code: 0, data: { status: 'paid' } } },
          { throwOnFailure: false }
        );
        assert.status(200).fieldEqual('data.status', 'paid');
        if (!assert.passed) {
          throw new Error('订单状态校验失败');
        }
      });
    }
  );

  const testCase3 = new TestCase(
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

  const testCase4 = new TestCase(
    {
      title: '会失败的测试用例',
      description: '用于演示失败场景和重试',
      tags: ['演示'],
      priority: 'low',
      retries: 2,
    },
    async (ctx) => {
      await ctx.step('执行操作', async () => {
        throw new Error('模拟测试失败');
      });
    }
  );

  const testCase5 = new TestCase(
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

  const testCase6 = new TestCase(
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
          throw new Error('登录失败（预期内）');
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
    ...paramTestCases,
  ]);

  console.log('  开始执行测试套件...');
  console.log('');

  const { result, reports, notificationErrors } = await platform.runSuite(suite);

  console.log('');
  console.log('  === 测试结果 ===');
  console.log('  总数:', result.total);
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

  if (notificationErrors.length > 0) {
    console.log('  ⚠️ 通知异常:');
    notificationErrors.forEach(e => {
      console.log('    -', e.notifierName + ':', e.error);
    });
    console.log('');
  }

  console.log('  用例详情:');
  result.results.forEach(r => {
    const icon = r.status === 'passed' ? '✅' : r.status === 'skipped' ? '⏭️' : '❌';
    const dataSetInfo = r.dataSet ? ` [${r.dataSet.name}]` : '';
    console.log('    ' + icon + ' ' + r.meta.title + dataSetInfo + ' (' + r.meta.priority + ') - ' + r.steps.length + ' 个步骤');
    if (r.error) {
      console.log('       错误:', r.error.message);
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
