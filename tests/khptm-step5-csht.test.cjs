const {test}=require('node:test');
const assert=require('node:assert/strict');
const W=require('../khptm-step5.js');
const T=require('../khptm-csht-template.js');
const D=require('../khptm-demo-data.js');
const basis={id:'KH-CSHT',type:'CSHT',year:2027,title:'KHPTM CSHT năm 2027',number:'1086',date:'2026-09-29',decision:{signed:true,issued:true}};
const make=()=>W.create(basis,'PAKT-CSHT');
function prepare(r){W.installPair(r,'pm',['report','catalog'].map(docType=>({id:docType+'-'+r.revision,docType,revision:r.revision,generated:true})));r.submission={id:'submission-'+r.revision,docType:'submission',revision:r.revision,signatures:[]};}
const detail=(r,note='Đề nghị thực hiện',files)=>({note,files:files||[r.basis.id+'-basis',r.submission?.id,...r.files.map(f=>f.id)].filter(Boolean),co:[],view:[]});
function requestDocument(r,unit='Đơn vị trực thuộc',content='Rà soát nguồn, điều hòa, mặt bằng node chính'){
 return W.storeInfoDocument(r,'pm','request','2.2',{issuer:'Ban KT',unit,content,deadline:'2026-10-15',year:'2027',planBasis:'QĐ 1086',location:'Hà Nội'}, {html:content});
}
function reviewTask(to='pmUnit'){const r=make(),f=requestDocument(r);const {request:q}=W.transfer(r,'pm',to,detail(r));return {r,f,q};}
function response(r,q){const f=W.storeInfoDocument(r,q.pm,'supply','2.2',{issuer:q.unit,recipient1:'Ban KT',period:'2027',content:'Hiện trạng nguồn và điều hòa',proposal:'Bổ sung nguồn dự phòng'},{});W.saveResponse(r,q.pm,'Bổ sung nguồn dự phòng',[f.id]);return f;}
function completeDirect(){const {r,q}=reviewTask();const f=response(r,q);W.transfer(r,q.pm,'pm',detail(r,'Kết quả rà soát',[...q.receipt.files,f.id]));return r;}
test('Có một căn cứ CSHT, dùng lại role và không thêm đơn vị trực thuộc vào ba loại cũ',()=>{
 assert.equal(D.plans.filter(p=>p.type==='CSHT').length,1);assert.deepEqual(D.plans.map(p=>p.type),[...W.types,'CSHT']);
 const r=make();assert.ok(W.roleKeys(r).includes('pmUnit'));assert.ok(!W.roleKeys(r).includes('khdt'));
 for(const type of W.types){const old=W.create({...basis,type},type);assert.deepEqual(W.providersFor(old),W.providers);assert.ok(!W.roleKeys(old).includes('leadUnit'));assert.ok(!W.allowed(old,'pm').includes('pmKTM'));assert.throws(()=>W.transfer(old,'pm','pmUnit',detail(old)));}
});
for(const p of W.providersFor(make()))for(const to of [p.pm,p.lead])test('PM Ban KT chuyển xử lý chính trực tiếp tới '+W.roles[to],()=>{
 const r=make();if(p===W.cshtUnit)requestDocument(r);
 assert.ok(W.allowed(r,'pm').includes(to));const {request:q}=W.transfer(r,'pm',to,detail(r));
 assert.equal(q.receipt.from,'pm');assert.equal(q.receipt.to,to);assert.equal(W.owns(r,to),true);assert.equal(W.canApproveData(r,to),false);
 assert.equal(W.canProvide(r,to),to===p.pm);assert.equal(q.receipt.purpose,to===p.pm?'DATA_WORK':'DATA_ASSIGN');
});
test('5.1/5.2 tùy chọn: đi thẳng 5.3, phản hồi 5.4, tổng hợp 5.5',()=>{
 const r=completeDirect();assert.equal(r.requests.length,1);assert.equal(r.csht.stage,'SCALE');assert.equal(W.canEdit(r,'pm'),true);assert.ok(W.completedCSHTReview(r));
 prepare(r);W.transfer(r,'pm','lead',detail(r));assert.ok(W.canApprove(r,'lead'));W.approve(r,'lead');W.transfer(r,'lead','pm',detail(r));
 assert.equal(r.receipt.purpose,'RESULT');assert.ok(W.canHandoffStep8(r,'pm'));
 W.transfer(r,'pm','khdt',detail(r));assert.equal(r.csht.stage,'STEP8');assert.equal(r.nextStep.step,8);assert.equal(r.nextStep.revision,r.revision);assert.equal(r.receipt.purpose,'STEP8_ASSIGNMENT');assert.ok(W.roleKeys(r).includes('khdt'));assert.equal(W.canApprove(r,'khdt'),false);
});
test('5.3 cần đúng VB yêu cầu gửi đơn vị, không bắt duyệt trước hoặc bộ tờ trình',()=>{
 const r=make();assert.ok(W.allowed(r,'pm').includes('pmUnit'));assert.throws(()=>W.transfer(r,'pm','pmUnit',detail(r)),/VB yêu cầu/);assert.equal(r.requests.length,0);
 const f=requestDocument(r);const {request:q}=W.transfer(r,'pm','pmUnit',detail(r,'Yêu cầu',[f.id]));assert.equal(q.requestDocumentId,f.id);assert.equal(r.csht.requestApproval,undefined);
 f.document.content='Đã thay bên nguồn';assert.equal(q.documents.find(x=>x.id===f.id).document.content,'Rà soát nguồn, điều hòa, mặt bằng node chính');
});
test('Trình LĐ Ban KT duyệt yêu cầu là hướng chọn, trả PM xong vẫn gửi trực tiếp PM đơn vị',()=>{
 const r=make(),f=requestDocument(r);W.transfer(r,'pm','lead',detail(r));assert.ok(W.canApprove(r,'lead'));assert.equal(r.receipt.purpose,'CSHT_REQUEST_REVIEW');
 W.approve(r,'lead');assert.ok(W.approvedCSHTRequest(r));W.transfer(r,'lead','pm',detail(r));assert.ok(W.canEdit(r,'pm'));assert.ok(W.allowed(r,'pm').includes('pmUnit'));
 W.transfer(r,'pm','pmUnit',detail(r));assert.equal(W.canProvide(r,'pmUnit'),true);assert.equal(r.csht.stage,'REVIEW');
});
test('Duyệt yêu cầu khóa nguồn, tài liệu và phiên bản; trả sửa rồi trình lại',()=>{
 const r=make(),f=requestDocument(r);W.transfer(r,'pm','lead',detail(r));r.receipt.from='leadUnit';assert.equal(W.canApprove(r,'lead'),false);r.receipt.from='pm';
 f.document.content='Thay sau khi chuyển';assert.equal(W.canApprove(r,'lead'),false);W.transfer(r,'lead','pm',detail(r,'Bổ sung yêu cầu'));
 const next=requestDocument(r,'Đơn vị trực thuộc','Yêu cầu sửa');assert.equal(next.version,f.version+1);W.transfer(r,'pm','lead',detail(r));assert.ok(W.canApprove(r,'lead'));W.approve(r,'lead');assert.equal(W.canApprove(r,'lead'),false);
});
test('LĐ đơn vị nhận từ PM Ban KT chỉ chuyển/phân công; từ PM của mình mới duyệt',()=>{
 const {r,q}=reviewTask('leadUnit');assert.equal(W.canApproveData(r,'leadUnit'),false);assert.ok(W.allowed(r,'leadUnit').includes('pmUnit'));
 W.transfer(r,'leadUnit','pmUnit',detail(r,'Phân công',q.receipt.files));const f=response(r,q);W.transfer(r,'pmUnit','leadUnit',detail(r,'Trình kết quả',[...q.receipt.files,f.id]));
 assert.equal(W.canApproveData(r,'leadUnit'),true);assert.ok(!W.allowed(r,'leadUnit').includes('pm'));assert.throws(()=>W.transfer(r,'leadUnit','pm',detail(r,'Gửi',q.receipt.files)));
 W.approveData(r,'leadUnit');assert.ok(W.allowed(r,'leadUnit').includes('pm'));W.transfer(r,'leadUnit','pm',detail(r,'Gửi',q.receipt.files));assert.equal(r.csht.stage,'SCALE');
});
test('LĐ Ban KT nhận phản hồi từ PM đơn vị chỉ Chuyển, không Duyệt',()=>{
 const {r,q}=reviewTask();const f=response(r,q);W.transfer(r,'pmUnit','lead',detail(r,'Gửi LĐ Ban KT',[...q.receipt.files,f.id]));
 assert.equal(q.receipt.from,'pmUnit');assert.equal(q.receipt.purpose,'DATA_FORWARD');assert.equal(W.owns(r,'lead'),true);assert.equal(W.canApprove(r,'lead'),false);assert.equal(W.canApproveData(r,'lead'),false);assert.deepEqual(W.allowed(r,'lead'),['pm']);assert.throws(()=>W.approve(r,'lead'));
 W.transfer(r,'lead','pm',detail(r,'Chuyển PM KT tổng hợp',q.receipt.files));assert.equal(r.csht.stage,'SCALE');assert.equal(q.receipt.from,'lead');
});
test('LĐ Ban KT nhận từ LĐ đơn vị chỉ chuyển đúng kết quả đã duyệt về PM KT',()=>{
 const {r,q}=reviewTask();const f=response(r,q);W.transfer(r,'pmUnit','leadUnit',detail(r,'Trình',[...q.receipt.files,f.id]));W.approveData(r,'leadUnit');W.transfer(r,'leadUnit','lead',detail(r,'Gửi kết quả',q.receipt.files));
 assert.equal(W.canApprove(r,'lead'),false);assert.deepEqual(W.allowed(r,'lead'),['pm']);W.transfer(r,'lead','pm',detail(r,'Tổng hợp',q.receipt.files));assert.equal(q.approvedRevision,q.responseRevision);assert.equal(r.csht.stage,'SCALE');
});
test('LĐ đơn vị trả PM sửa: duyệt cũ không áp dụng cho phản hồi mới',()=>{
 const {r,q}=reviewTask();const f=response(r,q);W.transfer(r,'pmUnit','leadUnit',detail(r,'Trình',[...q.receipt.files,f.id]));W.approveData(r,'leadUnit');
 W.transfer(r,'leadUnit','pmUnit',detail(r,'Rà soát lại',q.receipt.files));assert.equal(q.approvedRevision,0);const next=response(r,q);assert.equal(next.version,f.version+1);
 W.transfer(r,'pmUnit','leadUnit',detail(r,'Trình lại',[...q.receipt.files,next.id]));assert.ok(!W.allowed(r,'leadUnit').includes('pm'));W.approveData(r,'leadUnit');W.transfer(r,'leadUnit','pm',detail(r,'Kết quả mới',q.receipt.files));assert.equal(r.csht.stage,'SCALE');
});
test('Đổi vai trò / sai nguồn / sai phiên bản không cấp quyền phản hồi hay duyệt',()=>{
 const {r,q}=reviewTask('leadUnit');r.viewer='pmUnit';assert.equal(W.canProvide(r,'pmUnit'),false);assert.throws(()=>W.saveResponse(r,'pmUnit','Sai nguồn',[]));
 W.transfer(r,'leadUnit','pmUnit',detail(r,'Phân công',q.receipt.files));response(r,q);W.transfer(r,'pmUnit','leadUnit',detail(r,'Trình',[...q.receipt.files,...q.response.files]));
 q.receipt.from='pmKTM';assert.equal(W.canApproveData(r,'leadUnit'),false);q.receipt.from='pmUnit';q.receipt.responseRevision--;assert.equal(W.canApproveData(r,'leadUnit'),false);
});
test('Không tráo tài liệu giữa các đơn vị; một đơn vị chỉ nhận một nhiệm vụ đang xử lý',()=>{
 const r=make();requestDocument(r);const d=detail(r);d.co=['leadUnit'];assert.throws(()=>W.transfer(r,'pm','pmUnit',d),/mỗi đơn vị/);assert.equal(r.requests.length,0);
 const {request:q}=W.transfer(r,'pm','pmUnit',detail(r));assert.ok(!W.allowed(r,'pm').includes('leadUnit'));assert.throws(()=>W.transfer(r,'pmUnit','pmKTM',detail(r,'Sai đơn vị',q.receipt.files)));
 const f={id:'file-other',infoRequestId:'OTHER'};r.files.push(f);assert.throws(()=>W.saveResponse(r,'pmUnit','Thay file',[f.id]));
});
test('Chờ đủ các yêu cầu đã chọn mới tổng hợp 5.5; optional không thành chặng bắt buộc',()=>{
 const r=make();requestDocument(r);const d=detail(r);d.co=['pmKTM'];const {request:q}=W.transfer(r,'pm','pmUnit',d);const other=r.requests.find(q=>q.pm==='pmKTM');
 response(r,q);W.transfer(r,'pmUnit','pm',detail(r,'Kết quả',[...q.receipt.files,...q.response.files]));assert.equal(r.csht.stage,'REVIEW');
 W.saveResponse(r,'pmKTM','Số liệu bổ sung',[]);W.transfer(r,'pmKTM','pm',detail(r,'Bổ sung',other.receipt.files));assert.equal(r.csht.stage,'SCALE');assert.equal(r.requests.length,2);
});
test('Duyệt đề xuất ban đầu không tự ép qua 5.1/5.2 hoặc khóa gửi trực tiếp',()=>{
 const r=make();prepare(r);W.transfer(r,'pm','lead',detail(r));W.approve(r,'lead');W.transfer(r,'lead','pm',detail(r));assert.equal(r.csht.stage,'PROPOSAL');assert.ok(W.canEdit(r,'pm'));assert.ok(W.allowed(r,'pm').includes('pmUnit'));
});
test('5.5 trả sửa quy mô, trình lại và chỉ chuyển bước 8 khi đủ hồ sơ đã duyệt',()=>{
 const r=completeDirect();prepare(r);assert.equal(W.canHandoffStep8(r,'pm'),false);W.transfer(r,'pm','lead',detail(r));W.transfer(r,'lead','pm',detail(r,'Bổ sung phạm vi'));
 assert.equal(r.csht.stage,'SCALE');W.saveDraft(r,'pm',{...r.data,location:'Hà Nội'},r.rows);prepare(r);W.transfer(r,'pm','lead',detail(r));W.approve(r,'lead');W.transfer(r,'lead','pm',detail(r));
 assert.throws(()=>W.transfer(r,'pm','khdt',detail(r,'Gửi bước8',[])));assert.ok(W.canHandoffStep8(r,'pm'));W.transfer(r,'pm','khdt',detail(r));assert.equal(r.nextStep.sourceId,r.id);assert.deepEqual(W.allowed(r,'pm'),[]);
});
test('Mẫu CSHT đúng ngữ cảnh, phản hồi có hiện trạng/đề xuất và giữ nội dung an toàn',()=>{
 const req=T.html({issuer:'Ban KT',unit:'Đơn vị trực thuộc',year:'2027',content:'Rà soát nguồn <script>',location:'Node chính',date:'2026-10-03'},'request');
 const res=T.html({issuer:'Đơn vị trực thuộc',recipient1:'Ban KT',period:'2027',content:'Nguồn hiện trạng',proposal:'Bổ sung điều hòa',date:'2026-10-03'},'supply',true);
 assert.match(req,/YÊU CẦU RÀ SOÁT HIỆN TRẠNG VÀ ĐỀ XUẤT CSHT/);assert.match(req,/&lt;script&gt;/);assert.match(res,/PHẢN HỒI KẾT QUẢ RÀ SOÁT VÀ ĐỀ XUẤT CSHT/);assert.match(res,/Bổ sung điều hòa/);assert.doesNotMatch(res,/cáp quang|SOP1-CQ|Số sợi|Hướng tuyến/);
});
test('Yêu cầu phối hợp vẫn được giao khi trình VB cho LĐ KT; kết quả trả về giao PM tổng hợp đúng nguồn',()=>{
 const r=make();requestDocument(r);const d=detail(r);d.co=['pmUnit'];const transferred=W.transfer(r,'pm','lead',d);
 assert.equal(r.requests.length,1);assert.equal(W.canProvide(r,'pmUnit'),true);assert.equal(W.canApprove(r,'lead'),true);
 const q=r.requests[0];response(r,q);W.transfer(r,'pmUnit','pm',detail(r,'Trả kết quả',[...q.receipt.files,...q.response.files]));assert.equal(r.receipt.from,'pmUnit');assert.ok(W.canEdit(r,'pm'));assert.equal(r.csht.stage,'SCALE');assert.equal(W.canApprove(r,'lead'),false);
});
