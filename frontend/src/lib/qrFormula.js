// Código QR de la fórmula médica.
// Lleva el enlace a la consulta del paciente con el código y el documento:
//   https://<sitio>/paciente?codigo=F-2026-0054&documento=1090123456
// - Con la cámara del celular abre Mediconnect con la fórmula ya consultada.
// - En la pantalla de la entrada (tableta) se lee con la cámara y saca el turno sin escribir la cédula.
// Solo trae lo que ya está impreso en la misma hoja (código y documento).

const CODIGO = /^F-\d{4}-\d{4,6}$/;
const DOCUMENTO = /^\d{5,20}$/;

export function enlaceFormula(codigo, documento, origen = window.location.origin) {
  const url = new URL('/paciente', origen);
  url.searchParams.set('codigo', codigo);
  url.searchParams.set('documento', documento);
  return url.href;
}

// Lee el texto de un QR y devuelve { codigo, documento } si es de una fórmula de Mediconnect; si no, null.
// No importa el dominio (el QR pudo imprimirse con otra dirección del sitio), solo la ruta y los datos.
export function leerEnlaceFormula(texto) {
  let url;
  try {
    url = new URL(String(texto).trim());
  } catch {
    return null;
  }
  if (!url.pathname.replace(/\/+$/, '').endsWith('/paciente')) return null;
  const codigo = (url.searchParams.get('codigo') ?? '').trim().toUpperCase();
  const documento = (url.searchParams.get('documento') ?? '').trim();
  return CODIGO.test(codigo) && DOCUMENTO.test(documento) ? { codigo, documento } : null;
}
