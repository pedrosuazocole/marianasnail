'use strict';
const http=require('node:http'),fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const {DatabaseSync}=require('node:sqlite');
const {modules,canvas,strategies}=require('./course');
const PORT=Number(process.env.PORT||3000), HOST=process.env.HOST||'0.0.0.0';
const DATA_DIR=process.env.DATA_DIR||path.join(__dirname,'data');fs.mkdirSync(DATA_DIR,{recursive:true});
const db=new DatabaseSync(path.join(DATA_DIR,'academy.sqlite'));
db.exec(`PRAGMA journal_mode=WAL;CREATE TABLE IF NOT EXISTS users(id INTEGER PRIMARY KEY, username TEXT NOT NULL UNIQUE COLLATE NOCASE, name TEXT NOT NULL, passhash TEXT NOT NULL, role TEXT NOT NULL CHECK(role IN ('admin','student')), active INTEGER NOT NULL DEFAULT 1, created_at TEXT DEFAULT CURRENT_TIMESTAMP);CREATE TABLE IF NOT EXISTS sessions(tokenhash TEXT PRIMARY KEY,user_id INTEGER NOT NULL,csrf TEXT NOT NULL, expires INTEGER NOT NULL);CREATE TABLE IF NOT EXISTS progress(user_id INTEGER NOT NULL,module_id INTEGER NOT NULL,completed INTEGER NOT NULL DEFAULT 0,score INTEGER,notes TEXT DEFAULT '',updated_at TEXT DEFAULT CURRENT_TIMESTAMP,PRIMARY KEY(user_id,module_id));`);
const hashPass=p=>{const salt=crypto.randomBytes(16).toString('hex');return salt+':'+crypto.scryptSync(p,salt,64).toString('hex')};
const checkPass=(p,stored)=>{try{const [salt,hash]=stored.split(':');return crypto.timingSafeEqual(crypto.scryptSync(p,salt,64),Buffer.from(hash,'hex'))}catch{return false}};
const sha=s=>crypto.createHash('sha256').update(s).digest('hex');
const rand=()=>crypto.randomBytes(32).toString('hex');
if(db.prepare('SELECT COUNT(*) n FROM users').get().n===0){
 const u=process.env.ADMIN_USER,p=process.env.ADMIN_PASSWORD;
 if(u && p && /^[a-z0-9_.-]{3,32}$/i.test(u) && p.length>=12){db.prepare('INSERT INTO users(username,name,passhash,role) VALUES(?,?,?,?)').run(u,'Mariana - Administradora',hashPass(p),'admin');console.log('Cuenta administradora creada:',u)}
 else console.log('CONFIGURACIÓN INICIAL: define ADMIN_USER y ADMIN_PASSWORD (mínimo 12 caracteres) y reinicia el servidor.');
}
db.exec(`CREATE TABLE IF NOT EXISTS certificate_profiles(user_id INTEGER PRIMARY KEY,full_name TEXT NOT NULL,dni TEXT NOT NULL,whatsapp TEXT NOT NULL,address TEXT NOT NULL,consent_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);CREATE TABLE IF NOT EXISTS certificates(code TEXT PRIMARY KEY,user_id INTEGER NOT NULL,module_id INTEGER NOT NULL,issued_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,UNIQUE(user_id,module_id));`);
// Trial migration: existing students remain enrolled. New public sign-ups get five days of sample access.
db.exec(`CREATE TABLE IF NOT EXISTS enrollments(user_id INTEGER PRIMARY KEY, status TEXT NOT NULL DEFAULT 'active', trial_started_at INTEGER, trial_expires_at INTEGER, approved_at INTEGER);`);
function accessState(u){if(u.role==='admin')return {kind:'full',trialDays:5};const e=db.prepare('SELECT * FROM enrollments WHERE user_id=?').get(u.id);if(!e)return {kind:'full',trialDays:5};if(e.status==='active')return {kind:'full',trialDays:5};if(e.status==='trial'&&e.trial_expires_at>Date.now())return {kind:'trial',trialDays:5,expiresAt:e.trial_expires_at};return {kind:'expired',trialDays:5};}
// Videoteca administrable. Tabla independiente: preserva estudiantes, certificados y avances.
db.exec(`CREATE TABLE IF NOT EXISTS demonstration_videos(module_id INTEGER NOT NULL,lesson_id INTEGER NOT NULL,youtube_id TEXT NOT NULL UNIQUE,title TEXT NOT NULL,review_status TEXT NOT NULL DEFAULT 'pending' CHECK(review_status IN ('pending','reviewed')),updated_at TEXT DEFAULT CURRENT_TIMESTAMP,PRIMARY KEY(module_id,lesson_id));`);
// Conserva cuatro tutoriales identificados en versiones anteriores. Estado pendiente hasta revisión humana.
if(db.prepare('SELECT COUNT(*) n FROM demonstration_videos').get().n===0){
 const legacy=[[4,2,'_e3jRP3PPwo','Aplicación de esmalte semipermanente — Art and Beauty Vicky'],[5,2,'j6kvI9v4_JY','Nivelación rubber base — Dan’s Nails Official'],[5,3,'7Dib3879JGw','Nivelación de uñas convexas — Lucy Studio'],[6,2,'TM47PFMaqdE','Perlas acrílicas — Young Nails en Español']];
 const add=db.prepare('INSERT OR IGNORE INTO demonstration_videos(module_id,lesson_id,youtube_id,title,review_status) VALUES(?,?,?,?,?)');for(const v of legacy)add.run(...v,'pending');
}
// Enlaces identificados en fuentes públicas. Solo insertar en casillas vacías; nunca sobrescribir decisiones del administrador.
// Estado pendiente: no se ha confirmado reproducción embebida ni revisado exhaustivamente el procedimiento.
const curatedCandidates = [
 [3,1,'YgiwvMPtFWo','Manicura tradicional paso a paso — Dianna Pizarro'],
 [6,1,'BH4MpUJfYNc','Fundamentos de aplicación acrílica para principiantes — Young Nails en Español'],
 [9,3,'XjSHADy9W9o','Retirada de uñas acrílicas — Melisa Rocha'],
 [10,2,'Mp_X5-rDQ3Y','Diseño francés con sello — Decora8 Nail'],
 [2,1,'7SXdTRBr9IU','Tipos de limas para uñas y sus gramajes — Lis Star Nails'],
 [9,1,'-4vk8P-4pvg','Relleno de uñas acrílicas paso a paso — Nancy Guzman'],
 [10,3,'rRrAPtElgWg','Nail art Baby Boomer paso a paso — Thuya Professional Line'],
 [1,2,'_xXux_YtBJM','Limpieza previa del instrumental — Mely Orozco Sánchez'],
 [2,2,'D6DF-t313Ig','Preparación de uña natural — JMNail'],
 [7,3,'hAb6QlYo3E8','Glitter encapsulado en extensiones con tip — NailsByKaren'],
 [5,1,'vCsFGS2Nuwo','Introducción a Rubber Base y Builder Gel — Dan’s Nails Official'],
 [7,1,'jc7rU8v32tc','Aplicación de uñas acrílicas para principiantes — Yudianela'],
 [7,2,'R2bXfFsP8M4','Aplicación de uñas acrílicas paso a paso — Bowser Malo'],
 [ 1,1,'_KCFwvLcZvs','Anatomía de la uña — Alondra Nails 4' ],
 [ 2,3,'g2uxGiz6dC8','Uso del torno y fresas — Polina Asmetkina (revisar corrección indicada por autora)' ],
 [ 8,2,'pqUo7VN9Gwo','Limado y revisión de estructura acrílica — Arla Nails Beauty' ],
 [ 8,3,'g0bAdCJFBU0','Perfeccionamiento del limado acrílico — Nails By Val' ],
 [4,3,'W7-PSrb4noM','Retirada de esmalte semipermanente para principiantes — JakelinBeauty Nails'],
 [10,1,'T76T8jp9B-c','Nail art básico: líneas, puntos y flores — Nail Art By Andy'],
 [3,2,'OFK-3QF0eCs','Manicura básica paso a paso: preparación, color y acabado — kittypinky'],
 [3,3,'r2Yy0QUb0Mo','Manicura natural: base, color y top coat — Uñas Cortas y Más'],
 [4,1,'Jc_YkEuVEcY','Lámparas UV/LED para uñas: tipos y diferencias — Melisa Rocha (complemento, verificar compatibilidad con fabricante)'],
 [12,3,'aVb2wcUzSjA','WhatsApp Business: catálogo y respuestas automáticas — Konfío (complemento comercial)']
];
for(const v of curatedCandidates){
 const exists=db.prepare('SELECT 1 FROM demonstration_videos WHERE module_id=? AND lesson_id=?').get(v[0],v[1]);
 if(!exists)db.prepare('INSERT OR IGNORE INTO demonstration_videos(module_id,lesson_id,youtube_id,title,review_status) VALUES(?,?,?,?,?)').run(...v,'pending');
}
function videoId(raw){let v=String(raw||'').trim();if(/^[A-Za-z0-9_-]{11}$/.test(v))return v;try{const u=new URL(v);const h=u.hostname.toLowerCase().replace(/^www\./,'');if(h==='youtu.be')v=u.pathname.split('/')[1]||'';else if(h==='youtube.com'||h==='m.youtube.com'||h==='youtube-nocookie.com')v=u.searchParams.get('v')||(u.pathname.match(/^\/(?:embed|shorts|live)\/([A-Za-z0-9_-]{11})/)||[])[1]||'';else return null;return /^[A-Za-z0-9_-]{11}$/.test(v)?v:null}catch{return null}}
const attempts=new Map();
function send(res,status,obj,headers={}){res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff',...headers});res.end(JSON.stringify(obj))}
function cookies(req){return Object.fromEntries((req.headers.cookie||'').split(';').map(x=>x.trim().split('=').map(decodeURIComponent)).filter(x=>x.length===2))}
function auth(req){const raw=cookies(req).mn_session;if(!raw)return null;const s=db.prepare('SELECT users.id,users.username,users.name,users.role,sessions.csrf FROM sessions JOIN users ON users.id=sessions.user_id WHERE sessions.tokenhash=? AND sessions.expires>? AND users.active=1').get(sha(raw),Date.now());return s||null}
function readBody(req){return new Promise((resolve,reject)=>{let size=0,body='';req.on('data',part=>{size+=part.length;if(size>30000){reject(new Error('Solicitud demasiado grande'));req.destroy();return}body+=part});req.on('end',()=>{try{resolve(JSON.parse(body||'{}'))}catch{reject(new Error('JSON inválido'))}});req.on('error',reject)})}
function validOrigin(req){const origin=req.headers.origin;if(!origin)return true;try{const o=new URL(origin);return o.host===req.headers.host}catch{return false}}
function cookie(req,value,maxAge){const secure=(process.env.COOKIE_SECURE==='true'||req.socket.encrypted)?'; Secure':'';return `mn_session=${value}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAge}${secure}`}
const route=(p,method)=>p===method;
const publicDir=path.join(__dirname,'public');
function staticFile(req,res,url){let rel=url==='/'?'/index.html':url==='/app'||url==='/app/'?'/academy.html':url;let file=path.resolve(publicDir,'.'+rel);if(!file.startsWith(publicDir+path.sep)){res.writeHead(403);res.end();return}const types={'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.js':'text/javascript; charset=utf-8','.svg':'image/svg+xml','.png':'image/png','.ico':'image/x-icon','.mp4':'video/mp4'};try{const stat=fs.statSync(file);if(!stat.isFile())throw 0;res.writeHead(200,{'Content-Type':types[path.extname(file)]||'application/octet-stream','X-Content-Type-Options':'nosniff','Cache-Control':'no-cache, must-revalidate','Content-Security-Policy':"default-src 'self'; img-src 'self' data:; style-src 'self'; script-src 'self'; connect-src 'self'; frame-src https://www.youtube-nocookie.com https://www.youtube.com; frame-ancestors 'none'; base-uri 'self'; form-action 'self'"});fs.createReadStream(file).pipe(res)}catch{res.writeHead(404);res.end('No encontrado')}}
const server=http.createServer(async(req,res)=>{const url=new URL(req.url,'http://localhost');const p=url.pathname,m=req.method;
 try{
 if(p==='/api/verify'&&m==='GET'){
   const code=String(url.searchParams.get('code')||'');
   if(!/^MN-[A-F0-9]{24}$/.test(code))return send(res,400,{valid:false,error:'Código no válido'});
   const c=db.prepare('SELECT c.code,c.module_id,c.issued_at,pr.full_name FROM certificates c JOIN certificate_profiles pr ON pr.user_id=c.user_id WHERE c.code=?').get(code);
   return c?send(res,200,{valid:true,code:c.code,recipient:c.full_name,program:c.module_id===0?'Curso completo de uñas':modules[c.module_id-1].title,issued_at:c.issued_at,type:c.module_id===0?'final':'módulo'}):send(res,404,{valid:false,error:'Certificado no encontrado'});
 }
 if(p.startsWith('/api/') && m!=='GET'  && !validOrigin(req))return send(res,403,{error:'Origen no permitido'});
 if(p==='/api/register'&&m==='POST'){
  const b=await readBody(req),username=String(b.username||'').trim(),name=String(b.name||'').trim(),password=String(b.password||'');
  if(!/^[a-z0-9_.-]{3,32}$/i.test(username)||name.length<3||name.length>80||password.length<12)return send(res,400,{error:'Usuario de 3–32 caracteres, nombre de 3–80 y contraseña de al menos 12 caracteres.'});
  const now=Date.now();try{const result=db.prepare('INSERT INTO users(username,name,passhash,role) VALUES(?,?,?,?)').run(username,name,hashPass(password),'student');db.prepare('INSERT INTO enrollments(user_id,status,trial_started_at,trial_expires_at) VALUES(?,?,?,?)').run(Number(result.lastInsertRowid),'trial',now,now+5*86400000);return send(res,201,{ok:true,message:'Prueba de cinco días creada.'})}catch{return send(res,409,{error:'El usuario ya está registrado.'})}
 }
 if(p==='/api/login'&&m==='POST'){
  const b=await readBody(req),username=String(b.username||'').trim(),pass=String(b.password||'');const ip=req.socket.remoteAddress||'unknown',key=ip+':'+username.toLowerCase();const a=attempts.get(key)||{n:0,until:0};if(a.until>Date.now())return send(res,429,{error:'Demasiados intentos. Prueba dentro de 15 minutos.'});
  const u=db.prepare('SELECT * FROM users WHERE username=? AND active=1').get(username);if(!u||!checkPass(pass,u.passhash)){const n=a.n+1;attempts.set(key,{n,until:n>=6?Date.now()+15*60*1000:0});return send(res,401,{error:'Usuario o contraseña incorrectos.'})}
  attempts.delete(key);const token=rand(),csrf=rand();db.prepare('INSERT INTO sessions(tokenhash,user_id,csrf,expires) VALUES(?,?,?,?)').run(sha(token),u.id,csrf,Date.now()+7*864e5);return send(res,200,{ok:true}, {'Set-Cookie':cookie(req,token,604800)});
 }
 const u=auth(req);
 if(p.startsWith('/videos/')){const access=u?accessState(u):{kind:'none'};const sample=p==='/videos/m01_l01.mp4';if(access.kind!=='full'&&!(access.kind==='trial'&&sample))return send(res,403,{error:'Video disponible únicamente con matrícula activa o en la lección de prueba.'});}
 if(p==='/api/me'&&m==='GET')return u?send(res,200,{user:{...u,access:accessState(u)},modules:modules.map((x,i)=>({id:i+1,title:x.title,tag:x.tag,duration:x.duration,overview:x.overview}))}):send(res,401,{error:'Inicia sesión'});
 if(!u){if(p.startsWith('/api/'))return send(res,401,{error:'Inicia sesión'});return staticFile(req,res,p)}
 if(m!=='GET'&&p.startsWith('/api/')&&req.headers['x-csrf-token']!==u.csrf)return send(res,403,{error:'Sesión de seguridad inválida. Actualiza la página.'});
 if(p==='/api/logout'&&m==='POST'){const c=cookies(req).mn_session;db.prepare('DELETE FROM sessions WHERE tokenhash=?').run(sha(c));return send(res,200,{ok:true},{'Set-Cookie':cookie(req,'',0)})}
 if(p==='/api/admin/videos'&&m==='GET'){
  if(u.role!=='admin')return send(res,403,{error:'Solo administración'});
  return send(res,200,{videos:db.prepare('SELECT module_id,lesson_id,youtube_id,title,review_status,updated_at FROM demonstration_videos ORDER BY module_id,lesson_id').all(),lessons:modules.flatMap((mod,mi)=>mod.lessons.map((lesson,li)=>({module_id:mi+1,module_title:mod.title,lesson_id:li+1,lesson_title:lesson[0]})))});
 }
 if(p==='/api/admin/videos'&&m==='POST'){
  if(u.role!=='admin')return send(res,403,{error:'Solo administración'});
  const b=await readBody(req),moduleId=Number(b.module_id),lessonId=Number(b.lesson_id),id=videoId(b.url),title=String(b.title||'').trim(),status=b.review_status==='reviewed'?'reviewed':'pending';
  if(!Number.isInteger(moduleId)||moduleId<1||moduleId>12||!Number.isInteger(lessonId)||lessonId<1||lessonId>3||!id||title.length<6||title.length>180)return send(res,400,{error:'Verifica módulo, lección, enlace válido de YouTube y título (6 a 180 caracteres).'});
  const duplicate=db.prepare('SELECT module_id,lesson_id FROM demonstration_videos WHERE youtube_id=?').get(id);
  if(duplicate&&(duplicate.module_id!==moduleId||duplicate.lesson_id!==lessonId))return send(res,409,{error:`Video repetido: ya pertenece al módulo ${duplicate.module_id}, lección ${duplicate.lesson_id}.`});
  db.prepare(`INSERT INTO demonstration_videos(module_id,lesson_id,youtube_id,title,review_status) VALUES(?,?,?,?,?) ON CONFLICT(module_id,lesson_id) DO UPDATE SET youtube_id=excluded.youtube_id,title=excluded.title,review_status=excluded.review_status,updated_at=CURRENT_TIMESTAMP`).run(moduleId,lessonId,id,title,status);
  return send(res,200,{ok:true});
 }
 if(p==='/api/admin/videos'&&m==='DELETE'){
  if(u.role!=='admin')return send(res,403,{error:'Solo administración'});
  const b=await readBody(req),moduleId=Number(b.module_id),lessonId=Number(b.lesson_id);
  if(!Number.isInteger(moduleId)||!Number.isInteger(lessonId))return send(res,400,{error:'Lección inválida'});
  db.prepare('DELETE FROM demonstration_videos WHERE module_id=? AND lesson_id=?').run(moduleId,lessonId);return send(res,200,{ok:true});
 }
 if(p==='/api/course'&&m==='GET'){
 const a=accessState(u);const demo=db.prepare('SELECT module_id,lesson_id,youtube_id,title,review_status FROM demonstration_videos').all();const enriched=modules.map((mod,mi)=>({...mod,demonstrations:mod.lessons.map((_,li)=>demo.find(v=>v.module_id===mi+1&&v.lesson_id===li+1)||null)}));const visible=a.kind==='full'?enriched:enriched.map((mod,i)=>i===0&&a.kind==='trial'?{...mod,lessons:mod.lessons.slice(0,1),videos:mod.videos.slice(0,1),demonstrations:mod.demonstrations.slice(0,1),practice:'Lección de demostración para explorar la academia.'}:{...mod,lessons:[],videos:[],practice:'Disponible con matrícula activa.'});return send(res,200,{modules:visible,canvas:a.kind==='full'?canvas:[],strategies:a.kind==='full'?strategies:[],access:a});
 }
 if(p==='/api/progress'&&m==='GET')return send(res,200,{progress:db.prepare('SELECT module_id,completed,score,notes FROM progress WHERE user_id=?').all(u.id)});
 if(p==='/api/progress'&&m==='POST'){
  if(accessState(u).kind!=='full')return send(res,403,{error:'Para guardar evaluaciones y emitir constancias, activa tu matrícula.'});
  const b=await readBody(req),id=Number(b.module_id);if(!Number.isInteger(id)||id<1||id>modules.length)return send(res,400,{error:'Módulo inválido'});
  const completed=b.completed===true?1:0,score=b.score===null||b.score===undefined?null:Number(b.score);if(score!==null&&(!Number.isInteger(score)||score<0||score>100))return send(res,400,{error:'Nota inválida'});
  const notes=String(b.notes||'').slice(0,2000);db.prepare('INSERT INTO progress(user_id,module_id,completed,score,notes) VALUES(?,?,?,?,?) ON CONFLICT(user_id,module_id) DO UPDATE SET completed=excluded.completed,score=excluded.score,notes=excluded.notes,updated_at=CURRENT_TIMESTAMP').run(u.id,id,completed,score,notes);return send(res,200,{ok:true})
 }
 if(p==='/api/certificate/profile'&&m==='GET'){
  const record=db.prepare('SELECT full_name,dni,whatsapp,address FROM certificate_profiles WHERE user_id=?').get(u.id);
  return send(res,200,{profile:record||null});
 }
 if(p==='/api/certificate/profile'&&m==='POST'){
   const b=await readBody(req),full_name=String(b.full_name||'').trim(),dni=String(b.dni||'').trim(),whatsapp=String(b.whatsapp||'').trim(),address=String(b.address||'').trim();
   if(!b.consent)return send(res,400,{error:'Debes aceptar el tratamiento de datos para la emisión'});
   if(full_name.length<5||full_name.length>120||!/^[A-Za-z0-9-]{8,22}$/.test(dni)||!/^[+0-9() -]{8,25}$/.test(whatsapp)||address.length<8||address.length>240)return send(res,400,{error:'Revisa nombre completo, DNI, WhatsApp y dirección'});
   db.prepare(`INSERT INTO certificate_profiles(user_id,full_name,dni,whatsapp,address) VALUES(?,?,?,?,?) ON CONFLICT(user_id) DO UPDATE SET full_name=excluded.full_name,dni=excluded.dni,whatsapp=excluded.whatsapp,address=excluded.address`).run(u.id,full_name,dni,whatsapp,address);
   return send(res,200,{ok:true});
 }
 if(p==='/api/certificates'&&m==='GET')return send(res,200,{certificates:db.prepare('SELECT code,module_id,issued_at FROM certificates WHERE user_id=? ORDER BY module_id').all(u.id),profile:db.prepare('SELECT full_name,dni,whatsapp,address FROM certificate_profiles WHERE user_id=?').get(u.id)||null});
 if(p==='/api/certificates'&&m==='POST'){
   if(accessState(u).kind!=='full')return send(res,403,{error:'La emisión requiere matrícula activa.'});
   const b=await readBody(req),id=Number(b.module_id);
   if(!Number.isInteger(id)||id<0||id>modules.length)return send(res,400,{error:'Módulo inválido'});
   if(!db.prepare('SELECT user_id FROM certificate_profiles WHERE user_id=?').get(u.id))return send(res,400,{error:'Primero completa tus datos de verificación'});
   const completed=db.prepare('SELECT module_id FROM progress WHERE user_id=? AND completed=1 AND score>=80').all(u.id).map(r=>r.module_id);
   if(id===0?completed.length!==modules.length:!completed.includes(id))return send(res,400,{error:'Debes completar el módulo y aprobar su autoevaluación para emitir la constancia'});
   let c=db.prepare('SELECT code FROM certificates WHERE user_id=? AND module_id=?').get(u.id,id);
   if(!c){const code='MN-'+crypto.randomBytes(12).toString('hex').toUpperCase();db.prepare('INSERT INTO certificates(code,user_id,module_id) VALUES(?,?,?)').run(code,u.id,id);c={code}}
   return send(res,200,{ok:true,code:c.code});
 }
 if(p==='/api/certificate/delete-profile'&&m==='POST'){
    if(db.prepare('SELECT COUNT(*) n FROM certificates WHERE user_id=?').get(u.id).n)return send(res,400,{error:'Primero solicita a administración la anulación de tus certificados antes de eliminar los datos de verificación.'});
    db.prepare('DELETE FROM certificate_profiles WHERE user_id=?').run(u.id);return send(res,200,{ok:true});
 }
 if(p==='/api/password'&&m==='POST'){const b=await readBody(req);if(!checkPass(String(b.current||''),db.prepare('SELECT passhash FROM users WHERE id=?').get(u.id).passhash))return send(res,400,{error:'Contraseña actual incorrecta'});if(String(b.next||'').length<12)return send(res,400,{error:'Usa 12 caracteres o más'});db.prepare('UPDATE users SET passhash=? WHERE id=?').run(hashPass(b.next),u.id);db.prepare('DELETE FROM sessions WHERE user_id=? AND csrf<>?').run(u.id,u.csrf);return send(res,200,{ok:true})}
 if(p.startsWith('/api/admin/')){
 if(u.role!=='admin')return send(res,403,{error:'Acceso de administración requerido'});
 if(p==='/api/admin/users'&&m==='GET')return send(res,200,{users:db.prepare("SELECT users.id,username,name,role,active,created_at,COALESCE(enrollments.status,'active') enrollment_status,trial_expires_at FROM users LEFT JOIN enrollments ON enrollments.user_id=users.id ORDER BY users.id").all()});
 if(p==='/api/admin/enrollment'&&m==='POST'){const b=await readBody(req),id=Number(b.user_id),status=String(b.status||'');if(!Number.isInteger(id)||!['active','suspended'].includes(status)||!db.prepare('SELECT id FROM users WHERE id=? AND role=\'student\'').get(id))return send(res,400,{error:'Alumno o estado inválido'});db.prepare('INSERT INTO enrollments(user_id,status,approved_at) VALUES(?,?,?) ON CONFLICT(user_id) DO UPDATE SET status=excluded.status,approved_at=excluded.approved_at').run(id,status,status==='active'?Date.now():null);return send(res,200,{ok:true})}

 if(p==='/api/admin/users'&&m==='POST'){const b=await readBody(req),username=String(b.username||'').trim(),name=String(b.name||'').trim(),password=String(b.password||'');if(!/^[a-z0-9_.-]{3,32}$/i.test(username)||name.length<2||name.length>80||password.length<12)return send(res,400,{error:'Usuario 3–32 caracteres; nombre 2–80; contraseña mínimo 12'});try{db.prepare('INSERT INTO users(username,name,passhash,role) VALUES(?,?,?,?)').run(username,name,hashPass(password),b.role==='admin'?'admin':'student');return send(res,200,{ok:true})}catch{return send(res,409,{error:'Ese usuario ya existe'})}}
 const mat=p.match(/^\/api\/admin\/users\/(\d+)$/);if(mat&&m==='PATCH'){const id=Number(mat[1]),b=await readBody(req);if(id===u.id&&b.active===false)return send(res,400,{error:'No puedes desactivar tu propia cuenta'});const target=db.prepare('SELECT id FROM users WHERE id=?').get(id);if(!target)return send(res,404,{error:'No existe'});if(typeof b.active==='boolean')db.prepare('UPDATE users SET active=? WHERE id=?').run(b.active?1:0,id);if(typeof b.password==='string'&&b.password.length){if(b.password.length<12)return send(res,400,{error:'La contraseña debe tener al menos 12 caracteres'});db.prepare('UPDATE users SET passhash=? WHERE id=?').run(hashPass(b.password),id);db.prepare('DELETE FROM sessions WHERE user_id=?').run(id)}return send(res,200,{ok:true})}
 }
 if(p.startsWith('/api/'))return send(res,404,{error:'Ruta no encontrada'});return staticFile(req,res,p);
 }catch(e){console.error(e);if(!res.headersSent)send(res,500,{error:'No se pudo completar la operación'})}
});
server.listen(PORT,HOST,()=>console.log(`Mariana Nails disponible en http://localhost:${PORT}`));
