const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const context = {};
vm.createContext(context);
vm.runInContext(fs.readFileSync(path.join(__dirname, '../khptm-step4.js'), 'utf8'), context);
const W = context.KHWorkflow;
const recipients = (r, role) => Array.from(W.allowed(r, role));
function work(type) {
  const r = W.create(type, 'REVIEW', 'TD');
  W.transfer(r, 'reviewLead', 'reviewPM');
  return r;
}
function ready(r) {
  r.report = { id: 'report-v1', reportMode: 'REVIEW', mainSigned: false, coInitialled: false };
  W.complete(r, 'reviewPM');
  W.transfer(r, 'reviewPM', 'reviewLead', { note: 'Trình ký báo cáo', files: ['Bao_cao_v1.doc'] });
}
test('chỉ có một actor Văn thư TCT và một actor Văn thư Tập đoàn', () => {
  assert.deepEqual(Object.entries(W.roles).filter(([,name]) => name.startsWith('Văn thư')).map(([key,name]) => [key,name]),
    [['clerk','Văn thư Tập đoàn'],['tctClerk','Văn thư TCT']]);
});
for (const type of ['Core di động', 'Vô tuyến', 'BRCĐ', 'CSHT']) {
  test(`${type}: cùng Văn thư TCT nhưng điều phối rà soát khác ghi nhận ban hành`, () => {
    const r = W.create(type, 'REVIEW');
    W.receiveReview(r, 'tct', 'tctClerk', 'DISPATCH_REVIEW');
    assert.deepEqual(recipients(r,'tctClerk'), ['reviewLead','reviewCoLead','originalPM','tct']);
    assert.equal(W.canIssue(r,'tctClerk'), false);
    const n = W.create(type, 'APPRAISAL', 'NET');
    assert.deepEqual(recipients(n,'tctClerk'), []);
    n.report = {official:true}; n.decision = {official:true};
    W.complete(n,'net');
    assert.deepEqual(recipients(n,'net'), ['tctClerk']);
    W.transfer(n,'net','tctClerk',{note:'Ghi nhận QĐ TĐ đã ban hành'});
    assert.equal(n.owner,'tctClerk'); assert.equal(n.phase,'CLERK_SIGNED');
    assert.equal(n.receipt.purpose,'REGISTER_TD_ISSUE');
    assert.equal(W.canIssue(n,'tctClerk'), true);
    n.receipt.from = 'clerk'; assert.equal(W.canIssue(n,'tctClerk'), false);
    n.receipt.from = 'net'; n.phase = 'ISSUED';
    assert.deepEqual(recipients(n,'tctClerk'), ['originalPM']);
    assert.throws(() => W.transfer(n,'tctClerk','tctClerk'));
  });
  test(`${type}: TĐ trả hồ sơ cho Văn thư TCT không cấp quyền ghi nhận ban hành`, () => {
    const r = W.create(type,'APPRAISAL','TD');
    W.transfer(r,'leader','clerk');
    W.transfer(r,'clerk','tctClerk');
    assert.equal(r.phase,'LEGACY'); assert.equal(r.owner,'tctClerk');
    assert.equal(r.receipt.from,'clerk'); assert.equal(r.receipt.purpose,'RETURN_TCT');
    assert.equal(W.canIssue(r,'tctClerk'), false);
    assert.deepEqual(recipients(r,'tctClerk'), []);
  });
  test(`${type}: phân công từ Văn thư không mở xem/ký báo cáo`, () => {
    for (const role of ['reviewLead', 'reviewCoLead']) {
      const r = W.create(type, 'REVIEW');
      r.report = { id: 'old-report', mainSigned: true, coInitialled: true };
      W.receiveReview(r, 'tctClerk', role, 'ASSIGN_REVIEW');
      assert.equal(W.canViewReviewReport(r, role), false);
      assert.equal(W.canSign(r, role), false);
      assert.deepEqual(recipients(r, role), [role === 'reviewLead' ? 'reviewPM' : 'reviewCoPM']);
    }
  });
  test(`${type}: PM chủ trì chuyển trực tiếp PM phối hợp rồi nhận kết quả`, () => {
    const r = work(type);
    assert.deepEqual(recipients(r, 'reviewPM'), ['originalPM', 'reviewCoPM', 'reviewLead']);
    assert.deepEqual(recipients(r, 'reviewCoPM'), []);
    assert.throws(() => W.transfer(r, 'reviewPM', 'reviewLead'));
    W.transfer(r, 'reviewPM', 'reviewCoPM', { note: 'Rà soát kỹ thuật' });
    assert.equal(r.receipt.from, 'reviewPM');
    assert.equal(r.receipt.purpose, 'CO_REVIEW');
    assert.equal(W.canEdit(r, 'reviewCoPM'), false);
    assert.deepEqual(recipients(r, 'reviewCoPM'), ['reviewPM']);
    W.transfer(r, 'reviewCoPM', 'reviewPM');
    assert.equal(r.coCompleted, true);
    ready(r);
    assert.equal(r.receipt.from, 'reviewPM');
    assert.equal(W.canSign(r, 'reviewLead'), true);
  });
  test(`${type}: LĐ chủ trì ký chính thức và trình thẳng LĐ TCT`, () => {
    const r = work(type); ready(r);
    assert.equal(W.canViewReviewReport(r, 'reviewLead'), true);
    assert.deepEqual(recipients(r, 'reviewLead'), []);
    W.sign(r, 'reviewLead');
    assert.equal(r.report.signed, true);
    assert.deepEqual(recipients(r, 'reviewLead'), ['tct', 'reviewCoLead']);
    W.transfer(r, 'reviewLead', 'tct');
    assert.equal(r.phase, 'LEGACY');
    assert.equal(r.owner, 'tct');
    assert.equal(r.report.coInitialled, false);
  });
  test(`${type}: ký nháy rồi trả LĐ chủ trì, không ký/phân công lại`, () => {
    const r = work(type); ready(r); W.sign(r, 'reviewLead');
    W.transfer(r, 'reviewLead', 'reviewCoLead');
    assert.equal(r.receipt.purpose, 'INITIAL_REPORT');
    assert.equal(W.canViewReviewReport(r, 'reviewCoLead'), true);
    assert.deepEqual(recipients(r, 'reviewCoLead'), []);
    W.sign(r, 'reviewCoLead');
    assert.equal(r.report.coInitialled, true);
    assert.notEqual(r.report.coSigned, true);
    assert.deepEqual(recipients(r, 'reviewCoLead'), ['tct', 'reviewLead']);
    W.transfer(r, 'reviewCoLead', 'reviewLead', { note: 'Đã ký nháy, trình LĐ TCT' });
    assert.equal(r.phase, 'REVIEW_SUBMIT');
    assert.equal(r.receipt.from, 'reviewCoLead');
    assert.equal(r.receipt.note, 'Đã ký nháy, trình LĐ TCT');
    assert.equal(W.canSign(r, 'reviewLead'), false);
    assert.deepEqual(recipients(r, 'reviewLead'), ['tct']);
    W.transfer(r, 'reviewLead', 'tct');
    assert.equal(r.report.mainSigned, true);
    assert.equal(r.report.coInitialled, true);
  });
  test(`${type}: ký nháy rồi trình trực tiếp LĐ TCT`, () => {
    const r = work(type); ready(r); W.sign(r, 'reviewLead');
    W.transfer(r, 'reviewLead', 'reviewCoLead'); W.sign(r, 'reviewCoLead');
    W.transfer(r, 'reviewCoLead', 'tct');
    assert.equal(r.owner, 'tct'); assert.equal(r.phase, 'LEGACY');
  });
  test(`${type}: báo cáo bị trả khác với hồ sơ trình bị trả`, () => {
    const r = work(type); ready(r); W.sign(r, 'reviewLead'); W.transfer(r, 'reviewLead', 'reviewCoLead');
    W.rejectReport(r, 'reviewCoLead');
    assert.equal(r.owner, 'reviewPM'); assert.equal(r.phase, 'WORK');
    assert.equal(r.receipt.purpose, 'REVISE_REPORT'); assert.equal(r.report.mainSigned, false);
    W.transfer(r, 'reviewPM', 'originalPM', { note: 'Sửa hồ sơ và trình lại từ đầu' });
    assert.equal(r.owner, 'originalPM'); assert.equal(r.phase, 'LEGACY'); assert.equal(r.receipt.purpose, 'RETURN_SOURCE');
    assert.equal(W.canPrepare(r, 'reviewPM'), false);
  });
  test(`${type}: cùng phase nhưng sai nguồn chuyển/phiên bản không được ký`, () => {
    const r = work(type); ready(r);
    r.receipt.from = 'tctClerk';
    assert.equal(W.canSign(r, 'reviewLead'), false);
    assert.deepEqual(recipients(r, 'reviewLead'), []);
    r.receipt.from = 'reviewPM'; r.report.id = 'report-v2';
    assert.equal(W.canSign(r, 'reviewLead'), false);
  });
  test(`${type}: luồng thẩm định và NET giữ nguyên điều kiện ký/ban hành`, () => {
    const a = W.create(type, 'APPRAISAL', 'TD');
    W.transfer(a, 'leader', 'clerk'); W.transfer(a, 'clerk', 'appraisalLead'); W.transfer(a, 'appraisalLead', 'appraisalPM');
    assert.equal(W.canEdit(a, 'appraisalPM'), true); assert.equal(W.canEdit(a, 'appraisalCoPM'), false);
    a.report = {}; a.decision = {}; W.complete(a, 'appraisalPM'); W.transfer(a, 'appraisalPM', 'appraisalLead');
    W.sign(a, 'appraisalLead'); W.transfer(a, 'appraisalLead', 'clerk');
    assert.equal(W.canIssue(a, 'clerk'), false);
    W.transfer(a, 'clerk', 'leader'); W.sign(a, 'leader'); W.transfer(a, 'leader', 'clerk');
    assert.equal(W.canIssue(a, 'clerk'), true);
    const n = W.create(type, 'APPRAISAL', 'NET'); assert.throws(() => W.complete(n, 'net'));
    n.report = { official: true }; n.decision = { official: true }; W.complete(n, 'net'); W.transfer(n, 'net', 'tctClerk');
    assert.equal(W.canIssue(n, 'tctClerk'), true); assert.equal(W.canSign(n, 'leader'), false);
  });
}
