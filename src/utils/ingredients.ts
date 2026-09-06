// Утилиты для парсинга, масштабирования и сопоставления ингредиентов

export interface ParsedQuantity {
  val: number;
  unit: string;
}

// Извлечение количества и единиц измерения
export function parseQuantity(q: string): ParsedQuantity | null {
  if (!q || typeof q !== 'string') return null;

  // Поддержка дробей (1/2, 1/4), диапазонов (2-3) и десятичных дробей (1.5, 1,5)
  const regex = /([\d]+(?:\/[\d]+)?|[\d\.,]+(?:\s*-\s*[\d\.,]+)?)\s*(кг|килограмм[а-я]*|г|гр\.?|грамм[а-я]*|ml|мл|миллилитр[а-я]*|л|литр[а-я]*|l|штук[а-я]*|шт\.?|зубчик[а-я]*|ст\.?\s*л\.?|столов[а-я]*\s*лож[а-я]*|ч\.?\s*л\.?|чайн[а-я]*\s*лож[а-я]*|пуч[а-я]*|щепотк[а-я]*|банк[а-я]*|упаковк[а-я]*|пач[а-я]*|стакан[а-я]*)/i;
  
  const match = q.match(regex);
  if (!match) return null;

  let rawNum = match[1].trim();
  let val = 0;

  if (rawNum.includes('/')) {
    const parts = rawNum.split('/');
    val = parseFloat(parts[0]) / parseFloat(parts[1]);
  } else if (rawNum.includes('-')) {
    const parts = rawNum.split('-');
    val = parseFloat(parts[0].replace(',', '.')); // берем нижнюю границу диапазона
  } else {
    val = parseFloat(rawNum.replace(',', '.'));
  }

  if (isNaN(val)) return null;

  const rawUnit = match[2].toLowerCase().replace('.', '');
  let unit = 'шт';

  if (rawUnit.startsWith('кг') || rawUnit.startsWith('килограмм')) {
    val *= 1000;
    unit = 'г';
  } else if (rawUnit.startsWith('г') || rawUnit.startsWith('гр') || rawUnit.startsWith('грамм')) {
    unit = 'г';
  } else if (rawUnit === 'л' || rawUnit === 'l' || rawUnit.startsWith('литр')) {
    val *= 1000;
    unit = 'мл';
  } else if (rawUnit.startsWith('мл') || rawUnit.startsWith('ml') || rawUnit.startsWith('миллилитр')) {
    unit = 'мл';
  } else if (rawUnit.startsWith('шт') || rawUnit.startsWith('штук')) {
    unit = 'шт';
  } else if (rawUnit.startsWith('зубчик')) {
    unit = 'зубчик';
  } else if (rawUnit.startsWith('пуч')) {
    unit = 'пучок';
  } else if (rawUnit.startsWith('щепот')) {
    unit = 'щепотка';
  } else if (rawUnit.startsWith('банк')) {
    unit = 'банка';
  } else if (rawUnit.startsWith('упаков') || rawUnit.startsWith('пач')) {
    unit = 'упаковка';
  } else if (rawUnit.includes('ст') && (rawUnit.includes('л') || rawUnit.includes('столов'))) {
    unit = 'ст.л';
  } else if (rawUnit.includes('ч') && (rawUnit.includes('л') || rawUnit.includes('чайн'))) {
    unit = 'ч.л';
  } else if (rawUnit.startsWith('стакан')) {
    val *= 200; // 1 стакан ~ 200 мл/г
    unit = 'мл';
  }

  return { val, unit };
}

// Очистка названия ингредиента от количеств, единиц и служебных слов
export function cleanIngredientName(name: string): string {
  if (!name || typeof name !== 'string') return '';

  let cleaned = name;

  // Убираем количества с единицами
  const qMatch = cleaned.match(/([\d]+(?:\/[\d]+)?|[\d\.,]+(?:\s*-\s*[\d\.,]+)?)\s*(кг|килограмм[а-я]*|г|гр\.?|грамм[а-я]*|ml|мл|миллилитр[а-я]*|л|литр[а-я]*|l|штук[а-я]*|шт\.?|зубчик[а-я]*|ст\.?\s*л\.?|столов[а-я]*\s*лож[а-я]*|ч\.?\s*л\.?|чайн[а-я]*\s*лож[а-я]*|пуч[а-я]*|щепотк[а-я]*|банк[а-я]*|упаковк[а-я]*|пач[а-я]*|стакан[а-я]*)/i);
  if (qMatch) {
    cleaned = cleaned.replace(qMatch[0], '');
  }

  // Убираем оставшиеся цифры
  cleaned = cleaned.replace(/\b\d+([.,]\d+)?\b/g, '');

  // Убираем пояснения в скобках
  cleaned = cleaned.replace(/\(.*?\)/g, '');

  // Убираем частые кулинарные служебные слова
  cleaned = cleaned.replace(/\b(по вкусу|для жарки|для подачи|для украшения|для соуса|свежий|свежие|свежая|замороженный|спелый|нарезанный|средний|среднего размера|крупный|мелкий)\b/gi, '');

  // Убираем знаки препинания по краям и лишние пробелы
  cleaned = cleaned.replace(/^[-—•:,\s]+/, '').replace(/[-—•:,\s]+$/, '').replace(/\s{2,}/g, ' ').trim();

  return cleaned;
}

