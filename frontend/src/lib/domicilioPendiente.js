// Domicilio pedido desde la consulta de la fórmula (o el QR) antes de tener la sesión de la cuenta abierta.
// Se guarda el código en este navegador y "Mi cuenta" lo retoma después de ingresar, registrarse
// o confirmar el correo: agrega la fórmula a la cuenta y abre el formulario del domicilio.
const CLAVE = 'mediconect_domicilio_pendiente';
const VIGENCIA_MS = 24 * 60 * 60 * 1000;

export function guardarDomicilioPendiente(codigo) {
  try {
    localStorage.setItem(CLAVE, JSON.stringify({ codigo, en: Date.now() }));
  } catch {
    /* sin almacenamiento: el paciente agrega la fórmula a mano en Mi cuenta */
  }
}

// Devuelve el código y lo borra (se usa una sola vez)
export function tomarDomicilioPendiente() {
  try {
    const guardado = JSON.parse(localStorage.getItem(CLAVE) ?? 'null');
    localStorage.removeItem(CLAVE);
    if (guardado?.codigo && Date.now() - guardado.en < VIGENCIA_MS) return guardado.codigo;
  } catch {
    /* nada pendiente */
  }
  return null;
}
