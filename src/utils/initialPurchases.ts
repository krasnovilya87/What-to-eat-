import { ReceiptPurchase } from '../types';

export function getInitialPurchases(): ReceiptPurchase[] {
  const now = Date.now();
  const dayMs = 24 * 60 * 60 * 1000;

  const formatDate = (d: Date) => d.toISOString().split('T')[0];

  const date1 = new Date(now - dayMs * 6);
  const date2 = new Date(now - dayMs * 3);
  const date3 = new Date(now - dayMs * 1);

  return [
    {
      id: 'receipt-seed-1',
      storeName: 'ВкусВилл',
      date: formatDate(date1),
      timestamp: date1.getTime(),
      totalAmount: 1145,
      items: [
        { id: 'item-1-1', name: 'Молоко 3.2%', quantity: '1 л', price: 92, category: 'Молочные продукты', macros: { calories: 600, protein: 30, fat: 32, carbs: 47 } },
        { id: 'item-1-2', name: 'Творог 9%', quantity: '200 г', price: 135, category: 'Молочные продукты', macros: { calories: 320, protein: 32, fat: 18, carbs: 6 } },
        { id: 'item-1-3', name: 'Филе куриной грудки', quantity: '800 г', price: 420, category: 'Мясо и птица', macros: { calories: 960, protein: 184, fat: 20, carbs: 0 } },
        { id: 'item-1-4', name: 'Помидоры Черри', quantity: '250 г', price: 189, category: 'Овощи и фрукты', macros: { calories: 50, protein: 2.5, fat: 0.5, carbs: 10 } },
        { id: 'item-1-5', name: 'Хлеб ремесленный', quantity: '350 г', price: 89, category: 'Хлеб и выпечка', macros: { calories: 875, protein: 28, fat: 8.8, carbs: 168 } },
        { id: 'item-1-6', name: 'Бананы', quantity: '1 кг', price: 140, category: 'Овощи и фрукты', macros: { calories: 950, protein: 15, fat: 3, carbs: 220 } },
        { id: 'item-1-7', name: 'Чеснок', quantity: '1 шт', price: 45, category: 'Овощи и фрукты', macros: { calories: 56, protein: 2.6, fat: 0.2, carbs: 12 } },
        { id: 'item-1-8', name: 'Шоколад горький', quantity: '90 г', price: 135, category: 'Сладости и снеки', macros: { calories: 486, protein: 5.4, fat: 31.5, carbs: 45 } },
      ]
    },
    {
      id: 'receipt-seed-2',
      storeName: 'Пятёрочка',
      date: formatDate(date2),
      timestamp: date2.getTime(),
      totalAmount: 830,
      items: [
        { id: 'item-2-1', name: 'Яйца С0', quantity: '10 шт', price: 129, category: 'Молочные продукты', macros: { calories: 750, protein: 65, fat: 55, carbs: 3.5 } },
        { id: 'item-2-2', name: 'Овсяные хлопья', quantity: '500 г', price: 85, category: 'Бакалея', macros: { calories: 1800, protein: 60, fat: 30, carbs: 325 } },
        { id: 'item-2-3', name: 'Сливочное масло 82.5%', quantity: '180 г', price: 210, category: 'Молочные продукты', macros: { calories: 1346, protein: 1.4, fat: 148.5, carbs: 1.4 } },
        { id: 'item-2-4', name: 'Яблоки сезонные', quantity: '1.2 кг', price: 168, category: 'Овощи и фрукты', macros: { calories: 600, protein: 4.8, fat: 4.8, carbs: 144 } },
        { id: 'item-2-5', name: 'Макароны твердых сортов', quantity: '450 г', price: 98, category: 'Бакалея', macros: { calories: 1575, protein: 58.5, fat: 6.8, carbs: 324 } },
        { id: 'item-2-6', name: 'Минеральная вода', quantity: '1.5 л', price: 65, category: 'Напитки', macros: { calories: 0, protein: 0, fat: 0, carbs: 0 } },
        { id: 'item-2-7', name: 'Петрушка свежая', quantity: '50 г', price: 45, category: 'Овощи и фрукты', macros: { calories: 20, protein: 1.8, fat: 0.3, carbs: 3 } },
        { id: 'item-2-8', name: 'Чёрный перец молотый', quantity: '20 г', price: 30, category: 'Соусы и приправы', macros: { calories: 50, protein: 2, fat: 0.6, carbs: 8 } },
      ]
    },
    {
      id: 'receipt-seed-3',
      storeName: 'Перекрёсток',
      date: formatDate(date3),
      timestamp: date3.getTime(),
      totalAmount: 1470,
      items: [
        { id: 'item-3-1', name: 'Сыр Российский', quantity: '300 г', price: 285, category: 'Молочные продукты', macros: { calories: 1050, protein: 72, fat: 84, carbs: 3 } },
        { id: 'item-3-2', name: 'Лосось стейк', quantity: '400 г', price: 680, category: 'Рыба и морепродукты', macros: { calories: 800, protein: 80, fat: 52, carbs: 0 } },
        { id: 'item-3-3', name: 'Огурцы пупырчатые', quantity: '600 г', price: 145, category: 'Овощи и фрукты', macros: { calories: 90, protein: 4.8, fat: 0.6, carbs: 18 } },
        { id: 'item-3-4', name: 'Сметана 15%', quantity: '300 г', price: 98, category: 'Молочные продукты', macros: { calories: 480, protein: 7.8, fat: 45, carbs: 10.8 } },
        { id: 'item-3-5', name: 'Оливковое масло', quantity: '500 мл', price: 262, category: 'Бакалея', macros: { calories: 4100, protein: 0, fat: 455, carbs: 0 } },
      ]
    }
  ];
}
