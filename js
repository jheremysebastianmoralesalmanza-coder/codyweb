// ─── STORAGE ───
const DB_KEY  = 'codyweb_reg_v2';
const STU_KEY = 'codyweb_stu_v2';
const SES_KEY = 'codyweb_ses_v2';
function getDB()    { try{return JSON.parse(localStorage.getItem(DB_KEY)||'[]')}catch{return[]} }
function saveDB(d)  { localStorage.setItem(DB_KEY, JSON.stringify(d)) }
function getStus()  { try{return JSON.parse(localStorage.getItem(STU_KEY)||'[]')}catch{return[]} }
function saveStus(s){ localStorage.setItem(STU_KEY, JSON.stringify(s)) }
function getSes()   { try{return JSON.parse(localStorage.getItem(SES_KEY)||'{}')}catch{return{}} }
function saveSes(s) { localStorage.setItem(SES_KEY, JSON.stringify(s)) }

// ─── STATE ───
let qrTimer=null, scanStream=null, scanInterval=null;
let selectedStu=null, pendingCode=null;
let excelData=null, excelHeaders=null;

// ─── UTILS ───
function soloNumeros(el){ el.value=el.value.replace(/[^0-9]/g,'') }
function soloLetras(el) { el.value=el.value.replace(/[^a-zA-ZáéíóúÁÉÍÓÚñÑ\s\.]/g,'') }
function mkCode(){ return 'CODY-'+Math.random().toString(36).substr(2,6).toUpperCase() }
function hoy(){ return new Date().toISOString().split('T')[0] }
function ahora(){ return new Date().toTimeString().slice(0,5) }
function initials(name){ return name.trim().charAt(0).toUpperCase() }

// ─── NAV ───
function gp(p){
  document.querySelectorAll('.page').forEach(x=>x.classList.remove('active'));
  document.querySelectorAll('.ntab').forEach(x=>x.classList.remove('active'));
  document.getElementById('page-'+p).classList.add('active');
  const nb=document.getElementById('ntab-'+p); if(nb) nb.classList.add('active');
  if(p==='home')        updHome();
  if(p==='registros')   renderTabla();
  if(p==='estudiantes') renderStudents();
  if(p==='qr')          { renderQRStudents(); document.getElementById('qr-fecha').value=hoy(); }
  if(p!=='scan')        stopCamera();
}

// ─── TOAST ───
function toast(msg,tipo='ok'){
  const t=document.getElementById('toast');
  const ic=document.getElementById('toast-icon');
  t.className='toast show '+tipo;
  ic.className=tipo==='ok'?'ti ti-check':tipo==='info'?'ti ti-info-circle':'ti ti-alert-triangle';
  document.getElementById('tmsg').textContent=msg;
  clearTimeout(t._t); t._t=setTimeout(()=>t.classList.remove('show'),3500);
}

// ─── HOME ───
function updHome(){
  const db=getDB(), stus=getStus(), ses=getSes(), now=Date.now();
  document.getElementById('h-total').textContent=db.length;
  document.getElementById('h-pres').textContent =db.filter(r=>r.estado==='Presente').length;
  document.getElementById('h-tard').textContent =db.filter(r=>r.estado==='Tardanza').length;
  document.getElementById('h-aus').textContent  =db.filter(r=>r.estado==='Ausente').length;
  document.getElementById('h-pend').textContent =db.filter(r=>!r.estado||r.estado==='—').length;
  document.getElementById('h-stus').textContent =stus.length;
  document.getElementById('h-qrs').textContent  =Object.values(ses).filter(s=>s.expira>now).length;
  const badge=document.getElementById('badge-count');
  badge.style.display=db.length>0?'':'none'; badge.textContent=db.length;
  const last=[...db].reverse().slice(0,5);
  const wrap=document.getElementById('last-list');
  if(!last.length){wrap.innerHTML='<p style="color:var(--t3);font-size:13px">Sin registros aún.</p>';return}
  wrap.innerHTML=last.map(r=>`
    <div style="display:flex;align-items:center;gap:.75rem;padding:.6rem 0;border-bottom:1px solid var(--border)">
      <div style="width:32px;height:32px;border-radius:8px;background:linear-gradient(135deg,var(--accent2),var(--accent));display:flex;align-items:center;justify-content:center;font-weight:700;font-size:11px;color:#000;flex-shrink:0">${initials(r.nombre)}</div>
      <div style="flex:1"><div style="font-size:13px;font-weight:600">${r.nombre}</div><div style="font-size:11px;color:var(--t2)">${r.materia||''} · ${r.fecha||''} ${r.hora||''}</div></div>
      ${r.estado&&r.estado!=='—'?`<span class="badge ${r.estado==='Presente'?'bp':r.estado==='Tardanza'?'bt':'ba'}">${r.estado}</span>`:'<span class="badge bpend">Pendiente</span>'}
    </div>`).join('');
}

