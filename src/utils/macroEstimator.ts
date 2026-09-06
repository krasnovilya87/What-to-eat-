import { Macros } from '../types';
import { parseQuantity } from './ingredients';

// Базовая питательная ценность на 100 грамм продукта
const NUTRITION_DATABASE: Array<{ pattern: RegExp; per100g: Macros }> = [
  // Мясо и птица
  { pattern: /кури|филе|грудк/i, per100g: { calories: 120, protein: 23, fat: 2.5, carbs: 0 } },
  { pattern: /индейк/i, per100g: { calories: 130, protein: 22, fat: 4, carbs: 0 } },
  { pattern: /говядин|телятин/i, per100g: { calories: 190, protein: 20, fat: 12, carbs: 0 } },
  { pattern: /свинин/i, per100g: { calories: 260, protein: 16, fat: 22, carbs: 0 } },
  { pattern: /фарш/i, per100g: { calories: 220, protein: 18, fat: 16, carbs: 0 } },
  
  // Рыба и морепродукты
  { pattern: /лосос|семг|форел/i, per100g: { calories: 200, protein: 20, fat: 13, carbs: 0 } },
  { pattern: /треск|минтай|хек/i, per100g: { calories: 85, protein: 18, fat: 1, carbs: 0 } },
  { pattern: /креветк|кальмар/i, per100g: { calories: 95, protein: 19, fat: 1.5, carbs: 1 } },
  { pattern: /тунец/i, per100g: { calories: 130, protein: 28, fat: 1, carbs: 0 } },
  
  // Молочные продукты и яйца
  { pattern: /яйц/i, per100g: { calories: 155, protein: 13, fat: 11, carbs: 0.7 } }, // ~75 ккал за яйцо С0 (55г)
  { pattern: /творог.*9/i, per100g: { calories: 160, protein: 16, fat: 9, carbs: 3 } },
  { pattern: /творог/i, per100g: { calories: 120, protein: 18, fat: 4, carbs: 3 } },
  { pattern: /молок.*3\.2/i, per100g: { calories: 60, protein: 3, fat: 3.2, carbs: 4.7 } },
  { pattern: /молок/i, per100g: { calories: 53, protein: 3, fat: 2.5, carbs: 4.7 } },
  { pattern: /сыр/i, per100g: { calories: 350, protein: 24, fat: 28, carbs: 1 } },
  { pattern: /сметан.*15/i, per100g: { calories: 160, protein: 2.6, fat: 15, carbs: 3.6 } },
  { pattern: /сметан/i, per100g: { calories: 205, protein: 2.5, fat: 20, carbs: 3.4 } },
  { pattern: /йогурт/i, per100g: { calories: 75, protein: 4.5, fat: 3, carbs: 7 } },
  { pattern: /масло сливочн/i, per100g: { calories: 748, protein: 0.8, fat: 82.5, carbs: 0.8 } },
  
  // Бакалея и крупы
  { pattern: /овсян|геркулес/i, per100g: { calories: 360, protein: 12, fat: 6, carbs: 65 } },
  { pattern: /гречк/i, per100g: { calories: 330, protein: 12.6, fat: 3.3, carbs: 62 } },
  { pattern: /рис/i, per100g: { calories: 340, protein: 7, fat: 1, carbs: 75 } },
  { pattern: /макарон|паста|спагетт/i, per100g: { calories: 350, protein: 13, fat: 1.5, carbs: 72 } },
  { pattern: /масло оливк|масло растит/i, per100g: { calories: 899, protein: 0, fat: 99.8, carbs: 0 } },
  
  // Хлеб и выпечка
  { pattern: /хлеб/i, per100g: { calories: 250, protein: 8, fat: 2.5, carbs: 48 } },
  { pattern: /батон|булк/i, per100g: { calories: 270, protein: 8.5, fat: 3, carbs: 52 } },
  { pattern: /лаваш/i, per100g: { calories: 240, protein: 8, fat: 1, carbs: 48 } },
  
  // Овощи и зелень
  { pattern: /помидор|томат/i, per100g: { calories: 20, protein: 1, fat: 0.2, carbs: 4 } },
  { pattern: /огур/i, per100g: { calories: 15, protein: 0.8, fat: 0.1, carbs: 3 } },
  { pattern: /картоф/i, per100g: { calories: 80, protein: 2, fat: 0.4, carbs: 18 } },
  { pattern: /морков/i, per100g: { calories: 35, protein: 1.3, fat: 0.1, carbs: 7 } },
  { pattern: /лук/i, per100g: { calories: 40, protein: 1.4, fat: 0.2, carbs: 9 } },
  { pattern: /чеснок/i, per100g: { calories: 140, protein: 6.5, fat: 0.5, carbs: 30 } },
  { pattern: /капуст/i, per100g: { calories: 28, protein: 1.8, fat: 0.2, carbs: 5 } },
  { pattern: /зелен|петрушк|укроп/i, per100g: { calories: 40, protein: 3.5, fat: 0.5, carbs: 6 } },
  
  // Фрукты и ягоды
  { pattern: /банан/i, per100g: { calories: 95, protein: 1.5, fat: 0.3, carbs: 22 } },
  { pattern: /яблок/i, per100g: { calories: 50, protein: 0.4, fat: 0.4, carbs: 12 } },
  { pattern: /апельсин|мандарин/i, per100g: { calories: 43, protein: 0.9, fat: 0.2, carbs: 9 } },
  { pattern: /ягод|клубник|малин/i, per100g: { calories: 45, protein: 1, fat: 0.5, carbs: 9 } },
  
  // Сладости
  { pattern: /шоколад/i, per100g: { calories: 540, protein: 6, fat: 35, carbs: 50 } },
  { pattern: /печень/i, per100g: { calories: 430, protein: 7, fat: 15, carbs: 68 } }
];

