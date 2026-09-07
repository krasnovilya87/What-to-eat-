import { Recipe } from '../types';

export interface SuggestionResult {
  name: string;
  reason: string;
  missingIngredients: string[];
  isNew: boolean;
}

// Clean and extract root/stem from ingredient string
function cleanIngredient(name: string): string {
  return name
    .toLowerCase()
    .replace(/[-_,\(\)\.:\d]/g, ' ')
    .replace(/\b(кг|г|гр|мл|л|литр|килограмм|грамм|шт|штук|ст|ложка|ч|зубчик|пучок|пачка|банка|по вкусу)\b/g, ' ')
    .trim();
}

function matchesIngredient(inventoryItem: string, recipeIngredient: string): boolean {
  const inv = cleanIngredient(inventoryItem);
  const rec = cleanIngredient(recipeIngredient);

  if (!inv || !rec) return false;

  // Direct substring
  if (rec.includes(inv) || inv.includes(rec)) return true;

  // Stem check (word root >= 3 letters)
  const invWords = inv.split(/\s+/).filter(w => w.length >= 3);
  const recWords = rec.split(/\s+/).filter(w => w.length >= 3);

  for (const iw of invWords) {
    const root = iw.slice(0, Math.min(iw.length - 1, 5));
    for (const rw of recWords) {
      if (rw.startsWith(root) || iw.startsWith(rw.slice(0, Math.min(rw.length - 1, 5)))) {
        return true;
      }
    }
  }

  return false;
}

interface CatalogDish {
  name: string;
  ingredients: string[];
  keyIngredients: string[];
}

const POPULAR_CATALOG: CatalogDish[] = [
  {
    name: 'Шакшука с томатами',
    ingredients: ['Яйца', 'Помидоры', 'Лук', 'Чеснок', 'Растительное масло'],
    keyIngredients: ['яйц', 'помидор']
  },
  {
    name: 'Нежный омлет с сыром',
    ingredients: ['Яйца', 'Молоко', 'Сыр', 'Сливочное масло'],
    keyIngredients: ['яйц', 'сыр']
  },
  {
    name: 'Домашние сырники',
    ingredients: ['Творог', 'Яйца', 'Мука', 'Сахар'],
    keyIngredients: ['творог']
  },
  {
    name: 'Блинчики тонкие',
    ingredients: ['Молоко', 'Мука', 'Яйца', 'Сахар', 'Растительное масло'],
    keyIngredients: ['молок', 'мук']
  },
  {
    name: 'Паста с чесноком, сыром и зеленью',
    ingredients: ['Макароны', 'Сыр', 'Чеснок', 'Растительное масло'],
    keyIngredients: ['макарон', 'сыр']
  },
  {
    name: 'Запечённое куриное филе с овощами',
    ingredients: ['Куриное филе', 'Помидоры', 'Сыр', 'Чеснок', 'Специи'],
    keyIngredients: ['кур']
  },
  {
    name: 'Картофель по-деревенски с чесноком',
    ingredients: ['Картофель', 'Чеснок', 'Растительное масло', 'Специи'],
    keyIngredients: ['картоф']
  },
  {
    name: 'Гречневая каша с жареным луком',
    ingredients: ['Гречка', 'Лук', 'Сливочное масло'],
    keyIngredients: ['греч']
  },
  {
    name: 'Овощной салат с сыром',
    ingredients: ['Помидоры', 'Огурцы', 'Сыр', 'Растительное масло'],
    keyIngredients: ['помидор', 'огур']
  },
  {
    name: 'Французские гренки',
    ingredients: ['Хлеб', 'Яйца', 'Молоко', 'Сливочное масло'],
    keyIngredients: ['хлеб', 'яйц']
  },
  {
    name: 'Драники картофельные',
    ingredients: ['Картофель', 'Яйца', 'Мука', 'Лук'],
    keyIngredients: ['картоф', 'яйц']
  },
  {
    name: 'Куриный суп с лапшой',
    ingredients: ['Курица', 'Картофель', 'Морковь', 'Лук', 'Макароны'],
    keyIngredients: ['кур', 'картоф']
  }
];

