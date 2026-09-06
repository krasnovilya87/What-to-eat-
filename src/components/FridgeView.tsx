import React, { useState } from 'react';
import { useAppState } from '../useAppState';
import { v4 as uuidv4 } from 'uuid';
import { Plus, Loader2, Star } from 'lucide-react';
import { motion } from 'motion/react';
import { cn } from '../App';
import { InventoryItem } from '../types';
import { cleanIngredientName, parseQuantity } from '../utils/ingredients';

type SectionKey = 'fridge' | 'grains' | 'spices';

interface SectionConfig {
  key: SectionKey;
  title: string;
  icon: string;
  placeholder: string;
  emptyText: string;
  theme: {
    container: string;
    titleColor: string;
    input: string;
    submitBtn: string;
    border: string;
    itemText: string;
    quantityInput: string;
    trashBtn: string;
    emptyTextColor: string;
    permanentBtnActive: string;
    permanentBtnInactive: string;
    permanentBadge: string;
  };
}

const SECTIONS: SectionConfig[] = [
  {
    key: 'fridge',
    title: 'Холодильник',
    icon: '🧊',
    placeholder: 'Что есть в холодильнике?',
    emptyText: 'В холодильнике пока пусто.',
    theme: {
      container: 'bg-stone-800 rounded-[2rem] p-6 text-white overflow-hidden shadow-lg border border-stone-700/50',
      titleColor: 'text-white',
      input: 'bg-white/10 border border-white/10 rounded-2xl px-4 py-3 text-sm text-white placeholder-white/50 focus:outline-none focus:border-white/30 transition-colors',
      submitBtn: 'bg-emerald-600 hover:bg-emerald-500 text-white rounded-2xl px-4 flex items-center justify-center disabled:opacity-50 transition-colors',
      border: 'border-white/10',
      itemText: 'text-white/95 font-medium truncate flex-1 leading-tight',
      quantityInput: 'bg-transparent border-b border-transparent focus:border-white/30 text-white/60 text-sm w-16 text-right px-1 py-0.5 focus:outline-none transition-colors shrink-0 placeholder-white/30',
      trashBtn: 'text-white/30 hover:text-red-400 p-1 rounded-md transition-colors',
      emptyTextColor: 'text-white/50',
      permanentBtnActive: 'text-amber-400 hover:text-amber-300',
      permanentBtnInactive: 'text-white/35 hover:text-white/80',
      permanentBadge: 'bg-amber-400/20 text-amber-300 border border-amber-400/30'
    }
  },
  {
    key: 'grains',
    title: 'Крупы',
    icon: '🌾',
    placeholder: 'Что есть из круп? (рис, гречка, овсянка...)',
    emptyText: 'В крупах пока пусто.',
    theme: {
      container: 'bg-amber-500 rounded-[2rem] p-6 text-stone-950 overflow-hidden shadow-lg border border-amber-400/50',
      titleColor: 'text-stone-950',
      input: 'bg-black/10 border border-black/15 rounded-2xl px-4 py-3 text-sm text-stone-950 placeholder-stone-800/60 focus:outline-none focus:border-stone-900 transition-colors',
      submitBtn: 'bg-stone-900 hover:bg-stone-800 text-white rounded-2xl px-4 flex items-center justify-center disabled:opacity-50 transition-colors',
      border: 'border-black/10',
      itemText: 'text-stone-950 font-medium truncate flex-1 leading-tight',
      quantityInput: 'bg-transparent border-b border-transparent focus:border-stone-900 text-stone-900 text-sm w-16 text-right px-1 py-0.5 focus:outline-none transition-colors shrink-0 placeholder-stone-800/40',
      trashBtn: 'text-stone-900/40 hover:text-red-700 p-1 rounded-md transition-colors',
      emptyTextColor: 'text-stone-800/60',
      permanentBtnActive: 'text-stone-950 hover:text-stone-800',
      permanentBtnInactive: 'text-stone-900/35 hover:text-stone-950',
      permanentBadge: 'bg-black/15 text-stone-950 border border-black/25'
    }
  },
  {
    key: 'spices',
    title: 'Приправы и соусы',
    icon: '🥫',
    placeholder: 'Что есть из соусов и приправ?',
    emptyText: 'В приправах и соусах пока пусто.',
    theme: {
      container: 'bg-red-600 rounded-[2rem] p-6 text-white overflow-hidden shadow-lg border border-red-500/50',
      titleColor: 'text-white',
      input: 'bg-white/15 border border-white/20 rounded-2xl px-4 py-3 text-sm text-white placeholder-white/60 focus:outline-none focus:border-white/40 transition-colors',
      submitBtn: 'bg-white hover:bg-red-50 text-red-600 font-bold rounded-2xl px-4 flex items-center justify-center disabled:opacity-50 transition-colors shadow-xs',
      border: 'border-white/15',
      itemText: 'text-white font-medium truncate flex-1 leading-tight',
      quantityInput: 'bg-transparent border-b border-transparent focus:border-white/40 text-white/75 text-sm w-16 text-right px-1 py-0.5 focus:outline-none transition-colors shrink-0 placeholder-white/40',
      trashBtn: 'text-white/40 hover:text-white p-1 rounded-md transition-colors',
      emptyTextColor: 'text-white/60',
      permanentBtnActive: 'text-amber-300 hover:text-amber-200',
      permanentBtnInactive: 'text-white/40 hover:text-white/90',
      permanentBadge: 'bg-black/25 text-amber-200 border border-amber-300/30'
    }
  }
];

