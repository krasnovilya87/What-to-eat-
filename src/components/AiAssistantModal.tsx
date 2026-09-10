import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  X, 
  Sparkles, 
  Mic, 
  MicOff, 
  Send, 
  Refrigerator, 
  ShoppingCart, 
  ChefHat, 
  Plus, 
  Check, 
  Loader2,
  Trash2,
  CheckCircle2
} from 'lucide-react';
import { v4 as uuidv4 } from 'uuid';
import { useAppState } from '../useAppState';
import { Recipe, ShoppingItem, InventoryItem } from '../types';
import { sendAssistantMessage, AiAssistantResult, AssistantActionItem } from '../utils/aiAssistant';
import { calculateNeededIngredients, scaleIngredient } from '../utils/ingredients';
import { mergeShoppingItems } from '../utils/supermarket';

interface Message {
  id: string;
  sender: 'user' | 'ai';
  text: string;
  images?: string[];
  result?: AiAssistantResult;
  timestamp: number;
}

interface AiAssistantModalProps {
  isOpen: boolean;
  onClose: () => void;
  state: ReturnType<typeof useAppState>;
}

function playSuccessChime() {
  try {
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContextClass) return;
    const ctx = new AudioContextClass();
    if (ctx.state === 'suspended') {
      ctx.resume().catch(() => {});
    }
    const now = ctx.currentTime;

    const osc1 = ctx.createOscillator();
    const gain1 = ctx.createGain();
    osc1.type = 'sine';
    osc1.frequency.setValueAtTime(587.33, now); // D5
    osc1.frequency.exponentialRampToValueAtTime(880.00, now + 0.08); // A5

    gain1.gain.setValueAtTime(0.18, now);
    gain1.gain.exponentialRampToValueAtTime(0.0001, now + 0.35);

    osc1.connect(gain1);
    gain1.connect(ctx.destination);
    osc1.start(now);
    osc1.stop(now + 0.35);

    const osc2 = ctx.createOscillator();
    const gain2 = ctx.createGain();
    osc2.type = 'triangle';
    osc2.frequency.setValueAtTime(1174.66, now + 0.07); // D6
    gain2.gain.setValueAtTime(0.1, now + 0.07);
    gain2.gain.exponentialRampToValueAtTime(0.0001, now + 0.42);

    osc2.connect(gain2);
    gain2.connect(ctx.destination);
    osc2.start(now + 0.07);
    osc2.stop(now + 0.42);
  } catch {
    // Безопасно для сред без аудио
  }
}

