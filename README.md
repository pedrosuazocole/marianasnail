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

## Actualización 1.1 — Videos, marca y certificados (10 octubre 2026)

- El logo **original editable en SVG** está en `public/logo.svg` y se incorpora al login, menú y certificados.
- Los doce módulos cuentan con reproductor YouTube integrado (`youtube-nocookie.com`). Los recursos externos pueden repetirse cuando ilustran técnicas presentes en varios módulos; **no son doce grabaciones originales ni sustituirán demostración supervisada**. Las referencias y títulos se editan en `course.js`, arreglo `videoLibrary` (IDs de YouTube). Es posible que el propietario del video bloquee su incrustación; se incluye enlace alternativo a YouTube.
- Nueva pestaña **Certificados**: formulario de nombre completo, DNI, WhatsApp, dirección y consentimiento; emisión de constancia por módulo al completar práctica y autoevaluación con nota >=80 y constancia final al aprobar los 12. Puede imprimirse/guardarse como PDF desde el navegador.
- Verificación pública a través de `/api/verify?code=MN-...` solo publica nombre, tema, código y fecha. Jamás DNI, teléfono ni dirección. Los datos se guardan en SQLite y deben tratarse como información personal protegida con política de privacidad, acceso limitado y respaldos seguros.
- Estos certificados son **constancias de formación independiente**, no títulos oficiales. La marca incluida es ilustración vectorial original del proyecto.

### Actualizar una instalación existente en Railway

1. Antes del despliegue **realiza copia de seguridad** del volumen que contiene `academy.sqlite` y, si existen, `academy.sqlite-wal` y `academy.sqlite-shm` con la aplicación detenida o usando el método de backup de SQLite.
2. Actualiza los archivos del repositorio **sin borrar el volumen** persistente usado en `DATA_DIR`.
3. Comprueba que el volumen de Railway esté montado en la ruta configurada (`DATA_DIR=/app/data`, por ejemplo).
4. Railway redesplegará al hacer push al repositorio enlazado; revisa los registros del servicio, abre la web con HTTPS, inicia sesión y comprueba `Certificados` y los videos.
5. Asegura la privacidad y la política de retención antes de pedir el DNI y dirección a estudiantes reales. Usa contraseñas seguras y restringe acceso a los respaldos.

**Esta distribución no puede modificar automáticamente tu servicio Railway ni hacer el push a tu cuenta**: debes reemplazar los archivos del repo conectado y redesplegar. No introduzcas tu contraseña personal ni credenciales reales en el ZIP.


## Corrección 1.2.1: videos y encabezado
- El video de cada módulo ahora está en una tarjeta completa, con iframe de YouTube visible dentro de la clase. YouTube puede bloquear algunos videos externos; en ese caso hay enlace alternativo.
- Corregido el encabezado lateral: ya no se duplica el nombre de la academia junto al logo.
- Indicador `v1.2.1` en barra superior, y rutas de CSS/JS con versión para evitar archivos anteriores almacenados en el navegador.
- Para desplegar, sube **el contenido interior** de esta carpeta a la raíz del repositorio conectado a Railway (no subas únicamente el ZIP). Haz commit/push, verifica que Railway muestre Deployment Success y comprueba la insignia v1.2.1 en el encabezado. Si no se ve, sigue publicada la versión anterior.
- No borres el volumen SQLite ni sustituyas la base de datos. Crea un respaldo previo.
- Por seguridad, cambia la contraseña compartida en la conversación; no se guardó ninguna contraseña en este paquete.


## Novedades 1.4.0
Mi Negocio: Lean Canvas editable, simulador de costos, rentabilidad y equilibrio, protocolo, checklist y exportación JSON. Marketing Digital: cinco estrategias, calendario de 4 semanas, textos copiables y medidor de campañas. Las configuraciones se guardan solo en el navegador por usuario: utiliza el botón de exportación para conservar una copia. El despliegue no requiere nuevas variables ni migraciones.


## v1.5.0: prueba de 5 días
Las cuentas nuevas creadas con “Probar gratis” tienen 120 horas de acceso a una lección de muestra. El resto se desbloquea tras confirmar el pago y activar el registro en `enrollments`. Para las cuentas existentes se conserva el acceso completo, por lo que es importante revisar las cuentas anteriores antes de cobrar. El endpoint administrativo autenticado `POST /api/admin/enrollment` recibe `{user_id, status:"active"}` para activar después de verificar un pago; todavía requiere interfaz de administración. No es un sistema automático de facturación.


## Landing comercial v1.6.0
- `/` landing pública.
- `/app` área privada (usuarios anteriores conservados).
- `/app?registro=1` abre el registro de prueba por 5 días.
- La promoción L 300 × 3 mensualidades y primeros 100 cupos está descrita en la landing pero **el sistema no cobra ni aplica cupos automáticamente**. La administradora debe registrar pagos confirmados en su propia contabilidad y aprobar la matrícula en Usuarios. No publiques datos bancarios en el código.
- Para mostrar WhatsApp real, necesitarás aportar número empresarial y políticas de respuesta; se omite cualquier teléfono inventado.
- Testimonios ficticios no incluidos. Agregar solo reseñas reales consentidas.

## WhatsApp comercial (v1.6.1)
Landing conectada con WhatsApp Business: +504 9484 2151. Enlace: https://wa.me/50494842151. Se añadieron CTA, icono flotante, navegación, footer y preguntas frecuentes. Para cambiar el número busca 50494842151 en public/index.html.
