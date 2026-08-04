import React, { useState, useMemo } from 'react';
import { X, Search, Check, Scale } from 'lucide-react';
import { type Product, type PiezaProducto } from '../../types';

interface PieceSelectionModalProps {
  isOpen: boolean;
  onClose: () => void;
  product: Product;
  onSelect: (pieza: PiezaProducto) => void;
}

const PieceSelectionModal: React.FC<PieceSelectionModalProps> = ({ isOpen, onClose, product, onSelect }) => {
  const [targetWeight, setTargetWeight] = useState<string>('');

  const availablePieces = useMemo(() => {
    if (!product || !Array.isArray(product.piezas)) return [];
    return product.piezas.filter(p => !p.vendida);
  }, [product.piezas]);

  const sortedPieces = useMemo(() => {
    const target = Number(targetWeight) || 0;
    if (target <= 0) return availablePieces; // Si no hay peso objetivo, mostrar tal cual

    return [...availablePieces].sort((a, b) => {
      const diffA = Math.abs(a.peso - target);
      const diffB = Math.abs(b.peso - target);
      return diffA - diffB;
    });
  }, [availablePieces, targetWeight]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      
      <div className="relative bg-[#050505] border border-amber-500/20 rounded-3xl w-full max-w-md overflow-hidden shadow-[0_0_30px_rgba(0,0,0,0.8)] animate-in fade-in zoom-in-95 duration-200">
        <div className="p-6 border-b border-amber-500/20 flex items-center justify-between bg-[#050505]">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-amber-400 rounded-xl shadow-lg shadow-amber-400/20">
              <Scale size={20} className="text-black" />
            </div>
            <div>
              <h2 className="text-lg font-black text-white leading-tight">Seleccionar Pieza</h2>
              <p className="text-xs text-amber-400 font-bold">{product.nombre}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 text-gray-400 hover:text-amber-400 hover:bg-amber-500/10 rounded-xl transition-colors">
            <X size={20} />
          </button>
        </div>

        <div className="p-6 space-y-6">
          <div className="space-y-2">
            <label className="text-xs font-bold text-gray-400 uppercase tracking-wider block text-center">¿Cuántos {product.unidad_medida} busca el cliente?</label>
            <div className="relative max-w-xs mx-auto">
              <input
                type="number"
                step="0.001"
                min="0"
                value={targetWeight}
                onChange={(e) => setTargetWeight(e.target.value)}
                placeholder="Ej. 1.0"
                className="w-full bg-[#111] border border-amber-500/30 rounded-xl px-4 py-4 text-center text-2xl font-black text-amber-400 focus:outline-none focus:border-amber-400 focus:shadow-[0_0_15px_rgba(251,191,36,0.3)] transition-all"
                autoFocus
              />
              <div className="absolute right-4 top-1/2 -translate-y-1/2 text-amber-500/50 font-bold">
                {product.unidad_medida}
              </div>
            </div>
          </div>

          <div className="space-y-3">
            <h3 className="text-xs font-black text-white uppercase tracking-wider flex items-center justify-between">
              Piezas Disponibles
              <span className="bg-amber-500/10 border border-amber-500/30 text-amber-400 px-2 py-1 rounded-lg text-[10px]">
                {availablePieces.length} en stock
              </span>
            </h3>
            
            <div className="space-y-2 max-h-60 overflow-y-auto custom-scrollbar pr-2">
              {sortedPieces.length === 0 ? (
                <div className="text-center py-6 text-gray-500 font-bold text-sm bg-black/20 rounded-xl border border-white/5">
                  No hay piezas disponibles en stock.
                </div>
              ) : (
                sortedPieces.map((pieza, idx) => {
                  const target = Number(targetWeight) || 0;
                  const diff = target > 0 ? pieza.peso - target : null;
                  const isClosest = target > 0 && idx === 0;

                  return (
                    <button
                      key={pieza.id}
                      onClick={() => onSelect(pieza)}
                      className={`w-full flex items-center justify-between p-3 rounded-xl border transition-all text-left group
                        ${isClosest 
                          ? 'bg-[#111] border-amber-400 shadow-[0_0_15px_rgba(251,191,36,0.2)] hover:bg-[#1a1a1a]' 
                          : 'bg-[#050505] border-amber-500/20 hover:border-amber-400 hover:shadow-[0_0_15px_rgba(251,191,36,0.2)]'
                        }`}
                    >
                      <div className="flex items-center gap-3">
                        <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-xs font-black
                          ${isClosest ? 'bg-amber-400 text-black' : 'bg-amber-500/10 text-amber-500/70 group-hover:bg-amber-400 group-hover:text-black transition-colors'}
                        `}>
                          #{pieza.numero}
                        </div>
                        <div>
                          <div className="text-base font-black text-gray-200 group-hover:text-white transition-colors">{pieza.peso} {product.unidad_medida}</div>
                          {diff !== null && diff !== 0 && (
                            <div className={`text-[10px] font-bold ${diff > 0 ? 'text-orange-400' : 'text-blue-400'}`}>
                              {diff > 0 ? '+' : ''}{diff.toFixed(3)} {product.unidad_medida} {diff > 0 ? 'más' : 'menos'}
                            </div>
                          )}
                          {diff === 0 && (
                            <div className="text-[10px] font-bold text-amber-400">¡Peso exacto!</div>
                          )}
                        </div>
                      </div>
                      <div className="flex flex-col items-end gap-2">
                        <span className="text-sm font-bold text-amber-400">
                          ${(pieza.precio_usd || (pieza.peso * (product.precio_oferta_usd || product.precio_normal_usd))).toFixed(2)}
                        </span>
                        <div className={`px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider flex items-center gap-2 ${isClosest ? 'bg-amber-400 text-black shadow-lg shadow-amber-400/30' : 'bg-[#050505] border border-amber-500/30 text-amber-400 group-hover:bg-amber-400 group-hover:text-black'} transition-colors`}>
                          <Check size={14} />
                          Elegir
                        </div>
                      </div>
                    </button>
                  );
                })
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PieceSelectionModal;
