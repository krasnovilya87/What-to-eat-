import { parseQuantity, cleanIngredientName } from './ingredients';
import { ShoppingItem } from '../types';

export interface Department {
  id: string;
  name: string;
  icon: string;
  order: number;
}

export const SUPERMARKET_DEPARTMENTS: Department[] = [
  { id: 'produce', name: 'Овощи, фрукты, зелень и ягоды', icon: '🥦', order: 1 },
  { id: 'meat', name: 'Мясо и птица', icon: '🥩', order: 2 },
  { id: 'fish', name: 'Рыба и морепродукты', icon: '🐟', order: 3 },
  { id: 'dairy', name: 'Молочные продукты и яйца', icon: '🥛', order: 4 },
  { id: 'bakery', name: 'Хлеб и выпечка', icon: '🥖', order: 5 },
  { id: 'grocery', name: 'Бакалея и крупы', icon: '🌾', order: 6 },
  { id: 'sauces_spices', name: 'Масла, соусы и приправы', icon: '🥫', order: 7 },
  { id: 'drinks', name: 'Напитки', icon: '🧃', order: 8 },
  { id: 'sweets', name: 'Сладости и орехи', icon: '🍫', order: 9 },
  { id: 'other', name: 'Другие товары', icon: '🛒', order: 10 },
];

// Ключевые слова для классификации по отделам супермаркета
const DEPARTMENT_KEYWORDS: Record<string, string[]> = {
  produce: [
    'помидор', 'томат', 'огурц', 'огурец', 'лук', 'чеснок', 'чесноч', 'морков', 'картоф', 'картош',
    'болгарск', 'капуст', 'броккол', 'кабач', 'цукини', 'баклажан',
    // Зелень и травы (мята, базилик, укроп, кинза и т.д.)
    'зелен', 'укроп', 'петрушк', 'кинз', 'базилик', 'шпинат', 'салат', 'руккол',
    'мят', 'мята', 'мелисс', 'айсберг', 'сельдерей', 'эстрагон', 'тархун', 'щавел', 'щавель', 'черемш',
    'гриб', 'шампиньон', 'вешенк', 'лимон', 'лайм',
    'яблок', 'груш', 'банан', 'апельсин', 'мандарин', 'авокадо', 'виноград', 'персик', 'абрикос',
    'имбир', 'редис', 'свекл', 'тыква', 'кукуруз', 'горошек', 'перц', 'перец',
    // Ягоды и бахчевые:
    'ягод', 'клубник', 'малин', 'черник', 'голубик', 'земляник', 'ежевик', 'смородин',
    'брусник', 'клюкв', 'крыжовник', 'вишн', 'черешн', 'облепих', 'арбуз', 'дын',
    'инжир', 'гранат', 'киви', 'манго', 'ананас', 'хурм', 'слив', 'нектарин'
  ],
  meat: [
    'мяс', 'куриц', 'курин', 'цыплен', 'индейк', 'говядин', 'свинин', 'телятин',
    'фарш', 'бекон', 'ветчин', 'колбас', 'сосиск', 'сардельк', 'окорок', 'паштет',
    'буженин', 'ребрышк', 'гуляш', 'стейк', 'голень', 'бедр', 'крылышк', 'карбонад',
    'печень', 'грудк', 'филе'
  ],
  fish: [
    'рыб', 'лосос', 'семг', 'форел', 'тунец', 'треск', 'хек', 'минтай', 'сельд',
    'скумбри', 'креветк', 'кальмар', 'миди', 'морепродукт', 'краб', 'икра', 'судак',
    'горбуш', 'шпрот', 'крабов'
  ],
  dairy: [
    'молок', 'сыр', 'творог', 'сметан', 'масло сливочн', 'йогурт', 'кефир', 'сливк',
    'яйц', 'яйца', 'ряженк', 'простокваш', 'пармезан', 'моцарелл', 'сулугуни',
    'маскарпоне', 'рикотта', 'брынз', 'фета', 'чеддер', 'гауда', 'творожн'
  ],
  bakery: [
    'хлеб', 'батон', 'булк', 'булочк', 'лаваш', 'пита', 'тост', 'лепешк', 'тортиль',
    'багет', 'круассан', 'сухари', 'чиабатт', 'гренки', 'булочка'
  ],
  grocery: [
    'макарон', 'спагетт', 'паст', 'рис', 'гречк', 'овсянк', 'хлопь', 'мук',
    'манка', 'пшено', 'булгур', 'кускус', 'киноа', 'чечевиц', 'фасол', 'нут',
    'горох', 'крахмал', 'дрожж', 'сод', 'сахар', 'сахарозаменител'
  ],
  sauces_spices: [
    'масло растительн', 'масло подсолнечн', 'масло оливков', 'масло кунжутн',
    'соус', 'майонез', 'кетчуп', 'томатная паст', 'соев', 'горчиц', 'хрен',
    'уксус', 'соль', 'перец черн', 'перец молот', 'перец красн', 'паприк', 'кориандр', 'карри',
    'куркум', 'лавровый', 'прованск', 'итальянск', 'хмели-сунели', 'приправ',
    'специ', 'кориц', 'ванилин', 'орегано', 'тимьян', 'розмарин', 'растительное масло'
  ],
  drinks: [
    'вод', 'сок', 'чай', 'кофе', 'морс', 'компот', 'лимонад', 'газировк',
    'квас', 'напиток', 'минералк', 'пиво', 'вино'
  ],
  sweets: [
    'шоколад', 'конфет', 'печень', 'вафл', 'торт', 'пирожн', 'мед', 'варень',
    'джем', 'орех', 'фундук', 'миндал', 'грецкий орех', 'арахис', 'кешью',
    'изюм', 'кураг', 'чернослив', 'зефир', 'мармелад', 'халва', 'чипс'
  ]
};

