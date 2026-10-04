/* SOP 1 I.1 bước 1: TĐ AR, Ban KT C,I. Chỉ điều khiển Thông báo/Hướng dẫn KHPTM.
 * RACI không định nghĩa ban soạn thảo TĐ hoặc biểu mẫu hướng dẫn hàng năm.
 * PM TĐ là đầu mối lập; luồng ký/ban hành bổ sung theo yêu cầu khách hàng.
 * GNV TCT là hồ sơ con, không thay thế đầu ra Hướng dẫn XD KHPTM của TĐ.
 */
(function (root) {
  'use strict';
  const types = ['Core di động', 'Vô tuyến', 'BRCĐ', 'CSHT'];
  const roles = {tdPM:'PM chủ trì Tập đoàn',tdBanLead:'LĐ Ban chủ trì Tập đoàn',tdLeader:'LĐ Tập đoàn',tdClerk:'Văn thư Tập đoàn',
    ktPM:'PM Ban KT',ktLead:'LĐ Ban KT',tctLeader:'LĐTCT',tctClerk:'Văn thư TCT',
    ktmPM:'PM Ban KTM',ktmLead:'LĐ Ban KTM',netPM:'PM NetX',netLead:'LĐ NetX',
    ttpPM:'PM VNPT TTP',ttpLead:'LĐ VNPT TTP',vnpPM:'PM VNP',vnpLead:'LĐ VNP',itPM:'PM IT',itLead:'LĐ IT'};
  const units = [{name:'Ban KT',pm:'ktPM',lead:'ktLead'},{name:'Ban KTM',pm:'ktmPM',lead:'ktmLead'},
    {name:'NetX',pm:'netPM',lead:'netLead'},{name:'VNPT TTP',pm:'ttpPM',lead:'ttpLead'},
    {name:'VNP',pm:'vnpPM',lead:'vnpLead'},{name:'IT',pm:'itPM',lead:'itLead'}];
  const cutoff = {'Core di động':'10-06','Vô tuyến':'10-05','BRCĐ':'10-01','CSHT':'10-01'};
  const clone = value => JSON.parse(JSON.stringify(value));
  const time = () => new Date().toISOString();
  const fingerprint = r => JSON.stringify([r.revision,r.data]);
  const sourceFingerprint = r => JSON.stringify([r.id,r.revision,r.data,r.issue,r.guidance?.id,r.guidance?.signed]);
  const pm = r => r.kind==='GNV' || r.mode==='EXTERNAL' ? 'ktPM' : 'tdPM';
  function deadline(year, selected) { const before=selected.map(t=>cutoff[t]).sort()[0];return new Date(Date.parse((Number(year)-1)+'-'+before+'T00:00:00Z')-86400000).toISOString().slice(0,10); }
  function create(id, mode='TD') {
    if(!['TD','EXTERNAL'].includes(mode))throw Error('Luồng đầu vào không hợp lệ');
    const r={id,kind:'GUIDANCE',mode,revision:1,phase:mode==='TD'?'DRAFT':'IMPORT',data:{name:'Hướng dẫn nguyên tắc xây dựng cấu trúc, KHPTM năm 2027',year:'2027',types:types.slice(),
      deadline:deadline(2027,types),basis:'QĐ 719/QĐ-VNPT-CN-CLSP-KHĐT ngày 25/06/2026',
      principles:'Cần khảo sát, hoàn thiện nguyên tắc xây dựng cấu trúc và kế hoạch phát triển mạng.',
      structure:'Cần khảo sát định hướng cấu trúc cho Core di động, Vô tuyến, BRCĐ và CSHT.',
      content:'Hướng dẫn các đơn vị xây dựng KHPTM năm 2027 phù hợp quy hoạch hạ tầng số và nhu cầu phát triển mạng.',recipients:'Ban KT – Tổng công ty Hạ tầng mạng'},
      owner:mode==='TD'?'tdPM':'ktPM',viewer:mode==='TD'?'tdPM':'ktPM',files:[],history:[],exchange:[],drafts:{},requests:[],views:{},issue:{},guidance:null,submission:null,gnv:null};
    r.receipt={from:null,to:r.owner,purpose:mode==='TD'?'PREPARE':'IMPORT',revision:1,files:[],time:time()};return r;
  }
  const owns = (r,a) => !!r && roles[a] && r.owner===a && r.receipt?.to===a && r.receipt.revision===r.revision;
  const requestTask = (r,a) => r.requests.find(q=>q.status!=='DONE' && q.owner===a && q.receipt.to===a && q.receipt.revision===q.revision &&
    (q.receipt.purpose==='CONSULT_ASSIGN' && a==='ktLead' && q.receipt.from==='tdPM' ||
     q.receipt.purpose==='CONSULT_WORK' && a==='ktPM' && ['tdPM','ktLead'].includes(q.receipt.from) ||
     q.receipt.purpose==='CONSULT_REVIEW' && a==='ktLead' && q.receipt.from==='ktPM' && q.receipt.responseRevision===q.responseRevision));
  const returnedConsult = r => r.kind==='GUIDANCE' && r.mode==='TD' && r.requests.some(q=>q.status==='DONE' && q.id===r.receipt.requestId && q.receipt.from===r.receipt.from && q.receipt.purpose==='CONSULT_RESULT');
  const canEdit = (r,a) => owns(r,a) && a===pm(r) && ['PREPARE','REVISE','IMPORT'].includes(r.receipt.purpose) &&
    (r.kind==='GNV' ? [null,'ktLead','tctLeader'].includes(r.receipt.from) : r.mode==='EXTERNAL' ? r.receipt.from===null : [null,'tdBanLead','tdLeader'].includes(r.receipt.from)||returnedConsult(r)) && !r.issue.issued;
  const canProvide = (r,a) => requestTask(r,a)?.receipt.purpose==='CONSULT_WORK';
  const canReceive = (r,a) => owns(r,a) || !!requestTask(r,a) || !!r.views[a];
  const receiptFor = (r,a) => requestTask(r,a)?.receipt || (owns(r,a)?r.receipt:r.views[a]);
  const validSource = r => r.kind!=='GNV' || !!r.source && r.source.issue.issued && r.source.document.signed && r.source.revision===r.source.document.revision &&
    r.source.fingerprint===JSON.stringify([r.source.id,r.source.revision,r.source.data,r.source.issue,r.source.document.id,r.source.document.signed]);
  const validDocs = r => validSource(r) && r.receipt.fingerprint===fingerprint(r) && r.guidance?.revision===r.revision && r.guidance.fingerprint===fingerprint(r) &&
    r.receipt.files.includes(r.guidance.id) && (r.kind==='GUIDANCE'&&r.mode==='EXTERNAL' || r.submission?.revision===r.revision && r.submission.fingerprint===fingerprint(r) && r.receipt.files.includes(r.submission.id));
  const signatureValid = (r,doc) => !!doc?.signed && doc.revision===r.revision && doc.fingerprint===fingerprint(r) &&
    doc.signer===(doc.kind==='submission'?(r.kind==='GNV'?'ktLead':'tdBanLead'):r.kind==='GNV'?'tctLeader':'tdLeader');
  const canSign = (r,a) => owns(r,a) && validDocs(r) &&
    (r.kind==='GUIDANCE' && r.mode==='TD' && a==='tdBanLead' && r.receipt.from==='tdPM' && r.receipt.purpose==='SIGN_TD_SUBMISSION' && !signatureValid(r,r.submission) ||
     r.kind==='GUIDANCE' && r.mode==='TD' && a==='tdLeader' && r.receipt.from==='tdBanLead' && r.receipt.purpose==='SIGN_GUIDANCE' && signatureValid(r,r.submission) && !signatureValid(r,r.guidance) ||
     r.kind==='GNV' && a==='ktLead' && r.receipt.from==='ktPM' && r.receipt.purpose==='SIGN_SUBMISSION' && !signatureValid(r,r.submission) ||
     r.kind==='GNV' && a==='tctLeader' && r.receipt.from==='ktLead' && r.receipt.purpose==='SIGN_GNV' && signatureValid(r,r.submission) && !signatureValid(r,r.guidance));
  const canApprove = (r,a) => {const q=requestTask(r,a);return q?.receipt.purpose==='CONSULT_REVIEW' && q.responseRevision>0 && q.approvedRevision!==q.responseRevision;};
  const canIssue = (r,a) => owns(r,a) && validDocs(r) && !r.issue.issued && signatureValid(r,r.guidance) &&
    (r.kind==='GUIDANCE' && r.mode==='TD' && a==='tdClerk' && r.receipt.from==='tdLeader' && r.receipt.purpose==='ISSUE_GUIDANCE' && signatureValid(r,r.submission) ||
     r.kind==='GNV' && a==='tctClerk' && r.receipt.from==='tctLeader' && r.receipt.purpose==='ISSUE_GNV' && signatureValid(r,r.submission));
  const issuedGuidance = r => !!(r.kind==='GUIDANCE' && r.issue.issued && signatureValid(r,r.guidance) && r.issue.revision===r.revision && (r.mode==='EXTERNAL'||signatureValid(r,r.submission)));
  const canAssign = (r,a) => issuedGuidance(r) && owns(r,a) && a==='ktPM' && r.receipt.purpose==='RECEIVED_GUIDANCE' &&
    ['tdClerk','ktPM'].includes(r.receipt.from) && r.receipt.files.includes(r.guidance.id) && r.receipt.sourceFingerprint===sourceFingerprint(r);
  function validate(r) { if(!validSource(r)||r.kind==='GNV' && (r.data.year!==r.source.data.year||r.data.types.some(t=>!r.source.data.types.includes(t))))throw Error('Thông tin GNV phải đúng hướng dẫn TĐ nguồn');
    if(!r.data.name.trim() || !/^\d{4}$/.test(r.data.year) || Number(r.data.year)<2000 || Number(r.data.year)>2100 || !r.data.types.length || r.data.types.some(t=>!types.includes(t)) || !r.data.deadline)throw Error('Nhập tên, năm kế hoạch, loại thiết bị và thời hạn');
    if(!r.data.content.trim())throw Error('Nhập nội dung văn bản'); }
  function save(r,a,data) { if(!canEdit(r,a))throw Error('Bạn chưa được giao lập / sửa hồ sơ');
    const next={...r.data,...clone(data)};if(JSON.stringify(next)!==JSON.stringify(r.data)){r.data=next;r.revision++;r.guidance=null;r.submission=null;r.receipt.revision=r.revision;r.receipt.files=[];r.receipt.fingerprint=null;}return r; }
  function document(r,kind) {return {id:r.id+'-'+kind+'-v'+r.revision,kind,revision:r.revision,fingerprint:fingerprint(r),signed:false};}
  function prepare(r,a) {if(!canEdit(r,a)||r.phase==='IMPORT')throw Error('Chưa được giao lập văn bản');validate(r);r.guidance ||= document(r,r.kind==='GNV'?'gnv':'guidance');r.submission ||= document(r,'submission');return [r.guidance,r.submission];}
  function sign(r,a,external) {if(!canSign(r,a))throw Error('Nhiệm vụ, người chuyển hoặc phiên bản không cho phép ký');
    if(external&&(!external.name || !/\.(pdf|docx?)$/i.test(external.name)))throw Error('Chọn văn bản đã ký PDF/Word');
    const doc=['ktLead','tdBanLead'].includes(a)?r.submission:r.guidance;Object.assign(doc,{signed:true,signer:a,signatureSource:external?'external':'digital',signedAt:time()});
    if(external)doc.external={...external};return doc; }
  function approve(r,a) {if(!canApprove(r,a))throw Error('Chỉ duyệt phản hồi do PM Ban KT trình');const q=requestTask(r,a);q.approvedRevision=q.responseRevision;}
  function issue(r,a,metadata) {if(!canIssue(r,a))throw Error('Chỉ Văn thư nhận đúng văn bản đã ký được ban hành');
    if(!metadata.number?.trim()||!/^\d{4}-\d{2}-\d{2}$/.test(metadata.date)||!metadata.recipients?.trim())throw Error('Nhập số, ngày ban hành và nơi nhận');
    r.issue={...clone(metadata),issued:true,revision:r.revision,actor:a,time:time()};r.phase='ISSUED';return r.issue; }
  function takeNumber(r,a,records=[]) {if(!canIssue(r,a))throw Error('Chỉ Văn thư nhận văn bản đã ký được lấy số');
    if(r.issueDraft?.number?.trim())return r.issueDraft.number;
    const authority=r.kind==='GNV'?'TCT':'TD',start=authority==='TD'?1001:813;
    const used=records.filter(x=>(x.kind==='GNV'?'TCT':'TD')===authority).flatMap(x=>[x.issue?.serial||x.issue?.number,x.issueDraft?.number]).map(x=>/^\d+(?:\/|$)/.test(x||'')?parseInt(x,10):0);
    const number=String(Math.max(start-1,...used)+1);r.issueDraft={...r.issueDraft,number};return number; }
  function recordExternal(r,a,metadata,file) {if(r.kind!=='GUIDANCE'||r.mode!=='EXTERNAL'||!canEdit(r,a)||a!=='ktPM')throw Error('Chưa được giao ghi nhận VB Tập đoàn');validate(r);
    if(!metadata.confirmed || !metadata.number?.trim() || !metadata.date || !file?.name || !/\.(pdf|docx?)$/i.test(file.name))throw Error('Đính kèm VB TĐ đã ban hành và xác nhận số/ngày văn bản');
    r.guidance=document(r,'guidance');Object.assign(r.guidance,{signed:true,signer:'tdLeader',signatureSource:'external',external:{...file}});
    r.issue={...clone(metadata),issued:true,revision:r.revision,actor:a,time:time()};r.phase='RECEIVED';
    r.receipt={from:a,to:a,purpose:'RECEIVED_GUIDANCE',revision:r.revision,files:[r.guidance.id],sourceFingerprint:sourceFingerprint(r),time:time()};return r; }
  function assignment(parent,a,id) {if(!canAssign(parent,a))throw Error('Chỉ PM Ban KT nhận hướng dẫn TĐ đã ban hành được giao nhiệm vụ');if(parent.gnv)return {existingId:parent.gnv.id};
    const r=create(id,'TD');r.kind='GNV';r.source={id:parent.id,revision:parent.revision,fingerprint:sourceFingerprint(parent),data:clone(parent.data),issue:clone(parent.issue),document:clone(parent.guidance)};
    r.data={...clone(parent.data),name:'Giao nhiệm vụ phối hợp xây dựng KHPTM năm '+parent.data.year,deadline:(Number(parent.data.year)-1)+'-10-20',
      recipients:'Ban KT; Ban KTM; NetX; VNPT TTP; VNP; IT',content:'Ban KT chủ trì xây dựng KHPTM; các đơn vị phối hợp thực hiện phần việc được giao, cung cấp thông tin theo yêu cầu trong quá trình xây dựng KHPTM.'};
    r.owner=r.viewer='ktPM';r.phase='DRAFT';r.receipt={from:null,to:'ktPM',purpose:'PREPARE',revision:1,files:[],sourceId:parent.id,time:time()};
    parent.gnv={id:r.id,sourceRevision:parent.revision,number:'',issued:false};return r; }
  function linkAssignment(parent,r) {if(r.kind!=='GNV'||r.source.id!==parent.id||r.source.fingerprint!==sourceFingerprint(parent)||parent.gnv?.id!==r.id)throw Error('Liên kết GNV không đúng văn bản nguồn');
    Object.assign(parent.gnv,{number:r.issue.number||'',date:r.issue.date||'',issued:!!r.issue.issued}); }
  const recipientUnits = r => units.filter(u=>r.data.recipients.split(/[;,\n]/).map(x=>x.trim()).includes(u.name));
  function allowed(r,a) {
    const q=requestTask(r,a);if(q){if(q.receipt.purpose==='CONSULT_ASSIGN')return ['ktPM','tdPM'];if(q.receipt.purpose==='CONSULT_WORK')return q.responseRevision?['tdPM','ktLead']:['tdPM'];
      if(q.receipt.purpose==='CONSULT_REVIEW')return ['ktPM',...(q.approvedRevision===q.responseRevision?['tdPM']:[])];}
    if(!owns(r,a))return [];
    if(canEdit(r,a)&&r.phase!=='IMPORT')return r.kind==='GUIDANCE'?['tdBanLead',...(!r.requests.some(q=>q.status!=='DONE')?['ktPM','ktLead']:[])]:['ktLead'];
    if(r.kind==='GUIDANCE' && a==='tdBanLead' && r.receipt.from==='tdPM' && r.receipt.purpose==='SIGN_TD_SUBMISSION' && validDocs(r))return signatureValid(r,r.submission)?['tdLeader']:['tdPM'];
    if(r.kind==='GUIDANCE' && a==='tdBanLead' && r.receipt.from==='tdLeader' && r.receipt.purpose==='ASSIGN_TD_REVISE' && validDocs(r))return ['tdPM'];
    if(r.kind==='GUIDANCE' && a==='tdLeader' && r.receipt.from==='tdBanLead' && r.receipt.purpose==='SIGN_GUIDANCE' && validDocs(r) && signatureValid(r,r.submission))return signatureValid(r,r.guidance)?['tdClerk']:['tdPM','tdBanLead'];
    if(r.kind==='GNV' && a==='ktLead' && r.receipt.from==='ktPM' && r.receipt.purpose==='SIGN_SUBMISSION' && validDocs(r))return signatureValid(r,r.submission)?['tctLeader']:['ktPM'];
    if(r.kind==='GNV' && a==='ktLead' && r.receipt.from==='tctLeader' && r.receipt.purpose==='ASSIGN_REVISE' && validDocs(r))return ['ktPM'];
    if(r.kind==='GNV' && a==='tctLeader' && r.receipt.from==='ktLead' && r.receipt.purpose==='SIGN_GNV' && validDocs(r))return signatureValid(r,r.guidance)?['tctClerk']:['ktPM','ktLead'];
    if(r.kind==='GUIDANCE'&&a==='tdClerk'&&r.receipt.from==='tdLeader'&&r.receipt.purpose==='ISSUE_GUIDANCE'&&validDocs(r)&&issuedGuidance(r))return ['ktPM'];
    if(r.kind==='GNV'&&a==='tctClerk'&&r.receipt.from==='tctLeader'&&r.receipt.purpose==='ISSUE_GNV'&&validDocs(r)&&signatureValid(r,r.guidance)&&r.issue.issued&&!r.distribution)return recipientUnits(r).flatMap(u=>[u.lead,u.pm]);
    return [];
  }
  function storeConsult(r,a,kind,data,artifact={}) {const q=requestTask(r,a);if(!['request','supply'].includes(kind))throw Error('Loại văn bản không hợp lệ');if(kind==='request' ? r.kind!=='GUIDANCE'||r.mode!=='TD'||!canEdit(r,a)||r.requests.some(q=>q.status!=='DONE') : !canProvide(r,a))throw Error('Bạn chưa được giao tạo VB này');
    if(kind==='request'&&data.unit!=='Ban KT'||!data.content?.trim()||kind==='request'&&!data.deadline)throw Error('Nhập nội dung và chọn Ban KT theo RACI bước 1');
    const version=1+r.files.filter(f=>f.infoKind===kind&&f.author===a&&f.requestId===q?.id).length;
    const f={...artifact,id:r.id+'-'+kind+'-'+a+'-v'+version,kind:kind==='request'?'request':'response',infoKind:kind,author:a,version,requestId:q?.id,data:clone(data)};r.files.push(f);return f; }
  function saveResponse(r,a,text,files) {const q=requestTask(r,a);if(!canProvide(r,a)||!text.trim())throw Error('Nhập ý kiến phản hồi theo nhiệm vụ');
    if(files.some(id=>!r.files.some(f=>f.id===id&&f.requestId===q.id&&f.author===a)))throw Error('Tài liệu phản hồi không thuộc yêu cầu');
    q.responseRevision++;q.response={text,files:files.slice(),revision:q.responseRevision};q.approvedRevision=0;return q; }
  function transfer(r,a,to,detail={}) {
    detail={note:'',files:[],co:[],view:[],...detail};if(!allowed(r,a).includes(to))throw Error('Người nhận không đúng nguồn chuyển / nhiệm vụ');
    const q=requestTask(r,a);if(q){if(detail.co.length||detail.view.length)throw Error('Không mở thêm nhánh phối hợp trong lượt phản hồi');if(to==='tdPM'){if(q.receipt.purpose==='CONSULT_REVIEW'&&q.approvedRevision!==q.responseRevision)throw Error('Duyệt phản hồi trước khi gửi TĐ');
        if(!q.responseRevision&&!detail.note.trim())throw Error('Nhập ý kiến phản hồi hoặc lý do trả yêu cầu');
        if(q.response?.files.some(id=>!detail.files.includes(id)))throw Error('Chọn đủ tài liệu phản hồi');q.status='DONE';q.owner=null;
      }else if(to==='ktLead'&&!q.responseRevision)throw Error('Lưu phản hồi trước khi trình lãnh đạo');
      else{if(q.receipt.purpose==='CONSULT_REVIEW'){if(!detail.note.trim())throw Error('Ghi yêu cầu bổ sung');q.approvedRevision=0;}q.owner=to;}
      const receipt={from:a,to,purpose:to==='tdPM'?'CONSULT_RESULT':to==='ktPM'?'CONSULT_WORK':'CONSULT_REVIEW',revision:q.revision,responseRevision:q.responseRevision,requestId:q.id,files:detail.files.slice(),note:detail.note,time:time()};q.receipt=receipt;
      if(to==='tdPM')r.receipt={...receipt,revision:r.revision,purpose:'PREPARE'};r.viewer=to;return receipt;
    }
    if(detail.co.length && !(r.kind==='GNV'&&a==='tctClerk'&&r.issue.issued) || detail.co.some(x=>!allowed(r,a).includes(x)||x===to) || detail.view.some(x=>!roles[x]||x===to||detail.co.includes(x)))throw Error('Vai trò phối hợp / xem không hợp lệ');
    if(r.kind==='GUIDANCE'&&a==='tdPM'&&['ktPM','ktLead'].includes(to)){
      const f=r.files.filter(f=>f.infoKind==='request'&&detail.files.includes(f.id)).at(-1);if(!f)throw Error('Chọn VB xin ý kiến Ban KT');
      const q={id:r.id+'-consult-'+(r.requests.length+1),revision:1,status:'OPEN',owner:to,requestDocument:clone(f),responseRevision:0,approvedRevision:0,response:null};
      q.receipt={from:a,to,purpose:to==='ktPM'?'CONSULT_WORK':'CONSULT_ASSIGN',revision:1,requestId:q.id,files:[f.id],note:detail.note,time:time()};r.requests.push(q);r.viewer=to;return q.receipt;
    }
    if(canEdit(r,a)){if(r.requests.some(q=>q.status!=='DONE'))throw Error('Hoàn tất nhánh xin ý kiến đã chọn trước khi trình ký');prepare(r,a);}
    const mandatory=[r.guidance?.id,r.submission?.id];
    if(mandatory.some(id=>!id||!detail.files.includes(id)))throw Error('Chọn đủ văn bản đúng phiên bản khi chuyển');
    if((to===pm(r)&&['tdBanLead','tdLeader','ktLead','tctLeader'].includes(a)||to==='ktLead'&&a==='tctLeader'||to==='tdBanLead'&&a==='tdLeader')&&!detail.note.trim())throw Error('Ghi ý kiến trả lại');
    let purpose,phase;
    if(a==='tctClerk'){purpose='IMPLEMENT';phase='DISTRIBUTED';r.distribution={main:to,co:detail.co.slice(),view:detail.view.slice(),files:detail.files.slice(),time:time()};}
    else if(to===pm(r)&&['tdBanLead','tdLeader','ktLead','tctLeader'].includes(a)||a==='tctLeader'&&to==='ktLead'||a==='tdLeader'&&to==='tdBanLead'){purpose=to==='ktLead'?'ASSIGN_REVISE':to==='tdBanLead'?'ASSIGN_TD_REVISE':'REVISE';phase=['ktLead','tdBanLead'].includes(to)?'RETURN':'DRAFT';r.guidance.signed=false;if(r.submission)r.submission.signed=false;}
    else if(to==='tdBanLead'){purpose='SIGN_TD_SUBMISSION';phase='TD_BAN_SIGN';}
    else if(to==='tdLeader'){purpose='SIGN_GUIDANCE';phase='SIGN';}
    else if(to==='ktLead'){purpose='SIGN_SUBMISSION';phase='BAN_SIGN';}
    else if(to==='tctLeader'){purpose='SIGN_GNV';phase='SIGN';}
    else if(to==='tdClerk'||to==='tctClerk'){purpose=to==='tdClerk'?'ISSUE_GUIDANCE':'ISSUE_GNV';phase='ISSUE';}
    else if(a==='tdClerk'&&to==='ktPM'){purpose='RECEIVED_GUIDANCE';phase='RECEIVED';}
    else throw Error('Hướng chuyển chưa hợp lệ');
    const receipt={from:a,to,purpose,revision:r.revision,fingerprint:fingerprint(r),files:detail.files.slice(),note:detail.note,time:time()};
    if(purpose==='RECEIVED_GUIDANCE')receipt.sourceFingerprint=sourceFingerprint(r);
    r.owner=r.viewer=to;r.receipt=receipt;r.phase=phase;detail.co.concat(detail.view).forEach(x=>r.views[x]={...receipt,to:x,purpose:detail.co.includes(x)?'IMPLEMENT':'INFORMATION'});return receipt;
  }
  const roleKeys = r => r.kind==='GUIDANCE'?['tdPM','tdBanLead','tdLeader','tdClerk','ktPM','ktLead']:['ktPM','ktLead','tctLeader','tctClerk',...recipientUnits(r).flatMap(u=>[u.lead,u.pm])].filter((v,i,a)=>a.indexOf(v)===i);
  root.KHStep1={types,roles,units,cutoff,deadline,create,pm,fingerprint,sourceFingerprint,owns,canEdit,canProvide,canReceive,requestTask,receiptFor,
    canSign,canApprove,canIssue,canAssign,issuedGuidance,signatureValid,validDocs,save,prepare,sign,approve,issue,takeNumber,recordExternal,assignment,linkAssignment,recipientUnits,allowed,storeConsult,saveResponse,transfer,roleKeys};
  if(typeof module!=='undefined'&&module.exports)module.exports=root.KHStep1;
})(typeof window!=='undefined'?window:globalThis);

