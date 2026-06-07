import React from 'react';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { useAuth } from '../../contexts/AuthProvider';
import { Role } from '../../types';
import Sidebar from './Sidebar';

const Layout: React.FC = () => {
  const { user } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const userRole = (user?.role?.toLowerCase() as Role) || Role.CLIENTE;
  
  // Ocultar barra lateral en las vistas de catálogo, portal de cliente y repartidor
  const isStandalonePage = location.pathname.includes('/catalogo') || 
                           location.pathname.includes('/client-portal') || 
                           location.pathname.includes('/repartidor');
  const showSidebar = userRole !== Role.CLIENTE && userRole !== 'repartidor' && !isStandalonePage;

  const isRootPage = ['/', '/dashboard', '/client-portal', '/repartidor', '/catalogo'].includes(location.pathname);

  return (
    <div 
      className="flex h-screen w-full bg-[#0f172a] text-slate-100 overflow-hidden font-sans"
      style={isStandalonePage ? {
        backgroundImage: "linear-gradient(rgba(15, 23, 42, 0.88), rgba(15, 23, 42, 0.95)), url('/logo.png')",
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        backgroundAttachment: 'fixed'
      } : {}}
    >
      {showSidebar && <Sidebar userRole={userRole} />}
      
      <main className="flex-1 flex flex-col min-w-0 relative overflow-hidden">
        {/* Background Overlay for professional look */}
        <div className="absolute inset-0 z-0 pointer-events-none opacity-20">
          <div className="absolute top-0 right-0 w-96 h-96 bg-[#3498db] blur-[150px] rounded-full translate-x-1/2 -translate-y-1/2" />
          <div className="absolute bottom-0 left-0 w-96 h-96 bg-[#2ecc71] blur-[150px] rounded-full -translate-x-1/2 translate-y-1/2" />
        </div>
        
        <div className="relative z-10 flex-1 overflow-y-auto custom-scrollbar">
          <div className="container mx-auto p-4 sm:p-6 lg:p-8 max-w-[1600px]">
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
