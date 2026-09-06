import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Mail, Lock, User as UserIcon, AlertCircle, CheckCircle2, ArrowRight } from 'lucide-react';
import { useAuth } from '../AuthContext';

export function AuthModal() {
  const { isAuthModalOpen, setIsAuthModalOpen, signInWithGoogle, signInWithEmail, signUpWithEmail, resetPassword } = useAuth();
  
  const [mode, setMode] = useState<'signin' | 'signup' | 'reset'>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isAuthModalOpen) return null;

  const resetState = () => {
    setError(null);
    setSuccessMessage(null);
    setEmail('');
    setPassword('');
    setName('');
  };

  const handleClose = () => {
    resetState();
    setIsAuthModalOpen(false);
  };

  const getReadableErrorMessage = (err: any) => {
    const code = err?.code || '';
    if (code === 'auth/user-not-found' || code === 'auth/wrong-password' || code === 'auth/invalid-credential') {
      return 'Неверный email или пароль';
    }
    if (code === 'auth/email-already-in-use') {
      return 'Аккаунт с таким email уже существует. Попробуйте войти';
    }
    if (code === 'auth/weak-password') {
      return 'Пароль должен содержать не менее 6 символов';
    }
    if (code === 'auth/invalid-email') {
      return 'Некорректный адрес электронной почты';
    }
    if (code === 'auth/popup-closed-by-user' || code === 'auth/user-cancelled' || code === 'auth/cancelled-popup-request') {
      return 'Вход через Google был отменён';
    }
    if (code === 'auth/unauthorized-domain') {
      return 'Этот домен не добавлен в список разрешённых в Firebase Console (Authorized domains)';
    }
    if (code === 'auth/popup-blocked') {
      return 'Всплывающее окно заблокировано браузером. Разрешите всплывающие окна';
    }
    return err?.message || 'Произошла ошибка при входе. Попробуйте ещё раз';
  };

  const handleGoogleSignIn = async () => {
    setError(null);
    setSuccessMessage(null);
    setIsSubmitting(true);
    try {
      await signInWithGoogle();
      handleClose();
    } catch (err: any) {
      setError(getReadableErrorMessage(err));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccessMessage(null);

    if (!email.trim()) {
      setError('Пожалуйста, укажите email');
      return;
    }

    if (mode === 'reset') {
      setIsSubmitting(true);
      try {
        await resetPassword(email);
        setSuccessMessage('Ссылка для сброса пароля отправлена на ваш email');
      } catch (err: any) {
        setError(getReadableErrorMessage(err));
      } finally {
        setIsSubmitting(false);
      }
      return;
    }

    if (!password) {
      setError('Пожалуйста, введите пароль');
      return;
    }

    setIsSubmitting(true);
    try {
      if (mode === 'signin') {
        await signInWithEmail(email, password);
      } else {
        await signUpWithEmail(email, password, name);
      }
      handleClose();
    } catch (err: any) {
      setError(getReadableErrorMessage(err));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-900/60 backdrop-blur-xs">
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 10 }}
          className="bg-white rounded-3xl p-6 sm:p-7 w-full max-w-md shadow-2xl relative overflow-hidden"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Кнопка закрытия */}
          <button
            type="button"
            onClick={handleClose}
            className="absolute top-5 right-5 w-9 h-9 rounded-xl bg-stone-100 hover:bg-stone-200 text-stone-600 flex items-center justify-center transition-colors cursor-pointer"
          >
            <X size={18} />
          </button>

          {/* Заголовок */}
          <div className="mb-6">
            <h3 className="text-2xl font-black text-stone-900 tracking-tight">
              {mode === 'signin' && 'Вход в аккаунт'}
              {mode === 'signup' && 'Регистрация'}
              {mode === 'reset' && 'Восстановление пароля'}
            </h3>
            <p className="text-xs sm:text-sm text-stone-500 mt-1">
              {mode === 'signin' && 'Войдите для синхронизации рецептов и покупок'}
              {mode === 'signup' && 'Создайте аккаунт, чтобы сохранять данные в облаке'}
              {mode === 'reset' && 'Мы отправим ссылку для сброса пароля'}
            </p>
          </div>

          {/* Быстрый вход через Google */}
          {mode !== 'reset' && (
            <div className="mb-5">
              <button
                type="button"
                onClick={handleGoogleSignIn}
                disabled={isSubmitting}
                className="w-full h-12 rounded-2xl bg-stone-100 hover:bg-stone-200 text-stone-900 font-bold text-sm flex items-center justify-center gap-3 transition-colors cursor-pointer active:scale-98 disabled:opacity-50"
              >
                {/* Google Icon SVG */}
                <svg className="w-5 h-5" viewBox="0 0 24 24">
                  <path
                    fill="#4285F4"
                    d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                  />
                  <path
                    fill="#34A853"
                    d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  />
                  <path
                    fill="#FBBC05"
                    d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                  />
                  <path
                    fill="#EA4335"
                    d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                  />
                </svg>
                <span>Войти через Google</span>
              </button>

              <div className="flex items-center gap-3 my-4">
                <div className="flex-1 h-px bg-stone-200" />
                <span className="text-xs text-stone-400 font-medium">или через эл. почту</span>
                <div className="flex-1 h-px bg-stone-200" />
              </div>
            </div>
          )}

          {/* Сообщения об ошибках и успехе */}
          {error && (
            <div className="mb-4 p-3 rounded-2xl bg-red-50 text-red-700 text-xs flex items-start gap-2.5 font-medium">
              <AlertCircle size={16} className="shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {successMessage && (
            <div className="mb-4 p-3 rounded-2xl bg-emerald-50 text-emerald-800 text-xs flex items-start gap-2.5 font-medium">
              <CheckCircle2 size={16} className="shrink-0 mt-0.5" />
              <span>{successMessage}</span>
            </div>
          )}

          {/* Форма email/пароль */}
          <form onSubmit={handleSubmit} className="space-y-3">
            {mode === 'signup' && (
              <div>
                <label className="block text-xs font-semibold text-stone-700 mb-1">
                  Ваше имя
                </label>
                <div className="relative">
                  <UserIcon size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-stone-400 pointer-events-none" />
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Например, Анна"
                    className="w-full h-11 pl-10 pr-4 rounded-xl bg-stone-100 text-sm text-stone-900 placeholder-stone-400 focus:bg-stone-50 transition-colors"
                  />
                </div>
              </div>
            )}

            <div>
              <label className="block text-xs font-semibold text-stone-700 mb-1">
                Электронная почта
              </label>
              <div className="relative">
                <Mail size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-stone-400 pointer-events-none" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@example.com"
                  required
                  className="w-full h-11 pl-10 pr-4 rounded-xl bg-stone-100 text-sm text-stone-900 placeholder-stone-400 focus:bg-stone-50 transition-colors"
                />
              </div>
            </div>

            {mode !== 'reset' && (
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-xs font-semibold text-stone-700">
                    Пароль
                  </label>
                  {mode === 'signin' && (
                    <button
                      type="button"
                      onClick={() => {
                        setError(null);
                        setSuccessMessage(null);
                        setMode('reset');
                      }}
                      className="text-xs text-stone-500 hover:text-stone-800 font-medium cursor-pointer"
                    >
                      Забыли пароль?
                    </button>
                  )}
                </div>
                <div className="relative">
                  <Lock size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-stone-400 pointer-events-none" />
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    required
                    minLength={6}
                    className="w-full h-11 pl-10 pr-4 rounded-xl bg-stone-100 text-sm text-stone-900 placeholder-stone-400 focus:bg-stone-50 transition-colors"
                  />
                </div>
              </div>
            )}

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full h-12 mt-2 rounded-2xl bg-stone-900 hover:bg-stone-800 text-white font-bold text-sm flex items-center justify-center gap-2 shadow-sm active:scale-98 transition-all cursor-pointer disabled:opacity-50"
            >
              <span>
                {mode === 'signin' && 'Войти'}
                {mode === 'signup' && 'Зарегистрироваться'}
                {mode === 'reset' && 'Отправить ссылку для сброса'}
              </span>
              <ArrowRight size={16} />
            </button>
          </form>

          {/* Переключение режима */}
          <div className="mt-5 pt-4 border-t border-stone-100 text-center text-xs text-stone-500">
            {mode === 'signin' && (
              <p>
                Ещё нет аккаунта?{' '}
                <button
                  type="button"
                  onClick={() => {
                    setError(null);
                    setSuccessMessage(null);
                    setMode('signup');
                  }}
                  className="font-bold text-stone-900 hover:underline cursor-pointer ml-1"
                >
                  Зарегистрироваться
                </button>
              </p>
            )}

            {mode === 'signup' && (
              <p>
                Уже есть аккаунт?{' '}
                <button
                  type="button"
                  onClick={() => {
                    setError(null);
                    setSuccessMessage(null);
                    setMode('signin');
                  }}
                  className="font-bold text-stone-900 hover:underline cursor-pointer ml-1"
                >
                  Войти
                </button>
              </p>
            )}

            {mode === 'reset' && (
              <p>
                Вспомнили пароль?{' '}
                <button
                  type="button"
                  onClick={() => {
                    setError(null);
                    setSuccessMessage(null);
                    setMode('signin');
                  }}
                  className="font-bold text-stone-900 hover:underline cursor-pointer ml-1"
                >
                  Вернуться к входу
                </button>
              </p>
            )}
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
