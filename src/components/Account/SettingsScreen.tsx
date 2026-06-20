import React, { useState, useEffect } from 'react';
import { 
  Settings, 
  Save, 
  Building2, 
  Receipt, 
  Phone, 
  MapPin, 
  Globe, 
  FileText,
  ShieldCheck,
  Image as ImageIcon
} from 'lucide-react';
import { cn } from '../../lib/utils';
import { getAppConfig, updateAppConfig } from '../../lib/dbUtils';
import { type Configuration } from '../../types';

const SettingsScreen: React.FC = () => {
  const [config, setConfig] = useState<Configuration>({
    id: 'global',
    empresa_nombre: 'KALUNEVA 2024',
    empresa_rif: 'J-12345678-9',
    empresa_telefono: '+58 412-1234567',
    empresa_direccion: 'Sector Las Lomas, Edo. Trujillo',
    mensaje_recibo: '¡Gracias por su compra! Vuelva pronto.',
    moneda_principal: 'USD',
    estado_portal: 'automatico'
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const fetchConfig = async () => {
      const data = await getAppConfig();
      if (data) setConfig(data as Configuration);
      setLoading(false);
    };
    fetchConfig();
  }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await updateAppConfig(config);
      alert("Configuración guardada exitosamente.");
    } catch (err) {
      console.error(err);
      alert("Error al guardar.");
    } finally {
      setSaving(false);
    }
  };

  if (loading) return null;

  return (
    <div className="max-w-4xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700 pb-20">
      <div>
        <h1 className="text-3xl font-black text-white flex items-center gap-3">
          <Settings className="text-[#3498db]" /> CONFIGURACIÓN GLOBAL
        </h1>
        <p className="text-gray-400 text-sm">Gestiona la información legal y visual de tu empresa según el modelo oficial</p>
      </div>

      <form onSubmit={handleSave} className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Información General */}
          <div className="bg-white/5 border border-white/10 p-8 rounded-[2.5rem] space-y-6">
            <h3 className="text-lg font-bold flex items-center gap-2 mb-2">
              <Building2 className="text-blue-400" size={20} /> Datos de la Empresa
            </h3>
            
            <div className="space-y-4">
              <div className="space-y-1">
                <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest px-2">Nombre Comercial</label>
                <input 
                  type="text" 
                  value={config.empresa_nombre}
                  onChange={(e) => setConfig({...config, empresa_nombre: e.target.value})}
                  className="w-full bg-black/30 border border-white/10 rounded-2xl py-4 px-6 text-sm font-bold focus:border-[#3498db] outline-none transition-all"
                />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest px-2">RIF / Identificación Fiscal</label>
                <input 
                  type="text" 
                  value={config.empresa_rif}
                  onChange={(e) => setConfig({...config, empresa_rif: e.target.value})}
                  className="w-full bg-black/30 border border-white/10 rounded-2xl py-4 px-6 text-sm font-bold focus:border-[#3498db] outline-none transition-all"
                />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest px-2">Teléfono de Contacto</label>
                <div className="relative">
                   <Phone className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500" size={16} />
                   <input 
                    type="text" 
                    value={config.empresa_telefono}
                    onChange={(e) => setConfig({...config, empresa_telefono: e.target.value})}
                    className="w-full bg-black/30 border border-white/10 rounded-2xl py-4 pl-12 pr-6 text-sm font-bold focus:border-[#3498db] outline-none transition-all"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Localización y Recibos */}
          <div className="bg-white/5 border border-white/10 p-8 rounded-[2.5rem] space-y-6">
            <h3 className="text-lg font-bold flex items-center gap-2 mb-2">
              <Receipt className="text-green-400" size={20} /> Formato de Venta
            </h3>
            
            <div className="space-y-4">
              <div className="space-y-1">
                <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest px-2">Dirección Fiscal</label>
                <div className="relative">
                  <MapPin className="absolute left-4 top-4 text-gray-500" size={16} />
                  <textarea 
                    rows={2}
                    value={config.empresa_direccion}
                    onChange={(e) => setConfig({...config, empresa_direccion: e.target.value})}
                    className="w-full bg-black/30 border border-white/10 rounded-2xl py-4 pl-12 pr-6 text-sm font-bold focus:border-[#3498db] outline-none transition-all"
                  />
                </div>
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest px-2">Mensaje al Pie del Recibo</label>
                <textarea 
                  rows={2}
                  value={config.mensaje_recibo}
                  onChange={(e) => setConfig({...config, mensaje_recibo: e.target.value})}
                  className="w-full bg-black/30 border border-white/10 rounded-2xl py-4 px-6 text-sm font-bold focus:border-[#3498db] outline-none transition-all"
                  placeholder="Ej: No se aceptan devoluciones..."
                />
              </div>
            </div>
          </div>
        </div>

        {/* Logo y Moneda */}
        <div className="bg-white/5 border border-white/10 p-8 rounded-[2.5rem] flex flex-col md:flex-row items-center gap-8">
           <div className="w-32 h-32 rounded-3xl bg-black/40 border-2 border-dashed border-white/10 flex flex-col items-center justify-center gap-2 text-gray-500 hover:border-[#3498db] hover:text-[#3498db] transition-all cursor-pointer group">
              <ImageIcon size={32} className="group-hover:scale-110 transition-transform" />
              <span className="text-[8px] font-black uppercase tracking-widest">Logo PNG</span>
           </div>
           <div className="flex-1 space-y-4">
              <h3 className="text-lg font-bold">Imagen y Moneda</h3>
              <p className="text-sm text-gray-500 font-medium">Define el logo que aparecerá en tus reportes y la moneda base del sistema.</p>
              <div className="flex gap-4">
                 <button 
                  type="button"
                  onClick={() => setConfig({...config, moneda_principal: 'USD'})}
                  className={cn(
                    "px-6 py-2 rounded-xl text-xs font-black tracking-widest transition-all",
                    config.moneda_principal === 'USD' ? "bg-green-500 text-white shadow-lg shadow-green-500/20" : "bg-white/5 text-gray-500"
                  )}
                 >
                   USD ($)
                 </button>
                 <button 
                  type="button"
                  onClick={() => setConfig({...config, moneda_principal: 'BS'})}
                  className={cn(
                    "px-6 py-2 rounded-xl text-xs font-black tracking-widest transition-all",
                    config.moneda_principal === 'BS' ? "bg-blue-500 text-white shadow-lg shadow-blue-500/20" : "bg-white/5 text-gray-500"
                  )}
                 >
                   BS (Bs.)
                 </button>
              </div>
           </div>
        </div>

         {/* Estado del Portal */}
         <div className="bg-white/5 border border-white/10 p-8 rounded-[2.5rem] space-y-4">
            <h3 className="text-lg font-bold flex items-center gap-2">
              <Globe className="text-purple-400" size={20} /> Estado del Portal Público
            </h3>
            <p className="text-sm text-gray-500 font-medium">Controla si los clientes pueden acceder al portal de compras o si se encuentra en mantenimiento.</p>
            
            <div className="flex flex-wrap items-center gap-4 mt-4">
              <button
               type="button"
               onClick={() => setConfig({...config, estado_portal: 'automatico'})}
               className={cn(
                 "px-6 py-3 rounded-xl text-xs font-black tracking-widest transition-all",
                 (!config.estado_portal || config.estado_portal === 'automatico') ? "bg-[#3498db] text-white shadow-lg shadow-[#3498db]/20" : "bg-white/5 text-gray-500 hover:bg-white/10"
               )}
              >
                AUTOMÁTICO (6am a 6pm)
              </button>
              <button
               type="button"
               onClick={() => setConfig({...config, estado_portal: 'cerrado'})}
               className={cn(
                 "px-6 py-3 rounded-xl text-xs font-black tracking-widest transition-all",
                 config.estado_portal === 'cerrado' ? "bg-red-500 text-white shadow-lg shadow-red-500/20" : "bg-white/5 text-gray-500 hover:bg-white/10"
               )}
              >
                MANTENIMIENTO (Forzar Cierre)
              </button>
            </div>
         </div>

         {/* Integraciones */}
         <div className="bg-white/5 border border-white/10 p-8 rounded-[2.5rem] space-y-4">
            <h3 className="text-lg font-bold flex items-center gap-2">
              <Globe className="text-pink-400" size={20} /> Integración n8n (Chatbot y CRM)
            </h3>
            <p className="text-sm text-gray-500 font-medium">URL del Webhook de n8n para notificar automáticamente al repartidor cuando llega un pedido.</p>
            <div className="space-y-1 mt-4">
              <input 
                type="url" 
                value={config.n8n_webhook_url || ''}
                onChange={(e) => setConfig({...config, n8n_webhook_url: e.target.value})}
                placeholder="https://n8n.tu-dominio.com/webhook/kalu-ventas"
                className="w-full bg-black/30 border border-white/10 rounded-2xl py-4 px-6 text-sm font-bold focus:border-[#3498db] outline-none transition-all"
              />
            </div>
         </div>

        <div className="flex flex-col md:flex-row items-center justify-between p-8 bg-[#3498db]/10 border border-[#3498db]/20 rounded-[2.5rem] gap-4">
           <div className="flex items-center gap-4">
              <ShieldCheck className="text-[#3498db]" size={32} />
              <div className="text-sm text-[#3498db] font-bold">Estos datos se reflejarán en todos los reportes y facturas emitidas.</div>
           </div>
           <button 
            type="submit"
            disabled={saving}
            className="bg-[#3498db] hover:bg-[#2980b9] text-white font-black py-4 px-10 rounded-2xl shadow-xl shadow-[#3498db]/20 transition-all flex items-center gap-3 text-sm uppercase tracking-[4px] active:scale-95 disabled:opacity-50"
          >
            <Save size={20} /> {saving ? 'GUARDANDO...' : 'GUARDAR CAMBIOS'}
          </button>
        </div>
      </form>
    </div>
  );
};

export default SettingsScreen;
