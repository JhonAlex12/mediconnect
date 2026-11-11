// Sesión de la pantalla de turnos de la entrada. Va aparte de la del empleado:
// solo sirve para sacar turnos y registrar llegadas, nunca para entrar al panel.
const CLAVE = 'mediconect_token_pantalla_turnos';

export function leerTokenKiosco() {
  try {
    return localStorage.getItem(CLAVE);
  } catch {
    return null;
  }
}

export function guardarTokenKiosco(token) {
  try {
    if (token) localStorage.setItem(CLAVE, token);
    else localStorage.removeItem(CLAVE);
  } catch {
    // Sin almacenamiento la pantalla no puede quedar activada
  }
}
