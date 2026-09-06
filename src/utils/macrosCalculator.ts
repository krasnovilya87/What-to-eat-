import { Macros } from '../types';
import { parseQuantity, cleanIngredientName } from './ingredients';

export interface MacroCalculationResult {
  macros: Macros;
  totalWeight?: number;
  portions?: number;
}

// Справочник пищевой ценности базовых продуктов (на 100 г)
interface NutritionItem {
  calories: number; // ккал
  protein: number;  // г
  fat: number;      // г
  carbs: number;    // г
  defaultWeight?: number; // вес 1 штуки в граммах, если указано "1 шт"
}

const NUTRITION_DATABASE: Record<string, NutritionItem> = {
  // Мясо и птица
  'кур': { calories: 165, protein: 31, fat: 3.6, carbs: 0 },
  'филе': { calories: 120, protein: 24, fat: 2, carbs: 0 },
  'индейк': { calories: 145, protein: 22, fat: 5, carbs: 0 },
  'говяд': { calories: 250, protein: 26, fat: 15, carbs: 0 },
  'фарш': { calories: 240, protein: 18, fat: 18, carbs: 0 },
  'свин': { calories: 259, protein: 16, fat: 21.6, carbs: 0 },
  'бекон': { calories: 541, protein: 37, fat: 42, carbs: 1.4 },
  'колбас': { calories: 300, protein: 12, fat: 28, carbs: 1 },
  'сосиск': { calories: 260, protein: 11, fat: 24, carbs: 2, defaultWeight: 50 },

  // Рыба и морепродукты
  'рыб': { calories: 140, protein: 19, fat: 6, carbs: 0 },
  'лосос': { calories: 208, protein: 20, fat: 13, carbs: 0 },
  'семг': { calories: 208, protein: 20, fat: 13, carbs: 0 },
  'форел': { calories: 148, protein: 20.8, fat: 6.6, carbs: 0 },
  'треск': { calories: 78, protein: 17.7, fat: 0.7, carbs: 0 },
  'тунец': { calories: 130, protein: 28, fat: 1, carbs: 0 },
  'креветк': { calories: 95, protein: 20, fat: 1.5, carbs: 0 },

  // Яйца
  'яйц': { calories: 155, protein: 13, fat: 11, carbs: 1.1, defaultWeight: 55 },

  // Молочные продукты
  'молок': { calories: 58, protein: 3.2, fat: 3.2, carbs: 4.7 },
  'кефир': { calories: 53, protein: 2.9, fat: 2.5, carbs: 4 },
  'сливк': { calories: 206, protein: 2.8, fat: 20, carbs: 3.7 },
  'сметан': { calories: 206, protein: 2.5, fat: 20, carbs: 3.4 },
  'творог': { calories: 121, protein: 17, fat: 5, carbs: 2 },
  'сыр': { calories: 350, protein: 25, fat: 28, carbs: 0 },
  'пармезан': { calories: 431, protein: 38, fat: 29, carbs: 4 },
  'моцарелл': { calories: 280, protein: 22, fat: 22, carbs: 1 },
  'йогурт': { calories: 66, protein: 3.5, fat: 3.2, carbs: 4.5 },

  // Масла и жиры
  'сливоч': { calories: 748, protein: 0.8, fat: 82.5, carbs: 0.8 },
  'растит': { calories: 884, protein: 0, fat: 100, carbs: 0 },
  'оливк': { calories: 884, protein: 0, fat: 100, carbs: 0 },
  'подсолн': { calories: 884, protein: 0, fat: 100, carbs: 0 },
  'масл': { calories: 884, protein: 0, fat: 100, carbs: 0 },

  // Овощи
  'картош': { calories: 77, protein: 2, fat: 0.1, carbs: 16.3, defaultWeight: 100 },
  'помидор': { calories: 18, protein: 0.9, fat: 0.2, carbs: 3.9, defaultWeight: 120 },
  'томат': { calories: 18, protein: 0.9, fat: 0.2, carbs: 3.9, defaultWeight: 120 },
  'огур': { calories: 15, protein: 0.7, fat: 0.1, carbs: 3.6, defaultWeight: 100 },
  'морков': { calories: 41, protein: 0.9, fat: 0.2, carbs: 9.6, defaultWeight: 80 },
  'лук': { calories: 40, protein: 1.1, fat: 0.1, carbs: 9.3, defaultWeight: 80 },
  'чеснок': { calories: 149, protein: 6.5, fat: 0.5, carbs: 33, defaultWeight: 4 },
  'капуст': { calories: 25, protein: 1.3, fat: 0.1, carbs: 5.8 },
  'броккол': { calories: 34, protein: 2.8, fat: 0.4, carbs: 6.6 },
  'кабачок': { calories: 24, protein: 1.2, fat: 0.3, carbs: 4.6, defaultWeight: 250 },
  'баклажан': { calories: 25, protein: 1, fat: 0.2, carbs: 5.9, defaultWeight: 200 },
  'перец': { calories: 27, protein: 1, fat: 0.3, carbs: 5.3, defaultWeight: 150 },
  'гриб': { calories: 22, protein: 3.1, fat: 0.3, carbs: 3.3 },
  'шампиньон': { calories: 22, protein: 3.1, fat: 0.3, carbs: 3.3 },

  // Зелень
  'укроп': { calories: 43, protein: 3.5, fat: 0.7, carbs: 7 },
  'петрушк': { calories: 36, protein: 3, fat: 0.8, carbs: 6.3 },
  'зелен': { calories: 35, protein: 2.5, fat: 0.5, carbs: 5 },
  'шпинат': { calories: 23, protein: 2.9, fat: 0.4, carbs: 3.6 },
  'салат': { calories: 15, protein: 1.4, fat: 0.2, carbs: 2.9 },

  // Крупы, макароны, бобовые
  'рис': { calories: 360, protein: 7, fat: 1, carbs: 78 },
  'греч': { calories: 343, protein: 13, fat: 3.4, carbs: 71.5 },
  'овсян': { calories: 352, protein: 12.3, fat: 6.1, carbs: 65 },
  'геркулес': { calories: 352, protein: 12.3, fat: 6.1, carbs: 65 },
  'макарон': { calories: 350, protein: 12, fat: 1.5, carbs: 72 },
  'паст': { calories: 350, protein: 12, fat: 1.5, carbs: 72 },
  'спагетт': { calories: 350, protein: 12, fat: 1.5, carbs: 72 },
  'лапш': { calories: 350, protein: 12, fat: 1.5, carbs: 72 },
  'булгур': { calories: 342, protein: 12, fat: 1.3, carbs: 76 },
  'кускус': { calories: 376, protein: 12.8, fat: 0.6, carbs: 77.4 },
  'пшен': { calories: 348, protein: 11.5, fat: 3.3, carbs: 69.3 },
  'чечевиц': { calories: 314, protein: 24, fat: 1.5, carbs: 53 },
  'фасол': { calories: 298, protein: 21, fat: 2, carbs: 54 },
  'горох': { calories: 298, protein: 20.5, fat: 2, carbs: 53 },

  // Бакалея и выпечка
  'мук': { calories: 364, protein: 10.3, fat: 1.1, carbs: 76.3 },
  'хлеб': { calories: 265, protein: 9, fat: 3.2, carbs: 49 },
  'батон': { calories: 265, protein: 9, fat: 3.2, carbs: 49 },
  'сахар': { calories: 398, protein: 0, fat: 0, carbs: 99.8 },
  'мед': { calories: 304, protein: 0.3, fat: 0, carbs: 82.4 },
  'шоколад': { calories: 546, protein: 4.9, fat: 31, carbs: 61 },
  'орех': { calories: 654, protein: 15, fat: 65, carbs: 14 },

  // Фрукты и ягоды
  'яблок': { calories: 52, protein: 0.3, fat: 0.2, carbs: 13.8, defaultWeight: 150 },
  'банан': { calories: 89, protein: 1.1, fat: 0.3, carbs: 22.8, defaultWeight: 120 },
  'лимон': { calories: 29, protein: 1.1, fat: 0.3, carbs: 9, defaultWeight: 100 },
  'апельсин': { calories: 47, protein: 0.9, fat: 0.1, carbs: 11.8, defaultWeight: 150 },
  'ягод': { calories: 45, protein: 1, fat: 0.5, carbs: 10 },
  'клубник': { calories: 33, protein: 0.7, fat: 0.3, carbs: 7.7 }
};

