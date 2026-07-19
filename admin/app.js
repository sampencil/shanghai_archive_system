const cfg=window.ADMIN_SUPABASE;
const sb=window.supabase.createClient(cfg.url,cfg.publishableKey);
let rows=[],regions=[],venues=[],selected=null,selectedVenueId=null;
const $=id=>document.getElementById(id);
const escapeHtml=value=>String(value??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
const resolveImageUrl=value=>{if(!value)return '';try{return new URL(value,value.startsWith('assets/')?new URL('../',location.href):location.href).href}catch{return value}};
const assetFields=['system_id','region','exhibition_weight','exhibition_title','venue','venue_id','use_venue_coordinates','object_name','start_date','end_date','image_url','longitude','latitude','description','status','sort_order'];
const numericFields=new Set(['longitude','latitude','sort_order']);
const boolFields=new Set(['use_venue_coordinates']);
// Visual weight UI is numeric (1–5), while legacy databases may still store A/B/C/D.
// This adapter keeps the existing Supabase constraint working without requiring a migration:
// A→5, B→4, C→3, D→2, empty/null→1.
const LEGACY_TO_VISUAL_WEIGHT={A:5,B:4,C:3,D:2};
const VISUAL_TO_LEGACY_WEIGHT={1:null,2:'D',3:'C',4:'B',5:'A'};
function visualWeight(value){const key=String(value??'').trim().toUpperCase();if(LEGACY_TO_VISUAL_WEIGHT[key])return LEGACY_TO_VISUAL_WEIGHT[key];const n=Number(key);return Number.isFinite(n)?Math.max(1,Math.min(5,Math.round(n))):1}
function storageWeight(value){return VISUAL_TO_LEGACY_WEIGHT[visualWeight(value)]??null}
function weightLabel(value){const n=visualWeight(value);return `${n} · ${n===5?'主视觉':n===4?'次主视觉':n===3?'标准':n===2?'点缀':'微型点缀'}`}


async function boot(){
  const {data:{session}}=await sb.auth.getSession();
  session?showApp():showLogin();
  sb.auth.onAuthStateChange((_e,s)=>s?showApp():showLogin());
}
function showLogin(){$('login').hidden=false;$('app').hidden=true}
async function showApp(){$('login').hidden=true;$('app').hidden=false;await loadAll()}
$('loginForm').onsubmit=async e=>{e.preventDefault();$('loginMsg').textContent='登录中…';const {error}=await sb.auth.signInWithPassword({email:$('email').value,password:$('password').value});$('loginMsg').textContent=error?error.message:''};
$('signOut').onclick=()=>sb.auth.signOut();

document.querySelectorAll('.view-tabs button').forEach(button=>button.onclick=()=>switchView(button.dataset.view));
function switchView(view){
  document.querySelectorAll('.view-tabs button').forEach(b=>b.classList.toggle('active',b.dataset.view===view));
  ['detail','sheet','regions','venues'].forEach(name=>$(name+'View').hidden=view!==name);
  if(view==='sheet')renderSheet();
  if(view==='regions')renderRegions();
  if(view==='venues')renderVenues();
}
async function loadAll(){
  const [assetsRes,regionsRes,venuesRes]=await Promise.all([
    sb.from('assets').select('*').order('sort_order'),
    sb.from('regions').select('*').order('sort_order'),
    sb.from('venues').select('*').order('sort_order').order('name')
  ]);
  if(assetsRes.error)return alert(assetsRes.error.message);
  if(regionsRes.error)return alert('请先执行 database/supabase-migration-v25.sql：'+regionsRes.error.message);
  if(venuesRes.error)return alert('请先执行 database/supabase-migration-v26.sql：'+venuesRes.error.message);
  rows=assetsRes.data||[];regions=regionsRes.data||[];venues=venuesRes.data||[];
  renderRegionOptions();renderVenueOptions();renderList();renderSheet();renderRegions();renderVenues();
  if(!selected&&rows[0])edit(rows[0]);
}
function renderRegionOptions(){
  const options=regions.map(r=>`<option value="${escapeHtml(r.name)}">${escapeHtml(r.name)}</option>`).join('');
  const current=$('region').value,filter=$('regionFilter').value;
  $('region').innerHTML=options;$('regionFilter').innerHTML='<option value="">全部区域</option>'+options;
  if(regions.some(r=>r.name===current))$('region').value=current;
  if(regions.some(r=>r.name===filter))$('regionFilter').value=filter;
}
function renderVenueOptions(){
  $('venueOptions').innerHTML=venues.map(v=>`<option value="${escapeHtml(v.name)}"></option>`).join('');
}
function venueById(id){return venues.find(v=>v.id===id)}
function venueByName(name){return venues.find(v=>v.name.trim().toLowerCase()===String(name||'').trim().toLowerCase())}
function effectiveCoordinates(row){
  const venue=venueById(row.venue_id);
  if(row.use_venue_coordinates!==false&&venue)return {longitude:venue.longitude,latitude:venue.latitude,source:'地点库'};
  return {longitude:row.longitude,latitude:row.latitude,source:'展览自定义'};
}
function renderList(){
  const q=$('search').value.toLowerCase(),reg=$('regionFilter').value;
  const list=rows.filter(x=>(!reg||x.region===reg)&&[x.system_id,x.exhibition_title,x.venue,x.object_name].join(' ').toLowerCase().includes(q));
  $('list').innerHTML=list.map(x=>{const c=effectiveCoordinates(x);return `<div class="item ${selected===x.id?'active':''}" data-id="${x.id}"><small>${escapeHtml(x.system_id)} · ${escapeHtml(x.region)} · ${escapeHtml(weightLabel(x.exhibition_weight))} · ${x.status==='published'?'已发布':'草稿'}</small><h3>${escapeHtml(x.exhibition_title)}</h3><p>${escapeHtml(x.venue)} · ${c.source}</p></div>`}).join('');
  document.querySelectorAll('.item').forEach(el=>el.onclick=()=>edit(rows.find(x=>x.id===el.dataset.id)));
}
$('search').oninput=renderList;$('regionFilter').onchange=renderList;
function edit(x){
  selected=x?.id||null;
  assetFields.forEach(k=>{const el=$(k);if(!el)return;if(k==='use_venue_coordinates')el.value=String(x?.[k]!==false);else if(k==='exhibition_weight')el.value=String(visualWeight(x?.[k]));else el.value=x?.[k]??''});
  $('rowId').value=x?.id||'';
  $('previewImg').src=resolveImageUrl(x?.image_url||'');
  $('deleteBtn').style.visibility=x?'visible':'hidden';
  syncVenueSelectionFromName();updateCoordinateMode();renderList();
}
$('newBtn').onclick=()=>edit(null);
$('image_url').oninput=()=>$('previewImg').src=resolveImageUrl($('image_url').value);
$('venue').addEventListener('input',syncVenueSelectionFromName);
$('venue').addEventListener('change',()=>{syncVenueSelectionFromName();applyVenueCoordinatesPreview()});
$('use_venue_coordinates').addEventListener('change',updateCoordinateMode);
function syncVenueSelectionFromName(){
  const found=venueByName($('venue').value);
  $('venue_id').value=found?.id||'';
  updateCoordinateMode();
}
function applyVenueCoordinatesPreview(){
  const venue=venueById($('venue_id').value);
  if(venue&&$('use_venue_coordinates').value==='true'){
    $('longitude').value=venue.longitude??'';$('latitude').value=venue.latitude??'';
  }
  updateCoordinateMode();
}
function updateCoordinateMode(){
  const useVenue=$('use_venue_coordinates').value==='true';
  const venue=venueById($('venue_id').value);
  $('longitude').disabled=useVenue;
  $('latitude').disabled=useVenue;
  const wrap=$('use_venue_coordinates').closest('.coordinate-source');
  wrap.classList.toggle('is-manual',!useVenue);
  if(useVenue&&venue){
    $('venueCoordinateHint').textContent=`当前引用：${venue.name} · ${venue.longitude??'未填写'}, ${venue.latitude??'未填写'}`;
    $('longitude').value=venue.longitude??'';$('latitude').value=venue.latitude??'';
  }else if(useVenue){
    $('venueCoordinateHint').textContent='请先从地点库中选择一个地点。';
  }else{
    $('venueCoordinateHint').textContent='该展览使用独立坐标，不会跟随地点库更新。';
  }
}
$('quickAddVenue').onclick=()=>{
  $('quickVenuePanel').hidden=false;$('quickVenueName').value=$('venue').value;$('quickVenueName').focus();
};
$('cancelQuickVenue').onclick=()=>{$('quickVenuePanel').hidden=true};
$('saveQuickVenue').onclick=async()=>{
  const name=$('quickVenueName').value.trim();if(!name)return alert('请填写地点名称');
  const payload={name,longitude:numOrNull($('quickVenueLng').value),latitude:numOrNull($('quickVenueLat').value),sort_order:venues.length};
  const {data,error}=await sb.from('venues').insert(payload).select().single();
  if(error)return alert(error.message);
  venues.push(data);renderVenueOptions();$('venue').value=data.name;$('venue_id').value=data.id;$('quickVenuePanel').hidden=true;applyVenueCoordinatesPreview();renderVenues();
};
function numOrNull(value){return value===''||value==null?null:Number(value)}
function normalizePayload(source){
  const payload={};
  for(const k of assetFields){
    let value=source[k];
    if(numericFields.has(k))value=numOrNull(value);
    if(boolFields.has(k))value=value===true||value==='true';
    payload[k]=value??'';
  }
  const venue=venueById(payload.venue_id)||venueByName(payload.venue);
  if(venue){payload.venue_id=venue.id;payload.venue=venue.name}
  else payload.venue_id=null;
  payload.exhibition_weight=storageWeight(payload.exhibition_weight);
  payload.sort_order=Number(payload.sort_order||0);
  if(payload.use_venue_coordinates){payload.longitude=null;payload.latitude=null}
  return payload;
}
$('assetForm').onsubmit=async e=>{
  e.preventDefault();$('formMsg').textContent='保存中…';
  const raw={};assetFields.forEach(k=>{const el=$(k);raw[k]=el?.value});
  const payload=normalizePayload(raw),id=$('rowId').value;
  if(!payload.venue_id)return $('formMsg').textContent='请从地点库选择地点，或先新增地点。';
  const chosen=venueById(payload.venue_id);
  if(payload.use_venue_coordinates&&(chosen?.longitude==null||chosen?.latitude==null))return $('formMsg').textContent='该地点尚未填写完整经纬度，请完善地点库或改为手动坐标。';
  const res=id?await sb.from('assets').update(payload).eq('id',id).select().single():await sb.from('assets').insert(payload).select().single();
  $('formMsg').textContent=res.error?res.error.message:'已保存';if(!res.error){selected=res.data.id;await loadAll()}
};
$('deleteBtn').onclick=async()=>{if(!selected||!confirm('确定删除这条资产？'))return;const {error}=await sb.from('assets').delete().eq('id',selected);if(error)return alert(error.message);selected=null;edit(null);await loadAll()};
$('imageFile').onchange=async e=>{const file=e.target.files[0];if(!file)return;$('formMsg').textContent='上传中…';const ext=file.name.split('.').pop(),path=`${Date.now()}-${crypto.randomUUID()}.${ext}`;const {error}=await sb.storage.from('exhibition-assets').upload(path,file,{upsert:false});if(error){$('formMsg').textContent=error.message;return}const {data}=sb.storage.from('exhibition-assets').getPublicUrl(path);$('image_url').value=data.publicUrl;$('previewImg').src=data.publicUrl;$('formMsg').textContent='图片已上传，点击“保存资产”完成关联'};

function regionSelect(value){return `<select data-field="region">${regions.map(r=>`<option ${r.name===value?'selected':''}>${escapeHtml(r.name)}</option>`).join('')}</select>`}
function venueSelect(value){return `<select data-field="venue_id">${venues.map(v=>`<option value="${v.id}" ${v.id===value?'selected':''}>${escapeHtml(v.name)}</option>`).join('')}</select>`}
function coordinateSourceSelect(value){const use=value!==false;return `<select class="coord-source" data-field="use_venue_coordinates"><option value="true" ${use?'selected':''}>引用地点坐标</option><option value="false" ${!use?'selected':''}>展览独立坐标</option></select>`}
function weightSelect(value){const current=visualWeight(value);return `<select data-field="exhibition_weight">${[1,2,3,4,5].map(w=>`<option value="${w}" ${w===current?'selected':''}>${weightLabel(w)}</option>`).join('')}</select>`}
function statusSelect(value){return `<select data-field="status"><option value="draft" ${value==='draft'?'selected':''}>草稿</option><option value="published" ${value==='published'?'selected':''}>已发布</option></select>`}
function inputCell(field,value,type='text',cls=''){return `<input class="${cls}" data-field="${field}" type="${type}" ${type==='number'?'step="any"':''} value="${escapeHtml(value??'')}">`}
function rowHtml(row,isNew=false){
  return `<tr data-id="${row.id||''}" data-new="${isNew?'true':'false'}"><td class="select-col"><input class="row-select" type="checkbox" aria-label="选择此行"></td><td class="sticky-col"><div class="row-actions"><button class="save-row">保存</button><button class="remove">删除</button></div></td>
  <td>${inputCell('system_id',row.system_id)}</td><td>${regionSelect(row.region||regions[0]?.name||'')}</td><td>${weightSelect(row.exhibition_weight)}</td>
  <td>${inputCell('exhibition_title',row.exhibition_title,'text','cell-wide')}</td><td>${venueSelect(row.venue_id||venues[0]?.id||'')}</td><td>${coordinateSourceSelect(row.use_venue_coordinates)}</td><td>${inputCell('object_name',row.object_name,'text','cell-wide')}</td>
  <td>${inputCell('start_date',row.start_date,'date')}</td><td>${inputCell('end_date',row.end_date,'date')}</td><td>${inputCell('longitude',row.longitude,'number')}</td><td>${inputCell('latitude',row.latitude,'number')}</td>
  <td>${inputCell('image_url',row.image_url,'text','cell-image')}</td><td>${statusSelect(row.status||'draft')}</td><td>${inputCell('sort_order',row.sort_order??0,'number')}</td><td><textarea class="cell-desc" data-field="description">${escapeHtml(row.description||'')}</textarea></td></tr>`;
}
function renderSheet(){const tbody=$('assetTable').querySelector('tbody');tbody.innerHTML=rows.map(r=>rowHtml(r)).join('');$('sheetCount').textContent=`${rows.length} 条`;bindSheetRows()}
function bindSheetRows(){
  $('assetTable').querySelectorAll('tr[data-id]').forEach(tr=>{
    tr.querySelector('.save-row').onclick=()=>saveSheetRow(tr);tr.querySelector('.remove').onclick=()=>deleteSheetRow(tr);
    const source=tr.querySelector('[data-field="use_venue_coordinates"]');
    const venue=tr.querySelector('[data-field="venue_id"]');
    const sync=()=>{const use=source.value==='true';tr.querySelector('[data-field="longitude"]').disabled=use;tr.querySelector('[data-field="latitude"]').disabled=use};
    source.onchange=sync;venue.onchange=sync;sync();
  });
}
function readSheetRow(tr){const raw={};tr.querySelectorAll('[data-field]').forEach(el=>raw[el.dataset.field]=el.value);const v=venueById(raw.venue_id);raw.venue=v?.name||'';return normalizePayload(raw)}
async function saveSheetRow(tr){const payload=readSheetRow(tr),id=tr.dataset.id;tr.classList.add('saving');const res=id?await sb.from('assets').update(payload).eq('id',id).select().single():await sb.from('assets').insert(payload).select().single();tr.classList.remove('saving');if(res.error)return alert(res.error.message);tr.dataset.id=res.data.id;tr.dataset.new='false';$('sheetMsg').textContent=`${payload.system_id} 已保存`;await refreshDataOnly()}
async function deleteSheetRow(tr){const id=tr.dataset.id;if(!confirm('确定删除这一行？'))return;if(id){const {error}=await sb.from('assets').delete().eq('id',id);if(error)return alert(error.message)}tr.remove();await refreshDataOnly()}
$('addSheetRow').onclick=()=>{const tbody=$('assetTable').querySelector('tbody');tbody.insertAdjacentHTML('afterbegin',rowHtml({region:regions[0]?.name,venue_id:venues[0]?.id,use_venue_coordinates:true,exhibition_weight:1,status:'draft',sort_order:0},true));bindSheetRows();tbody.querySelector('tr').querySelector('[data-field="system_id"]').focus()};
$('saveAllRows').onclick=async()=>{const trs=[...$('assetTable').querySelectorAll('tbody tr')];$('sheetMsg').textContent='正在保存全部修改…';for(const tr of trs)await saveSheetRow(tr);$('sheetMsg').textContent=`已保存 ${trs.length} 条`};
async function refreshDataOnly(){const {data,error}=await sb.from('assets').select('*').order('sort_order');if(!error){rows=data||[];renderList();$('sheetCount').textContent=`${rows.length} 条`;renderVenues()}}

function renderRegions(){$('regionsList').innerHTML=regions.map(r=>regionRowHtml(r)).join('');bindRegionRows()}
function regionRowHtml(r={}){return `<div class="region-row" data-id="${r.id||''}"><label>区域名称<input data-field="name" value="${escapeHtml(r.name||'')}"></label><label>中心经度<input data-field="center_longitude" type="number" step="any" value="${escapeHtml(r.center_longitude??'')}"></label><label>中心纬度<input data-field="center_latitude" type="number" step="any" value="${escapeHtml(r.center_latitude??'')}"></label><label>排序<input data-field="sort_order" type="number" value="${escapeHtml(r.sort_order??0)}"></label><div><button class="mini-action save-region">保存</button><button class="mini-action remove">删除</button></div></div>`}
function bindRegionRows(){$('regionsList').querySelectorAll('.region-row').forEach(row=>{row.querySelector('.save-region').onclick=()=>saveRegion(row);row.querySelector('.remove').onclick=()=>deleteRegion(row)})}
$('addRegion').onclick=()=>{$('regionsList').insertAdjacentHTML('beforeend',regionRowHtml({sort_order:regions.length}));bindRegionRows();$('regionsList').lastElementChild.querySelector('[data-field="name"]').focus()};
async function saveRegion(row){const old=regions.find(r=>r.id===row.dataset.id);const payload={};row.querySelectorAll('[data-field]').forEach(el=>payload[el.dataset.field]=el.value);payload.center_longitude=Number(payload.center_longitude);payload.center_latitude=Number(payload.center_latitude);payload.sort_order=Number(payload.sort_order||0);const res=row.dataset.id?await sb.from('regions').update(payload).eq('id',row.dataset.id).select().single():await sb.from('regions').insert(payload).select().single();if(res.error)return alert(res.error.message);if(old&&old.name!==payload.name){const {error}=await sb.from('assets').update({region:payload.name}).eq('region',old.name);if(error)return alert('区域已保存，但资产名称同步失败：'+error.message)}$('regionMsg').textContent='区域已保存';await loadAll()}
async function deleteRegion(row){const id=row.dataset.id,name=row.querySelector('[data-field="name"]').value;if(!id){row.remove();return}if(rows.some(a=>a.region===name))return alert('该区域下仍有展品，请先移动或删除相关展品。');if(!confirm(`确定删除区域“${name}”？`))return;const {error}=await sb.from('regions').delete().eq('id',id);if(error)return alert(error.message);await loadAll()}

function renderVenues(){
  $('venuesList').innerHTML=venues.map(v=>venueRowHtml(v)).join('');bindVenueRows();
  if(selectedVenueId&&!venues.some(v=>v.id===selectedVenueId))selectedVenueId=null;
  if(!selectedVenueId&&venues[0])selectedVenueId=venues[0].id;
  document.querySelectorAll('.venue-row').forEach(row=>row.classList.toggle('is-selected',row.dataset.id===selectedVenueId));
  renderVenueExhibitions();
}
function venueRowHtml(v={}){return `<div class="venue-row" data-id="${v.id||''}"><label>地点名称<input data-field="name" value="${escapeHtml(v.name||'')}"></label><label>经度<input data-field="longitude" type="number" step="any" value="${escapeHtml(v.longitude??'')}"></label><label>纬度<input data-field="latitude" type="number" step="any" value="${escapeHtml(v.latitude??'')}"></label><label>排序<input data-field="sort_order" type="number" value="${escapeHtml(v.sort_order??0)}"></label><div class="venue-row-actions"><button class="save-venue">保存</button><button class="view-venue">展览</button><button class="remove">删除</button></div></div>`}
function bindVenueRows(){
  $('venuesList').querySelectorAll('.venue-row').forEach(row=>{
    row.querySelector('.save-venue').onclick=()=>saveVenue(row);
    row.querySelector('.view-venue').onclick=()=>{selectedVenueId=row.dataset.id;renderVenues()};
    row.querySelector('.remove').onclick=()=>deleteVenue(row);
  });
}
$('addVenue').onclick=()=>{$('venuesList').insertAdjacentHTML('afterbegin',venueRowHtml({sort_order:venues.length}));bindVenueRows();$('venuesList').firstElementChild.querySelector('[data-field="name"]').focus()};
async function saveVenue(row){
  const old=venues.find(v=>v.id===row.dataset.id);const payload={};row.querySelectorAll('[data-field]').forEach(el=>payload[el.dataset.field]=el.value);
  payload.longitude=numOrNull(payload.longitude);payload.latitude=numOrNull(payload.latitude);payload.sort_order=Number(payload.sort_order||0);
  const res=row.dataset.id?await sb.from('venues').update(payload).eq('id',row.dataset.id).select().single():await sb.from('venues').insert(payload).select().single();
  if(res.error)return alert(res.error.message);
  if(old&&old.name!==payload.name){const {error}=await sb.from('assets').update({venue:payload.name}).eq('venue_id',old.id);if(error)return alert('地点已保存，但展览名称同步失败：'+error.message)}
  selectedVenueId=res.data.id;$('venueMsg').textContent='地点已保存';await loadAll();
}
async function deleteVenue(row){
  const id=row.dataset.id;if(!id){row.remove();return}
  const linked=rows.filter(a=>a.venue_id===id);if(linked.length)return alert(`该地点仍关联 ${linked.length} 条展品，请先为它们更换地点。`);
  if(!confirm('确定删除这个地点？'))return;const {error}=await sb.from('venues').delete().eq('id',id);if(error)return alert(error.message);selectedVenueId=null;await loadAll();
}
function renderVenueExhibitions(){
  const venue=venueById(selectedVenueId);if(!venue){$('venueExhibitions').innerHTML='<div class="empty-state">选择一个地点查看关联展览</div>';return}
  const linked=rows.filter(a=>a.venue_id===venue.id);
  const groups=[...new Map(linked.map(a=>[a.exhibition_title,a])).values()];
  $('venueExhibitions').innerHTML=`<header><h3>${escapeHtml(venue.name)}</h3><p>${venue.longitude??'未填写'}, ${venue.latitude??'未填写'} · ${groups.length} 个展览 / ${linked.length} 件展品</p></header>${groups.length?groups.map(a=>`<div class="venue-exhibition-item"><strong>${escapeHtml(a.exhibition_title)}</strong><span>${escapeHtml(a.start_date)} — ${escapeHtml(a.end_date)} · ${escapeHtml(a.region)}</span></div>`).join(''):'<div class="empty-state">这个地点还没有关联展览</div>'}`;
}

boot();

// ===== Simple bulk data tools: export / import by immutable ID / TSV batch add =====
const ASSET_EXPORT_COLUMNS=[
  ['ID','id'],['系统ID','system_id'],['区域','region'],['展览权重','exhibition_weight'],['展览名称','exhibition_title'],['地点','venue'],['地点ID','venue_id'],['坐标来源','use_venue_coordinates'],['展品名称','object_name'],['开始日期','start_date'],['结束日期','end_date'],['经度','longitude'],['纬度','latitude'],['图片地址','image_url'],['状态','status'],['排序','sort_order'],['描述','description']
];
const VENUE_EXPORT_COLUMNS=[['ID','id'],['地点名称','name'],['经度','longitude'],['纬度','latitude'],['排序','sort_order']];
const ASSET_HEADER_MAP=Object.fromEntries(ASSET_EXPORT_COLUMNS.flatMap(([zh,key])=>[[zh,key],[key,key]]));
const VENUE_HEADER_MAP=Object.fromEntries(VENUE_EXPORT_COLUMNS.flatMap(([zh,key])=>[[zh,key],[key,key]]));
let importState=null,bulkMode=null;

function rowsToExport(data,columns){return data.map(row=>Object.fromEntries(columns.map(([label,key])=>[label,row[key]??''])))}
function safeFileDate(){const d=new Date();return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`}
function exportXlsx(data,columns,name){
  if(!data.length)return alert('没有可导出的数据');
  if(!window.XLSX)return alert('Excel 组件未加载，请刷新后重试。');
  const ws=XLSX.utils.json_to_sheet(rowsToExport(data,columns),{header:columns.map(c=>c[0])});
  const wb=XLSX.utils.book_new();XLSX.utils.book_append_sheet(wb,ws,'数据');XLSX.writeFile(wb,`${name}-${safeFileDate()}.xlsx`);
}
function selectedAssetRows(){
  return [...document.querySelectorAll('#assetTable tbody tr')].filter(tr=>tr.querySelector('.row-select')?.checked).map(tr=>rows.find(r=>r.id===tr.dataset.id)).filter(Boolean);
}
function bindSelection(){
  const all=$('selectAllAssets');if(!all)return;
  all.checked=false;all.onchange=()=>document.querySelectorAll('#assetTable tbody .row-select').forEach(c=>c.checked=all.checked);
}
const originalRenderSheet=renderSheet;
renderSheet=function(){originalRenderSheet();bindSelection()};

const assetsForExport=data=>data.map(row=>({...row,exhibition_weight:visualWeight(row.exhibition_weight)}));
$('exportAllAssets').onclick=()=>exportXlsx(assetsForExport(rows),ASSET_EXPORT_COLUMNS,'展览数据');
$('exportSelectedAssets').onclick=()=>{const selectedRows=selectedAssetRows();if(!selectedRows.length)return alert('请先勾选要导出的数据');exportXlsx(assetsForExport(selectedRows),ASSET_EXPORT_COLUMNS,'选中展览数据')};
$('exportAllVenues').onclick=()=>exportXlsx(venues,VENUE_EXPORT_COLUMNS,'地点库');

function parseDelimited(text){
  const normalized=String(text||'').replace(/^\uFEFF/,'').trim();if(!normalized)return [];
  const first=normalized.split(/\r?\n/,1)[0];const delimiter=first.includes('\t')?'\t':',';
  const lines=normalized.split(/\r?\n/).filter(line=>line.trim()!=='');
  if(delimiter==='\t')return lines.map(line=>line.split('\t').map(v=>v.trim()));
  return lines.map(line=>{const out=[];let cur='',quoted=false;for(let i=0;i<line.length;i++){const ch=line[i];if(ch==='"'){if(quoted&&line[i+1]==='"'){cur+='"';i++}else quoted=!quoted}else if(ch===','&&!quoted){out.push(cur.trim());cur=''}else cur+=ch}out.push(cur.trim());return out});
}
function tableToObjects(table){if(!table.length)return [];const headers=table[0].map(h=>String(h).trim());return table.slice(1).filter(r=>r.some(v=>String(v).trim()!=='')).map(row=>Object.fromEntries(headers.map((h,i)=>[h,row[i]??''])))}
async function readImportFile(file){
  const ext=file.name.split('.').pop().toLowerCase();
  if(ext==='xlsx'||ext==='xls'){
    const buf=await file.arrayBuffer();const wb=XLSX.read(buf,{type:'array'});const ws=wb.Sheets[wb.SheetNames[0]];return XLSX.utils.sheet_to_json(ws,{defval:'',raw:false});
  }
  return tableToObjects(parseDelimited(await file.text()));
}
function normalizeImportedRecord(record,map){const out={};for(const [header,value] of Object.entries(record)){const key=map[String(header).trim()];if(key)out[key]=value}return out}
function openImport(kind,file,records){
  const map=kind==='assets'?ASSET_HEADER_MAP:VENUE_HEADER_MAP;const source=kind==='assets'?rows:venues;
  const normalized=records.map(r=>normalizeImportedRecord(r,map));const ids=normalized.map(r=>String(r.id||'').trim());
  const duplicates=[...new Set(ids.filter((id,i)=>id&&ids.indexOf(id)!==i))];const known=new Set(source.map(r=>String(r.id)));
  const valid=normalized.filter(r=>r.id&&known.has(String(r.id)));const unknown=normalized.filter(r=>!r.id||!known.has(String(r.id)));
  importState={kind,valid,unknown,duplicates};
  $('importFileName').textContent=file.name;
  $('importSummary').innerHTML=`<strong>共读取 ${normalized.length} 条数据</strong><span>将更新：${duplicates.length?0:valid.length} 条</span><span>无法识别：${unknown.length} 条</span>`;
  $('importErrors').textContent=duplicates.length?`发现重复 ID：${duplicates.join('、')}。已阻止导入。`:unknown.length?`无法识别的 ID：${unknown.map(r=>r.id||'（空 ID）').join('、')}`:'';
  $('confirmImport').disabled=duplicates.length>0||valid.length===0;$('importDialog').showModal();
}
async function chooseImport(kind,fileInput){const file=fileInput.files[0];if(!file)return;try{openImport(kind,file,await readImportFile(file))}catch(err){alert('文件读取失败：'+err.message)}finally{fileInput.value=''}}
$('importAssets').onclick=()=>$('assetImportFile').click();$('assetImportFile').onchange=()=>chooseImport('assets',$('assetImportFile'));
$('importVenues').onclick=()=>$('venueImportFile').click();$('venueImportFile').onchange=()=>chooseImport('venues',$('venueImportFile'));

function valueForImport(key,value){
  if(value===''||value==null)return undefined;
  if(['longitude','latitude','sort_order'].includes(key)){const n=Number(value);return Number.isFinite(n)?n:undefined}
  if(key==='use_venue_coordinates')return value===true||String(value).toLowerCase()==='true'||String(value)==='引用地点坐标';
  if(key==='exhibition_weight')return storageWeight(value);
  return value;
}
$('confirmImport').onclick=async()=>{
  if(!importState)return;const {kind,valid}=importState;const table=kind==='assets'?'assets':'venues';const ignored=new Set(['id','image_url']);
  $('confirmImport').disabled=true;$('confirmImport').textContent='正在更新…';let updated=0;
  for(const record of valid){const payload={};for(const [key,raw] of Object.entries(record)){if(ignored.has(key))continue;const value=valueForImport(key,raw);if(value!==undefined)payload[key]=value}
    if(kind==='assets'&&payload.venue){const venue=venueByName(payload.venue);if(venue){payload.venue_id=venue.id;payload.venue=venue.name}}
    if(Object.keys(payload).length){const {error}=await sb.from(table).update(payload).eq('id',record.id);if(error){alert(`ID ${record.id} 更新失败：${error.message}`);continue}updated++}
  }
  $('importDialog').close();$('confirmImport').textContent='确认更新';$('confirmImport').disabled=false;importState=null;await loadAll();alert(`已更新 ${updated} 条数据`);
};

const ASSET_BULK_EXAMPLE=`系统ID\t区域\t展览权重\t展览名称\t地点\t坐标来源\t展品名称\t开始日期\t结束日期\t经度\t纬度\t状态\t排序\t描述\nart-101\t外滩\t1\t示例展览\t明圆美术馆\t引用地点坐标\t示例作品\t2026-07-14\t2026-08-14\t\t\tpublished\t1\t示例描述`;
const VENUE_BULK_EXAMPLE=`地点名称\t经度\t纬度\t排序\n明圆美术馆\t121.4701\t31.2102\t6\n洞—当代艺术平台\t121.4830\t31.2620\t7`;
function openBulk(kind){bulkMode=kind;$('bulkTitle').textContent=kind==='assets'?'批量新增展览数据':'批量新增地点';$('bulkHint').textContent='只支持带表头的制表符表格 TSV。不要添加 ID。';$('bulkExample').textContent=kind==='assets'?ASSET_BULK_EXAMPLE:VENUE_BULK_EXAMPLE;$('bulkText').value='';$('bulkMsg').textContent='';$('confirmBulk').textContent='检查数据';$('bulkDialog').showModal();setTimeout(()=>$('bulkText').focus(),30)}
$('bulkAddAssets').onclick=()=>openBulk('assets');$('bulkAddVenues').onclick=()=>openBulk('venues');
$('bulkText').oninput=()=>{const count=Math.max(0,parseDelimited($('bulkText').value).length-1);$('confirmBulk').textContent=count?`新增 ${count} 条`:'检查数据'};
$('confirmBulk').onclick=async()=>{
  const objects=tableToObjects(parseDelimited($('bulkText').value));if(!objects.length)return $('bulkMsg').textContent='没有读取到数据，请确认第一行是表头。';
  const map=bulkMode==='assets'?ASSET_HEADER_MAP:VENUE_HEADER_MAP;const normalized=objects.map(r=>normalizeImportedRecord(r,map));
  if(normalized.some(r=>r.id))return $('bulkMsg').textContent='批量新增不能包含 ID。修改已有数据请使用“导入数据”。';
  let payloads;
  if(bulkMode==='venues')payloads=normalized.map((r,i)=>({name:String(r.name||'').trim(),longitude:numOrNull(r.longitude),latitude:numOrNull(r.latitude),sort_order:Number(r.sort_order||i)}));
  else payloads=normalized.map((r,i)=>{const venue=venueByName(r.venue);return normalizePayload({...r,venue_id:venue?.id||'',venue:venue?.name||r.venue,use_venue_coordinates:r.use_venue_coordinates===''||r.use_venue_coordinates==null?true:r.use_venue_coordinates,status:r.status||'draft',sort_order:r.sort_order||i})});
  const invalid=bulkMode==='venues'?payloads.filter(p=>!p.name):payloads.filter(p=>!p.system_id||!p.exhibition_title||!p.object_name||!p.venue_id||!p.start_date||!p.end_date);
  if(invalid.length)return $('bulkMsg').textContent=`有 ${invalid.length} 条缺少必填字段，未新增。`;
  $('confirmBulk').disabled=true;$('confirmBulk').textContent='正在新增…';const {error}=await sb.from(bulkMode==='assets'?'assets':'venues').insert(payloads);$('confirmBulk').disabled=false;
  if(error){$('confirmBulk').textContent=`新增 ${payloads.length} 条`;$('bulkMsg').textContent=error.message;return}
  $('bulkDialog').close();await loadAll();alert(`已新增 ${payloads.length} 条数据`);
};