// ─── ESTUDIANTES ───
function agregarEstudiante(){
  const nombre=document.getElementById('e-nombre').value.trim();
  const cedula=document.getElementById('e-cedula').value.trim();
  const materia=document.getElementById('e-materia').value.trim();
  const docente=document.getElementById('e-docente').value.trim();
  const curso=document.getElementById('e-curso').value.trim();
  if(!nombre||!cedula||!materia||!docente){toast('Completa todos los campos','err');return}
  const stus=getStus();
  if(stus.find(s=>s.cedula===cedula)){toast('Ya existe un estudiante con esa cédula','err');return}
  stus.push({id:Date.now(),nombre,cedula,materia,docente,curso});
  saveStus(stus);
  ['e-nombre','e-cedula','e-materia','e-docente','e-curso'].forEach(id=>document.getElementById(id).value='');
  renderStudents(); toast('Estudiante agregado');
}

function renderStudents(){
  const stus=getStus();
  document.getElementById('stu-count-label').textContent=`👥 Estudiantes registrados (${stus.length})`;
  const wrap=document.getElementById('stu-list-wrap');
  if(!stus.length){wrap.innerHTML='<p style="color:var(--t3);font-size:13px">No hay estudiantes.</p>';return}
  wrap.innerHTML='<div class="stu-list">'+stus.map(s=>`
    <div class="stu-item">
      <div class="stu-avatar">${initials(s.nombre)}</div>
      <div class="stu-info"><div class="stu-name">${s.nombre}</div><div class="stu-detail">CI: ${s.cedula} · ${s.materia} · ${s.docente} · ${s.curso}</div></div>
      <div class="stu-actions">
        <button class="btn btn-secondary btn-xs" onclick="irGenerarQRde(${s.id})"><i class="ti ti-qrcode"></i> QR</button>
        <button class="del-btn" onclick="eliminarEstudiante(${s.id})"><i class="ti ti-trash"></i></button>
      </div>
    </div>`).join('')+'</div>';
}

function eliminarEstudiante(id){
  if(!confirm('¿Eliminar este estudiante?'))return;
  saveStus(getStus().filter(s=>s.id!==id));
  renderStudents(); toast('Estudiante eliminado');
}

function irGenerarQRde(id){
  gp('qr');
  setTimeout(()=>{ const s=getStus().find(s=>s.id===id); if(s) seleccionarEstudiante(s); },100);
}

// ─── GENERAR QR ───
function renderQRStudents(){ renderQRStudentList(getStus()) }

function renderQRStudentList(stus){
  const wrap=document.getElementById('qr-stu-list');
  if(!stus.length){
    wrap.innerHTML='<p style="color:var(--t3);font-size:13px">No hay estudiantes. <a href="#" onclick="gp(\'estudiantes\')" style="color:var(--accent)">Agrega uno primero.</a></p>';return;
  }
  wrap.innerHTML='<div class="stu-list">'+stus.map(s=>`
    <div class="stu-item ${selectedStu&&selectedStu.id===s.id?'selected':''}" onclick='seleccionarEstudiante(${JSON.stringify(s).replace(/'/g,"&#39;")})'>
      <div class="stu-avatar">${initials(s.nombre)}</div>
      <div class="stu-info"><div class="stu-name">${s.nombre}</div><div class="stu-detail">CI: ${s.cedula} · ${s.materia}</div></div>
      <i class="ti ti-chevron-right" style="color:var(--t3)"></i>
    </div>`).join('')+'</div>';
}

function filtrarQRStudents(){
  const q=document.getElementById('qr-search').value.toLowerCase();
  renderQRStudentList(getStus().filter(s=>s.nombre.toLowerCase().includes(q)||s.cedula.includes(q)));
}