// Поиск подходящей питательной ценности по тексту ингредиента
function findNutrition(name: string): NutritionItem | null {
  const cleaned = cleanIngredientName(name).toLowerCase();
  
  // Проверяем сливочное vs растительное масло
  if (cleaned.includes('сливоч') && cleaned.includes('масл')) {
    return NUTRITION_DATABASE['сливоч'];
  }
  if (cleaned.includes('растит') || cleaned.includes('оливк') || cleaned.includes('подсолн')) {
    return NUTRITION_DATABASE['растит'];
  }

  for (const [key, val] of Object.entries(NUTRITION_DATABASE)) {
    if (cleaned.includes(key)) {
      return val;
    }
  }

  return null;
}

// Приблизительный вес ингредиента в граммах
function estimateWeightInGrams(ingredient: string, nutrition: NutritionItem | null): number {
  const parsed = parseQuantity(ingredient);
  if (parsed) {
    if (parsed.unit === 'г') return parsed.val;
    if (parsed.unit === 'мл') return parsed.val; // плотность ~1
    if (parsed.unit === 'кг') return parsed.val; // parseQuantity уже умножает кг на 1000
    if (parsed.unit === 'л') return parsed.val;  // parseQuantity уже умножает л на 1000
    if (parsed.unit === 'ст.л') return parsed.val * 15;
    if (parsed.unit === 'ч.л') return parsed.val * 5;
    if (parsed.unit === 'зубчик') return parsed.val * 4;
    if (parsed.unit === 'щепотка') return parsed.val * 1;
    if (parsed.unit === 'пучок') return parsed.val * 30;
    if (parsed.unit === 'банка') return parsed.val * 400;
    if (parsed.unit === 'упаковка') return parsed.val * 250;
    if (parsed.unit === 'шт') {
      if (nutrition?.defaultWeight) {
        return parsed.val * nutrition.defaultWeight;
      }
      return parsed.val * 70; // стандартный вес штуки
    }
  }

  // Если количество не удалось распарсить
  const lower = ingredient.toLowerCase();
  if (lower.includes('соль') || lower.includes('перец') || lower.includes('специ')) {
    return 3;
  }
  if (lower.includes('масло')) {
    return 15;
  }

  return 100; // по умолчанию 100 г
}

