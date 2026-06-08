export interface RandomOptions {
  prefix?: string;
  suffix?: string;
  length?: number;
  charset?: string;
}

export class DataGenerator {
  static readonly DEFAULT_CHARSET = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  static readonly NUMBER_CHARSET = '0123456789';
  static readonly LOWER_CHARSET = 'abcdefghijklmnopqrstuvwxyz';
  static readonly UPPER_CHARSET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  static readonly SPECIAL_CHARSET = '!@#$%^&*()_+-=[]{}|;:,.<>?';

  static randomString(options: RandomOptions = {}): string {
    const { prefix = '', suffix = '', length = 8, charset = this.DEFAULT_CHARSET } = options;
    let result = '';
    for (let i = 0; i < length; i++) {
      result += charset.charAt(Math.floor(Math.random() * charset.length));
    }
    return `${prefix}${result}${suffix}`;
  }

  static randomNumber(min: number, max: number): number {
    return Math.floor(Math.random() * (max - min + 1)) + min;
  }

  static randomFloat(min: number, max: number, decimals: number = 2): number {
    const value = Math.random() * (max - min) + min;
    return Number(value.toFixed(decimals));
  }

  static randomBoolean(): boolean {
    return Math.random() > 0.5;
  }

  static randomEmail(domain?: string): string {
    const username = this.randomString({ length: 8, charset: this.LOWER_CHARSET });
    const emailDomain = domain || 'example.com';
    return `${username}@${emailDomain}`;
  }

  static randomPhone(prefix: string = '138'): string {
    const suffix = this.randomString({ length: 8, charset: this.NUMBER_CHARSET });
    return `${prefix}${suffix}`;
  }

  static randomId(prefix?: string): string {
    const id = Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
    return prefix ? `${prefix}${id}` : id;
  }

  static randomDate(start?: Date, end?: Date): Date {
    const startDate = start || new Date(2020, 0, 1);
    const endDate = end || new Date();
    const startTime = startDate.getTime();
    const endTime = endDate.getTime();
    const randomTime = Math.random() * (endTime - startTime) + startTime;
    return new Date(randomTime);
  }

  static randomArrayItem<T>(array: T[]): T {
    return array[Math.floor(Math.random() * array.length)];
  }

  static randomUUID(): string {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
      const r = Math.random() * 16 | 0;
      const v = c === 'x' ? r : (r & 0x3 | 0x8);
      return v.toString(16);
    });
  }

  static generateBatch<T>(count: number, generator: (index: number) => T): T[] {
    const results: T[] = [];
    for (let i = 0; i < count; i++) {
      results.push(generator(i));
    }
    return results;
  }
}
