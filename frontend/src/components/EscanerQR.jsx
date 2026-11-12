import React, { useEffect, useRef, useState } from 'react';
import jsQR from 'jsqr';
import { leerEnlaceFormula } from '../lib/qrFormula';

// Lee el código QR de la fórmula impresa con la cámara de la tableta.
// Usa el lector del navegador (BarcodeDetector, en Chrome de Android) y, si no existe, la librería jsQR.
// Se usa la cámara trasera de la tableta (la imagen no se ve como espejo); si no tiene, la que haya.
// alLeer({ codigo, documento }) · alError('permiso' | 'sin_camara' | 'otro')

const INTERVALO_MS = 180;

export default function EscanerQR({ alLeer, alError }) {
  const video = useRef(null);
  const lienzo = useRef(null);
  const [espejo, setEspejo] = useState(false);
  const [listo, setListo] = useState(false);
  const [noValido, setNoValido] = useState(false);
  const llamadas = useRef({ alLeer, alError });
  llamadas.current = { alLeer, alError };

  useEffect(() => {
    let flujo = null;
    let temporizador = null;
    let detenido = false;
    let ultimoInvalido = 0;

    const detener = () => {
      detenido = true;
      clearTimeout(temporizador);
      flujo?.getTracks().forEach((t) => t.stop());
    };

    const iniciar = async () => {
      if (!navigator.mediaDevices?.getUserMedia) {
        llamadas.current.alError('sin_camara');
        return;
      }
      // Lector del navegador si sabe leer QR
      let detector = null;
      try {
        if ('BarcodeDetector' in window) {
          const formatos = await window.BarcodeDetector.getSupportedFormats();
          if (formatos.includes('qr_code')) detector = new window.BarcodeDetector({ formats: ['qr_code'] });
        }
      } catch {
        detector = null;
      }

      try {
        flujo = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 }, height: { ideal: 720 } },
          audio: false,
        });
      } catch (error) {
        if (detenido) return;
        llamadas.current.alError(error?.name === 'NotAllowedError' || error?.name === 'SecurityError' ? 'permiso'
          : error?.name === 'NotFoundError' || error?.name === 'OverconstrainedError' ? 'sin_camara' : 'otro');
        return;
      }
      if (detenido) { flujo.getTracks().forEach((t) => t.stop()); return; }

      // Solo la cámara frontal se muestra como espejo (si la tableta no tiene trasera)
      setEspejo(flujo.getVideoTracks()[0]?.getSettings?.().facingMode === 'user');
      video.current.srcObject = flujo;
      await video.current.play().catch(() => {});
      setListo(true);

      const leerCuadro = async () => {
        if (detenido) return;
        const v = video.current;
        let texto = null;
        try {
          if (v.readyState >= 2) {
            if (detector) {
              const codigos = await detector.detect(v);
              texto = codigos[0]?.rawValue ?? null;
            } else {
              // Cuadro reducido (máx. 640 px) para que la lectura sea rápida en tabletas sencillas
              const escala = Math.min(1, 640 / v.videoWidth);
              const w = Math.round(v.videoWidth * escala);
              const h = Math.round(v.videoHeight * escala);
              const c = lienzo.current;
              c.width = w;
              c.height = h;
              const ctx = c.getContext('2d', { willReadFrequently: true });
              ctx.drawImage(v, 0, 0, w, h);
              texto = jsQR(ctx.getImageData(0, 0, w, h).data, w, h, { inversionAttempts: 'dontInvert' })?.data ?? null;
            }
          }
        } catch {
          texto = null;
        }

        if (texto) {
          const datos = leerEnlaceFormula(texto);
          if (datos) {
            detener();
            llamadas.current.alLeer(datos);
            return;
          }
          // Un QR que no es de una fórmula de Mediconnect: se avisa un momento y se sigue leyendo
          const ahora = Date.now();
          if (ahora - ultimoInvalido > 2500) {
            ultimoInvalido = ahora;
            setNoValido(true);
            setTimeout(() => setNoValido(false), 2500);
          }
        }
        temporizador = setTimeout(leerCuadro, INTERVALO_MS);
      };
      leerCuadro();
    };

    iniciar();
    return detener;
  }, []);

  return (
    <div className="relative mx-auto w-full max-w-2xl aspect-[4/3] rounded-3xl overflow-hidden bg-marca-noche shadow-xl">
      <video ref={video} playsInline muted
        className="absolute inset-0 w-full h-full object-cover"
        style={{ transform: espejo ? 'scaleX(-1)' : undefined }} />
      <canvas ref={lienzo} className="hidden" />

      {/* Marco guía */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
        <div className="relative w-[52%] aspect-square">
          {['top-0 left-0 border-t-[6px] border-l-[6px] rounded-tl-2xl', 'top-0 right-0 border-t-[6px] border-r-[6px] rounded-tr-2xl',
            'bottom-0 left-0 border-b-[6px] border-l-[6px] rounded-bl-2xl', 'bottom-0 right-0 border-b-[6px] border-r-[6px] rounded-br-2xl']
            .map((c) => <span key={c} className={`absolute w-14 h-14 border-white ${c}`} />)}
          {listo && <span className="absolute left-3 right-3 h-1 bg-white/80 rounded-full shadow-[0_0_14px_rgba(255,255,255,0.9)] animate-[barrido_2.2s_ease-in-out_infinite]" />}
        </div>
      </div>

      {!listo && (
        <p className="absolute inset-0 flex items-center justify-center text-white text-xl font-semibold">Encendiendo la cámara…</p>
      )}
      {noValido && (
        <p className="absolute bottom-5 left-1/2 -translate-x-1/2 bg-white text-marca-noche text-lg font-bold px-5 py-2 rounded-full shadow">
          Ese código no es de una fórmula de Mediconnect
        </p>
      )}
    </div>
  );
}