export function generateLocalSuggestions(
  inventoryNames: string[],
  savedRecipes: Recipe[]
): SuggestionResult[] {
  const results: SuggestionResult[] = [];
  const cleanInv = inventoryNames.filter(Boolean);

  if (cleanInv.length === 0) {
    return [];
  }

  // 1. Анализируем сохраненные рецепты пользователя
  const savedMatches: {
    recipe: Recipe;
    missing: string[];
    matchRatio: number;
  }[] = [];

  for (const recipe of savedRecipes) {
    if (!recipe.ingredients || recipe.ingredients.length === 0) continue;

    const missing: string[] = [];
    let matchedCount = 0;

    for (const ing of recipe.ingredients) {
      const isAvailable = cleanInv.some(invItem => matchesIngredient(invItem, ing));
      if (isAvailable) {
        matchedCount++;
      } else {
        missing.push(ing);
      }
    }

    const matchRatio = matchedCount / recipe.ingredients.length;

    // Предлагаем, если есть хотя бы 30% или не хватает 1-2 ингредиентов
    if (missing.length <= 2 || matchRatio >= 0.3) {
      savedMatches.push({ recipe, missing, matchRatio });
    }
  }

  // Сортируем: сначала те, где меньше всего не хватает ингредиентов
  savedMatches.sort((a, b) => {
    if (a.missing.length !== b.missing.length) {
      return a.missing.length - b.missing.length;
    }
    return b.matchRatio - a.matchRatio;
  });

  for (const item of savedMatches) {
    let reason = '';
    if (item.missing.length === 0) {
      reason = 'Все ингредиенты есть в наличии! Можно готовить прямо сейчас.';
    } else if (item.missing.length === 1) {
      reason = `Не хватает только одного ингредиента: ${item.missing[0]}`;
    } else {
      reason = `Не хватает ${item.missing.length} ингредиентов: ${item.missing.slice(0, 3).join(', ')}`;
    }

    results.push({
      name: item.recipe.name,
      reason,
      missingIngredients: item.missing,
      isNew: false
    });
  }

  // 2. Добавляем идеи из популярного каталога блюд
  const existingNames = new Set(results.map(r => r.name.toLowerCase()));

  for (const dish of POPULAR_CATALOG) {
    if (existingNames.has(dish.name.toLowerCase())) continue;

    // Проверяем, есть ли хотя бы один ключевой продукт
    const hasKey = dish.keyIngredients.some(key =>
      cleanInv.some(inv => inv.toLowerCase().includes(key))
    );

    if (!hasKey) continue;

    const missing: string[] = [];
    let matchedCount = 0;

    for (const ing of dish.ingredients) {
      const isAvailable = cleanInv.some(inv => matchesIngredient(inv, ing));
      if (isAvailable) {
        matchedCount++;
      } else {
        missing.push(ing);
      }
    }

    // Предлагаем, если есть больше половины продуктов или не хватает максимум 2
    if (matchedCount >= 2 && missing.length <= 3) {
      let reason = '';
      if (missing.length === 0) {
        reason = 'Отличная идея из ваших продуктов! Все ингредиенты на месте.';
      } else {
        reason = `У вас есть основа. Не хватает: ${missing.join(', ')}`;
      }

      results.push({
        name: dish.name,
        reason,
        missingIngredients: missing,
        isNew: true
      });
    }
  }

  // Если ничего точного не нашлось, но продукты есть — предлагаем простые комбинации
  if (results.length === 0 && cleanInv.length > 0) {
    results.push({
      name: `Быстрое блюдо из ${cleanInv.slice(0, 2).join(' и ')}`,
      reason: 'Используйте имеющиеся продукты для простого гарнира или перекуса.',
      missingIngredients: [],
      isNew: true
    });
  }

  return results.slice(0, 8);
}
