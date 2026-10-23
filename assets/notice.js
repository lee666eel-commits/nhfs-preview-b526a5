// 家长布告栏：两份 Google 表格「发布到网络」CSV 网址，建表后填进来（步骤见 data/notice/README.md）
// 网址留空＝显示「暂无」；本机加 ?sample 看示例数据
const SAMPLE = location.search.includes('sample');
// 首页与 notices/ 共用本档；CSV 相对站根解析，full 模式（notices/）列全部通告与全部月份
const ROOT = new URL('..', document.currentScript.src).href, FULL = document.currentScript.dataset.mode === 'full';
const NOTICE_CSV = SAMPLE ? 'data/notice/sample-notice.csv' : '';
// ponytail: 行事历先读站内 assets/notice/calendar.csv（教务处 2026 行事历摘家长相关项），表格建好后换成「行事历」分页的 CSV 网址
const CAL_CSV = SAMPLE ? 'data/notice/sample-calendar.csv' : 'assets/notice/calendar.csv';
// ponytail: 只处理 RFC4180 引号/逗号/换行，够 Google 表格导出用
function parseCSV(t){
  const rows=[]; let row=[], f='', q=false;
  for(let i=0;i<t.length;i++){
    const c=t[i];
    if(q){ if(c=='"'){ if(t[i+1]=='"'){f+='"';i++} else q=false } else f+=c }
    else if(c=='"') q=true;
    else if(c==','){ row.push(f); f='' }
    else if(c=='\n'||c=='\r'){ if(c=='\r'&&t[i+1]=='\n') i++; row.push(f); rows.push(row); row=[]; f='' }
    else f+=c;
  }
  if(f||row.length){ row.push(f); rows.push(row) }
  return rows.filter(r=>r.some(x=>x.trim()));
}
// 第一栏日期统一成 yyyy-mm-dd（表格显示格式若是 2026/10/5 也照收）
const normDate=d=>{ const m=(d||'').match(/(\d{4})\D(\d{1,2})\D(\d{1,2})/); return m?m[1]+'-'+m[2].padStart(2,'0')+'-'+m[3].padStart(2,'0'):'' };
async function loadCSV(u){ if(!u) return []; const r=await fetch(new URL(u, ROOT),{cache:'no-store'}); if(!r.ok) throw r.status; return parseCSV(await r.text()).slice(1).map(r=>(r[0]=normDate(r[0]),r)) }
const el=(tag,cls,txt)=>{ const e=document.createElement(tag); if(cls) e.className=cls; if(txt!=null) e.textContent=txt; return e };
const driveIds=s=>[...(s||'').matchAll(/(?:id=|\/d\/)([\w-]{20,})/g)].map(m=>m[1]);
const fmtDate=d=>d.replace(/-/g,' · ');
function link(href,txt){ if(!/^https:\/\//.test(href)) return null; const a=el('a',null,txt); a.href=href; a.target='_blank'; a.rel='noopener'; return a }
// 布告栏列：日期 yyyy-mm-dd, 部门, 标题, 内容, 照片, 影片, 相关链接
loadCSV(NOTICE_CSV).then(rows=>{
  const box=document.getElementById('noticeList');
  rows=rows.filter(r=>r[0]&&r[2]).sort((a,b)=>b[0].localeCompare(a[0])).slice(0, FULL ? 999 : 6);
  if(!rows.length){ box.firstChild.textContent='暂无公告。'; return }
  box.replaceChildren(...rows.map(([date,dept,title,body,pics,vids,url],n)=>{
    const d=el('details'); if(n==0) d.open=true;
    const s=el('summary'); const t=el('time',null,fmtDate(date)); t.dateTime=date;
    s.append(t,el('b',null,title)); if(dept) s.append(el('em',null,dept)); d.append(s);
    const b=el('div','body',body||'');
    const ids=driveIds(pics);
    if(ids.length){ const g=el('div','pics'); ids.forEach(id=>{ const im=el('img'); im.src='https://drive.google.com/thumbnail?id='+id+'&sz=w800'; im.alt=title; im.loading='lazy'; g.append(im) }); b.append(g) }
    const p=el('p'); p.style.marginTop='.8rem';
    driveIds(vids).forEach(id=>p.append(link('https://drive.google.com/file/d/'+id+'/view','观看影片 →')));
    (url||'').split(/[\s,]+/).forEach(u=>{ const a=link(u,'相关链接 →'); if(a) p.append(a) });
    if(p.childNodes.length) b.append(p);
    d.append(b); return d;
  }));
}).catch(()=>{ document.getElementById('noticeList').firstChild.textContent='布告暂时无法载入，请稍后再看。' });
// 行事历列：日期 yyyy-mm-dd, 活动, 备注；只显示本月
loadCSV(CAL_CSV).then(rows=>{
  const box=document.getElementById('calList'), now=new Date();
  const ym=now.getFullYear()+'-'+String(now.getMonth()+1).padStart(2,'0'), today=ym+'-'+String(now.getDate()).padStart(2,'0');
  document.getElementById('calTitle').textContent=(now.getMonth()+1)+' 月行事历';
  rows=rows.filter(r=>(FULL||(r[0]||'').startsWith(ym))&&r[1]).sort((a,b)=>a[0].localeCompare(b[0]));
  if(!rows.length){ box.firstChild.textContent=FULL?'行事历整理中。':'本月行事历整理中。'; return }
  if(FULL) document.getElementById('calTitle').textContent='行事历';
  const ol=el('ol'), parts=[];
  rows.forEach(([date,what,note])=>{
    if(FULL && (!parts.length || parts[parts.length-1].ym!==date.slice(0,7))){ const h=el('li','month',Number(date.slice(5,7))+' 月'); h.id='m'+date.slice(0,7); parts.push({ym:date.slice(0,7)}); ol.append(h) }
    const m=(note||'').match(/至 (\d+) 月 (\d+) 日/), end=m?date.slice(0,5)+m[1].padStart(2,'0')+'-'+m[2].padStart(2,'0'):date;
    const li=el('li',end<today?'past':''); const t=el('time',null,String(Number(date.slice(8,10)))); t.dateTime=date;
    const sp=el('span',null,what); if(note) sp.append(el('small',null,note));
    li.append(t,sp); ol.append(li);
  });
  box.replaceChildren(ol);
}).catch(()=>{ document.getElementById('calList').firstChild.textContent='行事历暂时无法载入。' });
