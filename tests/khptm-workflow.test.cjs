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
  const r = W.create(type, 'REVIEW');
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
  test(`${type}: chuyển TĐ mở đúng người nhận, chỉ xem VB TCT nguồn`, () => {
    for (const target of ['clerk','leader']) {
      const r = W.create(type,'APPRAISAL');
      W.receiveGroupSource(r,target,{note:'Tiếp nhận hồ sơ trình TĐ'});
      assert.equal(r.owner,target); assert.equal(r.viewer,target); assert.equal('scenario' in r,false);
      assert.equal(r.phase,target === 'clerk' ? 'DISPATCH' : 'INBOX');
      assert.equal(r.receipt.from,'tctClerk'); assert.equal(W.canViewAppraisalDocuments(r,target),false);
      assert.equal(W.canSign(r,target),false);
      // File cũ trong hồ sơ không tự mở thao tác thẩm định.
      r.report = {id:'old-report'}; r.decision = {id:'old-decision'};
      assert.equal(W.canViewAppraisalDocuments(r,target),false);
      if (target === 'clerk') {
        assert.ok(recipients(r,'clerk').includes('leader'));
        W.transfer(r,'clerk','leader');
        assert.equal(r.phase,'INBOX'); assert.equal(r.receipt.from,'clerk');
        assert.equal(W.canViewAppraisalDocuments(r,'leader'),false);
        assert.equal(W.canSign(r,'leader'),false);
      }
    }
  });
  test(`${type}: tài liệu đơn vị thẩm định qua Văn thư rồi trình LĐ TĐ`, () => {
    const r = W.create(type,'APPRAISAL');
    W.receiveGroupSource(r,'clerk'); W.transfer(r,'clerk','appraisalLead'); W.transfer(r,'appraisalLead','appraisalPM');
    r.report = {id:'app-report-v1'}; r.decision = {id:'app-decision-v1'};
    W.complete(r,'appraisalPM'); W.transfer(r,'appraisalPM','appraisalLead');
    W.sign(r,'appraisalLead'); W.transfer(r,'appraisalLead','clerk');
    assert.equal(r.receipt.from,'appraisalLead'); assert.equal(W.canViewAppraisalDocuments(r,'clerk'),true);
    W.transfer(r,'clerk','leader');
    assert.equal(r.phase,'SIGN_QD'); assert.equal(W.canViewAppraisalDocuments(r,'leader'),true);
    assert.equal(W.canSign(r,'leader'),true);
    r.decision.id = 'app-decision-v2';
    assert.equal(W.canViewAppraisalDocuments(r,'leader'),false); assert.equal(W.canSign(r,'leader'),false);
  });
  test(`${type}: LĐ TCT chuyển Văn thư không tự đi nhánh rà soát`, () => {
    const r = W.create(type,'REVIEW');
    r.report = {id:'report-signed',mainSigned:true};
    W.receiveTCTClerk(r,{note:'Ban hành và chuyển TĐ'});
    assert.equal(r.phase,'LEGACY'); assert.equal(r.owner,'tctClerk');
    assert.equal(r.receipt.from,'tct'); assert.equal(r.receipt.purpose,'TCT_ROUTE');
    assert.equal(W.reviewTask(r),''); assert.equal(r.report.mainSigned,true);
    assert.deepEqual(Array.from(W.tctClerkRecipients({})), ['reviewLead','reviewCoLead','tct','originalPM','clerk','leader']);
    assert.deepEqual(Array.from(W.tctClerkRecipients({issued:true})), ['clerk','leader']);
    assert.deepEqual(Array.from(W.tctClerkRecipients({issued:true,transferredTo:'LĐ Tập đoàn'})), []);
  });
  test(`${type}: chỉ chuyển TĐ sau khi văn bản TCT ký và ban hành`, () => {
    assert.equal(W.canForwardTCT(false,{issued:false},'B4'),false);
    assert.equal(W.canForwardTCT(true,{issued:false},'B4'),false);
    assert.equal(W.canForwardTCT(false,{issued:true},'DONE'),false);
    assert.equal(W.canForwardTCT(true,{issued:true},'B4'),false);
    assert.equal(W.canForwardTCT(true,{issued:true},'DONE'),true);
    assert.equal(W.canForwardTCT(true,{issued:true,transferredTo:'Văn thư Tập đoàn'},'DONE'),false);
  });
  test(`${type}: một luồng TĐ, Văn thư TCT không ban hành Quyết định TĐ`, () => {
    const r = W.create(type, 'REVIEW');
    W.receiveReview(r, 'tct', 'tctClerk', 'DISPATCH_REVIEW');
    assert.deepEqual(recipients(r,'tctClerk'), ['reviewLead','reviewCoLead','originalPM','tct']);
    assert.equal(W.canIssue(r,'tctClerk'), false);
    assert.equal(W.roles.net, undefined);
    const a = W.create(type, 'APPRAISAL');
    W.receiveGroupSource(a,'leader');
    W.importSignedDecision(a,'leader',{id:'signed-pdf',kind:'uploaded'});
    W.transfer(a,'leader','clerk');
    assert.equal(a.receipt.purpose,'SIGNED_DECISION');
    assert.equal(W.canIssue(a,'clerk'), true);
    assert.equal(W.canIssue(a,'tctClerk'), false);
    assert.deepEqual(recipients(a,'tctClerk'), []);
  });
  test(`${type}: TĐ trả hồ sơ cho Văn thư TCT không cấp quyền ghi nhận ban hành`, () => {
    const r = W.create(type,'APPRAISAL');
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
  test(`${type}: ký dự thảo hoặc upload QĐ đã ký đều chuyển cùng Văn thư ban hành`, () => {
    for (const method of ['digital','external']) {
      const a = W.create(type, 'APPRAISAL');
      W.receiveGroupSource(a,'leader');
      W.transfer(a, 'leader', 'clerk'); W.transfer(a, 'clerk', 'appraisalLead'); W.transfer(a, 'appraisalLead', 'appraisalPM');
      assert.equal(W.canEdit(a, 'appraisalPM'), true); assert.equal(W.canEdit(a, 'appraisalCoPM'), false);
      a.report = {id:'report-v1'}; a.decision = {id:'draft-v1'};
      W.complete(a, 'appraisalPM'); W.transfer(a, 'appraisalPM', 'appraisalLead');
      W.sign(a, 'appraisalLead'); W.transfer(a, 'appraisalLead', 'clerk');
      assert.equal(W.canIssue(a, 'clerk'), false);
      W.transfer(a, 'clerk', 'leader');
      assert.equal(W.canSign(a,'leader'),true); assert.equal(W.canUploadSignedDecision(a,'leader'),true);
      assert.deepEqual(recipients(a,'leader'), []);
      if (method === 'digital') W.sign(a, 'leader');
      else W.importSignedDecision(a,'leader',{id:'signed-pdf-v1',kind:'uploaded'});
      assert.equal(a.decision.signatureSource,method); assert.equal(a.report.id,'report-v1');
      assert.equal(W.canSign(a,'leader'),false); assert.equal(W.canUploadSignedDecision(a,'leader'),false);
      W.transfer(a, 'leader', 'clerk');
      assert.equal(a.phase,'CLERK_SIGNED'); assert.equal(a.receipt.from,'leader');
      assert.equal(a.receipt.decisionId,a.decision.id); assert.equal(a.receipt.purpose,'SIGNED_DECISION');
      assert.equal(W.canIssue(a, 'clerk'), true);
      a.decision.id='replaced-file'; assert.equal(W.canIssue(a,'clerk'),false);
    }
  });
  test(`${type}: upload QĐ đã ký khi nhận hồ sơ nguồn không cần nhánh NET hoặc báo cáo giả`, () => {
    const a = W.create(type,'APPRAISAL');
    assert.equal(W.canUploadSignedDecision(a,'leader'),false);
    W.receiveGroupSource(a,'clerk');
    assert.equal(W.canUploadSignedDecision(a,'leader'),false);
    assert.throws(()=>W.importSignedDecision(a,'leader',{id:'signed',kind:'uploaded'}));
    W.transfer(a,'clerk','leader');
    assert.equal(W.canUploadSignedDecision(a,'leader'),true);
    assert.equal(W.canUploadSignedDecision(a,'clerk'),false);
    assert.throws(()=>W.importSignedDecision(a,'leader',{id:'generated',kind:'generated'}));
    W.importSignedDecision(a,'leader',{id:'signed',kind:'uploaded'});
    assert.equal(a.report,null); assert.equal(W.canViewAppraisalDocuments(a,'leader'),true);
    assert.equal(W.canSign(a,'leader'),false);
    W.transfer(a,'leader','clerk'); assert.equal(W.canIssue(a,'clerk'),true);
    a.receipt.from='appraisalLead'; assert.equal(W.canIssue(a,'clerk'),false);
    a.receipt.from='leader'; a.phase='ISSUED'; a.decision.issued=true;
    assert.deepEqual(recipients(a,'clerk'),['leader','appraisalLead','appraisalCoLead','tctClerk','tct']);
    W.transfer(a,'clerk','tct'); assert.equal(a.phase,'STEP5_RECEIVED');
  });
  test(`${type}: Văn thư nhận từ LĐ TĐ chuyển đủ tuyến và mở đúng người nhận ở Bước 5`, () => {
    for (const target of ['leader','appraisalLead','appraisalCoLead','tctClerk','tct']) {
      const r = W.create(type,'APPRAISAL'); W.receiveGroupSource(r,'leader');
      W.importSignedDecision(r,'leader',{id:'signed-decision',kind:'uploaded',name:'Quyet_dinh.pdf'});
      W.transfer(r,'leader','clerk');
      assert.deepEqual(recipients(r,'clerk'),['leader','appraisalLead','appraisalCoLead','tctClerk','tct']);
      r.issue = {number:'100',date:'2026-10-02',suffix:'VNPT',eoffice:'200'};
      r.phase='ISSUED'; r.decision.issued=true;
      const file=r.decision;
      W.transfer(r,'clerk',target,{note:'Chuyển Quyết định triển khai Bước 5',files:['Quyet_dinh.pdf']});
      assert.equal(r.phase,'STEP5_RECEIVED'); assert.equal(r.owner,target); assert.equal(r.viewer,target);
      assert.equal(r.receipt.from,'clerk'); assert.equal(r.receipt.to,target);
      assert.equal(r.receipt.purpose,'PASS_RESULTS'); assert.equal(r.receipt.decisionId,'signed-decision');
      assert.equal(r.decision,file); assert.equal(r.decision.signed,true); assert.equal(r.decision.issued,true);
      assert.equal(r.issue.number,'100'); assert.equal(W.canViewAppraisalDocuments(r,target),true);
      assert.equal(W.canSign(r,target),false); assert.equal(W.canIssue(r,target),false);
      assert.equal(W.canEdit(r,target),false); assert.deepEqual(recipients(r,target),[]);
    }
  });
  test(`${type}: Văn thư chọn Xử lý chính theo lời phê, không bắt buộc đã ban hành`, () => {
    for (const target of ['leader','appraisalLead','appraisalCoLead','tctClerk','tct']) {
      for (const method of ['digital','external']) {
        const r = W.create(type,'APPRAISAL'); W.receiveGroupSource(r,'leader');
        if (method === 'external') W.importSignedDecision(r,'leader',{id:'signed-pdf',kind:'uploaded',name:'Quyet_dinh.pdf'});
        else {
          W.transfer(r,'leader','clerk'); W.transfer(r,'clerk','appraisalLead'); W.transfer(r,'appraisalLead','appraisalPM');
          r.report={id:'report-v1'}; r.decision={id:'draft-v1',kind:'generated',name:'Quyet_dinh.doc'};
          W.complete(r,'appraisalPM'); W.transfer(r,'appraisalPM','appraisalLead'); W.sign(r,'appraisalLead');
          W.transfer(r,'appraisalLead','clerk'); W.transfer(r,'clerk','leader'); W.sign(r,'leader');
        }
        W.transfer(r,'leader','clerk');
        const decision = r.decision, report = r.report && {...r.report};
        assert.deepEqual(recipients(r,'clerk'),['leader','appraisalLead','appraisalCoLead','tctClerk','tct']);
        W.transfer(r,'clerk',target,{note:'Theo lời phê LĐ TĐ',files:[decision.name]});
        assert.equal(r.owner,target); assert.equal(r.viewer,target); assert.equal(r.decision,decision);
        assert.equal(r.signed,true); assert.equal(r.decision.signed,true);
        assert.equal(r.decision.signatureSource,method); assert.notEqual(r.decision.issued,true);
        assert.equal(r.ready,true); if (report) assert.deepEqual({...r.report},report);
        assert.equal(r.receipt.note,'Theo lời phê LĐ TĐ'); assert.deepEqual(Array.from(r.receipt.files),[decision.name]);
        assert.equal(W.canViewAppraisalDocuments(r,target),true); assert.equal(W.canSign(r,target),false);
        assert.equal(r.phase,target === 'leader' ? 'CLERK_SIGNED' : 'STEP5_RECEIVED');
        assert.equal(r.receipt.purpose,target === 'leader' ? 'SIGNED_DECISION' : 'DIRECTED_DECISION');
        if (target === 'leader') {
          W.transfer(r,'leader','clerk'); assert.equal(W.canIssue(r,'clerk'),true);
        }
      }
    }
  });
  test(`${type}: Văn thư nhận lời phê chưa ký vẫn chọn đủ tuyến xử lý chính`, () => {
    for (const target of ['leader','appraisalLead','appraisalCoLead','tctClerk','tct']) {
      const r=W.create(type,'APPRAISAL'); W.receiveGroupSource(r,'leader');
      W.transfer(r,'leader','clerk',{note:'Lời phê phân công xử lý'});
      assert.deepEqual(recipients(r,'clerk'),['leader','appraisalLead','appraisalCoLead','tctClerk','tct']);
      W.transfer(r,'clerk',target,{note:'Chuyển theo lời phê'});
      assert.equal(r.owner,target); assert.equal(r.viewer,target); assert.equal(r.signed,false);
      assert.equal(r.receipt.note,'Chuyển theo lời phê');
    }
  });
  test(`${type}: quyền chuyển Bước 5 phụ thuộc nguồn LĐ TĐ và phiên bản được ban hành`, () => {
    const r=W.create(type,'APPRAISAL'); W.receiveGroupSource(r,'leader');
    W.importSignedDecision(r,'leader',{id:'signed-v1',kind:'uploaded'}); W.transfer(r,'leader','clerk');
    r.phase='ISSUED'; r.decision.issued=true;
    r.receipt.from='appraisalLead'; assert.deepEqual(recipients(r,'clerk'),[]);
    assert.throws(()=>W.transfer(r,'clerk','tct'));
    r.receipt.from='leader'; r.decision.id='signed-v2'; assert.deepEqual(recipients(r,'clerk'),[]);
    r.decision.id='signed-v1'; r.decision.issued=false; assert.deepEqual(recipients(r,'clerk'),[]);
    r.decision.issued=true; assert.deepEqual(recipients(r,'tctClerk'),[]);
    assert.deepEqual(recipients(r,'leader'),[]);
  });

}