// Масштабирование ингредиента при изменении числа порций
export function scaleIngredient(ingredient: string, ratio: number): string {
  if (!ingredient || ratio === 1) return ingredient;

  const match = ingredient.match(/([\d]+(?:\/[\d]+)?|[\d\.,]+)(\s*)(кг|г|гр\.?|грамм[а-я]*|ml|мл|л|l|штук[а-я]*|шт\.?|зубчик[а-я]*|ст\.?\s*л\.?|ч\.?\s*л\.?|пуч[а-я]*|щепотк[а-я]*|банк[а-я]*|упаковк[а-я]*|пач[а-я]*|стакан[а-я]*)/i);
  if (!match) return ingredient;

  let val = 0;
  if (match[1].includes('/')) {
    const p = match[1].split('/');
    val = parseFloat(p[0]) / parseFloat(p[1]);
  } else {
    val = parseFloat(match[1].replace(',', '.'));
  }

  if (isNaN(val)) return ingredient;

  val = val * ratio;
  const formattedVal = Number.isInteger(val) ? val.toString() : val.toFixed(1).replace(/\.0$/, '');

  return ingredient.substring(0, match.index) + formattedVal + match[2] + match[3] + ingredient.substring(match.index! + match[0].length);
}

// --- Русская стемматизация и кулинарные корни ---

// Кулинарные синонимы и канонические корни
const CULINARY_ROOTS: Record<string, string> = {
  // Яйца
  'яйцо': 'яйц',
  'яйца': 'яйц',
  'яиц': 'яйц',
  'яичко': 'яйц',
  'яичный': 'яйц',

  // Томаты / Помидоры
  'помидор': 'помидор',
  'помидоры': 'помидор',
  'помидорка': 'помидор',
  'помидоры-черри': 'помидор',
  'черри': 'помидор',
  'томат': 'помидор',
  'томаты': 'помидор',

  // Картофель
  'картофель': 'картош',
  'картошка': 'картош',
  'картошки': 'картош',
  'картофеля': 'картош',

  // Огурцы
  'огурец': 'огур',
  'огурцы': 'огур',
  'огурчик': 'огур',
  'огурчиков': 'огур',

  // Птица и мясо
  'курица': 'кур',
  'куриное': 'кур',
  'куриная': 'кур',
  'куриный': 'кур',
  'курицу': 'кур',
  'цыпленок': 'кур',
  'говядина': 'говяд',
  'говяжий': 'говяд',
  'свинина': 'свин',
  'индейка': 'индейк',
  'индейки': 'индейк',

  // Лук и чеснок
  'лук': 'лук',
  'луковица': 'лук',
  'лука': 'лук',
  'луковицы': 'лук',
  'чеснок': 'чеснок',
  'чеснока': 'чеснок',
  'чесночный': 'чеснок',

  // Морковь
  'морковь': 'морков',
  'морковка': 'морков',
  'морковки': 'морков',

  // Молочные продукты
  'молоко': 'молок',
  'молока': 'молок',
  'сливки': 'сливк',
  'сливок': 'сливк',
  'сметана': 'сметан',
  'сметаны': 'сметан',
  'творог': 'творог',
  'творога': 'творог',
  'сыр': 'сыр',
  'сыра': 'сыр',
  'пармезан': 'сыр',
  'моцарелла': 'сыр',

  // Крупы
  'геркулес': 'овсян',
  'овсянка': 'овсян',
  'овсяные': 'овсян',
  'овсяных': 'овсян',
  'гречка': 'греч',
  'гречневая': 'греч',
  'греча': 'греч',
  'рис': 'рис',
  'риса': 'рис',
  'рисовая': 'рис',
  'басмати': 'рис',
  'пшено': 'пшен',
  'манка': 'ман',

  // Выпечка и бакалея
  'мука': 'мук',
  'муки': 'мук',
  'сахар': 'сахар',
  'сахара': 'сахар',
  'соль': 'сол',
  'соли': 'сол',
  'соленый': 'сол',
  'перец': 'перц',
  'перца': 'перц',
  'перчик': 'перц',

  // Зелень
  'укроп': 'укроп',
  'укропа': 'укроп',
  'петрушка': 'петрушк',
  'петрушки': 'петрушк',
  'кинза': 'кинз',
  'кинзы': 'кинз',
  'базилик': 'базилик',
  'шпинат': 'шпинат'
};

