# Mariana Nails Academy 1.8.0 — Videoteca profesional

- Conserva 36 microvideos MP4 originales, uno por lección.
- Panel Administración → Usuarios → Videoteca profesional para administrar tutoriales demostrativos de terceros.
- 36 casillas individuales; la base de datos impide repetir un ID de YouTube.
- Muestra los videos insertados con enlace alternativo para abrir YouTube.
- La etiqueta «Revisado» es manual: debe confirmarse el contenido, la reproducción y los permisos de uso.
- Se recuperan **cuatro enlaces de tutoriales** identificados en versiones anteriores (marcados pendientes de verificación). Los demás 32 espacios quedan pendientes; no se inventan videos.
- Conservar el mismo DATA_DIR y el volumen persistente de Railway; respaldar academy.sqlite antes de actualizar.
- Se crea la tabla demonstration_videos sin alterar tablas preexistentes.
- Importante: los MP4 se sirven estáticamente; evaluar controles de acceso a vídeos antes de expandir matrícula, y validar los recursos externos antes de ofrecerlos comercialmente.
