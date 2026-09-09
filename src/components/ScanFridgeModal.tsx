import React, { useState, useRef } from 'react';
import { Camera, Plus, Trash2, X, Check, Loader2, Image as ImageIcon } from 'lucide-react';
import { InventoryItem } from '../types';
import { apiPost } from '../utils/api';
import { v4 as uuidv4 } from 'uuid';

interface RecognizedItem {
  id: string;
  name: string;
  quantity: string;
  section: 'fridge' | 'grains' | 'spices';
  selected: boolean;
  photoIndex?: number;
}

interface ScanFridgeModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAddItems: (items: { fridge: InventoryItem[]; grains: InventoryItem[]; spices: InventoryItem[] }) => void;
}

export default function ScanFridgeModal({ isOpen, onClose, onAddItems }: ScanFridgeModalProps) {
  const [images, setImages] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [recognizedItems, setRecognizedItems] = useState<RecognizedItem[] | null>(null);
  const [unrecognizedPhotos, setUnrecognizedPhotos] = useState<number[]>([]);
  const [manualDrafts, setManualDrafts] = useState<
    Record<number, { name: string; quantity: string; section: 'fridge' | 'grains' | 'spices' }>
  >({});

  const cameraInputRef = useRef<HTMLInputElement | null>(null);
  const galleryInputRef = useRef<HTMLInputElement | null>(null);

  if (!isOpen) return null;

  // Функция сжатия изображения перед отправкой
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
          const compressed = canvas.toDataURL('image/jpeg', 0.82);
          resolve(compressed);
        };
        img.onerror = () => reject(new Error('Не удалось прочесть изображение'));
        img.src = e.target?.result as string;
      };
      reader.onerror = () => reject(new Error('Не удалось загрузить файл'));
      reader.readAsDataURL(file);
    });
  };

  const handleFilesSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setError(null);
    const newImages: string[] = [];

    for (let i = 0; i < files.length; i++) {
      try {
        const compressed = await compressImage(files[i]);
        newImages.push(compressed);
      } catch (err) {
        console.error('Ошибка сжатия:', err);
      }
    }

    if (newImages.length > 0) {
      setImages((prev) => [...prev, ...newImages]);
    }

    if (e.target) {
      e.target.value = '';
    }
  };

  const removeImage = (index: number) => {
    setImages((prev) => prev.filter((_, i) => i !== index));
  };

  const handleScan = async () => {
    if (images.length === 0) return;

    setLoading(true);
    setError(null);

    try {
      const data = await apiPost<{
        items: Array<{ name: string; quantity?: string; section: 'fridge' | 'grains' | 'spices'; imageIndex?: number }>;
        unrecognizedImageIndexes?: number[];
      }>('/api/scan-fridge-photos', { images });

      const formatted: RecognizedItem[] = (data?.items || []).map((it) => {
        const validSection: 'fridge' | 'grains' | 'spices' =
          it.section === 'grains' || it.section === 'spices' ? it.section : 'fridge';
        return {
          id: uuidv4(),
          name: it.name.trim(),
          quantity: (it.quantity || '').trim(),
          section: validSection,
          selected: true,
          photoIndex: typeof it.imageIndex === 'number' ? it.imageIndex : undefined
        };
      });

      setRecognizedItems(formatted);

      // Определяем нераспознанные фотографии
      const unrecSet = new Set<number>(data?.unrecognizedImageIndexes || []);
      images.forEach((_, idx) => {
        const hasItem = formatted.some((item) => item.photoIndex === idx);
        if (!hasItem) {
          unrecSet.add(idx);
        }
      });

      setUnrecognizedPhotos(Array.from(unrecSet).sort((a, b) => a - b));
    } catch (err: any) {
      console.error('Scan error:', err);
      // Если автоматическое распознавание не сработало, даем пользователю ввести вручную
      setRecognizedItems([]);
      setUnrecognizedPhotos(images.map((_, idx) => idx));
      setError('Не удалось распознать продукты автоматически. Введите их вручную.');
    } finally {
      setLoading(false);
    }
  };

  const getDraft = (photoIdx: number) => {
    return manualDrafts[photoIdx] || { name: '', quantity: '', section: 'fridge' };
  };

  const updateDraft = (photoIdx: number, field: 'name' | 'quantity' | 'section', val: string) => {
    setManualDrafts((prev) => ({
      ...prev,
      [photoIdx]: {
        ...getDraft(photoIdx),
        [field]: val
      }
    }));
  };

  const handleAddManualItem = (photoIdx: number) => {
    const draft = getDraft(photoIdx);
    if (!draft.name.trim()) return;

    const newItem: RecognizedItem = {
      id: uuidv4(),
      name: draft.name.trim(),
      quantity: draft.quantity.trim(),
      section: draft.section,
      selected: true,
      photoIndex: photoIdx
    };

    setRecognizedItems((prev) => (prev ? [...prev, newItem] : [newItem]));
    setManualDrafts((prev) => ({
      ...prev,
      [photoIdx]: { name: '', quantity: '', section: draft.section }
    }));
  };

  const handleToggleSelect = (id: string) => {
    setRecognizedItems((prev) =>
      prev ? prev.map((item) => (item.id === id ? { ...item, selected: !item.selected } : item)) : null
    );
  };

  const handleUpdateItem = (id: string, field: 'name' | 'quantity' | 'section', value: any) => {
    setRecognizedItems((prev) =>
      prev ? prev.map((item) => (item.id === id ? { ...item, [field]: value } : item)) : null
    );
  };

  const handleRemoveRecognizedItem = (id: string) => {
    setRecognizedItems((prev) => (prev ? prev.filter((item) => item.id !== id) : null));
  };

  const handleApplyItems = () => {
    // Автоматически учитываем заполненные черновики под нераспознанными фото
    const additionalItems: RecognizedItem[] = [];
    unrecognizedPhotos.forEach((photoIdx) => {
      const draft = getDraft(photoIdx);
      if (draft.name.trim()) {
        additionalItems.push({
          id: uuidv4(),
          name: draft.name.trim(),
          quantity: draft.quantity.trim(),
          section: draft.section,
          selected: true,
          photoIndex: photoIdx
        });
      }
    });

    const allItems = [...(recognizedItems || []), ...additionalItems];
    const selected = allItems.filter((i) => i.selected && i.name.trim().length > 0);
    if (selected.length === 0) {
      onClose();
      return;
    }

    const fridgeItems: InventoryItem[] = [];
    const grainsItems: InventoryItem[] = [];
    const spicesItems: InventoryItem[] = [];

    selected.forEach((item) => {
      const invItem: InventoryItem = {
        id: uuidv4(),
        name: item.name.trim(),
        quantity: item.quantity.trim() || undefined
      };

      if (item.section === 'grains') {
        grainsItems.push(invItem);
      } else if (item.section === 'spices') {
        spicesItems.push(invItem);
      } else {
        fridgeItems.push(invItem);
      }
    });

    onAddItems({
      fridge: fridgeItems,
      grains: grainsItems,
      spices: spicesItems
    });

    onClose();
  };

  const handleReset = () => {
    setImages([]);
    setRecognizedItems(null);
    setUnrecognizedPhotos([]);
    setManualDrafts({});
    setError(null);
  };

  const handleBackToPhotos = () => {
    setRecognizedItems(null);
    setUnrecognizedPhotos([]);
    setError(null);
  };

  return (
    <div className="fixed inset-0 z-50 bg-stone-900/60 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="bg-white w-full max-w-lg max-h-[92vh] sm:rounded-3xl rounded-t-3xl shadow-2xl flex flex-col overflow-hidden animate-in fade-in slide-in-from-bottom duration-200">
        
        {/* Шапка модального окна */}
        <div className="px-5 py-4 bg-stone-50 flex items-center justify-between shrink-0 shadow-xs">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-emerald-600 text-white flex items-center justify-center shadow-xs">
              <Camera size={20} />
            </div>
            <h2 className="text-base font-bold text-stone-900 leading-tight">
              {recognizedItems !== null ? 'Найденные продукты' : 'Добавить фото'}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-stone-200/60 hover:bg-stone-200 text-stone-600 flex items-center justify-center transition-colors cursor-pointer"
          >
            <X size={18} />
          </button>
        </div>

        {/* Скрытые поля для выбора файлов */}
        <input
          ref={cameraInputRef}
          type="file"
          accept="image/*"
          capture="environment"
          onChange={handleFilesSelected}
          className="hidden"
        />
        <input
          ref={galleryInputRef}
          type="file"
          accept="image/*"
          multiple
          onChange={handleFilesSelected}
          className="hidden"
        />

        {/* Тело модального окна */}
        <div className="p-5 overflow-y-auto flex-1 no-scrollbar space-y-4">
          {error && (
            <div className="bg-stone-100 text-stone-800 p-3.5 rounded-2xl text-xs flex flex-col gap-1 shadow-xs">
              <span className="font-semibold text-stone-900">Внимание:</span>
              <span>{error}</span>
            </div>
          )}

          {/* Режим 1: Съёмка / добавление фото */}
          {recognizedItems === null && (
            <div className="space-y-4">
              {images.length === 0 ? (
                <div className="py-10 px-4 bg-stone-50 rounded-3xl flex flex-col items-center justify-center text-center shadow-inner">
                  <div className="w-16 h-16 rounded-2xl bg-emerald-100 text-emerald-800 flex items-center justify-center mb-6 shadow-xs">
                    <Camera size={32} />
                  </div>

                  <div className="flex flex-col sm:flex-row gap-2.5 w-full max-w-xs">
                    <button
                      type="button"
                      onClick={() => cameraInputRef.current?.click()}
                      className="flex-1 py-3 px-4 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-2xl flex items-center justify-center gap-2 shadow-sm active:scale-98 transition-all cursor-pointer"
                    >
                      <Camera size={18} />
                      <span>Камера</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => galleryInputRef.current?.click()}
                      className="flex-1 py-3 px-4 bg-stone-200 hover:bg-stone-300 text-stone-800 text-xs font-bold rounded-2xl flex items-center justify-center gap-2 active:scale-98 transition-all cursor-pointer"
                    >
                      <ImageIcon size={18} />
                      <span>Галерея</span>
                    </button>
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-stone-700">
                      Фото: {images.length}
                    </span>
                  </div>

                  {/* Галерея миниатюр */}
                  <div className="grid grid-cols-3 gap-2.5">
                    {images.map((img, idx) => (
                      <div
                        key={idx}
                        className="relative aspect-square rounded-2xl overflow-hidden shadow-xs group bg-stone-100"
                      >
                        <img
                          src={img}
                          alt={`Фото ${idx + 1}`}
                          className="w-full h-full object-cover"
                        />
                        <div className="absolute top-1.5 left-1.5 bg-stone-900/80 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-md leading-none shadow-xs">
                          #{idx + 1}
                        </div>
                        <button
                          type="button"
                          onClick={() => removeImage(idx)}
                          className="absolute top-1.5 right-1.5 w-6 h-6 rounded-full bg-stone-900/80 text-white flex items-center justify-center hover:bg-stone-900 transition-colors shadow-xs cursor-pointer"
                          title="Удалить фото"
                        >
                          <X size={14} />
                        </button>
                      </div>
                    ))}

                    {/* Кнопка добавления ещё одного фото через камеру */}
                    <button
                      type="button"
                      onClick={() => cameraInputRef.current?.click()}
                      className="aspect-square rounded-2xl bg-stone-100 hover:bg-stone-200 flex flex-col items-center justify-center gap-1.5 text-stone-600 transition-colors cursor-pointer shadow-2xs active:scale-95"
                      title="Сделать ещё фото"
                    >
                      <Plus size={24} className="text-emerald-600" />
                      <span className="text-[11px] font-semibold text-stone-700 leading-none">
                        Ещё фото
                      </span>
                    </button>
                  </div>

                  {/* Кнопка добавления ещё из галереи */}
                  <div className="flex justify-end">
                    <button
                      type="button"
                      onClick={() => galleryInputRef.current?.click()}
                      className="text-xs font-medium text-emerald-700 hover:text-emerald-800 flex items-center gap-1 cursor-pointer py-1"
                    >
                      <ImageIcon size={14} />
                      <span>Добавить из галереи</span>
                    </button>
                  </div>

                  {/* Кнопка "Окей" прямо под превью */}
                  <button
                    type="button"
                    onClick={handleScan}
                    disabled={loading}
                    className="w-full py-3.5 px-4 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-bold rounded-2xl flex items-center justify-center gap-2 shadow-md transition-all active:scale-[0.98] cursor-pointer"
                  >
                    <Check size={18} />
                    <span>Окей</span>
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Режим 2: Результаты распознавания и ввод нераспознанных продуктов */}
          {recognizedItems !== null && (
            <div className="space-y-4">
              
              {/* Секция нераспознанных фото */}
              {unrecognizedPhotos.length > 0 && (
                <div className="space-y-3">
                  <div className="text-xs font-bold text-stone-800">
                    Не распознано:
                  </div>

                  {unrecognizedPhotos.map((photoIdx) => {
                    const draft = getDraft(photoIdx);
                    const photoItems = recognizedItems.filter((i) => i.photoIndex === photoIdx);

                    return (
                      <div
                        key={photoIdx}
                        className="p-3 bg-stone-100 rounded-2xl shadow-xs space-y-2.5"
                      >
                        <div className="flex gap-3 items-start">
                          <div className="relative w-20 h-20 rounded-xl overflow-hidden shrink-0 shadow-xs bg-stone-200">
                            <img
                              src={images[photoIdx]}
                              alt={`Фото ${photoIdx + 1}`}
                              className="w-full h-full object-cover"
                            />
                            <span className="absolute top-1 left-1 bg-stone-900/80 text-white text-[10px] font-bold px-1.5 py-0.5 rounded leading-none">
                              #{photoIdx + 1}
                            </span>
                          </div>

                          <div className="flex-1 min-w-0 space-y-2">
                            <input
                              type="text"
                              placeholder="Название продукта"
                              value={draft.name}
                              onChange={(e) => updateDraft(photoIdx, 'name', e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                  e.preventDefault();
                                  handleAddManualItem(photoIdx);
                                }
                              }}
                              className="w-full bg-white text-stone-900 text-xs font-semibold px-3 py-2 rounded-xl focus:outline-none placeholder-stone-400 shadow-2xs"
                            />

                            <div className="flex gap-2 items-center">
                              <input
                                type="text"
                                placeholder="Кол-во"
                                value={draft.quantity}
                                onChange={(e) => updateDraft(photoIdx, 'quantity', e.target.value)}
                                className="w-16 bg-white text-stone-900 text-[11px] px-2 py-1.5 rounded-xl focus:outline-none placeholder-stone-400 shadow-2xs"
                              />

                              <select
                                value={draft.section}
                                onChange={(e) => updateDraft(photoIdx, 'section', e.target.value as any)}
                                className="flex-1 min-w-0 bg-white text-stone-800 text-[11px] font-medium px-2 py-1.5 rounded-xl focus:outline-none shadow-2xs cursor-pointer"
                              >
                                <option value="fridge">Холодильник</option>
                                <option value="grains">Крупы</option>
                                <option value="spices">Приправы</option>
                              </select>

                              <button
                                type="button"
                                onClick={() => handleAddManualItem(photoIdx)}
                                disabled={!draft.name.trim()}
                                className="bg-emerald-600 hover:bg-emerald-700 disabled:opacity-40 text-white p-2 rounded-xl transition-all shadow-xs shrink-0 cursor-pointer"
                                title="Добавить продукт"
                              >
                                <Plus size={16} />
                              </button>
                            </div>
                          </div>
                        </div>

                        {/* Добавленные вручную продукты к этому фото */}
                        {photoItems.length > 0 && (
                          <div className="space-y-1.5 pt-1">
                            {photoItems.map((item) => (
                              <div
                                key={item.id}
                                className="flex items-center justify-between px-3 py-1.5 bg-white rounded-xl text-xs font-medium text-stone-800 shadow-2xs"
                              >
                                <span>
                                  {item.name} {item.quantity ? `(${item.quantity})` : ''}
                                </span>
                                <button
                                  type="button"
                                  onClick={() => handleRemoveRecognizedItem(item.id)}
                                  className="text-stone-400 hover:text-red-500 cursor-pointer p-0.5"
                                >
                                  <Trash2 size={13} />
                                </button>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Список распознанных продуктов */}
              {recognizedItems.length > 0 && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-stone-800">
                      Распознано: {recognizedItems.filter((i) => i.selected).length} из {recognizedItems.length}
                    </span>
                  </div>

                  <div className="space-y-2">
                    {recognizedItems.map((item) => (
                      <div
                        key={item.id}
                        className={`p-3 rounded-2xl transition-all shadow-xs flex items-center gap-2.5 ${
                          item.selected ? 'bg-white' : 'bg-stone-100/70 opacity-60'
                        }`}
                      >
                        {/* Чекбокс */}
                        <button
                          type="button"
                          onClick={() => handleToggleSelect(item.id)}
                          className={`w-6 h-6 rounded-lg flex items-center justify-center transition-colors shrink-0 cursor-pointer ${
                            item.selected
                              ? 'bg-emerald-600 text-white shadow-xs'
                              : 'bg-stone-200 text-transparent hover:bg-stone-300'
                          }`}
                        >
                          <Check size={14} strokeWidth={3} />
                        </button>

                        {/* Поле названия */}
                        <input
                          type="text"
                          value={item.name}
                          onChange={(e) => handleUpdateItem(item.id, 'name', e.target.value)}
                          placeholder="Название продукта"
                          className="flex-1 min-w-0 bg-transparent text-xs font-semibold text-stone-900 focus:outline-none placeholder-stone-400"
                        />

                        {/* Поле количества */}
                        <input
                          type="text"
                          value={item.quantity}
                          onChange={(e) => handleUpdateItem(item.id, 'quantity', e.target.value)}
                          placeholder="Кол-во"
                          className="w-16 bg-stone-100 rounded-lg px-2 py-1 text-[11px] text-stone-700 text-right focus:outline-none focus:bg-white placeholder-stone-400 shrink-0"
                        />

                        {/* Выбор секции (Холодильник / Крупы / Приправы) */}
                        <select
                          value={item.section}
                          onChange={(e) => handleUpdateItem(item.id, 'section', e.target.value)}
                          className="bg-stone-100 hover:bg-stone-200 text-stone-800 rounded-lg px-2 py-1 text-[11px] font-medium focus:outline-none shrink-0 cursor-pointer"
                        >
                          <option value="fridge">Холод.</option>
                          <option value="grains">Крупы</option>
                          <option value="spices">Соусы</option>
                        </select>

                        {/* Удалить из списка */}
                        <button
                          type="button"
                          onClick={() => handleRemoveRecognizedItem(item.id)}
                          className="text-stone-400 hover:text-red-500 p-1 rounded-md transition-colors cursor-pointer shrink-0"
                          title="Удалить позицию"
                        >
                          <Trash2 size={15} />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Футер с действиями */}
        <div className="p-4 bg-stone-50 shrink-0 flex gap-2.5 shadow-xs">
          {recognizedItems === null ? (
            <>
              <button
                type="button"
                onClick={onClose}
                disabled={loading}
                className="py-3 px-4 bg-stone-200 hover:bg-stone-300 text-stone-700 text-xs font-bold rounded-2xl transition-colors cursor-pointer disabled:opacity-50"
              >
                Отмена
              </button>
              <button
                type="button"
                onClick={handleScan}
                disabled={loading || images.length === 0}
                className="flex-1 py-3 px-4 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-2xl flex items-center justify-center gap-2 shadow-sm transition-all cursor-pointer disabled:opacity-40"
              >
                {loading ? (
                  <>
                    <Loader2 size={16} className="animate-spin" />
                    <span>Распознавание...</span>
                  </>
                ) : (
                  <>
                    <Check size={16} />
                    <span>Окей</span>
                  </>
                )}
              </button>
            </>
          ) : (
            <>
              <button
                type="button"
                onClick={handleBackToPhotos}
                className="py-3 px-4 bg-stone-200 hover:bg-stone-300 text-stone-700 text-xs font-bold rounded-2xl transition-colors cursor-pointer"
              >
                Назад
              </button>
              <button
                type="button"
                onClick={handleApplyItems}
                className="flex-1 py-3 px-4 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-2xl flex items-center justify-center gap-2 shadow-sm transition-all cursor-pointer"
              >
                <Check size={16} />
                <span>
                  Добавить
                </span>
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
