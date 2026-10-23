// 全站导览下拉：一次只开一个；Esc／点外面／滚动就收起。
// 面板改用 fixed 定位，内页封面 .cover 有 overflow:hidden，absolute 会被裁掉。
(function(){
  var dds = [].slice.call(document.querySelectorAll('.sitenav details, .mainnav details.dd'));
  function place(d){
    var p = d.querySelector('.sn-panel'), s = d.querySelector('summary');
    if(!p || d.closest('.mainnav')) return;          // 首页顶栏本身是 fixed，absolute 就够
    var r = s.getBoundingClientRect(), w = Math.min(352, innerWidth - 32);
    p.style.position = 'fixed'; p.style.marginTop = '0';
    p.style.top = (r.bottom + 8) + 'px';
    p.style.left = Math.max(16, Math.min(r.left, innerWidth - w - 16)) + 'px';
    p.style.maxHeight = (innerHeight - r.bottom - 24) + 'px'; p.style.overflowY = 'auto';
  }
  function closeAll(except){ dds.forEach(function(d){ if(d !== except) d.open = false; }); }
  dds.forEach(function(d){ d.addEventListener('toggle', function(){ if(d.open){ closeAll(d); place(d); } }); });
  document.addEventListener('click', function(e){ if(!e.target.closest('.sitenav details, .mainnav details.dd')) closeAll(); });
  document.addEventListener('keydown', function(e){ if(e.key === 'Escape') closeAll(); });
  addEventListener('scroll', function(){ dds.forEach(function(d){ if(d.open && !d.closest('.mainnav')) d.open = false; }); }, {passive:true});
  addEventListener('resize', function(){ closeAll(); });
})();