(function () {
  'use strict';
  if(typeof window==='undefined')return;
  const W=KHStep1, records=new Map(), page=document.getElementById('khptm-process');
  let currentId='', counter=1, modal=null;
  const current=()=>records.get(currentId), today=()=>new Date().toISOString().slice(0,10), now=()=>new Date().toLocaleString('vi-VN',{hour12:false});
  const headerRole=document.getElementById('headerRole'), defaultHeaderOptions=headerRole?.innerHTML;
  let ownsHeader=false;
  function syncHeader(){const r=current();if(!r||!page.classList.contains('active')||!headerRole)return;
    headerRole.innerHTML=W.roleKeys(r).map(a=>'<option value="'+a+'"'+(a===r.viewer?' selected':'')+'>'+W.roles[a]+'</option>').join('');
    document.getElementById('headerUserText').textContent=W.roles[r.viewer];ownsHeader=true;}
  const beforeShowPage=showPage;
  showPage=function(id){if(id!=='khptm-process'&&ownsHeader){headerRole.innerHTML=defaultHeaderOptions;ownsHeader=false;syncRoleHeader();}
    const result=beforeShowPage.apply(this,arguments);if(id==='khptm-process')syncHeader();return result;};
  const beforeHeaderRole=switchRoleFromHeader;
  switchRoleFromHeader=function(role){if(page.classList.contains('active')&&current())return setRole(role);return beforeHeaderRole.apply(this,arguments);};
  const section=(title,body)=>'<div class="section"><h3>'+esc(title)+'</h3><div class="body">'+body+'</div></div>';
  const button=(label,action,enabled=true,cls='')=>'<button type="button" class="'+cls+'" onclick="'+esc(action)+'"'+(enabled?'':' disabled')+'>'+esc(label)+'</button>';
  const run=fn=>{try{return fn();}catch(e){notify(e.message,true);return false;}};
  const purposeNames={PREPARE:'Lập văn bản',REVISE:'Bổ sung hồ sơ trình',IMPORT:'Ghi nhận hướng dẫn Tập đoàn đã ban hành',SIGN_TD_SUBMISSION:'Xem xét / ký Tờ trình LĐ TĐ',SIGN_GUIDANCE:'Xem xét / ký dự thảo VB hướng dẫn Tập đoàn',
    SIGN_SUBMISSION:'Xem xét / ký Tờ trình LĐ TCT',SIGN_GNV:'Xem xét / ký VB GNV TCT',ISSUE_GUIDANCE:'Ban hành hướng dẫn Tập đoàn',ISSUE_GNV:'Ban hành VB GNV TCT',
    RECEIVED_GUIDANCE:'Tiếp nhận hướng dẫn – có thể Giao nhiệm vụ',CONSULT_ASSIGN:'Phân công góp ý hướng dẫn',CONSULT_WORK:'Góp ý nguyên tắc, cấu trúc KHPTM',CONSULT_REVIEW:'Duyệt ý kiến Ban KT',
    CONSULT_RESULT:'Nhận ý kiến Ban KT',ASSIGN_REVISE:'Chuyển yêu cầu bổ sung về PM Ban KT',ASSIGN_TD_REVISE:'Chuyển yêu cầu bổ sung về PM chủ trì TĐ',IMPLEMENT:'Nhận VB GNV để thực hiện',INFORMATION:'Xem để biết'};
  const state=r=>({DRAFT:'Dự thảo',IMPORT:'Chờ ghi nhận VB TĐ',SIGN:'Chờ lãnh đạo ký',BAN_SIGN:'Chờ LĐ Ban KT ký Tờ trình',TD_BAN_SIGN:'Chờ LĐ Ban chủ trì TĐ ký Tờ trình',ISSUE:'Chờ văn thư ban hành',ISSUED:'Đã ban hành',RECEIVED:'Đã nhận hướng dẫn TĐ',RETURN:'Yêu cầu bổ sung',DISTRIBUTED:'Đã chuyển đơn vị thực hiện'})[r.phase];
  const base=document.createElement('template');base.innerHTML=khptm2ExtendedHtml();
  const sharedFileTable=base.content.querySelector('.pm-ext-table').cloneNode(true);
  const sharedUpload=base.content.querySelector('.pm-ext-add-table')?.cloneNode(true);
  const sharedTransferRow=document.getElementById('routeSignFileRow').cloneNode(true);
  function notify(message,invalid=false){const host=document.getElementById('kh1Feedback');if(host){host.hidden=false;host.className=invalid?'khptm-note':'khptm-output';host.textContent=message;host.setAttribute('role',invalid?'alert':'status');}toast(message);}
  function log(r,text,actor,receipt){r.history.unshift({text,actor:actor||W.roles[r.viewer],time:now(),receipt:receipt?{...receipt,files:receipt.files.slice()}:undefined});}
  function remember(){const r=current();if(!r)return;const ta=document.getElementById('khptmQuickExchange');if(ta)draft(r).text=ta.value;}
  function draft(r){return r.drafts[r.viewer]||(r.drafts[r.viewer]={text:'',attachments:[]});}
  function open(id){if(modal)hideTransferModal();closeKHPTM2InfoModal();closeKHPTMPreview();currentId=records.has(id)?id:'HD-MAU-2027';const r=current();r.viewer=r.owner;r.tab=['tdPM','ktPM'].includes(r.viewer)?'files':'exchange';showPage('khptm-process');document.getElementById('nav-khptm')?.classList.add('active');render();}
  function create(){const id='HD-'+counter++;records.set(id,W.create(id));open(id);}
  function openList(){if(modal)hideTransferModal();closeKHPTM2InfoModal();closeKHPTMPreview();renderList();showPage('khptm-list');document.getElementById('nav-khptm')?.classList.add('active');}
  function listActions(r){return button('Mở',"kh1.open('"+r.id+"')",true,'small')+
    (r.submission||r.mode==='TD'?button('Xem tờ trình',"kh1.previewRecord('"+r.id+"','submission')",true,'small'):'')+
    (r.guidance||r.mode==='TD'?button(r.kind==='GNV'?'Xem VB GNV':r.issue.issued?'Xem VB hướng dẫn':W.signatureValid(r,r.guidance)?'Xem VB đã ký':'Xem dự thảo',"kh1.previewRecord('"+r.id+"','outgoing')",true,'small'):'');}
  function previewRecord(id,kind){if(!records.has(id))return;open(id);preview(kind);}
  function renderList(){const host=document.getElementById('kh1ListRows');if(!host)return;host.innerHTML=Array.from(records.values()).map((r,i)=>'<tr><td class="center">'+(i+1)+'</td><td class="center">'+esc(r.data.year)+'</td><td><span class="khptm-list-title" onclick="kh1.open(\''+r.id+'\')">'+esc(r.data.name)+'</span><div class="mini">'+(r.kind==='GNV'?'Hồ sơ GNV TCT · nguồn '+esc(r.source.issue.number):r.mode==='EXTERNAL'?'Ghi nhận VB TĐ đã ban hành ngoài hệ thống':'Hướng dẫn TĐ · TĐ AR, Ban KT C,I')+'</div></td><td>'+esc(r.data.types.join(' · '))+'</td><td class="center">'+esc(formatDateVN(r.data.deadline))+'</td><td class="center">'+esc(r.kind==='GNV'?r.issue.number||'--':r.gnv?.number||'--')+'</td><td><span class="badge '+(r.issue.issued?'bgreen':'borange')+'">'+esc(state(r))+'</span></td><td class="center"><div class="buttons">'+listActions(r)+'</div></td></tr>').join('');}
  function reset(){const old=current();if(!old)return;if(modal)hideTransferModal();closeKHPTM2InfoModal();
    const root=old.kind==='GNV'?records.get(old.source.id):old;const child=root.gnv?.id;if(child)records.delete(child);records.set(root.id,W.create(root.id,root.mode));open(root.id);notify('Đã reset hồ sơ mẫu và liên kết GNV trong chức năng này');}
  function setRole(a){const r=current();if(!W.roleKeys(r).includes(a))return;remember();if(modal)hideTransferModal();closeKHPTM2InfoModal();closeKHPTMPreview();r.viewer=a;r.tab=['tdPM','ktPM'].includes(a)?'files':'exchange';render();}
  function mode(value){const r=current();if(r.kind!=='GUIDANCE'||!W.canEdit(r,r.viewer)||r.requests.length) return notify('Chỉ đổi luồng trước khi chuyển hồ sơ');const next=W.create(r.id,value);next.data={...r.data};records.set(r.id,next);render();}
  function field(key,label,kind='input',locked=false){const r=current(),disabled=!W.canEdit(r,r.viewer)||locked,attrs=' id="kh1Field_'+key+'" data-kh1-field="'+key+'" onchange="kh1.fieldChanged()"'+(disabled?' disabled':'');return '<div'+(kind==='textarea'?' style="grid-column:1/-1"':'')+'><label for="kh1Field_'+key+'">'+esc(label)+'</label>'+(kind==='textarea'?'<textarea'+attrs+'>'+esc(r.data[key])+'</textarea>':'<input type="'+(kind==='date'?'date':'text')+'"'+attrs+' value="'+esc(r.data[key])+'">')+'</div>';}
  function readForm(){const r=current(),data={...r.data};page.querySelectorAll('[data-kh1-field]').forEach(el=>data[el.dataset.kh1Field]=el.value.trim());const selected=document.getElementById('kh1Types');if(selected)data.types=selected.value==='ALL'?W.types.slice():[selected.value];return data;}
  function fieldChanged(){run(()=>{const r=current();W.save(r,r.viewer,readForm());renderList();});}
  function typesChanged(){const r=current();run(()=>{const data=readForm();if(r.kind==='GUIDANCE')data.deadline=W.deadline(data.year,data.types);W.save(r,r.viewer,data);render();});}
  function save(){return run(()=>{const r=current();W.save(r,r.viewer,readForm());if(r.phase!=='IMPORT')W.prepare(r,r.viewer);ensureArtifacts(r);log(r,'Lưu nháp '+r.data.name);render();notify('Đã lưu nội dung và cập nhật preview');return true;});}
  function assignment(){run(()=>{const parent=current(),child=W.assignment(parent,parent.viewer,'GNV-'+parent.id);if(child.existingId)return open(child.existingId);records.set(child.id,child);log(parent,'Tạo hồ sơ GNV TCT '+child.id);log(child,'Kế thừa hướng dẫn TĐ '+parent.issue.number,'PM Ban KT');open(child.id);});}
  function form(r){const edit=W.canEdit(r,r.viewer),isGnv=r.kind==='GNV';let first='';
    if(!isGnv&&!r.issue.issued)first='<div><label for="kh1Mode">Luồng đầu vào</label><select id="kh1Mode" onchange="kh1.mode(this.value)"'+(!edit||r.requests.length?' disabled':'')+'><option value="TD"'+(r.mode==='TD'?' selected':'')+'>Lập hướng dẫn Tập đoàn</option><option value="EXTERNAL"'+(r.mode==='EXTERNAL'?' selected':'')+'>Ghi nhận VB TĐ đã ban hành ngoài hệ thống</option></select></div>';
    const scope='<div><label for="kh1Types">Mảng KHPTM *</label><select id="kh1Types" onchange="kh1.typesChanged()"'+(!edit||isGnv?' disabled':'')+'><option value="ALL"'+(r.data.types.length>1?' selected':'')+'>Core + Vô tuyến + BRCĐ + CSHT</option>'+W.types.map(t=>'<option'+(r.data.types.length===1&&r.data.types[0]===t?' selected':'')+'>'+esc(t)+'</option>').join('')+'</select></div>';
    let html=section(isGnv?'1. Thông tin hồ sơ giao nhiệm vụ':'1. Thông tin hướng dẫn xây dựng KHPTM','<div class="grid">'+first+field('name',isGnv?'Tên giao nhiệm vụ *':'Tên hướng dẫn *')+field('year','Năm kế hoạch *','input',isGnv)+scope+field('deadline',isGnv?'Hạn lập / thực hiện *':'Hạn ban hành hướng dẫn *','date')+field('basis','Căn cứ quy trình / quy hoạch','textarea')+'</div>');
    if(isGnv)html+=section('2. Nội dung giao nhiệm vụ phối hợp','<div class="grid two"><div style="grid-column:1/-1"><label>Hướng dẫn Tập đoàn căn cứ</label><input readonly value="'+esc(r.source.issue.number+' · '+formatDateVN(r.source.issue.date))+'"></div>'+field('recipients','Đơn vị nhận / phối hợp (phân cách bằng dấu ;)','textarea')+field('content','Nội dung giao nhiệm vụ','textarea')+'</div>');
    else html+=section('2. Nội dung hướng dẫn','<div class="grid two">'+field('principles','Nguyên tắc xây dựng cấu trúc và KHPTM','textarea')+field('structure','Định hướng cấu trúc / phạm vi mạng','textarea')+field('content','Hướng dẫn xây dựng KHPTM','textarea')+field('recipients','Nơi nhận','textarea')+'</div><div class="hint">RACI bước 1: Tập đoàn AR; Ban KT C,I. '+r.data.types.map(t=>esc(t)+': trước '+W.cutoff[t].split('-').reverse().join('/')+'/'+(Number(r.data.year)-1)).join('; ')+'.</div>');
    if(r.mode==='EXTERNAL'&&r.phase==='IMPORT')html+=section('3. Ghi nhận văn bản Tập đoàn đã ban hành','<div class="grid">'+issueFields(r,true)+'<div style="grid-column:1/-1"><label><input id="kh1ExternalConfirmed" type="checkbox"> Văn bản đính kèm đã được Tập đoàn ký và ban hành</label><div class="hint">Gắn văn bản tại Thông tin mở rộng; không trình ký lại văn bản này.</div></div></div>');
    if(!isGnv&&r.gnv){const child=records.get(r.gnv.id);html+=section('Văn bản GNV TCT liên quan','<div class="khptm-source"><div class="title">'+esc(child?.data.name||r.gnv.id)+'</div><div class="meta">'+esc(child?.issue.number||'Chưa ban hành')+' · '+esc(child?state(child):'')+'</div>'+button('Mở hồ sơ GNV TCT',"kh1.open('"+r.gnv.id+"')")+'</div>');}
    return html;
  }
  function issueFields(r,external=false){const d=r.issueDraft||{},prefix=external?'kh1External':'kh1Issue',fields=[['number','Số văn bản *','text'],...(!external?[['suffix','Hậu tố','text']]:[]),['date','Ngày ban hành *','date'],['eoffice','Số eOffice/VBKS','text'],['recipients','Nơi nhận *','text']];
    return fields.map(([key,label,type])=>{const value=d[key]??r.issue[key]??(key==='number'?r.issue.serial||'':key==='date'?today():key==='recipients'?r.data.recipients:key==='suffix'?r.kind==='GNV'?'VNPT Net-KT':'VNPT-CN':'');
      const input='<input id="'+prefix+'_'+key+'" type="'+type+'" value="'+esc(key==='number'&&r.issue.issued?r.issue.serial||value:value)+'"'+(r.issue.issued?' readonly':'')+' oninput="kh1.rememberIssue()"'+(!external&&key==='number'?' style="min-width:0;flex:1"':'')+'>';
      return '<div'+(!external&&key==='recipients'?' style="grid-column:1/-1"':'')+'><label for="'+prefix+'_'+key+'">'+label+'</label>'+(!external&&key==='number'?'<div style="display:flex;gap:6px">'+input+button('Lấy số','kh1.takeNumber()',W.canIssue(r,r.viewer))+'</div>':input)+'</div>';}).join('');}
  function rememberIssue(){const r=current();r.issueDraft={...r.issueDraft};['number','suffix','date','eoffice','recipients'].forEach(key=>{const el=document.getElementById((r.phase==='IMPORT'?'kh1External':'kh1Issue')+'_'+key);if(el)r.issueDraft[key]=el.value.trim();});const paper=document.getElementById('kh1ClerkPaper');if(paper)paper.innerHTML=mainPaper(r,'outgoing');}
  function issueNumber(r){const d=r.issue.issued?r.issue:r.issueDraft||{};return r.issue.issued?r.issue.number:d.number?(d.number.includes('/')||!d.suffix?d.number:d.number+'/'+d.suffix):'...';}
  function takeNumber(){run(()=>{const r=current();rememberIssue();const value=W.takeNumber(r,r.viewer,Array.from(records.values()));document.getElementById('kh1Issue_number').value=value;rememberIssue();log(r,'Lấy số văn bản '+value);notify('Đã lấy số văn bản (demo)');});}
  function canUpload(r){return W.canEdit(r,r.viewer)||W.canProvide(r,r.viewer)||W.canSign(r,r.viewer);}
  function mainPaper(r,kind){const isSub=kind==='submission',isGnv=r.kind==='GNV',issuer=isGnv?'TỔNG CÔNG TY HẠ TẦNG MẠNG – VNPT NET':'TẬP ĐOÀN BƯU CHÍNH VIỄN THÔNG VIỆT NAM',doc=isSub?r.submission:r.guidance;
    const title=isSub?'TỜ TRÌNH':isGnv?'VĂN BẢN GIAO NHIỆM VỤ':'VĂN BẢN HƯỚNG DẪN';
    const intro=isSub?'Về việc ban hành '+(isGnv?'văn bản giao nhiệm vụ phối hợp xây dựng':'văn bản hướng dẫn xây dựng')+' KHPTM năm '+r.data.year:r.data.name;
    const source=isGnv?'<p>Căn cứ hướng dẫn Tập đoàn số '+esc(r.source.issue.number)+' ngày '+esc(formatDateVN(r.source.issue.date))+'.</p>':'';
    return '<div style="text-align:center"><b>'+issuer+'</b></div>'+(!isSub&&!isGnv&&!W.signatureValid(r,doc)?'<p style="text-align:right"><b>DỰ THẢO</b></p>':'')+'<p>Số: '+esc(!isSub?issueNumber(r):'...')+'</p><h2>'+title+'</h2><h3>'+esc(intro)+'</h3><p><b>'+(isSub?'Kính trình: '+(isGnv?'Lãnh đạo Tổng công ty.':'Lãnh đạo Tập đoàn.'):'Kính gửi: '+esc(r.data.recipients))+'</b></p>'+source+'<p>Căn cứ '+esc(r.data.basis)+'.</p><p><b>Năm KHPTM:</b> '+esc(r.data.year)+' · '+esc(r.data.types.join(' · '))+'</p>'+
      (!isGnv?'<p><b>Nguyên tắc:</b></p><p style="white-space:pre-wrap">'+esc(r.data.principles)+'</p><p><b>Định hướng cấu trúc:</b></p><p style="white-space:pre-wrap">'+esc(r.data.structure)+'</p>':'')+
      '<p><b>'+(isGnv?'Nội dung giao nhiệm vụ:':'Hướng dẫn xây dựng KHPTM:')+'</b></p><p style="white-space:pre-wrap">'+esc(r.data.content)+'</p><p><b>'+(isGnv?'Hạn thực hiện:':'Hạn ban hành hướng dẫn:')+'</b> '+esc(formatDateVN(r.data.deadline))+'</p>'+
      (isSub?'<p>Kính trình '+(isGnv?'Lãnh đạo Tổng công ty xem xét, ký văn bản GNV':'Lãnh đạo Tập đoàn xem xét, ký dự thảo văn bản hướng dẫn XD KHPTM')+' kèm theo.</p>':'')+'<div class="sign"><b>'+(isSub?isGnv?'LÃNH ĐẠO BAN KT':'LÃNH ĐẠO BAN CHỦ TRÌ TẬP ĐOÀN':isGnv?'LÃNH ĐẠO TỔNG CÔNG TY':'LÃNH ĐẠO TẬP ĐOÀN')+'</b><br><br>'+esc(doc?.signed?'Đã '+(doc.signatureSource==='external'?'ghi nhận văn bản ký ngoài hệ thống':'ký số (demo)')+' · '+W.roles[doc.signer]:'Chờ ký')+'</div>'+
      (!isSub&&r.issue.issued?'<p>Đã ban hành ngày '+esc(formatDateVN(r.issue.date))+' · eOffice '+esc(r.issue.eoffice||'--')+'</p>':'');
  }
  function infoPaper(data,kind){return '<div style="text-align:center"><b>'+esc(data.issuer)+'</b></div><p>Số: '+esc(data.number||'...')+'</p><h2>'+(kind==='request'?'YÊU CẦU GÓP Ý HƯỚNG DẪN':'PHẢN HỒI Ý KIẾN BAN KT')+'</h2><h3>Nguyên tắc xây dựng cấu trúc, KHPTM năm '+esc(data.year||data.period)+'</h3><p>Kính gửi: '+esc(kind==='request'?data.unit:data.recipient1)+'</p><p>Phạm vi: '+esc(data.scope)+'</p><p style="white-space:pre-wrap">'+esc(data.content)+'</p>'+(kind==='request'?'<p>Hạn phản hồi: '+esc(formatDateVN(data.deadline))+'</p>':'')+'<p>Ý kiến phục vụ hoàn thiện văn bản hướng dẫn của Tập đoàn.</p>';}
  function artifact(file,html,name){if(file.external&&!file.external.demo){file.name=file.external.name;file.url=file.external.url;file.mime=file.external.mime;return file;}
    const stamp=html+name;if(file.artifactStamp!==stamp){if(file.url)URL.revokeObjectURL(file.url);file.html=html;file.name=name;const div=document.createElement('div');div.innerHTML=html;
      const paras=Array.from(div.children,e=>e.textContent);file.blob=KHStep5Office.docx(paras);file.mime='application/vnd.openxmlformats-officedocument.wordprocessingml.document';file.url=URL.createObjectURL(file.blob);file.artifactStamp=stamp;}return file;}
  function guidanceLabel(r){return r.kind==='GNV'?'VB GNV TCT':r.issue.issued?'VB hướng dẫn TĐ đã ban hành':W.signatureValid(r,r.guidance)?'VB hướng dẫn TĐ đã ký':'Dự thảo VB hướng dẫn TĐ';}
  function ensureArtifacts(r){if(r.guidance)artifact(r.guidance,mainPaper(r,'outgoing'),(r.kind==='GNV'?'VB_GNV_TCT_':W.signatureValid(r,r.guidance)?'VB_Huong_dan_XD_KHPTM_TD_':'Du_thao_VB_Huong_dan_XD_KHPTM_TD_')+r.data.year+'_v'+r.revision+'.docx');
    if(r.submission)artifact(r.submission,mainPaper(r,'submission'),(r.kind==='GNV'?'To_trinh_GNV_TCT_':'To_trinh_LDTD_Huong_dan_XD_KHPTM_')+r.data.year+'_v'+r.revision+'.docx');r.files.filter(f=>f.infoKind).forEach(f=>artifact(f,infoPaper(f.data,f.infoKind),(f.infoKind==='request'?'VB_xin_y_kien_huong_dan_':'VB_phan_hoi_y_kien_')+r.data.year+'_v'+f.version+'.docx'));}
  function visibleFiles(r){ensureArtifacts(r);const q=W.requestTask(r,r.viewer);if(q){const req=r.files.find(f=>f.id===q.requestDocument.id)||q.requestDocument;return [req,...r.files.filter(f=>f.requestId===q.id)];}
    const files=[...(r.guidance?[r.guidance]:[]),...(r.submission?[r.submission]:[]),...r.files];if(r.source){const parent=records.get(r.source.id);if(parent?.guidance)files.unshift({...parent.guidance,source:true});}return files;}
  function previewFile(id){const r=current(),file=visibleFiles(r).find(f=>f.id===id);if(!file)return;document.getElementById('khptmPreviewTitle').textContent=file.name||id;const host=document.getElementById('khptmPreviewPaper');
    if(file.url&&(/\.pdf$/i.test(file.name)||file.mime==='application/pdf'))host.innerHTML='<iframe title="'+esc(file.name)+'" src="'+esc(file.url)+'" style="width:100%;height:680px;border:0"></iframe>';
    else host.innerHTML=file.html||'<p>Văn bản '+esc(file.name)+'</p><p>'+ (file.external?'Văn bản gốc đã ký, ban hành ngoài hệ thống.':'Tài liệu đính kèm.')+'</p><a download="'+esc(file.name)+'" href="'+esc(file.url||'#')+'">Tải văn bản gốc</a>';
    document.getElementById('khptmPreviewModal').classList.add('show');}
  function preview(kind){run(()=>{const r=current();if(W.canEdit(r,r.viewer)&&r.phase!=='IMPORT'){W.save(r,r.viewer,readForm());W.prepare(r,r.viewer);ensureArtifacts(r);}const file=kind==='submission'?r.submission:kind==='source'?records.get(r.source?.id)?.guidance:r.guidance;if(file)previewFile(file.id);});}
  function actions(r){const a=r.viewer,q=W.requestTask(r,a);let html='';if(W.canEdit(r,a))html+=button('Lưu nháp','kh1.save()');
    if(r.guidance||r.phase==='DRAFT')html+=button(r.kind==='GNV'?'Xem VB GNV':r.issue.issued?'Xem VB hướng dẫn':W.signatureValid(r,r.guidance)?'Xem VB hướng dẫn đã ký':'Xem dự thảo VB hướng dẫn','kh1.preview(\'outgoing\')');if(r.submission)html+=button(r.kind==='GNV'?'Xem Tờ trình LĐ TCT':'Xem Tờ trình LĐ TĐ','kh1.preview(\'submission\')');
    if(W.canAssign(r,a))html+=button(r.gnv?'Mở hồ sơ GNV TCT':'Giao nhiệm vụ','kh1.assignment()',true,'khptm-emphasis');
    if(r.phase==='IMPORT'&&W.canEdit(r,a))html+=button('Ghi nhận VB đã ban hành','kh1.recordExternal()',true,'khptm-emphasis');
    if(W.canSign(r,a))html+=button(['ktLead','tdBanLead'].includes(a)?'Ký số Tờ trình':r.kind==='GNV'?'Ký số VB GNV':'Ký số VB hướng dẫn','kh1.sign()',true,'khptm-emphasis');
    if(W.canApprove(r,a))html+=button('Duyệt ý kiến','kh1.approve()',true,'khptm-emphasis');
    if((W.canSign(r,a)||W.canApprove(r,a)||['ASSIGN_REVISE','ASSIGN_TD_REVISE'].includes(r.receipt.purpose)&&W.owns(r,a))&&(!q||q.receipt.purpose==='CONSULT_REVIEW'))html+=button('Trả lại','kh1.transfer(\''+(q?'ktPM':W.pm(r))+'\')',true,'khptm-danger');
    if(W.canIssue(r,a))html+=button('Ban hành','kh1.issue()',true,'khptm-emphasis');
    if(W.allowed(r,a).length)html+=button('Chuyển','kh1.transfer()',true,'khptm-emphasis');if(r.kind==='GNV')html+=button('Hồ sơ hướng dẫn nguồn','kh1.open(\''+r.source.id+'\')');return html;}
  function render(){const r=current();if(!r)return;if(W.canEdit(r,r.viewer)&&r.phase!=='IMPORT')run(()=>W.prepare(r,r.viewer));ensureArtifacts(r);
    page.querySelector('.titlebar h1').textContent=r.kind==='GNV'?'Lập, trình VB GNV phối hợp XD KHPTM TCT':'Thông báo/Hướng dẫn KHPTM';
    document.getElementById('khptmTopActions').innerHTML=actions(r);const sel=document.getElementById('khptmRole');sel.innerHTML=W.roleKeys(r).map(a=>'<option value="'+a+'"'+(a===r.viewer?' selected':'')+'>'+W.roles[a]+'</option>').join('');
    syncHeader();
    let context=document.getElementById('kh1Context');if(!context){context=document.createElement('span');context.id='kh1Context';context.className='right-note';sel.parentElement.appendChild(context);}const receipt=W.receiptFor(r,r.viewer);
    context.textContent=receipt?'Người chuyển: '+(W.roles[receipt.from]||'Khởi tạo')+' · '+(purposeNames[receipt.purpose]||state(r)):'Chưa được giao nhiệm vụ xử lý';
    const ids=['khptmPanelSpecialist','khptmPanelUnitLeader','khptmPanelLDTCT','khptmPanelClerk'];ids.forEach(id=>{document.getElementById(id).innerHTML='';document.getElementById(id).classList.remove('active');});
    const q=W.requestTask(r,r.viewer),isPM=['tdPM','ktPM'].includes(r.viewer)&&!q,clerk=['tdClerk','tctClerk'].includes(r.viewer);
    const target=isPM?'khptmPanelSpecialist':clerk?'khptmPanelClerk':['ktLead','tdBanLead'].includes(r.viewer)?'khptmPanelUnitLeader':'khptmPanelLDTCT';
    let html=isPM?form(r):section('Preview văn bản','<div class="khptm-doc-preview"><div class="khptm-paper">'+(q?infoPaper(q.receipt.purpose==='CONSULT_REVIEW'?r.files.find(f=>f.id===q.response?.files.at(-1))?.data||{issuer:'Ban KT',recipient1:'Tập đoàn',period:r.data.year,content:q.response?.text,scope:r.data.types.join(' · ')}:q.requestDocument.data,q.receipt.purpose==='CONSULT_REVIEW'?'supply':'request'):W.canReceive(r,r.viewer)?mainPaper(r,(r.viewer==='tdBanLead'&&r.kind==='GUIDANCE'||r.viewer==='ktLead'&&r.kind==='GNV')?'submission':'outgoing'):'<p>Vai trò này chưa được chuyển hồ sơ để xử lý.</p>')+'</div></div>');
    if(clerk&&W.owns(r,r.viewer)&&(W.canIssue(r,r.viewer)||r.issue.issued))html=section('Văn bản ban hành','<div class="khptm-note"><b>Văn bản:</b> '+esc(guidanceLabel(r))+'</div><div class="khptm-issue-grid" style="margin-bottom:12px">'+issueFields(r)+'</div><div class="khptm-doc-preview"><div class="khptm-paper" id="kh1ClerkPaper">'+mainPaper(r,'outgoing')+'</div></div><div class="khptm-output"><b>Trạng thái:</b> '+esc(r.issue.issued?'Đã ban hành':W.signatureValid(r,r.guidance)?'Đã ký số – chờ ban hành':'Chờ lãnh đạo ký')+'</div>');
    document.getElementById(target).innerHTML=html+'<div id="kh1Feedback" hidden></div>';document.getElementById(target).classList.add('active');renderExtended(r);renderList();}
  function fileRow(f,i,r){const generated=['guidance','gnv','submission'].includes(f.kind),issuer=f.source?'Tập đoàn':f.author?W.roles[f.author].replace(/^PM /,''):r.kind==='GNV'?'VNPT Net':'Tập đoàn',number=f.source?r.source.issue.number:f===r.guidance&&r.issue.issued?r.issue.number:f.number||'';
    return '<tr><td>'+(i+1)+'</td><td class="center">'+(f.signed?'☒':'☐')+'</td><td class="center"><input type="checkbox" checked disabled></td><td class="center"><input type="checkbox" '+(generated&&!f.source?'checked ':'')+'disabled></td><td class="center"><input type="checkbox" '+(!generated||f.source?'checked ':'')+'disabled></td><td>'+esc(number||'Chưa cấp số')+'</td><td>'+esc(f===r.guidance?r.issue.eoffice||'':'')+'</td><td>'+esc(issuer)+'</td><td>'+esc(W.roles[f.signer]||f.signerName||'--')+'</td><td>'+esc(f.source?'Hướng dẫn TĐ căn cứ':(f.kind==='guidance'?guidanceLabel(r):f.kind==='submission'?r.kind==='GNV'?'Tờ trình LĐ TCT':'Tờ trình LĐ TĐ':({gnv:'VB GNV TCT',request:'VB yêu cầu góp ý',response:'VB phản hồi ý kiến'})[f.kind])||f.group||'Hồ sơ liên quan')+'</td><td><span class="pm-ext-file" onclick="kh1.previewFile(\''+f.id+'\')">'+esc(f.name)+'</span></td><td>'+esc(W.roles[f.author||W.pm(r)])+'</td><td>'+esc(f.time||'')+'</td><td></td><td></td><td>'+button('Xem',"kh1.previewFile('"+f.id+"')",true,'pm-ext-action')+' <a class="pm-ext-action" download="'+esc(f.name)+'" href="'+esc(f.url||'#')+'">Tải</a></td></tr>';}
  function uploadRow(r){if(!sharedUpload)return '';const table=sharedUpload.cloneNode(true),row=table.querySelector('tbody tr');row.cells[0].querySelector('input').disabled=true;
    row.querySelector('input[type=file]').id='kh1Upload';row.cells[5].querySelector('select').innerHTML='<option>Hồ sơ liên quan</option><option>VB TĐ đã ban hành</option>'+(W.canSign(r,r.viewer)?'<option>Văn bản đã ký</option>':'');row.querySelector('.linklike').setAttribute('onclick',"document.getElementById('kh1Upload').value=''");
    return table.outerHTML+'<div class="pm-ext-add-links">'+(W.canEdit(r,r.viewer)&&r.phase!=='IMPORT'?'<span onclick="kh1.save()">Thêm file từ template</span>':'')+'<span onclick="document.getElementById(\'kh1Upload\').click()">Thêm File</span><span onclick="kh1.saveUpload()">Lưu tài liệu</span></div>';}
  function renderExtended(r){const host=document.getElementById('khptmExtended'),table=sharedFileTable.cloneNode(true);table.querySelector('tbody').innerHTML=visibleFiles(r).map((f,i)=>fileRow(f,i,r)).join('');const d=draft(r),leader=['tdBanLead','tdLeader','ktLead','tctLeader'].includes(r.viewer),active=r.tab||(['tdPM','ktPM'].includes(r.viewer)?'files':'exchange');
    const request=W.canEdit(r,r.viewer)&&r.kind==='GUIDANCE'&&r.mode==='TD'&&!r.requests.some(q=>q.status!=='DONE'),supply=W.canProvide(r,r.viewer);
    host.innerHTML='<div class="pm-ims-extended"><span class="pm-ext-caption">Thông tin mở rộng</span>'+(request?button('Tạo VB yêu cầu góp ý / cung cấp thông tin',"kh1.info('request')"):supply?button('Tạo VB phản hồi',"kh1.info('supply')"):'')+
      '<div class="pm-ext-tabs">'+[['files','Tài liệu đính kèm'],['route','Lịch sử luân chuyển'],['exchange','Lịch sử trao đổi']].map(([name,label])=>'<div class="pm-ext-tab '+(active===name?'active':'')+'" data-kh1-ext="'+name+'" onclick="kh1.tab(\''+name+'\')">'+label+'</div>').join('')+'</div>'+ 
      '<div id="khptmExtFiles" class="pm-ext-pane '+(active==='files'?'active':'')+'">'+table.outerHTML+(canUpload(r)?uploadRow(r):'')+'</div>'+
      '<div id="khptmExtRoute" class="pm-ext-pane '+(active==='route'?'active':'')+'"><div class="history-list">'+r.history.map(x=>'<div class="history-item"><div class="time">'+esc(x.time)+'</div><div class="actor">'+esc(x.actor)+'</div><div>'+esc(x.text)+'</div></div>').join('')+'</div></div>'+
      '<div id="khptmExtExchange" class="pm-ext-pane '+(active==='exchange'?'active':'')+'">'+r.exchange.map(x=>'<div class="exchange-item"><div class="meta">'+esc(x.actor)+' · '+esc(x.time)+'</div><div style="white-space:pre-wrap">'+esc(x.text)+'</div>'+x.files.map(id=>button('Xem file đính kèm: '+(r.files.find(f=>f.id===id)?.name||id),"kh1.previewFile('"+id+"')",true,'pm-ext-action')).join('')+'</div>').join('')+
      (W.canReceive(r,r.viewer)?'<div class="toolbar" style="margin-top:8px;align-items:flex-end"><div style="flex:1"><textarea id="khptmQuickExchange" placeholder="'+(leader?'Nhập ý kiến xử lý...':'Nhập nội dung trao đổi...')+'" style="min-height:70px" oninput="kh1.remember()">'+esc(d.text)+'</textarea><div style="margin-top:6px">'+button('☁ Tải tệp lên',"document.getElementById('kh1ExchangeUpload').click()")+'<input id="kh1ExchangeUpload" type="file" style="display:none" onchange="kh1.exchangeUpload(this)"><span class="mini"> '+(d.attachments.map(id=>esc(r.files.find(f=>f.id===id)?.name||id)).join(' · ')||'Chưa chọn tệp')+'</span></div></div>'+button(leader?'Gửi ý kiến':'Gửi','kh1.sendExchange()',true,'primary')+'</div>':'')+'</div></div>';}
  function tab(name){remember();const r=current();r.tab=name;['files','route','exchange'].forEach(n=>{document.getElementById('khptmExt'+n[0].toUpperCase()+n.slice(1)).classList.toggle('active',n===name);page.querySelector('[data-kh1-ext="'+n+'"]').classList.toggle('active',n===name);});}
  function saveUpload(){run(()=>{const r=current();if(!canUpload(r))throw Error('Chưa được giao thêm tài liệu');const row=page.querySelector('.pm-ext-add-table tbody tr'),file=row?.querySelector('input[type=file]').files[0];if(!file)throw Error('Chọn file để lưu');
    const f={id:r.id+'-upload-'+Date.now(),name:file.name,blob:file,url:URL.createObjectURL(file),mime:file.type,author:r.viewer,time:now(),group:row.cells[5].querySelector('select').value,number:row.cells[6].querySelector('input').value,date:row.cells[7].querySelector('input').value,signerName:row.cells[9].querySelector('input').value,requestId:W.requestTask(r,r.viewer)?.id};
    if(W.canSign(r,r.viewer)&&f.group==='Văn bản đã ký')W.sign(r,r.viewer,f);else r.files.push(f);log(r,'Lưu tài liệu '+file.name);render();notify('Đã lưu tài liệu');});}
  function exchangeUpload(input){const r=current();if(!W.canReceive(r,r.viewer))return;remember();const file=input.files[0];if(!file)return;const f={id:r.id+'-exchange-'+Date.now(),name:file.name,blob:file,url:URL.createObjectURL(file),mime:file.type,author:r.viewer,requestId:W.requestTask(r,r.viewer)?.id};r.files.push(f);draft(r).attachments.push(f.id);renderExtended(r);}
  function sendExchange(){run(()=>{const r=current();remember();if(!W.canReceive(r,r.viewer))throw Error('Bạn chưa nhận hồ sơ');const d=draft(r);if(!d.text.trim()&&!d.attachments.length)throw Error('Nhập nội dung hoặc đính kèm tài liệu');
    if(W.canProvide(r,r.viewer))W.saveResponse(r,r.viewer,d.text.trim(),d.attachments);r.exchange.unshift({actor:W.roles[r.viewer],text:d.text.trim(),files:d.attachments.slice(),time:now()});r.drafts[r.viewer]={text:'',attachments:[]};log(r,'Gửi ý kiến / trao đổi');render();notify('Đã lưu trao đổi kèm tài liệu');});}
  function info(kind){run(()=>{const r=current(),a=r.viewer,q=W.requestTask(r,a),snapshot=W.receiptFor(r,a);if(kind==='request'&&!W.canEdit(r,a)||kind==='supply'&&!W.canProvide(r,a))throw Error('Chưa được giao tạo VB này');remember();
    const data=kind==='request'?{issuer:'Tập đoàn Bưu chính Viễn thông Việt Nam',unit:'Ban KT',year:r.data.year,scope:r.data.types.join(' · '),content:'Góp ý nguyên tắc, định hướng cấu trúc và nội dung hướng dẫn xây dựng KHPTM năm '+r.data.year+'.',deadline:r.data.deadline,date:today()}:{issuer:'Ban KT – VNPT NET',recipient1:'Tập đoàn Bưu chính Viễn thông Việt Nam',period:r.data.year,scope:r.data.types.join(' · '),content:q.response?.text||'',date:today()};
    khInfo.openFor({kind,code:'2.1',key:r.id+'/'+a+'/'+(q?.id||''),data,units:kind==='request'?['Ban KT']:undefined,receipt:{sender:W.roles[snapshot.from],unit:'Ban KT'},
      formTitle:kind==='request'?'Tạo VB yêu cầu góp ý / cung cấp thông tin':'Tạo VB phản hồi',templateLabel:kind==='request'?'Xin ý kiến Ban KT về hướng dẫn nguyên tắc, cấu trúc KHPTM':'Phản hồi ý kiến Ban KT về hướng dẫn XD KHPTM',
      fields:kind==='request'?[['unit','Đơn vị cần cung cấp ý kiến'],['year','Năm KHPTM'],['scope','Phạm vi / mảng KHPTM'],['content','Nội dung yêu cầu','textarea'],['deadline','Hạn phản hồi','date']]:[['recipient1','Đơn vị nhận'],['period','Năm KHPTM'],['scope','Phạm vi / mảng KHPTM'],['content','Ý kiến phản hồi','textarea']],
      renderHTML:(data,kind)=>infoPaper(data,kind),canEdit:()=>current()===r&&r.viewer===a&&W.receiptFor(r,a)===snapshot&&(kind==='request'?W.canEdit(r,a):W.canProvide(r,a)),
      onSave:(data,kind)=>{const f=W.storeConsult(r,a,kind,data);ensureArtifacts(r);const d=draft(r);d.attachments.push(f.id);d.text=data.content;closeKHPTM2InfoModal();r.tab='exchange';render();notify('Đã gắn VB vào trao đổi; nhấn Gửi để lưu phản hồi');}});});}
  function sign(){run(()=>{const r=current();W.sign(r,r.viewer);log(r,'Ký '+(['ktLead','tdBanLead'].includes(r.viewer)?'Tờ trình':r.kind==='GNV'?'VB GNV TCT':'VB hướng dẫn TĐ'));render();notify('Đã ký văn bản (demo)');});}
  function approve(){run(()=>{const r=current();W.approve(r,r.viewer);log(r,'Duyệt ý kiến Ban KT');render();notify('Đã duyệt phản hồi');});}
  function issue(){run(()=>{const r=current();rememberIssue();W.issue(r,r.viewer,{...r.issueDraft,serial:r.issueDraft?.number,number:r.issueDraft?.number?issueNumber(r):''});if(r.kind==='GNV')W.linkAssignment(records.get(r.source.id),r);log(r,'Ban hành '+r.issue.number);render();notify('Đã ban hành; dùng Chuyển để gửi người nhận');});}
  function recordExternal(){run(()=>{const r=current();W.save(r,r.viewer,readForm());rememberIssue();const file=r.files.filter(f=>f.group==='VB TĐ đã ban hành').at(-1);W.recordExternal(r,r.viewer,{...r.issueDraft,confirmed:document.getElementById('kh1ExternalConfirmed')?.checked},file);log(r,'Ghi nhận hướng dẫn TĐ đã ký/ban hành ngoài hệ thống');render();notify('Đã ghi nhận văn bản TĐ; có thể Giao nhiệm vụ');});}
  function transferRow(f,r){const row=sharedTransferRow.cloneNode(true);row.removeAttribute('id');const buttons=Array.from(row.querySelectorAll('button'));buttons.filter(b=>/openInitialSignModal|openDigitalSignModal/.test(b.getAttribute('onclick')||'')).forEach(b=>b.remove());
    buttons[0].setAttribute('onclick',"this.parentElement.querySelector('input').checked=false;this.closest('.route-file-line').style.display='none'");buttons[1].setAttribute('onclick',"kh1.previewFile('"+f.id+"')");const link=document.createElement('a');link.className=buttons[2].className;link.textContent=buttons[2].textContent;link.href=f.url||'#';link.download=f.name;buttons[2].replaceWith(link);
    const check=row.querySelector('input');check.checked=true;check.setAttribute('checked','');check.dataset.kh1TransferFile=f.id;row.querySelector('.route-file-name').textContent=f.name+' (Người gửi: '+W.roles[r.viewer]+')';
    return '<div class="route-file-line"><div class="route-file-label">'+esc(f.source?'Hướng dẫn TĐ căn cứ':f.kind==='guidance'?guidanceLabel(r):f.kind==='submission'?r.kind==='GNV'?'Tờ trình LĐ TCT':'Tờ trình LĐ TĐ':({gnv:'VB GNV TCT',request:'VB yêu cầu góp ý',response:'VB phản hồi'})[f.kind]||'Văn bản liên quan')+'</div><div class="route-file-main">'+row.outerHTML+'</div></div>';}
  function transfer(preset){run(()=>{const r=current();remember();if(W.canEdit(r,r.viewer)&&r.phase!=='IMPORT'){W.save(r,r.viewer,readForm());W.prepare(r,r.viewer);ensureArtifacts(r);}
    const allowed=W.allowed(r,r.viewer);if(!allowed.length)throw Error('Chưa có hướng chuyển theo nhiệm vụ');const q=W.requestTask(r,r.viewer),panel=document.getElementById('routePanelFiles'),box=document.getElementById('transferModal');
    modal={id:r.id,actor:r.viewer,receipt:W.receiptFor(r,r.viewer),revision:r.revision,requestId:q?.id,responseRevision:q?.responseRevision,
      filesHtml:panel.innerHTML,cfg:currentTransferCfg,action:pendingTransferAction,classes:box.className,summary:box.querySelector('.route-opinion-summary').innerHTML,receiverHtml:document.getElementById('routeRecipientRows').innerHTML};
    pendingTransferAction='kh1Transfer';const files=visibleFiles(r);modal.files=files;const request=files.filter(f=>f.infoKind==='request').at(-1),unused=request&&!r.requests.some(q=>q.requestDocument.id===request.id);
    currentTransferCfg={main:preset&&allowed.includes(preset)?preset:q?.receipt.purpose==='CONSULT_REVIEW'&&q.approvedRevision===q.responseRevision&&allowed.includes('tdPM')?'tdPM':unused&&allowed.includes('ktLead')?'ktLead':allowed[0],co:[],send:[],allowed:allowed.slice(),
      rolePermissions:{main:allowed.slice(),co:r.kind==='GNV'&&r.viewer==='tctClerk'&&r.issue.issued?allowed.slice():[],view:q?[]:W.roleKeys(r).filter(a=>a!==r.viewer)}};
    box.classList.add('kh4-route');panel.innerHTML=files.map(f=>transferRow(f,r)).join('');box.querySelector('.route-opinion-summary').innerHTML='<div><b>Tổng hợp ý kiến</b></div>'+r.exchange.map(x=>'<div class="route-opinion-row"><b>'+esc(x.actor)+'</b><div class="mini">'+esc(x.text)+'</div></div>').join('');
    document.getElementById('transferNote').value=draft(r).text||q?.response?.text||q?.receipt.note||'';document.getElementById('routeReceiverSearch').value='';renderRouteRecipients();switchRouteTab('files');box.classList.add('show');});}
  const beforeRecipients=renderRouteRecipients;
  renderRouteRecipients=function(){if(pendingTransferAction!=='kh1Transfer')return beforeRecipients.apply(this,arguments);const cfg=currentTransferCfg,query=(document.getElementById('routeReceiverSearch').value||'').toLowerCase(),candidates=Array.from(new Set(Object.values(cfg.rolePermissions).flat()));
    document.getElementById('routeRecipientRows').innerHTML=candidates.filter(a=>W.roles[a].toLowerCase().includes(query)).map(a=>'<tr data-rid="kh1_'+a+'"><td><b>'+esc(W.roles[a])+'</b><div class="mini">'+esc(W.roles[a])+'</div></td>'+[['main','radio',cfg.main===a],['co','checkbox',cfg.co.includes(a)],['view','checkbox',cfg.send.includes(a)]].map(([kind,type,checked])=>'<td class="center"><input type="'+type+'" '+(type==='radio'?'name="routeMain" ':'class="'+(kind==='co'?'routeCo':'routeView')+'" ')+'value="kh1_'+a+'"'+(checked?' checked':'')+(!cfg.rolePermissions[kind].includes(a)?' disabled':'')+' onchange="routeRoleChanged(\'kh1_'+a+'\',\''+kind+'\')"></td>').join('')+'</tr>').join('');updateRouteSelectedList();};
  const beforeSelected=selectedRouteRecipients;
  selectedRouteRecipients=function(){if(pendingTransferAction!=='kh1Transfer')return beforeSelected.apply(this,arguments);const cfg=currentTransferCfg,actor=a=>({id:'kh1_'+a,name:W.roles[a],title:W.roles[a],unit:W.roles[a].replace(/^PM |^LĐ /,'')});return {main:cfg.main?actor(cfg.main):null,co:cfg.co.map(actor),view:cfg.send.map(actor)};};
  const beforeChanged=routeRoleChanged;
  routeRoleChanged=function(id,kind){if(pendingTransferAction!=='kh1Transfer')return beforeChanged.apply(this,arguments);const a=id.replace(/^kh1_/,''),cfg=currentTransferCfg,input=document.querySelector('#routeRecipientRows tr[data-rid="'+id+'"] '+(kind==='main'?'input[type=radio]':kind==='co'?'.routeCo':'.routeView'));if(!input||input.disabled||!cfg.rolePermissions[kind].includes(a))return;
    const checked=input.checked;if(cfg.main===a)cfg.main='';cfg.co=cfg.co.filter(x=>x!==a);cfg.send=cfg.send.filter(x=>x!==a);if(checked){if(kind==='main')cfg.main=a;else cfg[kind==='co'?'co':'send'].push(a);}renderRouteRecipients();};
  const beforeHide=hideTransferModal;
  hideTransferModal=function(){const snap=modal;modal=null;const result=beforeHide.apply(this,arguments);if(snap){document.getElementById('routePanelFiles').innerHTML=snap.filesHtml;currentTransferCfg=snap.cfg;pendingTransferAction=snap.action;const box=document.getElementById('transferModal');box.className=snap.classes.replace(/\bshow\b/g,'').trim();box.querySelector('.route-opinion-summary').innerHTML=snap.summary;document.getElementById('routeRecipientRows').innerHTML=snap.receiverHtml;document.getElementById('routeOpinionFile').value='';}return result;};
  const beforeConfirm=confirmTransferFromModal;
  confirmTransferFromModal=function(){if(pendingTransferAction!=='kh1Transfer')return beforeConfirm.apply(this,arguments);run(()=>{const r=current(),snap=modal,q=W.requestTask(r,r.viewer);if(!snap||snap.id!==r.id||snap.actor!==r.viewer||snap.revision!==r.revision||snap.receipt!==W.receiptFor(r,r.viewer)||snap.requestId!==q?.id||snap.responseRevision!==q?.responseRevision)throw Error('Hồ sơ / nhiệm vụ đã thay đổi, mở lại popup Chuyển');
    const selected=selectedRouteRecipients(),to=selected.main?.id.replace(/^kh1_/,'');if(!to){switchRouteTab('receiver');throw Error('Chọn 01 người xử lý chính');}
    const detail={note:document.getElementById('transferNote').value.trim(),files:Array.from(document.querySelectorAll('[data-kh1-transfer-file]:checked'),el=>el.dataset.kh1TransferFile),co:selected.co.map(x=>x.id.replace(/^kh1_/,'')),view:selected.view.map(x=>x.id.replace(/^kh1_/,''))};
    const actor=W.roles[r.viewer],receipt=W.transfer(r,r.viewer,to,detail);log(r,'Chuyển tới '+W.roles[to]+' · '+(purposeNames[receipt.purpose]||'')+(detail.note?' · '+detail.note:''),actor,receipt);
    const opinion=document.getElementById('routeOpinionFile').files[0],attached=[];if(opinion){const f={id:r.id+'-opinion-'+Date.now(),name:opinion.name,mime:opinion.type,blob:opinion,url:URL.createObjectURL(opinion),author:snap.actor};r.files.push(f);attached.push(f.id);}
    if(detail.note||attached.length)r.exchange.unshift({actor,text:detail.note,files:attached,time:now()});r.drafts[snap.actor]={text:'',attachments:[]};hideTransferModal();r.tab=['tdPM','ktPM'].includes(r.viewer)?'files':'exchange';render();window.scrollTo({top:0,behavior:'smooth'});notify('Đã chuyển đúng người nhận đã chọn');});};
  function seed(){const r=W.create('HD-MAU-2027');records.set(r.id,r);const external=W.create('HD-NGOAI-MAU-2027','EXTERNAL');
    const f={name:'Huong_dan_KHPTM_TD_2027_mau.docx',demo:true};W.recordExternal(external,'ktPM',{number:'HD-KHPTM-2027 (mẫu)',date:'2026-09-30',eoffice:'',recipients:'Ban KT – VNPT NET',confirmed:true},f);records.set(external.id,external);log(external,'Văn bản mẫu đã ban hành; dùng để thử Giao nhiệm vụ','Hệ thống');}
  window.kh1={open,create,openList,reset,setRole,mode,fieldChanged,typesChanged,save,assignment,preview,previewRecord,previewFile,rememberIssue,takeNumber,saveUpload,exchangeUpload,remember,sendExchange,info,sign,approve,issue,recordExternal,tab,transfer};
  window.openKHPTMModule=openList;window.openKHPTMCreate=create;window.openKHPTMProcess=id=>open(id==='K1'?'HD-MAU-2027':id==='DONE'?'HD-NGOAI-MAU-2027':id);
  window.resetKHPTMFlow=reset;window.switchKHPTMRole=setRole;window.renderKHPTM=render;window.openKHPTMPreview=preview;window.openKhptmTransfer=transfer;
  window.sendKHPTMExchange=sendExchange;window.issueKHPTM=issue;window.khptmSignByLDTCT=sign;window.khptmSignSubmissionByUnitLeader=sign;
  seed();renderList();
})();
