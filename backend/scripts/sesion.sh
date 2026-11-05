# Uso: source scripts/sesion.sh   (desde la carpeta backend)
API=http://localhost:3000/api
CLAVE_ADMIN=$(grep ^ADMIN_CLAVE .env | cut -d= -f2)
TOKEN_EMP=$(curl -s -X POST $API/auth/login \
  -H "Content-Type: application/json" \
  -d "$(jq -n --arg c "$CLAVE_ADMIN" '{usuario: "admin", clave: $c}')" | jq -r .token)
H="Authorization: Bearer $TOKEN_EMP"
id_de() { curl -s $API/fila -H "$H" | jq -r --arg n "$1" '.fila[] | select(.numero == $n) | .id'; }

# Comprobación
if [ "$TOKEN_EMP" = "null" ] || [ -z "$TOKEN_EMP" ]; then
  echo "No se pudo iniciar sesión. ¿Está corriendo el servidor?"
else
  echo "Sesión lista como: $(curl -s $API/auth/yo -H "$H" | jq -r .usuario.usuario)"
fi