export default function AiAssistantModal({ isOpen, onClose, state }: AiAssistantModalProps) {
  const {
    recipes, setRecipes,
    fridge, setFridge,
    grains, setGrains,
    spices, setSpices,
    shoppingList, setShoppingList
  } = state;

  const [inputQuery, setInputQuery] = useState('');
  const [isMultiLine, setIsMultiLine] = useState(false);
  const [attachedImages, setAttachedImages] = useState<string[]>([]);
  const [messages, setMessages] = useState<Message[]>(() => [
    {
      id: 'welcome',
      sender: 'ai',
      text: 'Привет! Скажите голосом, напишите или прикрепите фото продуктов — я определю ингредиенты, добавлю их в наличие или покупки и предложу рецепты.',
      timestamp: Date.now()
    }
  ]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [speechSupported, setSpeechSupported] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const recognitionRef = useRef<any>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Сжатие изображения с камеры или галереи перед отправкой
  const compressImage = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const img = new Image();
        img.onload = () => {
          const maxDim = 1280;
          let width = img.width;
          let height = img.height;
          if (width > maxDim || height > maxDim) {
            if (width > height) {
              height = Math.round((height * maxDim) / width);
              width = maxDim;
            } else {
              width = Math.round((width * maxDim) / height);
              height = maxDim;
            }
          }
          const canvas = document.createElement('canvas');
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          if (!ctx) {
            resolve(reader.result as string);
            return;
          }
          ctx.drawImage(img, 0, 0, width, height);
          resolve(canvas.toDataURL('image/jpeg', 0.82));
        };
        img.onerror = () => reject(new Error('Ошибка чтения изображения'));
        img.src = e.target?.result as string;
      };
      reader.onerror = () => reject(new Error('Ошибка загрузки файла'));
      reader.readAsDataURL(file);
    });
  };

  const handleFilesSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const newImages: string[] = [];
    for (let i = 0; i < files.length; i++) {
      try {
        const compressed = await compressImage(files[i]);
        newImages.push(compressed);
      } catch (err) {
        console.warn('Compress failed:', err);
      }
    }

    if (newImages.length > 0) {
      setAttachedImages(prev => [...prev, ...newImages]);
    }

    if (e.target) {
      e.target.value = '';
    }
  };

  const removeAttachedImage = (index: number) => {
    setAttachedImages(prev => prev.filter((_, i) => i !== index));
  };

  // Автоматическое расширение высоты textarea и переключение на всю ширину при многострочном тексте
  useEffect(() => {
    if (!textareaRef.current) return;

    if (!inputQuery.trim()) {
      if (isMultiLine) setIsMultiLine(false);
      textareaRef.current.style.height = 'auto';
      return;
    }

    if (inputQuery.includes('\n')) {
      if (!isMultiLine) setIsMultiLine(true);
    } else {
      const sh = textareaRef.current.scrollHeight;
      // В однострочном режиме высота textarea ~38-40px. Если текст не помещается в одну строку — scrollHeight > 44px
      if (!isMultiLine && sh > 44) {
        setIsMultiLine(true);
      } else if (isMultiLine && inputQuery.length < 24 && sh <= 44) {
        setIsMultiLine(false);
      }
    }

    textareaRef.current.style.height = 'auto';
    const newHeight = Math.min(textareaRef.current.scrollHeight, 160);
    textareaRef.current.style.height = `${newHeight}px`;
  }, [inputQuery, isMultiLine]);

  // Прокрутка к последнему сообщению
  useEffect(() => {
    if (isOpen) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isOpen, attachedImages]);

  // Фокус на поле ввода при открытии
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => textareaRef.current?.focus(), 300);
    }
  }, [isOpen]);

  // Проверка поддержки Web Speech API
  useEffect(() => {
    const SpeechRecognitionClass = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    setSpeechSupported(!!SpeechRecognitionClass);
  }, []);

  // Очистка при закрытии модального окна
  useEffect(() => {
    if (!isOpen && recognitionRef.current) {
      try {
        recognitionRef.current.abort();
      } catch (e) {}
      recognitionRef.current = null;
      setIsListening(false);
    }
  }, [isOpen]);

  const toggleListening = async () => {
    const SpeechRecognitionClass = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    if (!SpeechRecognitionClass) {
      setToastMessage('Ваш браузер не поддерживает голосовой ввод. Используйте текстовое поле.');
      setTimeout(() => setToastMessage(null), 4000);
      textareaRef.current?.focus();
      return;
    }

    // Если уже слушает — останавливаем
    if (isListening) {
      if (recognitionRef.current) {
        try {
          recognitionRef.current.stop();
        } catch (e) {
          console.warn('Recognition stop error:', e);
        }
      }
      setIsListening(false);
      return;
    }

    // Запрашиваем доступ к микрофону
    if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        // Сразу освобождаем дорожки, так как SpeechRecognition использует собственный аудиоканал
        stream.getTracks().forEach(track => track.stop());
      } catch (err: any) {
        console.warn('Microphone permission error:', err);
        setToastMessage('Разрешите доступ к микрофону в настройках браузера');
        setTimeout(() => setToastMessage(null), 4000);
        return;
      }
    }

    try {
      if (recognitionRef.current) {
        try {
          recognitionRef.current.abort();
        } catch (e) {}
        recognitionRef.current = null;
      }

      const recognition = new SpeechRecognitionClass();
      recognition.lang = 'ru-RU';
      recognition.continuous = false;
      recognition.interimResults = true;
      recognition.maxAlternatives = 1;

      recognition.onstart = () => {
        setIsListening(true);
      };

      const initialText = inputQuery.trim();
      recognition.onresult = (event: any) => {
        let currentTranscript = '';
        for (let i = 0; i < event.results.length; i++) {
          currentTranscript += event.results[i][0].transcript;
        }
        if (currentTranscript) {
          const combined = initialText ? `${initialText} ${currentTranscript}` : currentTranscript;
          setInputQuery(combined);
        }
      };

      recognition.onerror = (event: any) => {
        console.warn('Speech recognition error:', event.error);
        setIsListening(false);
        recognitionRef.current = null;

        if (event.error === 'not-allowed' || event.error === 'service-not-allowed') {
          setToastMessage('Доступ к микрофону заблокирован в браузере');
          setTimeout(() => setToastMessage(null), 4000);
        } else if (event.error === 'network') {
          setToastMessage('Для распознавания речи требуется подключение к интернету');
          setTimeout(() => setToastMessage(null), 4000);
        } else if (event.error !== 'no-speech') {
          setToastMessage('Ошибка распознавания. Попробуйте еще раз');
          setTimeout(() => setToastMessage(null), 3000);
        }
      };

      recognition.onend = () => {
        setIsListening(false);
        recognitionRef.current = null;
      };

      recognitionRef.current = recognition;
      recognition.start();
      setIsListening(true);
    } catch (err: any) {
      console.error('Failed to start speech recognition:', err);
      setIsListening(false);
      recognitionRef.current = null;
      setToastMessage('Не удалось запустить микрофон. Попробуйте обновить страницу');
      setTimeout(() => setToastMessage(null), 4000);
    }
  };

  // Автоматическое применение изменений в состояние приложения
  const applyAssistantActions = (result: AiAssistantResult) => {
    // 1. Добавление в холодильник / крупы / приправы
    if (result.addedFridgeItems && result.addedFridgeItems.length > 0) {
      const fridgeToAdd: InventoryItem[] = [];
      const grainsToAdd: InventoryItem[] = [];
      const spicesToAdd: InventoryItem[] = [];

      for (const item of result.addedFridgeItems) {
        const newInv: InventoryItem = {
          id: uuidv4(),
          name: item.name,
          quantity: item.quantity || '1 шт'
        };

        if (item.section === 'grains') {
          grainsToAdd.push(newInv);
        } else if (item.section === 'spices') {
          spicesToAdd.push(newInv);
        } else {
          fridgeToAdd.push(newInv);
        }
      }

      if (fridgeToAdd.length > 0) {
        setFridge(prev => [...(prev || []), ...fridgeToAdd]);
      }
      if (grainsToAdd.length > 0) {
        setGrains(prev => [...(prev || []), ...grainsToAdd]);
      }
      if (spicesToAdd.length > 0) {
        setSpices(prev => [...(prev || []), ...spicesToAdd]);
      }

      if (!result.addedShoppingItems || result.addedShoppingItems.length === 0) {
        playSuccessChime();
        const names = result.addedFridgeItems.map(i => i.name).join(', ');
        setToastMessage(`Добавлено в наличие: ${names}`);
        setTimeout(() => setToastMessage(null), 3500);
      }
    }

    // 2. Добавление в список покупок
    if (result.addedShoppingItems && result.addedShoppingItems.length > 0) {
      const newShopping: ShoppingItem[] = result.addedShoppingItems.map(item => ({
        id: uuidv4(),
        name: item.name,
        quantity: item.quantity || '',
        checked: false,
        isManual: true
      }));
      setShoppingList(prev => mergeShoppingItems(prev || [], newShopping));

      // Звуковой сигнал и всплывающая галочка подтверждения
      playSuccessChime();
      const names = result.addedShoppingItems.map(i => i.name).join(', ');
      setToastMessage(`Добавлено в список покупок: ${names}`);
      setTimeout(() => setToastMessage(null), 3500);
    }

    // 3. Удаление из наличия
    if (result.removedInventory && result.removedInventory.length > 0) {
      const toRemoveLower = result.removedInventory.map(n => n.toLowerCase().trim());
      setFridge(prev => (prev || []).filter(i => !toRemoveLower.some(r => i.name.toLowerCase().includes(r))));
      setGrains(prev => (prev || []).filter(i => !toRemoveLower.some(r => i.name.toLowerCase().includes(r))));
      setSpices(prev => (prev || []).filter(i => !toRemoveLower.some(r => i.name.toLowerCase().includes(r))));
    }
  };

  const handleSendMessage = async (textToSend?: string) => {
    const text = (textToSend !== undefined ? textToSend : inputQuery).trim();
    const currentImages = [...attachedImages];
    if ((!text && currentImages.length === 0) || isProcessing) return;

    if (isListening && recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch (e) {}
      setIsListening(false);
    }

    const userMsg: Message = {
      id: uuidv4(),
      sender: 'user',
      text: text || (currentImages.length > 0 ? 'Распознай продукты на фото' : ''),
      images: currentImages.length > 0 ? currentImages : undefined,
      timestamp: Date.now()
    };

    setMessages(prev => [...prev, userMsg]);
    setInputQuery('');
    setAttachedImages([]);
    setIsMultiLine(false);
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }
    setIsProcessing(true);

    try {
      const assistantResult = await sendAssistantMessage(
        text || (currentImages.length > 0 ? 'Определи продукты на фото и добавь их в приложение' : ''),
        {
          recipes,
          fridge,
          grains,
          spices,
          shoppingList
        },
        currentImages.length > 0 ? currentImages : undefined
      );

      // Применяем действия автоматически
      applyAssistantActions(assistantResult);

      const aiMsg: Message = {
        id: uuidv4(),
        sender: 'ai',
        text: assistantResult.reply,
        result: assistantResult,
        timestamp: Date.now()
      };
      setMessages(prev => [...prev, aiMsg]);
    } catch (error) {
      console.error('Assistant error:', error);
      const fallbackMsg: Message = {
        id: uuidv4(),
        sender: 'ai',
        text: 'Произошла ошибка при обработке запроса. Попробуйте еще раз.',
        timestamp: Date.now()
      };
      setMessages(prev => [...prev, fallbackMsg]);
    } finally {
      setIsProcessing(false);
    }
  };

  // Кнопка "Готовлю сегодня" для рецепта из ответа ИИ
  const handleCookToday = (recipe: Recipe) => {
    const allInventory = [...fridge, ...grains, ...spices];
    const portions = recipe.portions || recipe.basePortions || 2;
    const ratio = portions / (recipe.basePortions || portions || 1);

    const scaledIngredients = (recipe.ingredients || []).map(ing => scaleIngredient(ing, ratio));
    const needed = calculateNeededIngredients(scaledIngredients, allInventory);

    if (needed.length > 0) {
      const newShoppingItems: ShoppingItem[] = needed.map(item => ({
        id: uuidv4(),
        name: item.name,
        quantity: item.quantity,
        checked: false,
        isManual: false
      }));
      setShoppingList(prev => mergeShoppingItems(prev || [], newShoppingItems));
    }

    const exists = recipes.some(r => r.name.toLowerCase().trim() === recipe.name.toLowerCase().trim());
    if (exists) {
      setRecipes(prev => (prev || []).map(r => 
        r.name.toLowerCase().trim() === recipe.name.toLowerCase().trim()
          ? { ...r, isPrepared: true, portions }
          : r
      ));
    } else {
      const newRec: Recipe = {
        ...recipe,
        id: uuidv4(),
        isPrepared: true,
        portions
      };
      setRecipes(prev => [newRec, ...(prev || [])]);
    }

    setToastMessage(`«${recipe.name}» (${portions} порц.) добавлено в покупки!`);
    setTimeout(() => setToastMessage(null), 3000);
  };

  // Кнопка "Добавить в мои рецепты"
  const handleSaveRecipe = (recipe: Recipe) => {
    const exists = recipes.some(r => r.name.toLowerCase().trim() === recipe.name.toLowerCase().trim());
    if (exists) {
      setToastMessage(`«${recipe.name}» уже есть в ваших рецептах!`);
      setTimeout(() => setToastMessage(null), 3000);
      return;
    }

    const newRec: Recipe = {
      ...recipe,
      id: uuidv4()
    };
    setRecipes(prev => [newRec, ...(prev || [])]);
    setToastMessage(`«${recipe.name}» добавлен в мои рецепты!`);
    setTimeout(() => setToastMessage(null), 3000);
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div 
        className="fixed inset-0 bg-stone-900/60 backdrop-blur-sm z-[70] flex flex-col justify-end sm:items-center sm:justify-center p-0 sm:p-4"
        onClick={onClose}
      >
        <motion.div 
          initial={{ y: "100%", opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: "100%", opacity: 0 }}
          transition={{ type: "spring", damping: 25, stiffness: 300 }}
          className="bg-stone-50 rounded-t-[2.2rem] sm:rounded-[2.2rem] w-full sm:max-w-lg h-[92vh] sm:h-[85vh] flex flex-col shadow-2xl relative overflow-hidden"
          onClick={e => e.stopPropagation()}
        >
          {/* Верхняя панель */}
          <div className="bg-white px-5 py-4 flex items-center justify-between shadow-xs shrink-0 z-10">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-emerald-600 text-white flex items-center justify-center shadow-md">
                <Sparkles size={20} />
              </div>
              <div>
                <h2 className="font-bold text-lg text-stone-800 leading-tight">
                  ИИ Ассистент
                </h2>
                
              </div>
            </div>

            <button 
              onClick={onClose}
              className="p-2.5 rounded-full bg-stone-100 hover:bg-stone-200 text-stone-600 transition-colors cursor-pointer"
            >
              <X size={20} />
            </button>
          </div>

          {/* Toast уведомление */}
          {toastMessage && (
            <div className="absolute top-16 inset-x-4 z-20 flex justify-center pointer-events-none">
              <div className="bg-stone-900/90 backdrop-blur-md text-white px-4 py-2.5 rounded-2xl shadow-xl text-xs font-semibold flex items-center gap-2">
                <Check size={16} className="text-emerald-400" />
                <span>{toastMessage}</span>
              </div>
            </div>
          )}

          {/* Список сообщений диалога */}
          <div className="flex-1 overflow-y-auto no-scrollbar p-4 flex flex-col gap-3.5">
            {messages.map((msg) => (
              <div 
                key={msg.id}
                className={`flex flex-col ${msg.sender === 'user' ? 'items-end' : 'items-start'} max-w-[90%] ${msg.sender === 'user' ? 'self-end' : 'self-start'}`}
              >
                <div 
                  className={`px-4 py-3 rounded-2xl text-sm leading-relaxed ${
                    msg.sender === 'user' 
                      ? 'bg-emerald-600 text-white rounded-br-xs shadow-sm font-medium' 
                      : 'bg-white text-stone-800 rounded-bl-xs shadow-xs font-normal'
                  }`}
                >
                  {msg.images && msg.images.length > 0 && (
                    <div className="flex flex-wrap gap-2 mb-2">
                      {msg.images.map((imgSrc, imgIdx) => (
                        <img 
                          key={imgIdx} 
                          src={imgSrc} 
                          alt="Прикреплённое фото" 
                          className="w-24 h-24 sm:w-28 sm:h-28 object-cover rounded-xl shadow-2xs" 
                        />
                      ))}
                    </div>
                  )}
                  {msg.text}
                </div>

                {/* Карточки автоматически выполненных действий */}
                {msg.result && (
                  <div className="w-full mt-2 flex flex-col gap-2">
                    {/* Добавлено в наличие */}
                    {msg.result.addedFridgeItems && msg.result.addedFridgeItems.length > 0 && (
                      <div className="bg-white rounded-2xl p-3 shadow-xs flex flex-col gap-1.5">
                        <div className="flex items-center gap-2 text-xs font-bold text-emerald-700">
                          <Refrigerator size={16} />
                          <span>Добавлено в наличие ({msg.result.addedFridgeItems.length}):</span>
                        </div>
                        <div className="flex flex-wrap gap-1.5 mt-0.5">
                          {msg.result.addedFridgeItems.map((item, idx) => (
                            <span 
                              key={idx}
                              className="text-xs bg-emerald-50 text-emerald-800 font-semibold px-2.5 py-1 rounded-xl shadow-2xs"
                            >
                              {item.name} {item.quantity ? `• ${item.quantity}` : ''}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Добавлено в список покупок */}
                    {msg.result.addedShoppingItems && msg.result.addedShoppingItems.length > 0 && (
                      <div className="bg-white rounded-2xl p-3 shadow-xs flex flex-col gap-2">
                        <div className="flex items-center gap-2 text-xs font-bold text-stone-800">
                          <div className="w-5 h-5 rounded-full bg-emerald-600 text-white flex items-center justify-center shrink-0 shadow-2xs">
                            <Check size={13} strokeWidth={3} />
                          </div>
                          <span>Добавлено в список покупок ({msg.result.addedShoppingItems.length}):</span>
                        </div>
                        <div className="flex flex-wrap gap-1.5 mt-0.5">
                          {msg.result.addedShoppingItems.map((item, idx) => (
                            <span 
                              key={idx}
                              className="text-xs bg-stone-100 text-stone-900 font-semibold px-2.5 py-1 rounded-xl shadow-2xs flex items-center gap-1.5"
                            >
                              <Check size={13} className="text-emerald-600 shrink-0" strokeWidth={2.5} />
                              <span>{item.name} {item.quantity ? `• ${item.quantity}` : ''}</span>
                            </span>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Убрано из инвентаря */}
                    {msg.result.removedInventory && msg.result.removedInventory.length > 0 && (
                      <div className="bg-white rounded-2xl p-3 shadow-xs flex flex-col gap-1.5">
                        <div className="flex items-center gap-2 text-xs font-bold text-red-600">
                          <Trash2 size={16} />
                          <span>Убрано из наличия:</span>
                        </div>
                        <div className="flex flex-wrap gap-1.5 mt-0.5">
                          {msg.result.removedInventory.map((name, idx) => (
                            <span 
                              key={idx}
                              className="text-xs bg-red-50 text-red-700 font-medium px-2 py-0.5 rounded-lg"
                            >
                              {name}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Предложенный рецепт */}
                    {msg.result.suggestedRecipe && (
                      <div className="bg-white rounded-2xl overflow-hidden shadow-sm flex flex-col">
                        {msg.result.suggestedRecipe.imageUrl && (
                          <img 
                            src={msg.result.suggestedRecipe.imageUrl} 
                            alt={msg.result.suggestedRecipe.name} 
                            className="w-full h-32 object-cover"
                          />
                        )}
                        <div className="p-3.5 flex flex-col gap-2">
                          <div>
                            <span className="text-[10px] font-bold text-stone-500 uppercase tracking-wider">
                              {msg.result.suggestedRecipe.category || 'Рецепт'}
                            </span>
                            <h4 className="font-bold text-base text-stone-900 leading-tight mt-0.5">
                              {msg.result.suggestedRecipe.name}
                            </h4>
                            <p className="text-xs text-stone-500 mt-0.5">
                              {msg.result.suggestedRecipe.portions || 2} порц.
                              {msg.result.suggestedRecipe.macros?.calories ? ` • ${msg.result.suggestedRecipe.macros.calories} ккал` : ''}
                            </p>
                          </div>

                          <div className="flex gap-2 mt-1">
                            <button
                              onClick={() => handleCookToday(msg.result!.suggestedRecipe!)}
                              className="flex-1 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold rounded-xl text-xs flex items-center justify-center gap-1.5 shadow-xs cursor-pointer active:scale-98 transition-colors"
                            >
                              <ChefHat size={15} />
                              <span>Готовлю сегодня</span>
                            </button>
                            <button
                              onClick={() => handleSaveRecipe(msg.result!.suggestedRecipe!)}
                              className="py-2.5 px-3 bg-stone-100 hover:bg-stone-200 text-stone-700 font-semibold rounded-xl text-xs flex items-center justify-center gap-1 shadow-2xs cursor-pointer active:scale-98 transition-colors"
                            >
                              <Plus size={15} />
                              <span>В мои рецепты</span>
                            </button>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}

            {isProcessing && (
              <div className="self-start bg-white px-4 py-3 rounded-2xl rounded-bl-xs shadow-xs flex items-center gap-2 text-stone-500 text-sm">
                <Loader2 size={16} className="animate-spin text-emerald-600" />
                <span>Определяю продукты и рецепты...</span>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* Индикатор голосовой записи */}
          {isListening && (
            <div className="bg-emerald-50 px-4 py-2 flex items-center justify-between text-xs text-emerald-800 font-semibold shrink-0">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-red-500 animate-ping" />
                <span>Слушаю вас... Говорите свои пожелания</span>
              </div>
              <button 
                type="button"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  toggleListening();
                }}
                className="text-emerald-700 underline font-bold cursor-pointer"
              >
                Готово
              </button>
            </div>
          )}

          {/* Нижнее поле ввода с кнопками фото, картинки, микрофона и авторасширяемым полем */}
          <div className="p-3 bg-white shadow-[0_-4px_12px_rgba(0,0,0,0.03)] shrink-0">
            {/* Превью прикреплённых фотографий / картинок */}
            {attachedImages.length > 0 && (
              <div className="flex items-center gap-2 p-2 bg-stone-100/80 rounded-2xl mb-2 overflow-x-auto no-scrollbar">
                {attachedImages.map((imgSrc, idx) => (
                  <div key={idx} className="relative shrink-0 w-14 h-14 rounded-xl overflow-hidden shadow-2xs">
                    <img src={imgSrc} alt="Preview" className="w-full h-full object-cover" />
                    <button
                      type="button"
                      onClick={() => removeAttachedImage(idx)}
                      className="absolute top-1 right-1 w-5 h-5 bg-stone-900/80 hover:bg-stone-900 text-white rounded-full flex items-center justify-center cursor-pointer shadow-xs transition-colors"
                      title="Удалить"
                    >
                      <X size={12} />
                    </button>
                  </div>
                ))}
                <span className="text-xs font-medium text-stone-500 ml-1 whitespace-nowrap">
                  {attachedImages.length === 1 ? '1 фото' : `${attachedImages.length} фото`}
                </span>
              </div>
            )}

            <form 
              onSubmit={(e) => {
                e.preventDefault();
                handleSendMessage();
              }}
              className={`bg-stone-100 rounded-2xl shadow-inner transition-all grid grid-cols-[auto_1fr_auto] ${
                isMultiLine 
                  ? 'gap-2 p-2' 
                  : 'gap-1.5 items-end p-1.5'
              }`}
            >
              {/* Скрытый инпут для вызова контекстного меню телефона (камера, медиатека, файлы) */}
              <input 
                ref={fileInputRef}
                type="file" 
                accept="image/*" 
                multiple 
                onChange={handleFilesSelected} 
                className="hidden" 
              />

              {/* Поле ввода: в 1 строку находится рядом с плюсом, а при переносе текста поднимается наверх на всю ширину */}
              <textarea
                ref={textareaRef}
                rows={1}
                value={inputQuery}
                onChange={(e) => setInputQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleSendMessage();
                  }
                }}
                placeholder={isListening ? 'Говорите...' : 'Пожелания или текст...'}
                disabled={isProcessing}
                className={`bg-transparent text-sm text-stone-900 placeholder-stone-400 focus:outline-none resize-none max-h-40 overflow-y-auto no-scrollbar leading-relaxed ${
                  isMultiLine
                    ? 'col-span-full row-start-1 w-full px-1.5 py-1 min-h-[44px]'
                    : 'col-start-2 row-start-1 w-full px-1 py-2 min-h-[40px]'
                }`}
              />

              {/* Кнопка плюса - открывает контекстное меню телефона */}
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className={`p-2.5 rounded-xl bg-white hover:bg-emerald-50 text-stone-700 hover:text-emerald-700 transition-all cursor-pointer flex items-center justify-center shrink-0 shadow-2xs active:scale-90 ${
                  isMultiLine ? 'col-start-1 row-start-2' : 'col-start-1 row-start-1'
                }`}
                title="Прикрепить фото (камера или галерея)"
              >
                <Plus size={19} />
              </button>

              {/* Кнопки справа: микрофон рядом с кнопкой отправить */}
              <div 
                className={`flex items-center gap-1.5 shrink-0 ${
                  isMultiLine ? 'col-start-3 row-start-2 justify-self-end' : 'col-start-3 row-start-1'
                }`}
              >
                {/* Кнопка микрофона */}
                <button
                  type="button"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    toggleListening();
                  }}
                  className={`p-2.5 rounded-xl transition-all cursor-pointer flex items-center justify-center shrink-0 active:scale-90 ${
                    isListening 
                      ? 'bg-red-500 text-white shadow-md animate-pulse' 
                      : 'bg-white text-emerald-600 shadow-2xs hover:bg-emerald-50'
                  }`}
                  title={isListening ? 'Остановить запись' : 'Говорить голосом'}
                >
                  {isListening ? <MicOff size={19} /> : <Mic size={19} />}
                </button>

                {/* Кнопка отправки */}
                <button
                  type="submit"
                  disabled={(!inputQuery.trim() && attachedImages.length === 0) || isProcessing}
                  className="p-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-40 text-white rounded-xl transition-all shadow-xs cursor-pointer flex items-center justify-center active:scale-95 shrink-0"
                  title="Отправить"
                >
                  <Send size={18} />
                </button>
              </div>
            </form>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
