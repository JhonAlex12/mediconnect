import React, { useState } from 'react';
import { LogIn } from 'lucide-react';
import { Aviso, Boton, Campo, Entrada } from '../ui';
import { useSesion } from '../../lib/sesion';

export default function LoginEmpleado() {
  const { iniciarSesion } = useSesion();
  const [usuario, setUsuario] = useState('');
  const [clave, setClave] = useState('');
  const [error, setError] = useState('');
  const [enviando, setEnviando] = useState(false);

  const enviar = async (e) => {
    e.preventDefault();
    setError('');
    if (!usuario.trim() || !clave) {
      setError('Ingresa usuario y contraseña');
      return;
    }
    setEnviando(true);
    try {
      await iniciarSesion(usuario.trim(), clave);
    } catch (err) {
      setError(err.message);
      setClave('');
    } finally {
      setEnviando(false);
    }
  };

  return (
    <div className="max-w-sm mx-auto">
      <h1 className="text-2xl font-bold text-tinta">Ingreso de empleados</h1>
      <p className="text-tinta-suave mt-1 mb-6">Panel de la farmacia, para auxiliares y administradores.</p>

      <form onSubmit={enviar} className="space-y-4" noValidate>
        {error && <Aviso tono="error">{error}</Aviso>}

        <Campo id="usuario" etiqueta="Usuario">
          <Entrada
            type="text"
            autoComplete="username"
            autoFocus
            value={usuario}
            onChange={(e) => setUsuario(e.target.value)}
          />
        </Campo>

        <Campo id="clave" etiqueta="Contraseña">
          <Entrada
            type="password"
            autoComplete="current-password"
            value={clave}
            onChange={(e) => setClave(e.target.value)}
          />
        </Campo>

        <Boton type="submit" variante="primario" icono={LogIn} cargando={enviando} ancho>
          {enviando ? 'Ingresando…' : 'Ingresar'}
        </Boton>
      </form>
    </div>
  );
}
