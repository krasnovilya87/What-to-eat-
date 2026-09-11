import { Recipe, RecipeCategory, InventoryItem, ShoppingItem } from '../types';
import { POPULAR_CATALOG } from './suggestionEngine';
import { apiPost } from './api';

export interface AssistantActionItem {
  name: string;
  quantity?: string;
  section?: 'fridge' | 'grains' | 'spices';
}

export interface AiAssistantResult {
  reply: string;
  addedFridgeItems?: AssistantActionItem[];
  addedShoppingItems?: Array<{ name: string; quantity?: string }>;
  removedInventory?: string[];
  suggestedRecipe?: Recipe;
  isCookToday?: boolean;
}

const GRAINS_KEYWORDS = [
  'круп', 'рис', 'гречк', 'овсянк', 'геркулес', 'перловк', 'пшен', 'кускус',
  'булгур', 'киноа', 'макарон', 'спагетти', 'паст', 'лапш', 'мук', 'манк',
  'хлопья', 'фасол', 'чечевиц', 'горох', 'нут'
];

const SPICES_KEYWORDS = [
  'соль', 'перец', 'масл', 'соус', 'соев', 'уксус', 'майонез', 'кетчуп',
  'горчиц', 'специ', 'приправ', 'сахар', 'ванилин', 'кориц', 'разрыхлител',
  'дрожж', 'прованск', 'орегано', 'базилик', 'паприк', 'кориандр', 'лавровый'
];

function determineSection(productName: string): 'fridge' | 'grains' | 'spices' {
  const lower = productName.toLowerCase();
  for (const kw of GRAINS_KEYWORDS) {
    if (lower.includes(kw)) return 'grains';
  }
  for (const kw of SPICES_KEYWORDS) {
    if (lower.includes(kw)) return 'spices';
  }
  return 'fridge';
}

// Словарь нормализации родительного и винительного падежей частых продуктов
const GENITIVE_MAP: Record<string, string> = {
  'молока': 'Молоко',
  'молоко': 'Молоко',
  'сыра': 'Сыр',
  'сыр': 'Сыр',
  'хлеба': 'Хлеб',
  'хлеб': 'Хлеб',
  'батона': 'Батон',
  'батон': 'Батон',
  'масла': 'Масло',
  'масло': 'Масло',
  'сливочного масла': 'Сливочное масло',
  'яиц': 'Яйца',
  'яйца': 'Яйца',
  'яйцо': 'Яйца',
  'сметаны': 'Сметана',
  'сметана': 'Сметана',
  'творога': 'Творог',
  'творог': 'Творог',
  'кефира': 'Кефир',
  'кефир': 'Кефир',
  'сахара': 'Сахар',
  'сахар': 'Сахар',
  'соли': 'Соль',
  'соль': 'Соль',
  'муки': 'Мука',
  'мука': 'Мука',
  'курицы': 'Курица',
  'курицу': 'Курица',
  'курица': 'Курица',
  'куриного филе': 'Куриное филе',
  'куриное филе': 'Куриное филе',
  'мяса': 'Мясо',
  'мясо': 'Мясо',
  'рыбы': 'Рыба',
  'рыбу': 'Рыба',
  'рыба': 'Рыба',
  'картошки': 'Картофель',
  'картофеля': 'Картофель',
  'картофель': 'Картофель',
  'лука': 'Лук',
  'лук': 'Лук',
  'моркови': 'Морковь',
  'морковь': 'Морковь',
  'морковки': 'Морковь',
  'помидоров': 'Помидоры',
  'помидоры': 'Помидоры',
  'томатов': 'Помидоры',
  'огурцов': 'Огурцы',
  'огурцы': 'Огурцы',
  'чеснока': 'Чеснок',
  'чеснок': 'Чеснок',
  'чая': 'Чай',
  'чай': 'Чай',
  'кофе': 'Кофе',
  'воды': 'Вода',
  'вода': 'Вода',
  'яблок': 'Яблоки',
  'яблоки': 'Яблоки',
  'бананов': 'Бананы',
  'бананы': 'Бананы',
  'сосисок': 'Сосиски',
  'сосиски': 'Сосиски',
  'колбасы': 'Колбаса',
  'колбасу': 'Колбаса',
  'колбаса': 'Колбаса'
};

