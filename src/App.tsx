import React from 'react';
import { BrowserRouter, Routes, Route, NavLink, useLocation } from 'react-router-dom';
import { Home, Refrigerator, ShoppingCart, Sparkles } from 'lucide-react';
import RecipesView from './components/RecipesView';
import FridgeView from './components/FridgeView';
import ShoppingView from './components/ShoppingView';
import SuggestionsView from './components/SuggestionsView';
import AddRecipeView from './components/AddRecipeView';
import RemindersWatcher from './components/RemindersWatcher';
import ActiveReminderAlertModal from './components/ActiveReminderAlertModal';
import { UserAuthButton } from './components/UserAuthButton';
import { AuthModal } from './components/AuthModal';
import { AuthProvider } from './AuthContext';
import { useAppState } from './useAppState';
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

function AppHeader() {
  const location = useLocation();

  const getHeaderInfo = () => {
    if (location.pathname.startsWith('/fridge')) {
      return { title: 'У меня есть', badge: 'У' };
    }
    if (location.pathname.startsWith('/shopping')) {
      return { title: 'Покупки', badge: 'П' };
    }
    if (location.pathname.startsWith('/suggest')) {
      return { title: 'Что приготовить', badge: 'Ч' };
    }
    // Default (рецепты / добавление)
    return { title: 'Что поесть', badge: 'Ч' };
  };

  const { title, badge } = getHeaderInfo();

  return (
    <header className="flex justify-between items-center px-4 py-4 bg-stone-50 shrink-0">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 bg-emerald-600 rounded-xl flex items-center justify-center text-white font-bold text-xl shadow-sm transition-transform active:scale-95">
          {badge}
        </div>
        <h1 className="text-xl font-bold tracking-tight text-stone-800">
          {title}
        </h1>
      </div>
      <UserAuthButton />
    </header>
  );
}

export default function App() {
  const appState = useAppState();

  return (
    <AuthProvider>
      <BrowserRouter>
        <RemindersWatcher state={appState} />
        <ActiveReminderAlertModal state={appState} />
        <AuthModal />
        <div className="flex flex-col h-screen bg-stone-50 overflow-hidden pb-20">
          {/* Header Logo & Auth Button с динамическим названием вкладки */}
          <AppHeader />
          
          {/* Main Content Area */}
          <main className="flex-1 overflow-y-auto no-scrollbar w-full h-full">
            <Routes>
              <Route path="/" element={<div className="max-w-md mx-auto p-4"><RecipesView state={appState} /></div>} />
              <Route path="/add" element={<div className="max-w-md mx-auto p-4"><AddRecipeView state={appState} /></div>} />
              <Route path="/fridge" element={<div className="max-w-md mx-auto p-4"><FridgeView state={appState} /></div>} />
              <Route path="/shopping" element={<ShoppingView state={appState} />} />
              <Route path="/suggest" element={<div className="max-w-md mx-auto p-4"><SuggestionsView state={appState} /></div>} />
            </Routes>
          </main>

          {/* Bottom Navigation с увеличенной высотой и сдвинутыми вверх кнопками */}
          <nav className="fixed bottom-0 w-full bg-white shadow-[0_-4px_20px_rgba(0,0,0,0.06)] flex justify-around items-start pt-2.5 pb-5 h-20 shrink-0 z-50">
            <NavItem to="/" icon={<Home size={24} />} label="Рецепты" />
            <NavItem to="/fridge" icon={<Refrigerator size={24} />} label="У меня есть" />
            <NavItem to="/shopping" icon={<ShoppingCart size={24} />} label="Покупки" />
            <NavItem to="/suggest" icon={<Sparkles size={24} />} label="Что приготовить" />
          </nav>
        </div>
      </BrowserRouter>
    </AuthProvider>
  );
}

function NavItem({ to, icon, label }: { to: string; icon: React.ReactNode; label: string }) {
  return (
    <NavLink
      to={to}
      className={({ isActive }) => cn(
        "flex flex-col items-center justify-center min-w-[64px] px-1 py-0.5 gap-1.5 transition-all active:scale-95",
        isActive ? "text-emerald-600 font-semibold" : "text-stone-400 font-medium"
      )}
    >
      {icon}
      <span className="text-[11px] leading-tight tracking-tight whitespace-nowrap">{label}</span>
    </NavLink>
  );
}
