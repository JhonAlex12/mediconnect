import React from 'react';

// Campos de los datos personales del paciente: los usan el registro y "Mis datos"

export const TIPOS_DOCUMENTO = [
  ['CC', 'Cédula de ciudadanía'],
  ['TI', 'Tarjeta de identidad'],
  ['CE', 'Cédula de extranjería'],
  ['PPT', 'Permiso por protección temporal'],
  ['PA', 'Pasaporte'],
  ['RC', 'Registro civil'],
];

export const DATOS_VACIOS = {
  nombres: '', apellidos: '', fecha_nacimiento: '', sexo: '', celular: '', correo: '',
  direccion: '', barrio: '', ciudad: '', eps: '', regimen: '',
};

// Solo los campos editables, con '' en lugar de null (los inputs controlados no aceptan null)
export const datosDesdeCuenta = (c) =>
  Object.fromEntries(Object.keys(DATOS_VACIOS).map((k) => [k, c?.[k] ?? '']));

export const claseInput =
  'w-full border border-slate-300 rounded px-3 py-2.5 text-base bg-white focus:outline-none focus:ring-2 focus:ring-marca-azul focus:border-marca-azul';

export function Campo({ etiqueta, id, opcional, ayuda, children, className = '' }) {
  return (
    <div className={className}>
      <label htmlFor={id} className="block text-sm font-bold text-slate-800 mb-1.5">
        {etiqueta} {opcional && <span className="font-normal text-slate-500">(opcional)</span>}
      </label>
      {children}
      {ayuda && <p className="text-xs text-slate-500 mt-1">{ayuda}</p>}
    </div>
  );
}

export function Seccion({ titulo, children }) {
  return (
    <fieldset className="space-y-4">
      <legend className="font-titulo text-lg font-extrabold text-marca-noche mb-3">{titulo}</legend>
      <div className="grid sm:grid-cols-2 gap-4">{children}</div>
    </fieldset>
  );
}

export default function CamposPersonales({ datos, cambiar }) {
  const input = (campo, props = {}) => (
    <input id={campo} value={datos[campo]} onChange={(e) => cambiar(campo, e.target.value)} className={claseInput} {...props} />
  );
  const hoy = new Date().toISOString().slice(0, 10);

  return (
    <>
      <Seccion titulo="Datos personales">
        <Campo etiqueta="Nombres" id="nombres">{input('nombres', { autoComplete: 'given-name', required: true })}</Campo>
        <Campo etiqueta="Apellidos" id="apellidos">{input('apellidos', { autoComplete: 'family-name', required: true })}</Campo>
        <Campo etiqueta="Fecha de nacimiento" id="fecha_nacimiento">
          {input('fecha_nacimiento', { type: 'date', max: hoy, min: '1900-01-01', autoComplete: 'bday', required: true })}
        </Campo>
        <Campo etiqueta="Sexo" id="sexo" opcional>
          <select id="sexo" value={datos.sexo} onChange={(e) => cambiar('sexo', e.target.value)} className={claseInput}>
            <option value="">Prefiero no decirlo</option>
            <option value="F">Femenino</option>
            <option value="M">Masculino</option>
            <option value="O">Otro</option>
          </select>
        </Campo>
      </Seccion>

      <Seccion titulo="Contacto">
        <Campo etiqueta="Celular" id="celular" ayuda="Te llamamos a este número para coordinar el domicilio">
          {input('celular', { type: 'tel', inputMode: 'numeric', autoComplete: 'tel-national', maxLength: 10, placeholder: '3001234567', required: true })}
        </Campo>
        <Campo etiqueta="Correo electrónico" id="correo">
          {input('correo', { type: 'email', autoComplete: 'email', required: true })}
        </Campo>
        <Campo etiqueta="Dirección" id="direccion" className="sm:col-span-2" ayuda="Es la dirección que usaremos por defecto para tus domicilios">
          {input('direccion', { autoComplete: 'street-address', placeholder: 'Calle 10 # 20-30, apto 401', required: true })}
        </Campo>
        <Campo etiqueta="Barrio" id="barrio" opcional>{input('barrio')}</Campo>
        <Campo etiqueta="Ciudad" id="ciudad">{input('ciudad', { autoComplete: 'address-level2', required: true })}</Campo>
      </Seccion>

      <Seccion titulo="Afiliación a salud">
        <Campo etiqueta="EPS" id="eps" opcional>{input('eps', { placeholder: 'Nombre de tu EPS' })}</Campo>
        <Campo etiqueta="Régimen" id="regimen" opcional>
          <select id="regimen" value={datos.regimen} onChange={(e) => cambiar('regimen', e.target.value)} className={claseInput}>
            <option value="">Sin especificar</option>
            <option value="contributivo">Contributivo</option>
            <option value="subsidiado">Subsidiado</option>
          </select>
        </Campo>
      </Seccion>
    </>
  );
}