export default function FridgeView({ state }: { state: ReturnType<typeof useAppState> }) {
  const { fridge, setFridge, grains, setGrains, spices, setSpices } = state;
  const [itemToDelete, setItemToDelete] = useState<{
    id: string;
    name: string;
    sectionKey: SectionKey;
    sectionTitle: string;
  } | null>(null);

  const getSectionData = (key: SectionKey): {
    items: InventoryItem[];
    setItems: React.Dispatch<React.SetStateAction<InventoryItem[]>>;
  } => {
    switch (key) {
      case 'fridge':
        return { items: fridge || [], setItems: setFridge };
      case 'grains':
        return { items: grains || [], setItems: setGrains };
      case 'spices':
        return { items: spices || [], setItems: setSpices };
    }
  };

  const confirmRemove = () => {
    if (!itemToDelete) return;
    const { id, sectionKey } = itemToDelete;
    const { setItems } = getSectionData(sectionKey);
    setItems(prev => (prev || []).filter(item => item.id !== id));
    setItemToDelete(null);
  };

  const cancelRemove = () => {
    setItemToDelete(null);
  };

  return (
    <div className="flex flex-col gap-6 pb-12 px-2">
      {SECTIONS.map((section) => (
        <InventoryBlock
          key={section.key}
          config={section}
          data={getSectionData(section.key)}
          onRequestDelete={(item) => {
            setItemToDelete({
              id: item.id,
              name: item.name,
              sectionKey: section.key,
              sectionTitle: section.title
            });
          }}
        />
      ))}

      {/* Модальное окно подтверждения удаления */}
      {itemToDelete && (
        <div className="fixed inset-0 bg-stone-900/50 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-6 w-full max-w-sm shadow-xl border border-stone-200">
            <h3 className="text-xl font-bold text-stone-900 mb-2">Удалить продукт?</h3>
            <p className="text-stone-500 mb-6 text-sm">
              Вы уверены, что хотите удалить «<span className="font-semibold text-stone-700">{itemToDelete.name}</span>» из раздела «{itemToDelete.sectionTitle}»?
            </p>
            <div className="flex justify-end gap-3">
              <button 
                onClick={cancelRemove}
                className="px-5 py-2.5 text-stone-600 font-medium bg-stone-100 rounded-xl hover:bg-stone-200 transition-colors text-sm"
              >
                Отмена
              </button>
              <button 
                onClick={confirmRemove}
                className="px-5 py-2.5 text-white font-medium bg-red-500 rounded-xl hover:bg-red-600 transition-colors shadow-sm text-sm"
              >
                Удалить
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

interface InventoryBlockProps {
  key?: string;
  config: SectionConfig;
  data: {
    items: InventoryItem[];
    setItems: React.Dispatch<React.SetStateAction<InventoryItem[]>>;
  };
  onRequestDelete: (item: InventoryItem) => void;
}

function InventoryBlock({
  config,
  data,
  onRequestDelete
}: InventoryBlockProps) {
  const { title, icon, placeholder, emptyText, theme } = config;
  const { items, setItems } = data;
  const [inputVal, setInputVal] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = inputVal.trim();
    if (!trimmed) return;

    setIsLoading(true);
    let nameToUse = trimmed;
    let quantityToUse = '';

    try {
      const res = await fetch('/api/normalize-ingredient', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ingredient: trimmed })
      });
      if (res.ok) {
        const result = await res.json();
        if (result.canonicalName) {
          nameToUse = result.canonicalName;
        }
        if (result.quantity) {
          quantityToUse = result.quantity;
        }
      }
    } catch (err) {
      console.error('Failed to normalize ingredient:', err);
    } finally {
      setIsLoading(false);
    }

    // Резервное извлечение количества на клиенте, если API не вернуло quantity
    if (!quantityToUse) {
      const parsed = parseQuantity(nameToUse);
      if (parsed) {
        const cleaned = cleanIngredientName(nameToUse);
        if (cleaned && cleaned !== nameToUse) {
          nameToUse = cleaned;
          const match = trimmed.match(/([\d]+(?:\/[\d]+)?|[\d\.,]+(?:\s*-\s*[\d\.,]+)?)\s*(кг|килограмм[а-я]*|г|гр\.?|грамм[а-я]*|ml|мл|миллилитр[а-я]*|л|литр[а-я]*|l|штук[а-я]*|шт\.?|зубчик[а-я]*|ст\.?\s*л\.?|столов[а-я]*\s*лож[а-я]*|ч\.?\s*л\.?|чайн[а-я]*\s*лож[а-я]*|пуч[а-я]*|щепотк[а-я]*|банк[а-я]*|упаковк[а-я]*|пач[а-я]*|стакан[а-я]*)/i);
          if (match) {
            quantityToUse = match[0].trim();
          }
        }
      }
    }

    if (nameToUse) {
      nameToUse = nameToUse.charAt(0).toUpperCase() + nameToUse.slice(1);
    }

    setItems(prev => {
      const currentList = prev || [];
      const existingIndex = currentList.findIndex(
        item => item.name.toLowerCase() === nameToUse.toLowerCase()
      );
      if (existingIndex !== -1) {
        if (quantityToUse) {
          const updated = [...currentList];
          updated[existingIndex] = {
            ...updated[existingIndex],
            quantity: quantityToUse
          };
          return updated;
        }
        return currentList;
      }
      return [
        ...currentList,
        {
          id: uuidv4(),
          name: nameToUse,
          quantity: quantityToUse || undefined
        }
      ];
    });

    setInputVal('');
  };

  const handleUpdateQuantity = (id: string, quantity: string) => {
    setItems(prev => (prev || []).map(item => item.id === id ? { ...item, quantity } : item));
  };

  const handleTogglePermanent = (id: string) => {
    setItems(prev => (prev || []).map(item => 
      item.id === id ? { ...item, isPermanent: !item.isPermanent } : item
    ));
  };

  return (
    <div className={theme.container}>
      <h3 className={cn("text-2xl font-bold mb-5 flex items-center gap-3", theme.titleColor)}>
        <span className="text-3xl">{icon}</span> {title}
      </h3>

      <form onSubmit={handleAdd} className="flex gap-2 mb-5">
        <input
          type="text"
          placeholder={placeholder}
          value={inputVal}
          onChange={(e) => setInputVal(e.target.value)}
          className={cn("flex-1", theme.input)}
        />
        <button
          type="submit"
          disabled={!inputVal.trim() || isLoading}
          className={theme.submitBtn}
          title="Добавить"
        >
          {isLoading ? <Loader2 size={22} className="animate-spin" /> : <Plus size={22} />}
        </button>
      </form>

      <div className="flex flex-col gap-2">
        {items.length === 0 ? (
          <p className={cn("text-center py-8 text-sm", theme.emptyTextColor)}>
            {emptyText}
          </p>
        ) : (
          items.map(item => (
            <motion.div
              key={item.id}
              layout
              drag="x"
              dragConstraints={{ left: 0, right: 0 }}
              dragElastic={0.2}
              whileTap={{ cursor: "grabbing" }}
              onDragEnd={(_, info) => {
                if (info.offset.x < -80) onRequestDelete(item);
              }}
              className={cn("flex items-center justify-between pb-2.5 pt-1 border-b", theme.border)}
            >
              <div className="flex items-center justify-between gap-2.5 flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-1 min-w-0">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleTogglePermanent(item.id);
                    }}
                    className={cn(
                      "p-1 rounded-md transition-colors shrink-0 cursor-pointer flex items-center justify-center",
                      item.isPermanent ? theme.permanentBtnActive : theme.permanentBtnInactive
                    )}
                    title={
                      item.isPermanent
                        ? "Постоянный продукт (всегда должен быть дома) — нажать для отмены"
                        : "Отметить: этот продукт должен быть постоянно в доме"
                    }
                  >
                    <Star 
                      size={17} 
                      strokeWidth={item.isPermanent ? 1.5 : 1.25}
                      className={cn(
                        "transition-all duration-150 active:scale-125",
                        item.isPermanent ? "fill-current" : "fill-none"
                      )} 
                    />
                  </button>

                  <span className={theme.itemText}>{item.name}</span>
                </div>

                <div className="flex items-center gap-1.5 shrink-0">
                  <input
                    type="text"
                    value={item.quantity || ''}
                    onChange={(e) => handleUpdateQuantity(item.id, e.target.value)}
                    placeholder="кол-во"
                    className={theme.quantityInput}
                    onClick={(e) => e.stopPropagation()}
                    onPointerDown={(e) => e.stopPropagation()}
                  />
                </div>
              </div>
            </motion.div>
          ))
        )}
      </div>
    </div>
  );
}