// Извлечение количества и названия из фразы
export function parseItemWithQuantity(raw: string): { name: string; quantity?: string } {
  let cleaned = raw.trim().replace(/^[-*•+]\s*/, '');
  if (!cleaned) return { name: '' };

  // Шаблон для поиска количества в конце или в середине: "молоко 1 л", "сыр 200г", "яйца 10 шт"
  const qtyRegex = /(?:^|\s)(\d+(?:[.,]\d+)?)\s*(кг|килограмм(?:а|ов)?|г|гр|грамм(?:а|ов)?|мл|л|литр(?:а|ов)?|шт|штук(?:и|а)?|пачк(?:а|и|ек)?|банк(?:а|и|ек)?|бутылк(?:а|и)?|упаковк(?:а|и|ек)?|ст\.?\s*л\.?|ч\.?\s*л\.?)?(?:\s|$)/i;
  
  const match = cleaned.match(qtyRegex);
  if (match) {
    const num = match[1];
    const unit = match[2] ? match[2].trim() : 'шт';
    const quantity = `${num} ${unit}`.trim();
    // Удаляем количество из названия
    const nameOnly = cleaned.replace(match[0], ' ').trim().replace(/\s+/g, ' ');
    const lowerName = nameOnly.toLowerCase();
    const formattedName = GENITIVE_MAP[lowerName] || (nameOnly.charAt(0).toUpperCase() + nameOnly.slice(1));
    return { name: formattedName || 'Продукт', quantity };
  }

  // Если количество указано через дефис ("Молоко - 1 л")
  const dashParts = cleaned.split(/\s*[-—]\s*/);
  if (dashParts.length === 2 && /\d/.test(dashParts[1])) {
    const name = dashParts[0].trim();
    const lowerName = name.toLowerCase();
    const formattedName = GENITIVE_MAP[lowerName] || (name.charAt(0).toUpperCase() + name.slice(1));
    return { name: formattedName, quantity: dashParts[1].trim() };
  }

  const lowerName = cleaned.toLowerCase();
  const formatted = GENITIVE_MAP[lowerName] || (cleaned.charAt(0).toUpperCase() + cleaned.slice(1));
  return { name: formatted };
}

// Надёжное извлечение товаров для списка покупок из фразы любой структуры
export function extractShoppingItems(prompt: string): Array<{ name: string; quantity?: string }> {
  let cleaned = prompt
    // Удаляем фразы списка покупок
    .replace(/(?:в\s+)?(?:список\s+покупок|список|покупки|покупок)/gi, ' ')
    // Удаляем глаголы и служебные слова
    .replace(/(?:добавь(?:те)?|добавить|занеси(?:те)?|запиши(?:те)?|включи(?:те)?|внеси(?:те)?|купи(?:ть)?|надо\s+купить|нужно\s+купить|хочу\s+купить|пожалуйста)/gi, ' ')
    .replace(/^\s*(?:в|на|для)\s+/i, ' ')
    .trim();

  if (!cleaned) return [];

  const rawItems = cleaned
    .split(/[,;\n]+|\s+(?:и|да|а\s+еще|а\s+также)\s+/i)
    .map(s => s.trim())
    .filter(s => s.length > 0 && !/^(?:в|на|из|с|по|для|список|покупки|покупок|штук|шт)$/i.test(s));

  const items: Array<{ name: string; quantity?: string }> = [];
  for (const raw of rawItems) {
    const parsed = parseItemWithQuantity(raw);
    if (parsed.name && parsed.name.length > 1) {
      items.push(parsed);
    }
  }

  return items;
}