// Локальный алгоритм расчёта КБЖУ (на случай отсутствия интернета или сбоя ИИ)
export function estimateMacrosLocally(
  ingredients: string[],
  dishName?: string
): MacroCalculationResult {
  let totalWeight = 0;
  let totalCalories = 0;
  let totalProtein = 0;
  let totalFat = 0;
  let totalCarbs = 0;

  for (const ing of ingredients) {
    if (!ing || typeof ing !== 'string') continue;
    const nutrition = findNutrition(ing) || {
      calories: 120,
      protein: 4,
      fat: 3,
      carbs: 15
    };

    const weight = estimateWeightInGrams(ing, nutrition);
    const multiplier = weight / 100;

    totalWeight += weight;
    totalCalories += nutrition.calories * multiplier;
    totalProtein += nutrition.protein * multiplier;
    totalFat += nutrition.fat * multiplier;
    totalCarbs += nutrition.carbs * multiplier;
  }

  if (totalWeight <= 0) {
    totalWeight = 300;
  }

  // Учитываем уварку / испарение воды при готовке (~10-15%)
  const cookedWeight = Math.max(100, Math.round(totalWeight * 0.9));

  const caloriesPer100g = Math.round((totalCalories / cookedWeight) * 100);
  const proteinPer100g = parseFloat(((totalProtein / cookedWeight) * 100).toFixed(1));
  const fatPer100g = parseFloat(((totalFat / cookedWeight) * 100).toFixed(1));
  const carbsPer100g = parseFloat(((totalCarbs / cookedWeight) * 100).toFixed(1));

  // Оценка количества порций (1 стандартная порция ~250-400г)
  const portions = Math.max(1, Math.round(cookedWeight / 300));

  return {
    macros: {
      calories: caloriesPer100g,
      protein: proteinPer100g,
      fat: fatPer100g,
      carbs: carbsPer100g
    },
    totalWeight: cookedWeight,
    portions
  };
}

// Основная функция: вызывает серверный ИИ с отказоустойчивым локальным фолбэком
export async function calculateMacros(
  ingredients: string[],
  dishName?: string,
  portions?: number
): Promise<MacroCalculationResult> {
  const cleanList = (ingredients || []).map(i => i.trim()).filter(Boolean);
  if (cleanList.length === 0) {
    return {
      macros: { calories: 0, protein: 0, fat: 0, carbs: 0 },
      portions: portions || 1,
      totalWeight: 300
    };
  }

  try {
    const res = await fetch('/api/calculate-macros', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        dishName: dishName || 'Блюдо',
        ingredients: cleanList,
        portions
      })
    });

    if (res.ok) {
      const data = await res.json();
      if (data && data.macros && (data.macros.calories > 0 || data.macros.protein > 0)) {
        return {
          macros: {
            calories: Math.round(data.macros.calories || 0),
            protein: parseFloat(Number(data.macros.protein || 0).toFixed(1)),
            fat: parseFloat(Number(data.macros.fat || 0).toFixed(1)),
            carbs: parseFloat(Number(data.macros.carbs || 0).toFixed(1))
          },
          totalWeight: data.totalWeight,
          portions: data.portions || portions
        };
      }
    }
  } catch (err) {
    console.warn('Серверный расчет КБЖУ недоступен, используем локальный расчет:', err);
  }

  // Фолбэк на локальный расчёт
  return estimateMacrosLocally(cleanList, dishName);
}
