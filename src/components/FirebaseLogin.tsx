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
import { LogIn, LogOut, Loader2 } from 'lucide-react';

export default function FirebaseLogin() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (u) => {
      setUser(u);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const handleLogin = async () => {
    const provider = new GoogleAuthProvider();
    try {
      await signInWithPopup(auth, provider);
    } catch (error) {
      console.error('Login failed:', error);
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
    <Button onClick={handleLogin} variant="outline" size="sm" className="gap-2 w-full justify-start border-zinc-200 text-zinc-600 hover:bg-zinc-50">
      <LogIn className="w-4 h-4" />
      <span>Conectar con Firebase</span>
    </Button>
  );
}
