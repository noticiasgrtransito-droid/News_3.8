
(async function(){
  function nowStr(){const d=new Date();return d.toLocaleDateString()+' '+d.toLocaleTimeString();}
  function detectType(t){t=(t||'').toLowerCase();if(/acidente|capot|colis/i.test(t))return'Acidente';if(/roubo|assalto/i.test(t))return'Roubo';if(/furto/i.test(t))return'Furto';if(/interdi|bloqueio|obra|manuten/i.test(t))return'Interdição';if(/porto|navio|marítim/i.test(t))return'Portos/Marítimos';return'Outros';}
  function detectRoad(t){const m=(t||'').match(/BR[-\s]?\d{1,4}|SP[-\s]?\d{1,3}|RODOANEL/i);return m?m[0].toUpperCase().replace(' ','-'):'';}
  function detectRegion(t){t=(t||'').toLowerCase();if(/s[oã]o paulo|sao paulo|minas gerais|rio de janeiro|espirito santo/i.test(t))return'Sudeste';if(/paran[aá]|santa catarina|rio grande do sul/i.test(t))return'Sul';if(/goias|mato grosso|distrito federal/i.test(t))return'Centro-Oeste';if(/bahia|pernambuco|ceara|maranhao/i.test(t))return'Nordeste';if(/acre|amazonas|roraima|rondonia/i.test(t))return'Norte';return'Outras';}

  // login
  const loginBtn=document.getElementById('loginBtn'), userInp=document.getElementById('user'), passInp=document.getElementById('pass'), loginMsg=document.getElementById('loginMsg');
  function showApp(){document.getElementById('login-screen').style.display='none';document.getElementById('app').classList.remove('hidden');initApp();}
  loginBtn.addEventListener('click',()=>{const u=userInp.value.trim(),p=passInp.value.trim(); if(u==='adm' && p==='adm'){sessionStorage.setItem('congrl_auth','adm'); showApp(); } else {loginMsg.textContent='Usuário ou senha incorretos'; setTimeout(()=>loginMsg.textContent='',2500);} });
  if(sessionStorage.getItem('congrl_auth')==='adm'){showApp();}

  async function initApp(){
    document.getElementById('now').textContent = nowStr(); setInterval(()=>document.getElementById('now').textContent = nowStr(), 1000);

    const roadSel = document.getElementById('roadFilter');
    const roads = await fetch('./data/rodovias.json').then(r=>r.json()).catch(()=>[]);
    roads.forEach(r=>{ const o = document.createElement('option'); o.value=r; o.textContent=r; roadSel.appendChild(o); });

    const concessions = await fetch('./data/concessionarias.json').then(r=>r.json()).catch(()=>[]);
    const concesList = document.getElementById('concessList');
    concesList.innerHTML = concessions.map(c=>`<div class="concess" data-site="${c.site}">${c.name}</div>`).join('');
    concesList.addEventListener('click', (e)=>{ const el = e.target.closest('.concess'); if(el && el.dataset.site) window.open(el.dataset.site,'_blank'); });

    // charts
    const ctxTypes = document.getElementById('chartTypes').getContext('2d');
    const ctxRegions = document.getElementById('chartRegions').getContext('2d');
    const chartTypes = new Chart(ctxTypes, { type:'bar', data:{ labels:[], datasets:[{ label:'Ocorrências', data:[], backgroundColor:'#0d47a1' }] }, options:{ maintainAspectRatio:false } });
    const chartRegions = new Chart(ctxRegions, { type:'doughnut', data:{ labels:[], datasets:[{ data:[], backgroundColor:['#0d47a1','#1976d2','#42a5f5','#90caf9','#64b5f6'] }] }, options:{ maintainAspectRatio:false } });

    // map lazy init
    let map, markers;
    function initMap(){ if(map) return; map = L.map('map',{scrollWheelZoom:false}).setView([-14.2350,-51.9253],4); L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png').addTo(map); markers = L.layerGroup().addTo(map); document.getElementById('expandMap').addEventListener('click', ()=> window.open('./map.html','_blank')); }

    async function fetchFeeds(){
      const local = await fetch('./data/mock_data.json').then(r=>r.json()).catch(()=>null);
      const embedded = local || [
        {"title":"Acidente na BR-381","link":"#","pubDate":new Date().toISOString(),"source":"local","snippet":"exemplo","type":"Acidente","road":"BR-381","region":"Sudeste","lat":-19.9667,"lon":-44.1986}
      ];
      const normalized = embedded.map(it=>{ it.type = it.type || detectType(it.title+' '+(it.snippet||'')); it.road = it.road || detectRoad(it.title+' '+(it.snippet||'')); it.region = it.region || detectRegion(it.title+' '+(it.snippet||'')); return it; });
      localStorage.setItem('congrl_cache', JSON.stringify({ items: normalized, fetched: new Date().toISOString() }));
      localStorage.setItem('congrl_used_sources', JSON.stringify(Array.from(new Set(normalized.map(i=>i.source||'local')))));
      return normalized;
    }

    function renderNews(list){
      const newsList = document.getElementById('newsList'); newsList.innerHTML='';
      list.forEach(it=>{
        const time = new Date(it.pubDate);
        const timestr = time.toLocaleDateString() + ' ' + time.toLocaleTimeString();
        const div = document.createElement('div'); div.className='news-item';
        div.innerHTML = `<div style="flex:1;min-width:220px"><span class="meta">[${it.type}] ${it.road? '— '+it.road : ''}</span> <a href="${it.link}" target="_blank">${it.title}</a></div><div class="meta">${it.source} • ${timestr}</div>`;
        div.addEventListener('click', ()=> { if(it.lat && it.lon){ initMap(); map.setView([it.lat,it.lon],11); L.popup().setLatLng([it.lat,it.lon]).setContent(`<strong>${it.title}</strong><br>${it.source}`).openOn(map); } });
        newsList.appendChild(div);
      });
    }

    function updateStats(list){
      document.getElementById('statAcc').innerText = list.filter(i=>i.type==='Acidente').length;
      document.getElementById('statInt').innerText = list.filter(i=>i.type==='Interdição' || i.type==='Trânsito').length;
      document.getElementById('statRoubo').innerText = list.filter(i=>i.type==='Roubo').length;
      document.getElementById('statFurto').innerText = list.filter(i=>i.type==='Furto').length;
    }

    function updateCharts(list){
      const byType = {}; list.forEach(i=> byType[i.type] = (byType[i.type]||0)+1);
      chartTypes.data.labels = Object.keys(byType); chartTypes.data.datasets[0].data = Object.values(byType); chartTypes.update();
      const byRegion = {}; list.forEach(i=> byRegion[i.region] = (byRegion[i.region]||0)+1);
      chartRegions.data.labels = Object.keys(byRegion); chartRegions.data.datasets[0].data = Object.values(byRegion); chartRegions.update();
    }

    function addMarkers(list){
      initMap();
      markers.clearLayers();
      list.forEach(it=>{ if(!(it.lat && it.lon)) return; const emoji = it.type==='Acidente'?'🚗':(it.type==='Interdição'?'🚧':(it.type==='Roubo'?'🚨':(it.type==='Furto'?'⚪':'⚠️'))); const icon = L.divIcon({html:`<div style="background:#0d47a1;color:#fff;border-radius:50%;width:30px;height:30px;display:flex;align-items:center;justify-content:center">${emoji}</div>`, className:''}); const m = L.marker([it.lat,it.lon],{icon}).addTo(markers); m.bindPopup(`<strong>${it.title}</strong><br>${it.source}`); });
      const layers = markers.getLayers(); if(layers.length){ const group = L.featureGroup(layers); try{ map.fitBounds(group.getBounds().pad(0.2)); }catch(e){} }
    }

    const all = await fetchFeeds();
    renderNews(all); updateStats(all); updateCharts(all);
    setTimeout(()=>{ try{ addMarkers(all); }catch(e){ console.warn('markers failed', e); } }, 500);

    ['search','typeFilter','regionFilter','roadFilter'].forEach(id=>{
      const el = document.getElementById(id);
      if(!el) return;
      el.addEventListener('input', ()=> applyFilters(JSON.parse(localStorage.getItem('congrl_cache')).items) );
      el.addEventListener('change', ()=> applyFilters(JSON.parse(localStorage.getItem('congrl_cache')).items) );
    });

    function applyFilters(items){
      const q = (document.getElementById('search').value||'').toLowerCase();
      const type = document.getElementById('typeFilter').value;
      const region = document.getElementById('regionFilter').value;
      const rod = document.getElementById('roadFilter').value;
      let filtered = items.filter(i=>{
        if(q && (i.title + ' ' + i.snippet + ' ' + i.source).toLowerCase().indexOf(q) === -1) return false;
        if(type && i.type !== type) return false;
        if(region && i.region !== region) return false;
        if(rod && rod.length){
          if(!((i.road && i.road.indexOf(rod) !== -1) || (i.title && i.title.indexOf(rod) !== -1) || (rod.toLowerCase().includes('rodoanel') && (i.title||'').toLowerCase().includes('rodoanel')))) return false;
        }
        return true;
      });
      renderNews(filtered); updateStats(filtered); updateCharts(filtered); addMarkers(filtered);
      document.getElementById('lastFetch').innerText = new Date().toLocaleString();
      document.getElementById('fontesList').innerHTML = (JSON.parse(localStorage.getItem('congrl_used_sources')||'[]')||[]).map(s=>`<div>${s}</div>`).join('')||'<div>Nenhuma fonte</div>';
    }

    document.getElementById('csvBtn').addEventListener('click', ()=>{
      const cache = JSON.parse(localStorage.getItem('congrl_cache')||'{"items":[]}');
      const items = cache.items || [];
      if(!items.length){ alert('Sem dados para exportar'); return; }
      const rows=[['Data Baixada','Título','Fonte','Data da Notícia','Link','Tipo','Rodovia']];
      const now = new Date().toLocaleString();
      items.forEach(it=> rows.push([now, it.title||'', it.source||'', it.pubDate||'', it.link||'', it.type||'', it.road||'']));
      const csv = rows.map(r=> r.map(c=>'"'+String(c).replace(/"/g,'""')+'"').join(';')).join('\n');
      const blob = new Blob([csv], {type:'text/csv;charset=utf-8;'});
      const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = 'congrl_noticias.csv'; a.click();
    });

    document.getElementById('ajudaBtn').addEventListener('click', ()=> document.getElementById('ajudaModal').style.display='block');
    document.getElementById('fontesBtn').addEventListener('click', ()=> document.getElementById('fontesModal').style.display='block');
    document.getElementById('fontesBuscaBtn').addEventListener('click', ()=> document.getElementById('fontesBuscaModal').style.display='block');
    document.querySelectorAll('.close').forEach(el=> el.addEventListener('click', e=> document.getElementById(e.target.dataset.for).style.display='none' ));
    document.querySelectorAll('.btn-close').forEach(el=> el.addEventListener('click', e=> document.getElementById(e.target.dataset.for).style.display='none' ));
  } // initApp end
})();