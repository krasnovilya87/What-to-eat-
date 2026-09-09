import { Recipe, RecipeCategory } from '../types';
import { SuggestionResult } from './suggestionEngine';

export interface TargetMacros {
  calories: number;
  protein?: number;
  fat?: number;
  carbs?: number;
}

export interface DishMacroStats {
  sug: SuggestionResult;
  matchedRecipe?: Recipe;
  calories: number;
  protein: number;
  fat: number;
  carbs: number;
  portions: number;
}

export interface MacroCombo {
  dishes: DishMacroStats[];
  totalCalories: number;
  totalProtein: number;
  totalFat: number;
  totalCarbs: number;
  targetCalories: number;
  diffPercent: number; // e.g. -2.5% or +4.1%
  isWithin10Percent: boolean;
}

export function extractDishMacroStats(
  sug: SuggestionResult,
  matchedRecipe?: Recipe
): DishMacroStats {
  const portions = sug.portions || matchedRecipe?.portions || matchedRecipe?.basePortions || 2;
  let calories = 0;
  let protein = 0;
  let fat = 0;
  let carbs = 0;

  if (matchedRecipe?.macros && matchedRecipe.macros.calories > 0) {
    if (matchedRecipe.totalWeight && matchedRecipe.basePortions && matchedRecipe.basePortions > 0) {
      const portionWeight = matchedRecipe.totalWeight / matchedRecipe.basePortions;
      calories = Math.round((matchedRecipe.macros.calories * portionWeight) / 100);
      protein = Math.round(((matchedRecipe.macros.protein || 0) * portionWeight) / 100);
      fat = Math.round(((matchedRecipe.macros.fat || 0) * portionWeight) / 100);
      carbs = Math.round(((matchedRecipe.macros.carbs || 0) * portionWeight) / 100);
    } else {
      calories = matchedRecipe.macros.calories;
      protein = matchedRecipe.macros.protein || 0;
      fat = matchedRecipe.macros.fat || 0;
      carbs = matchedRecipe.macros.carbs || 0;
    }
  } else if (sug.calories && sug.calories > 0) {
    calories = sug.calories;
    protein = Math.round(calories * 0.04);
    fat = Math.round(calories * 0.035);
    carbs = Math.round(calories * 0.1);
  } else {
    calories = 260;
    protein = 14;
    fat = 9;
    carbs = 30;
  }

  return {
    sug,
    matchedRecipe,
    calories: Math.max(90, calories),
    protein: Math.max(2, protein),
    fat: Math.max(1, fat),
    carbs: Math.max(2, carbs),
    portions
  };
}

/**
 * Подбор комбинации блюд, сумма калорий которых попадает в Target +- 10%
 */
