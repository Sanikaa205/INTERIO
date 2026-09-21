import React, { useState } from 'react';
import {
  Lock,
  Mail,
  User as UserIcon,
  ArrowRight,
  AlertCircle,
  Eye,
  EyeOff,
  ArrowLeft,
} from 'lucide-react';
import { loginApi, registerApi } from '../services/api';
import { User } from '../types';

interface AuthViewProps {
  onAuthSuccess: (user: User) => void;
  onCancel?: () => void;
  initialMode?: 'login' | 'signup';
}

const BACKGROUND_SCENES = [
  {
    id: 'living',
    title: 'Minimalist Living Space',
    location: 'Stockholm Penthouse',
    image: 'https://images.unsplash.com/photo-1600210492486-724fe5c67fb0?auto=format&fit=crop&w=1600&q=85',
    quote: '“INTERIO brings clarity and precision to every spatial layout and design presentation.”',
    author: 'Elena Rostova, Studio Form',
  },
  {
    id: 'villa',
    title: 'Glass Pavilion',
    location: 'Zurich Hills',
    image: 'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?auto=format&fit=crop&w=1600&q=85',
    quote: '“Generating non-overlapping 2D CAD floor plans directly from dimensions is effortless.”',
    author: 'Marcus Vance, Architectural Lead',
  },
  {
    id: 'japandi',
    title: 'Organic Interior',
    location: 'Kyoto Sanctuary',
    image: 'https://images.unsplash.com/photo-1618221195710-dd6b41faaea6?auto=format&fit=crop&w=1600&q=85',
    quote: '“The material palettes and lighting recommendations match real architectural standards.”',
    author: 'Sofia Lindqvist, Interior Architect',
  },
];

