import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Truck, ShoppingCart, LogOut } from 'lucide-react';
import { useAuth } from '../../contexts/AuthProvider';
import { auth } from '../../lib/firebase';

export default function DriverOrClientGate() {
  const navigate = useNavigate();
  const { user, setUser } = useAuth();

  const handleLogout = async () => {
    try {
      setUser(null);
      localStorage.removeItem('kalu_current_user');
      localStorage.removeItem('kalu_pin_verified');
      await auth.signOut();
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <div className="min-h-screen bg-[#050505] flex flex-col items-center justify-center p-6 text-white relative">
      <div className="absolute top-6 right-6">
        <button 
          onClick={handleLogout}
          className="w-12 h-12 bg-white/5 border border-white/10 rounded-full flex items-center justify-center text-gray-400 hover:bg-white/10 transition-colors"
        >
          <LogOut size={20} />
        </button>
      </div>

      <div className="max-w-md w-full space-y-8">
        <div className="text-center">
          <div className="w-20 h-20 bg-gradient-to-br from-purple-600 to-blue-600 rounded-3xl mx-auto flex items-center justify-center mb-6 shadow-2xl shadow-purple-900/50">
            <Truck size={40} className="text-white" />
          </div>
          <h1 className="text-3xl font-black uppercase tracking-tight mb-2">¡Hola, {user?.username}!</h1>
          <p className="text-gray-400 font-bold tracking-widest text-sm uppercase">¿Cómo deseas ingresar hoy?</p>
        </div>

        <div className="grid gap-4 mt-8">
          <button
            onClick={() => navigate('/repartidor')}
            className="group relative overflow-hidden bg-gradient-to-r from-purple-900/40 to-indigo-900/40 border border-purple-500/30 p-6 rounded-3xl flex items-center gap-6 hover:scale-[1.02] active:scale-95 transition-all"
          >
            <div className="absolute inset-0 bg-gradient-to-r from-purple-600/20 to-indigo-600/20 opacity-0 group-hover:opacity-100 transition-opacity" />
            <div className="w-16 h-16 bg-purple-500/20 rounded-2xl flex items-center justify-center shrink-0">
              <Truck size={32} className="text-purple-400" />
            </div>
            <div className="text-left relative z-10">
              <h2 className="text-xl font-black uppercase tracking-tight mb-1 text-purple-100">Modo Repartidor</h2>
              <p className="text-xs text-purple-300/70 font-bold uppercase tracking-wider">Ver mis pedidos y turnos</p>
            </div>
          </button>

          <button
            onClick={() => navigate('/client-portal')}
            className="group relative overflow-hidden bg-gradient-to-r from-emerald-900/40 to-teal-900/40 border border-emerald-500/30 p-6 rounded-3xl flex items-center gap-6 hover:scale-[1.02] active:scale-95 transition-all"
          >
            <div className="absolute inset-0 bg-gradient-to-r from-emerald-600/20 to-teal-600/20 opacity-0 group-hover:opacity-100 transition-opacity" />
            <div className="w-16 h-16 bg-emerald-500/20 rounded-2xl flex items-center justify-center shrink-0">
              <ShoppingCart size={32} className="text-emerald-400" />
            </div>
            <div className="text-left relative z-10">
              <h2 className="text-xl font-black uppercase tracking-tight mb-1 text-emerald-100">Modo Cliente</h2>
              <p className="text-xs text-emerald-300/70 font-bold uppercase tracking-wider">Ir a comprar productos</p>
            </div>
          </button>
        </div>
      </div>
    </div>
  );
}
