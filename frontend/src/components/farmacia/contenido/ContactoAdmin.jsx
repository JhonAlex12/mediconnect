import React, { useEffect, useState } from 'react';
import { Save } from 'lucide-react';
import { api } from '../../../lib/api';
import { useContenido } from '../../../lib/contenido';
import { Aviso, BotonAccion, claseCampo, useAccion } from '../comunes';
import { CampoTexto, Etiqueta } from './comunes';

// Datos de contacto (franja superior, pie de página, PQRS) y punto del mapa de la página principal
export default function ContactoAdmin() {
  const { contacto, cargado, recargar } = useContenido();
  const [c, setC] = useState(null);
  const [coordenadas, setCoordenadas] = useState('');
  const { ocupado, aviso, ejecutar } = useAccion(recargar);

  useEffect(() => {
    if (cargado && !c) {
      setC(contacto);
      setCoordenadas(`${contacto.lat}, ${contacto.lon}`);
    }
  }, [cargado, contacto, c]);

  if (!c) return <p className="text-slate-500">Cargando…</p>;

  const cambiar = (k) => (v) => setC((x) => ({ ...x, [k]: v }));
  // Acepta lo que copia Google Maps: "7.8835, -72.5050"
  const leerCoordenadas = (texto) => {
    setCoordenadas(texto);
    const m = /^\s*(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)\s*$/.exec(texto);
    if (m) setC((x) => ({ ...x, lat: Number(m[1]), lon: Number(m[2]) }));
  };
  const coordenadasValidas = /^\s*-?\d+(\.\d+)?\s*,\s*-?\d+(\.\d+)?\s*$/.test(coordenadas);
  const caja = [c.lon - 0.006, c.lat - 0.004, c.lon + 0.006, c.lat + 0.004].join(',');

  const guardar = (e) => {
    e.preventDefault();
    ejecutar(() => api('/contenido/admin/contacto', { metodo: 'PUT', cuerpo: c }), 'Datos de contacto guardados');
  };

  return (
    <form onSubmit={guardar} className="bg-white rounded-xl border border-slate-300 p-5 space-y-5">
      <p className="text-slate-600">
        Se muestran en la franja superior, el pie de página, la sección de ubicación y la información de PQRS.
      </p>
      <div className="grid sm:grid-cols-2 gap-4">
        <CampoTexto id="co-tel" etiqueta="Teléfono" valor={c.telefono} cambiar={cambiar('telefono')} maxLength={40} required />
        <CampoTexto id="co-correo" etiqueta="Correo" type="email" valor={c.correo} cambiar={cambiar('correo')} maxLength={120} required />
        <CampoTexto id="co-dir" etiqueta="Dirección" valor={c.direccion} cambiar={cambiar('direccion')} maxLength={150} required />
        <CampoTexto id="co-ciudad" etiqueta="Ciudad" valor={c.ciudad} cambiar={cambiar('ciudad')} maxLength={80} required />
        <CampoTexto id="co-horario" etiqueta="Horario" ayuda="ej.: Lun a sáb · 7:00 a. m. – 7:00 p. m." valor={c.horario}
          cambiar={cambiar('horario')} maxLength={120} required />
      </div>
      <div className="grid lg:grid-cols-[1fr_1.4fr] gap-5 items-start">
        <div>
          <Etiqueta htmlFor="co-coord" ayuda="latitud, longitud">Ubicación en el mapa</Etiqueta>
          <input id="co-coord" value={coordenadas} onChange={(e) => leerCoordenadas(e.target.value)} className={claseCampo} placeholder="7.8835, -72.5050" />
          {!coordenadasValidas && <p className="text-sm text-red-700 mt-1">Escribe latitud y longitud separadas por una coma.</p>}
          <p className="text-sm text-slate-500 mt-2">
            En Google Maps, haz clic derecho sobre la farmacia y elige las coordenadas que aparecen arriba: se copian
            solas. Pégalas aquí.
          </p>
        </div>
        <iframe title="Vista previa del mapa" className="w-full h-56 rounded-lg border border-slate-300"
          src={`https://www.openstreetmap.org/export/embed.html?bbox=${caja}&layer=mapnik&marker=${c.lat},${c.lon}`} />
      </div>
      <Aviso aviso={aviso} />
      <BotonAccion type="submit" color="verde" icono={Save} ocupado={ocupado || !coordenadasValidas}>Guardar</BotonAccion>
    </form>
  );
}
