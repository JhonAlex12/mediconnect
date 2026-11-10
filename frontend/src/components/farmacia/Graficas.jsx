import React from 'react';

// Gráficas sencillas hechas con HTML (sin librerías). Cada barra muestra su detalle al pasar el mouse o con Tab.

export const COLOR = {
  azul: '#2257c5', // serie principal y valor destacado
  verde: '#14ada2',
  naranja: '#e08a2e',
  gris: '#cbd5e1', // contexto, lo que no se destaca
};

// Máximo "redondo" del eje y su paso (0, 5, 10, 15… / 0, 20.000, 40.000…)
function escala(max) {
  if (max <= 0) return { tope: 1, paso: 1 };
  const bruto = max / 4;
  const potencia = 10 ** Math.floor(Math.log10(bruto));
  const paso = [1, 2, 2.5, 5, 10].map((m) => m * potencia).find((p) => p >= bruto);
  const pasoEntero = Math.max(1, paso);
  return { tope: Math.ceil(max / pasoEntero) * pasoEntero, paso: pasoEntero };
}

const numeroEje = (n) =>
  n >= 1_000_000 ? `${(n / 1_000_000).toLocaleString('es-CO')} M`
    : n >= 10_000 ? `${(n / 1000).toLocaleString('es-CO')} mil`
      : n.toLocaleString('es-CO');

// Recuadro de detalle que aparece sobre la barra (el contenedor debe tener la clase "group")
function Detalle({ lineas, alinear = 'centro', abajo = false }) {
  const pos = alinear === 'izquierda' ? 'left-0' : alinear === 'derecha' ? 'right-0' : 'left-1/2 -translate-x-1/2';
  return (
    <div role="tooltip"
      className={`hidden group-hover:block group-focus:block absolute ${abajo ? 'top-full mt-1' : 'bottom-full mb-2'} ${pos} z-20
        bg-slate-900 text-white text-xs rounded-md px-3 py-2 shadow-lg whitespace-nowrap pointer-events-none`}>
      {lineas.map((l, i) => <p key={i} className={i === 0 ? 'font-bold' : 'text-slate-200'}>{l}</p>)}
    </div>
  );
}

export function Leyenda({ series }) {
  return (
    <ul className="flex flex-wrap gap-x-5 gap-y-1 text-sm text-slate-700">
      {series.map((s) => (
        <li key={s.nombre} className="flex items-center gap-2">
          <span className="w-3 h-3 rounded-sm" style={{ background: s.color }} aria-hidden="true" />
          {s.nombre}
        </li>
      ))}
    </ul>
  );
}

// Barras horizontales ordenadas: una fila por elemento, con el valor en la punta
// filas: [{ etiqueta, valor, texto, detalle: [líneas], color? }]
export function BarrasHorizontales({ filas, color = COLOR.azul, ancho = 'w-48' }) {
  const max = Math.max(...filas.map((f) => f.valor), 0) || 1;
  return (
    <ul className="space-y-2">
      {filas.map((f) => (
        <li key={f.etiqueta} className="flex items-center gap-3">
          <span className={`${ancho} shrink-0 text-sm text-slate-700 truncate text-right`} title={f.etiqueta}>{f.etiqueta}</span>
          <div tabIndex={0} aria-label={f.detalle?.join('. ') ?? `${f.etiqueta}: ${f.texto}`}
            className="group relative flex-1 flex items-center gap-2 py-1 outline-none focus-visible:ring-2 focus-visible:ring-slate-500 rounded">
            <span className="h-5 rounded-r min-w-[2px] transition group-hover:brightness-110"
              style={{ width: `${(f.valor / max) * 85}%`, background: f.color ?? color }} />
            <span className="text-sm font-semibold text-slate-800 tabular-nums whitespace-nowrap">{f.texto}</span>
            {f.detalle && <Detalle lineas={f.detalle} alinear="izquierda" abajo />}
          </div>
        </li>
      ))}
    </ul>
  );
}

// Columnas sobre un mismo eje; cada columna puede tener varios segmentos apilados
// columnas: [{ clave, etiqueta, segmentos: [{ valor, color }], detalle: [líneas], rotulo? }]
export function Columnas({ columnas, alto = 220, formato = numeroEje }) {
  const totales = columnas.map((c) => c.segmentos.reduce((s, x) => s + x.valor, 0));
  const { tope, paso } = escala(Math.max(...totales, 0));
  const marcas = [];
  for (let v = 0; v <= tope; v += paso) marcas.push(v);
  // Con muchas columnas solo se rotulan algunas para que no se encimen
  const cadaCuantas = Math.ceil(columnas.length / 12);
  const n = columnas.length;

  return (
    <div className="flex gap-2 pt-6">
      {/* Eje vertical */}
      <div className="relative shrink-0 w-14 text-xs text-slate-500 tabular-nums" style={{ height: alto }}>
        {marcas.map((v) => (
          <span key={v} className="absolute right-0 translate-y-1/2" style={{ bottom: `${(v / tope) * 100}%` }}>{formato(v)}</span>
        ))}
      </div>

      <div className="flex-1 min-w-0">
        <div className="relative" style={{ height: alto }}>
          {/* Líneas guía */}
          {marcas.map((v) => (
            <div key={v} className={`absolute inset-x-0 h-px ${v === 0 ? 'bg-slate-400' : 'bg-slate-200'}`}
              style={{ bottom: `${(v / tope) * 100}%` }} />
          ))}
          <div className="absolute inset-0 flex">
            {columnas.map((c, i) => {
              const total = totales[i];
              const alinear = i < n * 0.2 ? 'izquierda' : i > n * 0.8 ? 'derecha' : 'centro';
              return (
                <div key={c.clave} tabIndex={0} aria-label={c.detalle.join('. ')}
                  className="group relative flex-1 flex flex-col justify-end items-center outline-none focus-visible:bg-slate-100 hover:bg-slate-50 rounded-t">
                  {/* Segmentos de abajo hacia arriba, separados por 2 px de fondo */}
                  <div className="relative w-[70%] max-w-6 flex flex-col-reverse gap-[2px]" style={{ height: `${(total / tope) * 100}%` }}>
                    {c.rotulo && total > 0 && (
                      <span className="absolute bottom-full mb-1 left-1/2 -translate-x-1/2 text-xs font-bold text-slate-800 tabular-nums whitespace-nowrap">
                        {c.rotulo}
                      </span>
                    )}
                    {c.segmentos.map((s, j) => s.valor > 0 && (
                      <span key={j} className={`block w-full transition group-hover:brightness-110 ${
                        c.segmentos.slice(j + 1).every((x) => !x.valor) ? 'rounded-t' : ''}`}
                        style={{ flexGrow: s.valor, flexBasis: 0, background: s.color }} />
                    ))}
                  </div>
                  <Detalle lineas={c.detalle} alinear={alinear} />
                </div>
              );
            })}
          </div>
        </div>
        {/* Rótulos del eje horizontal */}
        <div className="flex mt-1.5">
          {columnas.map((c, i) => (
            <span key={c.clave} className="flex-1 text-center text-xs text-slate-500 whitespace-nowrap">
              {i % cadaCuantas === 0 ? c.etiqueta : ''}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
