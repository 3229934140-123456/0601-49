import { DataGenerator } from './data-generator';

export interface AccountData {
  id: string;
  username: string;
  password: string;
  email: string;
  phone: string;
  nickname: string;
  avatar?: string;
  status: 'active' | 'inactive' | 'banned';
  role: 'admin' | 'user' | 'guest';
  createdAt: Date;
}

export interface AccountGeneratorOptions {
  count?: number;
  usernamePrefix?: string;
  passwordLength?: number;
  emailDomain?: string;
  phonePrefix?: string;
  role?: AccountData['role'];
  status?: AccountData['status'];
  customFields?: Record<string, any>;
}

export class AccountGenerator {
  private static readonly NICKNAMES = [
    '快乐小猫', '阳光少年', '星空漫步', '追风者', '梦想家',
    '清风徐来', '深海游鱼', '山间清风', '云端漫步', '月下独酌',
    '花开半夏', '叶落知秋', '雪落无声', '雨过天晴', '风起云涌',
  ];

  static generate(options: AccountGeneratorOptions = {}): AccountData {
    const {
      usernamePrefix = 'user_',
      passwordLength = 12,
      emailDomain,
      phonePrefix,
      role,
      status = 'active',
      customFields = {},
    } = options;

    const username = DataGenerator.randomString({
      prefix: usernamePrefix,
      length: 6,
      charset: DataGenerator.LOWER_CHARSET + DataGenerator.NUMBER_CHARSET,
    });

    const password = DataGenerator.randomString({
      length: passwordLength,
      charset: DataGenerator.DEFAULT_CHARSET + DataGenerator.SPECIAL_CHARSET,
    });

    const roles: AccountData['role'][] = ['admin', 'user', 'guest'];
    const accountRole = role || (Math.random() < 0.1 ? 'admin' : Math.random() < 0.8 ? 'user' : 'guest');

    return {
      id: DataGenerator.randomId('acc_'),
      username,
      password,
      email: DataGenerator.randomEmail(emailDomain),
      phone: DataGenerator.randomPhone(phonePrefix),
      nickname: DataGenerator.randomArrayItem(this.NICKNAMES) + DataGenerator.randomNumber(100, 999),
      status,
      role: accountRole,
      createdAt: DataGenerator.randomDate(),
      ...customFields,
    };
  }

  static generateBatch(count: number, options: AccountGeneratorOptions = {}): AccountData[] {
    return DataGenerator.generateBatch(count, (i) => {
      const account = this.generate(options);
      account.username = `${options.usernamePrefix || 'user_'}${i + 1}_${DataGenerator.randomString({ length: 4 })}`;
      return account;
    });
  }

  static generateAdmin(options: AccountGeneratorOptions = {}): AccountData {
    return this.generate({ ...options, role: 'admin' });
  }

  static generateBatchAdmins(count: number, options: AccountGeneratorOptions = {}): AccountData[] {
    return this.generateBatch(count, { ...options, role: 'admin' });
  }
}