function seleccionarEstudiante(stu){
  if(typeof stu==='string') stu=JSON.parse(stu);
  selectedStu=stu;
  document.getElementById('qr-config-card').style.display='block';
  document.getElementById('qr-result').style.display='none';
  document.getElementById('qr-stu-selected').innerHTML=`
    <div class="stu-item selected" style="cursor:default">
      <div class="stu-avatar">${initials(stu.nombre)}</div>
      <div class="stu-info"><div class="stu-name">${stu.nombre}</div><div class="stu-detail">CI: ${stu.cedula} · ${stu.materia} · ${stu.docente} · ${stu.curso}</div></div>
    </div>`;
  renderQRStudentList(getStus());
}

function generarQR(){
  if(!selectedStu){toast('Selecciona un estudiante primero','err');return}
  const fecha=document.getElementById('qr-fecha').value;
  const mins=parseInt(document.getElementById('qr-mins').value);
  if(!fecha){toast('Selecciona una fecha','err');return}
  if(qrTimer) clearInterval(qrTimer);
  const code=mkCode(), expira=Date.now()+mins*60000;
  const all=getSes(); all[code]={code,stuId:selectedStu.id,nombre:selectedStu.nombre,cedula:selectedStu.cedula,materia:selectedStu.materia,docente:selectedStu.docente,curso:selectedStu.curso||'',fecha,expira}; saveSes(all);
  const result=document.getElementById('qr-result'); result.style.display='block';
  document.getElementById('qr-student-info').innerHTML=`<div class="stu-pill">${code}</div>`;
  document.getElementById('qr-canvas').innerHTML='';
  new QRCode(document.getElementById('qr-canvas'),{text:code,width:160,height:160,colorDark:'#000000',colorLight:'#ffffff',correctLevel:QRCode.CorrectLevel.M});
  document.getElementById('qr-meta').innerHTML=`<strong style="color:var(--text)">${selectedStu.nombre}</strong><br>CI: ${selectedStu.cedula} · ${selectedStu.materia}<br>${selectedStu.docente} · ${selectedStu.curso} · ${fecha}`;
  const timerEl=document.getElementById('qr-timer-wrap');
  function tick(){
    const left=Math.max(0,Math.round((expira-Date.now())/1000));
    const m=Math.floor(left/60),s=String(left%60).padStart(2,'0');
    timerEl.innerHTML=left>0?`<div class="timer-big">${m}:${s}</div>`:`<div class="timer-big exp">⚠ Expirado</div>`;
    if(left===0) clearInterval(qrTimer);
  }
  tick(); qrTimer=setInterval(tick,1000);
  result.scrollIntoView({behavior:'smooth',block:'nearest'});
  toast('QR generado para '+selectedStu.nombre);
}

// ─── CÁMARA ───
function setScanTab(tab){
  document.getElementById('stab-cam').classList.toggle('active',tab==='cam');
  document.getElementById('stab-manual').classList.toggle('active',tab==='manual');
  document.getElementById('scan-cam-panel').style.display    =tab==='cam'?'block':'none';
  document.getElementById('scan-manual-panel').style.display =tab==='manual'?'block':'none';
  if(tab!=='cam') stopCamera();
}

async function startCamera(){
  try{
    const stream=await navigator.mediaDevices.getUserMedia({video:{facingMode:'environment'}});
    scanStream=stream;
    const video=document.getElementById('scanner-video'); video.srcObject=stream;
    document.getElementById('btn-start-cam').style.display='none';
    document.getElementById('btn-stop-cam').style.display='';
    document.getElementById('scan-status').textContent='Escaneando…';
    document.getElementById('scan-status').className='scan-status';
    startQRScan(video);
  }catch(e){ toast('No se pudo acceder a la cámara. Verifica permisos.','err') }
}

function stopCamera(){
  if(scanStream){ scanStream.getTracks().forEach(t=>t.stop()); scanStream=null; }
  if(scanInterval){ clearInterval(scanInterval); scanInterval=null; }
  const v=document.getElementById('scanner-video'); if(v) v.srcObject=null;
  const bs=document.getElementById('btn-start-cam'); if(bs) bs.style.display='';
  const bt=document.getElementById('btn-stop-cam');  if(bt) bt.style.display='none';
}

