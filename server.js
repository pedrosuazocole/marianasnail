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
const attempts=new Map();
function send(res,status,obj,headers={}){res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff',...headers});res.end(JSON.stringify(obj))}
function cookies(req){return Object.fromEntries((req.headers.cookie||'').split(';').map(x=>x.trim().split('=').map(decodeURIComponent)).filter(x=>x.length===2))}
function auth(req){const raw=cookies(req).mn_session;if(!raw)return null;const s=db.prepare('SELECT users.id,users.username,users.name,users.role,sessions.csrf FROM sessions JOIN users ON users.id=sessions.user_id WHERE sessions.tokenhash=? AND sessions.expires>? AND users.active=1').get(sha(raw),Date.now());return s||null}
function readBody(req){return new Promise((resolve,reject)=>{let size=0,body='';req.on('data',part=>{size+=part.length;if(size>30000){reject(new Error('Solicitud demasiado grande'));req.destroy();return}body+=part});req.on('end',()=>{try{resolve(JSON.parse(body||'{}'))}catch{reject(new Error('JSON inválido'))}});req.on('error',reject)})}
function validOrigin(req){const origin=req.headers.origin;if(!origin)return true;try{const o=new URL(origin);return o.host===req.headers.host}catch{return false}}
function cookie(req,value,maxAge){const secure=(process.env.COOKIE_SECURE==='true'||req.socket.encrypted)?'; Secure':'';return `mn_session=${value}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAge}${secure}`}
const route=(p,method)=>p===method;
const publicDir=path.join(__dirname,'public');
function staticFile(req,res,url){let rel=url==='/'?'/index.html':url;let file=path.resolve(publicDir,'.'+rel);if(!file.startsWith(publicDir+path.sep)){res.writeHead(403);res.end();return}const types={'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.js':'text/javascript; charset=utf-8','.svg':'image/svg+xml','.png':'image/png','.ico':'image/x-icon'};try{const stat=fs.statSync(file);if(!stat.isFile())throw 0;res.writeHead(200,{'Content-Type':types[path.extname(file)]||'application/octet-stream','X-Content-Type-Options':'nosniff','Cache-Control':'public, max-age=3600','Content-Security-Policy':"default-src 'self'; img-src 'self' data:; style-src 'self'; script-src 'self'; connect-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'"});fs.createReadStream(file).pipe(res)}catch{res.writeHead(404);res.end('No encontrado')}}
const server=http.createServer(async(req,res)=>{const url=new URL(req.url,'http://localhost');const p=url.pathname,m=req.method;
 try{
 if(p.startsWith('/api/') && m!=='GET' && !validOrigin(req))return send(res,403,{error:'Origen no permitido'});
 if(p==='/api/login'&&m==='POST'){
  const b=await readBody(req),username=String(b.username||'').trim(),pass=String(b.password||'');const ip=req.socket.remoteAddress||'unknown',key=ip+':'+username.toLowerCase();const a=attempts.get(key)||{n:0,until:0};if(a.until>Date.now())return send(res,429,{error:'Demasiados intentos. Prueba dentro de 15 minutos.'});
  const u=db.prepare('SELECT * FROM users WHERE username=? AND active=1').get(username);if(!u||!checkPass(pass,u.passhash)){const n=a.n+1;attempts.set(key,{n,until:n>=6?Date.now()+15*60*1000:0});return send(res,401,{error:'Usuario o contraseña incorrectos.'})}
  attempts.delete(key);const token=rand(),csrf=rand();db.prepare('INSERT INTO sessions(tokenhash,user_id,csrf,expires) VALUES(?,?,?,?)').run(sha(token),u.id,csrf,Date.now()+7*864e5);return send(res,200,{ok:true}, {'Set-Cookie':cookie(req,token,604800)});
 }
 const u=auth(req);if(p==='/api/me'&&m==='GET')return u?send(res,200,{user:u,modules:modules.map((x,i)=>({id:i+1,title:x.title,tag:x.tag,duration:x.duration,overview:x.overview}))}):send(res,401,{error:'Inicia sesión'});
 if(!u){if(p.startsWith('/api/'))return send(res,401,{error:'Inicia sesión'});return staticFile(req,res,p)}
 if(m!=='GET'&&p.startsWith('/api/')&&req.headers['x-csrf-token']!==u.csrf)return send(res,403,{error:'Sesión de seguridad inválida. Actualiza la página.'});
 if(p==='/api/logout'&&m==='POST'){const c=cookies(req).mn_session;db.prepare('DELETE FROM sessions WHERE tokenhash=?').run(sha(c));return send(res,200,{ok:true},{'Set-Cookie':cookie(req,'',0)})}
 if(p==='/api/course'&&m==='GET')return send(res,200,{modules,canvas,strategies});
 if(p==='/api/progress'&&m==='GET')return send(res,200,{progress:db.prepare('SELECT module_id,completed,score,notes FROM progress WHERE user_id=?').all(u.id)});
 if(p==='/api/progress'&&m==='POST'){
  const b=await readBody(req),id=Number(b.module_id);if(!Number.isInteger(id)||id<1||id>modules.length)return send(res,400,{error:'Módulo inválido'});
  const completed=b.completed===true?1:0,score=b.score===null||b.score===undefined?null:Number(b.score);if(score!==null&&(!Number.isInteger(score)||score<0||score>100))return send(res,400,{error:'Nota inválida'});
  const notes=String(b.notes||'').slice(0,2000);db.prepare('INSERT INTO progress(user_id,module_id,completed,score,notes) VALUES(?,?,?,?,?) ON CONFLICT(user_id,module_id) DO UPDATE SET completed=excluded.completed,score=excluded.score,notes=excluded.notes,updated_at=CURRENT_TIMESTAMP').run(u.id,id,completed,score,notes);return send(res,200,{ok:true})
 }
 if(p==='/api/password'&&m==='POST'){const b=await readBody(req);if(!checkPass(String(b.current||''),db.prepare('SELECT passhash FROM users WHERE id=?').get(u.id).passhash))return send(res,400,{error:'Contraseña actual incorrecta'});if(String(b.next||'').length<12)return send(res,400,{error:'Usa 12 caracteres o más'});db.prepare('UPDATE users SET passhash=? WHERE id=?').run(hashPass(b.next),u.id);db.prepare('DELETE FROM sessions WHERE user_id=? AND csrf<>?').run(u.id,u.csrf);return send(res,200,{ok:true})}
 if(p.startsWith('/api/admin/')){
 if(u.role!=='admin')return send(res,403,{error:'Acceso de administración requerido'});
 if(p==='/api/admin/users'&&m==='GET')return send(res,200,{users:db.prepare('SELECT id,username,name,role,active,created_at FROM users ORDER BY id').all()});
 if(p==='/api/admin/users'&&m==='POST'){const b=await readBody(req),username=String(b.username||'').trim(),name=String(b.name||'').trim(),password=String(b.password||'');if(!/^[a-z0-9_.-]{3,32}$/i.test(username)||name.length<2||name.length>80||password.length<12)return send(res,400,{error:'Usuario 3–32 caracteres; nombre 2–80; contraseña mínimo 12'});try{db.prepare('INSERT INTO users(username,name,passhash,role) VALUES(?,?,?,?)').run(username,name,hashPass(password),b.role==='admin'?'admin':'student');return send(res,200,{ok:true})}catch{return send(res,409,{error:'Ese usuario ya existe'})}}
 const mat=p.match(/^\/api\/admin\/users\/(\d+)$/);if(mat&&m==='PATCH'){const id=Number(mat[1]),b=await readBody(req);if(id===u.id&&b.active===false)return send(res,400,{error:'No puedes desactivar tu propia cuenta'});const target=db.prepare('SELECT id FROM users WHERE id=?').get(id);if(!target)return send(res,404,{error:'No existe'});if(typeof b.active==='boolean')db.prepare('UPDATE users SET active=? WHERE id=?').run(b.active?1:0,id);if(typeof b.password==='string'&&b.password.length){if(b.password.length<12)return send(res,400,{error:'La contraseña debe tener al menos 12 caracteres'});db.prepare('UPDATE users SET passhash=? WHERE id=?').run(hashPass(b.password),id);db.prepare('DELETE FROM sessions WHERE user_id=?').run(id)}return send(res,200,{ok:true})}
 }
 if(p.startsWith('/api/'))return send(res,404,{error:'Ruta no encontrada'});return staticFile(req,res,p);
 }catch(e){console.error(e);if(!res.headersSent)send(res,500,{error:'No se pudo completar la operación'})}
});
server.listen(PORT,HOST,()=>console.log(`Mariana Nails disponible en http://localhost:${PORT}`));
