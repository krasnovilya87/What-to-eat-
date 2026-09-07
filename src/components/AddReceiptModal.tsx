import React, { useState, useRef } from 'react';
import { Camera, Image as ImageIcon, X, Loader2, Check, Plus, Trash2, Calendar, Store, AlertCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { v4 as uuidv4 } from 'uuid';
import { ReceiptPurchase, ReceiptItem, ShoppingItem, InventoryItem } from '../types';
import { cn } from '../App';
import { cleanProductName } from '../utils/geoFavorites';
import { estimateItemMacros } from '../utils/macroEstimator';
import { apiPost } from '../utils/api';

interface AddReceiptModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSavePurchase: (purchase: ReceiptPurchase, syncShopping: boolean, syncFridge: boolean) => void;
  shoppingList: ShoppingItem[];
}

export default function AddReceiptModal({
  isOpen,
  onClose,
  onSavePurchase,
  shoppingList
}: AddReceiptModalProps) {
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Editable parsed receipt state
  const [storeName, setStoreName] = useState('Супермаркет');
  const [purchaseDate, setPurchaseDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [items, setItems] = useState<ReceiptItem[]>([]);
  const [syncShopping, setSyncShopping] = useState(true);
  const [syncFridge, setSyncFridge] = useState(false);
  const [hasParsed, setHasParsed] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const resetState = () => {
    setSelectedImage(null);
    setIsLoading(false);
    setErrorMessage(null);
    setHasParsed(false);
    setItems([]);
  };

  const handleClose = () => {
    resetState();
    onClose();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const base64 = event.target?.result as string;
      setSelectedImage(base64);
      parseReceiptImage(base64);
    };
    reader.readAsDataURL(file);
  };

  const parseReceiptImage = async (base64: string) => {
    setIsLoading(true);
    setErrorMessage(null);
    setHasParsed(false);

    try {
      const data = await apiPost('/api/parse-receipt', { imageBase64: base64 });

      setStoreName(data.storeName || 'Супермаркет');
      if (data.purchaseDate && !isNaN(Date.parse(data.purchaseDate))) {
        setPurchaseDate(data.purchaseDate);
      } else {
        setPurchaseDate(new Date().toISOString().split('T')[0]);
      }

      const parsedItems: ReceiptItem[] = (data.items || []).map((item: any) => {
        const itemMacros = item.macros && Number(item.macros.calories) > 0
          ? item.macros
          : estimateItemMacros(item.name || 'Товар', item.quantity);

        return {
          id: uuidv4(),
          name: item.name || 'Товар',
          quantity: item.quantity || '1 шт',
          price: Number(item.price) || 0,
          category: item.category || 'Другое',
          macros: itemMacros
        };
      });

      setItems(parsedItems);
      setHasParsed(true);
    } catch (err: any) {
      console.error(err);
      setErrorMessage(err.message || 'Не удалось распознать чек. Попробуйте еще раз.');
    } finally {
      setIsLoading(false);
    }
  };

  // Editable items handlers
  const handleItemChange = (id: string, field: keyof ReceiptItem, val: any) => {
    setItems(prev => prev.map(item => item.id === id ? { ...item, [field]: val } : item));
  };

  const handleRemoveItem = (id: string) => {
    setItems(prev => prev.filter(item => item.id !== id));
  };

  const handleAddItem = () => {
    setItems(prev => [
      ...prev,
      {
        id: uuidv4(),
        name: 'Новый товар',
        quantity: '1 шт',
        price: 100,
        category: 'Другое'
      }
    ]);
  };

  const calculatedTotal = items.reduce((sum, item) => sum + (Number(item.price) || 0), 0);

  const handleSave = () => {
    if (items.length === 0) {
      setErrorMessage('В чеке должен быть хотя бы один товар');
      return;
    }

    const newPurchase: ReceiptPurchase = {
      id: uuidv4(),
      storeName: storeName.trim() || 'Супермаркет',
      date: purchaseDate,
      timestamp: new Date(purchaseDate).getTime() || Date.now(),
      totalAmount: Math.round(calculatedTotal * 100) / 100,
      items,
      imageUrl: selectedImage || undefined
    };

    onSavePurchase(newPurchase, syncShopping, syncFridge);
    handleClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-stone-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto no-scrollbar">
      <motion.div
        initial={{ opacity: 0, scale: 0.96, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.96, y: 10 }}
        className="bg-white rounded-3xl w-full max-w-xl shadow-2xl border border-stone-200 overflow-hidden flex flex-col max-h-[92vh]"
      >
        {/* Шапка модального окна */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-stone-200 bg-stone-50/70">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-2xl bg-amber-100 text-amber-900 flex items-center justify-center font-bold text-lg shadow-xs">
              🧾
            </div>
            <div>
              <h3 className="text-lg font-bold text-stone-900 leading-tight">
                Добавить чек
              </h3>
              
            </div>
          </div>
          <button
            type="button"
            onClick={handleClose}
            className="text-stone-400 hover:text-stone-700 p-1.5 rounded-xl hover:bg-stone-200/50 transition-colors cursor-pointer"
          >
            <X size={20} />
          </button>
        </div>

        {/* Скрытые инпуты для камеры и файлов */}
        <input
          type="file"
          ref={cameraInputRef}
          accept="image/*"
          capture="environment"
          className="hidden"
          onChange={handleFileChange}
        />
        <input
          type="file"
          ref={fileInputRef}
          accept="image/*"
          className="hidden"
          onChange={handleFileChange}
        />

        {/* Основной контент */}
        <div className="flex-1 overflow-y-auto no-scrollbar p-5 sm:p-6 space-y-5">
          {/* Если изображение ещё не выбрано или нужно заменить */}
          {!hasParsed && !isLoading && (
            <div className="space-y-4">
              <div className="border-2 border-dashed border-stone-300 rounded-3xl p-6 text-center bg-stone-50/50 hover:bg-stone-50 transition-colors">
                <div className="flex justify-center gap-3 mb-4">
                  <button
                    type="button"
                    onClick={() => cameraInputRef.current?.click()}
                    className="flex flex-col items-center gap-2 bg-stone-900 hover:bg-stone-800 text-white px-5 py-3.5 rounded-2xl font-medium text-xs transition-colors cursor-pointer shadow-sm active:scale-95"
                  >
                    <Camera size={22} className="text-amber-300" />
                    <span>Снять на камеру</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="flex flex-col items-center gap-2 bg-white hover:bg-stone-100 text-stone-900 border border-stone-300 px-5 py-3.5 rounded-2xl font-medium text-xs transition-colors cursor-pointer shadow-xs active:scale-95"
                  >
                    <ImageIcon size={22} className="text-stone-600" />
                    <span>Выбрать из галереи</span>
                  </button>
                </div>

                <p className="text-xs text-stone-500 max-w-sm mx-auto leading-relaxed">
                  Сфотографируйте кассовый чек из супермаркета или купленные продукты. ИИ автоматически распознает список покупок, магазин, дату и цены.
                </p>
              </div>

              {errorMessage && (
                <div className="flex items-center gap-2 p-3.5 bg-red-50 text-red-800 rounded-2xl text-xs border border-red-200">
                  <AlertCircle size={16} className="shrink-0" />
                  <span>{errorMessage}</span>
                </div>
              )}
            </div>
          )}

          {/* Индикатор загрузки / распознавания */}
          {isLoading && (
            <div className="py-12 flex flex-col items-center justify-center text-center space-y-4">
              <div className="relative">
                <div className="w-16 h-16 rounded-3xl bg-amber-100 flex items-center justify-center text-amber-800 animate-pulse">
                  <Loader2 size={32} className="animate-spin text-stone-900" />
                </div>
              </div>
              <div className="space-y-1">
                <h4 className="font-bold text-stone-900 text-base">
                  Распознаём чек...
                </h4>
                <p className="text-xs text-stone-500 max-w-xs">
                  Считываем название магазина, дату, цены и сопоставляем позиции с продуктовыми отделами.
                </p>
              </div>
            </div>
          )}

          {/* Результат распознавания: редактирование перед сохранением */}
          {hasParsed && (
            <div className="space-y-5">
              {/* Верхняя панель: Магазин, Дата, Превью фото */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-4 bg-stone-50 rounded-2xl border border-stone-200">
                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-stone-500 mb-1 flex items-center gap-1.5">
                    <Store size={12} /> Магазин
                  </label>
                  <input
                    type="text"
                    value={storeName}
                    onChange={(e) => setStoreName(e.target.value)}
                    className="w-full bg-white border border-stone-300 rounded-xl px-3 py-2 text-sm font-semibold text-stone-900 focus:outline-none focus:border-stone-900"
                    placeholder="Например, Пятёрочка"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-stone-500 mb-1 flex items-center gap-1.5">
                    <Calendar size={12} /> Дата покупки
                  </label>
                  <input
                    type="date"
                    value={purchaseDate}
                    onChange={(e) => setPurchaseDate(e.target.value)}
                    className="w-full bg-white border border-stone-300 rounded-xl px-3 py-2 text-sm font-semibold text-stone-900 focus:outline-none focus:border-stone-900"
                  />
                </div>
              </div>

              {/* Список распознанных товаров */}
              <div>
                <div className="flex items-center justify-between mb-2.5">
                  <span className="text-xs font-bold uppercase tracking-wider text-stone-700">
                    Распознанные позиции ({items.length})
                  </span>
                  <button
                    type="button"
                    onClick={handleAddItem}
                    className="text-xs font-semibold text-stone-800 hover:text-stone-950 bg-stone-100 hover:bg-stone-200 px-2.5 py-1 rounded-xl transition-colors cursor-pointer flex items-center gap-1"
                  >
                    <Plus size={14} /> Добавить строку
                  </button>
                </div>

                <div className="border border-stone-200 rounded-2xl overflow-hidden divide-y divide-stone-100 bg-white shadow-xs max-h-64 overflow-y-auto no-scrollbar">
                  {items.map((item) => (
                    <div key={item.id} className="p-2.5 flex items-center gap-2 hover:bg-stone-50/80 transition-colors">
                      {/* Название */}
                      <input
                        type="text"
                        value={item.name}
                        onChange={(e) => handleItemChange(item.id, 'name', e.target.value)}
                        className="flex-1 min-w-0 bg-transparent text-sm font-medium text-stone-900 focus:bg-white focus:outline-none focus:ring-1 focus:ring-stone-400 rounded-lg px-2 py-1"
                        placeholder="Название"
                      />

                      {/* Количество */}
                      <input
                        type="text"
                        value={item.quantity || ''}
                        onChange={(e) => handleItemChange(item.id, 'quantity', e.target.value)}
                        className="w-16 text-center text-xs text-stone-600 bg-stone-100 focus:bg-white border border-stone-200 rounded-lg px-1.5 py-1 focus:outline-none focus:ring-1 focus:ring-stone-400"
                        placeholder="1 шт"
                      />

                      {/* Цена */}
                      <div className="flex items-center gap-1 shrink-0">
                        <input
                          type="number"
                          step="any"
                          value={item.price}
                          onChange={(e) => handleItemChange(item.id, 'price', Number(e.target.value) || 0)}
                          className="w-20 text-right text-sm font-bold text-stone-900 bg-stone-100 focus:bg-white border border-stone-200 rounded-lg px-2 py-1 focus:outline-none focus:ring-1 focus:ring-stone-400"
                        />
                        <span className="text-xs font-semibold text-stone-500">₽</span>
                      </div>

                      {/* Удалить строку */}
                      <button
                        type="button"
                        onClick={() => handleRemoveItem(item.id)}
                        className="p-1 text-stone-400 hover:text-red-600 rounded-lg hover:bg-red-50 transition-colors cursor-pointer"
                        title="Удалить позицию"
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              {/* Итог чека */}
              <div className="flex items-center justify-between px-4 py-3 bg-amber-50/80 border border-amber-200 rounded-2xl">
                <span className="font-bold text-stone-800 text-sm">
                  Итоговая сумма:
                </span>
                <span className="text-lg font-black text-stone-950">
                  {calculatedTotal.toLocaleString('ru-RU')} ₽
                </span>
              </div>

              {/* Опции автоматического обновления списка покупок и холодильника */}
              <div className="space-y-2 pt-1 border-t border-stone-200 text-xs text-stone-700">
                <label className="flex items-center gap-2.5 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={syncShopping}
                    onChange={(e) => setSyncShopping(e.target.checked)}
                    className="rounded-md border-stone-300 text-stone-900 focus:ring-stone-900 w-4 h-4 cursor-pointer"
                  />
                  <span>Отметить купленные товары в списке покупок</span>
                </label>

                <label className="flex items-center gap-2.5 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={syncFridge}
                    onChange={(e) => setSyncFridge(e.target.checked)}
                    className="rounded-md border-stone-300 text-stone-900 focus:ring-stone-900 w-4 h-4 cursor-pointer"
                  />
                  <span>Добавить эти продукты в «Холодильник»</span>
                </label>
              </div>

              {/* Кнопка повторного сканирования другого чека */}
              <div className="flex justify-start">
                <button
                  type="button"
                  onClick={resetState}
                  className="text-xs font-medium text-stone-500 hover:text-stone-800 underline underline-offset-2 cursor-pointer"
                >
                  Выбрать другое фото чека
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Футер */}
        <div className="p-4 sm:p-5 border-t border-stone-200 bg-stone-50 flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={handleClose}
            className="px-4 py-2.5 text-xs font-semibold text-stone-600 hover:text-stone-900 bg-white border border-stone-200 rounded-xl hover:bg-stone-100 transition-colors cursor-pointer"
          >
            Отмена
          </button>

          {hasParsed && (
            <button
              type="button"
              onClick={handleSave}
              disabled={items.length === 0}
              className="px-5 py-2.5 text-xs font-bold text-white bg-stone-900 hover:bg-stone-800 disabled:opacity-50 rounded-xl transition-colors shadow-sm cursor-pointer flex items-center gap-2"
            >
              <Check size={16} />
              Сохранить чек ({calculatedTotal.toLocaleString('ru-RU')} ₽)
            </button>
          )}
        </div>
      </motion.div>
    </div>
  );
}