function startQRScan(video){
  const canvas=document.createElement('canvas'),ctx=canvas.getContext('2d');
  let lastCode='', lastTime=0;
  scanInterval=setInterval(()=>{
    if(!video.videoWidth) return;
    canvas.width=video.videoWidth; canvas.height=video.videoHeight;
    ctx.drawImage(video,0,0);
    if(!window.jsQR) return;
    const d=ctx.getImageData(0,0,canvas.width,canvas.height);
    const code=window.jsQR(d.data,d.width,d.height);
    if(code&&code.data){
      const now=Date.now();
      if(code.data===lastCode&&now-lastTime<4000) return;
      lastCode=code.data; lastTime=now;
      processScanResult(code.data);
    }
  },300);
}

const jsQRScript=document.createElement('script');
jsQRScript.src='https://cdnjs.cloudflare.com/ajax/libs/jsQR/1.4.0/jsQR.min.js';
document.head.appendChild(jsQRScript);

function processScanResult(code){
  code=code.trim().toUpperCase();
  if(!code.startsWith('CODY-')) return;
  stopCamera();
  document.getElementById('scan-status').textContent='✓ Código leído: '+code;
  document.getElementById('scan-status').className='scan-status ok';
  abrirModalAsistencia(code);
}

// ─── CÓDIGO MANUAL ───
function verificarCodigo(code){
  const info=document.getElementById('m-info'),conf=document.getElementById('m-confirm');
  pendingCode=null;
  if(code.length<8){info.innerHTML='';conf.style.display='none';return}
  const ses=getSes()[code];
  if(!ses){info.innerHTML='<div class="err-box"><i class="ti ti-x"></i> Código no válido.</div>';conf.style.display='none';return}
  if(Date.now()>ses.expira){info.innerHTML='<div class="err-box"><i class="ti ti-clock-x"></i> QR expirado.</div>';conf.style.display='none';return}
  const left=Math.ceil((ses.expira-Date.now())/60000);
  info.innerHTML=`<div class="ok-box"><i class="ti ti-circle-check"></i> <strong>${ses.nombre}</strong><br>CI: ${ses.cedula} · ${ses.materia}<br>Fecha: ${ses.fecha} · ${left} min restantes</div>`;
  pendingCode=code; conf.style.display='block';
}

function confirmarRegistro(){ if(pendingCode) abrirModalAsistencia(pendingCode); }

// ─── MODAL ───
function abrirModalAsistencia(code){
  const ses=getSes()[code];
  if(!ses){toast('Código no encontrado','err');return}
  if(Date.now()>ses.expira){toast('El QR expiró','err');return}
  pendingCode=code;
  document.getElementById('modal-info').innerHTML=`
    <div class="ok-box"><strong>${ses.nombre}</strong><br>CI: ${ses.cedula} · ${ses.materia}<br>Docente: ${ses.docente} · Fecha: ${ses.fecha}</div>`;
  document.getElementById('modal-asistencia').classList.add('open');
}

function cerrarModal(){ document.getElementById('modal-asistencia').classList.remove('open'); pendingCode=null; }

function guardarAsistencia(){
  if(!pendingCode) return;
  const ses=getSes()[pendingCode];
  const estado=document.getElementById('modal-estado').value;
  if(!ses){toast('Sesión no válida','err');return}
  const db=getDB();
  // Si ya existe un registro pendiente para este estudiante+fecha+materia, actualizar su estado
  const idx=db.findIndex(r=>r.cedula===ses.cedula&&r.fecha===ses.fecha&&r.materia===ses.materia);
  if(idx>=0){
    db[idx].estado=estado; db[idx].hora=ahora(); db[idx].method='QR';
    saveDB(db); cerrarModal(); toast(`✓ Estado de ${ses.nombre} actualizado a ${estado}`);
  } else {
    const dup=db.find(r=>r.cedula===ses.cedula&&r.fecha===ses.fecha&&r.materia===ses.materia&&r.estado&&r.estado!=='—');
    if(dup){toast('Ya existe un registro con estado para este estudiante hoy','err');cerrarModal();return}
    db.push({id:Date.now(),nombre:ses.nombre,cedula:ses.cedula,materia:ses.materia,docente:ses.docente,
             curso:ses.curso||'',fecha:ses.fecha,hora:ahora(),estado,method:'QR'});
    saveDB(db); cerrarModal(); toast(`✓ Asistencia de ${ses.nombre} → ${estado}`);
  }
  const mi=document.getElementById('m-codigo'); if(mi){mi.value='';document.getElementById('m-info').innerHTML='';document.getElementById('m-confirm').style.display='none';}
  const ss=document.getElementById('scan-status'); if(ss){ss.textContent='Apunta la cámara al código QR';ss.className='scan-status';}
  updHome();
}

