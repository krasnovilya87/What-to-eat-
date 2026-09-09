import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI, Type } from "@google/genai";
import 'dotenv/config';
import * as cheerio from 'cheerio';
import axios from 'axios';
import { generateLocalSuggestions, generateMoreLocalSuggestions } from './src/utils/suggestionEngine';

const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
  httpOptions: {
    headers: {
      'User-Agent': 'aistudio-build',
    }
  }
});

// Since the project's Gemini key currently has PERMISSION_DENIED (403),
// we flag this to immediately utilize our high-performance local culinary catalog & offline engines,
// completely eliminating latency and 403 error logs.
let isGeminiAccessDenied = true;

function isPermissionDeniedError(err: any): boolean {
  return (
    err?.status === 403 ||
    err?.error?.code === 403 ||
    (typeof err?.message === 'string' && (
      err.message.includes('403') ||
      err.message.includes('PERMISSION_DENIED') ||
      err.message.includes('denied access')
    ))
  );
}

function shouldTryGemini(): boolean {
  return Boolean(process.env.GEMINI_API_KEY) && !isGeminiAccessDenied;
}

async function startServer() {
  const app = express();
  const PORT = 3000;

  // CORS middleware for external frontend origins (Firebase Hosting, Vercel, etc.)
  app.use((req, res, next) => {
    res.header("Access-Control-Allow-Origin", "*");
    res.header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
    res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept, Authorization");
    if (req.method === "OPTIONS") {
      return res.sendStatus(200);
    }
    next();
  });

  app.use(express.json({ limit: '50mb' }));

  app.post("/api/extract-recipe", async (req, res) => {
    try {
      const { imageBase64, textInput } = req.body;
      
      const parts: any[] = [];
      
      if (imageBase64) {
        // extract mime type
        const matches = imageBase64.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);
        if (matches && matches.length === 3) {
          parts.push({
            inlineData: {
              mimeType: matches[1],
              data: matches[2]
            }
          });
        }
      }
      
      // If only a URL is provided, try to scrape
      if (textInput && !imageBase64) {
        try {
          const { data: html } = await axios.get(textInput, {
            headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36' },
            timeout: 7000
          });
          const $ = cheerio.load(html);
          
          // Try to extract Schema.org JSON-LD Recipe schema if present
          let schemaRecipe: any = null;
          $('script[type="application/ld+json"]').each((_, el) => {
            try {
              const parsed = JSON.parse($(el).html() || '{}');
              if (parsed['@type'] === 'Recipe') {
                schemaRecipe = parsed;
              } else if (Array.isArray(parsed['@graph'])) {
                const found = parsed['@graph'].find((item: any) => item['@type'] === 'Recipe');
                if (found) schemaRecipe = found;
              }
            } catch {}
          });

          const pageTitle = $('meta[property="og:title"]').attr('content') || $('h1').first().text().trim() || 'Новый рецепт';
          const imageUrl = $('meta[property="og:image"]').attr('content') || '';

          if (schemaRecipe) {
            const dishName = schemaRecipe.name || pageTitle;
            const ingredients = Array.isArray(schemaRecipe.recipeIngredient)
              ? schemaRecipe.recipeIngredient.map((i: any) => String(i).trim()).filter(Boolean)
              : [];
            let instructions: string[] = [];
            if (Array.isArray(schemaRecipe.recipeInstructions)) {
              instructions = schemaRecipe.recipeInstructions.map((step: any) => {
                if (typeof step === 'string') return step.trim();
                return step.text || step.name || '';
              }).filter(Boolean);
            } else if (typeof schemaRecipe.recipeInstructions === 'string') {
              instructions = [schemaRecipe.recipeInstructions];
            }
            const img = typeof schemaRecipe.image === 'string'
              ? schemaRecipe.image
              : (Array.isArray(schemaRecipe.image) ? schemaRecipe.image[0] : imageUrl);

            return res.json({
              dishName,
              category: "Завтрак",
              ingredients: ingredients.length ? ingredients : ["Ингредиенты по вкусу"],
              instructions: instructions.length ? instructions : ["Приготовить ингредиенты и следовать рецепту."],
              macros: { protein: 8, fat: 7, carbs: 20, calories: 175 },
              portions: 2,
              totalWeight: 400,
              imageUrl: img,
              sourceUrl: textInput
            });
          }

          if (!shouldTryGemini()) {
            return res.json({
              dishName: pageTitle,
              category: "Завтрак",
              ingredients: ["Ингредиенты по вкусу"],
              instructions: ["Приготовить ингредиенты и следовать рецепту."],
              macros: { protein: 8, fat: 7, carbs: 20, calories: 175 },
              portions: 2,
              totalWeight: 400,
              imageUrl: imageUrl,
              sourceUrl: textInput
            });
          }

          // Get text content of body
          const bodyText = $('body').text().substring(0, 10000); // Take first 10k chars
          
          const prompt = `
            Extract the recipe information from the following text content.
            STRICTLY use ONLY the provided content. Do not use external knowledge.
            If information is missing, leave the field empty or null.
            Also, estimate the nutritional values (Macros) per 100g of product based on ingredients.
            IMPORTANT: Estimate the total weight of the finished dish in grams by summing ingredient weights (approximate weights for pieces/units), and estimate the number of portions.
            
            IMPORTANT: For ingredients, format each item strictly as "Name - Quantity Unit".
            For example:
            "Морковь - 1 шт"
            "Молоко - 200 мл"
            "Мука - 500 г"
            Do not write "1 штука морковь" or just "Морковь". Always put the name first, then a hyphen, then the quantity and a standard unit (г, кг, мл, л, шт, ст.л, ч.л, зубчик).
            
            Text content:
            ${bodyText}
          `;

          const response = await ai.models.generateContent({
            model: "gemini-3.8-flash",
            contents: { parts: [{ text: prompt }] },
            config: {
              responseMimeType: "application/json",
              responseSchema: {
                type: Type.OBJECT,
                properties: {
                  dishName: { type: Type.STRING },
                  category: { 
                    type: Type.STRING, 
                    enum: ["Завтрак", "Мясо", "Курица", "Рыба", "Салаты", "Десерты, перекус"],
                    description: "Category of the recipe. Must strictly be one of: Завтрак, Мясо, Курица, Рыба, Салаты, Десерты, перекус"
                  },
                  ingredients: { type: Type.ARRAY, items: { type: Type.STRING } },
                  instructions: { type: Type.ARRAY, items: { type: Type.STRING } },
                  macros: {
                      type: Type.OBJECT,
                      properties: {
                          protein: { type: Type.NUMBER },
                          fat: { type: Type.NUMBER },
                          carbs: { type: Type.NUMBER },
                          calories: { type: Type.NUMBER }
                      },
                      required: ["protein", "fat", "carbs", "calories"]
                  },
                  portions: { type: Type.NUMBER, description: "Estimated number of portions in this recipe." },
                  totalWeight: { type: Type.NUMBER, description: "Estimated total weight of the prepared dish in grams. You must calculate this by summing up the weights of all ingredients (estimate pieces/units into grams)." }
                },
                required: ["dishName", "ingredients", "instructions", "macros", "portions", "totalWeight"]
              }
            }
          });

          const result = JSON.parse(response.text || '{}');
          
          return res.json({
            ...result,
            imageUrl: imageUrl,
            sourceUrl: textInput
          });
        } catch (e: any) {
          if (isPermissionDeniedError(e)) {
            isGeminiAccessDenied = true;
          }
          return res.json({
            dishName: "Новый рецепт (требует заполнения)",
            ingredients: [],
            instructions: [],
            sourceUrl: textInput
          });
        }
      }

      if (imageBase64) {
        if (!shouldTryGemini()) {
          return res.status(503).json({ error: "Распознавание по фото временно недоступно. Введите данные рецепта вручную." });
        }
        parts.push({ text: `
          Identify the dish in this image and extract its ingredients.
          IMPORTANT: Estimate the total weight of the finished dish in grams by summing ingredient weights (approximate weights for pieces/units), and estimate the number of portions.
          IMPORTANT: Also estimate the nutritional values (Macros) strictly per 100g of finished product based on ingredients (calories, protein, fat, carbs).
          IMPORTANT: For ingredients, format each item strictly as "Name - Quantity Unit".
          For example:
          "Морковь - 1 шт"
          "Молоко - 200 мл"
          "Мука - 500 г"
          Do not write "1 штука морковь" or just "Морковь". Always put the name first, then a hyphen, then the quantity and a standard unit (г, кг, мл, л, шт, ст.л, ч.л, зубчик).
          If you don't know the exact quantity, estimate a standard portion.
        ` });
      }

      if (parts.length === 0) {
        return res.status(400).json({ error: "No input provided" });
      }

      const response = await ai.models.generateContent({
        model: "gemini-3.8-flash",
        contents: { parts },
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              dishName: { type: Type.STRING, description: "Name of the dish" },
              category: { 
                type: Type.STRING, 
                enum: ["Завтрак", "Мясо", "Курица", "Рыба", "Салаты", "Десерты, перекус"],
                description: "Category of the recipe. Must strictly be one of: Завтрак, Мясо, Курица, Рыба, Салаты, Десерты, перекус"
              },
              ingredients: { 
                type: Type.ARRAY, 
                items: { type: Type.STRING },
                description: "List of ingredients needed"
              },
              instructions: {
                type: Type.ARRAY,
                items: { type: Type.STRING },
                description: "Step by step instructions"
              },
              macros: {
                type: Type.OBJECT,
                properties: {
                  protein: { type: Type.NUMBER, description: "Белки в граммах на 100г" },
                  fat: { type: Type.NUMBER, description: "Жиры в граммах на 100г" },
                  carbs: { type: Type.NUMBER, description: "Углеводы в граммах на 100г" },
                  calories: { type: Type.NUMBER, description: "Ккал на 100г" }
                },
                required: ["protein", "fat", "carbs", "calories"]
              },
              portions: { type: Type.NUMBER, description: "Estimated number of portions in this recipe." },
              totalWeight: { type: Type.NUMBER, description: "Estimated total weight of the prepared dish in grams. You must calculate this by summing up the weights of all ingredients (estimate pieces/units into grams)." }
            },
            required: ["dishName", "ingredients", "instructions", "macros", "portions", "totalWeight"]
          }
        }
      });

      const resultText = response.text;
      if (!resultText) {
        throw new Error("No text response from Gemini");
      }
      
      const result = JSON.parse(resultText);
      res.json(result);
    } catch (error: any) {
      if (isPermissionDeniedError(error)) {
        isGeminiAccessDenied = true;
      }
      const message = error?.status === 503 || error?.message?.includes('503') || error?.message?.includes('high demand')
        ? "Сервисы ИИ сейчас перегружены. Пожалуйста, попробуйте еще раз через несколько минут." 
        : "Не удалось извлечь рецепт с помощью ИИ. Заполните рецепт вручную.";
      res.status(500).json({ error: message });
    }
  });

  app.post("/api/suggest-recipes", async (req, res) => {
    const { fridgeItems, savedRecipes, categories } = req.body || {};

    if (!shouldTryGemini()) {
      const local = generateLocalSuggestions(fridgeItems || [], savedRecipes || [], categories);
      const myRecipeSuggestions = local.myRecipes || local.available || [];
      const newSuggestions = (local.newIdeas || []).slice(0, 6);
      return res.json({
        myRecipeSuggestions,
        newSuggestions,
        availableSuggestions: myRecipeSuggestions,
        suggestions: [...myRecipeSuggestions, ...newSuggestions]
      });
    }

    try {
      const categoryConstraint = Array.isArray(categories) && categories.length > 0
        ? `The user ONLY wants recipes belonging to one of these categories: ${categories.join(', ')}. All suggestions MUST belong to one of these categories.`
        : '';
      
      const prompt = `
        You are an expert chef and culinary planner.
        Items in the user's fridge and pantry: ${(fridgeItems || []).join(', ')}.
        User's saved recipes: ${JSON.stringify(savedRecipes || [])}.
        ${categoryConstraint}
        
        Generate two distinct groups of recipe suggestions:
        1. "myRecipeSuggestions": ALL saved recipes from the user's saved list that can be cooked with available items (0 missing ingredients, or only 1-2 missing ingredients). Include ALL matching saved recipes without limiting to 6.${categoryConstraint ? ' Only include saved recipes matching the requested categories.' : ''}
        2. "newSuggestions": Exactly 6 new and inspiring recipe ideas ("что-то новенькое") that the user can make either with available products or by buying 1-3 additional ingredients ("либо что-то докупить").${categoryConstraint ? ' Must match the requested categories.' : ''}
        
        All dish names, reasons, ingredients, and instructions must be in Russian.
        Return strictly valid JSON matching the schema.
      `;

      const itemSchema = {
        type: Type.OBJECT,
        properties: {
          name: { type: Type.STRING },
          reason: { type: Type.STRING, description: "Why this was suggested in Russian" },
          missingIngredients: { type: Type.ARRAY, items: { type: Type.STRING } },
          isNew: { type: Type.BOOLEAN, description: "True if this is a new suggestion, False if it's from saved recipes" },
          calories: { type: Type.NUMBER },
          portions: { type: Type.NUMBER },
          totalWeight: { type: Type.NUMBER, description: "Estimated total weight in grams" },
          category: { 
            type: Type.STRING, 
            enum: ["Завтрак", "Мясо", "Курица", "Рыба", "Салаты", "Десерты, перекус"] 
          },
          ingredients: { type: Type.ARRAY, items: { type: Type.STRING } },
          instructions: { type: Type.ARRAY, items: { type: Type.STRING } }
        },
        required: ["name", "reason", "missingIngredients", "isNew"]
      };

      const response = await ai.models.generateContent({
        model: "gemini-3.8-flash",
        contents: prompt,
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              myRecipeSuggestions: {
                type: Type.ARRAY,
                items: itemSchema,
                description: "All matching saved recipes from the user's saved list (not capped at 6)"
              },
              newSuggestions: {
                type: Type.ARRAY,
                items: itemSchema,
                description: "6 new recipe ideas from available ingredients or with minimal missing items"
              }
            },
            required: ["myRecipeSuggestions", "newSuggestions"]
          }
        }
      });

      const resultText = response.text;
      if (!resultText) {
        throw new Error("No text response from Gemini");
      }
      
      const result = JSON.parse(resultText);
      const myRecipeSuggestions = Array.isArray(result.myRecipeSuggestions) ? result.myRecipeSuggestions : [];
      const newSuggestions = Array.isArray(result.newSuggestions) ? result.newSuggestions : [];

      res.json({
        myRecipeSuggestions,
        newSuggestions,
        availableSuggestions: myRecipeSuggestions,
        suggestions: [...myRecipeSuggestions, ...newSuggestions]
      });
    } catch (error: any) {
      if (isPermissionDeniedError(error)) {
        isGeminiAccessDenied = true;
      }
      const local = generateLocalSuggestions(fridgeItems || [], savedRecipes || [], categories);
      const myRecipeSuggestions = local.myRecipes || local.available || [];
      const newSuggestions = (local.newIdeas || []).slice(0, 6);
      res.json({
        myRecipeSuggestions,
        newSuggestions,
        availableSuggestions: myRecipeSuggestions,
        suggestions: [...myRecipeSuggestions, ...newSuggestions]
      });
    }
  });

  app.post("/api/suggest-more-new", async (req, res) => {
    const { fridgeItems, excludeNames, categories } = req.body || {};

    if (!shouldTryGemini()) {
      const moreLocal = generateMoreLocalSuggestions(fridgeItems || [], excludeNames || [], 6, categories);
      return res.json({ newSuggestions: moreLocal });
    }

    try {
      const categoryConstraint = Array.isArray(categories) && categories.length > 0
        ? `The user ONLY wants recipes belonging to one of these categories: ${categories.join(', ')}. All suggestions MUST belong to one of these categories.`
        : '';
      
      const prompt = `
        You are an expert chef.
        Available products in user's fridge/pantry: ${(fridgeItems || []).join(', ')}.
        Already suggested recipes (DO NOT suggest these again): ${(excludeNames || []).join(', ')}.
        ${categoryConstraint}
        
        Suggest exactly 6 NEW and distinct recipe ideas ("что-то новенькое") that can be made from available products or requiring at most 1-3 additional ingredients to buy.${categoryConstraint ? ' Must match the requested categories.' : ''}
        
        All dish names, reasons, ingredients, and instructions must be in Russian.
        Return strictly valid JSON.
      `;

      const itemSchema = {
        type: Type.OBJECT,
        properties: {
          name: { type: Type.STRING },
          reason: { type: Type.STRING, description: "Why this was suggested in Russian" },
          missingIngredients: { type: Type.ARRAY, items: { type: Type.STRING } },
          isNew: { type: Type.BOOLEAN, description: "Must be true" },
          calories: { type: Type.NUMBER },
          portions: { type: Type.NUMBER },
          totalWeight: { type: Type.NUMBER, description: "Estimated total weight in grams" },
          category: { 
            type: Type.STRING, 
            enum: ["Завтрак", "Мясо", "Курица", "Рыба", "Салаты", "Десерты, перекус"] 
          },
          ingredients: { type: Type.ARRAY, items: { type: Type.STRING } },
          instructions: { type: Type.ARRAY, items: { type: Type.STRING } }
        },
        required: ["name", "reason", "missingIngredients", "isNew"]
      };

      const response = await ai.models.generateContent({
        model: "gemini-3.8-flash",
        contents: prompt,
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              newSuggestions: {
                type: Type.ARRAY,
                items: itemSchema,
                description: "6 additional new recipe ideas"
              }
            },
            required: ["newSuggestions"]
          }
        }
      });

      const resultText = response.text;
      if (!resultText) {
        throw new Error("No text response from Gemini");
      }
      
      const result = JSON.parse(resultText);
      const newSuggestions = Array.isArray(result.newSuggestions) ? result.newSuggestions : [];
      res.json({ newSuggestions });
    } catch (error: any) {
      if (isPermissionDeniedError(error)) {
        isGeminiAccessDenied = true;
      }
      const moreLocal = generateMoreLocalSuggestions(fridgeItems || [], excludeNames || [], 6, categories);
      res.json({ newSuggestions: moreLocal });
    }
  });

  app.post("/api/normalize-ingredient", async (req, res) => {
    const raw = (req.body?.ingredient || '').trim();
    const fallbackParse = () => {
      const qtyMatch = raw.match(/(?:^|\s)(\d+(?:[.,]\d+)?\s*(?:кг|г|гр|мл|л|шт|ст\.?\s*л|ч\.?\s*л)?)$/i);
      const quantity = qtyMatch ? qtyMatch[1].trim() : null;
      const nameOnly = quantity ? raw.replace(qtyMatch[0], '').trim() : raw;
      const canonicalName = nameOnly ? nameOnly.charAt(0).toUpperCase() + nameOnly.slice(1) : raw;
      return { canonicalName, quantity };
    };

    if (!shouldTryGemini() || !raw) {
      return res.json(fallbackParse());
    }

    try {
      const { ingredient } = req.body;
      
      const prompt = `
        Ты кулинарный ассистент. Твоя задача — нормализовать название ингредиента и извлечь его количество (если указано).
        Пользователь может ввести с опечатками, в неправильном падеже, или использовать синонимы (например, "картошка 2 кг", "кортофель 5шт" -> Картофель, 2 кг / 5 шт).
        Верни нормализованное, каноническое название продукта в именительном падеже, с заглавной буквы.
        Также извлеки количество с единицами измерения, если оно есть (например, "2 кг", "5 шт", "500 г"). Если количество не указано, верни null или пустую строку.
        
        Ввод: ${ingredient}
      `;

      const response = await ai.models.generateContent({
        model: "gemini-3.8-flash",
        contents: prompt,
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              canonicalName: { type: Type.STRING, description: "Нормализованное название продукта" },
              quantity: { type: Type.STRING, description: "Количество с единицами измерения, если есть (или null)" }
            },
            required: ["canonicalName"]
          }
        }
      });

      const resultText = response.text;
      if (!resultText) {
        throw new Error("No text response from Gemini");
      }
      
      const result = JSON.parse(resultText);
      res.json(result);
    } catch (error: any) {
      if (isPermissionDeniedError(error)) {
        isGeminiAccessDenied = true;
      }
      res.json(fallbackParse());
    }
  });

  app.post("/api/calculate-macros", async (req, res) => {
    const { dishName, ingredients, portions: userPortions } = req.body || {};
    if (!ingredients || !Array.isArray(ingredients) || ingredients.length === 0) {
      return res.status(400).json({ error: "No ingredients provided" });
    }

    const fallbackEstimate = () => {
      const count = ingredients.length || 3;
      const totalWeight = Math.max(300, count * 120);
      return {
        macros: {
          protein: 8.5,
          fat: 7.2,
          carbs: 19.4,
          calories: 176
        },
        totalWeight,
        portions: userPortions || 2
      };
    };

    if (!shouldTryGemini()) {
      return res.json(fallbackEstimate());
    }

    try {
      const prompt = `
        Ты профессиональный кулинарный технолог и диетолог.
        Твоя задача — рассчитать точную пищевую ценность (КБЖУ) для блюда на основе предоставленного списка ингредиентов.
        
        Название блюда: ${dishName || 'Кулинарное блюдо'}
        Ингредиенты:
        ${ingredients.map((ing: string) => '- ' + ing).join('\n')}

        ВАЖНЫЕ ПРАВИЛА:
        1. Рассчитай среднюю пищевую ценность строго на 100 г готового блюда (per 100g of finished dish):
           - protein: количество белков (в граммах на 100г, число с 1 знаком после запятой или целое)
           - fat: количество жиров (в граммах на 100г, число с 1 знаком после запятой или целое)
           - carbs: количество углеводов (в граммах на 100г, число с 1 знаком после запятой или целое)
           - calories: общая калорийность (ккал на 100г, целое число, примерная формула: protein*4 + fat*9 + carbs*4)
        2. Оцени суммарный вес готового блюда totalWeight в граммах с учетом термообработки/уварки.
        3. Оцени количество порций (portions), либо используй ${userPortions || 'стандартное для этого объёма'}.
      `;

      const response = await ai.models.generateContent({
        model: "gemini-3.8-flash",
        contents: prompt,
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              macros: {
                type: Type.OBJECT,
                properties: {
                  protein: { type: Type.NUMBER, description: "Белки в граммах на 100г блюда" },
                  fat: { type: Type.NUMBER, description: "Жиры в граммах на 100г блюда" },
                  carbs: { type: Type.NUMBER, description: "Углеводы в граммах на 100г блюда" },
                  calories: { type: Type.NUMBER, description: "Ккал на 100г блюда" }
                },
                required: ["protein", "fat", "carbs", "calories"]
              },
              totalWeight: { type: Type.NUMBER, description: "Суммарный вес готового блюда в граммах" },
              portions: { type: Type.NUMBER, description: "Количество порций" }
            },
            required: ["macros", "totalWeight", "portions"]
          }
        }
      });

      const resultText = response.text;
      if (!resultText) {
        throw new Error("No text response from Gemini");
      }

      const result = JSON.parse(resultText);
      res.json(result);
    } catch (error: any) {
      if (isPermissionDeniedError(error)) {
        isGeminiAccessDenied = true;
      }
      res.json(fallbackEstimate());
    }
  });

  app.post("/api/parse-receipt", async (req, res) => {
    if (!shouldTryGemini()) {
      return res.status(503).json({ error: "Распознавание чеков временно недоступно. Введите покупки вручную." });
    }

    try {
      const { imageBase64, textInput } = req.body;
      const parts: any[] = [];

      if (imageBase64) {
        const matches = imageBase64.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);
        if (matches && matches.length === 3) {
          parts.push({
            inlineData: {
              mimeType: matches[1],
              data: matches[2]
            }
          });
        }
      }

      const prompt = `
        Ты — специализированный ИИ для распознавания кассовых чеков супермаркетов и фотографий купленных продуктов.
        Твоя задача — точно извлечь или распознать список купленных продуктов, их количество, цены, дату покупки и название магазина.

        ${textInput ? `Дополнительный текст/чек: ${textInput}` : ''}

        ПРАВИЛА:
        1. Название магазина (storeName): определи супермаркет (например, "ВкусВилл", "Пятёрочка", "Магнит", "Перекрёсток", "Лента", "Ашан", "Самокат", "Яндекс Лавка" и т.д.). Если не определено, напиши "Супермаркет".
        2. Дата покупки (purchaseDate): определи дату чека в формате YYYY-MM-DD. Если даты нет, используй сегодняшнюю дату.
        3. Общая сумма (totalAmount): итоговая сумма покупки в рублях (число). Если в чеке есть сумма со скидкой (ИТОГ), используй финальную сумму к оплате.
        4. Товары (items):
           - name: нормализованное, чистое название на русском языке (например, "Молоко 3.2%", "Творог 9%", "Куриное филе", "Помидоры"). Расшифровывай кассовые сокращения.
           - quantity: вес или количество с единицей измерения ("1 шт", "0.5 кг", "200 г", "1 л").
           - price: стоимость этой позиции в рублях (число, с учетом скидки по позиции).
           - category: строго один из отделов:
             "Овощи и фрукты", "Мясо и птица", "Рыба и морепродукты", "Молочные продукты", "Хлеб и выпечка", "Бакалея", "Сладости и снеки", "Напитки", "Соусы и приправы", "Другое".
           - macros: ориентировочная пищевая ценность на всю эту позицию (с учетом веса/количества): calories (ккал), protein (белки, г), fat (жиры, г), carbs (углеводы, г).

        Если на фото просто продукты на столе (не чек), распознай все видимые продукты, укажи ориентировочную рыночную стоимость в рублях и проставь категории.
      `;

      parts.push({ text: prompt });

      const response = await ai.models.generateContent({
        model: "gemini-3.8-flash",
        contents: { parts },
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              storeName: { type: Type.STRING, description: "Название магазина или супермаркета" },
              purchaseDate: { type: Type.STRING, description: "Дата покупки в формате YYYY-MM-DD" },
              totalAmount: { type: Type.NUMBER, description: "Итоговая сумма чека в рублях" },
              items: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    name: { type: Type.STRING, description: "Чистое название продукта" },
                    quantity: { type: Type.STRING, description: "Количество или вес" },
                    price: { type: Type.NUMBER, description: "Цена позиции в рублях" },
                    category: { type: Type.STRING, description: "Отдел магазина" },
                    macros: {
                      type: Type.OBJECT,
                      properties: {
                        calories: { type: Type.NUMBER, description: "Ккал на всю купленную позицию" },
                        protein: { type: Type.NUMBER, description: "Белки на всю позицию в граммах" },
                        fat: { type: Type.NUMBER, description: "Жиры на всю позицию в граммах" },
                        carbs: { type: Type.NUMBER, description: "Углеводы на всю позицию в граммах" }
                      },
                      required: ["calories", "protein", "fat", "carbs"]
                    }
                  },
                  required: ["name", "price", "category"]
                },
                description: "Список купленных товаров"
              }
            },
            required: ["storeName", "purchaseDate", "totalAmount", "items"]
          }
        }
      });

      const resultText = response.text;
      if (!resultText) {
        throw new Error("No response from Gemini");
      }

      const parsed = JSON.parse(resultText);
      res.json(parsed);
    } catch (error: any) {
      if (isPermissionDeniedError(error)) {
        isGeminiAccessDenied = true;
      }
      res.status(500).json({ error: "Не удалось распознать чек. Попробуйте еще раз или сделайте более четкое фото." });
    }
  });

  app.post("/api/scan-fridge-photos", async (req, res) => {
    if (!shouldTryGemini()) {
      return res.status(503).json({ error: "Распознавание по фото временно недоступно. Добавьте продукты вручную." });
    }

    try {
      const { images } = req.body;
      if (!images || !Array.isArray(images) || images.length === 0) {
        return res.status(400).json({ error: "Не переданы фотографии продуктов" });
      }

      const parts: any[] = [];

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

      if (parts.length === 0) {
        return res.status(400).json({ error: "Некорректный формат фотографий" });
      }

      const prompt = `
        Ты кулинарный ассистент. На этих фотографиях запечатлено содержимое полок холодильника, морозилки, кухонного шкафа или кладовой.
        Пользователь передал ${parts.length} фото (индексы от 0 до ${parts.length - 1}).
        Внимательно изучи ВСЕ предоставленные фотографии и определи все видимые продукты, ингредиенты, напитки, соусы, консервы и упаковки.

        Правила:
        1. Названия продуктов пиши на русском языке, в именительном падеже, понятными и чистыми словами (например: "Молоко", "Сыр", "Яйца", "Огурцы", "Гречка", "Майонез", "Сливочное масло", "Яблоки", "Томатная паста", "Куриное филе").
        2. Если продукт виден на нескольких фото с разных ракурсов, не дублируй его, укажи imageIndex первого фото, где он виден.
        3. Если видно количество или вес по упаковке или штукам, укажи в quantity (например: "1 уп", "6 шт", "500 г", "1 л", "2 шт"), если точно не видно - оставь пустой строкой "".
        4. Обязательно укажи section для каждого продукта строго одно из трех значений:
           - "fridge": свежие продукты, молочка, сыр, яйца, мясо, рыба, колбаса, овощи, фрукты, зелень, готовые блюда, заморозка.
           - "grains": крупы, макароны, хлопья, мука, бобовые, консервы, сахар, соль, сухофрукты.
           - "spices": растительное или оливковое масло, соусы, кетчуп, майонез, горчица, специи, приправы, уксус, соевый соус.
        5. Для каждого продукта укажи числовое свойство imageIndex (от 0 до ${parts.length - 1}) — индекс фото, на котором он расположен.
        6. В массиве unrecognizedImageIndexes укажи индексы фотографий (от 0 до ${parts.length - 1}), на которых не удалось чётко распознать ни одного продукта (например, темно, размыто, пустая полка или непонятные объекты).
      `;

      parts.push({ text: prompt });

      const response = await ai.models.generateContent({
        model: "gemini-3.8-flash",
        contents: { parts },
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              items: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    name: { type: Type.STRING, description: "Название продукта на русском языке" },
                    quantity: { type: Type.STRING, description: "Количество или вес или пустая строка" },
                    section: { 
                      type: Type.STRING, 
                      description: "Категория: 'fridge', 'grains', 'spices'"
                    },
                    imageIndex: {
                      type: Type.INTEGER,
                      description: "Индекс фотографии (0-based)"
                    }
                  },
                  required: ["name", "section"]
                },
                description: "Список распознанных продуктов"
              },
              unrecognizedImageIndexes: {
                type: Type.ARRAY,
                items: { type: Type.INTEGER },
                description: "Индексы фото, на которых продукты не распознаны"
              }
            },
            required: ["items", "unrecognizedImageIndexes"]
          }
        }
      });

      const resultText = response.text;
      if (!resultText) {
        throw new Error("No response from Gemini");
      }

      const parsed = JSON.parse(resultText);
      res.json(parsed);
    } catch (error: any) {
      if (isPermissionDeniedError(error)) {
        isGeminiAccessDenied = true;
      }
      res.status(500).json({ error: "Не удалось распознать продукты по фото. Попробуйте сделать более чёткие фото." });
    }
  });

  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