// Простой русский стеммер для снятия падежных и грамматических окончаний
function stemRussianWord(word: string): string {
  if (!word || word.length <= 2) return word;
  const w = word.toLowerCase().replace(/ё/g, 'е');

  // Проверяем специальный кулинарный справочник
  if (CULINARY_ROOTS[w]) return CULINARY_ROOTS[w];

  // Снятие стандартных окончаний прилагательных и существительных
  let s = w;
  s = s.replace(/(ыми|ими|ому|ему|ого|его|ых|их|ую|юю|ая|яя|ое|ее|ые|ие|ым|им|ом|ем|ой|ей|ый|ий)$/, '');
  s = s.replace(/(ами|ями|ах|ях|ом|ем|ей|ой|ия|ья|ие|ье|ов|ев|ам|ям|а|я|о|е|у|ю|ы|и|ь)$/, '');

  return s.length >= 2 ? s : w;
}

// Извлечение значимых корней из названия ингредиента
function extractKeywords(name: string): string[] {
  const cleaned = cleanIngredientName(name).toLowerCase();
  const words = cleaned
    .replace(/[^а-яa-z0-9]/gi, ' ')
    .split(/\s+/)
    .filter(w => w.length >= 2);

  return words.map(w => stemRussianWord(w));
}

// Проверка на конфликт уточняющих модификаторов (например, масло сливочное vs оливковое)
function hasModifierConflict(tokensA: string[], tokensB: string[]): boolean {
  const isButterA = tokensA.some(t => t.startsWith('сливоч') || t.startsWith('сливк'));
  const isButterB = tokensB.some(t => t.startsWith('сливоч') || t.startsWith('сливк'));

  const isVegOilA = tokensA.some(t => t.startsWith('растит') || t.startsWith('оливк') || t.startsWith('подсолн'));
  const isVegOilB = tokensB.some(t => t.startsWith('растит') || t.startsWith('оливк') || t.startsWith('подсолн'));

  if ((isButterA && isVegOilB) || (isVegOilA && isButterB)) {
    return true; // Сливочное и растительное масло не должны заменять друг друга
  }

  const isBlackPepperA = tokensA.some(t => t.startsWith('черн'));
  const isBellPepperA = tokensA.some(t => t.startsWith('болгар') || t.startsWith('сладк'));
  const isBlackPepperB = tokensB.some(t => t.startsWith('черн'));
  const isBellPepperB = tokensB.some(t => t.startsWith('болгар') || t.startsWith('сладк'));

  if ((isBlackPepperA && isBellPepperB) || (isBellPepperA && isBlackPepperB)) {
    return true; // Черный перец-специя и болгарский сладкий перец не должны заменять друг друга
  }

  return false;
}

// Умное сопоставление ингредиента рецепта с продуктом в инвентаре
export function isIngredientMatch(
  recipeIngredient: string,
  inventoryName: string
): boolean {
  if (!recipeIngredient || !inventoryName) return false;

  const rawRecipe = recipeIngredient.toLowerCase().trim();
  const rawInv = inventoryName.toLowerCase().trim();

  // 1. Полное совпадение строк
  if (rawRecipe === rawInv) return true;

  const cleanRecipe = cleanIngredientName(rawRecipe).toLowerCase();
  const cleanInv = cleanIngredientName(rawInv).toLowerCase();

  if (cleanRecipe === cleanInv) return true;

  // 2. Прямое вхождение очищенных названий (например, "Куриное филе" и "Филе", "Сыр" и "Сыр российский")
  if (cleanRecipe.length >= 3 && cleanInv.length >= 3) {
    if (cleanRecipe.includes(cleanInv) || cleanInv.includes(cleanRecipe)) {
      const tokensA = extractKeywords(cleanRecipe);
      const tokensB = extractKeywords(cleanInv);
      if (!hasModifierConflict(tokensA, tokensB)) {
        return true;
      }
    }
  }

  // 3. Сопоставление по корням слов (стемминг)
  const stemsRecipe = extractKeywords(cleanRecipe);
  const stemsInv = extractKeywords(cleanInv);

  if (stemsRecipe.length === 0 || stemsInv.length === 0) return false;

  if (hasModifierConflict(stemsRecipe, stemsInv)) {
    return false;
  }

  // Проверяем, пересекаются ли ключевые корни
  for (const rStem of stemsRecipe) {
    for (const iStem of stemsInv) {
      if (rStem === iStem) return true;
      if (rStem.length >= 4 && iStem.length >= 4) {
        if (rStem.startsWith(iStem) || iStem.startsWith(rStem)) return true;
      }
    }
  }

  return false;
}