export function getDepartmentForItem(itemName: string): Department {
  if (!itemName) return SUPERMARKET_DEPARTMENTS.find(d => d.id === 'other')!;
  
  const lower = itemName.toLowerCase();
  
  // Проверка специй и соусов с высоким приоритетом (например "черный перец", "молотый перец")
  if (lower.includes('черн') && lower.includes('перц') || lower.includes('молот') || lower.includes('паприк') || lower.includes('приправ') || lower.includes('специ')) {
    return SUPERMARKET_DEPARTMENTS.find(d => d.id === 'sauces_spices')!;
  }

  for (const [deptId, keywords] of Object.entries(DEPARTMENT_KEYWORDS)) {
    for (const kw of keywords) {
      if (lower.includes(kw)) {
        const found = SUPERMARKET_DEPARTMENTS.find(d => d.id === deptId);
        if (found) return found;
      }
    }
  }
  
  return SUPERMARKET_DEPARTMENTS.find(d => d.id === 'other')!;
}

// Нормализация наименования для сопоставления дубликатов
export function normalizeProductKey(name: string): string {
  let cleaned = cleanIngredientName(name).toLowerCase();
  
  // Убираем общие служебные слова и скобки
  cleaned = cleaned.replace(/\(.*?\)/g, '');
  cleaned = cleaned.replace(/\b(свежий|свежие|свежая|замороженный|спелый|нарезанный|по вкусу)\b/g, '');
  cleaned = cleaned.replace(/[-,\s]+/g, ' ').trim();
  
  // Приведение простых множественных форм к единственным для распространенных продуктов
  if (cleaned.endsWith('цы')) cleaned = cleaned.replace(/цы$/, 'ц'); // огурцы -> огурец
  if (cleaned.endsWith('ы') && cleaned.length > 4) cleaned = cleaned.slice(0, -1); // помидоры -> помидор
  if (cleaned.endsWith('и') && cleaned.length > 4) cleaned = cleaned.slice(0, -1);
  if (cleaned === 'яйца' || cleaned === 'яйцо') cleaned = 'яйца';
  if (cleaned.includes('курин') && cleaned.includes('филе')) cleaned = 'куриное филе';
  
  return cleaned;
}

// Сложение двух строковых количеств (например "200 г" + "300 г" = "500 г", "2 шт" + "3 шт" = "5 шт")
export function sumQuantities(q1?: string, q2?: string): string | undefined {
  if (!q1 && !q2) return undefined;
  if (!q1) return q2;
  if (!q2) return q1;
  
  const p1 = parseQuantity(q1);
  const p2 = parseQuantity(q2);
  
  if (p1 && p2 && p1.unit === p2.unit) {
    let totalVal = p1.val + p2.val;
    let unit = p1.unit;
    
    // Перевод больших граммов в кг, миллилитров в литры
    if (unit === 'г' && totalVal >= 1000) {
      return `${parseFloat((totalVal / 1000).toFixed(1))} кг`;
    }
    if (unit === 'мл' && totalVal >= 1000) {
      return `${parseFloat((totalVal / 1000).toFixed(1))} л`;
    }
    
    return `${parseFloat(totalVal.toFixed(1))} ${unit}`;
  }
  
  // Если единицы измерения не удалось распарсить или они разные
  if (q1 === q2) return q1;
  return `${q1} + ${q2}`;
}

// Слияние списка продуктов с объединением дубликатов и суммированием количеств
export function mergeShoppingItems(existing: ShoppingItem[], incoming: ShoppingItem[]): ShoppingItem[] {
  const result: ShoppingItem[] = [...existing];
  
  for (const item of incoming) {
    const itemKey = normalizeProductKey(item.name);
    
    // Ищем существующий товар с таким же ключом
    const existingIndex = result.findIndex(ex => {
      const exKey = normalizeProductKey(ex.name);
      return exKey === itemKey || (itemKey.length >= 4 && exKey.includes(itemKey)) || (exKey.length >= 4 && itemKey.includes(exKey));
    });
    
    if (existingIndex >= 0) {
      const target = result[existingIndex];
      const mergedQuantity = sumQuantities(target.quantity, item.quantity);
      
      result[existingIndex] = {
        ...target,
        quantity: mergedQuantity,
        // Если добавляется продукт для готовки, снимаем галочку (надо купить)
        checked: target.checked && item.checked,
        // Сохраняем более информативное название (например с заглавной буквы или более полное)
        name: target.name.length >= item.name.length ? target.name : item.name,
        isManual: target.isManual && item.isManual
      };
    } else {
      result.push(item);
    }
  }
  
  return result;
}

export function deduplicateShoppingList(items: ShoppingItem[]): ShoppingItem[] {
  return mergeShoppingItems([], items);
}