export function findMacroCombinations(
  candidates: Array<{ sug: SuggestionResult; matchedRecipe?: Recipe }>,
  target: TargetMacros
): MacroCombo[] {
  if (!target || target.calories <= 0 || candidates.length === 0) {
    return [];
  }

  // Извлекаем и фильтруем кандидатов
  const seen = new Set<string>();
  const statsList: DishMacroStats[] = [];

  for (const c of candidates) {
    const key = c.sug.name.toLowerCase().trim();
    if (seen.has(key)) continue;
    seen.add(key);
    statsList.push(extractDishMacroStats(c.sug, c.matchedRecipe));
  }

  if (statsList.length === 0) return [];

  const targetCal = target.calories;
  const minCal = targetCal * 0.9;
  const maxCal = targetCal * 1.1;

  // Ограничиваем пул до 32 блюд для быстрого и разнообразного перебора
  const pool = statsList.slice(0, 32);
  const n = pool.length;

  // Определяем диапазон размеров комбинаций (от 2 до 4 блюд)
  let minDishes = 2;
  let maxDishes = 4;
  if (targetCal < 800) {
    minDishes = 1;
    maxDishes = 2;
  } else if (targetCal > 2600) {
    minDishes = 3;
    maxDishes = 5;
  }

  const validCombos: Array<{ combo: DishMacroStats[]; score: number; totalCal: number; totalProt: number; totalFat: number; totalCarbs: number; isExact: boolean }> = [];
  let closestCombo: { combo: DishMacroStats[]; totalCal: number; totalProt: number; totalFat: number; totalCarbs: number; diff: number } | null = null;

  function evaluateCombo(subset: DishMacroStats[]) {
    let totCal = 0;
    let totProt = 0;
    let totFat = 0;
    let totCarbs = 0;
    const catSet = new Set<string>();

    for (const d of subset) {
      totCal += d.calories;
      totProt += d.protein;
      totFat += d.fat;
      totCarbs += d.carbs;
      catSet.add(d.sug.category || 'Другое');
    }

    const diff = Math.abs(totCal - targetCal);
    if (!closestCombo || diff < closestCombo.diff) {
      closestCombo = {
        combo: subset,
        totalCal: totCal,
        totalProt: totProt,
        totalFat: totFat,
        totalCarbs: totCarbs,
        diff
      };
    }

    const isExact = totCal >= minCal && totCal <= maxCal;

    // Оцениваем качество комбинации:
    // 1. Отклонение от целевых калорий
    const calPenalty = (diff / targetCal) * 100;
    // 2. Разнообразие категорий (бонус за разные категории: завтрак + горячее + салат)
    const varietyBonus = (catSet.size / subset.length) * 18;
    // 3. Доступность ингредиентов
    let missingPenalty = 0;
    for (const d of subset) {
      missingPenalty += (d.sug.missingIngredients?.length || 0) * 1.5;
    }
    // 4. Макросы, если заданы
    let macroPenalty = 0;
    if (target.protein && target.protein > 0) {
      macroPenalty += (Math.abs(totProt - target.protein) / target.protein) * 20;
    }
    if (target.fat && target.fat > 0) {
      macroPenalty += (Math.abs(totFat - target.fat) / target.fat) * 20;
    }
    if (target.carbs && target.carbs > 0) {
      macroPenalty += (Math.abs(totCarbs - target.carbs) / target.carbs) * 20;
    }

    const score = calPenalty - varietyBonus + missingPenalty + macroPenalty;

    if (isExact || (diff / targetCal) <= 0.18) {
      validCombos.push({
        combo: subset,
        score,
        totalCal: totCal,
        totalProt: totProt,
        totalFat: totFat,
        totalCarbs: totCarbs,
        isExact
      });
    }
  }

  // Рекурсивный поиск комбинаций
  function search(startIndex: number, current: DishMacroStats[], currentCalories: number, targetSize: number) {
    if (current.length === targetSize) {
      evaluateCombo(current);
      return;
    }

    const remainingSlots = targetSize - current.length;
    for (let i = startIndex; i <= n - remainingSlots; i++) {
      const nextCal = currentCalories + pool[i].calories;
      // Прерываем ветку, если уже сильно превысили максимальный порог
      if (nextCal > maxCal * 1.25) continue;
      current.push(pool[i]);
      search(i + 1, current, nextCal, targetSize);
      current.pop();
    }
  }

  for (let size = minDishes; size <= maxDishes; size++) {
    search(0, [], 0, size);
  }

  if (validCombos.length === 0 && closestCombo) {
    const diffPct = Number((((closestCombo.totalCal - targetCal) / targetCal) * 100).toFixed(1));
    return [{
      dishes: closestCombo.combo,
      totalCalories: closestCombo.totalCal,
      totalProtein: closestCombo.totalProt,
      totalFat: closestCombo.totalFat,
      totalCarbs: closestCombo.totalCarbs,
      targetCalories: targetCal,
      diffPercent: diffPct,
      isWithin10Percent: Math.abs(diffPct) <= 10
    }];
  }

  // Сортируем: сначала попадающие строго в +-10%, затем по общему скору
  validCombos.sort((a, b) => {
    if (a.isExact !== b.isExact) {
      return a.isExact ? -1 : 1;
    }
    return a.score - b.score;
  });

  return validCombos.slice(0, 15).map(v => {
    const diffPct = Number((((v.totalCal - targetCal) / targetCal) * 100).toFixed(1));
    return {
      dishes: v.combo,
      totalCalories: v.totalCal,
      totalProtein: v.totalProt,
      totalFat: v.totalFat,
      totalCarbs: v.totalCarbs,
      targetCalories: targetCal,
      diffPercent: diffPct,
      isWithin10Percent: Math.abs(diffPct) <= 10
    };
  });
}