// ═══════════════════════════════════════════════════
//  IMPORTAR EXCEL
// ═══════════════════════════════════════════════════
// Drag & drop
const dz=document.getElementById('excel-drop-zone');
dz.addEventListener('dragover',e=>{e.preventDefault();dz.classList.add('drag')});
dz.addEventListener('dragleave',()=>dz.classList.remove('drag'));
dz.addEventListener('drop',e=>{e.preventDefault();dz.classList.remove('drag');const f=e.dataTransfer.files[0];if(f) handleExcelFile(f);});

function handleExcelFile(file){
  if(!file) return;
  const ext=file.name.split('.').pop().toLowerCase();
  if(!['xlsx','xls','csv'].includes(ext)){toast('Formato no válido. Usa .xlsx, .xls o .csv','err');return}
  const reader=new FileReader();
  reader.onload=e=>{
    try{
      const data=new Uint8Array(e.target.result);
      const wb=XLSX.read(data,{type:'array'});
      const ws=wb.Sheets[wb.SheetNames[0]];
      const rows=XLSX.utils.sheet_to_json(ws,{header:1,defval:''});
      if(rows.length<2){toast('El archivo está vacío o sin datos','err');return}
      // Detectar encabezados
      const headers=rows[0].map(h=>String(h).trim());
      const dataRows=rows.slice(1).filter(r=>r.some(c=>String(c).trim()!==''));
      excelHeaders=headers; excelData=dataRows;
      mostrarMapeoColumnas(headers,dataRows,file.name);
    }catch(err){ toast('Error al leer el archivo: '+err.message,'err') }
  };
  reader.readAsArrayBuffer(file);
}

// Nombres clave para detectar columnas automáticamente
const COL_KEYS={
  nombre:  ['nombre','name','alumno','estudiante','apellido','nombres','apellidos','nombre completo'],
  cedula:  ['cedula','cédula','ci','carnet','id','dni','documento','identificacion'],
  materia: ['materia','asignatura','curso','subject','clase','módulo','modulo'],
  docente: ['docente','profesor','teacher','maestro','instructor','catedrático'],
  curso:   ['curso','paralelo','grado','sección','seccion','grupo'],
};

function detectCol(headers,key){
  const kws=COL_KEYS[key]||[];
  for(let i=0;i<headers.length;i++){
    const h=headers[i].toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'');
    if(kws.some(k=>h.includes(k))) return i;
  }
  return -1;
}

function mostrarMapeoColumnas(headers,dataRows,filename){
  const preview=document.getElementById('excel-preview');
  preview.style.display='block';
  preview.innerHTML=`<i class="ti ti-check" style="margin-right:6px"></i><strong>${filename}</strong> — ${dataRows.length} filas detectadas · ${headers.length} columnas`;

  const mapWrap=document.getElementById('col-map-wrap');
  const info=document.getElementById('col-map-info');
  const map=document.getElementById('col-map');
  mapWrap.style.display='block';

  // Build selects
  const fields=[
    {key:'nombre',label:'Nombre del estudiante',required:true},
    {key:'cedula',label:'Cédula / Carnet',required:true},
    {key:'materia',label:'Materia',required:false},
    {key:'docente',label:'Docente',required:false},
    {key:'curso',label:'Curso / Paralelo',required:false},
  ];

  map.innerHTML=fields.map(f=>{
    const detected=detectCol(headers,f.key);
    const opts=`<option value="-1">— No usar —</option>`+headers.map((h,i)=>`<option value="${i}" ${i===detected?'selected':''}>${h||'(columna '+(i+1)+')'}</option>`).join('');
    return `<div class="col-map-item">
      <label>${f.label}${f.required?' *':''}</label>
      <select id="map-${f.key}">${opts}</select>
    </div>`;
  }).join('');

  // Info message
  const detected=fields.filter(f=>detectCol(headers,f.key)>=0).length;
  info.innerHTML=`<i class="ti ti-info-circle"></i> Se detectaron <strong>${detected} de ${fields.length}</strong> columnas automáticamente. Ajusta el mapeo si es necesario.`;
}

function cancelarImport(){
  excelData=null; excelHeaders=null;
  document.getElementById('excel-preview').style.display='none';
  document.getElementById('col-map-wrap').style.display='none';
  document.getElementById('excel-file-input').value='';
}