// Поиск наиболее подходящего продукта из инвентаря
export function findMatchingInventoryItem(
  ingredient: string,
  inventory: { name: string; quantity?: string }[]
): { name: string; quantity?: string } | null {
  if (!ingredient || !inventory || inventory.length === 0) return null;

  for (const item of inventory) {
    if (item && item.name && isIngredientMatch(ingredient, item.name)) {
      return item;
    }
  }

  return null;
}

// Проверка статуса наличия ингредиента (зеленый / желтый / красный)
export function checkIngredientStatus(
  ingredient: string,
  inventory: { name: string; quantity?: string }[]
): 'green' | 'yellow' | 'red' {
  if (!ingredient || typeof ingredient !== 'string') return 'red';

  const matchedItem = findMatchingInventoryItem(ingredient, inventory);
  if (!matchedItem) return 'red';

  // Извлекаем количества
  const ingQ = parseQuantity(ingredient);
  // Количество в инвентаре может быть в поле quantity, либо в самом name
  const invQ = parseQuantity(matchedItem.quantity || matchedItem.name);

  // Если у продукта в холодильнике не указано количество, или в рецепте нет точного числа
  // (например "по вкусу" или "соль"), считаем, что продукт есть в наличии -> зеленый
  if (!invQ || !ingQ) {
    return 'green';
  }

  // Если единицы измерения совместимы
  if (invQ.unit === ingQ.unit) {
    if (invQ.val >= ingQ.val) {
      return 'green';
    } else {
      return 'yellow'; // Есть, но меньше, чем требуется по рецепту
    }
  }

  // Если единицы не сравнимы напрямую (например "2 шт" и "150 г"),
  // но продукт есть в инвентаре -> считаем его имеющимся
  return 'green';
}

// Расчет недостающих продуктов для добавления в список покупок
export function calculateNeededIngredients(
  ingredients: string[],
  inventory: { name: string; quantity?: string }[]
): { name: string; quantity?: string }[] {
  const toBuyMap = new Map<string, { val: number; unit: string; originalName: string } | null>();

  (ingredients || []).forEach(ing => {
    if (!ing || typeof ing !== 'string') return;

    const matchedItem = findMatchingInventoryItem(ing, inventory);
    const ingQ = parseQuantity(ing);

    if (!matchedItem) {
      // Продукта совсем нет в инвентаре -> покупаем полностью
      toBuyMap.set(ing, ingQ ? { val: ingQ.val, unit: ingQ.unit, originalName: ing } : null);
    } else {
      const invQ = parseQuantity(matchedItem.quantity || matchedItem.name);

      if (ingQ && invQ && ingQ.unit === invQ.unit) {
        if (invQ.val < ingQ.val) {
          // В инвентаре есть часть, докупаем разницу
          const diff = ingQ.val - invQ.val;
          const key = cleanIngredientName(matchedItem.name) || matchedItem.name;
          const existing = toBuyMap.get(key);
          if (existing) {
            existing.val += diff;
          } else {
            toBuyMap.set(key, { val: diff, unit: invQ.unit, originalName: key });
          }
        }
      }
      // Если у продукта нет количества, считаем что он есть и покупать не нужно
    }
  });

  return Array.from(toBuyMap.entries()).map(([name, q]) => {
    if (!q) {
      return { name: cleanIngredientName(name) || name };
    }

    let displayVal = q.val;
    let displayUnit = q.unit;
    if (q.unit === 'г' && displayVal >= 1000) {
      displayVal /= 1000;
      displayUnit = 'кг';
    }
    if (q.unit === 'мл' && displayVal >= 1000) {
      displayVal /= 1000;
      displayUnit = 'л';
    }

    return {
      name: cleanIngredientName(q.originalName) || q.originalName || name,
      quantity: `${parseFloat(displayVal.toFixed(1))} ${displayUnit}`
    };
  });
}
