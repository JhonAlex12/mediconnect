import React, { Suspense, lazy, useEffect } from 'react';
import { Route, Routes, useLocation, useSearchParams } from 'react-router-dom';
import LimiteError from './components/LimiteError';
import { SesionProvider } from './lib/sesion';
import { CuentaProvider } from './lib/cuenta';
import { ContenidoProvider } from './lib/contenido';
import Inicio from './paginas/Inicio';
import SaludAlDia from './paginas/SaludAlDia';
import NoEncontrada from './paginas/NoEncontrada';

// El inicio se entrega de una vez; las demás páginas se descargan al abrirlas,
// para que el celular del paciente no baje también el panel de la farmacia o el kiosco.
const PanelFarmacia = lazy(() => import('./components/farmacia/PanelFarmacia'));
const VistaPaciente = lazy(() => import('./components/paciente/VistaPaciente'));
const PantallaPublica = lazy(() => import('./components/pantalla/PantallaPublica'));
const Registro = lazy(() => import('./paginas/Registro'));
const MiCuenta = lazy(() => import('./paginas/MiCuenta'));
const ConfirmarCorreo = lazy(() => import('./paginas/ConfirmarCorreo'));
const RestablecerClave = lazy(() => import('./paginas/RestablecerClave'));
const Informacion = lazy(() => import('./paginas/Informacion'));
const Kiosco = lazy(() => import('./paginas/Kiosco'));
const TurnoManual = lazy(() => import('./paginas/TurnoManual'));

// Cada módulo es una página independiente con su propia dirección
export default function App() {
  const { pathname } = useLocation();
  return (
    // Si una pantalla falla, se ve un aviso (no una página en blanco); al cambiar de dirección se reintenta
    <LimiteError ruta={pathname}>
    {/* Las sesiones (empleado y paciente) son de todo el sitio: se inician desde el encabezado público */}
    <ContenidoProvider>
    <SesionProvider>
    <CuentaProvider>
    <Suspense fallback={<div className="min-h-screen bg-slate-100" aria-busy="true" />}>
    <Routes>
      <Route path="/" element={<Inicio />} />
      <Route path="/paciente" element={<PaginaPaciente />} />
      <Route path="/registro" element={<Registro />} />
      <Route path="/mi-cuenta" element={<MiCuenta />} />
      <Route path="/confirmar-correo" element={<ConfirmarCorreo />} />
      <Route path="/restablecer-clave" element={<RestablecerClave />} />
      <Route
        path="/farmacia/*"
        element={<PanelFarmacia />}
      />
      <Route path="/pantalla" element={<PantallaPublica />} />
      <Route path="/kiosco" element={<Kiosco />} />
      <Route path="/turno-manual" element={<TurnoManual />} />
      <Route path="/informacion" element={<Informacion />} />
      <Route path="/salud-al-dia" element={<SaludAlDia />} />
      <Route path="/salud-al-dia/:slug" element={<SaludAlDia />} />
      {/* El sistema de la IPS es otra aplicación (ips/index.html): no se enlaza desde el sitio */}
      <Route path="/ips" element={<IrA destino="/ips/" />} />
      <Route path="*" element={<NoEncontrada />} />
    </Routes>
    </Suspense>
    </CuentaProvider>
    </SesionProvider>
    </ContenidoProvider>
    </LimiteError>
  );
}

// /paciente?codigo=F-2026-0001&documento=1090123456 llena el formulario
function PaginaPaciente() {
  const [params] = useSearchParams();
  const codigo = params.get('codigo') ?? '';
  const documento = params.get('documento') ?? '';
  return <VistaPaciente key={`${codigo}|${documento}`} codigoInicial={codigo} documentoInicial={documento} />;
}

// Carga completa del navegador hacia otra aplicación
function IrA({ destino }) {
  useEffect(() => {
    window.location.replace(destino);
  }, [destino]);
  return null;
}
