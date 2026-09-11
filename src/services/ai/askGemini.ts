// src/services/ai/askGemini.ts

import { GoogleGenAI } from "@google/genai";
import { geminiFunctionDeclarations } from "./geminiTools";
import { executeGeminiFunction } from "./geminiFunctionHandler";
import type { UserContext } from "./backendFunctions";

export const CULINARY_SYSTEM_PROMPT = `
Ты автономный кулинарный ИИ-помощник (Culinary AI Assistant).
Ты управляешь рецептами, домашними запасами (холодильник, кладовая, специи), покупками, календарем питания и КБЖУ.

ТВОИ ЗОЛОТЫЕ ПРАВИЛА:
1. ДЕТЕРМИНИРОВАННЫЙ БЭКЕНД: Любое чтение или изменение данных (поиск рецепта, добавление продукта, расчёт покупок, изменение порций) ДОЛЖНО производиться СТРОГО через вызов соответствующей функции (Tool Call). Никогда не выдумывай данные.
2. ЕСЛИ ПОЛЬЗОВАТЕЛЬ ПРОСИТ НАЙТИ РЕЦЕПТ ("найди рецепт", "что приготовить из...", "покажи блюда с курицей"):
   - Вызывай функцию searchRecipes или getRecipes!
   - КАТЕГОРИЧЕСКИ ЗАПРЕЩЕНО добавлять упомянутые в запросе ингредиенты в список покупок (addedShoppingItems / calculateShoppingList)! Запрос на поиск рецепта НЕ является покупкой.
3. СПИСОК ПОКУПОК:
   - Вызывай calculateShoppingList ТОЛЬКО тогда, когда пользователь выбрал конкретный рецепт и попросил составить список покупок или купить недостающие ингредиенты.
   - Вызывай addInventoryProduct только тогда, когда пользователь прямо сказал, что купил продукты или они есть дома.
4. ЯЗЫК И ТОН:
   - Общайся на безупречном русском языке.
   - Ответ должен быть кратким, полезным, вежливым и по делу. Не используй лишней воды.
`;

export interface AskGeminiResult {
  reply: string;
  addedFridgeItems?: Array<{ name: string; quantity?: string; section: 'fridge' | 'grains' | 'spices' }>;
  addedShoppingItems?: Array<{ name: string; quantity?: string }>;
  removedInventory?: string[];
  suggestedRecipe?: any;
  updatedRecipe?: any;
  deletedRecipeId?: string;
  addedCalendarMeal?: any;
  foundRecipes?: any[];
}

export async function askGemini(
  prompt: string,
  images: string[] | undefined,
  context: UserContext,
  apiKey: string
): Promise<AskGeminiResult> {
  const ai = new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build'
      }
    }
  });

  const parts: any[] = [];

  // Добавляем изображения, если есть
  if (images && images.length > 0) {
    for (const imgBase64 of images) {
      if (typeof imgBase64 === 'string') {
        const matches = imgBase64.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);
        if (matches && matches.length === 3) {
          parts.push({
            inlineData: {
              mimeType: matches[1],
              data: matches[2]
            }
          });
        }
      }
    }
  }

  // Текстовый ввод пользователя
  parts.push({
    text: prompt || 'Определить продукты на фото и подсказать действия.'
  });

  const collectedMutations: AskGeminiResult = {
    reply: ''
  };

  const mergeMutations = (res: any) => {
    if (!res?.clientMutations) return;
    const m = res.clientMutations;
    if (m.addedFridgeItems) {
      collectedMutations.addedFridgeItems = [
        ...(collectedMutations.addedFridgeItems || []),
        ...m.addedFridgeItems
      ];
    }
    if (m.addedShoppingItems) {
      collectedMutations.addedShoppingItems = [
        ...(collectedMutations.addedShoppingItems || []),
        ...m.addedShoppingItems
      ];
    }
    if (m.removedInventory) {
      collectedMutations.removedInventory = [
        ...(collectedMutations.removedInventory || []),
        ...m.removedInventory
      ];
    }
    if (m.suggestedRecipe) {
      collectedMutations.suggestedRecipe = m.suggestedRecipe;
    }
    if (m.updatedRecipe) {
      collectedMutations.updatedRecipe = m.updatedRecipe;
    }
    if (m.deletedRecipeId) {
      collectedMutations.deletedRecipeId = m.deletedRecipeId;
    }
    if (m.addedCalendarMeal) {
      collectedMutations.addedCalendarMeal = m.addedCalendarMeal;
    }
  };

  // Автономный цикл взаимодействия (Function Calling Loop)
  let history: any[] = [
    {
      role: 'user',
      parts
    }
  ];

  let loopCount = 0;
  const MAX_LOOPS = 5;

  while (loopCount < MAX_LOOPS) {
    loopCount++;

    const response = await ai.models.generateContent({
      model: 'gemini-3.8-flash',
      contents: history,
      config: {
        systemInstruction: CULINARY_SYSTEM_PROMPT,
        tools: [
          {
            functionDeclarations: geminiFunctionDeclarations as any
          }
        ]
      }
    });

    const candidate = response.candidates?.[0];
    const candidateContent = candidate?.content;
    const functionCalls = response.functionCalls;

    if (candidateContent) {
      history.push(candidateContent);
    }

    if (functionCalls && functionCalls.length > 0) {
      // Исполняем вызовы функций бэкенда
      const functionResponseParts: any[] = [];

      for (const call of functionCalls) {
        const funcName = call.name;
        const funcArgs = call.args || {};

        const executionResult = await executeGeminiFunction(
          funcName,
          funcArgs,
          context
        );

        mergeMutations(executionResult);

        // Если это поиск рецептов и что-то найдено, сохраняем для выдачи
        if (funcName === 'searchRecipes' && executionResult.data?.recipes) {
          collectedMutations.foundRecipes = executionResult.data.recipes;
          if (!collectedMutations.suggestedRecipe && executionResult.data.recipes.length > 0) {
            const first = executionResult.data.recipes[0];
            const fullRecipe = (context.recipes || []).find(r => r.id === first.id);
            if (fullRecipe) {
              collectedMutations.suggestedRecipe = fullRecipe;
            }
          }
        }

        functionResponseParts.push({
          functionResponse: {
            name: funcName,
            response: executionResult
          }
        });
      }

      history.push({
        role: 'user',
        parts: functionResponseParts
      });

      // Продолжаем цикл, чтобы Gemini сформировал финальный ответ пользователю
      continue;
    }

    // Если нет functionCalls, получаем текст ответа
    const textReply = response.text || '';
    collectedMutations.reply = textReply.trim();
    break;
  }

  if (!collectedMutations.reply) {
    if (collectedMutations.suggestedRecipe) {
      collectedMutations.reply = `Подобрал для вас рецепт «${collectedMutations.suggestedRecipe.name || collectedMutations.suggestedRecipe.title}».`;
    } else if (collectedMutations.foundRecipes && collectedMutations.foundRecipes.length > 0) {
      collectedMutations.reply = `Найдено рецептов: ${collectedMutations.foundRecipes.length}. Например: ${collectedMutations.foundRecipes.map(r => r.title).join(', ')}.`;
    } else {
      collectedMutations.reply = 'Готово! Чем ещё могу помочь по рецептам или продуктам?';
    }
  }

  return collectedMutations;
}
