  var io=new IntersectionObserver(function(entries){
    entries.forEach(function(e){ if(e.isIntersecting){ e.target.classList.add('in'); io.unobserve(e.target); } });
  },{threshold:0.12, rootMargin:'0px 0px -7% 0px'});
  function arm(scope){ (scope||document).querySelectorAll('.reveal:not(.in)').forEach(function(el){ io.observe(el); }); }

  function show(id, el){
    /* ชื่อเดิม "deadlines" ยังใช้ได้ — พาไปที่แท็บงานที่ต้องส่งของหน้าปฏิทิน */
    var wantTab=null;
    if(id==='deadlines'){ id='calendar'; wantTab='tasks'; }
    document.querySelectorAll('.view').forEach(function(v){ v.classList.remove('active'); });
    var t=document.getElementById('view-'+id);
    if(t){ t.classList.add('active'); }
    document.querySelectorAll('.menu a').forEach(function(a){ a.classList.remove('on'); });
    var nav=document.querySelector('.menu a[data-go="'+id+'"]'); if(nav){ nav.classList.add('on'); }
    closeMenu();
    window.scrollTo({top:0,behavior:'smooth'});
    if(wantTab && typeof setCalTab==='function') setCalTab(wantTab);
    if(t){ requestAnimationFrame(function(){ arm(t); }); }
  }

  /* ---------- เมนูบนจอแคบ (ปุ่ม "เมนู") ---------- */
  function setMenuOpen(open){
    var nav=document.querySelector('nav'), btn=document.getElementById('nav-toggle');
    if(nav) nav.classList.toggle('open', !!open);
    if(btn) btn.setAttribute('aria-expanded', open ? 'true' : 'false');
  }
  function toggleMenu(){
    var nav=document.querySelector('nav');
    setMenuOpen(!(nav && nav.classList.contains('open')));
  }
  function closeMenu(){ setMenuOpen(false); }
  document.addEventListener('click', function(e){
    var nav=document.querySelector('nav');
    if(nav && nav.classList.contains('open') && !nav.contains(e.target)) closeMenu();
  });
  document.addEventListener('keydown', function(e){ if(e.key==='Escape') closeMenu(); });
  function dl(){ alert('ตัวอย่างเพื่อสาธิต: ในระบบจริง ปุ่มนี้จะเปิด/ดาวน์โหลดไฟล์ PDF จาก Google Drive'); }

  /* ===== Google Sheets data: ข้อมูลโรงเรียน ===== */
  var SCHOOLS_CSV_URL = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vSzuUYQx4O8dQzhcH5vIWfO96SNy4-AV8f_oNE7WDYe6I4YSpWtYu28BCyTS9rb-MVGzX-3Iwr1jCNy/pub?output=csv';
  var schoolList = [];

  function parseCSV(text){
    var rows=[], row=[], field='', inQuotes=false;
    for(var i=0;i<text.length;i++){
      var c=text[i];
      if(inQuotes){
        if(c==='"'){ if(text[i+1]==='"'){ field+='"'; i++; } else { inQuotes=false; } }
        else field+=c;
      } else {
        if(c==='"') inQuotes=true;
        else if(c===','){ row.push(field); field=''; }
        else if(c==='\n' || c==='\r'){
          if(c==='\r' && text[i+1]==='\n') i++;
          row.push(field); field=''; rows.push(row); row=[];
        } else field+=c;
      }
    }
    if(field!=='' || row.length){ row.push(field); rows.push(row); }
    return rows.filter(function(r){ return r.length>1 || r[0]!==''; });
  }

  function loadSchools(){
    fetch(SCHOOLS_CSV_URL).then(function(res){ return res.text(); }).then(function(text){
      var rows = parseCSV(text);
      var header = rows.shift();
      schoolList = rows.map(function(r){
        var o={};
        header.forEach(function(h,i){ o[h.trim()]=(r[i]||'').trim(); });
        return o;
      });
      renderSchools(schoolList);
      renderSchoolCharts(schoolList);
      renderHomeSchoolStats();
      renderHomeSarStat();
      if(typeof renderStandardsDocs==='function') renderStandardsDocs();
      if(typeof renderActionplanDocs==='function') renderActionplanDocs();
      if(typeof loadPersonnel==='function') loadPersonnel();
    }).catch(function(err){
      document.getElementById('school-tbody').innerHTML =
        '<tr><td colspan="5" style="text-align:center;color:var(--ink-soft);">ไม่สามารถโหลดข้อมูลได้ ลองใหม่อีกครั้ง</td></tr>';
      console.error('loadSchools error:', err);
    });
  }

  function renderSchools(list){
    var tbody = document.getElementById('school-tbody');
    document.getElementById('school-count').textContent = 'โรงเรียนในสังกัด (' + list.length + ' แห่ง)';
    if(!list.length){
      tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;color:var(--ink-soft);">ไม่พบโรงเรียนที่ค้นหา</td></tr>';
      return;
    }
    tbody.innerHTML = list.map(function(s){
      return '<tr><td class="name">'+s['ชื่อโรงเรียน']+'</td><td>'+s['อำเภอ']+'</td><td>'+(s['ขนาดโรงเรียน']||'-')+'</td>'+
        '<td><span class="pill p-na">ยังไม่มีข้อมูล</span></td><td class="stat-na">ยังไม่มีข้อมูล</td></tr>';
    }).join('');
  }

  function filterSchools(q){
    q=q.trim().toLowerCase();
    if(!q){ renderSchools(schoolList); return; }
    renderSchools(schoolList.filter(function(s){
      return (s['ชื่อโรงเรียน']||'').toLowerCase().indexOf(q)>-1 || (s['อำเภอ']||'').toLowerCase().indexOf(q)>-1;
    }));
  }
  loadSchools();

  var schoolSizeChart=null, schoolNetChart=null;
  function renderSchoolCharts(list){
    // ---- กราฟวงกลม: ขนาดโรงเรียน ----
    var sizeOrder=['เล็ก','กลาง','ใหญ่','ใหญ่พิเศษ'];
    var sizeColors={'เล็ก':'#3d9bff','กลาง':'#0066cc','ใหญ่':'#11724a','ใหญ่พิเศษ':'#e0a52a'};
    var sizeCount={};
    list.forEach(function(s){ var k=(s['ขนาดโรงเรียน']||'').trim(); if(k){ sizeCount[k]=(sizeCount[k]||0)+1; } });
    var sizeLabels=sizeOrder.filter(function(k){ return sizeCount[k]; });
    Object.keys(sizeCount).forEach(function(k){ if(sizeLabels.indexOf(k)<0) sizeLabels.push(k); });
    var sizeData=sizeLabels.map(function(k){ return sizeCount[k]; });
    var sizeBg=sizeLabels.map(function(k){ return sizeColors[k]||'#b9b9c0'; });
    var total=sizeData.reduce(function(a,b){ return a+b; },0);
    if(schoolSizeChart) schoolSizeChart.destroy();
    schoolSizeChart=new Chart(document.getElementById('sizeChart'),{
      type:'doughnut',
      data:{labels:sizeLabels,datasets:[{data:sizeData,backgroundColor:sizeBg,borderColor:'#fff',borderWidth:2}]},
      options:{responsive:true,maintainAspectRatio:false,cutout:'58%',
        plugins:{legend:{position:'bottom',labels:{color:'#1d1d1f',font:{family:'Anuphan',size:13},padding:14,usePointStyle:true,pointStyle:'circle'}},
          tooltip:{callbacks:{label:function(c){ var p=total?Math.round(c.parsed/total*100):0; return ' '+c.label+': '+c.parsed+' แห่ง ('+p+'%)'; }}}}}
    });
    // ---- กราฟแท่ง: จำนวนโรงเรียนต่อเครือข่าย ----
    var netCount={};
    list.forEach(function(s){ var k=(s['เครือข่ายสถานศึกษา']||'').trim()||'ไม่ระบุ'; netCount[k]=(netCount[k]||0)+1; });
    var netLabels=Object.keys(netCount).sort(function(a,b){ return netCount[b]-netCount[a]; });
    var netData=netLabels.map(function(k){ return netCount[k]; });
    document.getElementById('netChart').parentNode.style.height=Math.max(280,netLabels.length*34+40)+'px';
    if(schoolNetChart) schoolNetChart.destroy();
    schoolNetChart=new Chart(document.getElementById('netChart'),{
      type:'bar',
      data:{labels:netLabels,datasets:[{data:netData,backgroundColor:'#0066cc',borderRadius:6}]},
      options:{indexAxis:'y',responsive:true,maintainAspectRatio:false,plugins:{legend:{display:false},
          tooltip:{callbacks:{label:function(c){ return ' '+c.parsed.x+' โรงเรียน'; }}}},
        scales:{x:{beginAtZero:true,grid:{color:'#ededf0',drawBorder:false},ticks:{precision:0,color:'#6e6e73',font:{family:'Anuphan',size:12}}},
          y:{grid:{display:false,drawBorder:false},ticks:{color:'#1d1d1f',font:{family:'Anuphan',size:12}}}}}
    });
  }

  /* ---------- การ์ดภาพรวมหน้าแรก: จำนวนโรงเรียน + อำเภอ (จากชีตโรงเรียนจริง) ---------- */
  function renderHomeSchoolStats(){
    var m1=document.getElementById('home-m1');
    if(m1) m1.textContent = schoolList.length ? schoolList.length : '–';
    var m4=document.getElementById('home-m4');
    if(m4){
      var set={};
      schoolList.forEach(function(s){ var a=(s['อำเภอ']||'').trim(); if(a) set[a]=1; });
      var n=Object.keys(set).length;
      m4.textContent = n || '–';
    }
  }

  /* ===== ผลประเมินคุณภาพภายใน (ข้อมูลตัวอย่าง — รอเชื่อมชีต 2) ===== */
  var QPILL={'ยอดเยี่ยม':'q-exc','ดีเลิศ':'q-de','ดี':'q-d','ปานกลาง':'q-mid','กำลังพัฒนา':'q-dev'};
  var QCOLOR={'ยอดเยี่ยม':'#11724a','ดีเลิศ':'#0066cc','ดี':'#3d9bff','ปานกลาง':'#e0a52a','กำลังพัฒนา':'#b9b9c0'};
  var QORDER=['ยอดเยี่ยม','ดีเลิศ','ดี','ปานกลาง','กำลังพัฒนา'];
  var INTERNAL_YEAR='2567';
  // [มฐ.1, มฐ.2, มฐ.3, สรุปภาพรวม]
  var INTERNAL_DEMO=[
    {name:'โรงเรียนบ้านนาทราย',   early:['ยอดเยี่ยม','ดีเลิศ','ยอดเยี่ยม','ยอดเยี่ยม'], basic:['ดีเลิศ','ดีเลิศ','ดี','ดีเลิศ']},
    {name:'โรงเรียนบ้านปวง',      early:['ดีเลิศ','ดีเลิศ','ดี','ดีเลิศ'],            basic:['ดีเลิศ','ดี','ดีเลิศ','ดีเลิศ']},
    {name:'โรงเรียนบ้านดง',       early:['ยอดเยี่ยม','ยอดเยี่ยม','ดีเลิศ','ยอดเยี่ยม'], basic:['ยอดเยี่ยม','ดีเลิศ','ดีเลิศ','ยอดเยี่ยม']},
    {name:'โรงเรียนบ้านห้วยหละ',  early:['ดี','ดี','ปานกลาง','ดี'],                  basic:['ดี','ดี','ดี','ดี']},
    {name:'โรงเรียนบ้านม่วงโตน',  early:['ดีเลิศ','ดี','ดี','ดี'],                    basic:['ดี','ปานกลาง','ดี','ดี']},
    {name:'โรงเรียนชุมชนบ้านป่าไผ่',early:['ดี','ปานกลาง','ปานกลาง','ปานกลาง'],        basic:['ปานกลาง','ปานกลาง','ดี','ปานกลาง']},
    {name:'โรงเรียนบ้านโฮ่ง',     early:['ดีเลิศ','ดีเลิศ','ดีเลิศ','ดีเลิศ'],         basic:['ยอดเยี่ยม','ดีเลิศ','ดีเลิศ','ยอดเยี่ยม']}
  ];
  // ===== ลิงก์ Publish to web (CSV) ของชีตจริง — ใส่เมื่อพร้อม แล้วหน้าจะดึงข้อมูลจริงทันที =====
  // ชีต "ผลประเมินภายใน": รหัสโรงเรียน,ชื่อโรงเรียน,ปีการศึกษา,ระดับ,มาตรฐานที่ 1,มาตรฐานที่ 2,มาตรฐานที่ 3,สรุปภาพรวม
  var INTERNAL_CSV_URL='https://docs.google.com/spreadsheets/d/e/2PACX-1vSzuUYQx4O8dQzhcH5vIWfO96SNy4-AV8f_oNE7WDYe6I4YSpWtYu28BCyTS9rb-MVGzX-3Iwr1jCNy/pub?gid=836912362&single=true&output=csv';
  // ชีต "เอกสาร SAR": รหัสโรงเรียน,ชื่อโรงเรียน,ปีการศึกษา,ลิงก์ไฟล์ SAR
  var SAR_CSV_URL='https://docs.google.com/spreadsheets/d/e/2PACX-1vSzuUYQx4O8dQzhcH5vIWfO96SNy4-AV8f_oNE7WDYe6I4YSpWtYu28BCyTS9rb-MVGzX-3Iwr1jCNy/pub?gid=1840610078&single=true&output=csv';
  var internalData=INTERNAL_DEMO.slice();   // ใช้ตัวอย่างก่อน จะถูกแทนด้วยข้อมูลจริงเมื่อโหลดสำเร็จ
  var sarLinks={};                          // key = "ชื่อโรงเรียน|ปีการศึกษา" -> ลิงก์ไฟล์

  function qpill(v){ return '<span class="pill '+(QPILL[v]||'p-na')+'">'+(v||'-')+'</span>'; }
  var DL_ICON='<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2"/><path d="M7 11l5 5 5-5"/><path d="M12 4v12"/></svg>';
  function sarCell(name){ return '<td><button class="btn-dl" onclick="downloadSAR(\''+name.replace(/'/g,"\\'")+'\')">'+DL_ICON+'SAR</button></td>'; }
  function renderInternalTable(tbodyId, key, list){
    if(!list.length){ document.getElementById(tbodyId).innerHTML='<tr><td colspan="6" style="text-align:center;color:var(--ink-soft);">ไม่พบโรงเรียนที่ค้นหา</td></tr>'; return; }
    var rows=list.map(function(s){
      var d=s[key];
      return '<tr><td class="name">'+s.name+'</td><td>'+qpill(d[0])+'</td><td>'+qpill(d[1])+
        '</td><td>'+qpill(d[2])+'</td><td>'+qpill(d[3])+'</td>'+sarCell(s.name)+'</tr>';
    }).join('');
    document.getElementById(tbodyId).innerHTML=rows;
  }
  function filterInternal(q){
    q=(q||'').trim().toLowerCase();
    var list=q?internalData.filter(function(s){ return s.name.toLowerCase().indexOf(q)>-1; }):internalData;
    renderInternalTable('internal-early','early',list);
    renderInternalTable('internal-basic','basic',list);
  }
  function downloadSAR(name){
    var y=document.getElementById('sar-year').value;
    var link=sarLinks[name+'|'+y];
    if(link){ window.open(link,'_blank','noopener'); return; }
    alert('ยังไม่มีไฟล์ SAR ของโรงเรียนนี้ ปีการศึกษา '+y+'\n(ในระบบจริง ปุ่มนี้จะเปิดไฟล์ PDF จาก Google Drive ตามที่ผู้ดูแลใส่ลิงก์ไว้ในชีตเอกสาร SAR)\n\nโรงเรียน: '+name);
  }
  var internalChart=null;
  function renderInternal(){
    renderInternalTable('internal-early','early',internalData);
    renderInternalTable('internal-basic','basic',internalData);
    // นับสรุปภาพรวมแต่ละระดับ
    var cE={}, cB={};
    QORDER.forEach(function(q){ cE[q]=0; cB[q]=0; });
    internalData.forEach(function(s){ if(cE[s.early[3]]!=null) cE[s.early[3]]++; if(cB[s.basic[3]]!=null) cB[s.basic[3]]++; });
    // การ์ดสรุป
    var totals=internalData.length*2, good=0, exc=0;
    internalData.forEach(function(s){
      [s.early[3],s.basic[3]].forEach(function(v){
        if(v==='ดี'||v==='ดีเลิศ'||v==='ยอดเยี่ยม') good++;
        if(v==='ยอดเยี่ยม') exc++;
      });
    });
    document.getElementById('in-m1').textContent=internalData.length;
    document.getElementById('in-m2').innerHTML=Math.round(good/totals*100)+'<span>%</span>';
    document.getElementById('in-m3').innerHTML=Math.round(exc/totals*100)+'<span>%</span>';
    document.getElementById('in-m4').textContent=INTERNAL_YEAR;
    var hm3=document.getElementById('home-m3');   /* การ์ด "คุณภาพระดับดีขึ้นไป" หน้าแรก ใช้ตัวเลขเดียวกับ in-m2 */
    if(hm3) hm3.innerHTML=Math.round(good/totals*100)+'<span>%</span>';
    renderHomeQualityChart();
    // กราฟแท่ง (จัดกลุ่ม ปฐมวัย/ขั้นพื้นฐาน)
    if(internalChart) internalChart.destroy();
    internalChart=new Chart(document.getElementById('internalChart'),{
      type:'bar',
      data:{labels:QORDER,datasets:[
        {label:'ปฐมวัย',backgroundColor:'#3d9bff',borderRadius:6,data:QORDER.map(function(q){return cE[q];})},
        {label:'ขั้นพื้นฐาน',backgroundColor:'#0066cc',borderRadius:6,data:QORDER.map(function(q){return cB[q];})}
      ]},
      options:{responsive:true,maintainAspectRatio:false,
        plugins:{legend:{position:'bottom',labels:{color:'#1d1d1f',font:{family:'Anuphan',size:13},usePointStyle:true,pointStyle:'circle',padding:14}}},
        scales:{y:{beginAtZero:true,grid:{color:'#ededf0',drawBorder:false},ticks:{precision:0,color:'#6e6e73',font:{family:'Anuphan',size:13}}},
          x:{grid:{display:false,drawBorder:false},ticks:{color:'#1d1d1f',font:{family:'Anuphan',size:13}}}}}
    });
  }

  /* ---------- การ์ดภาพรวมหน้าแรก: กราฟ+สัดส่วนระดับคุณภาพ (1 ระดับต่อโรงเรียน — ใช้สรุปภาพรวมขั้นพื้นฐาน
     ถ้าไม่มีให้ใช้ปฐมวัยแทน) ต่างจาก internalChart ที่แยกปฐมวัย/ขั้นพื้นฐานเป็นคนละแท่ง ---------- */
  var homeQC=null;
  function renderHomeQualityChart(){
    var box=document.getElementById('qc'); if(!box) return;
    var tierCount={}; QORDER.forEach(function(q){ tierCount[q]=0; });
    var counted=0;
    internalData.forEach(function(s){
      var tier=s.basic[3]||s.early[3];
      if(tier && tierCount[tier]!=null){ tierCount[tier]++; counted++; }
    });
    var data=QORDER.map(function(q){ return tierCount[q]; });
    var colors=QORDER.map(function(q){ return QCOLOR[q]; });
    if(homeQC) homeQC.destroy();
    homeQC=new Chart(box,{
      type:'bar',
      data:{labels:QORDER,datasets:[{data:data,backgroundColor:colors,borderRadius:8,barThickness:42}]},
      options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{display:false}},
        scales:{y:{beginAtZero:true,grid:{color:'#ededf0',drawBorder:false},ticks:{precision:0,color:'#6e6e73',font:{family:'Anuphan',size:13}}},
          x:{grid:{display:false,drawBorder:false},ticks:{color:'#1d1d1f',font:{family:'Anuphan',size:13}}}}}
    });
    var legend=document.getElementById('home-quality-legend');
    if(legend){
      legend.innerHTML=QORDER.map(function(q,i){
        var pct=counted?Math.round(tierCount[q]/counted*100):0;
        return '<div class="lg"><span class="l"><span class="sw" style="background:'+colors[i]+'"></span>'+tesc(q)+'</span><span class="v">'+pct+'%</span></div>';
      }).join('');
    }
    updateHomeDemoTag();
  }

  /* ---------- การ์ดภาพรวมหน้าแรก: % ส่ง SAR แล้ว (ปีล่าสุดที่มีข้อมูล / จำนวนโรงเรียนทั้งหมด) ---------- */
  function renderHomeSarStat(){
    var m2=document.getElementById('home-m2'); if(!m2) return;
    var hasReal=Object.keys(sarLinks).length>0;
    if(!hasReal || !schoolList.length){
      m2.innerHTML='92<span>%</span>';   /* ตัวอย่าง — ยังไม่มีข้อมูลจริงพอจะคำนวณ */
      updateHomeDemoTag();
      return;
    }
    var yearCount={};
    Object.keys(sarLinks).forEach(function(k){ var y=k.split('|')[1]; yearCount[y]=(yearCount[y]||0)+1; });
    var years=Object.keys(yearCount).sort(function(a,b){ return b.localeCompare(a); });
    var latest=years[0];
    var pct=Math.min(100, Math.round(yearCount[latest]/schoolList.length*100));
    m2.innerHTML=pct+'<span>%</span>';
    updateHomeDemoTag();
  }

  /* ---------- ป้าย "ข้อมูลตัวอย่างบางส่วน" หน้าแรก — โชว์ถ้าผลประเมินภายในหรือ SAR ยังไม่มีข้อมูลจริงครบ ---------- */
  function updateHomeDemoTag(){
    var tag=document.getElementById('home-demo-tag'); if(!tag) return;
    var internalTag=document.getElementById('internal-demo-tag');
    var internalReal = internalTag ? internalTag.style.display==='none' : false;
    var sarReal = Object.keys(sarLinks).length>0;
    tag.style.display = (internalReal && sarReal) ? 'none' : '';
  }

  function loadInternal(){
    if(!INTERNAL_CSV_URL){ renderInternal(); loadSAR(); return; }
    fetch(INTERNAL_CSV_URL).then(function(res){ return res.text(); }).then(function(text){
      var rows=parseCSV(text); var h=rows.shift().map(function(x){ return x.trim(); });
      var by={};
      rows.forEach(function(r){
        var o={}; h.forEach(function(k,i){ o[k]=(r[i]||'').trim(); });
        var name=o['ชื่อโรงเรียน']||o['รหัสโรงเรียน']; if(!name) return;
        if(!by[name]) by[name]={name:o['ชื่อโรงเรียน']||name,code:o['รหัสโรงเรียน']||'',year:o['ปีการศึกษา']||'',early:['','','',''],basic:['','','','']};
        var slot=(o['ระดับ']==='ปฐมวัย')?'early':'basic';
        by[name][slot]=[o['มาตรฐานที่ 1'],o['มาตรฐานที่ 2'],o['มาตรฐานที่ 3'],o['สรุปภาพรวม']];
        if(o['ปีการศึกษา']) by[name].year=o['ปีการศึกษา'];
      });
      var list=Object.keys(by).map(function(k){ return by[k]; });
      // ใช้เฉพาะโรงเรียนที่กรอกผลแล้วจริง (มีค่าในมาตรฐาน/สรุปอย่างน้อย 1 ช่อง)
      var assessed=list.filter(function(s){
        return (s.early[0]||s.early[3]||s.basic[0]||s.basic[3]);
      });
      var tag=document.getElementById('internal-demo-tag');
      if(assessed.length){
        internalData=assessed;
        if(assessed[0].year) INTERNAL_YEAR=assessed[0].year;
        if(tag) tag.style.display='none';
      } else {
        internalData=INTERNAL_DEMO.slice();   // ยังไม่กรอกผล → คงตัวอย่างไว้ให้ดูภาพ
        if(tag) tag.style.display='';
      }
      renderInternal();
    }).catch(function(err){ console.error('loadInternal error:', err); renderInternal(); })
      .then(function(){ loadSAR(); });
  }
  function loadSAR(){
    if(!SAR_CSV_URL) return;
    fetch(SAR_CSV_URL).then(function(res){ return res.text(); }).then(function(text){
      var rows=parseCSV(text); var h=rows.shift().map(function(x){ return x.trim(); });
      rows.forEach(function(r){
        var o={}; h.forEach(function(k,i){ o[k]=(r[i]||'').trim(); });
        var name=o['ชื่อโรงเรียน'], yr=o['ปีการศึกษา'], link=o['ลิงก์ไฟล์ SAR']||o['ลิงก์ไฟล์ SAR (Google Drive)'];
        if(name&&yr&&link) sarLinks[name+'|'+yr]=link;
      });
      if(typeof renderSarDocs==='function') renderSarDocs();
      renderHomeSarStat();
    }).catch(function(err){ console.error('loadSAR error:', err); });
  }
  loadInternal();

  /* ===== ศูนย์เอกสาร: ประกาศมาตรฐานและเป้าหมาย (รายโรงเรียน) ===== */
  var STANDARDS_DEMO=[
    {name:'โรงเรียนบ้านนาทราย', level:'ปฐมวัย / ขั้นพื้นฐาน'},
    {name:'โรงเรียนบ้านปวง',    level:'ปฐมวัย / ขั้นพื้นฐาน'},
    {name:'โรงเรียนบ้านดง',     level:'ขั้นพื้นฐาน'}
  ];
  // ===== ลิงก์ Publish to web (CSV) ของชีต "ประกาศมาตรฐานและเป้าหมาย" — ใส่เมื่อพร้อม =====
  // คอลัมน์: รหัสโรงเรียน,ชื่อโรงเรียน,ปีการศึกษา,ระดับที่ประกาศ,ลิงก์ไฟล์ PDF
  var STANDARDS_CSV_URL='';
  var standardsRows={};   // key = "ชื่อโรงเรียน|ปีการศึกษา" -> {level, link}

  function renderStandardsDocs(){
    var body=document.getElementById('standards-body'); if(!body) return;
    var y=document.getElementById('standards-year').value;
    var q=(document.getElementById('standards-search').value||'').trim().toLowerCase();
    var tag=document.getElementById('standards-demo-tag');
    var hasReal=Object.keys(standardsRows).length>0;
    var names = hasReal ? schoolList.map(function(s){ return s['ชื่อโรงเรียน']; }) : STANDARDS_DEMO.map(function(s){ return s.name; });
    if(tag) tag.style.display = hasReal ? 'none' : '';
    if(q) names=names.filter(function(n){ return (n||'').toLowerCase().indexOf(q)>-1; });
    if(!names.length){
      body.innerHTML='<tr><td colspan="4" style="text-align:center;color:var(--ink-soft);">ไม่พบโรงเรียนที่ค้นหา</td></tr>';
      return;
    }
    body.innerHTML=names.map(function(name){
      var rec = hasReal ? standardsRows[name+'|'+y] : {level:(STANDARDS_DEMO.filter(function(s){ return s.name===name; })[0]||{}).level};
      var level = rec ? rec.level : '';
      var link = rec ? rec.link : '';
      var cell = link
        ? '<button class="btn-dl" onclick="window.open(\''+link.replace(/'/g,"\\'")+'\',\'_blank\',\'noopener\')">'+DL_ICON+'PDF</button>'
        : (hasReal ? '<span class="pill p-na">ยังไม่เผยแพร่</span>' : '<button class="btn-dl" onclick="dl()">'+DL_ICON+'PDF</button>');
      return '<tr><td class="name">'+tesc(name)+'</td><td>'+y+'</td><td>'+(level||'-')+'</td><td>'+cell+'</td></tr>';
    }).join('');
  }
  function loadStandards(){
    if(!STANDARDS_CSV_URL){ renderStandardsDocs(); return; }
    fetch(STANDARDS_CSV_URL).then(function(res){ return res.text(); }).then(function(text){
      var rows=parseCSV(text); var h=rows.shift().map(function(x){ return x.trim(); });
      standardsRows={};
      rows.forEach(function(r){
        var o={}; h.forEach(function(k,i){ o[k]=(r[i]||'').trim(); });
        var name=o['ชื่อโรงเรียน'], yr=o['ปีการศึกษา'];
        if(name&&yr) standardsRows[name+'|'+yr]={level:o['ระดับที่ประกาศ']||'', link:o['ลิงก์ไฟล์ PDF']||o['ลิงก์ไฟล์']||''};
      });
      renderStandardsDocs();
    }).catch(function(err){ console.error('loadStandards error:', err); renderStandardsDocs(); });
  }
  loadStandards();

  /* ===== ศูนย์เอกสาร: แผนปฏิบัติการประจำปี (รายโรงเรียน) ===== */
  var ACTIONPLAN_DEMO=[
    {name:'โรงเรียนบ้านนาทราย', status:'เผยแพร่แล้ว'},
    {name:'โรงเรียนบ้านปวง',    status:'เผยแพร่แล้ว'},
    {name:'โรงเรียนวัดหนองยวง', status:'รอเผยแพร่'}
  ];
  // ===== ลิงก์ Publish to web (CSV) ของชีต "แผนปฏิบัติการประจำปี" — ใส่เมื่อพร้อม =====
  // คอลัมน์: รหัสโรงเรียน,ชื่อโรงเรียน,ปีการศึกษา,สถานะ,ลิงก์ไฟล์ PDF
  var ACTIONPLAN_CSV_URL='';
  var actionplanRows={};   // key = "ชื่อโรงเรียน|ปีการศึกษา" -> {status, link}

  function renderActionplanDocs(){
    var body=document.getElementById('actionplan-body'); if(!body) return;
    var y=document.getElementById('actionplan-year').value;
    var q=(document.getElementById('actionplan-search').value||'').trim().toLowerCase();
    var tag=document.getElementById('actionplan-demo-tag');
    var hasReal=Object.keys(actionplanRows).length>0;
    var names = hasReal ? schoolList.map(function(s){ return s['ชื่อโรงเรียน']; }) : ACTIONPLAN_DEMO.map(function(s){ return s.name; });
    if(tag) tag.style.display = hasReal ? 'none' : '';
    if(q) names=names.filter(function(n){ return (n||'').toLowerCase().indexOf(q)>-1; });
    if(!names.length){
      body.innerHTML='<tr><td colspan="4" style="text-align:center;color:var(--ink-soft);">ไม่พบโรงเรียนที่ค้นหา</td></tr>';
      return;
    }
    body.innerHTML=names.map(function(name){
      var rec = hasReal ? actionplanRows[name+'|'+y] : {status:(ACTIONPLAN_DEMO.filter(function(s){ return s.name===name; })[0]||{}).status};
      var status = rec ? rec.status : '';
      var link = rec ? rec.link : '';
      var statusClass = status==='เผยแพร่แล้ว' ? 'stat-ok' : status==='รอเผยแพร่' ? 'stat-wait' : '';
      var cell = link
        ? '<button class="btn-dl" onclick="window.open(\''+link.replace(/'/g,"\\'")+'\',\'_blank\',\'noopener\')">'+DL_ICON+'PDF</button>'
        : (status==='รอเผยแพร่' || hasReal) ? '—' : '<button class="btn-dl" onclick="dl()">'+DL_ICON+'PDF</button>';
      return '<tr><td class="name">'+tesc(name)+'</td><td>'+y+'</td><td class="'+statusClass+'">'+(status||'-')+'</td><td>'+cell+'</td></tr>';
    }).join('');
  }
  function loadActionplan(){
    if(!ACTIONPLAN_CSV_URL){ renderActionplanDocs(); return; }
    fetch(ACTIONPLAN_CSV_URL).then(function(res){ return res.text(); }).then(function(text){
      var rows=parseCSV(text); var h=rows.shift().map(function(x){ return x.trim(); });
      actionplanRows={};
      rows.forEach(function(r){
        var o={}; h.forEach(function(k,i){ o[k]=(r[i]||'').trim(); });
        var name=o['ชื่อโรงเรียน'], yr=o['ปีการศึกษา'];
        if(name&&yr) actionplanRows[name+'|'+yr]={status:o['สถานะ']||'', link:o['ลิงก์ไฟล์ PDF']||o['ลิงก์ไฟล์']||''};
      });
      renderActionplanDocs();
    }).catch(function(err){ console.error('loadActionplan error:', err); renderActionplanDocs(); });
  }
  loadActionplan();

  /* ===== ศูนย์เอกสาร: คู่มือ แบบฟอร์ม และระเบียบ (ไม่ผูกกับรายโรงเรียน) ===== */
  var GUIDES_DEMO=[
    {cat:'คู่มือประกันคุณภาพ',   name:'คู่มือการประกันคุณภาพภายในสถานศึกษา', link:''},
    {cat:'แบบฟอร์ม SAR',        name:'แบบฟอร์มรายงานการประเมินตนเอง (SAR) ระดับปฐมวัย', link:''},
    {cat:'แบบฟอร์ม SAR',        name:'แบบฟอร์มรายงานการประเมินตนเอง (SAR) ระดับขั้นพื้นฐาน', link:''},
    {cat:'เครื่องมือนิเทศ',      name:'เครื่องมือนิเทศติดตามการจัดการเรียนการสอน', link:''},
    {cat:'กฎหมายที่เกี่ยวข้อง',  name:'กฎกระทรวงการประกันคุณภาพการศึกษา พ.ศ. 2561', link:''}
  ];
  // ===== ลิงก์ Publish to web (CSV) ของชีต "คู่มือและแบบฟอร์ม" — ใส่เมื่อพร้อม =====
  // คอลัมน์: หมวด,ชื่อเอกสาร,ลิงก์ไฟล์
  var GUIDES_CSV_URL='';
  var guidesData=GUIDES_DEMO.slice();
  var guidesIsDemo=true;

  function guidesFillFilter(){
    var sel=document.getElementById('guides-cat'); if(!sel || sel.options.length) return;
    var cats=[]; guidesData.forEach(function(g){ if(g.cat && cats.indexOf(g.cat)<0) cats.push(g.cat); });
    sel.innerHTML='<option value="">ทุกหมวด</option>'+cats.map(function(c){ return '<option value="'+tesc(c)+'">'+tesc(c)+'</option>'; }).join('');
  }
  function renderGuides(){
    var body=document.getElementById('guides-body'); if(!body) return;
    guidesFillFilter();
    var q=(document.getElementById('guides-search').value||'').trim().toLowerCase();
    var fc=(document.getElementById('guides-cat')||{}).value||'';
    var tag=document.getElementById('guides-demo-tag');
    if(tag) tag.style.display = guidesIsDemo ? '' : 'none';
    var list=guidesData.filter(function(g){
      if(fc && g.cat!==fc) return false;
      if(q && g.name.toLowerCase().indexOf(q)<0) return false;
      return true;
    });
    if(!list.length){
      body.innerHTML='<tr><td colspan="3" style="text-align:center;color:var(--ink-soft);">ไม่พบเอกสารที่ค้นหา</td></tr>';
      return;
    }
    body.innerHTML=list.map(function(g){
      var i=guidesData.indexOf(g);
      return '<tr><td class="name">'+tesc(g.name)+'</td><td>'+tesc(g.cat||'-')+'</td><td><button class="btn-dl" onclick="openGuide('+i+')">'+DL_ICON+'PDF</button></td></tr>';
    }).join('');
  }
  function openGuide(i){
    var g=guidesData[i];
    if(g&&g.link){ window.open(g.link,'_blank','noopener'); return; }
    alert('ยังไม่มีไฟล์นี้ในระบบ\n(ในระบบจริง ปุ่มนี้จะเปิดไฟล์ PDF จาก Google Drive ตามที่ผู้ดูแลใส่ลิงก์ไว้ในชีต)\n\nเอกสาร: '+(g?g.name:''));
  }
  function loadGuides(){
    if(!GUIDES_CSV_URL){ guidesIsDemo=true; renderGuides(); return; }
    fetch(GUIDES_CSV_URL).then(function(res){ return res.text(); }).then(function(text){
      var rows=parseCSV(text); var h=rows.shift().map(function(x){ return x.trim(); });
      var list=[];
      rows.forEach(function(r){
        var o={}; h.forEach(function(k,i){ o[k]=(r[i]||'').trim(); });
        var name=o['ชื่อเอกสาร']; if(!name) return;
        list.push({cat:o['หมวด']||'อื่น ๆ', name:name, link:o['ลิงก์ไฟล์']||o['ลิงก์ไฟล์ PDF']||''});
      });
      if(list.length){ guidesData=list; guidesIsDemo=false; }
      else { guidesData=GUIDES_DEMO.slice(); guidesIsDemo=true; }
      var sel=document.getElementById('guides-cat'); if(sel) sel.innerHTML='';   /* รีเซ็ตให้ guidesFillFilter สร้างใหม่ตามข้อมูลจริง */
      renderGuides();
    }).catch(function(err){ console.error('loadGuides error:', err); renderGuides(); });
  }
  loadGuides();

  /* ===== ผลประเมินคุณภาพภายนอก (สมศ.) — ข้อมูลตัวอย่าง รอเชื่อมชีต ===== */
  var EPILL={'ดีเยี่ยม':'p-exc','ดีมาก':'p-vg','ดี':'p-good','พอใช้':'p-fair','ปรับปรุง':'p-imp'};
  /* ชุดสีกราฟต่างจากภายใน (ภายในโทนน้ำเงิน) → ภายนอกโทนม่วง–เขียวมรกต ไม่ใช้น้ำเงิน */
  var ECOLOR={'ดีเยี่ยม':'#6a4ca5','ดีมาก':'#2a9d8f','ดี':'#5cc2b1','พอใช้':'#e0a52a','ปรับปรุง':'#b9b9c0'};
  var EORDER=['ดีเยี่ยม','ดีมาก','ดี','พอใช้','ปรับปรุง'];
  // [ชื่อ, รอบ, ปี, ผล, ลิงก์รายงาน PDF]
  var EXTERNAL_DEMO=[
    {name:'โรงเรียนบ้านนาทราย', round:'รอบสี่', year:'2566', result:'ดีเยี่ยม', link:''},
    {name:'โรงเรียนบ้านปวง',    round:'รอบสี่', year:'2566', result:'ดีมาก',   link:''},
    {name:'โรงเรียนบ้านดง',     round:'รอบสี่', year:'2566', result:'ดีเยี่ยม', link:''},
    {name:'โรงเรียนบ้านห้วยหละ',round:'รอบสี่', year:'2566', result:'ดี',      link:''},
    {name:'โรงเรียนบ้านม่วงโตน',round:'รอบสี่', year:'2566', result:'ดีมาก',   link:''},
    {name:'โรงเรียนชุมชนบ้านป่าไผ่',round:'รอบสี่',year:'2566',result:'พอใช้', link:''},
    {name:'โรงเรียนบ้านโฮ่ง',   round:'รอบสี่', year:'2566', result:'ดีเยี่ยม', link:''}
  ];
  // ===== ลิงก์ Publish to web (CSV) ของชีต "ผลประเมินภายนอก" — ใส่เมื่อพร้อม =====
  // คอลัมน์: รหัสโรงเรียน,ชื่อโรงเรียน,รอบการประเมิน,ปีที่ประเมิน,ผลการประเมิน,ลิงก์รายงาน
  var EXTERNAL_CSV_URL='https://docs.google.com/spreadsheets/d/e/2PACX-1vSzuUYQx4O8dQzhcH5vIWfO96SNy4-AV8f_oNE7WDYe6I4YSpWtYu28BCyTS9rb-MVGzX-3Iwr1jCNy/pub?gid=1019738453&single=true&output=csv';
  var externalData=EXTERNAL_DEMO.slice();

  function epill(v){ return '<span class="pill '+(EPILL[v]||'p-na')+'">'+(v||'-')+'</span>'; }
  function extCell(idx){ return '<td><button class="btn-dl" onclick="downloadExternal('+idx+')">'+DL_ICON+'PDF</button></td>'; }
  function renderExternalTable(list){
    var body=document.getElementById('external-body');
    if(!list.length){ body.innerHTML='<tr><td colspan="5" style="text-align:center;color:var(--ink-soft);">ไม่พบโรงเรียนที่ค้นหา</td></tr>'; return; }
    body.innerHTML=list.map(function(s){
      var i=externalData.indexOf(s);
      return '<tr><td class="name">'+s.name+'</td><td>'+(s.round||'-')+'</td><td>'+(s.year||'-')+
        '</td><td>'+epill(s.result)+'</td>'+extCell(i)+'</tr>';
    }).join('');
  }
  function filterExternal(q){
    q=(q||'').trim().toLowerCase();
    var list=q?externalData.filter(function(s){ return s.name.toLowerCase().indexOf(q)>-1; }):externalData;
    renderExternalTable(list);
  }
  function downloadExternal(i){
    var s=externalData[i];
    if(s&&s.link){ window.open(s.link,'_blank','noopener'); return; }
    alert('ยังไม่มีไฟล์รายงานผลประเมินภายนอกของโรงเรียนนี้\n(ในระบบจริง ปุ่มนี้จะเปิดไฟล์ PDF จาก Google Drive ตามที่ผู้ดูแลใส่ลิงก์ไว้ในชีต)\n\nโรงเรียน: '+(s?s.name:''));
  }
  var externalChart=null;
  function renderExternal(){
    renderExternalTable(externalData);
    var cnt={}; EORDER.forEach(function(q){ cnt[q]=0; });
    var good=0, withFile=0;
    externalData.forEach(function(s){
      if(cnt[s.result]!=null) cnt[s.result]++;
      if(s.result==='ดีเยี่ยม'||s.result==='ดีมาก'||s.result==='ดี') good++;
      if(s.link) withFile++;
    });
    var n=externalData.length;
    var latest=externalData[0]?((externalData[0].round?externalData[0].round+' / ':'')+(externalData[0].year||'')):'–';
    document.getElementById('ex-m1').textContent=n;
    document.getElementById('ex-m2').innerHTML=(n?Math.round(good/n*100):0)+'<span>%</span>';
    document.getElementById('ex-m3').textContent=latest||'–';
    document.getElementById('ex-m4').textContent=withFile;
    var labels=EORDER.filter(function(q){ return cnt[q]; });
    if(externalChart) externalChart.destroy();
    externalChart=new Chart(document.getElementById('externalChart'),{
      type:'doughnut',
      data:{labels:labels,datasets:[{data:labels.map(function(q){return cnt[q];}),backgroundColor:labels.map(function(q){return ECOLOR[q];}),borderColor:'#fff',borderWidth:2}]},
      options:{responsive:true,maintainAspectRatio:false,cutout:'58%',
        plugins:{legend:{position:'bottom',labels:{color:'#1d1d1f',font:{family:'Anuphan',size:13},padding:14,usePointStyle:true,pointStyle:'circle'}},
          tooltip:{callbacks:{label:function(c){ var p=n?Math.round(c.parsed/n*100):0; return ' '+c.label+': '+c.parsed+' แห่ง ('+p+'%)'; }}}}}
    });
  }
  function loadExternal(){
    if(!EXTERNAL_CSV_URL){ renderExternal(); return; }
    fetch(EXTERNAL_CSV_URL).then(function(res){ return res.text(); }).then(function(text){
      var rows=parseCSV(text); var h=rows.shift().map(function(x){ return x.trim(); });
      var list=[];
      rows.forEach(function(r){
        var o={}; h.forEach(function(k,i){ o[k]=(r[i]||'').trim(); });
        var name=o['ชื่อโรงเรียน']||o['รหัสโรงเรียน']; if(!name) return;
        list.push({name:o['ชื่อโรงเรียน']||name,round:o['รอบการประเมิน']||'',year:o['ปีที่ประเมิน']||o['ปี']||'',
          result:o['ผลการประเมิน']||'',link:o['ลิงก์รายงาน']||o['ลิงก์ไฟล์']||o['ลิงก์รายงาน (Google Drive)']||''});
      });
      var assessed=list.filter(function(s){ return s.result; });
      var tag=document.getElementById('external-demo-tag');
      if(assessed.length){ externalData=assessed; if(tag) tag.style.display='none'; }
      else { externalData=EXTERNAL_DEMO.slice(); if(tag) tag.style.display=''; }
      renderExternal();
    }).catch(function(err){ console.error('loadExternal error:', err); renderExternal(); });
  }
  loadExternal();

  /* ===== บุคลากรและนักเรียน — ดึงจากชีตโรงเรียน (Sheet 1) เมื่อกรอกครบ ===== */
  /* ชีตโรงเรียนเพิ่ม 2 คอลัมน์: "ครู" และ "บุคลากรอื่น" (มี จำนวนนักเรียน, ผู้บริหาร อยู่แล้ว) */
  var PERSONNEL_DEMO=[
    {'ชื่อโรงเรียน':'โรงเรียนบ้านนาทราย',    'อำเภอ':'ลี้',           'ขนาดโรงเรียน':'ใหญ่', 'จำนวนนักเรียน':'512','ผู้บริหาร':'2','ครู':'28','บุคลากรอื่น':'6'},
    {'ชื่อโรงเรียน':'โรงเรียนบ้านปวง',       'อำเภอ':'ลี้',           'ขนาดโรงเรียน':'กลาง', 'จำนวนนักเรียน':'236','ผู้บริหาร':'1','ครู':'14','บุคลากรอื่น':'3'},
    {'ชื่อโรงเรียน':'โรงเรียนชุมชนบ้านป่าไผ่','อำเภอ':'ลี้',           'ขนาดโรงเรียน':'ใหญ่', 'จำนวนนักเรียน':'448','ผู้บริหาร':'2','ครู':'25','บุคลากรอื่น':'5'},
    {'ชื่อโรงเรียน':'โรงเรียนบ้านม่วงโตน',   'อำเภอ':'เวียงหนองล่อง','ขนาดโรงเรียน':'กลาง', 'จำนวนนักเรียน':'301','ผู้บริหาร':'1','ครู':'18','บุคลากรอื่น':'4'},
    {'ชื่อโรงเรียน':'โรงเรียนวัดหนองยวง',    'อำเภอ':'เวียงหนองล่อง','ขนาดโรงเรียน':'กลาง', 'จำนวนนักเรียน':'188','ผู้บริหาร':'1','ครู':'12','บุคลากรอื่น':'2'},
    {'ชื่อโรงเรียน':'โรงเรียนบ้านดง',        'อำเภอ':'ทุ่งหัวช้าง',  'ขนาดโรงเรียน':'เล็ก', 'จำนวนนักเรียน':'96', 'ผู้บริหาร':'1','ครู':'8', 'บุคลากรอื่น':'2'},
    {'ชื่อโรงเรียน':'โรงเรียนบ้านห้วยหละ',   'อำเภอ':'บ้านโฮ่ง',     'ขนาดโรงเรียน':'เล็ก', 'จำนวนนักเรียน':'82', 'ผู้บริหาร':'1','ครู':'7', 'บุคลากรอื่น':'1'},
    {'ชื่อโรงเรียน':'โรงเรียนบ้านห้วยน้ำดิบ', 'อำเภอ':'บ้านโฮ่ง',     'ขนาดโรงเรียน':'เล็ก', 'จำนวนนักเรียน':'54', 'ผู้บริหาร':'1','ครู':'5', 'บุคลากรอื่น':'1'}
  ];
  var personnelData=PERSONNEL_DEMO.slice();

  function pnum(v){ var n=parseInt(String(v||'').replace(/[^0-9]/g,''),10); return isNaN(n)?0:n; }
  function comma(n){ return n.toLocaleString('en-US'); }
  function rankCard(s,rank,cls){
    var adm=pnum(s['ผู้บริหาร']), tea=pnum(s['ครู']), oth=pnum(s['บุคลากรอื่น']);
    return '<div class="rank-card '+cls+'"><div class="badge">'+rank+'</div>'+
      '<div class="rname">'+(s['ชื่อโรงเรียน']||'-')+'</div>'+
      '<div class="rsub">อ.'+(s['อำเภอ']||'-')+(s['ขนาดโรงเรียน']?' · ขนาด'+s['ขนาดโรงเรียน']:'')+'</div>'+
      '<div class="rstu">'+comma(pnum(s['จำนวนนักเรียน']))+'<span>นักเรียน</span></div>'+
      '<div class="rank-staff">'+
        '<div><span class="k">ผอ./รอง</span><span class="v">'+adm+'</span></div>'+
        '<div><span class="k">ครู</span><span class="v">'+tea+'</span></div>'+
        '<div><span class="k">บุคลากรอื่น</span><span class="v">'+oth+'</span></div>'+
        '<div><span class="k">รวมบุคลากร</span><span class="v">'+(adm+tea+oth)+'</span></div>'+
      '</div></div>';
  }
  function renderPersonnelTable(list){
    var body=document.getElementById('personnel-body');
    if(!list.length){ body.innerHTML='<tr><td colspan="6" style="text-align:center;color:var(--ink-soft);">ไม่พบโรงเรียนที่ค้นหา</td></tr>'; return; }
    body.innerHTML=list.map(function(s){
      return '<tr><td class="name">'+(s['ชื่อโรงเรียน']||'-')+'</td><td>'+(s['อำเภอ']||'-')+'</td>'+
        '<td class="numr">'+pnum(s['ผู้บริหาร'])+'</td><td class="numr">'+pnum(s['ครู'])+'</td>'+
        '<td class="numr">'+comma(pnum(s['จำนวนนักเรียน']))+'</td><td class="numr">'+pnum(s['บุคลากรอื่น'])+'</td></tr>';
    }).join('');
  }
  function filterPersonnel(q){
    q=(q||'').trim().toLowerCase();
    var sorted=personnelData.slice().sort(function(a,b){ return pnum(b['จำนวนนักเรียน'])-pnum(a['จำนวนนักเรียน']); });
    var list=q?sorted.filter(function(s){ return (s['ชื่อโรงเรียน']||'').toLowerCase().indexOf(q)>-1 || (s['อำเภอ']||'').toLowerCase().indexOf(q)>-1; }):sorted;
    renderPersonnelTable(list);
  }
  function renderPersonnel(){
    var tA=0,tT=0,tS=0,tO=0;
    personnelData.forEach(function(s){ tA+=pnum(s['ผู้บริหาร']); tT+=pnum(s['ครู']); tS+=pnum(s['จำนวนนักเรียน']); tO+=pnum(s['บุคลากรอื่น']); });
    document.getElementById('pn-admin').textContent=comma(tA);
    document.getElementById('pn-teacher').textContent=comma(tT);
    document.getElementById('pn-student').textContent=comma(tS);
    document.getElementById('pn-other').textContent=comma(tO);
    var sorted=personnelData.slice().sort(function(a,b){ return pnum(b['จำนวนนักเรียน'])-pnum(a['จำนวนนักเรียน']); });
    var top=sorted.slice(0,3);
    var bottom=sorted.slice(-3).reverse();   // น้อยสุดขึ้นก่อน
    document.getElementById('rank-top').innerHTML=top.map(function(s,i){ return rankCard(s,i+1,'t'); }).join('');
    document.getElementById('rank-bottom').innerHTML=bottom.map(function(s,i){ return rankCard(s,i+1,'b'); }).join('');
    renderPersonnelTable(sorted);
  }
  function loadPersonnel(){
    // ใช้ข้อมูลจริงจากชีตโรงเรียน เฉพาะโรงเรียนที่กรอกจำนวนนักเรียนแล้ว
    var real=(window.schoolList||[]).filter(function(s){ return pnum(s['จำนวนนักเรียน'])>0; });
    var tag=document.getElementById('personnel-demo-tag');
    if(real.length){ personnelData=real; if(tag) tag.style.display='none'; }
    else { personnelData=PERSONNEL_DEMO.slice(); if(tag) tag.style.display=''; }
    renderPersonnel();
  }
  loadPersonnel();

  /* ===== ศูนย์เอกสาร: รายการ SAR (ใช้ลิงก์จากชีต "เอกสาร SAR" ที่เชื่อมไว้แล้ว) ===== */
  function renderSarDocs(){
    var body=document.getElementById('sardocs-body'); if(!body) return;
    var y=document.getElementById('sardocs-year').value;
    var q=(document.getElementById('sardocs-search').value||'').trim().toLowerCase();
    var tag=document.getElementById('sardocs-demo-tag');
    var hasReal=Object.keys(sarLinks).length>0;
    var rows=[];
    if(hasReal){
      if(tag) tag.style.display='none';
      Object.keys(sarLinks).forEach(function(k){
        var p=k.split('|'); if(p[1]===y) rows.push({name:p[0],year:y,link:sarLinks[k]});
      });
      rows.sort(function(a,b){ return a.name.localeCompare(b.name,'th'); });
    } else {
      if(tag) tag.style.display='';
      INTERNAL_DEMO.forEach(function(s){ rows.push({name:s.name,year:y,link:''}); });
    }
    if(q) rows=rows.filter(function(r){ return r.name.toLowerCase().indexOf(q)>-1; });
    if(!rows.length){
      body.innerHTML='<tr><td colspan="4" style="text-align:center;color:var(--ink-soft);">'+
        (hasReal?('ยังไม่มีไฟล์ SAR สำหรับปีการศึกษา '+y):'ไม่พบโรงเรียนที่ค้นหา')+'</td></tr>';
      return;
    }
    body.innerHTML=rows.map(function(r){
      var has=!!r.link;
      var status=has?'<span class="pill p-exc">มีไฟล์</span>':(hasReal?'<span class="pill p-na">ยังไม่มีไฟล์</span>':'<span class="pill p-na">ตัวอย่าง</span>');
      var btn=has
        ?'<button class="btn-dl" onclick="window.open(\''+r.link.replace(/'/g,"\\'")+'\',\'_blank\',\'noopener\')">'+DL_ICON+'PDF</button>'
        :'<button class="btn-dl" onclick="openSarDoc(\''+r.name.replace(/'/g,"\\'")+'\')">'+DL_ICON+'PDF</button>';
      return '<tr><td class="name">'+r.name+'</td><td>'+r.year+'</td><td>'+status+'</td><td>'+btn+'</td></tr>';
    }).join('');
  }
  function openSarDoc(name){
    var y=document.getElementById('sardocs-year').value;
    var link=sarLinks[name+'|'+y];
    if(link){ window.open(link,'_blank','noopener'); return; }
    alert('ยังไม่มีไฟล์ SAR ของโรงเรียนนี้ ปีการศึกษา '+y+'\n(ในระบบจริง ปุ่มนี้จะเปิดไฟล์ PDF จาก Google Drive ตามที่ผู้ดูแลใส่ลิงก์ไว้ในชีตเอกสาร SAR)\n\nโรงเรียน: '+name);
  }
  renderSarDocs();

  function sendFb(){
    var name=document.getElementById('f-name').value.trim();
    var type=document.getElementById('f-type').value;
    var email=document.getElementById('f-email').value.trim();
    var msg=document.getElementById('f-msg').value.trim();
    if(!msg){ alert('กรุณาพิมพ์ข้อความก่อนส่งครับ'); return; }

    function done(){
      document.getElementById('ok').style.display='block';
      document.getElementById('f-name').value='';
      document.getElementById('f-email').value='';
      document.getElementById('f-msg').value='';
      window.scrollTo({top:0,behavior:'smooth'});
    }

    if(!TASKS_API_URL){ done(); return; }   /* ยังไม่ได้เชื่อมระบบจริง — คงพฤติกรรมตัวอย่างเดิมไว้ */

    var btn=document.getElementById('fb-submit-btn');
    if(btn){ btn.disabled=true; btn.textContent='กำลังส่ง...'; }
    tapi({action:'feedback', data:{name:name, type:type, email:email, msg:msg}}).then(function(res){
      if(res && res.ok) done();
      else alert('ส่งไม่สำเร็จ: '+((res&&res.error)||'กรุณาลองใหม่อีกครั้ง'));
    }).catch(function(err){
      console.error('sendFb error:', err);
      alert('ส่งไม่สำเร็จ กรุณาลองใหม่อีกครั้ง หรือตรวจสอบการเชื่อมต่ออินเทอร์เน็ต');
    }).finally(function(){
      if(btn){ btn.disabled=false; btn.textContent='ส่งข้อความ'; }
    });
  }


  /* ===== ผลการพัฒนาผู้เรียน: แท็บผลสัมฤทธิ์ทางการเรียน ===== */
  var ACH_SUBJECTS=[
    {n:'ภาษาไทย',t:'พื้นฐาน'},
    {n:'คณิตศาสตร์',t:'พื้นฐาน'},
    {n:'วิทยาศาสตร์และเทคโนโลยี',t:'พื้นฐาน'},
    {n:'สังคมศึกษาฯ',t:'พื้นฐาน'},
    {n:'ประวัติศาสตร์',t:'พื้นฐาน'},
    {n:'สุขศึกษาและพลศึกษา',t:'พื้นฐาน'},
    {n:'ศิลปะ',t:'พื้นฐาน'},
    {n:'การงานอาชีพ',t:'พื้นฐาน'},
    {n:'ภาษาต่างประเทศ',t:'พื้นฐาน'},
    {n:'ภาษาอังกฤษเพื่อการสื่อสาร',t:'เพิ่มเติม'},
    {n:'หน้าที่พลเมือง',t:'เพิ่มเติม'}
  ];
  var ACH_GRADES=['ป.1','ป.2','ป.3','ป.4','ป.5','ป.6','ม.1','ม.2','ม.3'];
  var ACH_LEVELS=['5','4','3','2','1','0'];   // 6 ค่า เรียงจากดีสุด → ต่ำสุด
  var ACH_COLORS={'5':'#11724a','4':'#3bbf86','3':'#0066cc','2':'#7fb0e6','1':'#e0a52a','0':'#d35450'};
  // คอลัมน์ชีต "ผลสัมฤทธิ์": ปีการศึกษา,รหัสโรงเรียน,ชื่อโรงเรียน,ระดับชั้น,วิชา,ประเภท,ระดับ5,ระดับ4,ระดับ3,ระดับ2,ระดับ1,ระดับ0
  var ACHIEVEMENT_CSV_URL='https://docs.google.com/spreadsheets/d/e/2PACX-1vSzuUYQx4O8dQzhcH5vIWfO96SNy4-AV8f_oNE7WDYe6I4YSpWtYu28BCyTS9rb-MVGzX-3Iwr1jCNy/pub?gid=1760746316&single=true&output=csv';

  var ACH_DEMO_SCHOOLS=['โรงเรียนบ้านนาทราย','โรงเรียนบ้านปวง','โรงเรียนบ้านดง','โรงเรียนบ้านห้วยหละ','โรงเรียนบ้านม่วงโตน','โรงเรียนชุมชนบ้านป่าไผ่','โรงเรียนบ้านโฮ่ง','โรงเรียนบ้านแม่หาด'];
  function achNum(v){ var n=parseInt(String(v==null?'':v).replace(/[^0-9]/g,''),10); return isNaN(n)?0:n; }
  function achRowCounts(r){ return ACH_LEVELS.map(function(L){ return achNum(r['ระดับ'+L]); }); }
  function achDemoRows(){
    var rows=[], yr='2567';
    for(var si=0; si<ACH_DEMO_SCHOOLS.length; si++){
      for(var gi=0; gi<ACH_GRADES.length; gi++){
        for(var ji=0; ji<ACH_SUBJECTS.length; ji++){
          var seed=si*7+gi*3+ji*5;
          var total=12+((seed*13)%19);
          var w=[(seed%5)+2,(seed%4)+3,(seed%6)+4,(seed%4)+2,(seed%3)+1,(seed%2)];
          var sw=w[0]+w[1]+w[2]+w[3]+w[4]+w[5];
          var counts=[], used=0;
          for(var k=0;k<6;k++){ var c=(k===5)?(total-used):Math.round(total*w[k]/sw); if(c<0)c=0; used+=c; counts.push(c); }
          rows.push({'ปีการศึกษา':yr,'ชื่อโรงเรียน':ACH_DEMO_SCHOOLS[si],'ระดับชั้น':ACH_GRADES[gi],'วิชา':ACH_SUBJECTS[ji].n,'ประเภท':ACH_SUBJECTS[ji].t,
            'ระดับ5':counts[0],'ระดับ4':counts[1],'ระดับ3':counts[2],'ระดับ2':counts[3],'ระดับ1':counts[4],'ระดับ0':counts[5]});
        }
      }
    }
    return rows;
  }
  var achData=achDemoRows();
  var achChart=null;

  function achPopulateFilters(){
    var years=[]; achData.forEach(function(r){ var y=(r['ปีการศึกษา']||'').trim(); if(y&&years.indexOf(y)<0)years.push(y); });
    years.sort(function(a,b){return b.localeCompare(a);});
    var ys=document.getElementById('ach-year'); var pv=ys.value;
    ys.innerHTML=(years.length?years:['—']).map(function(y){return '<option value="'+y+'">'+y+'</option>';}).join('');
    if(years.indexOf(pv)>=0)ys.value=pv;
    var gset={}; achData.forEach(function(r){ gset[(r['ระดับชั้น']||'').trim()]=1; });
    var grades=ACH_GRADES.filter(function(g){return gset[g];}); if(!grades.length)grades=ACH_GRADES.slice();
    var gs=document.getElementById('ach-grade'); var pg=gs.value;
    gs.innerHTML=grades.map(function(g){return '<option value="'+g+'">'+g+'</option>';}).join('');
    gs.value=(grades.indexOf(pg)>=0)?pg:(grades.indexOf('ป.6')>=0?'ป.6':grades[0]);
    var sset={}; achData.forEach(function(r){ var n=(r['ชื่อโรงเรียน']||'').trim(); if(n)sset[n]=1; });
    var schools=Object.keys(sset).sort(function(a,b){return a.localeCompare(b,'th');});
    var ss=document.getElementById('ach-school'); var ps=ss.value;
    ss.innerHTML='<option value="">ภาพรวมระดับเขต (ทุกโรงเรียน)</option>'+schools.map(function(s){return '<option value="'+s.replace(/"/g,'&quot;')+'">'+s+'</option>';}).join('');
    if(ps===''||sset[ps])ss.value=ps;
  }

  function achPickSchool(name){ document.getElementById('ach-school').value=name; renderAchievement(); var v=document.getElementById('view-achievement'); window.scrollTo({top:v.offsetTop-10,behavior:'smooth'}); }

  function renderAchTable(){
    var year=document.getElementById('ach-year').value, grade=document.getElementById('ach-grade').value;
    var q=(document.getElementById('ach-search').value||'').trim().toLowerCase();
    var rows=achData.filter(function(r){ return (r['ปีการศึกษา']||'').trim()===year && (r['ระดับชั้น']||'').trim()===grade; });
    var by={};
    rows.forEach(function(r){ var sn=(r['ชื่อโรงเรียน']||'').trim(); if(!sn)return; if(!by[sn])by[sn]={}; var c=achRowCounts(r); var t=c[0]+c[1]+c[2]+c[3]+c[4]+c[5]; by[sn][(r['วิชา']||'').trim()]= t?((c[0]+c[1]+c[2])/t*100):null; });
    var schools=Object.keys(by).sort(function(a,b){return a.localeCompare(b,'th');});
    if(q)schools=schools.filter(function(s){return s.toLowerCase().indexOf(q)>-1;});
    document.getElementById('ach-thead').innerHTML='<tr><th style="position:sticky;left:0;background:var(--bg);z-index:1;">โรงเรียน</th>'+ACH_SUBJECTS.map(function(s){return '<th title="วิชา'+s.t+'">'+s.n+(s.t==='เพิ่มเติม'?' *':'')+'</th>';}).join('')+'</tr>';
    if(!schools.length){ document.getElementById('ach-body').innerHTML='<tr><td colspan="'+(ACH_SUBJECTS.length+1)+'" style="text-align:center;color:var(--ink-soft);">ไม่พบข้อมูลที่ค้นหา</td></tr>'; return; }
    document.getElementById('ach-body').innerHTML=schools.map(function(s){
      var tds=ACH_SUBJECTS.map(function(sub){ var v=by[s][sub.n]; if(v==null)return '<td>–</td>'; var cls=v>=80?'hi':(v>=50?'mid':'lo'); return '<td><span class="pcell '+cls+'">'+Math.round(v)+'%</span></td>'; }).join('');
      return '<tr><td class="name" style="position:sticky;left:0;background:var(--bg);z-index:1;cursor:pointer;" onclick="achPickSchool(\''+s.replace(/'/g,"\\'")+'\')">'+s+'</td>'+tds+'</tr>';
    }).join('');
  }

  function renderAchievement(){
    var year=document.getElementById('ach-year').value, grade=document.getElementById('ach-grade').value, school=document.getElementById('ach-school').value;
    var base=achData.filter(function(r){ return (r['ปีการศึกษา']||'').trim()===year && (r['ระดับชั้น']||'').trim()===grade; });
    var forChart=school?base.filter(function(r){return (r['ชื่อโรงเรียน']||'').trim()===school;}):base;
    var bySub={}; ACH_SUBJECTS.forEach(function(s){ bySub[s.n]=[0,0,0,0,0,0]; });
    forChart.forEach(function(r){ var sn=(r['วิชา']||'').trim(); if(!bySub[sn])bySub[sn]=[0,0,0,0,0,0]; var c=achRowCounts(r); for(var i=0;i<6;i++)bySub[sn][i]+=c[i]; });
    var labels=ACH_SUBJECTS.map(function(s){return s.n;});
    var datasets=ACH_LEVELS.map(function(L,li){
      return {label:'ระดับ '+L,backgroundColor:ACH_COLORS[L],borderRadius:3,stack:'s',
        data:labels.map(function(sn){ var a=bySub[sn]; var tot=a[0]+a[1]+a[2]+a[3]+a[4]+a[5]; return tot?+(a[li]/tot*100).toFixed(1):0; })};
    });
    if(achChart)achChart.destroy();
    achChart=new Chart(document.getElementById('achChart'),{
      type:'bar', data:{labels:labels,datasets:datasets},
      options:{responsive:true,maintainAspectRatio:false,
        plugins:{legend:{display:false},tooltip:{callbacks:{label:function(ctx){return ctx.dataset.label+': '+ctx.parsed.y+'%';}}}},
        scales:{x:{stacked:true,grid:{display:false,drawBorder:false},ticks:{color:'#1d1d1f',font:{family:'Anuphan',size:11},maxRotation:60,minRotation:45}},
          y:{stacked:true,beginAtZero:true,max:100,grid:{color:'#ededf0',drawBorder:false},ticks:{color:'#6e6e73',font:{family:'Anuphan',size:12},callback:function(v){return v+'%';}}}}}
    });
    document.getElementById('ach-legend').innerHTML=ACH_LEVELS.map(function(L){return '<span><i style="background:'+ACH_COLORS[L]+'"></i>ระดับ '+L+'</span>';}).join('')+'<span style="margin-left:auto;">* = รายวิชาเพิ่มเติม</span>';
    document.getElementById('ach-chart-sub').textContent=(school||'ภาพรวมระดับเขต (ทุกโรงเรียน)')+' · ชั้น '+grade+' · ปีการศึกษา '+year+' · สัดส่วนระดับผลการเรียน (ร้อยละ)';
    var sset={}, gtot=0, good=0, exc=0;
    base.forEach(function(r){ sset[(r['ชื่อโรงเรียน']||'').trim()]=1; var c=achRowCounts(r); gtot+=c[0]+c[1]+c[2]+c[3]+c[4]+c[5]; good+=c[0]+c[1]+c[2]; exc+=c[0]+c[1]; });
    document.getElementById('ach-m1').textContent=Object.keys(sset).filter(Boolean).length;
    document.getElementById('ach-m2').innerHTML=(gtot?Math.round(good/gtot*100):0)+'<span>%</span>';
    document.getElementById('ach-m3').innerHTML=(gtot?Math.round(exc/gtot*100):0)+'<span>%</span>';
    document.getElementById('ach-m4').textContent=gtot.toLocaleString('en-US');
    renderAchTable();
  }

  function loadAchievement(){
    function useDemo(){ achData=achDemoRows(); var t=document.getElementById('ach-demo-tag'); if(t)t.style.display=''; achPopulateFilters(); renderAchievement(); }
    if(!ACHIEVEMENT_CSV_URL){ useDemo(); return; }
    fetch(ACHIEVEMENT_CSV_URL).then(function(res){return res.text();}).then(function(text){
      var arr=parseCSV(text); var h=arr.shift().map(function(x){return x.trim();});
      var real=arr.map(function(r){ var o={}; h.forEach(function(k,i){o[k]=(r[i]||'').trim();}); return o; }).filter(function(o){
        return (o['ชื่อโรงเรียน']||o['รหัสโรงเรียน']) && o['วิชา'] && (achNum(o['ระดับ5'])+achNum(o['ระดับ4'])+achNum(o['ระดับ3'])+achNum(o['ระดับ2'])+achNum(o['ระดับ1'])+achNum(o['ระดับ0'])>0);
      });
      if(real.length){ achData=real; var t=document.getElementById('ach-demo-tag'); if(t)t.style.display='none'; achPopulateFilters(); renderAchievement(); }
      else useDemo();
    }).catch(function(err){ console.error('loadAchievement error:',err); useDemo(); });
  }
  loadAchievement();

  arm(document.getElementById('view-home'));

  /* ==================================================================
     งานที่ต้องส่งเขต (deadline board)
     ------------------------------------------------------------------
     วิธีเชื่อมระบบจริง: นำ URL ที่ได้จากการ Deploy Google Apps Script
     (ลงท้ายด้วย /exec) มาใส่ในตัวแปร TASKS_API_URL ด้านล่างนี้
     ถ้าเว้นว่างไว้ เว็บจะแสดงข้อมูลตัวอย่างเพื่อสาธิตแทน
     ================================================================== */
  var TASKS_API_URL = 'https://script.google.com/macros/s/AKfycbzq6o4Gw7kQ7F67PjGbmO7RdaQfuLURCgjuzdsoKBsGqpDpdk1oTUmdXCDxZj2tFgiG7A/exec';
  (function(){ var t=document.getElementById('feedback-demo-tag'); if(t) t.style.display = TASKS_API_URL ? 'none' : ''; })();

  var TASK_GROUPS = ['นิเทศฯ','ส่งเสริมการศึกษา','บุคคล','นโยบายและแผน','การเงิน','อำนวยการ','พัฒนาครู','DLICT','กฎหมาย','ตรวจสอบภายใน'];
  var HOME_TASK_LIMIT = 9;          /* หน้าแรกแสดง 9 รายการ (ตาราง 3x3) */
  var ADMIN_ALERT_DAYS = 14;        /* เตือนแอดมินเมื่อเลยกำหนดเกินกี่วัน */
  var THMON = ['ม.ค.','ก.พ.','มี.ค.','เม.ย.','พ.ค.','มิ.ย.','ก.ค.','ส.ค.','ก.ย.','ต.ค.','พ.ย.','ธ.ค.'];
  var THMONFULL = ['มกราคม','กุมภาพันธ์','มีนาคม','เมษายน','พฤษภาคม','มิถุนายน',
                   'กรกฎาคม','สิงหาคม','กันยายน','ตุลาคม','พฤศจิกายน','ธันวาคม'];

  var taskOpen = [];      /* งานที่เผยแพร่อยู่ */
  var taskClosed = [];    /* งานที่ปิดแล้ว */
  var taskIsDemo = true;
  var dlTab = 'open';

  /* ---------- ข้อมูลตัวอย่าง (ใช้เมื่อยังไม่ได้เชื่อมระบบจริง) ---------- */
  function taskDemo(){
    function shift(n){ var d=new Date(); d.setDate(d.getDate()+n); return d.getFullYear()+'-'+pad2t(d.getMonth()+1)+'-'+pad2t(d.getDate()); }
    return [
      {id:'AN-690001',posted:shift(-20),group:'นิเทศฯ',title:'ส่งรายงานผลการประเมินตนเอง (SAR) ปีการศึกษา 2568',detail:'ส่งเป็นไฟล์ PDF พร้อมไฟล์ Word ผ่านแบบฟอร์มออนไลน์ โรงเรียนที่ส่งแล้วไม่ต้องส่งซ้ำ',due:shift(-3),prio:'ด่วนที่สุด',target:'ทุกโรงเรียน',targetOther:'',channel:'Google Form',link:'',owner:'ศน.ธัชพล สุวรรณพงษ์',tel:'080-1357474',by:'ศน.ธัชพล สุวรรณพงษ์',status:'เผยแพร่'},
      {id:'AN-690002',posted:shift(-14),group:'นโยบายและแผน',title:'ส่งแผนปฏิบัติการประจำปีงบประมาณ 2569',detail:'แนบไฟล์แผนที่ผ่านความเห็นชอบจากคณะกรรมการสถานศึกษาแล้ว',due:shift(-1),prio:'ด่วน',target:'ทุกโรงเรียน',targetOther:'',channel:'ระบบ e-Office',link:'',owner:'กลุ่มนโยบายและแผน',tel:'053-980352',by:'กลุ่มนโยบายและแผน',status:'เผยแพร่'},
      {id:'AN-690003',posted:shift(-10),group:'บุคคล',title:'รายงานข้อมูลอัตรากำลังครูและบุคลากร ภาคเรียนที่ 1/2569',detail:'กรอกข้อมูลในระบบ พร้อมแนบสำเนาคำสั่งมอบหมายงาน',due:shift(2),prio:'ด่วน',target:'ทุกโรงเรียน',targetOther:'',channel:'Google Form',link:'',owner:'กลุ่มบริหารงานบุคคล',tel:'053-980351',by:'กลุ่มบริหารงานบุคคล',status:'เผยแพร่'},
      {id:'AN-690004',posted:shift(-8),group:'นิเทศฯ',title:'ส่งประกาศมาตรฐานการศึกษาและค่าเป้าหมาย ปีการศึกษา 2569',detail:'ประกาศที่ลงนามโดยผู้อำนวยการสถานศึกษาแล้ว สแกนเป็นไฟล์ PDF',due:shift(5),prio:'ปกติ',target:'ทุกโรงเรียน',targetOther:'',channel:'Google Form',link:'',owner:'ศน.ธัชพล สุวรรณพงษ์',tel:'080-1357474',by:'ศน.ธัชพล สุวรรณพงษ์',status:'เผยแพร่'},
      {id:'AN-690005',posted:shift(-7),group:'ส่งเสริมการศึกษา',title:'รายงานผลการดำเนินงานระบบดูแลช่วยเหลือนักเรียน',detail:'พร้อมภาพกิจกรรมประกอบอย่างน้อย 5 ภาพ',due:shift(6),prio:'ปกติ',target:'โรงเรียนขยายโอกาส',targetOther:'',channel:'อีเมล',link:'',owner:'กลุ่มส่งเสริมการจัดการศึกษา',tel:'053-980351',by:'กลุ่มส่งเสริมการจัดการศึกษา',status:'เผยแพร่'},
      {id:'AN-690006',posted:shift(-6),group:'การเงิน',title:'ส่งรายงานการใช้จ่ายเงินอุดหนุน ไตรมาสที่ 4',detail:'ใช้แบบฟอร์มที่เขตกำหนด พร้อมแนบหลักฐานการเบิกจ่าย',due:shift(9),prio:'ปกติ',target:'ทุกโรงเรียน',targetOther:'',channel:'ส่งเอกสารที่เขต',link:'',owner:'กลุ่มบริหารงานการเงินฯ',tel:'053-980352',by:'กลุ่มบริหารงานการเงินฯ',status:'เผยแพร่'},
      {id:'AN-690007',posted:shift(-5),group:'DLICT',title:'สำรวจความพร้อมอุปกรณ์ดิจิทัลเพื่อการเรียนการสอน',detail:'กรอกจำนวนคอมพิวเตอร์ แท็บเล็ต และความเร็วอินเทอร์เน็ตของโรงเรียน',due:shift(12),prio:'ปกติ',target:'โรงเรียนขนาดเล็ก',targetOther:'',channel:'Google Form',link:'',owner:'กลุ่ม DLICT',tel:'053-980351',by:'กลุ่ม DLICT',status:'เผยแพร่'},
      {id:'AN-690008',posted:shift(-4),group:'พัฒนาครู',title:'แจ้งรายชื่อครูเข้าอบรมหลักสูตรการจัดการเรียนรู้เชิงรุก',detail:'โรงเรียนละไม่เกิน 2 คน เรียงลำดับตามความสมัครใจ',due:shift(16),prio:'ปกติ',target:'ทุกโรงเรียน',targetOther:'',channel:'Google Form',link:'',owner:'กลุ่มพัฒนาครูฯ',tel:'053-980352',by:'กลุ่มพัฒนาครูฯ',status:'เผยแพร่'},
      {id:'AN-690009',posted:shift(-3),group:'อำนวยการ',title:'ยืนยันข้อมูลผู้ประสานงานของโรงเรียน ประจำปี 2569',detail:'ชื่อ เบอร์โทร และอีเมลของผู้ประสานงานหลัก',due:shift(21),prio:'ปกติ',target:'ทุกโรงเรียน',targetOther:'',channel:'Google Form',link:'',owner:'กลุ่มอำนวยการ',tel:'053-980351',by:'กลุ่มอำนวยการ',status:'เผยแพร่'},
      {id:'AN-690010',posted:shift(-2),group:'นิเทศฯ',title:'ตอบแบบสำรวจความต้องการรับการนิเทศ ภาคเรียนที่ 1/2569',detail:'เลือกประเด็นที่ต้องการให้ศึกษานิเทศก์เข้าไปช่วยเหลือ',due:shift(25),prio:'ปกติ',target:'ทุกโรงเรียน',targetOther:'',channel:'Google Form',link:'',owner:'ศน.ธัชพล สุวรรณพงษ์',tel:'080-1357474',by:'ศน.ธัชพล สุวรรณพงษ์',status:'เผยแพร่'},
      {id:'AN-690011',posted:shift(-2),group:'กฎหมาย',title:'ส่งรายงานผลการดำเนินการทางวินัยและการร้องเรียน',detail:'หากไม่มีเรื่องร้องเรียนให้รายงานว่า "ไม่มี"',due:shift(30),prio:'ปกติ',target:'ทุกโรงเรียน',targetOther:'',channel:'ระบบ e-Office',link:'',owner:'กลุ่มกฎหมายและคดี',tel:'053-980352',by:'กลุ่มกฎหมายและคดี',status:'เผยแพร่'}
    ];
  }
  function taskDemoClosed(){
    function shift(n){ var d=new Date(); d.setDate(d.getDate()+n); return d.getFullYear()+'-'+pad2t(d.getMonth()+1)+'-'+pad2t(d.getDate()); }
    return [
      {id:'AN-680088',posted:shift(-60),group:'นิเทศฯ',title:'ส่งผลการประเมินคุณภาพภายใน ปีการศึกษา 2567',detail:'',due:shift(-40),prio:'ปกติ',target:'ทุกโรงเรียน',targetOther:'',channel:'Google Form',link:'',owner:'ศน.ธัชพล สุวรรณพงษ์',tel:'080-1357474',by:'ศน.ธัชพล สุวรรณพงษ์',status:'ปิดงานแล้ว',closedAt:shift(-38)}
    ];
  }

  /* ---------- ตัวช่วยเรื่องวันที่ ---------- */
  function pad2t(n){ return (n<10?'0':'')+n; }
  function thDate(iso){
    if(!iso) return '-';
    var p=String(iso).split('-'); if(p.length<3) return String(iso);
    var y=parseInt(p[0],10), m=parseInt(p[1],10), d=parseInt(p[2],10);
    if(isNaN(y)||isNaN(m)||isNaN(d)) return String(iso);
    return d+' '+THMON[m-1]+' '+(y+543);
  }
  function dayDiff(iso){
    if(!iso) return 9999;
    var p=String(iso).split('-'); if(p.length<3) return 9999;
    var t=new Date(); t.setHours(0,0,0,0);
    var d=new Date(parseInt(p[0],10), parseInt(p[1],10)-1, parseInt(p[2],10)); d.setHours(0,0,0,0);
    return Math.round((d-t)/86400000);
  }
  function urgency(n){
    if(n<0)   return {k:'over', c:'#d35450', t:'เลยกำหนด '+(-n)+' วัน',  cls:'due-over'};
    if(n===0) return {k:'soon', c:'#c08b14', t:'ครบกำหนดวันนี้',          cls:'due-soon'};
    if(n<=3)  return {k:'soon', c:'#c08b14', t:'เหลืออีก '+n+' วัน',      cls:'due-soon'};
    if(n<=7)  return {k:'near', c:'#0066cc', t:'เหลืออีก '+n+' วัน',      cls:'due-near'};
    return         {k:'far',  c:'#8e8e93', t:'เหลืออีก '+n+' วัน',      cls:'due-far'};
  }
  function tesc(s){ return String(s==null?'':s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }
  function targetText(t){ return (t.target==='อื่น ๆ (ระบุเอง)'||t.target==='เฉพาะเครือข่าย') && t.targetOther ? t.targetOther : (t.target||'ทุกโรงเรียน'); }

  /* ---------- เช็กลิสต์ "โรงเรียนเราส่งแล้ว" (เก็บในเครื่องผู้ใช้) ---------- */
  var DONE_KEY='lp2-tasks-done';
  function doneList(){ try{ return JSON.parse(localStorage.getItem(DONE_KEY)||'[]'); }catch(e){ return []; } }
  function isDone(id){ return doneList().indexOf(id)>-1; }
  function toggleDone(id){
    var a=doneList(), i=a.indexOf(id);
    if(i>-1) a.splice(i,1); else a.push(id);
    try{ localStorage.setItem(DONE_KEY, JSON.stringify(a)); }catch(e){}
    renderHomeTasks(); renderDeadlines();
  }

  /* ---------- เรียงลำดับ: ด่วนที่สุดปักหมุด > เลยกำหนด > ใกล้ครบกำหนด ---------- */
  function taskSort(a,b){
    var pa=(a.prio==='ด่วนที่สุด')?0:1, pb=(b.prio==='ด่วนที่สุด')?0:1;
    if(pa!==pb) return pa-pb;
    var da=dayDiff(a.due), db=dayDiff(b.due);
    var oa=(da<0)?0:1, ob=(db<0)?0:1;
    if(oa!==ob) return oa-ob;
    return da-db;
  }

  /* ---------- โหลดข้อมูล ---------- */
  function loadTasks(){
    if(!TASKS_API_URL){ taskOpen=taskDemo().sort(taskSort); taskClosed=taskDemoClosed(); taskIsDemo=true; afterTasksLoaded(); return; }
    fetch(TASKS_API_URL+'?action=list&t='+Date.now())
      .then(function(r){ return r.json(); })
      .then(function(res){
        if(res && res.ok){
          taskOpen=(res.items||[]).sort(taskSort);
          taskClosed=res.closed||[];
          taskIsDemo=false;
        } else { taskOpen=taskDemo().sort(taskSort); taskClosed=taskDemoClosed(); taskIsDemo=true; }
        afterTasksLoaded();
      })
      .catch(function(){ taskOpen=taskDemo().sort(taskSort); taskClosed=taskDemoClosed(); taskIsDemo=true; afterTasksLoaded(); });
  }
  function afterTasksLoaded(){
    var tag=document.getElementById('task-demo-tag'); if(tag) tag.style.display = taskIsDemo ? '' : 'none';
    fillGroupSelects();
    renderHomeTasks();
    renderDeadlines();
    renderAlertBar();
    if(typeof renderEvents==='function') renderEvents();   /* จุดแดงกำหนดส่งในปฏิทินต้องรอข้อมูลงานก่อน */
    if(!(typeof openHashEvent==='function' && openHashEvent())) openHashTask();
  }
  function fillGroupSelects(){
    var used={}; taskOpen.concat(taskClosed).forEach(function(t){ if(t.group) used[t.group]=1; });
    var opts='<option value="">ทุกกลุ่มงาน</option>';
    TASK_GROUPS.forEach(function(g){ if(used[g]) opts+='<option value="'+tesc(g)+'">'+tesc(g)+'</option>'; });
    ['task-group','dl-group'].forEach(function(id){
      var el=document.getElementById(id); if(!el) return;
      var keep=el.value; el.innerHTML=opts; el.value=keep;
    });
    var nu=document.getElementById('nu-group');
    if(nu) nu.innerHTML=TASK_GROUPS.map(function(g){ return '<option>'+tesc(g)+'</option>'; }).join('');
  }

  /* ---------- แถบเตือนใต้เมนู ---------- */
  var alertBarTab = 'tasks';   /* ปุ่ม "ดูรายการ" จะพาไปแท็บไหน ขึ้นกับว่าแถบกำลังเตือนเรื่องอะไร */
  function renderAlertBar(){
    var bar=document.getElementById('alertbar'); if(!bar) return;
    if(sessionStorage.getItem('lp2-alert-off')==='1') return;
    var nOver=taskOpen.filter(function(t){ return dayDiff(t.due)<0 && !isDone(t.id); }).length;
    var evTom=(typeof evData!=='undefined'?evData:[]).filter(function(v){ return dayDiff(v.start)===1 && v.status==='เผยแพร่'; });
    var msgs=[];
    if(nOver>0) msgs.push('มี <b>'+nOver+'</b> งานที่เลยกำหนดส่งแล้ว');
    if(evTom.length===1) msgs.push('พรุ่งนี้มีกิจกรรม <b>'+tesc(evTom[0].title)+'</b>');
    else if(evTom.length>1) msgs.push('พรุ่งนี้มีกิจกรรม <b>'+evTom.length+'</b> รายการ');
    alertBarTab = nOver>0 ? 'tasks' : 'events';
    if(msgs.length){
      document.getElementById('alertbar-txt').innerHTML=msgs.join(' · ');
      bar.classList.add('on');
    } else bar.classList.remove('on');
  }
  function goAlertBar(){ show('calendar',null); if(typeof setCalTab==='function') setCalTab(alertBarTab); }
  function dismissAlert(){
    try{ sessionStorage.setItem('lp2-alert-off','1'); }catch(e){}
    document.getElementById('alertbar').classList.remove('on');
  }

  /* ---------- การ์ดงาน ---------- */
  function taskCard(t, sc){
    sc = sc || 'h';
    var uid = sc+'-'+t.id;
    var n=dayDiff(t.due), u=urgency(n), done=isDone(t.id);
    var h='<article class="tcard reveal'+(done?' done':'')+'" id="task-'+tesc(uid)+'" style="--tc:'+u.c+'">';
    h+='<div class="tcard-in">';
    h+='<div class="trow1"><span class="tgroup">'+tesc(t.group||'-')+'</span>';
    if(t.prio==='ด่วนที่สุด') h+='<span class="turgent">ด่วนที่สุด</span>';
    h+='<button class="tcheck'+(done?' on':'')+'" onclick="toggleDone(\''+tesc(t.id)+'\')" title="ติ๊กเมื่อโรงเรียนของท่านส่งแล้ว" aria-label="ติ๊กว่าส่งแล้ว">✓</button></div>';
    h+='<div class="tcount">'+tesc(u.t)+'</div>';
    h+='<h4 class="ttitle">'+tesc(t.title)+'</h4>';
    h+='<div class="tdue">กำหนดส่ง '+thDate(t.due)+' · '+tesc(targetText(t))+'</div>';
    h+='<div class="tacts">';
    if(t.link) h+='<a class="btn-dl" href="'+tesc(t.link)+'" target="_blank" rel="noopener">ส่งงาน →</a>';
    h+='<button class="tmore" onclick="toggleDetail(\''+tesc(uid)+'\')">รายละเอียด ⌄</button>';
    h+='</div>';
    h+='<div class="tdetail" id="detail-'+tesc(uid)+'">';
    if(t.detail) h+='<div>'+tesc(t.detail)+'</div>';
    h+='<dl>';
    h+='<dt>ช่องทางส่ง</dt><dd>'+tesc(t.channel||'-')+'</dd>';
    h+='<dt>ผู้รับผิดชอบ</dt><dd>'+tesc(t.owner||'-')+(t.tel?' · โทร. '+tesc(t.tel):'')+'</dd>';
    h+='<dt>ประกาศเมื่อ</dt><dd>'+thDate(t.posted)+'</dd>';
    h+='</dl>';
    h+='<div class="tmini">';
    h+='<button onclick="copyTaskLink(\''+tesc(t.id)+'\')">คัดลอกลิงก์</button>';
    h+='<button onclick="shareLine(\''+tesc(t.id)+'\')">แชร์เข้าไลน์</button>';
    h+='<button onclick="downloadIcs(\''+tesc(t.id)+'\')">เพิ่มลงปฏิทิน</button>';
    h+='</div></div></div></article>';
    return h;
  }
  function toggleDetail(uid){
    var d=document.getElementById('detail-'+uid); if(d) d.classList.toggle('open');
  }

  /* ---------- หน้าแรก: 9 การ์ด ---------- */
  function renderHomeTasks(){
    var grid=document.getElementById('task-grid'); if(!grid) return;
    var g=(document.getElementById('task-group')||{}).value||'';
    var hide=(document.getElementById('task-hidedone')||{}).checked;
    var list=taskOpen.filter(function(t){
      if(g && t.group!==g) return false;
      if(hide && isDone(t.id)) return false;
      return true;
    });
    var over=taskOpen.filter(function(t){ return dayDiff(t.due)<0; }).length;
    var soon=taskOpen.filter(function(t){ var n=dayDiff(t.due); return n>=0 && n<=7; }).length;
    var sum=document.getElementById('task-sum');
    if(sum) sum.innerHTML =
      '<div class="tsum over reveal"><div class="n">'+over+'</div><div class="l">เลยกำหนด</div></div>'+
      '<div class="tsum soon reveal"><div class="n">'+soon+'</div><div class="l">ครบกำหนดใน 7 วัน</div></div>'+
      '<div class="tsum reveal"><div class="n">'+taskOpen.length+'</div><div class="l">งานทั้งหมด</div></div>';

    grid.innerHTML = list.length
      ? list.slice(0,HOME_TASK_LIMIT).map(function(t){ return taskCard(t,'h'); }).join('')
      : '<div class="task-empty">'+(taskOpen.length
          ? 'ไม่พบงานตามเงื่อนไขที่เลือก'
          : 'ขณะนี้ไม่มีงานที่ต้องส่งเขต — โรงเรียนไม่มีงานค้าง')+'</div>';

    var tot=document.getElementById('task-total'); if(tot) tot.textContent=taskOpen.length;
    var up=document.getElementById('task-updated');
    if(up) up.textContent='อัปเดตล่าสุด '+thDate(new Date().getFullYear()+'-'+pad2t(new Date().getMonth()+1)+'-'+pad2t(new Date().getDate()))+' เวลา '+pad2t(new Date().getHours())+':'+pad2t(new Date().getMinutes())+' น.';
    var more=document.querySelector('#home-tasks .task-more');
    if(more) more.style.display = taskOpen.length>HOME_TASK_LIMIT ? '' : 'none';
    if(typeof arm==='function'){ arm(sum); arm(grid); }
  }

  /* ---------- หน้าปฏิทินส่งงาน ---------- */
  function setDlTab(k){
    dlTab=k;
    var a=document.getElementById('dltab-open'), b=document.getElementById('dltab-closed');
    if(a) a.classList.toggle('on', k==='open');
    if(b) b.classList.toggle('on', k==='closed');
    renderDeadlines();
  }
  function renderDeadlines(){
    var box=document.getElementById('dl-body'); if(!box) return;
    var g=(document.getElementById('dl-group')||{}).value||'';
    var r=(document.getElementById('dl-range')||{}).value||'all';
    var v=(document.getElementById('dl-view')||{}).value||'card';
    var hide=(document.getElementById('dl-hidedone')||{}).checked;
    var src=(dlTab==='closed')?taskClosed:taskOpen;
    var list=src.filter(function(t){
      if(g && t.group!==g) return false;
      if(hide && isDone(t.id)) return false;
      if(dlTab==='open'){
        var n=dayDiff(t.due);
        if(r==='over' && n>=0) return false;
        if(r==='week' && (n<0 || n>7)) return false;
        if(r==='month' && (n<0 || n>30)) return false;
      }
      return true;
    }).sort(taskSort);

    if(!list.length){ box.innerHTML='<div class="task-empty">ไม่พบรายการตามเงื่อนไขที่เลือก</div>'; return; }

    if(v==='table'){
      var h='<div class="tbl-wrap reveal"><div class="tbl-top"><strong>'+(dlTab==='closed'?'งานที่ปิดแล้ว':'งานที่ต้องส่ง')+' ('+list.length+' รายการ)</strong></div><div class="tbl-scroll"><table><thead><tr><th>กำหนดส่ง</th><th>สถานะเวลา</th><th>งาน</th><th>กลุ่มงาน</th><th>กลุ่มเป้าหมาย</th><th>ช่องทาง</th><th></th></tr></thead><tbody>';
      list.forEach(function(t){
        var n=dayDiff(t.due), u=urgency(n);
        h+='<tr id="task-d-'+tesc(t.id)+'">';
        h+='<td>'+thDate(t.due)+'</td>';
        h+='<td class="'+u.cls+'">'+(dlTab==='closed'?'ปิดงานแล้ว':tesc(u.t))+'</td>';
        h+='<td class="tdname">'+tesc(t.title)+(t.prio==='ด่วนที่สุด'?' <span class="turgent">ด่วนที่สุด</span>':'')+'</td>';
        h+='<td>'+tesc(t.group||'-')+'</td>';
        h+='<td>'+tesc(targetText(t))+'</td>';
        h+='<td>'+tesc(t.channel||'-')+'</td>';
        h+='<td>'+(t.link?'<a class="btn-dl" href="'+tesc(t.link)+'" target="_blank" rel="noopener">ส่งงาน →</a>':'')+'</td>';
        h+='</tr>';
      });
      h+='</tbody></table></div></div>';
      box.innerHTML=h;
    } else {
      box.innerHTML='<div class="task-grid stagger">'+list.map(function(t){ return taskCard(t,'d'); }).join('')+'</div>';
    }
    if(typeof arm==='function') arm(box);
  }

  /* ---------- คัดลอกลิงก์ / แชร์ไลน์ / เพิ่มลงปฏิทิน ---------- */
  function taskLink(id){ return location.origin+location.pathname+'#'+id; }
  function copyTaskLink(id){
    var url=taskLink(id);
    function done(){ alert('คัดลอกลิงก์แล้ว\n\n'+url+'\n\nนำไปวางในไลน์กลุ่มหรืออีเมลได้เลย'); }
    if(navigator.clipboard && navigator.clipboard.writeText){ navigator.clipboard.writeText(url).then(done, function(){ prompt('คัดลอกลิงก์นี้',url); }); }
    else prompt('คัดลอกลิงก์นี้',url);
  }
  function shareLine(id){
    window.open('https://social-plugins.line.me/lineit/share?url='+encodeURIComponent(taskLink(id)),'_blank','noopener');
  }
  function findTask(id){
    var all=taskOpen.concat(taskClosed);
    for(var i=0;i<all.length;i++) if(all[i].id===id) return all[i];
    return null;
  }
  function icsEvent(t){
    var d=String(t.due||'').replace(/-/g,'');
    var p=String(t.due||'').split('-');
    var nx=new Date(parseInt(p[0],10), parseInt(p[1],10)-1, parseInt(p[2],10)+1);
    var dEnd=nx.getFullYear()+pad2t(nx.getMonth()+1)+pad2t(nx.getDate());
    var desc=[(t.detail||''),'กลุ่มงาน: '+(t.group||'-'),'กลุ่มเป้าหมาย: '+targetText(t),'ช่องทางส่ง: '+(t.channel||'-'),'ผู้รับผิดชอบ: '+(t.owner||'-')+(t.tel?' โทร. '+t.tel:''),(t.link||'')]
      .filter(Boolean).join('\\n');
    return ['BEGIN:VEVENT','UID:'+t.id+'@lp2-qa','DTSTART;VALUE=DATE:'+d,'DTEND;VALUE=DATE:'+dEnd,
      'SUMMARY:[ส่งเขต] '+String(t.title||'').replace(/[,;]/g,' '),'DESCRIPTION:'+desc.replace(/[,;]/g,' '),
      'BEGIN:VALARM','TRIGGER:-P2D','ACTION:DISPLAY','DESCRIPTION:ใกล้ครบกำหนดส่งงานเขต','END:VALARM','END:VEVENT'].join('\r\n');
  }
  function saveIcs(events, name){
    var body=['BEGIN:VCALENDAR','VERSION:2.0','PRODID:-//สพป.ลำพูน เขต 2//งานที่ต้องส่งเขต//TH','CALSCALE:GREGORIAN'].concat(events).concat(['END:VCALENDAR']).join('\r\n');
    var url=URL.createObjectURL(new Blob([body],{type:'text/calendar;charset=utf-8'}));
    var a=document.createElement('a'); a.href=url; a.download=name; document.body.appendChild(a); a.click();
    document.body.removeChild(a); setTimeout(function(){ URL.revokeObjectURL(url); },1000);
  }
  function downloadIcs(id){ var t=findTask(id); if(t) saveIcs([icsEvent(t)], t.id+'.ics'); }
  function downloadAllIcs(){
    if(!taskOpen.length){ alert('ยังไม่มีงานที่ต้องส่งในขณะนี้'); return; }
    saveIcs(taskOpen.map(icsEvent), 'ปฏิทินส่งงาน-สพป.ลำพูน2.ics');
  }
  function openHashTask(){
    var id=decodeURIComponent((location.hash||'').replace('#',''));
    if(!id || !findTask(id)) return;
    document.querySelectorAll('.tcard.hl').forEach(function(x){ x.classList.remove('hl'); });
    show('deadlines',null);
    setTimeout(function(){
      var el=document.getElementById('task-d-'+id);
      if(el){ el.classList.add('hl'); el.scrollIntoView({behavior:'smooth',block:'center'}); var d=document.getElementById('detail-d-'+id); if(d) d.classList.add('open'); }
    },400);
  }

  /* ==================================================================
     ปฏิทินกิจกรรมเขต
     ------------------------------------------------------------------
     ต่างจากงานที่ต้องส่งตรงที่กิจกรรมมีช่วงเวลา (เริ่ม-สิ้นสุด)
     และมีสถานะ "เลื่อน" / "ยกเลิก" แทนการปิดงาน
     ================================================================== */
  var EV_TYPES  = ['อบรม/พัฒนาครู','ประชุม','ประกวด/แข่งขัน','ตัดสินผลงาน','นิเทศ/ติดตาม','อื่น ๆ'];
  var EV_COLOR  = {
    'อบรม/พัฒนาครู':'#0066cc', 'ประชุม':'#2a9d8f', 'ประกวด/แข่งขัน':'#6a4ca5',
    'ตัดสินผลงาน':'#d17a22', 'นิเทศ/ติดตาม':'#c08b14', 'อื่น ๆ':'#8e8e93'
  };
  var EV_CANCEL_KEEP_DAYS = 30;   /* กิจกรรมที่ยกเลิก ยังโชว์ค้างไว้กี่วันหลังวันจัด */

  /* ใช้เฉพาะกรณียังไม่ได้เชื่อม Apps Script — เป็นข้อมูลสมมติล้วน ไม่ใช่กิจกรรมจริงของเขต */
  var EV_DEMO = [
    {id:'AC-690001', group:'นิเทศฯ', title:'(ตัวอย่าง) อบรมเชิงปฏิบัติการการจัดทำ SAR', type:'อบรม/พัฒนาครู',
     detail:'ตัวอย่างข้อมูลเพื่อสาธิตหน้าเว็บ', start:'', end:'', timeStart:'08:30', timeEnd:'16:30',
     place:'ห้องประชุมสำนักงานเขต', target:'ทุกโรงเรียน', targetOther:'', who:'ครูวิชาการ',
     needReg:'ไม่ต้อง', regLink:'', regClose:'', docLink:'', owner:'-', tel:'', status:'เผยแพร่', note:''}
  ];
  (function(){   /* ตรึงตัวอย่างไว้กลางเดือนปัจจุบัน เพื่อให้เห็นหน้าตาได้ */
    var n=new Date(), y=n.getFullYear(), m=n.getMonth();
    EV_DEMO[0].start = y+'-'+pad2t(m+1)+'-15';
    EV_DEMO[0].end   = y+'-'+pad2t(m+1)+'-17';
  })();

  var evData = [];
  var calY, calM;                 /* เดือนที่กำลังดู (calM = 0-11) */
  var calTab = 'events';
  var calSelectedDay = null;      /* วันที่กำลังเลือกดูในมุมมองตารางเดือน (ISO string หรือ null) */
  (function(){ var n=new Date(); calY=n.getFullYear(); calM=n.getMonth(); })();

  /* ---------- มุมมอง [ตารางเดือน | รายการ] ---------- */
  /* ค่าตั้งต้น = ตารางเดือน ทุกขนาดจอ (รวมโทรศัพท์) — มติเจ้าของ 10 พ.ย. 2569
     ใช้คีย์ใหม่ lp2-ev-view2 เพื่อไม่ให้ค่า "รายการ" ที่เครื่องเคยจำไว้จากรุ่นเก่ามาทับค่าตั้งต้นใหม่ */
  var evViewMode = 'month';
  (function(){
    try{ var saved=localStorage.getItem('lp2-ev-view2'); if(saved==='month'||saved==='list') evViewMode=saved; }catch(e){}
  })();
  function effectiveEvView(){ return evViewMode; }
  function setEvView(mode){
    evViewMode = mode;
    try{ localStorage.setItem('lp2-ev-view2', mode); }catch(e){}
    renderEvents();
  }
  function applyEvViewUI(){
    var mode = effectiveEvView();
    var mb=document.getElementById('vm-month'), lb=document.getElementById('vm-list');
    if(mb) mb.classList.toggle('on', mode==='month');
    if(lb) lb.classList.toggle('on', mode==='list');
    var body=document.getElementById('ev-body'), month=document.getElementById('ev-month');
    if(body)  body.style.display  = (mode==='list')  ? '' : 'none';
    if(month) month.style.display = (mode==='month') ? '' : 'none';
  }
  var evResizeTimer=null;
  window.addEventListener('resize', function(){
    clearTimeout(evResizeTimer);
    evResizeTimer=setTimeout(function(){
      if(calTab==='events' && document.getElementById('view-calendar') && document.getElementById('view-calendar').classList.contains('active')) renderEvents();
    }, 150);
  });

  function evColor(t){ return EV_COLOR[t] || EV_COLOR['อื่น ๆ']; }

  function setCalTab(k){
    calTab = k;
    var a=document.getElementById('caltab-events'), b=document.getElementById('caltab-tasks');
    var pa=document.getElementById('calpane-events'), pb=document.getElementById('calpane-tasks');
    if(a) a.classList.toggle('on', k==='events');
    if(b) b.classList.toggle('on', k==='tasks');
    if(pa) pa.style.display = (k==='events') ? '' : 'none';
    if(pb) pb.style.display = (k==='tasks')  ? '' : 'none';
    if(k==='events') renderEvents();
  }

  function calMove(n){
    calM += n;
    while(calM < 0){ calM += 12; calY--; }
    while(calM > 11){ calM -= 12; calY++; }
    calSelectedDay = null;
    renderEvents();
  }
  function calToday(){ var n=new Date(); calY=n.getFullYear(); calM=n.getMonth(); calSelectedDay=null; renderEvents(); }

  /* ---------- ตัวช่วยเรื่องช่วงวันที่ ---------- */
  function ymd(y,m,d){ return y+'-'+pad2t(m+1)+'-'+pad2t(d); }
  function monthStart(){ return ymd(calY, calM, 1); }
  function monthEnd(){ return ymd(calY, calM, new Date(calY, calM+1, 0).getDate()); }
  /* กิจกรรมคาบเกี่ยวกับเดือนที่กำลังดูหรือไม่ (รวมกิจกรรมข้ามเดือน) */
  function inMonth(v){ return !(v.end < monthStart() || v.start > monthEnd()); }

  function evRange(v){
    if(!v.end || v.end === v.start) return thDate(v.start);
    var a=String(v.start).split('-'), b=String(v.end).split('-');
    if(a[0]===b[0] && a[1]===b[1]) return parseInt(a[2],10)+'–'+thDate(v.end);   /* เดือนเดียวกัน */
    return thDate(v.start)+' – '+thDate(v.end);
  }
  function evTime(v){
    if(!v.timeStart) return '';
    return v.timeStart + (v.timeEnd ? '–'+v.timeEnd : '') + ' น.';
  }
  function evDays(v){
    if(!v.end || v.end===v.start) return 0;
    var a=new Date(v.start), b=new Date(v.end);
    return Math.round((b-a)/86400000) + 1;
  }
  function evTargetText(v){
    return (v.target==='อื่น ๆ' || v.target==='เฉพาะบางโรงเรียน') && v.targetOther ? v.targetOther : (v.target||'ทุกโรงเรียน');
  }

  /* ---------- โหลดข้อมูล ---------- */
  function loadEvents(){
    var tag=document.getElementById('ev-demo-tag');
    if(!TASKS_API_URL){ evData=EV_DEMO.slice(); if(tag) tag.style.display=''; evFillFilters(); renderEvents(); if(typeof renderAlertBar==='function') renderAlertBar(); return; }
    fetch(TASKS_API_URL+'?action=events').then(function(r){ return r.json(); }).then(function(res){
      if(res && res.ok && (res.items||[]).length){ evData=res.items; if(tag) tag.style.display='none'; }
      else { evData=[]; if(tag) tag.style.display='none'; }
      evFillFilters(); renderEvents();
      if(typeof renderAlertBar==='function') renderAlertBar();   /* กิจกรรมพรุ่งนี้อาจโหลดเสร็จหลังงานที่ต้องส่ง */
    }).catch(function(err){
      console.error('loadEvents error:', err);
      evData=[]; evFillFilters(); renderEvents();
      if(typeof renderAlertBar==='function') renderAlertBar();
    });
  }

  function evFillFilters(){
    var t=document.getElementById('ev-type');
    if(t && !t.options.length){
      t.innerHTML='<option value="">ทุกประเภท</option>'+EV_TYPES.map(function(x){
        return '<option value="'+tesc(x)+'">'+tesc(x)+'</option>'; }).join('');
    }
    var g=document.getElementById('ev-group');
    if(g && !g.options.length){
      g.innerHTML='<option value="">ทุกกลุ่มงาน</option>'+TASK_GROUPS.map(function(x){
        return '<option value="'+tesc(x)+'">'+tesc(x)+'</option>'; }).join('');
    }
    var lg=document.getElementById('ev-legend');
    if(lg) lg.innerHTML=EV_TYPES.map(function(x){
      return '<span><i style="background:'+evColor(x)+'"></i>'+tesc(x)+'</span>'; }).join('');
  }

  /* ---------- แสดงผล ---------- */
  /* กรองตามประเภท/กลุ่มงาน/ช่วงที่ยังคงเก็บไว้หลังยกเลิก — ใช้ร่วมกันทั้งมุมมองรายการและตารางเดือน */
  function evPassesFilters(v){
    var ft=(document.getElementById('ev-type')||{}).value||'';
    var fg=(document.getElementById('ev-group')||{}).value||'';
    if(ft && v.type!==ft) return false;
    if(fg && v.group!==fg) return false;
    if(v.status==='ยกเลิก' && dayDiff(v.end||v.start) < -EV_CANCEL_KEEP_DAYS) return false;
    return true;
  }

  function renderEvents(){
    var lab=document.getElementById('cal-month-label');
    if(lab) lab.textContent = THMONFULL[calM] + ' ' + (calY+543);
    applyEvViewUI();
    if(effectiveEvView()==='month') renderEvMonthGrid(); else renderEvListMode();
  }

  function renderEvListMode(){
    var box=document.getElementById('ev-body'); if(!box) return;
    var fg=(document.getElementById('ev-group')||{}).value||'';
    var showDue=(document.getElementById('ev-showdue')||{}).checked;

    var list = evData.filter(function(v){ return inMonth(v) && evPassesFilters(v); });
    var rows = list.map(function(v){ return {kind:'ev', date:v.start, o:v}; });

    if(showDue){
      (typeof taskOpen!=='undefined' ? taskOpen : []).forEach(function(t){
        if(!t.due || t.due < monthStart() || t.due > monthEnd()) return;
        if(fg && t.group!==fg) return;
        rows.push({kind:'due', date:t.due, o:t});
      });
    }
    rows.sort(function(a,b){ return a.date < b.date ? -1 : (a.date > b.date ? 1 : 0); });

    if(!rows.length){
      box.innerHTML='<div class="task-empty">เดือน'+THMONFULL[calM]+' '+(calY+543)+' ยังไม่มีกิจกรรม'
        + (showDue ? 'หรือกำหนดส่งงาน' : '') + '<br><span style="font-size:13px;">กดปุ่ม ‹ › เพื่อดูเดือนอื่นได้ครับ</span></div>';
      return;
    }
    box.innerHTML = rows.map(function(r){ return r.kind==='ev' ? evRow(r.o) : dueRow(r.o); }).join('');
    if(typeof arm==='function') arm(box);
  }

  /* ---------- มุมมองตารางเดือน ---------- */
  function renderEvMonthGrid(){
    var head=document.getElementById('cal-grid-head'), weeksBox=document.getElementById('cal-weeks');
    if(!head || !weeksBox) return;

    var THWK=['จ.','อ.','พ.','พฤ.','ศ.','ส.','อา.'];
    head.innerHTML = THWK.map(function(d){ return '<div>'+d+'</div>'; }).join('');

    var offset=(new Date(calY,calM,1).getDay()+6)%7;                 /* 0=จันทร์ */
    var daysInMonth=new Date(calY,calM+1,0).getDate();
    var weeks=Math.ceil((offset+daysInMonth)/7);
    var todayIso = ymd((new Date()).getFullYear(), (new Date()).getMonth(), (new Date()).getDate());

    var showDue=(document.getElementById('ev-showdue')||{}).checked;
    var dueCount={};
    if(showDue){
      (typeof taskOpen!=='undefined' ? taskOpen : []).forEach(function(t){
        if(t.due && t.due>=monthStart() && t.due<=monthEnd()) dueCount[t.due]=(dueCount[t.due]||0)+1;
      });
    }

    /* 1) ตัดกิจกรรมของเดือนนี้ให้เหลือแค่ช่วงในเดือน แล้วแยกเป็นแถบตามสัปดาห์ (ข้อ 2) */
    var list = evData.filter(function(v){ return inMonth(v) && evPassesFilters(v); });
    var bars=[];
    list.forEach(function(v){
      var s = v.start < monthStart() ? monthStart() : v.start;
      var eRaw = v.end || v.start;
      var e = eRaw > monthEnd() ? monthEnd() : eRaw;
      if(e < s) return;
      var sCell = offset + (parseInt(s.split('-')[2],10) - 1);
      var eCell = offset + (parseInt(e.split('-')[2],10) - 1);
      var cur = sCell, first = true;
      while(cur <= eCell){
        var wk = Math.floor(cur/7);
        var weekEndCell = wk*7 + 6;
        var segEnd = Math.min(eCell, weekEndCell);
        bars.push({ weekIndex:wk, colStart: cur%7, colSpan: segEnd-cur+1, ev:v, isHead:first });
        first=false;
        cur = segEnd+1;
      }
    });

    /* 2) จัดชั้น (lane) กันทับ ทีละสัปดาห์ — เกิน 3 lane นับเป็นล้น (ข้อ 3) */
    var MAXLANE=3;
    var byWeek={};
    bars.forEach(function(b){ (byWeek[b.weekIndex]=byWeek[b.weekIndex]||[]).push(b); });
    var overflowByCell={};
    var placedBars=[];
    Object.keys(byWeek).forEach(function(wkKey){
      var wkBars = byWeek[wkKey].slice().sort(function(a,b){
        return a.colStart!==b.colStart ? a.colStart-b.colStart : b.colSpan-a.colSpan;
      });
      var laneRanges=[[],[],[]];
      wkBars.forEach(function(b){
        var lane=-1;
        for(var l=0;l<MAXLANE;l++){
          var free=true;
          for(var i=0;i<laneRanges[l].length;i++){
            var r=laneRanges[l][i];
            if(b.colStart <= r[1] && r[0] <= b.colStart+b.colSpan-1){ free=false; break; }
          }
          if(free){ lane=l; break; }
        }
        if(lane===-1){
          for(var c=b.colStart;c<b.colStart+b.colSpan;c++){
            var cellIdx=b.weekIndex*7+c;
            overflowByCell[cellIdx]=(overflowByCell[cellIdx]||0)+1;
          }
        } else {
          laneRanges[lane].push([b.colStart, b.colStart+b.colSpan-1]);
          b.lane=lane;
          placedBars.push(b);
        }
      });
    });

    /* 3) วาดด้วย CSS grid ทีละสัปดาห์ (ข้อ 4-5) */
    var weeksHtml='';
    for(var w=0; w<weeks; w++){
      var inner='';
      for(var col=0; col<7; col++){
        var cellIdx=w*7+col, dayNum=cellIdx-offset+1;
        /* ช่องนอกเดือน วาดเป็นช่องว่างสีจาง เพื่อให้เส้นตารางครบทุกช่อง */
        if(dayNum<1 || dayNum>daysInMonth){
          inner += '<div class="cal-daynum blank c'+(col+1)+'" style="grid-column:'+(col+1)+';"></div>';
          continue;
        }
        var iso=ymd(calY,calM,dayNum);
        var dueN=dueCount[iso]||0;
        var cls='cal-daynum c'+(col+1)+(col>=5?' wkend':'')+(iso===todayIso?' today':'')+(iso===calSelectedDay?' sel':'');
        inner += '<div class="'+cls+'" style="grid-column:'+(col+1)+';" data-iso="'+iso+'" onclick="calPickDay(\''+iso+'\')">'
          + '<span class="dn">'+dayNum+'</span>' + (dueN?'<span class="cal-due-dot" title="มีกำหนดส่งงาน '+dueN+' รายการ"></span>':'')
          + '</div>';
      }
      placedBars.filter(function(b){ return b.weekIndex===w; }).forEach(function(b){
        var col=evColor(b.ev.type);
        var cls='cal-bar'+(b.ev.status==='ยกเลิก'?' off':'')+(b.ev.status==='เลื่อน'?' post':'');
        var barDayNum = (b.weekIndex*7 + b.colStart) - offset + 1;   /* วันแรกของแถบนี้ (เสมอในเดือนนี้ เพราะตัดขอบเดือนแล้ว) */
        var barIso = ymd(calY, calM, barDayNum);
        inner += '<div class="'+cls+'" style="grid-column:'+(b.colStart+1)+'/span '+b.colSpan+';grid-row:'+(b.lane+2)+';background:'+col+';" '
          + 'title="'+tesc(b.ev.title)+'" onclick="calPickDay(\''+barIso+'\')">'
          + tesc(b.ev.title) + '</div>';
      });
      /* แถวล้น "+N อีก" ต่อวัน */
      for(var c2=0;c2<7;c2++){
        var idx2=w*7+c2, n2=overflowByCell[idx2]||0;
        if(!n2) continue;
        var dnum2=idx2-offset+1; if(dnum2<1||dnum2>daysInMonth) continue;
        var iso2=ymd(calY,calM,dnum2);
        inner += '<div class="cal-more" style="grid-column:'+(c2+1)+';grid-row:5;" onclick="calPickDay(\''+iso2+'\')">+'+n2+' อีก</div>';
      }
      weeksHtml += '<div class="cal-week">'+inner+'</div>';
    }
    weeksBox.innerHTML = weeksHtml;
    renderCalDayList(calSelectedDay);
  }

  function calPickDay(iso){
    calSelectedDay = iso;
    renderEvMonthGrid();
  }

  function renderCalDayList(iso){
    var box=document.getElementById('cal-daylist'); if(!box) return;
    if(!iso){
      box.innerHTML='<div class="task-empty">แตะวันที่ในตารางเพื่อดูรายละเอียดกิจกรรมของวันนั้นครับ</div>';
      return;
    }
    var showDue=(document.getElementById('ev-showdue')||{}).checked;
    var evs = evData.filter(function(v){
      return v.start<=iso && (v.end||v.start)>=iso && evPassesFilters(v);
    });
    var rows = evs.map(function(v){ return {kind:'ev', o:v}; });
    if(showDue){
      (typeof taskOpen!=='undefined' ? taskOpen : []).forEach(function(t){ if(t.due===iso) rows.push({kind:'due', o:t}); });
    }
    var headHtml='<div class="cal-daylist-head">รายการวันที่ '+thDate(iso)+'</div>';
    if(!rows.length){
      box.innerHTML = headHtml + '<div class="task-empty">วันนี้ยังไม่มีกิจกรรมหรือกำหนดส่งงานครับ</div>';
      return;
    }
    box.innerHTML = headHtml + rows.map(function(r){ return r.kind==='ev' ? evRow(r.o) : dueRow(r.o); }).join('');
    if(typeof arm==='function') arm(box);
  }

  function evRow(v){
    var p=String(v.start).split('-');
    var days=evDays(v), col=evColor(v.type);
    var past = dayDiff(v.end||v.start) < 0;
    var cls = 'ev-row' + (v.status==='ยกเลิก' ? ' off cancel' : '') + (past && v.status!=='ยกเลิก' ? ' off' : '');

    var badge = '';
    if(v.status==='ยกเลิก')      badge='<span class="ev-badge cancel">ยกเลิกแล้ว</span>';
    else if(v.status==='เลื่อน') badge='<span class="ev-badge post">เลื่อนกำหนด</span>';
    else if(past)                badge='<span class="ev-badge past">ผ่านไปแล้ว</span>';

    var meta=[];
    if(evTime(v))  meta.push(tesc(evTime(v)));
    if(v.place)    meta.push(tesc(v.place));
    meta.push('<b>'+tesc(v.who||'ครูทุกคน')+'</b> · '+tesc(evTargetText(v)));
    if(v.group)    meta.push('กลุ่ม'+tesc(v.group));
    if(v.owner && v.owner!=='-') meta.push(tesc(v.owner)+(v.tel?' โทร. '+tesc(v.tel):''));
    if(v.needReg==='ต้องลงทะเบียน' && v.regClose)
      meta.push('ลงทะเบียนภายใน <b>'+thDate(v.regClose)+'</b>');

    var acts=[];
    if(v.needReg==='ต้องลงทะเบียน' && v.regLink)
      acts.push('<a class="btn-dl" href="'+tesc(v.regLink)+'" target="_blank" rel="noopener">ลงทะเบียน</a>');
    if(v.docLink)
      acts.push('<a class="btn-dl" href="'+tesc(v.docLink)+'" target="_blank" rel="noopener">หนังสือ/เอกสาร</a>');
    acts.push('<button class="btn-dl" onclick="downloadEvIcs(\''+v.id+'\')">เพิ่มลงปฏิทิน</button>');
    acts.push('<button class="btn-dl" onclick="copyTaskLink(\''+v.id+'\')">คัดลอกลิงก์</button>');
    acts.push('<button class="btn-dl" onclick="shareLine(\''+v.id+'\')">แชร์ไลน์</button>');

    return '<div class="'+cls+'" id="ev-'+tesc(v.id)+'" style="border-left-color:'+col+';">'
      + '<div class="ev-date"><div class="d">'+parseInt(p[2],10)+'</div><div class="m">'+THMON[parseInt(p[1],10)-1]+'</div>'
      + (days>1 ? '<div class="span">'+days+' วัน</div>' : '') + '</div>'
      + '<div class="ev-main">'
      +   '<div class="ev-top"><span class="ev-chip" style="background:'+col+'">'+tesc(v.type||'อื่น ๆ')+'</span>'+badge+'</div>'
      +   '<div class="ev-title">'+tesc(v.title)+'</div>'
      +   '<div class="ev-meta" style="margin-top:2px;">'+evRange(v)+'</div>'
      +   (v.detail ? '<div class="ev-meta">'+tesc(v.detail)+'</div>' : '')
      +   '<div class="ev-meta">'+meta.join('<br>')+'</div>'
      +   (v.note ? '<div class="ev-note">'+tesc(v.note)+'</div>' : '')
      +   '<div class="ev-acts">'+acts.join('')+'</div>'
      + '</div></div>';
  }

  /* แถวกำหนดส่งงานที่แทรกอยู่ในปฏิทิน — กดแล้วเด้งไปแท็บงานที่ต้องส่ง */
  function dueRow(t){
    var p=String(t.due).split('-');
    return '<div class="ev-row duerow" onclick="gotoTask(\''+t.id+'\')" title="ดูรายละเอียดในแท็บงานที่ต้องส่ง">'
      + '<div class="ev-date"><div class="d">'+parseInt(p[2],10)+'</div><div class="m">'+THMON[parseInt(p[1],10)-1]+'</div></div>'
      + '<div class="ev-main">'
      +   '<div class="ev-top"><span class="ev-chip" style="background:#d35450">กำหนดส่งงาน</span></div>'
      +   '<div class="ev-title">'+tesc(t.title)+'</div>'
      +   '<div class="ev-meta">กลุ่ม'+tesc(t.group||'-')+' · กดเพื่อดูรายละเอียด →</div>'
      + '</div></div>';
  }

  function gotoTask(id){ setCalTab('tasks'); location.hash=id; openHashTask(); }
  function findEvent(id){ for(var i=0;i<evData.length;i++) if(evData[i].id===id) return evData[i]; return null; }

  /* ---------- ไฟล์ปฏิทิน .ics ---------- */
  function icsEventFromEv(v){
    var st=String(v.start).replace(/-/g,'');
    var e=String(v.end||v.start).split('-');
    var nx=new Date(parseInt(e[0],10), parseInt(e[1],10)-1, parseInt(e[2],10)+1);   /* DTEND ของ all-day = วันถัดไป */
    var en=nx.getFullYear()+pad2t(nx.getMonth()+1)+pad2t(nx.getDate());
    var desc=[(v.detail||''), (evTime(v)?'เวลา: '+evTime(v):''), 'ผู้ที่ต้องเข้าร่วม: '+(v.who||'-'),
      'กลุ่มเป้าหมาย: '+evTargetText(v), 'กลุ่มงาน: '+(v.group||'-'),
      'ผู้รับผิดชอบ: '+(v.owner||'-')+(v.tel?' โทร. '+v.tel:''),
      (v.regLink?'ลงทะเบียน: '+v.regLink:''), (v.docLink?'เอกสาร: '+v.docLink:''),
      (v.note?'หมายเหตุ: '+v.note:'')].filter(Boolean).join('\\n');
    var mark = v.status==='ยกเลิก' ? '[ยกเลิก] ' : (v.status==='เลื่อน' ? '[เลื่อน] ' : '');
    return ['BEGIN:VEVENT','UID:'+v.id+'@lp2-qa','DTSTART;VALUE=DATE:'+st,'DTEND;VALUE=DATE:'+en,
      'SUMMARY:'+mark+String(v.title||'').replace(/[,;]/g,' '),
      (v.place?'LOCATION:'+String(v.place).replace(/[,;]/g,' '):''),
      'DESCRIPTION:'+desc.replace(/[,;]/g,' '),
      'BEGIN:VALARM','TRIGGER:-P1D','ACTION:DISPLAY','DESCRIPTION:พรุ่งนี้มีกิจกรรมของเขต','END:VALARM',
      'END:VEVENT'].filter(Boolean).join('\r\n');
  }
  function downloadEvIcs(id){ var v=findEvent(id); if(v) saveIcs([icsEventFromEv(v)], v.id+'.ics'); }
  function downloadMonthIcs(){
    var list=evData.filter(function(v){ return inMonth(v) && v.status!=='ยกเลิก'; });
    if(!list.length){ alert('เดือน'+THMONFULL[calM]+' '+(calY+543)+' ยังไม่มีกิจกรรมให้ดาวน์โหลดครับ'); return; }
    saveIcs(list.map(icsEventFromEv), 'กิจกรรมเขต-'+THMONFULL[calM]+(calY+543)+'.ics');
  }

  /* ---------- สมัครรับปฏิทินอัตโนมัติ (ICS subscribe URL ผ่าน Apps Script action=ics) ---------- */
  function icsSubscribeUrl(){ return TASKS_API_URL ? TASKS_API_URL+'?action=ics' : ''; }
  function openIcsSubscribe(){
    var url=icsSubscribeUrl();
    document.getElementById('ics-modal-url').textContent = url || 'ยังไม่เปิดใช้งาน — ต้องเชื่อม TASKS_API_URL ก่อนครับ';
    document.getElementById('ics-modal').classList.add('on');
  }
  function closeIcsSubscribe(){ document.getElementById('ics-modal').classList.remove('on'); }
  function copyIcsUrl(){
    var url=icsSubscribeUrl();
    if(!url){ alert('ยังไม่เปิดใช้งานฟีเจอร์นี้ครับ'); return; }
    function done(){ alert('คัดลอกลิงก์แล้ว\n\nนำไปวางในขั้นตอน "จาก URL" ของ Google Calendar ได้เลย'); }
    if(navigator.clipboard && navigator.clipboard.writeText){ navigator.clipboard.writeText(url).then(done, function(){ prompt('คัดลอกลิงก์นี้',url); }); }
    else prompt('คัดลอกลิงก์นี้',url);
  }

  /* ---------- ลิงก์ตรงถึงกิจกรรม เช่น #AC-690001 ---------- */
  function openHashEvent(){
    var id=decodeURIComponent((location.hash||'').replace('#',''));
    if(id.indexOf('AC-')!==0) return false;
    var v=findEvent(id); if(!v) return false;
    /* เด้งไปเดือนที่กิจกรรมนั้นอยู่ */
    var p=String(v.start).split('-'); calY=parseInt(p[0],10); calM=parseInt(p[1],10)-1;
    show('calendar',null); setCalTab('events');
    setTimeout(function(){
      var el=document.getElementById('ev-'+id);
      if(el){ el.scrollIntoView({behavior:'smooth',block:'center'}); el.style.boxShadow='0 0 0 3px var(--accent-soft)'; }
    },400);
    return true;
  }

  /* ==================================================================
     หน้าสำหรับเจ้าหน้าที่เขต
     ================================================================== */
  var staffMe=null;
  function tapi(payload){
    if(!TASKS_API_URL) return Promise.reject(new Error('ระบบยังไม่ได้เชื่อมต่อกับ Google Sheets (ผู้ดูแลยังไม่ได้ใส่ URL ของ Apps Script)'));
    return fetch(TASKS_API_URL,{method:'POST',headers:{'Content-Type':'text/plain;charset=utf-8'},body:JSON.stringify(payload)})
      .then(function(r){ return r.json(); });
  }
  function staffMsg(txt, isErr){
    var el=document.getElementById('staff-msg'); if(!el) return;
    if(!txt){ el.classList.remove('on'); return; }
    el.textContent=txt; el.classList.toggle('err',!!isErr); el.classList.add('on');
    if(!isErr) setTimeout(function(){ el.classList.remove('on'); },4000);
  }
  function staffLogin(){
    var code=(document.getElementById('staff-code').value||'').trim();
    if(!code){ staffMsg('กรุณากรอกรหัสเจ้าหน้าที่',true); return; }
    staffMsg('');
    tapi({action:'login',code:code}).then(function(res){
      if(res && res.ok){
        staffMe={code:code,name:res.name,group:res.group,role:res.role};
        try{ sessionStorage.setItem('lp2-staff',JSON.stringify(staffMe)); }catch(e){}
        showStaffPanel();
      } else staffMsg((res&&res.error)||'รหัสไม่ถูกต้อง หรือถูกระงับการใช้งาน',true);
    }).catch(function(err){ staffMsg(err.message,true); });
  }
  function staffLogout(){
    staffMe=null; try{ sessionStorage.removeItem('lp2-staff'); }catch(e){}
    document.getElementById('staff-panel').style.display='none';
    document.getElementById('staff-login').style.display='';
    document.getElementById('staff-code').value='';
    staffMsg('');
  }
  function showStaffPanel(){
    if(!staffMe) return;
    document.getElementById('staff-login').style.display='none';
    document.getElementById('staff-panel').style.display='';
    var isAdmin=staffMe.role==='แอดมิน';
    document.getElementById('staff-who').innerHTML=tesc(staffMe.name)+'<span>'+tesc(staffMe.group)+(isAdmin?' · ผู้ดูแลระบบ':'')+'</span>';
    document.getElementById('staff-list-title').textContent=isAdmin?'งานทั้งหมดในระบบ':'งานที่ฉันโพสต์';
    document.getElementById('admin-users-btn').style.display=isAdmin?'':'none';
    setStaffTab('task');
    loadMine();
  }
  function loadMine(){
    tapi({action:'mine',code:staffMe.code}).then(function(res){
      if(!res||!res.ok){ staffMsg((res&&res.error)||'โหลดข้อมูลไม่สำเร็จ',true); return; }
      renderStaffList(res.items||[]);
      if(staffMe.role==='แอดมิน'){
        var late=(res.items||[]).filter(function(t){ return t.status==='เผยแพร่' && dayDiff(t.due) < -ADMIN_ALERT_DAYS; });
        var w=document.getElementById('admin-warn');
        if(late.length){ w.innerHTML='<b>มี '+late.length+' งานที่เลยกำหนดเกิน '+ADMIN_ALERT_DAYS+' วันแล้วแต่ยังไม่ถูกปิด</b><br>ควรกด “ปิดงาน” เพื่อไม่ให้ค้างอยู่หน้าแรก'; w.classList.add('on'); }
        else w.classList.remove('on');
      }
    }).catch(function(err){ staffMsg(err.message,true); });
  }
  function renderStaffList(items){
    var box=document.getElementById('staff-list');
    if(!items.length){ box.innerHTML='<div class="task-empty">ยังไม่มีงานที่โพสต์</div>'; return; }
    items.sort(taskSort);
    box.innerHTML=items.map(function(t){
      var n=dayDiff(t.due), u=urgency(n);
      var badge = t.status==='เผยแพร่'?'<span class="sbadge pub">เผยแพร่</span>'
                : t.status==='ปิดงานแล้ว'?'<span class="sbadge cls">ปิดงานแล้ว</span>'
                : '<span class="sbadge hid">ซ่อนอยู่</span>';
      var h='<div class="srow"><div class="si">';
      h+='<div class="st">'+tesc(t.title)+badge+'</div>';
      h+='<div class="ss">'+tesc(t.group)+' · กำหนดส่ง '+thDate(t.due)+' · '+(t.status==='เผยแพร่'?tesc(u.t):'—')+(staffMe.role==='แอดมิน'?' · โดย '+tesc(t.by||'-'):'')+'</div>';
      h+='</div><div class="sa">';
      h+='<button class="lnk" onclick="openPostForm(\''+tesc(t.id)+'\')">แก้ไข</button>';
      if(t.status!=='ปิดงานแล้ว') h+='<button class="lnk" onclick="setTaskStatus(\''+tesc(t.id)+'\',\'ปิดงานแล้ว\')">ปิดงาน</button>';
      h+= t.status==='ซ่อน'
        ? '<button class="lnk" onclick="setTaskStatus(\''+tesc(t.id)+'\',\'เผยแพร่\')">แสดงอีกครั้ง</button>'
        : '<button class="lnk" onclick="setTaskStatus(\''+tesc(t.id)+'\',\'ซ่อน\')">ซ่อน</button>';
      h+='</div></div>';
      return h;
    }).join('');
    window._staffItems=items;
  }
  function setTaskStatus(id,st){
    if(st==='ปิดงานแล้ว' && !confirm('ยืนยันปิดงานนี้? งานจะหายจากหน้าแรกและย้ายไปแท็บ “งานที่ปิดแล้ว”')) return;
    tapi({action:'setStatus',code:staffMe.code,id:id,status:st}).then(function(res){
      if(res&&res.ok){ staffMsg('บันทึกแล้ว'); loadMine(); loadTasks(); }
      else staffMsg((res&&res.error)||'ทำรายการไม่สำเร็จ',true);
    }).catch(function(err){ staffMsg(err.message,true); });
  }
  function toggleTargetOther(){
    var v=document.getElementById('pf-target').value;
    document.getElementById('pf-target-other-wrap').style.display=(v==='อื่น ๆ (ระบุเอง)'||v==='เฉพาะเครือข่าย')?'':'none';
  }
  function openPostForm(id){
    var f=document.getElementById('post-form'); f.style.display='';
    document.getElementById('pf-id').value=id||'';
    document.getElementById('post-form-title').textContent=id?'แก้ไขงาน':'โพสต์งานใหม่';
    document.getElementById('pf-submit').textContent=id?'บันทึกการแก้ไข':'เผยแพร่';
    var t=id?(window._staffItems||[]).filter(function(x){return x.id===id;})[0]:null;
    document.getElementById('pf-title').value=t?t.title:'';
    document.getElementById('pf-detail').value=t?(t.detail||''):'';
    document.getElementById('pf-due').value=t?t.due:'';
    document.getElementById('pf-prio').value=t?t.prio:'ปกติ';
    document.getElementById('pf-target').value=t?t.target:'ทุกโรงเรียน';
    document.getElementById('pf-target-other').value=t?(t.targetOther||''):'';
    document.getElementById('pf-channel').value=t?t.channel:'Google Form';
    document.getElementById('pf-link').value=t?(t.link||''):'';
    document.getElementById('pf-owner').value=t?(t.owner||''):(staffMe?staffMe.name:'');
    document.getElementById('pf-tel').value=t?(t.tel||''):'';
    toggleTargetOther();
    f.scrollIntoView({behavior:'smooth',block:'start'});
  }
  function closePostForm(){ document.getElementById('post-form').style.display='none'; }

  /* ================= ฝั่งเจ้าหน้าที่ : ปฏิทินกิจกรรม ================= */
  var staffTab = 'task';
  var EV_WHO_OPTS = ['ครูทุกคน','ผู้บริหาร (ผอ./รอง)','ครูวิชาการ','ครูปฐมวัย','ธุรการ','ระบุเอง'];
  var EV_TARGET_OPTS = ['ทุกโรงเรียน','โรงเรียนขนาดเล็ก','โรงเรียนขยายโอกาส','เฉพาะบางโรงเรียน','อื่น ๆ'];

  function setStaffTab(k){
    staffTab = k;
    var a=document.getElementById('sftab-task'), b=document.getElementById('sftab-event');
    if(a) a.classList.toggle('on', k==='task');
    if(b) b.classList.toggle('on', k==='event');
    document.getElementById('sf-new-btn').textContent = (k==='task') ? '+ โพสต์งานใหม่' : '+ โพสต์กิจกรรมใหม่';
    document.getElementById('staff-list').style.display   = (k==='task')  ? '' : 'none';
    document.getElementById('staff-evlist').style.display = (k==='event') ? '' : 'none';
    closePostForm(); closeEventForm();
    var title=document.getElementById('staff-list-title');
    var admin = staffMe && staffMe.role==='แอดมิน';
    if(k==='task')  title.textContent = admin ? 'งานทั้งหมดในระบบ' : 'งานที่ฉันโพสต์';
    else            title.textContent = admin ? 'กิจกรรมทั้งหมดในระบบ' : 'กิจกรรมที่ฉันโพสต์';
    if(k==='event') loadEvMine();
  }
  function staffNew(){ if(staffTab==='task') openPostForm(null); else openEventForm(null); }

  function evFillFormSelects(){
    var t=document.getElementById('ef-type');
    if(t && !t.options.length) t.innerHTML=EV_TYPES.map(function(x){ return '<option>'+tesc(x)+'</option>'; }).join('');
    var w=document.getElementById('ef-who');
    if(w && !w.options.length) w.innerHTML=EV_WHO_OPTS.map(function(x){ return '<option>'+tesc(x)+'</option>'; }).join('');
    var g=document.getElementById('ef-target');
    if(g && !g.options.length) g.innerHTML=EV_TARGET_OPTS.map(function(x){ return '<option>'+tesc(x)+'</option>'; }).join('');
  }
  function evToggleWho(){
    document.getElementById('ef-who-other-wrap').style.display =
      (document.getElementById('ef-who').value==='ระบุเอง') ? '' : 'none';
  }
  function evToggleTarget(){
    var v=document.getElementById('ef-target').value;
    document.getElementById('ef-target-other-wrap').style.display =
      (v==='อื่น ๆ' || v==='เฉพาะบางโรงเรียน') ? '' : 'none';
  }
  function evToggleReg(){
    var on = document.getElementById('ef-needreg').value==='ต้องลงทะเบียน';
    document.getElementById('ef-reglink-wrap').style.display  = on ? '' : 'none';
    document.getElementById('ef-regclose-wrap').style.display = on ? '' : 'none';
  }
  /* เลือกวันเริ่มแล้ว ถ้ายังไม่ได้ใส่วันจบ (หรือวันจบมาก่อน) ให้เติมให้เท่ากัน */
  function evSyncEnd(){
    var st=document.getElementById('ef-start').value, en=document.getElementById('ef-end');
    if(st && (!en.value || en.value < st)) en.value = st;
  }

  function openEventForm(id){
    evFillFormSelects();
    var f=document.getElementById('ev-form'); f.style.display='';
    document.getElementById('ef-id').value=id||'';
    document.getElementById('ev-form-title').textContent=id?'แก้ไขกิจกรรม':'โพสต์กิจกรรมใหม่';
    document.getElementById('ef-submit').textContent=id?'บันทึกการแก้ไข':'เผยแพร่';
    var v=id?(window._staffEvents||[]).filter(function(x){return x.id===id;})[0]:null;
    document.getElementById('ef-title').value=v?v.title:'';
    document.getElementById('ef-type').value=v?(v.type||'อื่น ๆ'):'อบรม/พัฒนาครู';
    document.getElementById('ef-detail').value=v?(v.detail||''):'';
    document.getElementById('ef-start').value=v?v.start:'';
    document.getElementById('ef-end').value=v?(v.end||''):'';
    document.getElementById('ef-tstart').value=v?(v.timeStart||''):'';
    document.getElementById('ef-tend').value=v?(v.timeEnd||''):'';
    document.getElementById('ef-place').value=v?(v.place||''):'';
    var who=v?(v.who||'ครูทุกคน'):'ครูทุกคน';
    var known=EV_WHO_OPTS.indexOf(who)>-1;
    document.getElementById('ef-who').value = known?who:'ระบุเอง';
    document.getElementById('ef-who-other').value = known?'':who;
    document.getElementById('ef-target').value=v?(v.target||'ทุกโรงเรียน'):'ทุกโรงเรียน';
    document.getElementById('ef-target-other').value=v?(v.targetOther||''):'';
    document.getElementById('ef-needreg').value=v?(v.needReg||'ไม่ต้อง'):'ไม่ต้อง';
    document.getElementById('ef-reglink').value=v?(v.regLink||''):'';
    document.getElementById('ef-regclose').value=v?(v.regClose||''):'';
    document.getElementById('ef-doclink').value=v?(v.docLink||''):'';
    document.getElementById('ef-owner').value=v?(v.owner||''):(staffMe?staffMe.name:'');
    document.getElementById('ef-tel').value=v?(v.tel||''):'';
    evToggleWho(); evToggleTarget(); evToggleReg();
    f.scrollIntoView({behavior:'smooth',block:'start'});
  }
  function closeEventForm(){ var f=document.getElementById('ev-form'); if(f) f.style.display='none'; }

  function submitEvent(){
    var whoSel=document.getElementById('ef-who').value;
    var d={
      title:document.getElementById('ef-title').value.trim(),
      type:document.getElementById('ef-type').value,
      detail:document.getElementById('ef-detail').value.trim(),
      start:document.getElementById('ef-start').value,
      end:document.getElementById('ef-end').value,
      timeStart:document.getElementById('ef-tstart').value,
      timeEnd:document.getElementById('ef-tend').value,
      place:document.getElementById('ef-place').value.trim(),
      who: whoSel==='ระบุเอง' ? document.getElementById('ef-who-other').value.trim() : whoSel,
      target:document.getElementById('ef-target').value,
      targetOther:document.getElementById('ef-target-other').value.trim(),
      needReg:document.getElementById('ef-needreg').value,
      regLink:document.getElementById('ef-reglink').value.trim(),
      regClose:document.getElementById('ef-regclose').value,
      docLink:document.getElementById('ef-doclink').value.trim(),
      owner:document.getElementById('ef-owner').value.trim(),
      tel:document.getElementById('ef-tel').value.trim()
    };
    if(!d.title){ staffMsg('กรุณากรอกชื่อกิจกรรม',true); return; }
    if(!d.start){ staffMsg('กรุณาเลือกวันที่เริ่ม',true); return; }
    if(whoSel==='ระบุเอง' && !d.who){ staffMsg('กรุณาระบุผู้ที่ต้องเข้าร่วม',true); return; }
    var id=document.getElementById('ef-id').value;
    tapi({action:id?'evUpdate':'evCreate', code:staffMe.code, id:id, data:d}).then(function(res){
      if(res&&res.ok){
        staffMsg(id?'บันทึกการแก้ไขแล้ว':'เผยแพร่กิจกรรมเรียบร้อยแล้ว');
        closeEventForm(); loadEvMine(); loadEvents();
      } else staffMsg(evErr(res,'บันทึกไม่สำเร็จ'),true);
    }).catch(function(err){ staffMsg(err.message,true); });
  }

  var EV_NOT_READY='ระบบปฏิทินกิจกรรมยังไม่พร้อมใช้งาน — ผู้ดูแลต้องอัปเดตสคริปต์ในชีต กดเมนู ⚙️ ติดตั้ง/ซ่อมชีต แล้ว Deploy เวอร์ชันใหม่ก่อน';
  function evErr(res, fallback){
    var e=(res&&res.error)||fallback;
    return (e==='ไม่รู้จักคำสั่ง' || /ไม่พบชีตชื่อ "กิจกรรมเขต"/.test(e)) ? EV_NOT_READY : e;
  }
  function loadEvMine(){
    tapi({action:'evMine',code:staffMe.code}).then(function(res){
      if(!res||!res.ok){ staffMsg(evErr(res,'โหลดข้อมูลกิจกรรมไม่สำเร็จ'),true); return; }
      renderStaffEvList(res.items||[]);
    }).catch(function(err){ staffMsg(err.message,true); });
  }

  function renderStaffEvList(items){
    var box=document.getElementById('staff-evlist');
    if(!items.length){ box.innerHTML='<div class="task-empty">ยังไม่มีกิจกรรมที่โพสต์</div>'; window._staffEvents=[]; return; }
    items.sort(function(a,b){ return a.start < b.start ? 1 : (a.start > b.start ? -1 : 0); });   /* ใหม่สุดขึ้นก่อน */
    box.innerHTML=items.map(function(v){
      var badge = v.status==='เผยแพร่'?'<span class="sbadge pub">เผยแพร่</span>'
                : v.status==='ยกเลิก' ?'<span class="sbadge cls">ยกเลิกแล้ว</span>'
                : v.status==='เลื่อน' ?'<span class="sbadge cls">เลื่อนกำหนด</span>'
                : '<span class="sbadge hid">ซ่อนอยู่</span>';
      var h='<div class="srow"><div class="si">';
      h+='<div class="st">'+tesc(v.title)+badge+'</div>';
      h+='<div class="ss">'+tesc(v.type||'-')+' · '+evRange(v)+(evTime(v)?' · '+tesc(evTime(v)):'')
        +(staffMe.role==='แอดมิน'?' · โดย '+tesc(v.by||'-'):'')+'</div>';
      h+='</div><div class="sa">';
      h+='<button class="lnk" onclick="openEventForm(\''+tesc(v.id)+'\')">แก้ไข</button>';
      h+='<button class="lnk" onclick="evPostpone(\''+tesc(v.id)+'\')">เลื่อน</button>';
      if(v.status!=='ยกเลิก') h+='<button class="lnk" onclick="evCancel(\''+tesc(v.id)+'\')">ยกเลิก</button>';
      h+= v.status==='ซ่อน'
        ? '<button class="lnk" onclick="evSetStatus(\''+tesc(v.id)+'\',\'เผยแพร่\',\'\')">แสดงอีกครั้ง</button>'
        : '<button class="lnk" onclick="evSetStatus(\''+tesc(v.id)+'\',\'ซ่อน\',\'\')">ซ่อน</button>';
      h+='</div></div>';
      return h;
    }).join('');
    window._staffEvents=items;
  }

  function evSetStatus(id,st,note){
    tapi({action:'evStatus',code:staffMe.code,id:id,status:st,note:note||''}).then(function(res){
      if(res&&res.ok){ staffMsg('บันทึกแล้ว'); loadEvMine(); loadEvents(); }
      else staffMsg(evErr(res,'ทำรายการไม่สำเร็จ'),true);
    }).catch(function(err){ staffMsg(err.message,true); });
  }

  /*  เลื่อนกิจกรรม = แก้วันที่ก่อน แล้วค่อยตั้งสถานะ "เลื่อน" พร้อมหมายเหตุ
      เพื่อให้ครูที่จดวันเดิมไว้เห็นว่าเลื่อนจากวันไหนไปวันไหน  */
  function evPostpone(id){
    var v=(window._staffEvents||[]).filter(function(x){return x.id===id;})[0];
    if(!v) return;
    var nd=prompt('เลื่อนกิจกรรม "'+v.title+'"\n\nวันเดิมคือ '+thDate(v.start)+'\nพิมพ์วันใหม่ในรูปแบบ ปปปป-ดด-วว (ค.ศ.)\nเช่น 2026-09-22', v.start);
    if(!nd) return;
    if(!/^\d{4}-\d{2}-\d{2}$/.test(nd)){ alert('รูปแบบวันที่ไม่ถูกต้อง ต้องเป็น ปปปป-ดด-วว เช่น 2026-09-22'); return; }
    var reason=prompt('เหตุผลที่เลื่อน (ครูจะเห็นข้อความนี้)','เลื่อนจาก '+thDate(v.start)+' เป็น '+thDate(nd));
    if(!reason){ alert('ต้องระบุเหตุผล เพื่อให้ครูที่จดวันเดิมไว้เข้าใจครับ'); return; }
    var span = evDays(v);                                   /* คงจำนวนวันเดิมไว้ */
    var ndEnd = nd;
    if(span>1){
      var t=new Date(nd); t.setDate(t.getDate()+span-1);
      ndEnd = t.getFullYear()+'-'+pad2t(t.getMonth()+1)+'-'+pad2t(t.getDate());
    }
    var d={};
    ['title','type','detail','timeStart','timeEnd','place','who','target','targetOther',
     'needReg','regLink','regClose','docLink','owner','tel'].forEach(function(k){ d[k]=v[k]||''; });
    d.start=nd; d.end=ndEnd;
    tapi({action:'evUpdate',code:staffMe.code,id:id,data:d}).then(function(res){
      if(!res||!res.ok){ staffMsg((res&&res.error)||'เลื่อนไม่สำเร็จ',true); return; }
      evSetStatus(id,'เลื่อน',reason);
    }).catch(function(err){ staffMsg(err.message,true); });
  }

  function evCancel(id){
    var v=(window._staffEvents||[]).filter(function(x){return x.id===id;})[0];
    if(!v) return;
    var reason=prompt('ยกเลิกกิจกรรม "'+v.title+'"\n\nกิจกรรมจะยังแสดงแบบขีดฆ่าอีก 30 วัน เพื่อให้ครูที่จดไว้เห็น\n\nเหตุผลที่ยกเลิก:','');
    if(!reason){ if(reason!==null) alert('ต้องระบุเหตุผลครับ'); return; }
    evSetStatus(id,'ยกเลิก',reason);
  }

  function submitPost(){
    var d={
      title:document.getElementById('pf-title').value.trim(),
      detail:document.getElementById('pf-detail').value.trim(),
      due:document.getElementById('pf-due').value,
      prio:document.getElementById('pf-prio').value,
      target:document.getElementById('pf-target').value,
      targetOther:document.getElementById('pf-target-other').value.trim(),
      channel:document.getElementById('pf-channel').value,
      link:document.getElementById('pf-link').value.trim(),
      owner:document.getElementById('pf-owner').value.trim(),
      tel:document.getElementById('pf-tel').value.trim()
    };
    if(!d.title){ staffMsg('กรุณากรอกชื่องาน',true); return; }
    if(!d.due){ staffMsg('กรุณาเลือกวันกำหนดส่ง',true); return; }
    var id=document.getElementById('pf-id').value;
    tapi({action:id?'update':'create',code:staffMe.code,id:id,data:d}).then(function(res){
      if(res&&res.ok){ staffMsg(id?'บันทึกการแก้ไขแล้ว':'เผยแพร่งานเรียบร้อยแล้ว'); closePostForm(); loadMine(); loadTasks(); }
      else staffMsg((res&&res.error)||'บันทึกไม่สำเร็จ',true);
    }).catch(function(err){ staffMsg(err.message,true); });
  }
  function toggleUsers(){
    var b=document.getElementById('admin-users');
    if(b.style.display==='none'){ b.style.display=''; loadUsers(); } else b.style.display='none';
  }
  function loadUsers(){
    tapi({action:'users',code:staffMe.code}).then(function(res){
      if(!res||!res.ok){ staffMsg((res&&res.error)||'โหลดรายชื่อไม่สำเร็จ',true); return; }
      var box=document.getElementById('admin-users-list');
      box.innerHTML=(res.items||[]).map(function(u){
        var on=u.status==='ใช้งาน';
        return '<div class="srow"><div class="si"><div class="st">'+tesc(u.name)+
          '<span class="sbadge '+(on?'pub':'hid')+'">'+tesc(u.status)+'</span></div>'+
          '<div class="ss">'+tesc(u.group)+' · รหัส '+tesc(u.code)+' · '+tesc(u.role)+'</div></div>'+
          '<div class="sa"><button class="lnk" onclick="setUser(\''+tesc(u.code)+'\',\''+(on?'ระงับ':'ใช้งาน')+'\')">'+(on?'ระงับรหัส':'เปิดใช้งาน')+'</button></div></div>';
      }).join('')||'<div class="task-empty">ยังไม่มีรหัสในระบบ</div>';
    }).catch(function(err){ staffMsg(err.message,true); });
  }
  function setUser(code,st){
    tapi({action:'setUserStatus',code:staffMe.code,target:code,status:st}).then(function(res){
      if(res&&res.ok){ staffMsg('บันทึกแล้ว'); loadUsers(); } else staffMsg((res&&res.error)||'ทำรายการไม่สำเร็จ',true);
    }).catch(function(err){ staffMsg(err.message,true); });
  }
  function issueCode(){
    var name=document.getElementById('nu-name').value.trim(), group=document.getElementById('nu-group').value;
    if(!name){ staffMsg('กรุณากรอกชื่อ-สกุล',true); return; }
    tapi({action:'issueCode',code:staffMe.code,name:name,group:group}).then(function(res){
      if(res&&res.ok){ alert('ออกรหัสให้ '+name+' เรียบร้อยแล้ว\n\nรหัส: '+res.newCode+'\n\nกรุณาแจ้งรหัสนี้ให้เจ้าหน้าที่โดยตรง'); document.getElementById('nu-name').value=''; loadUsers(); }
      else staffMsg((res&&res.error)||'ออกรหัสไม่สำเร็จ',true);
    }).catch(function(err){ staffMsg(err.message,true); });
  }

  /* ---------- เริ่มทำงาน ---------- */
  try{
    var saved=sessionStorage.getItem('lp2-staff');
    if(saved){ staffMe=JSON.parse(saved); }
  }catch(e){}
  if(staffMe && document.getElementById('staff-panel')) showStaffPanel();
  window.addEventListener('hashchange', function(){
    if(!openHashEvent()) openHashTask();
  });
  loadTasks();
  loadEvents();

