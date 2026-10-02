const {test}=require('node:test');
const assert=require('node:assert/strict');
const W=require('../khptm-step5.js');
const basis=type=>({id:'KH-'+type,type,year:2027,title:'KHPTM '+type,number:'123/VNPT',date:'2026-10-02',decision:{signed:true,issued:true}});
function prepared(type='Core di động'){
 const r=W.create(basis(type),'PAKT-1');
 const data={...r.data,author:'Nguyễn Văn A',selected:'Công nghệ A',method:'Dựa vào nhu cầu',result:'10 thiết bị'};
 const rows=[{...W.emptyRow(),device:'Thiết bị A',unit:'bộ',quantity:'10',price:'1000'}];
 W.save(r,'pm',data,rows);
 W.installPair(r,'pm',['report','catalog'].map(docType=>({id:docType,docType,revision:r.revision,generated:true})));
 r.submission={id:'submission',revision:r.revision,signatures:[],issued:false};return r;
}
const detail=r=>({files:[r.submission.id,...r.files.map(f=>f.id)],note:'Xem xét đề xuất',co:['khdt'],view:['related']});
test('Căn cứ chỉ nhận KHPTM đã phê duyệt và ban hành của 3 nhóm chung',()=>{
 for(const invalid of [null,basis('CSHT'),{...basis('Vô tuyến'),decision:{signed:false,issued:true}},{...basis('BRCĐ'),decision:{signed:true,issued:false}}]) assert.throws(()=>W.create(invalid,'1'));
});
for(const type of W.types){
 test(type+': hai file cùng phiên bản, tạo lại không trùng và giữ upload',()=>{
  const r=prepared(type);r.files.push({id:'upload',generated:false});
  W.installPair(r,'pm',['report','catalog'].map(docType=>({id:docType,docType,revision:r.revision,generated:true})));
  assert.equal(r.files.length,3);assert.ok(r.files.some(f=>f.id==='upload'));
  const old=r.files;assert.throws(()=>W.installPair(r,'pm',[{docType:'report',revision:r.revision},{docType:'catalog',revision:0}]));assert.equal(r.files,old);
 });
 test(type+': đổi vai trò không cấp quyền sửa/ký/ban hành',()=>{
  const r=prepared(type);r.viewer='lead';assert.equal(W.canEdit(r,'lead'),false);assert.equal(W.canSign(r,'lead'),false);assert.deepEqual(W.allowed(r,'lead'),[]);
  assert.throws(()=>W.save(r,'lead',r.data,r.rows));assert.throws(()=>W.transfer(r,'lead','tct',detail(r)));assert.throws(()=>W.issue(r,'tctClerk',{number:'1',date:'2026-10-02'}));
 });
 test(type+': chuyển đủ bộ tài liệu và ghi nhận nguồn, mục đích, người nhận',()=>{
  const r=prepared(type);assert.throws(()=>W.transfer(r,'pm','lead',{...detail(r),files:['submission','report']}));
  W.transfer(r,'pm','lead',detail(r));assert.equal(r.receipt.from,'pm');assert.equal(r.receipt.to,'lead');assert.equal(r.receipt.purpose,'REVIEW');assert.equal(r.receipt.revision,r.revision);assert.ok(r.receipt.time);assert.deepEqual(r.receipt.co,['khdt']);assert.equal(W.canEdit(r,'pm'),false);
 });
 test(type+': ký theo tài liệu được nhận, không ký lại khi chuyển vòng',()=>{
  const r=prepared(type);W.transfer(r,'pm','lead',detail(r));
  const actual=r.receipt.files;r.receipt.files=[];assert.equal(W.canSign(r,'lead'),false);assert.deepEqual(W.allowed(r,'lead'),[]);r.receipt.files=actual;
  r.submission.revision--;assert.equal(W.canSign(r,'lead'),false);r.submission.revision++;
  W.sign(r,'lead');assert.equal(W.canSign(r,'lead'),false);W.transfer(r,'lead','tct',detail(r));W.transfer(r,'tct','lead',detail(r));assert.equal(W.canSign(r,'lead'),false);assert.deepEqual(r.submission.signatures,['lead']);
 });
 test(type+': sửa nội dung lưu nguyên bộ cũ có chữ ký, yêu cầu sinh bộ mới',()=>{
  const r=prepared(type);W.transfer(r,'pm','lead',detail(r));W.sign(r,'lead');
  assert.throws(()=>W.transfer(r,'lead','pm',{...detail(r),note:''}));W.transfer(r,'lead','pm',{...detail(r),note:'Sửa quy mô'});
  assert.equal(W.save(r,'pm',r.data,r.rows),false);assert.deepEqual(r.submission.signatures,['lead']);
  W.save(r,'pm',{...r.data,result:'20 thiết bị'},[{...r.rows[0],quantity:'20'}]);assert.equal(W.pairReady(r),false);assert.equal(r.submission,null);assert.deepEqual(r.archive[0].submission.signatures,['lead']);assert.equal(r.archive[0].rows[0].quantity,'10');assert.deepEqual(W.allowed(r,'pm'),[]);
 });
 test(type+': Văn thư nhận Tờ trình đã ký mới nhập số, ban hành',()=>{
  const r=prepared(type);W.transfer(r,'pm','lead',detail(r));assert.ok(!W.allowed(r,'lead').includes('tctClerk'));W.sign(r,'lead');W.transfer(r,'lead','tctClerk',detail(r));assert.equal(W.canIssue(r,'tctClerk'),true);
  const actual=r.receipt.from;r.receipt.from='pm';assert.equal(W.canIssue(r,'tctClerk'),false);r.receipt.from=actual;
  assert.throws(()=>W.issue(r,'tctClerk',{number:'',date:'2026-10-02'}));W.issue(r,'tctClerk',{number:'801',date:'2026-10-02',eoffice:'9'});assert.equal(W.canIssue(r,'tctClerk'),false);assert.ok(W.allowed(r,'tctClerk').includes('khdt'));
 });
}
test('Không sinh danh mục với số lượng sai hoặc đơn giá âm',()=>{
 const r=prepared();for(const quantity of ['0','-1','abc','Infinity'])assert.throws(()=>W.save(r,'pm',r.data,[{...r.rows[0],quantity}]));
 assert.throws(()=>W.save(r,'pm',r.data,[{...r.rows[0],price:'-1'}]));
});