function importarEstudiantes(){
  if(!excelData||!excelHeaders){toast('No hay datos para importar','err');return}
  const getIdx=key=>parseInt(document.getElementById('map-'+key).value);
  const ni=getIdx('nombre'), ci=getIdx('cedula');
  if(ni<0||ci<0){toast('Debes mapear al menos Nombre y Cédula','err');return}
  const mi=getIdx('materia'), di=getIdx('docente'), cri=getIdx('curso');

  const stus=getStus(); const db=getDB();
  let agregados=0, omitidos=0, registros=0;
  const today=hoy();

  for(const row of excelData){
    const nombre=String(row[ni]||'').trim();
    const cedula=String(row[ci]||'').trim();
    if(!nombre||!cedula) continue;
    const materia=mi>=0?String(row[mi]||'').trim():'';
    const docente=di>=0?String(row[di]||'').trim():'';
    const curso  =cri>=0?String(row[cri]||'').trim():'';

    // Agregar a lista de estudiantes si no existe
    if(!stus.find(s=>s.cedula===cedula)){
      stus.push({id:Date.now()+Math.random(),nombre,cedula,materia,docente,curso});
      agregados++;
    } else { omitidos++; }

    // Crear registro de asistencia SIN estado (pendiente)
    const yaReg=db.find(r=>r.cedula===cedula&&r.fecha===today&&r.materia===materia);
    if(!yaReg){
      db.push({id:Date.now()+Math.random()+Math.random(),nombre,cedula,materia,docente,
               curso,fecha:today,hora:'—',estado:'—',method:'Excel'});
      registros++;
    }
  }

  saveStus(stus); saveDB(db);
  cancelarImport();
  renderTabla(); updHome();
  toast(`✓ ${agregados} estudiantes importados · ${registros} registros creados · ${omitidos} ya existían`,'ok');
}

// ═══════════════════════════════════════════════════
//  TABLA DE REGISTROS
// ═══════════════════════════════════════════════════
function estadoClass(e){
  if(e==='Presente') return 'pres'; if(e==='Tardanza') return 'tard';
  if(e==='Ausente')  return 'ause'; return 'pend';
}

function cambiarEstado(id, val){
  const db=getDB();
  const r=db.find(x=>x.id===id);
  if(!r) return;
  r.estado=val;
  if(val!=='—'&&r.hora==='—') r.hora=ahora();
  if(val!=='—') r.method=r.method==='Excel'?'Manual':r.method;
  saveDB(db); renderTabla(); updHome();
}

function renderTabla(){
  const db=getDB();
  const q=document.getElementById('buscar').value.toLowerCase();
  const fe=document.getElementById('fil-est').value;
  const rows=db.filter(r=>{
    const match=(!q||(r.nombre+r.cedula+(r.materia||'')).toLowerCase().includes(q));
    const est=fe===''?true:fe==='—'?(r.estado==='—'||!r.estado):(r.estado===fe);
    return match&&est;
  }).reverse();

  document.getElementById('r-total').textContent=db.length;
  document.getElementById('r-pres').textContent =db.filter(r=>r.estado==='Presente').length;
  document.getElementById('r-tard').textContent =db.filter(r=>r.estado==='Tardanza').length;
  document.getElementById('r-aus').textContent  =db.filter(r=>r.estado==='Ausente').length;
  document.getElementById('reg-sub').textContent=db.length+' registros en total';

  const tbody=document.getElementById('tbody');
  const empty=document.getElementById('tbl-empty');
  if(!rows.length){tbody.innerHTML='';empty.style.display='block';return}
  empty.style.display='none';

  tbody.innerHTML=rows.map(r=>{
    const ec=estadoClass(r.estado||'—');
    const sel=`<select class="estado-sel ${ec}" onchange="cambiarEstado(${r.id},this.value)">
      <option value="—" ${(r.estado==='—'||!r.estado)?'selected':''}>— Pendiente</option>
      <option value="Presente" ${r.estado==='Presente'?'selected':''}>✓ Presente</option>
      <option value="Tardanza" ${r.estado==='Tardanza'?'selected':''}>⏱ Tardanza</option>
      <option value="Ausente"  ${r.estado==='Ausente'?'selected':''}>✗ Ausente</option>
    </select>`;
    return `<tr>
      <td style="color:var(--text);font-weight:600">${r.nombre}</td>
      <td>${r.cedula}</td>
      <td>${r.materia||'—'}</td>
      <td>${r.docente||'—'}</td>
      <td>${r.fecha||'—'}</td>
      <td style="font-family:'JetBrains Mono',monospace">${r.hora||'—'}</td>
      <td>${sel}</td>
      <td><span class="badge bq">${r.method||'—'}</span></td>
      <td><button class="del-btn" onclick="delReg(${r.id})"><i class="ti ti-trash"></i></button></td>
    </tr>`;
  }).join('');

  const badge=document.getElementById('badge-count');
  badge.style.display=db.length>0?'':'none'; badge.textContent=db.length;
}