export function estimateItemMacros(name: string, quantityStr?: string): Macros {
  // Ищем совпадение в справочнике
  const match = NUTRITION_DATABASE.find(item => item.pattern.test(name));
  const basePer100 = match ? match.per100g : { calories: 140, protein: 6, fat: 5, carbs: 18 };

  // Вычисляем примерный вес в граммах из quantityStr
  let weightInGrams = 200; // средний вес по умолчанию (1 упаковка или порция)

  if (quantityStr) {
    const qLower = quantityStr.toLowerCase().trim();

    // Яйца поштучно
    if (/яйц/i.test(name) && /\d+/.test(qLower)) {
      const countMatch = qLower.match(/(\d+)/);
      const count = countMatch ? parseInt(countMatch[1], 10) : 10;
      weightInGrams = count * 55; // среднее яйцо ~55г
    } else if (/(\d+(?:[.,]\d+)?)\s*кг/i.test(qLower)) {
      const num = parseFloat(qLower.match(/(\d+(?:[.,]\d+)?)\s*кг/i)![1].replace(',', '.'));
      weightInGrams = num * 1000;
    } else if (/(\d+(?:[.,]\d+)?)\s*г/i.test(qLower)) {
      const num = parseFloat(qLower.match(/(\d+(?:[.,]\d+)?)\s*г/i)![1].replace(',', '.'));
      weightInGrams = num;
    } else if (/(\d+(?:[.,]\d+)?)\s*л/i.test(qLower)) {
      const num = parseFloat(qLower.match(/(\d+(?:[.,]\d+)?)\s*л/i)![1].replace(',', '.'));
      weightInGrams = num * 1000;
    } else if (/(\d+(?:[.,]\d+)?)\s*мл/i.test(qLower)) {
      const num = parseFloat(qLower.match(/(\d+(?:[.,]\d+)?)\s*мл/i)![1].replace(',', '.'));
      weightInGrams = num;
    } else if (/(\d+)\s*шт/i.test(qLower)) {
      const count = parseInt(qLower.match(/(\d+)\s*шт/i)![1], 10);
      // Если чеснок или штучный фрукт
      if (/чеснок/i.test(name)) weightInGrams = count * 40;
      else if (/банан/i.test(name)) weightInGrams = count * 150;
      else if (/яблок/i.test(name)) weightInGrams = count * 180;
      else weightInGrams = count * 150;
    }
  }

  const factor = weightInGrams / 100;

  return {
    calories: Math.round(basePer100.calories * factor),
    protein: Math.round(basePer100.protein * factor * 10) / 10,
    fat: Math.round(basePer100.fat * factor * 10) / 10,
    carbs: Math.round(basePer100.carbs * factor * 10) / 10
  };
}

export function getItemMacros(item: { name: string; quantity?: string; macros?: Macros }): Macros {
  if (item.macros && (item.macros.calories > 0 || item.macros.protein > 0)) {
    return item.macros;
  }
  return estimateItemMacros(item.name, item.quantity);
}
