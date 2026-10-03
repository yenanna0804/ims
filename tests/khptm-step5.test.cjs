const {test}=require('node:test');
const assert=require('node:assert/strict');
const W=require('../khptm-step5.js');
const basis=type=>({id:'KH-'+type,type,year:2027,title:'KHPTM '+type,number:'123/VNPT',date:'2026-10-02',decision:{signed:true,issued:true}});
function prepared(type='Core di động'){
 const r=W.create(basis(type),'PAKT-1');
 W.save(r,'pm',{...r.data,name:'Đề xuất '+type,author:'',date:''},[]);
 W.installPair(r,'pm',['report','catalog'].map(docType=>({id:docType,docType,revision:r.revision,generated:true})));
 r.submission={id:'submission',revision:r.revision,signatures:[],issued:false};return r;
}
const detail=r=>({files:[r.submission.id,...r.files.map(f=>f.id)],note:'Xem xét đề xuất',co:[],view:['khdt']});
test('Căn cứ chỉ nhận KHPTM đã phê duyệt và ban hành của loại thiết bị được hỗ trợ',()=>{
 for(const invalid of [null,basis('Loại khác'),{...basis('Vô tuyến'),decision:{signed:false,issued:true}},{...basis('BRCĐ'),decision:{signed:true,issued:false}}]) assert.throws(()=>W.create(invalid,'1'));
});
test('Nháp chưa có căn cứ không sinh tài liệu hoặc chuyển xử lý',()=>{
 const r=W.draft('PAKT-DRAFT');W.saveDraft(r,'pm',{...r.data,name:'Đề xuất mới'},r.rows);
 assert.equal(W.canEdit(r,'pm'),true);assert.deepEqual(W.allowed(r,'pm'),[]);
 assert.throws(()=>W.installPair(r,'pm',[{docType:'report',revision:r.revision},{docType:'catalog',revision:r.revision}]));
 assert.throws(()=>W.transfer(r,'pm','leadKTM',{files:[],note:'Yêu cầu số liệu'}));
});
for(const type of W.types){
 test(type+': biểu mẫu Cần khảo sát không bắt các trường đã bỏ',()=>{
  const r=prepared(type);assert.ok(W.pairReady(r));assert.equal(r.data.author,'');assert.equal(r.data.date,'');assert.equal(r.rows.length,0);
  assert.throws(()=>W.saveDraft(r,'pm',{...r.data,name:'  '},[]));
 });
 test(type+': bộ tài liệu cùng phiên bản, tạo lại không trùng và giữ upload',()=>{
  const r=prepared(type);r.files.push({id:'upload',generated:false});
  W.installPair(r,'pm',['report','catalog'].map(docType=>({id:docType,docType,revision:r.revision,generated:true})));
  assert.equal(r.files.length,3);assert.ok(r.files.some(f=>f.id==='upload'));
  const old=r.files;assert.throws(()=>W.installPair(r,'pm',[{docType:'report',revision:r.revision},{docType:'catalog',revision:0}]));assert.equal(r.files,old);
 });
 test(type+': đổi vai trò hoặc nhận để biết không cấp quyền xử lý',()=>{
  const r=prepared(type);r.viewer='lead';assert.equal(W.canEdit(r,'lead'),false);assert.equal(W.canApprove(r,'lead'),false);assert.deepEqual(W.allowed(r,'lead'),[]);
  W.transfer(r,'pm','lead',detail(r));assert.equal(W.receiptFor(r,'khdt').purpose,'INFORMATION');assert.equal(W.owns(r,'khdt'),false);assert.deepEqual(W.allowed(r,'khdt'),[]);
  assert.throws(()=>W.approve(r,'khdt'));assert.throws(()=>W.save(r,'lead',r.data,r.rows));
 });
 test(type+': duyệt đúng nguồn PM, đầy đủ tài liệu và phiên bản nhận',()=>{
  const r=prepared(type);assert.throws(()=>W.transfer(r,'pm','lead',{...detail(r),files:['submission','report']}));
  W.transfer(r,'pm','lead',detail(r));assert.equal(r.receipt.from,'pm');assert.equal(r.receipt.purpose,'REVIEW');assert.ok(r.receipt.time);assert.equal(W.canApprove(r,'lead'),true);
  r.receipt.from='leadKTM';assert.equal(W.canApprove(r,'lead'),false);assert.deepEqual(W.allowed(r,'lead'),[]);r.receipt.from='pm';
  r.receipt.files=['submission'];assert.equal(W.canApprove(r,'lead'),false);r.receipt.files=detail(r).files;
  r.submission.revision--;assert.equal(W.canApprove(r,'lead'),false);r.submission.revision++;
  W.approve(r,'lead');assert.equal(W.canApprove(r,'lead'),false);assert.deepEqual(W.allowed(r,'lead'),['pm']);
  W.transfer(r,'lead','pm',{...detail(r),note:''});assert.equal(r.receipt.purpose,'RESULT');assert.equal(W.canEdit(r,'pm'),false);
 });
 test(type+': trả sửa cần lý do; lưu phiên bản mới giữ tài liệu cũ và buộc trình lại',()=>{
  const r=prepared(type);W.transfer(r,'pm','lead',detail(r));
  assert.throws(()=>W.transfer(r,'lead','pm',{...detail(r),note:''}));W.transfer(r,'lead','pm',{...detail(r),note:'Bổ sung phạm vi'});
  assert.equal(W.saveDraft(r,'pm',r.data,r.rows),false);
  W.saveDraft(r,'pm',{...r.data,location:'Miền Bắc'},r.rows);assert.equal(W.pairReady(r),false);assert.equal(r.submission,null);assert.equal(r.archive[0].submission.id,'submission');assert.ok(!W.allowed(r,'pm').includes('lead'));
  assert.equal(W.receiptFor(r,'khdt').documents.find(f=>f.id==='report').revision,r.revision-1);
 });
 test(type+': không có nhánh ký số hoặc Văn thư ban hành',()=>{
  const r=prepared(type);W.transfer(r,'pm','lead',detail(r));
  for(const actor of ['lead','tct','tctClerk']){assert.equal(W.canSign(r,actor),false);assert.equal(W.canIssue(r,actor),false);assert.throws(()=>W.sign(r,actor));assert.throws(()=>W.issue(r,actor,{}));}
  assert.throws(()=>W.transfer(r,'lead','tct',detail(r)));assert.throws(()=>W.transfer(r,'lead','tctClerk',detail(r)));
  assert.equal(W.roles.tct,undefined);assert.equal(W.roles.tctClerk,undefined);
 });
}
