import React, { useState, useRef, useEffect } from 'react';
import { LogIn, LogOut, Cloud, CloudCheck, User as UserIcon } from 'lucide-react';
import { useAuth } from '../AuthContext';

export function UserAuthButton() {
  const { user, signOut, setIsAuthModalOpen } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  if (!user) {
    return (
      <button
        id="btn-open-auth-modal"
        type="button"
        onClick={() => setIsAuthModalOpen(true)}
        className="px-3.5 py-2 rounded-xl bg-stone-900 hover:bg-stone-800 text-white text-xs font-bold flex items-center gap-2 shadow-xs transition-all active:scale-95 cursor-pointer"
        title="Войти через Google или email"
      >
        <LogIn size={15} />
        <span>Войти</span>
      </button>
    );
  }

  const initials = (user.displayName || user.email || 'U').charAt(0).toUpperCase();

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 p-1.5 rounded-2xl bg-stone-100 hover:bg-stone-200 transition-all cursor-pointer active:scale-95"
        title={user.displayName || user.email || 'Аккаунт'}
      >
        {user.photoURL ? (
          <img
            src={user.photoURL}
            alt="User avatar"
            referrerPolicy="no-referrer"
            className="w-7 h-7 rounded-xl object-cover"
          />
        ) : (
          <div className="w-7 h-7 rounded-xl bg-stone-900 text-white font-bold text-xs flex items-center justify-center">
            {initials}
          </div>
        )}
        <span className="text-xs font-semibold text-stone-800 max-w-[90px] sm:max-w-[130px] truncate hidden sm:inline">
          {user.displayName || user.email?.split('@')[0]}
        </span>
      </button>

      {/* Выпадающее меню профиля */}
      {isOpen && (
        <div className="absolute right-0 mt-2 w-64 bg-white rounded-2xl p-4 shadow-xl z-50 animate-in fade-in zoom-in-95 duration-100">
          <div className="flex items-center gap-3 pb-3 mb-3 border-b border-stone-100">
            {user.photoURL ? (
              <img
                src={user.photoURL}
                alt="Avatar"
                referrerPolicy="no-referrer"
                className="w-10 h-10 rounded-2xl object-cover"
              />
            ) : (
              <div className="w-10 h-10 rounded-2xl bg-stone-900 text-white font-bold text-sm flex items-center justify-center">
                {initials}
              </div>
            )}
            <div className="min-w-0 flex-1">
              <p className="text-xs font-bold text-stone-900 truncate">
                {user.displayName || 'Пользователь'}
              </p>
              <p className="text-[11px] text-stone-500 truncate">
                {user.email}
              </p>
            </div>
          </div>

          <div className="space-y-2 mb-3">
            <div className="flex items-center gap-2 px-2.5 py-1.5 rounded-xl bg-emerald-50 text-emerald-800 text-[11px] font-medium">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <span>Синхронизация с Firebase активна</span>
            </div>
          </div>

          <button
            type="button"
            onClick={async () => {
              setIsOpen(false);
              await signOut();
            }}
            className="w-full px-3 py-2 rounded-xl bg-stone-100 hover:bg-stone-200 text-stone-800 text-xs font-bold flex items-center justify-center gap-2 transition-colors cursor-pointer"
          >
            <LogOut size={14} />
            <span>Выйти из аккаунта</span>
          </button>
        </div>
      )}
    </div>
  );
}
