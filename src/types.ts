export enum Role {
  ADMIN = 'admin',
  DUENO = 'dueno',
  SUPERVISOR = 'supervisor',
  CAJERO = 'cajero',
  CLIENTE = 'cliente',
  PRODUCTOR = 'productor',
  REPARTIDOR = 'repartidor',
}

export interface User {
  id: string;
  username: string;
  role: Role;
  email?: string;
  avatar?: string;
  pin?: string;
}

export interface Product {
  id: string;
  codigo: string;
  nombre: string;
  categoria: string;
  costo_usd: number;
  precio_normal_usd: number;
  precio_oferta_usd?: number;
  margen_ganancia?: number;
  stock: number;
  stock_minimo: number;
  unidad_medida: string;
  vendedor_id?: string;
  estatus?: 'disponible' | 'agotado' | 'pausado' | 'destacado' | 'pendiente';
  imagen_url?: string;
  imagen_secundaria_url?: string;
  descripcion?: string;
}

export interface Client {
  id: string;
  nombre: string;
  cedula: string;
  telefono?: string;
  direccion?: string;
  saldo_usd: number;
  puntos: number;
  role: Role.CLIENTE;
}

export interface Productor {
  id: string;
  nombre: string;
  rif: string;
  telefono?: string;
  saldo_pendiente_usd: number;
  kilos_semana: number;
  puntos_ranking: number;
  es_obrero: boolean;
  role: Role.PRODUCTOR;
}

export interface Provider {
  id: string;
  nombre: string;
  contacto: string;
  telefono: string;
  email: string;
  categoria: string;
  createdAt?: string;
}

export interface TasaBCV {
  id: string;
  fecha: string;
  valor: number;
  fuente?: string;
  estatus?: 'Sincronizada' | 'Homologada' | 'Manual';
  sincronizadoEn?: any;
}

export interface SaleDetail {
  producto_id: string;
  nombre: string;
  cantidad: number;
  precio_unitario_usd: number;
}

export interface Sale {
  id: string;
  fecha: string;
  cliente_id?: string;
  nombre_cliente: string;
  total_usd: number;
  tasa_momento: number;
  es_fiado: boolean;
  pagada: boolean;
  detalles: SaleDetail[];
  pago_efectivo_usd: number;
  pago_efectivo_bs: number;
  pago_movil_bs: number;
  pago_transferencia_bs: number;
  biopago_bdv: number;
  pago_debito_bs: number;
  pago_otros_usd: number;
  saldo_pendiente_usd: number;
  user_id?: string;
  repartidor_id?: string;
  estado_repartidor?: 'buscando_repartidor' | 'asignado' | 'en_camino' | 'entregado';
  captures_pago?: string[];
}

export interface VentaPausada {
  id: string;
  fecha: string;
  cliente_id?: string;
  cliente_nombre_manual?: string;
  cliente_tipo: 'cliente' | 'productor' | 'consumidor';
  total_usd: number;
  user_id?: string;
  detalles: SaleDetail[];
}

export interface CierreCaja {
  id: string;
  fecha: string;
  monto_bs: number;
  monto_usd: number;
  pago_movil: number;
  transferencia: number;
  biopago: number;
  tarjeta_debito: number;
  tasa_cierre: number;
  total_ventas_usd: number;
  total_compras_usd: number;
  fiado_dia_usd: number;
  monto_real_usd: number;
  monto_real_bs: number;
  diferencia_usd: number;
  diferencia_bs: number;
  observaciones?: string;
  cajero_nombre: string;
  monto_apertura_usd: number;
  monto_apertura_bs: number;
}

export interface MovementProductor {
  id: string;
  fecha: string;
  proveedor_id: string;
  tipo: 'ENTREGA_QUESO' | 'PAGO' | 'ANTICIPO' | 'COMPRA_POS' | 'AJUSTE';
  descripcion?: string;
  kilos: number;
  monto_usd: number;
  debe: number;
  haber: number;
  saldo_momento: number;
  soporte_digital?: string;
  anio: number;
  semana_del_anio: number;
}

export interface CuentaContable {
  id: string;
  codigo: string;
  nombre: string;
  tipo: string;
  naturaleza: 'Acreedora' | 'Deudora';
  es_detalle: boolean;
}

export interface Asiento {
  id: string;
  fecha: string;
  descripcion: string;
  tasa_referencia: number;
  referencia_tipo?: string;
  referencia_id?: string;
  user_id?: string;
  detalles: DetalleAsiento[];
}

export interface DetalleAsiento {
  cuenta_id: string;
  debe_usd: number;
  haber_usd: number;
  debe_bs: number;
  haber_bs: number;
}

export interface InventoryAudit {
  id: string;
  producto_id: string;
  usuario_id: string;
  tipo_movimiento: 'ENTRADA' | 'SALIDA' | 'AJUSTE' | 'VENTA' | 'COMPRA';
  cantidad: number;
  motivo: string;
  fecha: string;
}

export interface Configuration {
  id: string;
  empresa_nombre: string;
  empresa_rif: string;
  empresa_telefono: string;
  empresa_direccion: string;
  mensaje_recibo: string;
  logo_url?: string;
  moneda_principal: 'USD' | 'BS';
  estado_portal?: 'automatico' | 'abierto' | 'cerrado';
  n8n_webhook_url?: string;
}

export interface Movement {
  id: string;
  fecha: string;
  tipo: 'NOMINA' | 'PAGO' | 'ABONO' | 'ENTREGA_QUESO' | 'VENTA' | 'GRES';
  descripcion: string;
  debe: number;
  haber: number;
  saldo_momento: number;
  kilos?: number;
}
