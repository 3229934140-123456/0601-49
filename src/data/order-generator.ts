import { DataGenerator } from './data-generator';

export interface OrderItem {
  id: string;
  productId: string;
  productName: string;
  price: number;
  quantity: number;
  subtotal: number;
}

export interface OrderData {
  id: string;
  orderNo: string;
  userId: string;
  items: OrderItem[];
  totalAmount: number;
  status: 'pending' | 'paid' | 'shipped' | 'delivered' | 'cancelled' | 'refunded';
  paymentMethod: 'alipay' | 'wechat' | 'card' | 'bank';
  shippingAddress: {
    name: string;
    phone: string;
    province: string;
    city: string;
    district: string;
    address: string;
    zipCode?: string;
  };
  createdAt: Date;
  paidAt?: Date;
  shippedAt?: Date;
  deliveredAt?: Date;
  remark?: string;
}

export interface OrderGeneratorOptions {
  userId?: string;
  itemCount?: number;
  status?: OrderData['status'];
  paymentMethod?: OrderData['paymentMethod'];
  customFields?: Record<string, any>;
}

const PRODUCTS = [
  { id: 'prod_001', name: '无线蓝牙耳机', price: 299 },
  { id: 'prod_002', name: '机械键盘', price: 459 },
  { id: 'prod_003', name: '游戏鼠标', price: 189 },
  { id: 'prod_004', name: '显示器支架', price: 399 },
  { id: 'prod_005', name: 'USB-C 扩展坞', price: 259 },
  { id: 'prod_006', name: '移动固态硬盘 1TB', price: 599 },
  { id: 'prod_007', name: '笔记本电脑支架', price: 159 },
  { id: 'prod_008', name: '桌面收纳盒', price: 89 },
];

const PROVINCES = ['北京市', '上海市', '广东省', '浙江省', '江苏省', '四川省', '湖北省', '山东省'];
const CITIES: Record<string, string[]> = {
  '北京市': ['北京市'],
  '上海市': ['上海市'],
  '广东省': ['广州市', '深圳市', '东莞市', '佛山市'],
  '浙江省': ['杭州市', '宁波市', '温州市', '绍兴市'],
  '江苏省': ['南京市', '苏州市', '无锡市', '常州市'],
  '四川省': ['成都市', '绵阳市', '德阳市'],
  '湖北省': ['武汉市', '宜昌市', '襄阳市'],
  '山东省': ['济南市', '青岛市', '烟台市', '潍坊市'],
};
const DISTRICTS = ['朝阳区', '海淀区', '东城区', '西城区', '天河区', '越秀区', '南山区', '福田区'];

export class OrderGenerator {
  static generate(options: OrderGeneratorOptions = {}): OrderData {
    const {
      userId,
      itemCount = DataGenerator.randomNumber(1, 5),
      status,
      paymentMethod,
      customFields = {},
    } = options;

    const items: OrderItem[] = [];
    let totalAmount = 0;

    const shuffledProducts = [...PRODUCTS].sort(() => Math.random() - 0.5);
    const selectedProducts = shuffledProducts.slice(0, Math.min(itemCount, PRODUCTS.length));

    for (const product of selectedProducts) {
      const quantity = DataGenerator.randomNumber(1, 3);
      const subtotal = product.price * quantity;
      items.push({
        id: DataGenerator.randomId('item_'),
        productId: product.id,
        productName: product.name,
        price: product.price,
        quantity,
        subtotal,
      });
      totalAmount += subtotal;
    }

    const orderStatus = status || this._randomStatus();
    const payment = paymentMethod || DataGenerator.randomArrayItem(['alipay', 'wechat', 'card', 'bank'] as OrderData['paymentMethod'][]);

    const province = DataGenerator.randomArrayItem(PROVINCES);
    const city = DataGenerator.randomArrayItem(CITIES[province] || [province]);
    const district = DataGenerator.randomArrayItem(DISTRICTS);

    const createdAt = DataGenerator.randomDate(new Date(Date.now() - 30 * 24 * 60 * 60 * 1000));
    let paidAt: Date | undefined;
    let shippedAt: Date | undefined;
    let deliveredAt: Date | undefined;

    if (orderStatus !== 'pending' && orderStatus !== 'cancelled') {
      paidAt = new Date(createdAt.getTime() + DataGenerator.randomNumber(1, 60) * 60 * 1000);
    }
    if (orderStatus === 'shipped' || orderStatus === 'delivered') {
      shippedAt = new Date(paidAt!.getTime() + DataGenerator.randomNumber(1, 48) * 60 * 60 * 1000);
    }
    if (orderStatus === 'delivered') {
      deliveredAt = new Date(shippedAt!.getTime() + DataGenerator.randomNumber(12, 72) * 60 * 60 * 1000);
    }

    return {
      id: DataGenerator.randomId('ord_'),
      orderNo: this._generateOrderNo(),
      userId: userId || DataGenerator.randomId('usr_'),
      items,
      totalAmount: Number(totalAmount.toFixed(2)),
      status: orderStatus,
      paymentMethod: payment,
      shippingAddress: {
        name: DataGenerator.randomString({ prefix: '用户', length: 2, charset: DataGenerator.LOWER_CHARSET }),
        phone: DataGenerator.randomPhone(),
        province,
        city,
        district,
        address: `${district}某某路${DataGenerator.randomNumber(1, 999)}号${DataGenerator.randomNumber(1, 30)}栋${DataGenerator.randomNumber(1, 30)}单元`,
        zipCode: DataGenerator.randomString({ length: 6, charset: DataGenerator.NUMBER_CHARSET }),
      },
      createdAt,
      paidAt,
      shippedAt,
      deliveredAt,
      remark: DataGenerator.randomBoolean() ? '测试订单，请勿发货' : undefined,
      ...customFields,
    };
  }

  static generateBatch(count: number, options: OrderGeneratorOptions = {}): OrderData[] {
    return DataGenerator.generateBatch(count, () => this.generate(options));
  }

  static generatePaidOrder(options: OrderGeneratorOptions = {}): OrderData {
    return this.generate({ ...options, status: 'paid' });
  }

  static generateBatchPaidOrders(count: number, options: OrderGeneratorOptions = {}): OrderData[] {
    return this.generateBatch(count, { ...options, status: 'paid' });
  }

  private static _generateOrderNo(): string {
    const now = new Date();
    const dateStr = now.getFullYear().toString() +
      (now.getMonth() + 1).toString().padStart(2, '0') +
      now.getDate().toString().padStart(2, '0');
    const randomStr = DataGenerator.randomString({ length: 8, charset: DataGenerator.NUMBER_CHARSET });
    return `${dateStr}${randomStr}`;
  }

  private static _randomStatus(): OrderData['status'] {
    const statuses: OrderData['status'][] = ['pending', 'paid', 'shipped', 'delivered', 'cancelled', 'refunded'];
    const weights = [0.1, 0.2, 0.2, 0.3, 0.1, 0.1];
    const random = Math.random();
    let cumulative = 0;
    
    for (let i = 0; i < statuses.length; i++) {
      cumulative += weights[i];
      if (random < cumulative) {
        return statuses[i];
      }
    }
    return 'delivered';
  }
}
