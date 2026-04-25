import React, { useState, useEffect } from 'react';
import { 
  GoogleAuthProvider, 
  signInWithPopup, 
  onAuthStateChanged, 
  signOut,
  User 
} from 'firebase/auth';
import { auth } from '../lib/firebase';
import { Button } from '@/components/ui/button';
import { LogOut, Loader2, X } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

export default function FirebaseLogin() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [showOneTap, setShowOneTap] = useState(false);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (u) => {
      setUser(u);
      setLoading(false);
      if (!u) {
        // Show One Tap after a short delay if not logged in
        const timer = setTimeout(() => setShowOneTap(true), 1500);
        return () => clearTimeout(timer);
      } else {
        setShowOneTap(false);
      }
    });
    return () => unsubscribe();
  }, []);

  const handleLogin = async () => {
    const provider = new GoogleAuthProvider();
    provider.setCustomParameters({ prompt: 'select_account' });
    try {
      setShowOneTap(false);
      await signInWithPopup(auth, provider);
    } catch (error) {
      console.error('Login failed:', error);
      setShowOneTap(true); // show again if failed
    }
  };

  const handleLogout = async () => {
    try {
      await signOut(auth);
    } catch (error) {
      console.error('Logout failed:', error);
    }
  };

  if (loading) return <Button variant="ghost" size="sm" disabled><Loader2 className="w-4 h-4 animate-spin" /></Button>;

  if (user) {
    return (
      <div className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-zinc-100 transition-colors">
        <img src={user.photoURL || ''} alt="" className="w-6 h-6 rounded-full border border-zinc-200" referrerPolicy="no-referrer" />
        <div className="flex flex-col min-w-0">
          <span className="text-xs font-medium text-zinc-700 truncate">{user.displayName}</span>
          <button onClick={handleLogout} className="text-[10px] text-zinc-400 hover:text-red-500 text-left">Cerrar sesión</button>
        </div>
      </div>
    );
  }

  return (
    <>
      <Button onClick={handleLogin} variant="outline" size="sm" className="gap-2 w-full justify-start border-zinc-200 text-zinc-600 hover:bg-zinc-50 relative overflow-hidden group">
        <svg className="w-4 h-4" viewBox="0 0 24 24">
          <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
          <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
          <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
          <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
        </svg>
        <span className="font-medium">Iniciar con Google</span>
        
        {/* Glow effect */}
        <div className="absolute inset-0 bg-blue-500/10 opacity-0 group-hover:opacity-100 transition-opacity" />
      </Button>

      <AnimatePresence>
        {showOneTap && (
          <motion.div 
            initial={{ opacity: 0, y: -20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -20, scale: 0.95 }}
            transition={{ type: "spring", stiffness: 300, damping: 25 }}
            className="fixed top-4 right-4 z-50 w-80 bg-white rounded-xl shadow-2xl border border-black/5 overflow-hidden font-sans"
          >
            <div className="p-4 flex flex-col items-center text-center relative">
              <button 
                onClick={() => setShowOneTap(false)}
                className="absolute top-3 right-3 text-zinc-400 hover:text-zinc-600 transition-colors"
                aria-label="Cerrar"
              >
                <X className="w-4 h-4" />
              </button>
              
              <div className="w-12 h-12 bg-white rounded-full flex items-center justify-center p-2.5 shadow-sm border border-zinc-100 mb-3">
                <svg viewBox="0 0 24 24" className="w-full h-full">
                  <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
                  <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                  <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
                  <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
                </svg>
              </div>
              
              <h3 className="text-base font-semibold text-zinc-900 mb-1">Accede a Aura Studio</h3>
              <p className="text-xs text-zinc-500 mb-4 px-2">
                Guarda tus proyectos en la nube y accede a todas las funciones.
              </p>
              
              <button 
                onClick={handleLogin}
                className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium text-sm py-2 px-4 rounded-lg transition-colors focus:ring-4 focus:ring-blue-100"
              >
                Continuar con Google
              </button>
            </div>
            <div className="bg-zinc-50 px-4 py-2 text-center border-t border-zinc-100 text-[10px] text-zinc-400">
              Uso seguro y privado de las credenciales de Google.
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