// Надёжное извлечение продуктов для холодильника / кладовой
export function extractFridgeItems(prompt: string): AssistantActionItem[] {
  let cleaned = prompt
    .replace(/(?:в\s+)?(?:холодильник\w*|морозилк\w*|кладов\w*|шкаф\w*|наличи\w*)/gi, ' ')
    .replace(/(?:добавь(?:те)?|добавить|положи(?:те)?|занеси(?:те)?|запиши(?:те)?|купил(?:а|и)?|у\s+меня\s+есть|дома\s+есть|в\s+наличии|есть|пожалуйста)/gi, ' ')
    .replace(/^\s*(?:в|на|для)\s+/i, ' ')
    .trim();

  if (!cleaned) return [];

  const rawItems = cleaned
    .split(/[,;\n]+|\s+(?:и|да|а\s+еще|а\s+также)\s+/i)
    .map(s => s.trim())
    .filter(s => s.length > 0 && !/^(?:в|на|из|с|по|для|холодильник|наличии|штук|шт)$/i.test(s));

  const items: AssistantActionItem[] = [];
  for (const raw of rawItems) {
    const parsed = parseItemWithQuantity(raw);
    if (parsed.name && parsed.name.length > 1) {
      const section = determineSection(parsed.name);
      items.push({ ...parsed, section });
    }
  }

  return items;
}

