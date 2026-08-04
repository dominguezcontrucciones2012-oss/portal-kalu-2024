import React, { useState } from 'react';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import { ArrowLeft, Menu } from 'lucide-react';
import { useAuth } from '../../contexts/AuthProvider';
import { Role } from '../../types';
import Sidebar from './Sidebar';
import { useActiveStore } from '../../hooks/useActiveStore';

const Layout: React.FC = () => {
  const { user } = useAuth();
  const { loadingStore } = useActiveStore();
  const location = useLocation();
  const navigate = useNavigate();
  const userRole = (user?.role?.toLowerCase() as Role) || Role.CLIENTE;
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  
  // Liberación forzosa del Backdrop al redimensionar a laptop/desktop
  React.useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth >= 768 && isMobileMenuOpen) {
        setIsMobileMenuOpen(false);
      }
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [isMobileMenuOpen]);
  
  // Ocultar barra lateral en las vistas de catálogo, portal de cliente y repartidor
  const isStandalonePage = location.pathname.includes('/catalogo') || 
                           location.pathname.includes('/client-portal') || 
                           location.pathname.includes('/repartidor');
  const showSidebar = userRole !== Role.CLIENTE && userRole !== 'repartidor' && !isStandalonePage;

  const isRootPage = ['/', '/dashboard', '/client-portal', '/repartidor', '/catalogo', '/pos', '/settings', '/despacho', '/closure', '/history', '/clients', '/repartidores', '/morosos', '/inventory', '/purchases', '/providers', '/reports', '/accounting'].includes(location.pathname);

  // El bloqueo de loadingStore fue removido para evitar flicker (el renderizado se delega a las pantallas hijas)
  return (
    <div 
      className="flex h-screen w-full bg-slate-900 text-slate-100 overflow-hidden font-sans relative"
    >
      {/* Mobile Sidebar Overlay */}
      {showSidebar && isMobileMenuOpen && (
        <div 
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 md:hidden"
          onClick={() => setIsMobileMenuOpen(false)}
        />
      )}
      
      {showSidebar && (
        <Sidebar 
          userRole={userRole} 
          isMobileMenuOpen={isMobileMenuOpen} 
          setIsMobileMenuOpen={setIsMobileMenuOpen} 
        />
      )}
      
      <main className="flex-1 flex flex-col min-w-0 relative overflow-hidden">
        {/* Mobile Header with Hamburger Menu */}
        {showSidebar && (
          <div className="md:hidden flex items-center p-4 border-b border-white/10 bg-slate-900 sticky top-0 z-30">
            <button 
              onClick={() => setIsMobileMenuOpen(true)}
              className="p-2 bg-white/5 hover:bg-white/10 rounded-xl border border-white/10"
            >
              <Menu size={24} className="text-white" />
            </button>
            <div className="flex-1 text-center font-black text-white uppercase tracking-widest text-sm">
              Menu
            </div>
          </div>
        )}
        
        <div className="relative z-10 flex-1 overflow-y-auto custom-scrollbar">
          <div className={`container mx-auto max-w-[1600px] h-full ${location.pathname === '/pos' ? 'p-2 sm:p-4' : 'p-4 sm:p-6 lg:p-8'}`}>
            {!isRootPage && (
              <button 
                onClick={() => navigate(-1)}
                className="mb-6 flex items-center gap-2 text-gray-400 hover:text-white bg-white/5 hover:bg-white/10 border border-white/10 hover:border-white/20 px-4 py-2 rounded-xl transition-all font-medium backdrop-blur-md w-fit shadow-lg shadow-black/20"
              >
                <ArrowLeft size={20} />
                <span>Volver Atrás</span>
              </button>
            )}
            <Outlet />
          </div>
        </div>
      </main>
      
      <style>{`
        .custom-scrollbar::-webkit-scrollbar {
          width: 6px;
          height: 6px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: transparent;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: rgba(255, 255, 255, 0.1);
          border-radius: 10px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: rgba(255, 255, 255, 0.2);
        }
      `}</style>
    </div>
  );
};

export default Layout;
