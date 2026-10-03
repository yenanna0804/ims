const {test}=require('node:test');
const assert=require('node:assert/strict');
const W=require('../khptm-step5.js');
const D=require('../khptm-demo-data.js');
const basis={id:'KH-CSHT',type:'CSHT',year:2027,title:'KHPTM CSHT năm 2027',number:'1086',date:'2026-09-29',decision:{signed:true,issued:true}};
const make=()=>W.create(basis,'PAKT-CSHT');
function prepare(r){
 W.installPair(r,'pm',['report','catalog'].map(docType=>({id:docType+'-'+r.revision,docType,revision:r.revision,generated:true})));
 r.submission={id:'submission-'+r.revision,docType:'submission',revision:r.revision,signatures:[]};
}
const detail=(r,note='Đề nghị thực hiện',files)=>({note,files:files || [r.basis.id+'-basis',r.submission?.id,...r.files.map(f=>f.id)].filter(Boolean),co:[],view:[]});
function requestStage(){const r=make();prepare(r);W.transfer(r,'pm','lead',detail(r));W.approve(r,'lead');W.transfer(r,'lead','pm',detail(r));return r;}
function requestDocument(r,content='Rà soát nguồn, điều hòa, mặt bằng node chính'){
 return W.storeInfoDocument(r,'pm','request','2.2',{unit:'Đơn vị trực thuộc',content,deadline:'2026-10-15'}, {html:content});
}
function dispatchStage(){const r=requestStage();const f=requestDocument(r);W.transfer(r,'pm','lead',detail(r));W.approve(r,'lead');W.transfer(r,'lead','pm',detail(r));return {r,f};}
function reviewTask(){const {r,f}=dispatchStage();const {request:q}=W.transfer(r,'pm','leadUnit',detail(r));return {r,f,q};}
function completeReview(r,q){
 W.transfer(r,'leadUnit','pmUnit',detail(r,'Phân công rà soát',q.receipt.files));
 W.saveResponse(r,'pmUnit','Bổ sung 01 hệ thống nguồn và 01 hệ thống điều hòa',[]);
 W.transfer(r,'pmUnit','leadUnit',detail(r,'Trình duyệt kết quả rà soát',q.receipt.files));
 W.approveData(r,'leadUnit');W.transfer(r,'leadUnit','pm',detail(r,'Gửi kết quả đã duyệt',q.receipt.files));
}
test('Có đúng một căn cứ mẫu CSHT; ba căn cứ cũ vẫn có mặt',()=>{
 assert.equal(D.plans.filter(p=>p.type==='CSHT').length,1);
 assert.deepEqual(D.plans.map(p=>p.type),[...W.types,'CSHT']);
 const r=make();assert.equal(r.csht.stage,'PROPOSAL');assert.ok(W.canEdit(r,'pm'));
});
test('Dùng chung actor; chỉ CSHT có PM/LĐ đơn vị trực thuộc',()=>{
 const csht=make();assert.ok(W.roleKeys(csht).includes('leadUnit'));assert.ok(W.roleKeys(csht).includes('pmUnit'));
 for(const type of W.types){const r=W.create({...basis,type},type);assert.deepEqual(W.providersFor(r),W.providers);assert.ok(!W.roleKeys(r).includes('leadUnit'));assert.ok(!W.viewAllowed(r,'pm').includes('leadUnit'));assert.throws(()=>W.transfer(r,'pm','leadUnit',detail(r)));assert.throws(()=>W.storeInfoDocument(r,'pm','request','2.2',{unit:'Đơn vị trực thuộc',content:'CSHT',deadline:'2026-10-15'},{}));}
});
test('CSHT đủ vòng: phương án → duyệt yêu cầu → đơn vị rà soát → tổng hợp → duyệt quy mô',()=>{
 const {r,f,q}=reviewTask();assert.equal(q.kind,'CSHT_REVIEW');assert.equal(q.requestDocumentId,f.id);assert.equal(q.requestApproval.actor,'lead');
 assert.equal(r.owner,'pm');assert.deepEqual(W.allowed(r,'pm'),[]);assert.equal(W.canEdit(r,'pm'),false);
 completeReview(r,q);assert.equal(q.status,'RETURNED');assert.equal(r.csht.stage,'SCALE');assert.equal(W.canEdit(r,'pm'),true);assert.equal(r.approval,null);assert.equal(r.submission,null);
 prepare(r);W.transfer(r,'pm','lead',detail(r));assert.equal(W.canApprove(r,'lead'),true);W.approve(r,'lead');W.transfer(r,'lead','pm',detail(r));
 assert.equal(r.receipt.purpose,'RESULT');assert.equal(W.canEdit(r,'pm'),false);assert.deepEqual(W.allowed(r,'pm'),[]);
 assert.ok(r.csht.proposalApproval);assert.ok(r.csht.requestApproval);assert.ok(r.approval);assert.equal(r.archive.length,2);
});
test('5.3 phải có văn bản yêu cầu, đúng nguồn PM và đúng phiên bản trước khi duyệt/gửi',()=>{
 const r=requestStage();assert.deepEqual(W.allowed(r,'pm'),[]);assert.throws(()=>W.transfer(r,'pm','leadUnit',detail(r)));
 const f=requestDocument(r);assert.deepEqual(W.allowed(r,'pm'),['lead']);assert.throws(()=>W.transfer(r,'pm','lead',detail(r,'Trình',[])));
 W.transfer(r,'pm','lead',detail(r));assert.equal(W.canApprove(r,'lead'),true);
 r.receipt.from='leadKTM';assert.equal(W.canApprove(r,'lead'),false);r.receipt.from='pm';
 f.document.content='Sửa sau khi trình';assert.equal(W.canApprove(r,'lead'),false);
 assert.throws(()=>W.transfer(r,'lead','leadUnit',detail(r)));
});
test('LĐ Ban KT trả yêu cầu sửa; phiên bản mới phải được duyệt lại',()=>{
 const r=requestStage(),f=requestDocument(r);W.transfer(r,'pm','lead',detail(r));
 assert.throws(()=>W.transfer(r,'lead','pm',detail(r,'')));W.transfer(r,'lead','pm',detail(r,'Bổ sung hạng mục điều hòa'));
 assert.equal(r.csht.stage,'REQUEST');assert.equal(W.canEdit(r,'pm'),true);
 const next=requestDocument(r,'Rà soát nguồn và điều hòa');assert.equal(next.version,f.version+1);
 W.transfer(r,'pm','lead',detail(r));W.approve(r,'lead');assert.equal(W.canApprove(r,'lead'),false);W.transfer(r,'lead','pm',detail(r));
 assert.equal(r.receipt.purpose,'CSHT_DISPATCH');assert.deepEqual(W.allowed(r,'pm'),['leadUnit']);assert.throws(()=>W.saveDraft(r,'pm',{...r.data,location:'Sửa'},r.rows));
 next.document.content='Thay nội dung đã duyệt';assert.equal(W.approvedCSHTRequest(r),false);assert.deepEqual(W.allowed(r,'pm'),[]);
});
test('Đổi role không cấp nhiệm vụ; đơn vị phải trình LĐ của mình và duyệt trước khi trả Ban KT',()=>{
 const {r,q}=reviewTask();r.viewer='pmUnit';assert.equal(W.canProvide(r,'pmUnit'),false);assert.equal(W.canApproveData(r,'leadUnit'),false);
 assert.throws(()=>W.saveResponse(r,'pmUnit','Chưa phân công',[]));assert.throws(()=>W.transfer(r,'leadUnit','pmKTM',detail(r,'Sai đơn vị',q.receipt.files)));
 W.transfer(r,'leadUnit','pmUnit',detail(r,'Phân công',q.receipt.files));W.saveResponse(r,'pmUnit','Số liệu ban đầu',[]);
 assert.throws(()=>W.transfer(r,'pmUnit','pm',detail(r,'Gửi tắt',q.receipt.files)));
 W.transfer(r,'pmUnit','leadUnit',detail(r,'Trình',q.receipt.files));assert.ok(!W.allowed(r,'leadUnit').includes('pm'));
 W.approveData(r,'leadUnit');W.transfer(r,'leadUnit','pmUnit',detail(r,'Kiểm tra lại',q.receipt.files));assert.equal(q.approvedRevision,0);
 W.saveResponse(r,'pmUnit','Số liệu cập nhật',[]);W.transfer(r,'pmUnit','leadUnit',detail(r,'Trình lại',q.receipt.files));assert.ok(!W.allowed(r,'leadUnit').includes('pm'));
 W.approveData(r,'leadUnit');W.transfer(r,'leadUnit','pm',detail(r,'Gửi đã duyệt',q.receipt.files));assert.equal(r.csht.stage,'SCALE');
});
test('Không gửi sang đơn vị khác hoặc bỏ tài liệu yêu cầu đã được duyệt',()=>{
 const {r,f}=dispatchStage();assert.throws(()=>W.transfer(r,'pm','leadKTM',detail(r)));assert.throws(()=>W.transfer(r,'pm','leadUnit',detail(r,'Gửi',[])));
 const {request:q}=W.transfer(r,'pm','leadUnit',detail(r));assert.notEqual(q.documents.find(x=>x.id===f.id).document,f.document);
 const snapshot=q.documents.find(x=>x.id===f.id).document.content;f.document.content='Nội dung bị thay bên nguồn';assert.equal(q.documents.find(x=>x.id===f.id).document.content,snapshot);
});
test('5.4 dùng Trao đổi và hồ sơ đính kèm, không dùng mẫu cung cấp cáp quang',()=>{
 const {r,q}=reviewTask();W.transfer(r,'leadUnit','pmUnit',detail(r,'Phân công',q.receipt.files));
 assert.throws(()=>W.storeInfoDocument(r,'pmUnit','supply','2.2',{issuer:q.unit,recipient1:'Ban KT',period:'2027'},{}),/Lịch sử trao đổi/);
 const file={id:'kq-csht.pdf',infoRequestId:q.id};r.files.push(file);W.saveResponse(r,'pmUnit','Rà soát nguồn và điều hòa tại node chính',[file.id]);
 W.transfer(r,'pmUnit','leadUnit',detail(r,'Trình kết quả',[...q.receipt.files,file.id]));W.approveData(r,'leadUnit');W.transfer(r,'leadUnit','pm',detail(r,'Kết quả đã duyệt',q.receipt.files));
 assert.equal(r.csht.stage,'SCALE');assert.deepEqual(q.response.files,[file.id]);
});
test('5.5 có vòng trả sửa quy mô, không quay lại phân công 5.4',()=>{
 const {r,q}=reviewTask();completeReview(r,q);prepare(r);W.transfer(r,'pm','lead',detail(r));W.transfer(r,'lead','pm',detail(r,'Bổ sung phạm vi quy mô'));
 assert.equal(r.csht.stage,'SCALE');assert.ok(W.canEdit(r,'pm'));W.saveDraft(r,'pm',{...r.data,location:'Node chính miền Bắc'},r.rows);
 assert.ok(!W.allowed(r,'pm').includes('leadUnit'));assert.equal(r.requests.length,1);prepare(r);W.transfer(r,'pm','lead',detail(r));W.approve(r,'lead');
 assert.equal(W.canSign(r,'lead'),false);assert.equal(W.canIssue(r,'tctClerk'),false);
});
for(const p of W.providers){test('CSHT 5.1/5.2: dùng lại '+p.unit+' và không cấp quyền rà soát node chính',()=>{
 const r=make();prepare(r);const {request:q}=W.transfer(r,'pm',p.lead,detail(r));assert.equal(q.kind,undefined);
 W.transfer(r,p.lead,p.pm,detail(r,'Phân công',q.receipt.files));W.saveResponse(r,p.pm,'Số liệu hiện trạng',[]);W.transfer(r,p.pm,p.lead,detail(r,'Trình duyệt',q.receipt.files));W.approveData(r,p.lead);W.transfer(r,p.lead,'pm',detail(r,'Gửi Ban KT',q.receipt.files));
 assert.equal(r.csht.stage,'PROPOSAL');assert.equal(W.completedCSHTReview(r),false);assert.equal(W.canEdit(r,'pm'),true);
});}