export const AuthView: React.FC<AuthViewProps> = ({
  onAuthSuccess,
  onCancel,
  initialMode = 'login',
}) => {
  const [isLogin, setIsLogin] = useState<boolean>(initialMode === 'login');
  const [name, setName] = useState<string>('');
  const [email, setEmail] = useState<string>('architect@interio.design');
  const [password, setPassword] = useState<string>('interio2026');
  const [rememberMe, setRememberMe] = useState<boolean>(true);
  const [showPassword, setShowPassword] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [activeSceneIdx, setActiveSceneIdx] = useState<number>(0);

  const activeScene = BACKGROUND_SCENES[activeSceneIdx];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      if (isLogin) {
        const user = await loginApi(email, password);
        onAuthSuccess(user);
      } else {
        if (!name.trim()) {
          throw new Error('Please enter your full name');
        }
        if (password.length < 6) {
          throw new Error('Password must be at least 6 characters');
        }
        const user = await registerApi(email, password, name);
        onAuthSuccess(user);
      }
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Authentication failed. Please verify your details.');
    } finally {
      setLoading(false);
    }
  };

  const handleQuickDemo = async () => {
    setEmail('architect@interio.design');
    setPassword('interio2026');
    setError(null);
    setLoading(true);
    try {
      const user = await loginApi('architect@interio.design', 'interio2026');
      onAuthSuccess(user);
    } catch (err: any) {
      console.error(err);
      setError('Demo login error. Please try standard sign-in.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-stone-50 text-stone-900 flex flex-col lg:flex-row antialiased">
      {/* LEFT SIDE: Clean Architectural Photography */}
      <div className="relative w-full lg:w-1/2 xl:w-7/12 min-h-[340px] lg:min-h-screen bg-stone-900 flex flex-col justify-between p-8 sm:p-12 overflow-hidden">
        {/* Background Image */}
        <div
          className="absolute inset-0 bg-cover bg-center transition-all duration-700"
          style={{
            backgroundImage: `url('${activeScene.image}')`,
          }}
        />
        <div className="absolute inset-0 bg-stone-950/40" />

        {/* Brand Header */}
        <div className="relative z-10 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-white/20 backdrop-blur-md flex items-center justify-center text-white">
              <span className="font-semibold text-sm">I</span>
            </div>
            <span className="font-semibold text-base tracking-tight text-white">
              INTERIO
            </span>
          </div>

          {onCancel && (
            <button
              onClick={onCancel}
              className="lg:hidden flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-white/20 hover:bg-white/30 backdrop-blur-md text-white text-xs font-medium transition-colors"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Back</span>
            </button>
          )}
        </div>

        {/* Scene Quote & Metadata */}
        <div className="relative z-10 mt-auto pt-12 lg:pt-0 max-w-lg">
          <blockquote className="text-lg sm:text-xl font-light text-white leading-relaxed mb-3">
            {activeScene.quote}
          </blockquote>

          <div className="flex items-center justify-between border-t border-white/20 pt-3">
            <div>
              <p className="text-xs text-stone-200 font-medium">
                {activeScene.author}
              </p>
              <p className="text-[11px] text-stone-400">
                {activeScene.title} · {activeScene.location}
              </p>
            </div>

            {/* Scene Selector dots */}
            <div className="flex items-center gap-1.5">
              {BACKGROUND_SCENES.map((scene, idx) => (
                <button
                  key={scene.id}
                  onClick={() => setActiveSceneIdx(idx)}
                  className={`h-1.5 rounded-full transition-all ${
                    activeSceneIdx === idx ? 'w-5 bg-white' : 'w-1.5 bg-white/40 hover:bg-white/70'
                  }`}
                  aria-label={`Switch to ${scene.title}`}
                />
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* RIGHT SIDE: Clean White Card & Form */}
      <div className="w-full lg:w-1/2 xl:w-5/12 flex flex-col justify-center items-center px-6 sm:px-12 py-10 lg:py-16 overflow-y-auto">
        {onCancel && (
          <div className="w-full max-w-sm flex justify-end mb-4">
            <button
              onClick={onCancel}
              className="hidden lg:flex items-center gap-1.5 text-xs text-stone-500 hover:text-stone-900 transition-colors"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Continue as guest</span>
            </button>
          </div>
        )}

        <div className="w-full max-w-sm space-y-6">
          {/* Header */}
          <div>
            <h1 className="text-2xl font-semibold text-stone-900 tracking-tight">
              {isLogin ? 'Welcome back' : 'Create an account'}
            </h1>
            <p className="text-stone-500 text-xs mt-1 leading-relaxed">
              {isLogin
                ? 'Sign in to access your saved floor plans and designs.'
                : 'Start generating precision floor plans and interior spaces.'}
            </p>
          </div>

          {/* Mode Segmented Toggle */}
          <div className="grid grid-cols-2 p-1 bg-stone-100 rounded-lg text-xs font-medium">
            <button
              id="tab-login"
              type="button"
              onClick={() => {
                setIsLogin(true);
                setError(null);
              }}
              className={`py-1.5 rounded-md transition-all ${
                isLogin
                  ? 'bg-white text-stone-900 shadow-2xs font-semibold'
                  : 'text-stone-500 hover:text-stone-900'
              }`}
            >
              Sign In
            </button>
            <button
              id="tab-signup"
              type="button"
              onClick={() => {
                setIsLogin(false);
                setError(null);
              }}
              className={`py-1.5 rounded-md transition-all ${
                !isLogin
                  ? 'bg-white text-stone-900 shadow-2xs font-semibold'
                  : 'text-stone-500 hover:text-stone-900'
              }`}
            >
              Register
            </button>
          </div>

          {/* 1-Click Demo Button */}
          <button
            id="btn-auth-demo"
            type="button"
            onClick={handleQuickDemo}
            disabled={loading}
            className="w-full py-2.5 px-3 bg-stone-100 hover:bg-stone-200/80 border border-stone-200/60 rounded-lg text-xs font-medium text-stone-800 flex items-center justify-between transition-colors cursor-pointer"
          >
            <div className="text-left">
              <span className="block font-medium text-stone-900">
                1-Click Architect Demo
              </span>
              <span className="block text-[11px] text-stone-500 font-normal">
                Pre-loaded sample projects & 3D viewer
              </span>
            </div>
            <ArrowRight className="w-4 h-4 text-stone-400" />
          </button>

          <div className="relative flex items-center justify-center">
            <div className="border-t border-stone-200 w-full" />
            <span className="bg-stone-50 px-2 text-[11px] text-stone-400 absolute">
              or
            </span>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-3.5">
            {!isLogin && (
              <>
                <div>
                  <label className="block text-xs font-medium text-stone-700 mb-1">
                    Full Name
                  </label>
                  <div className="relative">
                    <UserIcon className="w-3.5 h-3.5 text-stone-400 absolute left-3 top-3" />
                    <input
                      id="input-name"
                      type="text"
                      required={!isLogin}
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="Sarah Jenkins"
                      className="w-full pl-9 pr-3 py-2 bg-white border border-stone-200 rounded-lg text-xs text-stone-900 focus:border-stone-900 outline-hidden transition-colors"
                    />
                  </div>
                </div>
              </>
            )}

            <div>
              <label className="block text-xs font-medium text-stone-700 mb-1">
                Email Address
              </label>
              <div className="relative">
                <Mail className="w-3.5 h-3.5 text-stone-400 absolute left-3 top-3" />
                <input
                  id="input-email"
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="architect@domain.com"
                  className="w-full pl-9 pr-3 py-2 bg-white border border-stone-200 rounded-lg text-xs text-stone-900 focus:border-stone-900 outline-hidden transition-colors"
                />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs font-medium text-stone-700">Password</label>
                {isLogin && (
                  <span className="text-[11px] text-stone-400">
                    Demo: interio2026
                  </span>
                )}
              </div>
              <div className="relative">
                <Lock className="w-3.5 h-3.5 text-stone-400 absolute left-3 top-3" />
                <input
                  id="input-password"
                  type={showPassword ? 'text' : 'password'}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full pl-9 pr-9 py-2 bg-white border border-stone-200 rounded-lg text-xs text-stone-900 focus:border-stone-900 outline-hidden transition-colors"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-2.5 text-stone-400 hover:text-stone-600"
                >
                  {showPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                </button>
              </div>
            </div>

            {isLogin && (
              <div className="flex items-center justify-between pt-0.5">
                <label className="flex items-center gap-2 cursor-pointer text-xs text-stone-500">
                  <input
                    type="checkbox"
                    checked={rememberMe}
                    onChange={(e) => setRememberMe(e.target.checked)}
                    className="rounded-sm border-stone-300 text-stone-900 focus:ring-stone-900"
                  />
                  <span>Remember me</span>
                </label>
              </div>
            )}

            {error && (
              <div className="p-2.5 bg-red-50 border border-red-200 text-red-700 text-xs rounded-lg flex items-start gap-2">
                <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5 text-red-500" />
                <span className="leading-relaxed">{error}</span>
              </div>
            )}

            <button
              id="btn-auth-submit"
              type="submit"
              disabled={loading}
              className="w-full py-2.5 bg-stone-900 hover:bg-stone-800 disabled:bg-stone-400 text-white font-medium text-xs rounded-lg transition-colors flex items-center justify-center gap-2 cursor-pointer"
            >
              {loading ? (
                <span>Processing...</span>
              ) : isLogin ? (
                <span>Sign In</span>
              ) : (
                <span>Create Account</span>
              )}
            </button>
          </form>

          {/* Bottom Switch Link */}
          <div className="text-center">
            {isLogin ? (
              <p className="text-xs text-stone-500">
                New to INTERIO?{' '}
                <button
                  type="button"
                  onClick={() => {
                    setIsLogin(false);
                    setError(null);
                  }}
                  className="font-medium text-stone-900 hover:underline"
                >
                  Create an account
                </button>
              </p>
            ) : (
              <p className="text-xs text-stone-500">
                Already have an account?{' '}
                <button
                  type="button"
                  onClick={() => {
                    setIsLogin(true);
                    setError(null);
                  }}
                  className="font-medium text-stone-900 hover:underline"
                >
                  Sign in
                </button>
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
