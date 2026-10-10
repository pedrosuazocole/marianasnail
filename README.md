# Mariana Nails — Academia digital

Plataforma funcional de aprendizaje con inicio de sesión, cuentas de estudiantes, progreso individual persistente, administración de usuarios, 12 módulos, evaluaciones, videos externos, Lean Canvas, marketing, inventario y calculadora.

## Requisitos
- Node.js 22.5 o superior (usa la base de datos SQLite integrada de Node; no requiere `npm install`).

## Primer inicio (Windows PowerShell)

```powershell
cd mariana-nails
$env:ADMIN_USER="mariana"
$env:ADMIN_PASSWORD="CambiaEstaClavePorUnaMuySegura2026!"
npm start
```

En Linux o macOS:

```bash
cd mariana-nails
ADMIN_USER=mariana ADMIN_PASSWORD='CambiaEstaClavePorUnaMuySegura2026!' npm start
```

Abre `http://localhost:3000` en tu navegador. En el primer inicio se crea la cuenta de administradora. **Cambia el ejemplo de contraseña antes de arrancar** y luego puedes cambiarla dentro de «Mi cuenta». En siguientes arranques la cuenta se mantiene en `data/academy.sqlite`; las variables iniciales no restablecen su contraseña.

## Funciones
- Entrar y cerrar sesión; cookies HttpOnly, SameSite, sesiones de 7 días.
- Hash scrypt para contraseñas y límite de intentos fallidos.
- Administradora: crear estudiantes/admins, activar/desactivar y restablecer contraseña.
- Cada estudiante ve y guarda sus notas, evaluación y progreso de módulos.
- 12 módulos con teoría, prácticas, materiales y enlaces a videos / búsquedas de YouTube.
- Lean Canvas, recomendaciones comerciales, precios orientativos y calculadora.
- Lista de materiales guardada solo en el navegador local del dispositivo.

## Publicar en Internet
El proyecto es una aplicación Node.js, **no** sirve como sitio estático en Netlify sin backend. Necesita hosting de Node.js y un disco persistente montado en `DATA_DIR`, más HTTPS. En Railway, Render u otro servicio compatible configura `ADMIN_USER`, `ADMIN_PASSWORD`, `COOKIE_SECURE=true` y `DATA_DIR` apuntando al volumen persistente. Comprueba que el dominio use HTTPS antes de introducir claves. **No publiques el archivo SQLite ni la carpeta `data/`.**

Para uso real en producción se recomienda añadir copias de seguridad cifradas de la base de datos, recuperación de cuentas verificada, registro de auditoría y políticas de privacidad. No se incluyen pagos, entrega de certificación oficial ni videos alojados localmente.

## Seguridad y formación
Este programa no equivale a acreditación oficial. No realizar servicios en uñas con lesiones o sospecha de infección; seguir etiquetas/fichas de seguridad y buscar formación presencial supervisada para técnicas de mayor riesgo. Evitar el contacto de gel sin curar con la piel y utilizar curado compatible con el fabricante.