function delReg(id){ saveDB(getDB().filter(r=>r.id!==id)); renderTabla(); updHome(); toast('Registro eliminado'); }
function limpiar(){ if(!confirm('¿Eliminar TODOS los registros?'))return; saveDB([]); renderTabla(); updHome(); toast('Registros eliminados'); }

// ─── EXPORTAR PDF ───
function exportarPDF(){
  const db=getDB();
  if(!db.length){toast('No hay registros para exportar','err');return}
  const {jsPDF}=window.jspdf;
  const doc=new jsPDF({orientation:'landscape',unit:'mm',format:'a4'});
  doc.setFillColor(5,8,15); doc.rect(0,0,297,297,'F');
  doc.setFillColor(13,17,23); doc.rect(0,0,297,28,'F');
  doc.setFont('helvetica','bold'); doc.setFontSize(18); doc.setTextColor(0,212,255);
  doc.text('Codyweb.com',14,12);
  doc.setFontSize(10); doc.setTextColor(122,144,184);
  doc.text('Sistema de Registro de Asistencia',14,19);
  const now=new Date();
  doc.setFontSize(9); doc.text(`Generado: ${now.toLocaleDateString('es-ES')} ${now.toTimeString().slice(0,5)}`,14,25);
  const pres=db.filter(r=>r.estado==='Presente').length,tard=db.filter(r=>r.estado==='Tardanza').length,aus=db.filter(r=>r.estado==='Ausente').length;
  [[db.length,'Total',[0,212,255]],[pres,'Presentes',[0,229,160]],[tard,'Tardanzas',[255,200,74]],[aus,'Ausentes',[255,77,109]]].forEach(([v,l,c],i)=>{
    const x=200+i*24; doc.setTextColor(...c); doc.setFontSize(12); doc.setFont('helvetica','bold'); doc.text(String(v),x,12);
    doc.setFontSize(7); doc.setTextColor(122,144,184); doc.setFont('helvetica','normal'); doc.text(l,x,18);
  });
  const q=document.getElementById('buscar').value.toLowerCase(), fe=document.getElementById('fil-est').value;
  const rows=db.filter(r=>(!q||(r.nombre+r.cedula+(r.materia||'')).toLowerCase().includes(q))&&(fe===''||fe==='—'?(r.estado==='—'||!r.estado):r.estado===fe)).reverse();
  doc.autoTable({
    startY:32,
    head:[['Estudiante','Cédula','Materia','Docente','Fecha','Hora','Estado','Método']],
    body:rows.map(r=>[r.nombre,r.cedula,r.materia||'—',r.docente||'—',r.fecha||'—',r.hora||'—',r.estado==='—'?'Pendiente':r.estado||'Pendiente',r.method||'—']),
    theme:'grid',
    styles:{fontSize:8,font:'helvetica',textColor:[200,210,235],fillColor:[13,17,23],lineColor:[26,37,64],lineWidth:0.3},
    headStyles:{fillColor:[0,100,180],textColor:[255,255,255],fontStyle:'bold',fontSize:8},
    alternateRowStyles:{fillColor:[19,28,43]},
    margin:{left:14,right:14},
  });
  const pc=doc.internal.getNumberOfPages();
  for(let i=1;i<=pc;i++){doc.setPage(i);doc.setFontSize(7);doc.setTextColor(61,82,120);doc.text(`Codyweb.com — Página ${i} de ${pc}`,14,doc.internal.pageSize.height-8);}
  doc.save(`Asistencias_Codyweb_${now.toLocaleDateString('es-ES').replace(/\//g,'-')}.pdf`);
  toast('PDF descargado');
}

updHome();
