import React from 'react';
import { 
  User, 
  Shield, 
  Mail, 
  Calendar, 
  LogOut, 
  BadgeCheck,
  Settings as SettingsIcon,
  CreditCard,
  Lock,
  Smartphone,
  MapPin
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthProvider';
import { auth } from '../../lib/firebase';
import { signOut } from 'firebase/auth';
import { motion } from 'motion/react';
import { Role } from '../../types';

const ProfileScreen: React.FC = () => {
  const { user } = useAuth();

  const handleLogout = () => {
    signOut(auth);
  };

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="max-w-4xl mx-auto space-y-8 animate-in fade-in duration-700 pb-20"
    >
      {/* Header Profile */}
      <div className="relative overflow-hidden bg-white/5 border border-white/10 rounded-[3rem] p-10 backdrop-blur-xl">
        <div className="absolute top-0 right-0 w-64 h-64 bg-[#3498db]/10 rounded-full -translate-y-1/2 translate-x-1/2 blur-3xl"></div>
        
        <div className="flex flex-col md:flex-row items-center gap-8 relative z-10">
          <div className="relative">
            <div className="w-32 h-32 rounded-[2.5rem] bg-gradient-to-br from-[#3498db] to-[#2ecc71] p-1 shadow-2xl shadow-[#3498db]/20">
              <div className="w-full h-full rounded-[2.2rem] bg-[#0f172a] flex items-center justify-center text-5xl font-black text-white uppercase overflow-hidden">
                {user?.avatar ? (
                  <img src={user.avatar} alt="avatar" className="w-full h-full object-cover" />
                ) : (
                  user?.username?.substring(0, 2) || 'AD'
                )}
              </div>
            </div>
            <div className="absolute -bottom-2 -right-2 bg-[#2ecc71] text-white p-2 rounded-2xl shadow-lg border-4 border-[#0f172a]">
              <BadgeCheck size={20} />
            </div>
          </div>

          <div className="text-center md:text-left flex-1">
            <div className="flex flex-col md:flex-row md:items-center gap-3 mb-2">
              <h1 className="text-4xl font-black text-white tracking-tighter uppercase">{user?.username || 'Administrador'}</h1>
              <span className="bg-[#3498db] text-white text-[10px] font-black px-4 py-1 rounded-full tracking-widest uppercase shadow-lg shadow-[#3498db]/20">
                {user?.role || Role.ADMIN}
              </span>
            </div>
            <p className="text-gray-500 font-bold uppercase tracking-[0.2em] text-xs">ID de Usuario: {user?.id || 'USR-2024-001'}</p>
          </div>

          <button 
            onClick={handleLogout}
            className="bg-red-500/10 hover:bg-red-500 text-red-500 hover:text-white px-8 py-4 rounded-2xl font-black transition-all flex items-center gap-3 text-xs uppercase tracking-widest border border-red-500/20 group active:scale-95"
          >
            <LogOut size={18} /> CERRAR SESIÓN
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        {/* Personal Info */}
        <div className="bg-white/5 border border-white/10 rounded-[2.5rem] p-10 space-y-8">
          <h3 className="text-xl font-black text-white flex items-center gap-3">
            <User className="text-[#3498db]" size={24} /> INFORMACIÓN PERSONAL
          </h3>
          
          <div className="space-y-6">
            <div className="flex items-center gap-4 group">
              <div className="w-12 h-12 rounded-2xl bg-white/5 flex items-center justify-center text-gray-500 group-hover:text-white transition-colors">
                <Mail size={20} />
              </div>
              <div>
                <div className="text-[10px] font-black text-gray-500 uppercase tracking-widest">Correo Electrónico</div>
                <div className="text-sm font-bold text-white">{user?.email || 'admin@kaluneva.com'}</div>
              </div>
            </div>

            <div className="flex items-center gap-4 group">
              <div className="w-12 h-12 rounded-2xl bg-white/5 flex items-center justify-center text-gray-500 group-hover:text-white transition-colors">
                <Smartphone size={20} />
              </div>
              <div>
                <div className="text-[10px] font-black text-gray-500 uppercase tracking-widest">Teléfono</div>
                <div className="text-sm font-bold text-white">+58 412-0000000</div>
              </div>
            </div>

            <div className="flex items-center gap-4 group">
              <div className="w-12 h-12 rounded-2xl bg-white/5 flex items-center justify-center text-gray-500 group-hover:text-white transition-colors">
                <MapPin size={20} />
              </div>
              <div>
                <div className="text-[10px] font-black text-gray-500 uppercase tracking-widest">Ubicación</div>
                <div className="text-sm font-bold text-white">San Lorenzo Tiznados</div>
              </div>
            </div>

            <div className="flex items-center gap-4 group">
              <div className="w-12 h-12 rounded-2xl bg-white/5 flex items-center justify-center text-gray-500 group-hover:text-white transition-colors">
                <Calendar size={20} />
              </div>
              <div>
                <div className="text-[10px] font-black text-gray-500 uppercase tracking-widest">Miembro Desde</div>
                <div className="text-sm font-bold text-white">Mayo 2024</div>
              </div>
            </div>
          </div>
        </div>

        {/* Security and Preferences */}
        <div className="bg-white/5 border border-white/10 rounded-[2.5rem] p-10 space-y-8">
          <h3 className="text-xl font-black text-white flex items-center gap-3">
            <Lock className="text-[#f1c40f]" size={24} /> SEGURIDAD Y AJUSTES
          </h3>
          
          <div className="grid grid-cols-1 gap-4">
            <button 
              onClick={() => alert("¡Próximamente! En una futura actualización podrás cambiar tu PIN directamente desde aquí.")}
              className="flex items-center justify-between p-5 bg-white/5 hover:bg-white/10 border border-white/5 rounded-[2rem] transition-all group"
            >
              <div className="flex items-center gap-4">
                <SettingsIcon className="text-gray-500 group-hover:rotate-90 transition-transform" />
                <span className="text-sm font-bold text-white uppercase tracking-tight">Cambiar PIN de Acceso</span>
              </div>
              <BadgeCheck className="text-[#3498db] opacity-0 group-hover:opacity-100 transition-opacity" size={20} />
            </button>

            <button 
              onClick={() => alert("¡Próximamente! En una futura actualización podrás administrar tus cuentas y métodos de pago.")}
              className="flex items-center justify-between p-5 bg-white/5 hover:bg-white/10 border border-white/5 rounded-[2rem] transition-all group"
            >
              <div className="flex items-center gap-4">
                <CreditCard className="text-gray-500" />
                <span className="text-sm font-bold text-white uppercase tracking-tight">Métodos de Pago Vinculados</span>
              </div>
              <BadgeCheck className="text-[#3498db] opacity-0 group-hover:opacity-100 transition-opacity" size={20} />
            </button>

            <div className="p-6 bg-[#3498db]/5 border border-[#3498db]/20 rounded-3xl mt-4">
              <p className="text-xs text-[#3498db] font-bold leading-relaxed">
                Tu cuenta está protegida por encriptación de grado militar y autenticación de Google activa.
              </p>
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
};

export default ProfileScreen;
