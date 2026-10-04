const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const W=require('../khptm-step1.js');

// Run the actual header adapter with the surrounding screen functions stubbed.
// Role selection changes only the viewer; model permissions still use the receipt.
function screen(){
  const code=fs.readFileSync(require.resolve('../khptm-step1.js'),'utf8');
  const adapter=code.slice(code.indexOf('  const headerRole='),code.indexOf('  const section='));
  const header={innerHTML:'<option>PM dự án</option>',value:'PM dự án'};
  const user={textContent:'PM dự án | Ban QLDA'};
  let active='home',legacyCalls=0;
  const record=W.create('HEADER');
  const context={W,current:()=>record,document:{getElementById:id=>id==='headerRole'?header:user},
    page:{classList:{contains:name=>name==='active'&&active==='khptm-process'}},
    showPage:id=>{active=id;},syncRoleHeader:()=>{header.value='PM dự án';user.textContent='PM dự án | Ban QLDA';},
    switchRoleFromHeader:()=>{legacyCalls++;active='home';},
    setRole:a=>{if(W.roleKeys(record).includes(a)){record.viewer=a;vm.runInContext('syncHeader()',context);}}};
  vm.createContext(context);vm.runInContext(adapter,context);
  return {context,record,header,user,active:()=>active,legacyCalls:()=>legacyCalls};
}

test('bước 1 đưa đầy đủ vai trò TĐ lên header và đổi vai trò không thoát hồ sơ',()=>{
  const s=screen();s.context.showPage('khptm-process');
  for(const name of ['PM chủ trì Tập đoàn','LĐ Ban chủ trì Tập đoàn','LĐ Tập đoàn','Văn thư Tập đoàn'])assert.ok(s.header.innerHTML.includes(name));
  s.context.switchRoleFromHeader('tdBanLead');
  assert.equal(s.record.viewer,'tdBanLead');assert.equal(s.user.textContent,W.roles.tdBanLead);
  assert.equal(s.active(),'khptm-process');assert.equal(s.legacyCalls(),0);
  assert.equal(W.canSign(s.record,'tdBanLead'),false);
  assert.deepEqual(W.allowed(s.record,'tdBanLead'),[]);
});

test('chuyển thực tế cập nhật header theo người nhận, GNV dùng vai trò TCT',()=>{
  const s=screen();s.context.showPage('khptm-process');W.prepare(s.record,'tdPM');
  W.transfer(s.record,'tdPM','tdBanLead',{files:[s.record.submission.id,s.record.guidance.id]});
  vm.runInContext('syncHeader()',s.context);
  assert.equal(s.user.textContent,W.roles.tdBanLead);assert.equal(W.canSign(s.record,'tdBanLead'),true);
  s.record.kind='GNV';s.record.viewer='ktPM';vm.runInContext('syncHeader()',s.context);
  assert.ok(s.header.innerHTML.includes('Văn thư TCT'));assert.ok(s.header.innerHTML.includes('LĐTCT'));
  assert.equal(s.header.innerHTML.includes('tdBanLead'),false);
});

test('rời bước 1 khôi phục header và giữ nguyên handler của các chức năng khác',()=>{
  for(const destination of ['khptm-list','home','team-create','khptm2-process']){
    const s=screen();s.context.showPage('khptm-process');s.context.showPage(destination);
    assert.equal(s.header.innerHTML,'<option>PM dự án</option>');assert.equal(s.user.textContent,'PM dự án | Ban QLDA');
    s.context.switchRoleFromHeader('LĐTCT');assert.equal(s.legacyCalls(),1);
    s.context.showPage('khptm-process');assert.ok(s.header.innerHTML.includes('tdBanLead'));
  }
});
