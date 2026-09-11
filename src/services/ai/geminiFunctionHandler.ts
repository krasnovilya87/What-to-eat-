// src/services/ai/geminiFunctionHandler.ts

import * as fn from './backendFunctions';
import type { UserContext, BackendExecutionResult } from './backendFunctions';

export async function executeGeminiFunction(
  functionName: string,
  args: any,
  context: UserContext
): Promise<BackendExecutionResult> {
  try {
    switch (functionName) {
      // =========================
      // RECIPES
      // =========================
      case "getRecipes":
        return await fn.getRecipes(args, context);

      case "searchRecipes":
        return await fn.searchRecipes(args, context);

      case "getRecipe":
        return await fn.getRecipe(args, context);

      case "createRecipe":
        return await fn.createRecipe(args, context);

      case "updateRecipe":
        return await fn.updateRecipe(args, context);

      case "deleteRecipe":
        return await fn.deleteRecipe(args, context);

      case "duplicateRecipe":
        return await fn.duplicateRecipe(args, context);

      case "addIngredient":
        return await fn.addIngredient(args, context);

      case "removeIngredient":
        return await fn.removeIngredient(args, context);

      case "replaceIngredient":
        return await fn.replaceIngredient(args, context);

      case "changeServings":
        return await fn.changeServings(args, context);

      case "recalculateNutrition":
        return await fn.recalculateNutrition(args, context);

      // =========================
      // INVENTORY
      // =========================
      case "getInventory":
        return await fn.getInventory(args, context);

      case "addInventoryProduct":
        return await fn.addInventoryProduct(args, context);

      case "updateInventoryProduct":
        return await fn.updateInventoryProduct(args, context);

      case "updateInventoryQuantity":
        return await fn.updateInventoryQuantity(args, context);

      case "removeInventoryProduct":
        return await fn.removeInventoryProduct(args, context);

      case "getFavoriteProducts":
        return await fn.getFavoriteProducts(args, context);

      // =========================
      // SHOPPING
      // =========================
      case "calculateShoppingList":
        return await fn.calculateShoppingList(args, context);

      case "processReceipt":
        return await fn.processReceipt(args, context);

      case "getPurchaseHistory":
        return await fn.getPurchaseHistory(args, context);

      case "getPurchasePrediction":
        return await fn.getPurchasePrediction(args, context);

      case "getPurchaseSchedule":
        return await fn.getPurchaseSchedule(args, context);

      case "createReminder":
        return await fn.createReminder(args, context);

      // =========================
      // CALENDAR
      // =========================
      case "getCalendar":
        return await fn.getCalendar(args, context);

      case "addCalendarMeal":
        return await fn.addCalendarMeal(args, context);

      case "removeCalendarMeal":
        return await fn.removeCalendarMeal(args, context);

      case "getDailyNutrition":
        return await fn.getDailyNutrition(args, context);

      // =========================
      // NUTRITION
      // =========================
      case "selectRecipeForNutrition":
        return await fn.selectRecipeForNutrition(args, context);

      case "generateWeeklyMenu":
        return await fn.generateWeeklyMenu(args, context);

      // =========================
      // IMAGE
      // =========================
      case "analyzeFoodImage":
        return await fn.analyzeFoodImage(args, context);

      // =========================
      // UNKNOWN
      // =========================
      default:
        return {
          success: false,
          error: {
            code: "UNKNOWN_FUNCTION",
            message: `Unknown Gemini function: ${functionName}`
          }
        };
    }
  } catch (error: any) {
    console.error(`Gemini function "${functionName}" failed:`, error);
    return {
      success: false,
      error: {
        code: "FUNCTION_EXECUTION_ERROR",
        message: error?.message || "Function execution failed"
      }
    };
  }
}
