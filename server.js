// Статика (с Range для видео) + WebSocket /ws + /config.json. Запуск: npm install && node server.js
const http=require('http'),https=require('https'),fs=require('fs'),path=require('path'),os=require('os');
const {WebSocketServer,WebSocket}=require('ws');const {validate}=require('uuid');
const ROOT=__dirname,PORT=process.env.PORT||3000;
const MIME={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.mp4':'video/mp4','.svg':'image/svg+xml','.json':'application/json'};
const FILES=['index.html','style.css','script.js'],DIRS=['src','assets'];
const allowed=r=>FILES.includes(r)||DIRS.some(d=>r.startsWith(d+path.sep)||r.startsWith(d+'/'));
function serve(req,res){
  const p=decodeURIComponent(new URL(req.url,'http://x').pathname);
  if(p==='/config.json'){res.writeHead(200,{'Content-Type':MIME['.json']});return res.end(JSON.stringify({publicUrl:process.env.PUBLIC_URL||null}))}
  const rel=path.normalize(p).replace(/^[\\/]+/,'');let f=path.join(ROOT,rel);
  if(!rel||!allowed(rel)||!fs.existsSync(f)||fs.statSync(f).isDirectory()){
    if(path.extname(p)){res.writeHead(404);return res.end('404')}
    f=path.join(ROOT,'index.html');}                       // SPA-фолбэк: /pay, /remote/:id ...
  const st=fs.statSync(f),type=MIME[path.extname(f)]||'application/octet-stream',rg=/bytes=(\d*)-(\d*)/.exec(req.headers.range||'');
  if(rg){let s=rg[1]?+rg[1]:0,e=rg[2]?+rg[2]:st.size-1;if(!rg[1]&&rg[2]){s=Math.max(0,st.size-+rg[2]);e=st.size-1}e=Math.min(e,st.size-1);
    if(s>e){res.writeHead(416,{'Content-Range':`bytes */${st.size}`});return res.end()}
    res.writeHead(206,{'Content-Type':type,'Accept-Ranges':'bytes','Content-Range':`bytes ${s}-${e}/${st.size}`,'Content-Length':e-s+1});
    return fs.createReadStream(f,{start:s,end:e}).pipe(res)}
  res.writeHead(200,{'Content-Type':type,'Content-Length':st.size,'Accept-Ranges':'bytes','Cache-Control':'no-cache'});fs.createReadStream(f).pipe(res);
}
const K=path.join(ROOT,'certs/key.pem'),C=path.join(ROOT,'certs/cert.pem');
const secure=fs.existsSync(K)&&fs.existsSync(C)&&process.env.HTTPS!=='0';
const server=secure?https.createServer({key:fs.readFileSync(K),cert:fs.readFileSync(C)},serve):http.createServer(serve);

/* ---- операции in-memory ---- */
const ops=new Map(),subs=new Map(),terminals=new Set();
const sub=(ws,id)=>{if(!subs.has(id))subs.set(id,new Set());subs.get(id).add(ws)};
const tx=(ws,o)=>ws.readyState===WebSocket.OPEN&&ws.send(JSON.stringify(o));
const wss=new WebSocketServer({server,path:'/ws'});
wss.on('connection',ws=>{
  ws.on('close',()=>{terminals.delete(ws);subs.forEach(s=>s.delete(ws))});
  ws.on('message',raw=>{
    let m;try{m=JSON.parse(raw)}catch{return}
    if(m.t==='hello'){if(m.role==='terminal')terminals.add(ws);return}
    const id=m.opId;if(!validate(id))return tx(ws,{t:'error',message:'bad opId'});
    if(m.t==='op:create'){
      const a=Number(m.amount);if(!(a>0&&a<=9999999))return tx(ws,{t:'error',opId:id,message:'bad amount'});
      if(!ops.has(id))ops.set(id,{opId:id,amount:a,method:null,status:'pending',createdAt:Date.now(),paidAt:null});
      sub(ws,id);tx(ws,{t:'op:status',opId:id,op:ops.get(id)});
    }else if(m.t==='op:status'){sub(ws,id);tx(ws,{t:'op:status',opId:id,op:ops.get(id)||null});
    }else if(m.t==='op:paid'){
      const op=ops.get(id);if(!op)return tx(ws,{t:'op:status',opId:id,op:null});
      if(op.status==='pending'){op.status='paid';op.method=m.method==='face'?'face':'qr';op.paidAt=Date.now()}
      new Set([...(subs.get(id)||[]),...terminals,ws]).forEach(c=>tx(c,{t:'op:paid',opId:id,op}));
    }
  });
});
setInterval(()=>{const lim=Date.now()-864e5;ops.forEach((o,id)=>{if(o.createdAt<lim){ops.delete(id);subs.delete(id)}})},36e5);
server.listen(PORT,()=>{const pr=secure?'https':'http';console.log(`Терминал: ${pr}://localhost:${PORT}`);
  Object.values(os.networkInterfaces()).flat().filter(i=>i.family==='IPv4'&&!i.internal).forEach(i=>console.log(`В сети:   ${pr}://${i.address}:${PORT}`));
  if(process.env.PUBLIC_URL)console.log('PUBLIC_URL для QR:',process.env.PUBLIC_URL)});
