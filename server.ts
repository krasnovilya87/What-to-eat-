import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI, Type } from "@google/genai";
import 'dotenv/config';
import * as cheerio from 'cheerio';
import axios from 'axios';

const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
  httpOptions: {
    headers: {
      'User-Agent': 'aistudio-build',
    }
  }
});

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
      
      // If only a URL is provided, try to scrape and then use AI
      if (textInput && !imageBase64) {
        try {
          const { data: html } = await axios.get(textInput, {
            headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36' }
          });
          const $ = cheerio.load(html);
          
          // Get text content of body
          const bodyText = $('body').text().substring(0, 10000); // Take first 10k chars
          const imageUrl = $('meta[property="og:image"]').attr('content');
          
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
            model: "gemini-3.5-flash",
            contents: { parts: [{ text: prompt }] },
            config: {
              responseMimeType: "application/json",
              responseSchema: {
                type: Type.OBJECT,
                properties: {
                  dishName: { type: Type.STRING },
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
          
          res.json({
            ...result,
            imageUrl: imageUrl,
            sourceUrl: textInput
          });
          return;
        } catch (e) {
            console.error("Scraping error:", e);
            res.json({
                dishName: "Новый рецепт (требует заполнения)",
                ingredients: [],
                instructions: [],
                sourceUrl: textInput
            });
            return;
        }
      }

      if (imageBase64) {
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
        model: "gemini-3.5-flash",
        contents: { parts },
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              dishName: { type: Type.STRING, description: "Name of the dish" },
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
      console.error("Gemini API error:", error);
      const message = error?.status === 503 || error?.message?.includes('503') || error?.message?.includes('high demand')
        ? "Сервисы ИИ сейчас перегружены. Пожалуйста, попробуйте еще раз через несколько минут." 
        : "Failed to extract recipe";
      res.status(500).json({ error: message });
    }
  });

  app.post("/api/suggest-recipes", async (req, res) => {
    try {
      const { fridgeItems, savedRecipes } = req.body;
      
      const prompt = `
        Here is what I have in my fridge: ${fridgeItems.join(', ')}.
        Here are my saved recipes: ${JSON.stringify(savedRecipes)}.
        
        Tell me which of my saved recipes I can cook right now (or with minimal extra ingredients), 
        and suggest 1-2 new recipes I can make with what I have.
        
        Return JSON.
      `;

      const response = await ai.models.generateContent({
        model: "gemini-3.5-flash",
        contents: prompt,
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              suggestions: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    name: { type: Type.STRING },
                    reason: { type: Type.STRING, description: "Why this was suggested (e.g. 'You have all ingredients')" },
                    missingIngredients: { type: Type.ARRAY, items: { type: Type.STRING } },
                    isNew: { type: Type.BOOLEAN, description: "True if this is a new suggestion, False if it's from saved recipes" }
                  },
                  required: ["name", "reason", "missingIngredients", "isNew"]
                }
              }
            },
            required: ["suggestions"]
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
      console.error("Gemini API error (suggest):", error);
      const message = error?.status === 503 || error?.message?.includes('503') || error?.message?.includes('high demand')
        ? "Сервисы ИИ сейчас перегружены. Пожалуйста, попробуйте еще раз через несколько минут." 
        : "Failed to get suggestions";
      res.status(500).json({ error: message });
    }
  });

  app.post("/api/normalize-ingredient", async (req, res) => {
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
        model: "gemini-3.5-flash",
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
      console.error("Gemini API error (normalize):", error);
      res.status(500).json({ error: "Failed to normalize ingredient" });
    }
  });

  app.post("/api/calculate-macros", async (req, res) => {
    try {
      const { dishName, ingredients, portions: userPortions } = req.body;
      if (!ingredients || !Array.isArray(ingredients) || ingredients.length === 0) {
        return res.status(400).json({ error: "No ingredients provided" });
      }

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
        model: "gemini-3.5-flash",
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
      console.error("Gemini API error (calculate-macros):", error);
      res.status(500).json({ error: "Failed to calculate macros" });
    }
  });

  app.post("/api/parse-receipt", async (req, res) => {
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
      console.error("Gemini API error (parse-receipt):", error);
      res.status(500).json({ error: "Не удалось распознать чек. Попробуйте еще раз или сделайте более четкое фото." });
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
