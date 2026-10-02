const {test}=require('node:test');
const assert=require('node:assert/strict');
const W=require('../khptm-step5.js');
const make=type=>W.create({id:'KH-'+type,type,year:2027,title:'KHPTM '+type,decision:{signed:true,issued:true,html:'Quyết định đã ban hành'}},'PAKT-'+type);
const route=(r,note='Cung cấp số liệu hiện trạng',files=[r.basis.id+'-basis'])=>({note,files,co:[],view:['khdt']});
const requestDoc=(r,unit='Ban KTM')=>W.storeInfoDocument(r,'pm','request','2.2',{unit,content:'Cung cấp số liệu hiện trạng',deadline:'2026-10-15'},{name:'Yeu_cau.docx'});
for(const type of W.types){
 test(type+': văn bản yêu cầu và cung cấp theo đúng đơn vị, nhiệm vụ, phiên bản đã nhận',()=>{
  const r=make(type),doc=requestDoc(r),files=[r.basis.id+'-basis',doc.id];
  assert.throws(()=>W.storeInfoDocument(r,'pmKTM','supply','2.2',{issuer:'Ban KTM',recipient1:'Ban KT',period:'2027'},{}));
  assert.throws(()=>W.transfer(r,'pm','leadIT',route(r,'Yêu cầu sai đơn vị',files)));
  const {request:q}=W.transfer(r,'pm','leadKTM',route(r,'Yêu cầu số liệu',files));
  assert.equal(q.requestDocumentId,doc.id);assert.equal(q.requestDocumentVersion,1);
  const next=requestDoc(r);doc.document.content='Nội dung đã sửa sau khi chuyển';
  assert.equal(next.version,2);assert.equal(q.documents.find(f=>f.id===doc.id).document.content,'Cung cấp số liệu hiện trạng');
  W.transfer(r,'leadKTM','pmKTM',route(r,'Giao cung cấp số liệu',q.receipt.files));
  const response=W.storeInfoDocument(r,'pmKTM','supply','2.2',{issuer:'Ban KTM',recipient1:'Ban KT',period:'2027',lines:[{direction:'A – B',distance:'12'}]},{name:'Cung_cap.docx'});
  assert.equal(response.requestDocumentId,doc.id);assert.equal(response.requestDocumentVersion,1);
  W.saveResponse(r,'pmKTM','Gửi số liệu kèm văn bản',[response.id]);
  response.requestDocumentVersion=2;assert.throws(()=>W.saveResponse(r,'pmKTM','Gửi lại',[response.id]));response.requestDocumentVersion=1;
  W.transfer(r,'pmKTM','leadKTM',route(r,'Trình duyệt',[...q.documents.map(f=>f.id),response.id]));
  assert.throws(()=>W.storeInfoDocument(r,'pmKTM','supply','2.2',response.document,{}));
  W.approveData(r,'leadKTM');W.transfer(r,'leadKTM','pm',route(r,'Gửi số liệu được duyệt',[...q.documents.map(f=>f.id),response.id]));
  assert.equal(q.status,'RETURNED');assert.ok(q.response.files.includes(response.id));
 });
}
test('Văn bản cung cấp của hai lần giao cùng đơn vị giữ ID và phiên bản riêng',()=>{
 const r=make('Core di động');let first;
 for(let i=0;i<2;i++){
  const doc=requestDoc(r),{request:q}=W.transfer(r,'pm','leadKTM',route(r,'Yêu cầu lần '+i,[doc.id]));
  W.transfer(r,'leadKTM','pmKTM',route(r,'Phân công',q.receipt.files));
  const f=W.storeInfoDocument(r,'pmKTM','supply','2.2',{issuer:'Ban KTM',recipient1:'Ban KT',period:'2027'},{});
  if(first){assert.notEqual(f.id,first.id);assert.throws(()=>W.saveResponse(r,'pmKTM','Không dùng phản hồi cũ',[first.id]));}else first=f;
  W.saveResponse(r,'pmKTM','Số liệu lần '+i,[f.id]);W.transfer(r,'pmKTM','leadKTM',route(r,'Trình',[doc.id,f.id]));W.approveData(r,'leadKTM');W.transfer(r,'leadKTM','pm',route(r,'Gửi',[doc.id,f.id]));
 }
});
test('Nháp thiếu căn cứ và người xem không được tạo văn bản yêu cầu',()=>{
 assert.throws(()=>requestDoc(W.draft('NO-BASIS')));
 const r=make('BRCĐ');assert.throws(()=>W.storeInfoDocument(r,'khdt','request','2.2',{unit:'IT',content:'Số liệu',deadline:'2026-10-15'},{}));
 assert.throws(()=>requestDoc(r,'Đơn vị ngoài RACI'));
});
function prepare(r){
 W.save(r,'pm',{...r.data,author:'Nguyễn Văn A',selected:'Mở rộng hệ thống',method:'Nhu cầu trừ năng lực hiện có',result:'02 mô-đun'},[{...W.emptyRow(),device:'Mô-đun',unit:'Bộ',quantity:'2'}]);
 W.installPair(r,'pm',['report','catalog'].map(docType=>({id:docType,docType,revision:r.revision,generated:true,html:'Phiên bản '+r.revision})));
 r.submission={id:'submission',revision:r.revision,signatures:[],issued:false};
}
function completeData(r,q){
 W.transfer(r,q.lead,q.pm,route(r,'Phân công cung cấp số liệu',q.receipt.files));
 W.saveResponse(r,q.pm,'Năng lực hiện có 800.000 thuê bao',[]);
 W.transfer(r,q.pm,q.lead,route(r,'Trình duyệt số liệu',q.receipt.files));
 W.approveData(r,q.lead);
 W.transfer(r,q.lead,'pm',route(r,'Gửi số liệu đã được duyệt',q.receipt.files));
}
for(const type of W.types){
 for(const p of W.providers){
  test(type+': '+p.unit+' nhận → phân công → cung cấp → duyệt → gửi Ban KT',()=>{
   const r=make(type),{request:q}=W.transfer(r,'pm',p.lead,route(r));
   assert.equal(r.owner,'pm');assert.equal(W.canEdit(r,'pm'),true);assert.equal(W.canProvide(r,p.pm),false);assert.equal(W.canApproveData(r,p.lead),false);
   assert.throws(()=>W.saveResponse(r,p.pm,'Tự nhận nhiệm vụ',[]));assert.throws(()=>W.approveData(r,p.lead));
   completeData(r,q);assert.equal(q.status,'RETURNED');assert.equal(q.receipt.from,p.lead);assert.equal(q.receipt.to,'pm');assert.equal(q.approvedRevision,q.responseRevision);
   assert.equal(W.canApproveData(r,p.lead),false);assert.equal(W.canProvide(r,p.pm),false);assert.equal(W.pendingRequests(r).length,0);
   assert.equal(W.receiptFor(r,'khdt').purpose,'INFORMATION');assert.equal(W.receiptFor(r,'khdt').from,p.lead);assert.equal(W.receiptFor(r,'khdt').requestId,q.id);
  });
 }
 test(type+': nhiều đơn vị phối hợp; không trình phương án khi còn thiếu số liệu',()=>{
  const r=make(type);prepare(r);
  const {request:first}=W.transfer(r,'pm','leadKTM',{...route(r),co:['leadTTP']});assert.equal(r.requests.length,2);assert.equal(r.owner,'pm');assert.ok(!W.allowed(r,'pm').includes('lead'));
  assert.throws(()=>W.transfer(r,'pm','lead',route(r,'Trình phương án',['submission','report','catalog'])));
  completeData(r,first);assert.equal(W.pendingRequests(r).length,1);assert.ok(!W.allowed(r,'pm').includes('lead'));
  completeData(r,r.requests[1]);assert.ok(W.allowed(r,'pm').includes('lead'));
  W.transfer(r,'pm','lead',route(r,'Trình phương án',['submission','report','catalog']));assert.equal(W.canApprove(r,'lead'),true);
  W.approve(r,'lead');assert.equal(W.canApprove(r,'lead'),false);assert.equal(r.approval.revision,r.revision);
  W.transfer(r,'lead','pm',route(r,'',['submission','report','catalog']));assert.equal(r.receipt.purpose,'RESULT');assert.equal(W.canEdit(r,'pm'),false);assert.equal(W.receiptFor(r,'khdt').from,'lead');
 });
}
test('Ban KHĐT nhận để biết; đổi vai trò không cấp quyền xử lý hoặc duyệt',()=>{
 const r=make('Core di động');W.transfer(r,'pm','leadKTM',route(r));r.viewer='khdt';assert.ok(W.receiptFor(r,'khdt'));assert.equal(W.owns(r,'khdt'),false);
 assert.throws(()=>W.transfer(r,'khdt','pm',route(r)));assert.throws(()=>W.approve(r,'khdt'));assert.throws(()=>W.approveData(r,'khdt'));assert.throws(()=>W.saveResponse(r,'pmTTP','Không được giao',[]));
});
test('Trả PM sửa số liệu; chữ duyệt cũ không dùng cho lần trình mới',()=>{
 const r=make('BRCĐ'),{request:q}=W.transfer(r,'pm','leadKTM',route(r));
 W.transfer(r,'leadKTM','pmKTM',route(r,'Phân công'));W.saveResponse(r,'pmKTM','100 cổng',[]);W.transfer(r,'pmKTM','leadKTM',route(r,'Trình duyệt'));
 W.approveData(r,'leadKTM');assert.throws(()=>W.transfer(r,'leadKTM','pmKTM',route(r,'')));
 W.transfer(r,'leadKTM','pmKTM',route(r,'Kiểm tra lại số cổng'));assert.equal(q.approvedRevision,0);
 W.saveResponse(r,'pmKTM','160 cổng',[]);W.transfer(r,'pmKTM','leadKTM',route(r,'Trình lại'));assert.ok(!W.allowed(r,'leadKTM').includes('pm'));
 W.approveData(r,'leadKTM');q.receipt.responseRevision--;assert.throws(()=>W.transfer(r,'leadKTM','pm',route(r,'Gửi Ban KT')));
});
test('Không tráo tài liệu / PM giữa yêu cầu của hai đơn vị',()=>{
 const r=make('Core di động'),{request:q}=W.transfer(r,'pm','leadKTM',{...route(r),co:['leadTTP']});
 assert.throws(()=>W.transfer(r,'leadKTM','pmTTP',route(r,'Phân công sai')));W.transfer(r,'leadKTM','pmKTM',route(r,'Phân công'));
 r.files.push({id:'KTM-data',infoRequestId:q.id},{id:'TTP-data',infoRequestId:r.requests[1].id});
 assert.throws(()=>W.saveResponse(r,'pmKTM','Số liệu',['TTP-data']));W.saveResponse(r,'pmKTM','Số liệu',['KTM-data']);
 assert.throws(()=>W.transfer(r,'pmKTM','leadKTM',route(r,'Trình duyệt')));assert.throws(()=>W.transfer(r,'pmKTM','leadKTM',route(r,'Trình duyệt',['KTM-data','TTP-data'])));
 W.transfer(r,'pmKTM','leadKTM',route(r,'Trình duyệt',['KTM-data']));assert.equal(W.canApproveData(r,'leadKTM'),true);
});
test('Lưu nháp chưa đủ nghiệp vụ vẫn xin được số liệu; chưa sinh được bộ đầu ra',()=>{
 const r=make('Vô tuyến');W.saveDraft(r,'pm',{...r.data,author:''},[W.emptyRow()]);assert.throws(()=>W.installPair(r,'pm',[{docType:'report',revision:r.revision},{docType:'catalog',revision:r.revision}]));
 W.transfer(r,'pm','leadKTM',route(r));assert.equal(r.requests.length,1);assert.equal(r.owner,'pm');
});
test('Yêu cầu giữ phiên bản tài liệu thực tế khi PM sửa đề xuất song song',()=>{
 const r=make('Core di động');prepare(r);const {request:q}=W.transfer(r,'pm','leadKTM',route(r,'Xin số liệu',['report','catalog']));
 W.saveDraft(r,'pm',{...r.data,result:'03 mô-đun'},r.rows);assert.equal(r.files.length,0);assert.equal(q.documents.length,2);assert.equal(q.documents[0].html,'Phiên bản 2');
 W.transfer(r,'leadKTM','pmKTM',route(r,'Phân công',['report','catalog']));assert.equal(W.canProvide(r,'pmKTM'),true);
});
