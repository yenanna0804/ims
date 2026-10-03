/* KHPTM information documents: extend existing screens without changing legacy routing. */
(function () {
  const records = new Map();
  const seedRequests = structuredClone(khptm2Requests);
  let editing = null;
  const common = [
    ['issuer','Tên đơn vị ban hành'],['number','Số văn bản'],['place','Địa danh'],['date','Ngày văn bản','date'],
    ['archive','Lưu tại'],['eoffice','Số eOffice'],['signer','Tên người đại diện']
  ];
  const requestFields = [
    ['unit','Đơn vị cần cung cấp thông tin','textarea'],['related','Đơn vị liên quan (nếu có)'],
    ['basis','Văn bản giao nhiệm vụ/hướng dẫn của Tập đoàn','textarea'],['planBasis','Văn bản/QĐ phê duyệt kế hoạch phát triển mạng','textarea'],
    ['year','Năm kế hoạch','number'],['need','Nhu cầu cần cung cấp'],['current','Hiện trạng cần cung cấp'],
    ['content','Nội dung thông tin cần cung cấp','textarea'],['deadline','Thời hạn cung cấp','date'],
    ['contactUnit','Đơn vị đầu mối'],['contact','Họ tên đầu mối'],['phone','Số điện thoại'],['email','Email','email']
  ];
  const supplyFields = [
    ['recipient1','Kính gửi — đơn vị thứ nhất'],['recipient2','Kính gửi — đơn vị thứ hai'],
    ['period','Giai đoạn đề xuất kế hoạch'],['decisionNumber','Số Quyết định phê duyệt quy hoạch'],
    ['decisionDate','Ngày Quyết định phê duyệt quy hoạch','date'],['planningPeriod','Giai đoạn quy hoạch mạng Viễn thông VNPT'],
    ['minimumRoutes','Số tuyến cáp độc lập tối thiểu','number'],['otherCriteria','Tiêu chí bổ sung','textarea'],
    ['reportTo','Đơn vị nhận báo cáo đề xuất'],['deadline','Hạn gửi báo cáo đề xuất','date'],
    ['appendixNumber','Số công văn kèm Phụ lục 1'],['appendixDate','Ngày công văn kèm Phụ lục 1','date']
  ];
  const escape = value => esc(String(value == null ? '' : value));
  function key() { return khptm2DeviceType + '/' + (isKHPTMPairType() && khptmPairRecordRole === 'COORD' ? 'COORD' : 'MAIN'); }
  function record() {
    if (!records.has(key())) records.set(key(), {requests:{},receipt:null,drafts:{}});
    return records.get(key());
  }
  function permission(kind) {
    const r = record();
    if (kind === 'request') return ((khptm2Role === 'Chuyên viên Ban KT' && khptm2Step === 'B1') || (khptm2Role === 'NetX thẩm định' && khptm2Step === 'BREVIEW')) && !(r.receipt && !r.receipt.completed);
    return khptm2Role === 'Đơn vị cung cấp thông tin' && khptm2Step === 'BINFO' && r.receipt && !r.receipt.completed && r.receipt.unit === khptm2ProviderUnit;
  }
  function fields(kind, code) {
    if(editing?.context?.fields)return common.concat(editing.context.fields);
    return common.concat(kind === 'request' ? requestFields.filter(f => code === '2.2' || !['planBasis','need','current'].includes(f[0])) : supplyFields);
  }
  function defaults(kind, code) {
    const old = seedRequests[code] || {};
    return kind === 'request' ? {issuer:'TỔNG CÔNG TY HẠ TẦNG MẠNG',unit:old.unit || '',basis:'VB GNV phối hợp XD KHPTM của TCT - 812/VNPT Net-KT',year:'2027',deadline:old.deadline || '',contactUnit:'Ban KT',content:''} : {issuer:khptm2ProviderUnit,recipient1:'Ban KT',reportTo:'Ban KT',lines:Array.from({length:11},() => ({}))};
  }
  function draft(kind, code) {
    const saved = record().requests[code];
    if (kind === 'request') return saved && saved.document ? structuredClone(saved.document) : defaults(kind,code);
    const receipt = record().receipt;
    return receipt && receipt.response ? structuredClone(receipt.response.document) : defaults(kind,code);
  }
  function canEditSession() { return editing && (editing.context ? editing.context.canEdit() : editing.key === key() && permission(editing.kind) && (editing.kind !== 'supply' || editing.receipt === record().receipt)); }
  function fieldHTML(f, data) {
    const [name,label,type] = f, id = 'khInfo_'+name;
    const value = data[name] || '';
    return '<div class="'+(type === 'textarea'?'full':'')+'"><label for="'+id+'">'+label+'</label>'+
      (type === 'textarea' ? '<textarea id="'+id+'" data-info-field="'+name+'">'+escape(value)+'</textarea>' : '<input id="'+id+'" data-info-field="'+name+'" type="'+(type || 'text')+'" value="'+escape(value)+'" '+(type === 'number'?'min="0" step="any"':'')+'>')+'</div>';
  }
  function capture() {
    if (!editing) return null;
    const data = {...editing.data};
    document.querySelectorAll('#khptm2InfoModal [data-info-field]').forEach(el => data[el.dataset.infoField] = el.value.trim());
    if (editing.kind === 'supply' && !editing.context?.fields) {
      data.lines = Array.from({length:11},() => ({}));
      document.querySelectorAll('#khptm2InfoModal [data-info-line]').forEach(el => data.lines[Number(el.dataset.infoLine)][el.dataset.infoCol] = el.value.trim());
    }
    return data;
  }
  function showForm(kind, code, data) {
    const modal = document.getElementById('khptm2InfoModal');
    let html = '';
    if(editing?.context?.templateLabel)html+='<div class="kh2-doc-note" style="margin-bottom:12px"><b>'+escape(editing.context.templateLabel)+'</b></div>';
    else if (kind === 'request') html += '<div class="toolbar"><label for="khInfoCode">Biểu mẫu</label><select id="khInfoCode" style="width:auto" onchange="khInfo.changeCode(this.value)"><option value="2.1" '+(code==='2.1'?'selected':'')+'>SOP1-TB-01A — Thông tin phục vụ XD KHPTM</option><option value="2.2" '+(code==='2.2'?'selected':'')+'>SOP1-TB-01B — Số liệu hiện trạng</option></select></div>';
    else { const received = editing?.context?.receipt || record().receipt; html += '<div class="kh2-doc-note" style="margin-bottom:12px"><b>SOP1-CQ-1 — Văn bản cung cấp thông tin phục vụ XD KH PTM cáp quang</b><br>Người chuyển: '+escape(received.sender)+' · Đơn vị nhận: '+escape(received.unit)+' · Yêu cầu: '+escape(code)+'</div>'; }
    html += '<div id="khInfoValidation" class="khptm-note" role="alert" hidden></div>';
    html += '<div class="kh2-modal-grid">'+fields(kind,code).map(f => f[0]==='unit' && editing?.context?.units ? '<div class="full"><label for="khInfo_unit">'+f[1]+'</label><select id="khInfo_unit" data-info-field="unit">'+editing.context.units.map(unit=>'<option'+(unit===data.unit?' selected':'')+'>'+escape(unit)+'</option>').join('')+'</select></div>' : fieldHTML(f,data)).join('')+'</div>';
    if (kind === 'supply' && !editing?.context?.fields) {
      html += '<div class="section" style="margin-top:12px"><h3>Phụ lục 1 — Đề xuất triển khai các tuyến cáp quang</h3><div style="overflow:auto"><table><thead><tr><th>STT</th><th>Hướng tuyến</th><th>Cự ly(Km)</th><th>Số sợi(FO)</th><th>Mục đích, lý do thay thế</th></tr></thead><tbody>';
      for (let i=0;i<11;i++) html += '<tr><td>'+(i<10?i+1:'')+'</td>'+['direction','distance','fibers','reason'].map(col => '<td><input aria-label="'+({direction:'Hướng tuyến',distance:'Cự ly',fibers:'Số sợi',reason:'Mục đích, lý do thay thế'})[col]+' dòng '+(i+1)+'" data-info-line="'+i+'" data-info-col="'+col+'" '+(['distance','fibers'].includes(col)?'type="number" min="0" step="'+(col==='fibers'?'1':'any')+'"':'')+' value="'+escape((data.lines && data.lines[i] || {})[col] || '')+'"></td>').join('')+'</tr>';
      html += '</tbody></table></div><div class="body mini">Tổng số tuyến và tổng chiều dài được tính từ các dòng đã nhập.</div></div>';
    }
    html += '<div class="footer-actions"><button onclick="closeKHPTM2InfoModal()">Đóng</button><button onclick="khInfo.previewDraft()">Xem preview văn bản</button><button class="primary" onclick="khInfo.save()">Lưu văn bản</button></div>';
    document.getElementById('khptm2InfoModalTitle').textContent = editing?.context?.formTitle || (kind === 'request' ? 'Tạo VB yêu cầu cung cấp thông tin' : 'Tạo VB cung cấp thông tin');
    modal.querySelector('.modalbody').innerHTML = html;
    modal.classList.add('show');modal.querySelector('.modalbox').scrollTop=0;
  }
  function open(kind, code) {
    if (!permission(kind)) return toast('Bạn chưa được giao nhiệm vụ tạo văn bản này');
    code = kind === 'supply' ? record().receipt.code : code || khptm2CurrentRequest || '2.1';
    if (!['2.1','2.2'].includes(code)) code='2.1';
    const data=draft(kind,code);
    editing={kind,code,key:key(),data,receipt:record().receipt,drafts:{}};
    khptm2CurrentRequest=code;showForm(kind,code,data);
  }
  function openFor(context) {
    if (!context.canEdit()) return toast('Bạn chưa được giao nhiệm vụ tạo văn bản này');
    const code = ['2.1','2.2'].includes(context.code) ? context.code : '2.2';
    editing = {kind:context.kind,code,key:context.key,data:structuredClone(context.data),context,drafts:{}};
    showForm(editing.kind,code,editing.data);
  }
  function changeCode(code) {
    if (!canEditSession()) return;
    editing.drafts[editing.code]=capture();editing.code=code;editing.data=editing.drafts[code] || (editing.context ? structuredClone(editing.context.data) : draft('request',code));if(!editing.context)khptm2CurrentRequest=code;
    showForm('request',code,editing.data);
  }
  function value(data,name) { return data[name] ? escape(data[name]).replace(/\n/g,'<br>') : '<span class="ph">['+escape(({day:'Ngày',month:'Tháng',year:'Năm'}[name] || (common.concat(requestFields,supplyFields).find(f => f[0] === name) || [name,name])[1]))+']</span>'; }
  function date(data,name) { return data[name] ? escape(formatDateVN(data[name])) : value(data,name); }
  function requestHTML(data,code) {
    const v=n => value(data,n), body=code==='2.2'
      ? '<p>Căn cứ '+v('basis')+';</p><p>Căn cứ '+v('planBasis')+';</p><p>Tổng công ty/VNPT Net đề nghị '+v('unit')+' phối hợp cung cấp nhu cầu '+v('need')+' trong năm '+v('year')+' hoặc/và hiện trạng '+v('current')+' như sau:</p>'
      : '<p>Căn cứ '+v('basis')+';</p><p>Để chuẩn bị cho việc xây dựng kế hoạch phát triển mạng lưới năm '+v('year')+' của Tập đoàn, VNPT Net đề nghị '+v('unit')+' phối hợp cung cấp nhu cầu kinh doanh trong năm '+v('year')+' như sau:</p>';
    return '<div class="kh-info-paper"><table class="kh-info-letterhead"><tr><td><b>'+v('issuer')+'</b><p>Số: '+v('number')+'</p></td><td><b>CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM</b><br><b>Độc lập - Tự do - Hạnh phúc</b><p>'+v('place')+', '+date(data,'date')+'</p></td></tr></table><h3 style="text-align:center">'+(code==='2.2'?'V/v cung cấp số liệu hiện trạng phục vụ tính toán quy mô':'V/v yêu cầu cung cấp thông tin phục vụ XD KH PTM')+'</h3><p>Kính gửi: '+v('unit')+(data.related?'; '+v('related'):'')+'</p>'+body+'<p>'+v('content')+'</p><p>Thời hạn cung cấp thông tin trước ngày '+date(data,'deadline')+'.</p><p>Mọi thông tin trao đổi vui lòng liên hệ đầu mối của '+(code==='2.2'?'VNPT Net/Ban '+v('contactUnit'):'VNPT Net')+':</p><p>'+v('contact')+', '+v('phone')+', '+v('email')+'</p><p>Trân trọng cảm ơn./.</p><table class="kh-info-letterhead"><tr><td>Nơi nhận:<br>- Như trên;<br>- '+v('related')+';<br>- Lưu: '+v('archive')+'.<p>Số eOffice: '+v('eoffice')+'</p></td><td><b>'+v('issuer')+'</b><p>(Ký, ghi rõ họ tên, chức vụ và đóng dấu (nếu có))</p><br>'+v('signer')+'</td></tr></table></div>';
  }
  function supplyHTML(data) {
    const parts=(data.date||'').split('-'), computed={...data,day:parts[2],month:parts[1],year:parts[0]};
    ['decisionDate','deadline','appendixDate'].forEach(n=>computed[n]=data[n]?formatDateVN(data[n]):'');
    const fill=text=>escape(text).replace(/\{\{(\w+)\}\}/g,(_,n)=>value(computed,n));
    return '<div class="kh-info-paper">'+window.KHPTM_CQ1_TEMPLATE.map(block=>{
      if (block.appendix) {
        const lines=data.lines||[];
        const count=lines.filter(l=>Object.values(l).some(Boolean)).length;
        const total=lines.reduce((n,l)=>n+(Number(l.distance)||0),0);
        return '<table class="kh-info-appendix"><thead><tr>'+block.table[0].map(c=>'<th>'+escape(c)+'</th>').join('')+'</tr></thead><tbody>'+Array.from({length:11},(_,i)=>'<tr><td>'+(i<10?i+1:'')+'</td>'+['direction','distance','fibers','reason'].map(n=>'<td>'+escape((lines[i]||{})[n]||'')+'</td>').join('')+'</tr>').join('')+'<tr><td colspan="4">Tổng số tuyến</td><td>'+count+'</td></tr><tr><td colspan="4">Tổng chiều dài (Km)</td><td>'+total+'</td></tr></tbody></table>';
      }
      if (block.table) return '<table class="kh-info-letterhead"><tr>'+block.table[0].map(c=>'<td>'+fill(c).replace(/\n/g,'<br>')+'</td>').join('')+'</tr></table>';
      return '<p'+(/PHỤ LỤC|ĐỀ XUẤT TRIỂN KHAI|Đính kèm/.test(block.text)?' style="text-align:center"':'')+'>'+fill(block.text)+'</p>';
    }).join('')+'</div>';
  }
  function preview(kind,data,code,context) {
    document.getElementById('khptmPreviewTitle').textContent=context?.templateLabel || (kind==='request' ? (code==='2.2'?'SOP1-TB-01B':'SOP1-TB-01A')+' — Văn bản yêu cầu cung cấp thông tin' : 'SOP1-CQ-1 — Văn bản cung cấp thông tin phục vụ XD KH PTM cáp quang');
    document.getElementById('khptmPreviewPaper').innerHTML=context?.renderHTML?context.renderHTML(data,kind,code):kind==='request'?requestHTML(data,code):supplyHTML(data);
    document.getElementById('khptmPreviewModal').classList.add('show');
  }
  function previewDraft() { if (!canEditSession()) return toast('Nhiệm vụ xử lý đã thay đổi');preview(editing.kind,capture(),editing.code,editing.context); }
  function invalid(message) { const host=document.getElementById('khInfoValidation');if(host){host.hidden=false;host.textContent=message;host.scrollIntoView({block:'nearest'});}toast(message); }
  function save() {
    if (!canEditSession()) return invalid('Bạn chưa được giao nhiệm vụ tạo văn bản này');
    const data=capture(), kind=editing.kind, code=editing.code;
    if (kind==='request' && (!data.unit || !data.content || !data.deadline)) return invalid('Nhập đơn vị nhận, nội dung yêu cầu và thời hạn cung cấp');
    if (kind==='supply' && (!data.issuer || !data.recipient1 || !data.period)) return invalid('Nhập đơn vị ban hành, đơn vị nhận và giai đoạn đề xuất');
    if(editing.context){try{return editing.context.onSave(data,kind,code);}catch(error){return invalid(error.message);}}
    const r=record();
    const doc={document:data,code,createdAt:new Date().toLocaleString('vi-VN',{hour12:false}),author:kind==='request'?khptm2Role:khptm2ProviderUnit};
    if (kind==='request') {const old=r.requests[code];doc.version=(old && old.version || 0)+1;doc.response=old && old.response;r.requests[code]=doc;Object.assign(khptm2Requests[code],data,{status:'Đã lập yêu cầu'});}
    else { doc.version=(r.receipt.response && r.receipt.response.version || 0)+1;doc.requestVersion=r.receipt.requestVersion;doc.sender=r.receipt.sender;r.receipt.response=doc; }
    khptm2Log(khptm2Role,'Lưu '+(kind==='request'?'VB yêu cầu cung cấp thông tin':'VB cung cấp thông tin')+' · Yêu cầu '+code);
    rememberComposer();
    const pending=draftExchange(), attachment={kind,code,name:fileName(kind,code,doc),doc:structuredClone(doc)};
    const previous=pending.attachments.findIndex(a=>a.kind===kind && a.code===code);
    if(previous<0)pending.attachments.push(attachment);else pending.attachments[previous]=attachment;
    closeKHPTM2InfoModal();renderKHPTMBuild();openKHPTM2ExchangeTab();
    document.getElementById('khptm2QuickExchange')?.focus();
    toast('Đã gắn văn bản vào nội dung trao đổi. Nhập nội dung rồi nhấn Gửi');
  }
  // Composer drafts belong to the dossier and actual actor; sent documents keep their own snapshot.
  let composerSession=null;
  function actorKey(){return khptm2Role+(khptm2Role==='Đơn vị cung cấp thông tin'?'/'+khptm2ProviderUnit:'');}
  function draftExchange(){
    const r=record();if(!r.drafts)r.drafts={};
    if(!r.drafts[actorKey()])r.drafts[actorKey()]={text:'',attachments:[],upload:null};
    return r.drafts[actorKey()];
  }
  function rememberComposer(){
    const ta=document.getElementById('khptm2QuickExchange');
    if(composerSession && ta)composerSession.draft.text=ta.value;
  }
  function previewAttachment(attachment){
    if(attachment.html){document.getElementById('khptmPreviewTitle').textContent=attachment.name;document.getElementById('khptmPreviewPaper').innerHTML=attachment.html;document.getElementById('khptmPreviewModal').classList.add('show');return;}
    if(attachment.kind!=='upload')return preview(attachment.kind,attachment.doc.document,attachment.code);
    document.getElementById('khptmPreviewTitle').textContent=attachment.name;
    const paper=document.getElementById('khptmPreviewPaper');
    paper.innerHTML=attachment.mime==='application/pdf'?'<iframe title="'+escape(attachment.name)+'" src="'+escape(attachment.url)+'" style="width:100%;height:65vh;border:0"></iframe>':
      attachment.mime && attachment.mime.startsWith('image/')?'<img alt="'+escape(attachment.name)+'" src="'+escape(attachment.url)+'" style="max-width:100%">':
      '<a href="'+escape(attachment.url)+'" download="'+escape(attachment.name)+'">Tải '+escape(attachment.name)+'</a>';
    document.getElementById('khptmPreviewModal').classList.add('show');
  }
  function pendingPreview(index){const d=draftExchange(),a=index==='upload'?d.upload:d.attachments[Number(index)];if(a)previewAttachment(a);}
  function removePending(index){
    const d=draftExchange();if(index==='upload'){if(d.upload)URL.revokeObjectURL(d.upload.url);d.upload=null;khptm2ExchangeDraftFile='';const file=document.getElementById('khptm2ExchangeFile');if(file)file.value='';}
    else d.attachments.splice(Number(index),1);
    renderPending();
  }
  function renderPending(){
    const d=draftExchange(),host=document.getElementById('khInfoPendingAttachments');if(!host)return;
    const name=document.getElementById('khptm2ExchangeFileName');if(name)name.textContent=d.upload?d.upload.name:'Chưa chọn tệp';
    const row=(a,index)=>'<div class="file-chip"><span class="pm-ext-file">'+escape(a.name)+'</span><button class="small" onclick="khInfo.pendingPreview('+ (index==='upload'?"'upload'":index)+')">Xem file</button><button class="small danger" onclick="khInfo.removePending('+(index==='upload'?"'upload'":index)+')">Gỡ</button></div>';
    host.innerHTML=d.attachments.map(row).join('')+(d.upload?row(d.upload,'upload'):'');
  }
  function mountComposer(){
    const ta=document.getElementById('khptm2QuickExchange');if(!ta)return;
    const d=draftExchange();composerSession={key:key(),actor:actorKey(),draft:d};
    ta.value=d.text;ta.oninput=()=>{d.text=ta.value;};khptm2ExchangeDraftFile=d.upload?d.upload.name:'';
    let pending=document.getElementById('khInfoPendingAttachments');
    if(!pending){pending=document.createElement('div');pending.id='khInfoPendingAttachments';ta.parentElement.appendChild(pending);}
    renderPending();
  }
  function exchangeAttachments(entry){return entry.attachments && entry.attachments.length?entry.attachments:entry.file?[{kind:'upload',name:entry.file,url:entry.url||'',mime:''}]:[];}
  function renderExchangeInto(host,entries){
    if(!host)return;
    const displayEntries=entries.slice().reverse();
    host.innerHTML='<div style="overflow:auto"><table class="exchange-history-table"><thead><tr><th style="width:68px">TT</th><th style="width:400px">Người gửi</th><th style="width:200px">Thời gian</th><th>Nội dung</th></tr></thead><tbody>'+ (displayEntries.length?displayEntries.map((entry,index)=>
      '<tr><td class="exchange-col-no">'+(index+1)+'</td><td class="exchange-col-sender"><div class="exchange-sender-name">'+escape(entry.senderName||entry.actor)+'</div>'+(entry.phone?'<div class="exchange-sender-phone">( Điện thoại: '+escape(entry.phone)+' )</div>':'')+'</td><td class="exchange-col-time">'+escape(entry.time)+'</td><td><div class="exchange-content"><span class="blue">'+escape(entry.text||'').replace(/\n/g,'<br>')+'</span><span class="action"><b>Thao tác:</b> '+escape(entry.action||'Gửi trao đổi')+'</span>'+exchangeAttachments(entry).map((a,i)=>'<br><button class="exchange-file-link" data-khinfo-doc="'+index+':'+i+'" style="border:0;padding:0;background:transparent">Xem file đính kèm: '+escape(a.name)+'</button>').join('')+'</div></td></tr>'
    ).join(''):'<tr><td colspan="4" class="mini" style="text-align:center">Chưa có nội dung trao đổi.</td></tr>')+'</tbody></table></div>';
    host.onclick=event=>{const button=event.target.closest('[data-khinfo-doc]');if(!button)return;const [index,file]=button.dataset.khinfoDoc.split(':').map(Number),attachment=exchangeAttachments(displayEntries[index])[file];if(attachment){if(attachment.kind==='upload' && !attachment.url)return toast('Mở tệp đính kèm: '+attachment.name);previewAttachment(attachment);}};
  }
  renderKHPTM2Exchange=function(){renderExchangeInto(document.getElementById('khptm2Exchange'),khptm2Exchange);};
  sendKHPTM2Exchange=function(){
    rememberComposer();const d=draftExchange(),text=d.text.trim(),attachments=d.attachments.map(a=>structuredClone(a));
    if(d.upload)attachments.push({...d.upload});
    if(!text && !attachments.length)return toast('Nhập nội dung trao đổi hoặc đính kèm văn bản');
    khptm2Exchange.unshift({actor:khptm2Role==='Đơn vị cung cấp thông tin'?khptm2ProviderUnit:khptm2Role,leader:['LĐ Ban KT','LĐTCT'].includes(khptm2Role)?khptm2Role:'',time:new Date().toLocaleString('vi-VN',{hour12:false}),text,attachments,file:d.upload?d.upload.name:'',url:d.upload?d.upload.url:'',action:'Gửi trao đổi'});
    d.text='';d.attachments=[];d.upload=null;khptm2ExchangeDraftFile='';
    const ta=document.getElementById('khptm2QuickExchange');if(ta)ta.value='';const file=document.getElementById('khptm2ExchangeFile');if(file)file.value='';
    renderPending();renderKHPTM2Exchange();toast('Đã gửi nội dung trao đổi kèm văn bản');
  };
  khptm2ExchangeFileChanged=function(input){
    const d=draftExchange(),file=input && input.files && input.files[0];if(d.upload)URL.revokeObjectURL(d.upload.url);
    d.upload=file?{kind:'upload',name:file.name,mime:file.type,url:URL.createObjectURL(file)}:null;
    khptm2ExchangeDraftFile=file?file.name:'';renderPending();
  };
  function savedPreview(kind,code) {
    const r=record(), item=r.requests[code];
    const doc=kind==='request'?item:(r.receipt && r.receipt.code===code && r.receipt.response || item && item.response);
    if (!doc) return toast('Chưa có văn bản được lưu');
    preview(kind,doc.document,code);
  }
  function fileName(kind,code,doc) { return (kind==='request'?'VB_yeu_cau_CCTT_':'VB_cung_cap_CCTT_')+khptm2TypeTag()+'_'+code.replace('.','_')+'_v'+doc.version+'.docx'; }
  function decorate() {
    const host=document.querySelector('#khptm2Extended .pm-ims-extended');if (!host) return;
    const kind=khptm2Role==='Đơn vị cung cấp thông tin' && khptm2Step==='BINFO'?'supply':((khptm2Role==='Chuyên viên Ban KT' && khptm2Step==='B1') || (khptm2Role==='NetX thẩm định' && khptm2Step==='BREVIEW'))?'request':null;
    if (kind) {
      const btn=document.createElement('button');btn.className='small kh-info-create';btn.textContent=kind==='request'?'Tạo VB yêu cầu cung cấp thông tin':'Tạo VB cung cấp thông tin';
      btn.disabled=!permission(kind);btn.title=btn.disabled?'Chưa nhận nhiệm vụ cung cấp thông tin':'';btn.onclick=()=>open(kind);host.querySelector('.pm-ext-caption').after(btn);
    }
    const tbody=host.querySelector('.pm-ext-table tbody'),r=record();if (!tbody) return;
    const append=(kind,code,doc)=>{
      const index=tbody.rows.length+1,name=fileName(kind,code,doc);
      tbody.insertAdjacentHTML('beforeend',khptm2DocRow(index,'☐',false,true,escape(doc.document.number||'Chưa cấp số'),'',''+escape(doc.document.issuer),'Chưa ký',kind==='request'?'VB yêu cầu cung cấp thông tin':'VB cung cấp thông tin',escape(name),"khInfo.savedPreview('"+kind+"','"+code+"')"));
      const row=tbody.lastElementChild;row.cells[11].textContent=doc.author;row.cells[12].textContent=doc.createdAt;
    };
    Object.entries(r.requests).forEach(([code,doc])=>{if (doc.document) append('request',code,doc);if(doc.response) append('supply',code,doc.response);});
    if (r.receipt && r.receipt.response && !(r.requests[r.receipt.code] && r.requests[r.receipt.code].response===r.receipt.response)) append('supply',r.receipt.code,r.receipt.response);
  }
  const baseExtended=renderKHPTM2Extended;
  renderKHPTM2Extended=function(){rememberComposer();const result=baseExtended.apply(this,arguments);decorate();mountComposer();return result;};
  // Replace legacy modal entrypoints so all fields and unsaved previews use one source.
  openKHPTM2InfoModal=function(code){open('request',code);};
  saveKHPTM2InfoRequest=save;
  previewKHPTM2InfoRequest=function(code){if(editing && document.getElementById('khptm2InfoModal').classList.contains('show') && !code)return previewDraft();savedPreview('request',code||khptm2CurrentRequest);};
  const baseConfirm=confirmTransferFromModal;
  confirmTransferFromModal=function(){
    const action=pendingTransferAction, selected=selectedRouteRecipients(), r=record(), sender=khptm2Role, beforeHistory=khptm2History.length;
    const code=selected.main && selected.main.id==='kh2ktm'?'2.2':'2.1';
    const request=r.requests[code];
    const result=baseConfirm.apply(this,arguments);
    const success=khptm2History.length>beforeHistory && !document.getElementById('transferModal').classList.contains('show') && !pendingTransferAction;
    if (!success) return result;
    if (['khbuildRoute','khbuildReviewRoute'].includes(action) && khptm2Step==='BINFO' && khptm2Role==='Đơn vị cung cấp thông tin' && selected.main) {
      r.receipt={code,sender,unit:selected.main.name,requestVersion:request && request.version,request:request && structuredClone(request.document),createdAt:new Date().toISOString(),completed:false,response:null};
      renderKHPTM2Extended();
    } else if(action==='khbuildInfoReturn' && r.receipt) {
      r.receipt.completed=true;
      if(r.receipt.response) {if(!r.requests[r.receipt.code])r.requests[r.receipt.code]={};r.requests[r.receipt.code].response=r.receipt.response;}
      renderKHPTM2Extended();
    }
    return result;
  };
  const baseFiles=setKHPTM2RouteFiles;
  setKHPTM2RouteFiles=function(action){
    const result=baseFiles.apply(this,arguments),r=record();
    let kind,code,doc;
    if (['khbuildRoute','khbuildReviewRoute'].includes(action)) {kind='request';code=khptm2CurrentRequest;doc=r.requests[code];}
    if (action==='khbuildInfoReturn' && r.receipt) {kind='supply';code=r.receipt.code;doc=r.receipt.response;}
    if(doc && doc.document){const file=document.querySelector('#routeSignFileRow .route-file-name');if(file)file.textContent=fileName(kind,code,doc);}
    return result;
  };
  // Keep the selected document consistent with the recipient, including when radio choices change.
  const routeFiles=document.getElementById('routeRecipientRows');
  routeFiles.addEventListener('change',function(){
    if(!['khbuildRoute','khbuildReviewRoute'].includes(pendingTransferAction))return;
    const selected=selectedRouteRecipients(),code=selected.main && selected.main.id==='kh2ktm'?'2.2':'2.1',doc=record().requests[code];
    const file=document.querySelector('#routeSignFileRow .route-file-name');
    if(file)file.textContent=doc && doc.document?fileName('request',code,doc):'VB_GNV_phoi_hop_XD_KHPTM_2027.pdf';
  });
  const baseTransferPreview=openTransferPreview;
  openTransferPreview=function(name){
    const r=record();
    if (name==='Tờ trình/Đề nghị thành lập Tổ triển khai dự án' && ['khbuildRoute','khbuildReviewRoute','khbuildInfoReturn'].includes(pendingTransferAction)) {
      name=document.querySelector('#routeSignFileRow .route-file-name')?.textContent || name;
    }
    for(const [code,doc] of Object.entries(r.requests)) {
      if(doc.document && name===fileName('request',code,doc))return savedPreview('request',code);
      if(doc.response && name===fileName('supply',code,doc.response))return savedPreview('supply',code);
    }
    if(r.receipt && r.receipt.response && name===fileName('supply',r.receipt.code,r.receipt.response))return savedPreview('supply',r.receipt.code);
    return baseTransferPreview.apply(this,arguments);
  };
  const baseReset=resetKHPTMBuildFlow;
  resetKHPTMBuildFlow=function(){const r=record();Object.values(r.drafts||{}).forEach(d=>{if(d.upload)URL.revokeObjectURL(d.upload.url);});records.delete(key());editing=null;composerSession=null;return baseReset.apply(this,arguments);};
  const style=document.createElement('style');style.textContent='#khptm2Extended .kh-info-create,#kh5Extended .kh-info-create{float:right;margin:5px 3px 7px 12px}#khptm2Extended .pm-ext-tabs,#kh5Extended .pm-ext-tabs{clear:both}#khptmPreviewModal{z-index:95}.kh-info-paper{font-family:"Times New Roman",serif;font-size:16px;line-height:1.45;color:#000}.kh-info-paper p{margin:9px 0;text-align:justify}.kh-info-paper table td{color:#000}.kh-info-letterhead td{border:0;width:50%;vertical-align:top;padding:5px 12px;text-align:center}.kh-info-appendix th,.kh-info-appendix td{border:1px solid #000;color:#000;background:white;font-family:"Times New Roman",serif;font-size:14px}.kh-info-appendix td{height:26px}#khptm2InfoModal .modalhead{position:sticky;top:0;z-index:1}#khptm2InfoModal .footer-actions{position:sticky;bottom:-14px;background:white;padding:12px 0;border-top:1px solid #d5e0ea}#khptm2InfoModal label{font-size:14px}@media(max-width:650px){#khptm2Extended .kh-info-create,#kh5Extended .kh-info-create{float:none;display:block;margin-left:auto}.kh-info-letterhead td{padding:3px;font-size:13px}}';document.head.appendChild(style);
  window.khInfo={open,openFor,changeCode,previewDraft,save,savedPreview,pendingPreview,removePending,renderExchangeInto,requestHTML,supplyHTML,previewAttachment};
}());