// Локальный разбор естественного языка
export function processAssistantLocal(
  prompt: string,
  existingState: {
    recipes: Recipe[];
    fridge: InventoryItem[];
    grains: InventoryItem[];
    spices: InventoryItem[];
    shoppingList: ShoppingItem[];
  }
): AiAssistantResult {
  const lowerPrompt = prompt.toLowerCase().trim();
  const result: AiAssistantResult = {
    reply: 'Готово!'
  };

  const addedFridge: AssistantActionItem[] = [];
  const addedShopping: Array<{ name: string; quantity?: string }> = [];
  const removedInventory: string[] = [];

  // 1. Проверка удаления продуктов ("закончилось молоко", "съели сыр")
  const isRemoval = /(?:закончил|съел|удали|убери|выброси|нет больше)/i.test(lowerPrompt);
  if (isRemoval) {
    const allInv = [...existingState.fridge, ...existingState.grains, ...existingState.spices];
    for (const inv of allInv) {
      const invStem = inv.name.toLowerCase().slice(0, 4);
      if (invStem.length >= 3 && lowerPrompt.includes(invStem)) {
        removedInventory.push(inv.name);
      }
    }
    if (removedInventory.length > 0) {
      result.removedInventory = removedInventory;
      result.reply = `Убрал из вашего наличия: ${removedInventory.join(', ')}.`;
      return result;
    }
  }

  // 2. Определение намерений пользователя (без ASCII \b, корректно для кириллицы)
  const shoppingTriggers = /(?:покуп|список(?:\s+покупок)?|купи|надо\s+купить|нужно\s+купить|в\s+покупки|в\s+список|запиши\s+в\s+список|добавь\s+(?:в\s+)?покуп)/i;
  const fridgeTriggers = /(?:холодильник|морозилк|кладов|у\s+меня\s+есть|купил|дома\s+есть|в\s+наличии|положи\s+в\s+холодильник)/i;
  // РЕЦЕПТ предлагается по прямой просьбе пользователя, поиску, идеям блюд или вопросу о готовке
  const cookTriggers = /(?:найди|найти|поищи|покажи|подскажи|какой-нибудь|что\s+(?:можно\s+)?приготовить|как\s+приготовить|рецепт|блюд|предложи\s+(?:блюдо|рецепт)|хочу\s+приготовить|хочу\s+поесть|свари|пожарь|испе|приготов|что\s+сварить|что\s+пожарить|что\s+поесть|меню|ужин|обед|завтрак)/i;

  const hasShopping = shoppingTriggers.test(lowerPrompt);
  const hasFridge = fridgeTriggers.test(lowerPrompt);
  const hasCook = cookTriggers.test(lowerPrompt);
  const isSearchQuery = /(?:найди|найти|поищи|покажи|какой-нибудь|рецепт|блюд)/i.test(lowerPrompt);

  // 3. Извлечение продуктов для списка покупок (только если прямо попросили о покупках)
  if (hasShopping) {
    const items = extractShoppingItems(prompt);
    for (const it of items) {
      addedShopping.push(it);
    }
  }

  // 4. Извлечение продуктов для холодильника / кладовой
  if (hasFridge) {
    const items = extractFridgeItems(prompt);
    for (const it of items) {
      addedFridge.push(it);
    }
  }

  // 5. Если пользователь просто продиктовал список продуктов (например "молоко, сыр, хлеб 1 шт")
  // без слов "приготовить/рецепт/найди", добавляем их в список покупок
  if (!hasShopping && !hasFridge && !hasCook && !isSearchQuery && lowerPrompt.length > 2) {
    const items = extractShoppingItems(prompt);
    if (items.length > 0) {
      for (const it of items) {
        addedShopping.push(it);
      }
    }
  }

  // 6. Подбор или генерация рецепта — по просьбе о готовке или поиске рецептов
  if (hasCook) {
    let matchedDish = POPULAR_CATALOG.find(d => {
      const dishLower = d.name.toLowerCase();
      const dishWords = dishLower.split(/\s+/);
      return dishWords.some(w => {
        const stem = w.slice(0, 4);
        return stem.length >= 3 && lowerPrompt.includes(stem);
      });
    });

    if (!matchedDish) {
      const existingMatched = existingState.recipes.find(r => {
        const rLower = (r.name || (r as any).title || '').toLowerCase();
        const rWords = rLower.split(/\s+/);
        return rWords.some(w => {
          const stem = w.slice(0, 4);
          return stem.length >= 3 && lowerPrompt.includes(stem);
        });
      });
      if (existingMatched) {
        matchedDish = {
          name: existingMatched.name,
          ingredients: existingMatched.ingredients,
          keyIngredients: [],
          imageUrl: existingMatched.imageUrl,
          calories: existingMatched.macros?.calories || 260,
          portions: existingMatched.portions || 2,
          category: existingMatched.category,
          instructions: existingMatched.instructions
        };
      }
    }

    if (!matchedDish) {
      if (/на\s+ужин|ужин/i.test(lowerPrompt)) {
        matchedDish = POPULAR_CATALOG.find(d => d.category === 'Курица' || d.category === 'Мясо' || d.category === 'Рыба') || POPULAR_CATALOG[0];
      } else if (/на\s+завтрак|завтрак/i.test(lowerPrompt)) {
        matchedDish = POPULAR_CATALOG.find(d => d.category === 'Завтрак') || POPULAR_CATALOG[0];
      } else if (/на\s+обед|обед/i.test(lowerPrompt)) {
        matchedDish = POPULAR_CATALOG.find(d => d.category === 'Курица' || d.category === 'Мясо') || POPULAR_CATALOG[0];
      }
    }

    if (!matchedDish) {
      let dishName = prompt.trim()
        .replace(/^(?:найди(?:\s+мне)?|покажи|поищи|подскажи|какой-нибудь|хочу(?:\s+поесть|\s+приготовить|\s+сегодня)?|приготовь|свари|пожарь|сделай|рецепт(?:\s+с|\s+из)?|что\s+приготовить(?:\s+на\s+(?:ужин|обед|завтрак))?|что\s+поесть)\s*/i, '')
        .replace(/^[?.,!\s]+|[?.,!\s]+$/g, '')
        .trim();
      if (!dishName || dishName.length < 3) dishName = 'Аппетитное домашнее блюдо';
      dishName = dishName.charAt(0).toUpperCase() + dishName.slice(1);

      let cat: RecipeCategory = 'Завтрак';
      if (/мяс|говядин|свинин|стейк|фарш/i.test(lowerPrompt)) cat = 'Мясо';
      else if (/куриц|индейк|цыпленок|филе/i.test(lowerPrompt)) cat = 'Курица';
      else if (/рыб|лосос|семг|тунец|креветк|морепродукт/i.test(lowerPrompt)) cat = 'Рыба';
      else if (/салат/i.test(lowerPrompt)) cat = 'Салаты';
      else if (/десерт|сладк|торт|пирог|блин|сырник/i.test(lowerPrompt)) cat = 'Десерты, перекус';

      matchedDish = {
        name: dishName,
        ingredients: [
          'Основные ингредиенты - по вкусу',
          'Специи и соль - по вкусу',
          'Растительное или сливочное масло - 1 ст. л.'
        ],
        keyIngredients: [],
        imageUrl: 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&w=800&q=80',
        calories: 280,
        portions: 2,
        category: cat,
        instructions: [
          'Подготовить все ингредиенты, очистить и нарезать.',
          'Обжарить или потушить на среднем огне до готовности.',
          'Приправить специями по вкусу и подавать к столу горячим.'
        ]
      };
    }

    result.suggestedRecipe = {
      id: `ai-rec-${Date.now()}`,
      name: matchedDish.name,
      category: matchedDish.category || 'Завтрак',
      ingredients: matchedDish.ingredients,
      instructions: matchedDish.instructions || ['Приготовить ингредиенты и следовать рецепту.'],
      imageUrl: matchedDish.imageUrl,
      portions: matchedDish.portions || 2,
      basePortions: matchedDish.portions || 2,
      macros: {
        protein: 12,
        fat: 10,
        carbs: 22,
        calories: matchedDish.calories || 250
      }
    };
    result.isCookToday = /сегодня|сейчас|на ужин|на обед|на завтрак/i.test(lowerPrompt);
  }

  // Формируем текстовый ответ ассистента
  const replyParts: string[] = [];
  if (addedShopping.length > 0) {
    result.addedShoppingItems = addedShopping;
    replyParts.push(`Добавил в список покупок: ${addedShopping.map(i => `${i.name}${i.quantity ? ` (${i.quantity})` : ''}`).join(', ')}.`);
  }

  if (addedFridge.length > 0) {
    result.addedFridgeItems = addedFridge;
    replyParts.push(`Добавил в наличие: ${addedFridge.map(i => `${i.name}${i.quantity ? ` (${i.quantity})` : ''}`).join(', ')}.`);
  }

  if (result.suggestedRecipe) {
    replyParts.push(`Подобрал рецепт «${result.suggestedRecipe.name}» (${result.suggestedRecipe.macros?.calories || 250} ккал).`);
  }

  if (replyParts.length === 0) {
    replyParts.push('Понял вас! Что ещё подсказать или добавить?');
  }

  result.reply = replyParts.join(' ');
  return result;
}

// Главная точка входа ассистента: сначала пытается через API (Gemini/сервер), при сбое переключается на локальный парсер
export async function sendAssistantMessage(
  prompt: string,
  existingState: {
    recipes: Recipe[];
    fridge: InventoryItem[];
    grains: InventoryItem[];
    spices: InventoryItem[];
    shoppingList: ShoppingItem[];
  },
  images?: string[]
): Promise<AiAssistantResult> {
  try {
    const serverResult = await apiPost('/api/ai-assistant', {
      prompt,
      images: images && images.length > 0 ? images : undefined,
      inventory: {
        fridge: existingState.fridge,
        grains: existingState.grains,
        spices: existingState.spices
      },
      recipes: existingState.recipes.map(r => ({
        id: r.id,
        name: r.name,
        title: r.name,
        category: r.category,
        portions: r.portions,
        macros: r.macros,
        ingredients: r.ingredients,
        instructions: r.instructions
      })),
      shopping: existingState.shoppingList
    });

    if (serverResult && serverResult.reply) {
      return serverResult;
    }
  } catch {
    // В случае оффлайна или ошибки API переключаемся на локальный движок
  }

  return processAssistantLocal(prompt || 'Определить продукты на фото', existingState);
}
