/* Điểm nối KHPTM: ký nháy, rà soát TCT và thẩm định TĐ, dùng chung hồ sơ/pattern cũ. */
(function (root) {
  'use strict';
  const roles = {
    reviewLead: 'LĐ ĐV rà soát chủ trì (Ban KHĐT)', reviewPM: 'PM rà soát chủ trì (Ban KHĐT)',
    reviewCoLead: 'LĐ ĐV rà soát phối hợp (Ban KT)', reviewCoPM: 'PM rà soát phối hợp (Ban KT)',
    leader: 'LĐ Tập đoàn', clerk: 'Văn thư Tập đoàn',
    appraisalLead: 'LĐ ĐV thẩm định TĐ chủ trì', appraisalPM: 'PM thẩm định TĐ chủ trì',
    appraisalCoLead: 'LĐ ĐV thẩm định TĐ phối hợp', appraisalCoPM: 'PM thẩm định TĐ phối hợp',
    tct: 'LĐTCT', tctClerk: 'Văn thư TCT', originalPM: 'Chuyên viên Ban KT',
    consultKT: 'Ban KT - tham vấn', consultKH: 'Ban KHĐT - tham vấn', consultTC: 'Ban TCKT - tham vấn'
  };
  const units = r => r.mode === 'REVIEW'
    ? { lead: 'reviewLead', pm: 'reviewPM', coLead: 'reviewCoLead', coPM: 'reviewCoPM', clerk: 'tctClerk' }
    : { lead: 'appraisalLead', pm: 'appraisalPM', coLead: 'appraisalCoLead', coPM: 'appraisalCoPM', clerk: 'clerk' };
  // Quyền rà soát phụ thuộc phiếu chuyển hiện tại, không suy từ vai trò đang chọn.
  const reviewPurposes = {
    DISPATCH_REVIEW: 'Điều phối rà soát', ASSIGN_REVIEW: 'Phân công rà soát', REVIEW_WORK: 'Thực hiện rà soát',
    CO_REVIEW: 'Rà soát phối hợp', RETURN_RESULT: 'Tổng hợp kết quả phối hợp', SIGN_REPORT: 'Ký chính thức báo cáo',
    INITIAL_REPORT: 'Ký nháy báo cáo', SUBMIT_SIGNED: 'Trình báo cáo đã ký', REVISE_REPORT: 'Sửa báo cáo', RETURN_SOURCE: 'Sửa hồ sơ trình'
  };
  const transferPurposes = { ...reviewPurposes, TCT_ROUTE: 'Ban hành / luân chuyển hồ sơ TCT', SIGNED_DECISION: 'Ban hành Quyết định TĐ đã ký',
    RECEIVE_TCT_SOURCE: 'Xem VB TCT trình Tập đoàn', APP_DOCUMENTS: 'Xem kết quả thẩm định / trình Quyết định',
    RETURN_TCT: 'Tiếp nhận hồ sơ TĐ chuyển về TCT', PASS_RESULTS: 'Tiếp nhận Quyết định đã ban hành – Bước 5', APP_ROUTE: 'Xử lý hồ sơ thẩm định TĐ' };
  const step5Recipients = ['leader','appraisalLead','appraisalCoLead','tctClerk','tct'];
  const step5RoleNames = { appraisalLead: 'LĐ Ban Tập đoàn chủ trì', appraisalCoLead: 'LĐ Ban Tập đoàn phối hợp' };
  function receipt(r, from, to, purpose, details) {
    r.reviewTransferSequence = (r.reviewTransferSequence || 0) + 1;
    r.receipt = { id: r.reviewTransferSequence, from, to, purpose, fromName: roles[from], toName: roles[to], time: new Date().toISOString(), reportId: r.report && r.report.id, decisionId: r.decision && r.decision.id, note: details && details.note || '', files: details && details.files ? [...details.files] : [] };
  }
  function receiveReview(r, from, to, purpose, details) {
    if (r.mode !== 'REVIEW') throw new Error('Không phải hồ sơ rà soát');
    receipt(r, from, to, purpose, details); r.owner = to; r.viewer = to;
    r.phase = { DISPATCH_REVIEW: 'DISPATCH', ASSIGN_REVIEW: to === 'reviewCoLead' ? 'CO_ASSIGN' : 'ASSIGN',
      REVIEW_WORK: to === 'reviewCoPM' ? 'CO_WORK' : 'WORK', CO_REVIEW: 'CO_WORK', RETURN_RESULT: 'WORK',
      SIGN_REPORT: 'SIGN_MAIN', INITIAL_REPORT: 'SIGN_CO', SUBMIT_SIGNED: to === 'tct' ? 'LEGACY' : 'REVIEW_SUBMIT',
      REVISE_REPORT: 'WORK', RETURN_SOURCE: 'LEGACY' }[purpose];
    if (!r.phase) throw new Error('Mục đích chuyển không hợp lệ');
  }
  function receiveTCTClerk(r, details) {
    // Chuyển Văn thư chưa phải là lựa chọn nhánh rà soát.
    receipt(r, 'tct', 'tctClerk', 'TCT_ROUTE', details);
    r.phase = 'LEGACY'; r.owner = r.viewer = 'tctClerk';
  }
  function tctClerkRecipients(issue) {
    if (issue.transferredTo) return [];
    return issue.issued ? ['clerk','leader'] : ['reviewLead','reviewCoLead','tct','originalPM','clerk','leader'];
  }
  const canForwardTCT = (signed, issue, step) => !!signed && !!issue.issued && !issue.transferredTo && step === 'DONE';
  function receiveGroupSource(r, recipient, details) {
    if (r.mode !== 'APPRAISAL' || !['leader','clerk'].includes(recipient)) throw new Error('Người nhận TĐ không hợp lệ');
    r.groupRecipient = recipient; r.owner = r.viewer = recipient;
    r.phase = recipient === 'clerk' ? 'DISPATCH' : 'INBOX';
    receipt(r, 'tctClerk', recipient, 'RECEIVE_TCT_SOURCE', details);
  }
  function canViewAppraisalDocuments(r, viewer) {
    if (r.mode !== 'APPRAISAL' || !['leader','clerk'].includes(viewer)) return true;
    if (!owns(r, viewer) || !r.decision || !r.receipt || r.receipt.to !== viewer) return false;
    if (viewer === 'leader' && r.decisionApproval && r.decisionApproval.receiptId === r.receipt.id &&
        r.decisionApproval.decisionId === r.decision.id && r.decision.signed) return true;
    if (r.receipt.purpose === 'PASS_RESULTS') return !!r.decision.issued && r.receipt.decisionId === r.decision.id;
    if (r.receipt.purpose === 'SIGNED_DECISION') return r.signed && r.decision.signed && r.receipt.decisionId === r.decision.id;
    return !!r.report && r.receipt.purpose === 'APP_DOCUMENTS' && r.receipt.reportId === r.report.id && r.receipt.decisionId === r.decision.id;
  }
  function canUploadSignedDecision(r, viewer) {
    if (r.mode !== 'APPRAISAL' || viewer !== 'leader' || !owns(r, viewer) || r.signed || !r.receipt || r.receipt.to !== viewer) return false;
    return r.phase === 'SIGN_QD' && canViewAppraisalDocuments(r, viewer) ||
      r.phase === 'INBOX' && ['tctClerk','clerk'].includes(r.receipt.from) && r.receipt.purpose === 'RECEIVE_TCT_SOURCE';
  }
  function importSignedDecision(r, viewer, decision) {
    if (!canUploadSignedDecision(r, viewer)) throw new Error('Chỉ LĐ Tập đoàn đang nhận xử lý hồ sơ mới được upload Quyết định đã ký');
    if (!decision || decision.kind !== 'uploaded' || !decision.id) throw new Error('Chọn file Quyết định đã ký');
    if (!canViewAppraisalDocuments(r, viewer)) r.report = null;
    r.decision = decision; decision.official = true; decision.signed = true; decision.signatureSource = 'external';
    r.signed = true; r.ready = true;
    r.decisionApproval = { actor: viewer, receiptId: r.receipt.id, decisionId: decision.id, signatureSource: 'external' };
  }
  function reviewTask(r) {
    const x = r.receipt; if (!x || x.to !== r.owner) return '';
    if (r.owner === 'tctClerk' && x.purpose === 'DISPATCH_REVIEW') return 'dispatch';
    if (['reviewLead','reviewCoLead'].includes(r.owner) && ['tctClerk','tct'].includes(x.from) && x.purpose === 'ASSIGN_REVIEW') return 'assign';
    if (r.owner === 'reviewPM' && ((x.from === 'reviewLead' && x.purpose === 'REVIEW_WORK') || (x.from === 'reviewCoPM' && x.purpose === 'RETURN_RESULT') || (['reviewLead','reviewCoLead'].includes(x.from) && x.purpose === 'REVISE_REPORT'))) return 'work';
    if (r.owner === 'reviewCoPM' && ((x.from === 'reviewPM' && x.purpose === 'CO_REVIEW') || (x.from === 'reviewCoLead' && x.purpose === 'REVIEW_WORK'))) return 'co-work';
    if (r.owner === 'reviewLead' && x.from === 'reviewPM' && x.purpose === 'SIGN_REPORT') return 'sign';
    if (r.owner === 'reviewCoLead' && x.from === 'reviewLead' && x.purpose === 'INITIAL_REPORT') return 'initial';
    if (r.owner === 'reviewLead' && x.from === 'reviewCoLead' && x.purpose === 'SUBMIT_SIGNED') return 'submit';
    return '';
  }
  function canViewReviewReport(r, viewer) {
    if (r.mode !== 'REVIEW' || !['reviewLead','reviewCoLead'].includes(viewer)) return true;
    return owns(r, viewer) && !!r.report && r.receipt.reportId === r.report.id && ['sign','initial','submit'].includes(reviewTask(r));
  }
  function reviewAllowed(r, viewer) {
    const task = reviewTask(r);
    if (task === 'dispatch') return ['reviewLead','reviewCoLead','originalPM','tct'];
    if (task === 'assign') return [viewer === 'reviewLead' ? 'reviewPM' : 'reviewCoPM'];
    if (task === 'work') return ['originalPM','reviewCoPM','reviewLead'];
    if (task === 'co-work') return ['reviewPM'];
    if (task === 'sign') return r.report && r.report.mainSigned ? ['tct','reviewCoLead'] : [];
    if (task === 'initial') return r.report && r.report.mainSigned && r.report.coInitialled ? ['tct','reviewLead'] : [];
    if (task === 'submit') return r.report && r.report.mainSigned && r.report.coInitialled ? ['tct'] : [];
    return [];
  }
  function reviewTransfer(r, viewer, recipient, details) {
    const task = reviewTask(r); let purpose;
    if (task === 'dispatch') purpose = ['reviewLead','reviewCoLead'].includes(recipient) ? 'ASSIGN_REVIEW' : recipient === 'originalPM' ? 'RETURN_SOURCE' : 'SUBMIT_SIGNED';
    else if (task === 'assign') {
      purpose = 'REVIEW_WORK';
      if (recipient === 'reviewPM') r.mainAssigned = true;
      else { r.coRequested = true; r.coAssigned = true; r.coCompleted = false; }
    } else if (task === 'work') {
      if (recipient === 'originalPM') { purpose = 'RETURN_SOURCE'; r.ready = false; }
      else if (recipient === 'reviewCoPM') {
        purpose = 'CO_REVIEW'; r.coRequested = true; r.coAssigned = true; r.coCompleted = false; r.ready = false;
        if (r.report) { r.report.mainSigned = false; r.report.coInitialled = false; r.report.signed = false; }
      } else {
        if (!r.ready || !r.report || r.coRequested && !r.coCompleted) throw new Error('Hoàn thiện báo cáo và tổng hợp kết quả phối hợp đã giao trước khi trình LĐ chủ trì');
        purpose = 'SIGN_REPORT';
      }
    } else if (task === 'co-work') { purpose = 'RETURN_RESULT'; r.coCompleted = true; r.coAssigned = false; r.mainAssigned = true; }
    else if (task === 'sign') {
      purpose = recipient === 'reviewCoLead' ? 'INITIAL_REPORT' : 'SUBMIT_SIGNED';
      if (recipient === 'reviewCoLead') r.report.requiresInitial = true;
    } else if (task === 'initial' || task === 'submit') purpose = 'SUBMIT_SIGNED';
    if (!purpose) throw new Error('Không xác định được nhiệm vụ từ nguồn chuyển');
    receiveReview(r, viewer, recipient, purpose, details); return { consultation: false };
  }
  function create(type, mode) {
    const r = { type, mode, phase: mode === 'REVIEW' ? 'ASSIGN' : 'INBOX',
      owner: mode === 'REVIEW' ? 'reviewLead' : 'leader',
      mainAssigned: false, coAssigned: false, coRequested: false, coCompleted: false, ready: false, signed: false,
      report: null, decision: null, issue: { number: '', suffix: 'VNPT', date: '', eoffice: '' } };
    r.viewer = r.owner; if (mode === 'REVIEW') receipt(r, 'tctClerk', r.owner, 'ASSIGN_REVIEW'); return r;
  }
  const owns = (r, viewer) => r.owner === viewer && !['LEGACY', 'DONE'].includes(r.phase);
  function canEdit(r, viewer) {
    const u = units(r);
    return r.mode === 'APPRAISAL' && owns(r, viewer) && !r.ready &&
      ((viewer === u.pm && r.phase === 'WORK') || (viewer === u.coPM && r.phase === 'CO_WORK' && r.coAssigned));
  }
  const canPrepare = (r, viewer) => owns(r, viewer) && viewer === units(r).pm && r.phase === 'WORK' && !r.ready && (r.mode !== 'REVIEW' || reviewTask(r) === 'work');
  function canComplete(r, viewer) {
    return canPrepare(r, viewer) && !!r.report && (r.mode === 'REVIEW' ? !r.coRequested || r.coCompleted : !!r.decision && (!r.coRequested || r.coCompleted));
  }
  function canSign(r, viewer) {
    if (!owns(r, viewer)) return false;
    if (r.mode === 'REVIEW') return !!r.report && r.receipt.reportId === r.report.id && ((reviewTask(r) === 'sign' && !r.report.mainSigned) || (reviewTask(r) === 'initial' && r.report.mainSigned && !r.report.coInitialled));
    if (r.phase === 'SIGN_MAIN') return viewer === units(r).lead && r.report && !r.report.mainSigned;
    if (r.phase === 'SIGN_CO') return viewer === units(r).coLead && r.report && !r.report.coSigned;
    return r.phase === 'SIGN_QD' && viewer === 'leader' && r.decision && !r.signed && canViewAppraisalDocuments(r, viewer);
  }
  function canIssue(r, viewer) {
    return r.mode === 'APPRAISAL' && viewer === 'clerk' && owns(r, viewer) && r.phase === 'CLERK_SIGNED' &&
      r.decision && r.decision.signed && r.signed && canViewAppraisalDocuments(r, viewer) &&
      r.receipt.from === 'leader' && r.receipt.purpose === 'SIGNED_DECISION';
  }
  function groupClerkAfterLeader(r, viewer) {
    return r.mode === 'APPRAISAL' && viewer === 'clerk' && owns(r, viewer) &&
      ['CLERK_SIGNED','ISSUED'].includes(r.phase) && r.receipt && r.receipt.from === 'leader' &&
      r.receipt.to === viewer && r.receipt.purpose === 'SIGNED_DECISION' &&
      r.decision && r.decision.signed && r.signed && r.receipt.decisionId === r.decision.id;
  }
  function allowed(r, viewer) {
    if (!owns(r, viewer)) return [];
    if (r.mode === 'REVIEW') return reviewAllowed(r, viewer);
    if (r.phase === 'STEP5_RECEIVED') return [];
    const u = units(r);
    if (r.phase === 'ISSUED') return groupClerkAfterLeader(r, viewer) && r.decision.issued ? [...step5Recipients] : [];
    if (viewer === 'leader') return r.signed ? canViewAppraisalDocuments(r, viewer) ? ['clerk'] : [] : r.phase === 'SIGN_QD' ? [] : ['clerk'];
    if (r.phase === 'SIGN_MAIN') return r.report && r.report.mainSigned ? (r.mode === 'REVIEW' || r.coRequested ? [u.coLead] : [u.clerk]) : [];
    if (r.phase === 'SIGN_CO') return r.report && r.report.coSigned ? [r.mode === 'REVIEW' ? 'tct' : u.clerk] : [];
    if (viewer === u.lead && r.phase === 'ASSIGN') return [u.pm];
    if (viewer === u.coLead && r.phase === 'CO_ASSIGN') return [u.coPM];
    if (viewer === u.coPM && r.phase === 'CO_WORK' && r.coAssigned) return [r.mainAssigned ? u.pm : u.lead];
    if (viewer === u.pm && r.phase === 'WORK') return r.ready ? [u.lead, ...(r.mode === 'APPRAISAL' ? [u.clerk] : [])] : [u.coLead, ...(r.mode === 'APPRAISAL' ? [u.clerk] : []), 'consultKT', 'consultKH', 'consultTC'];
    if (viewer === u.clerk) {
      if (r.mode === 'REVIEW') return [u.lead, u.coLead, 'originalPM', 'tct'];
      if (r.phase === 'CLERK_SIGNED') return groupClerkAfterLeader(r, viewer) ? [...step5Recipients] : [];
      return [u.lead, u.coLead, 'tct', 'tctClerk', ...(r.phase === 'DISPATCH' && r.receipt?.purpose === 'RECEIVE_TCT_SOURCE' || r.phase === 'DECISION_ROUTE' && r.decision && r.report && r.report.mainSigned && (!r.report.requiresCo || r.report.coSigned) ? ['leader'] : [])];
    }
    return [];
  }
  function sign(r, viewer) {
    if (!canSign(r, viewer)) throw new Error('Vai trò/trạng thái không được ký văn bản');
    if (r.mode === 'REVIEW') {
      if (reviewTask(r) === 'sign') r.report.mainSigned = true; else r.report.coInitialled = true;
      r.report.signed = !!r.report.mainSigned; return;
    }
    if (r.phase === 'SIGN_QD') { r.signed = true; r.decision.signed = true; r.decision.signatureSource = 'digital';
      r.decisionApproval = { actor: viewer, receiptId: r.receipt.id, decisionId: r.decision.id, signatureSource: 'digital' }; }
    else if (r.phase === 'SIGN_MAIN') r.report.mainSigned = true;
    else r.report.coSigned = true;
    if (r.report) r.report.signed = !!r.report.mainSigned && (r.mode !== 'REVIEW' && !r.report.requiresCo || !!r.report.coSigned);
  }
  function complete(r, viewer) {
    if (!canComplete(r, viewer)) throw new Error(r.mode === 'REVIEW' ? 'Cần kết quả phối hợp và Báo cáo rà soát' : 'Cần Báo cáo thẩm định, dự thảo Quyết định và kết quả phối hợp đã giao');
    r.report.requiresCo = r.coRequested; r.ready = true;
  }
  function rejectReport(r, viewer) {
    if (!owns(r, viewer) || !['SIGN_MAIN', 'SIGN_CO'].includes(r.phase)) throw new Error('Không ở bước ký báo cáo');
    if (r.mode === 'REVIEW') {
      if (!['sign','initial'].includes(reviewTask(r))) throw new Error('Không ở nhiệm vụ ký báo cáo');
      r.report.mainSigned = false; r.report.coInitialled = false; r.report.requiresInitial = false; r.report.signed = false; r.ready = false;
      receiveReview(r, viewer, 'reviewPM', 'REVISE_REPORT'); return;
    }
    r.report.mainSigned = false; r.report.coSigned = false; r.ready = false;
    r.phase = 'WORK'; r.owner = units(r).pm; r.viewer = r.owner;
  }
  function returnSource(r, viewer, details) {
    if (!owns(r, viewer) || !((r.mode === 'REVIEW' && viewer === 'reviewPM' && reviewTask(r) === 'work') || viewer === units(r).clerk)) throw new Error('Không ở bước trả hồ sơ trình');
    if (r.mode === 'REVIEW') { receiveReview(r, viewer, 'originalPM', 'RETURN_SOURCE', details); r.ready = false; r.signed = false; return; }
    r.phase = 'LEGACY'; r.owner = 'originalPM'; r.viewer = r.owner; r.ready = false; r.signed = false;
  }
  function transfer(r, viewer, recipient, details) {
    if (!allowed(r, viewer).includes(recipient)) throw new Error('Người nhận không thuộc tuyến xử lý hiện tại');
    if (r.mode === 'REVIEW') return reviewTransfer(r, viewer, recipient, details);
    if (groupClerkAfterLeader(r, viewer) && r.phase !== 'ISSUED' && recipient !== 'leader') throw new Error('Ban hành Quyết định trước khi chuyển sang Bước 5');
    if (recipient.startsWith('consult')) return { consultation: true };
    const previousPhase = r.phase, previousPurpose = r.receipt && r.receipt.purpose;
    const signedDecision = r.signed && r.decision && r.decision.signed && canViewAppraisalDocuments(r, viewer);
    const u = units(r);
    if (r.phase === 'ISSUED') { r.phase = 'STEP5_RECEIVED'; r.owner = recipient; }
    else if (r.phase === 'SIGN_MAIN') { r.phase = recipient === u.coLead ? 'SIGN_CO' : 'DECISION_ROUTE'; r.owner = recipient; }
    else if (r.phase === 'SIGN_CO') { r.phase = r.mode === 'REVIEW' ? 'LEGACY' : 'DECISION_ROUTE'; r.owner = recipient; }
    else if (viewer === 'leader') { r.phase = r.signed ? 'CLERK_SIGNED' : r.decision ? 'DECISION_ROUTE' : 'DISPATCH'; r.owner = 'clerk'; }
    else if (recipient === 'leader') { r.phase = r.decision && ['APP_DOCUMENTS','SIGNED_DECISION'].includes(previousPurpose) ? r.signed ? 'CLERK_SIGNED' : 'SIGN_QD' : 'INBOX'; r.owner = recipient; }
    else if (recipient === 'originalPM' || recipient === 'tct' || recipient === 'tctClerk') { r.phase = 'LEGACY'; r.owner = recipient; }
    else if (recipient === u.lead) { r.phase = viewer === u.pm && r.ready ? 'SIGN_MAIN' : 'ASSIGN'; r.owner = recipient; if (viewer === u.clerk) { r.ready = false; r.signed = false; if (r.decision) r.decision.signed = false; if (r.report) { r.report.mainSigned = false; r.report.coSigned = false; } } if (viewer === u.coPM) { r.coCompleted = true; r.coAssigned = false; } }
    else if (recipient === u.coLead) { r.phase = 'CO_ASSIGN'; r.owner = recipient; r.coRequested = true; r.coCompleted = false; r.ready = false; }
    else if (recipient === u.coPM) { r.phase = 'CO_WORK'; r.owner = recipient; r.coAssigned = true; }
    else if (recipient === u.pm) { r.phase = 'WORK'; r.owner = recipient; r.mainAssigned = true; if (viewer === u.coPM) { r.coCompleted = true; r.coAssigned = false; } }
    else { r.owner = recipient; if (recipient === u.clerk && viewer === u.pm) r.phase = r.report && r.report.mainSigned && (!r.report.requiresCo || r.report.coSigned) ? 'DECISION_ROUTE' : 'DISPATCH'; }
    const purpose = previousPhase === 'ISSUED' ? 'PASS_RESULTS' : recipient === 'tctClerk' ? 'RETURN_TCT' :
      ['leader','clerk'].includes(recipient) && signedDecision && (viewer === 'leader' || previousPurpose === 'SIGNED_DECISION') ? 'SIGNED_DECISION' :
      ['leader','clerk'].includes(recipient) && r.report && r.decision && (viewer.startsWith('appraisal') || previousPurpose === 'APP_DOCUMENTS') ? 'APP_DOCUMENTS' :
      ['leader','clerk'].includes(recipient) && previousPurpose === 'RECEIVE_TCT_SOURCE' ? 'RECEIVE_TCT_SOURCE' : 'APP_ROUTE';
    receipt(r, viewer, recipient, purpose, details);
    if (purpose === 'PASS_RESULTS') r.receipt.toName = step5RoleNames[recipient] || roles[recipient];
    r.viewer = r.owner; return { consultation: false };
  }
  root.KHWorkflow = { roles, units, reviewPurposes, transferPurposes, step5Recipients, step5RoleNames, groupClerkAfterLeader, reviewTask, receiveReview, receiveTCTClerk, receiveGroupSource, canViewAppraisalDocuments, canUploadSignedDecision, importSignedDecision, tctClerkRecipients, canForwardTCT, canViewReviewReport, create, owns, canEdit, canPrepare, canComplete, canSign, canIssue, allowed, sign, complete, rejectReport, returnSource, transfer };
}(typeof window === 'undefined' ? globalThis : window));

(function () {
  'use strict';
  if (typeof document === 'undefined') return;
  const W = window.KHWorkflow, roles = W.roles;
  const types = ['Core di động', 'Vô tuyến', 'BRCĐ', 'CSHT'];
  const records = new Map(), listBadges = new WeakMap(), banDrafts = new Map();
  const step4 = 'KHPTM_TD';
  const newKeys = Object.keys(roles).filter(k => !['tct', 'tctClerk', 'originalPM', 'consultKT', 'consultKH', 'consultTC'].includes(k));
  let currentType = types[0], nextNumber = 100, exchangeAttachment = null, modalSnapshot = null;
  const now = () => new Date().toLocaleString('vi-VN', { hour12: false });
  const tag = type => ({ 'Core di động': 'Core', 'Vô tuyến': 'Vo_tuyen', 'BRCĐ': 'BRCD', 'CSHT': 'CSHT' })[type];
  const current = () => records.get(currentType);
  const log = (r, text, actor) => r.history.unshift({ actor: actor || roles[r.viewer], text, time: now() });
  const numberText = issue => issue.number ? issue.number + '/QĐ-' + (issue.suffix || 'VNPT') : '.../QĐ-VNPT';
  const isEditor = r => W.canPrepare(r, r.viewer);
  const status = r => r.mode === 'APPRAISAL' && r.phase !== 'STEP5_RECEIVED' && r.signed && r.owner === 'leader' ? 'Quyết định đã ký – chờ chuyển Văn thư' : r.mode === 'REVIEW' && r.phase === 'SIGN_MAIN' ? r.report && r.report.mainSigned ? 'Báo cáo đã ký chính thức – chờ chuyển' : 'Chờ ký chính thức báo cáo' : r.mode === 'REVIEW' && r.phase === 'SIGN_CO' ? r.report && r.report.coInitialled ? 'Báo cáo đã ký nháy – chờ trình' : 'Chờ ký nháy báo cáo' : ({ ASSIGN: 'Chờ phân công', WORK: r.ready ? 'Đã tổng hợp – chờ trình ký báo cáo' : 'Đang ' + (r.mode === 'REVIEW' ? 'rà soát' : 'thẩm định'),
    REVIEW_SUBMIT: 'Báo cáo đã ký hoàn tất – chờ trình LĐ TCT', CO_ASSIGN: 'Chờ phân công phối hợp', CO_WORK: 'Đang xử lý phối hợp', SIGN_MAIN: 'Chờ ký báo cáo chủ trì', SIGN_CO: 'Chờ ký báo cáo phối hợp',
    INBOX: 'Chờ LĐ TĐ cho ý kiến', DISPATCH: 'Chờ Văn thư luân chuyển', DECISION_ROUTE: 'Báo cáo đã ký – chờ trình Quyết định', SIGN_QD: 'Chờ LĐ TĐ ký Quyết định',
    CLERK_SIGNED: 'Chờ ban hành', ISSUED: 'Đã ban hành – chờ chuyển', STEP5_RECEIVED: 'Đã nhận Quyết định đã ban hành', DONE: 'Đã chuyển kết quả về NET', LEGACY: 'Đang trình tại TCT' })[r.phase];
  const flowLabel = r => r.phase === 'STEP5_RECEIVED' ? 'Bước 5 · Tiếp nhận Quyết định đã ban hành' : r.mode === 'REVIEW' ? 'Rà soát tại TCT' : 'Bước 4 · Thẩm định, phê duyệt TĐ';
  const roleName = (r, key) => r.phase === 'STEP5_RECEIVED' ? W.step5RoleNames[key] || roles[key] : roles[key];
  function sourcePaper(type, issue, signed) {
    return '<div style="text-align:center"><b>TỔNG CÔNG TY HẠ TẦNG MẠNG - VNPT NET</b></div><p>Số: ' + esc(issue.number || '...') + '/VNPT Net-' + esc(issue.suffix || 'KT') + '</p>' +
      (issue.date ? '<p style="text-align:right">Ngày ban hành: ' + esc(formatDateVN(issue.date)) + '</p>' : '') +
      '<h2>VĂN BẢN TRÌNH TẬP ĐOÀN</h2><h3>V/v trình phê duyệt Kế hoạch phát triển mạng ' + esc(type) + ' năm 2027</h3>' +
      '<p>Cần khảo sát khách hàng để chốt nội dung/field chi tiết của văn bản.</p><div class="sign"><b>LÃNH ĐẠO TỔNG CÔNG TY</b><br><br><br>' + (signed ? '(Đã ký số)' : '(Chờ ký)') + '</div>';
  }
  function captureContext() {
    return { type: khptm2DeviceType, role: khptm2Role, step: khptm2Step, issue: { ...khptm2ClerkIssue() },
      history: khptm2History.map(x => ({ ...x })), exchange: khptm2Exchange.map(x => ({ ...x })),
      banSigned: khptm2UnitLeaderSigned, tctSigned: khptm2LDTCTSigned, pairRole: khptmPairRecordRole };
  }
  function makeRecord(type, mode, incoming) {
    const saved = captureContext(); let extTemplate, formHtml;
    try {
      khptm2DeviceType = type; khptm2Role = 'Văn thư'; khptm2Step = 'B4'; khptm2Issue = saved.issue;
      extTemplate = khptm2ExtendedHtml();
      renderKHPTM2Specialist();
      const clone = document.getElementById('khptm2PanelSpecialist').cloneNode(true);
      clone.querySelectorAll('input,textarea,select').forEach(el => {
        if (el.tagName === 'SELECT') [...el.options].forEach(o => { o.selected = o.value === el.value; if (o.selected) o.setAttribute('selected', ''); else o.removeAttribute('selected'); });
        else if (el.tagName === 'TEXTAREA') el.textContent = el.value;
        else el.setAttribute('value', el.value);
      });
      clone.querySelectorAll('*').forEach(el => { [...el.attributes].filter(a => a.name.startsWith('on') || a.name === 'id' || a.name === 'aria-labelledby').forEach(a => el.removeAttribute(a.name)); });
      formHtml = clone.innerHTML;
    } finally {
      khptm2DeviceType = saved.type; khptm2Role = saved.role; khptm2Step = saved.step; khptm2Issue = saved.issue;
    }
    const base = W.create(type, mode), sourceIssue = { ...(incoming ? incoming.issue : saved.issue) };
    if (mode === 'APPRAISAL' && !incoming) W.receiveGroupSource(base, 'leader');
    return { ...base, id: 'KHPTM-' + tag(type) + '-2027', year: 2027, demo: !incoming, extTemplate, formHtml,
      submittedHtml: formHtml, appraisalValues: [], previewKind: 'report', sourceIssue, sourceHtml: sourcePaper(type, sourceIssue, !!incoming),
      sourceContext: saved, history: (incoming ? incoming.history : saved.history).map(x => ({ ...x })),
      exchange: (incoming ? incoming.exchange : saved.exchange).map(x => ({ ...x })), exchangeDraft: '', files: [], uploadToken: 0, reportDraft: '', extTab: 'exchange' };
  }
  function ensure(type, mode) {
    if (!records.has(type)) records.set(type, makeRecord(type, mode || 'APPRAISAL'));
    return records.get(type);
  }
  function restoreContext(r, key) {
    const saved = r.sourceContext;
    khptm2DeviceType = saved.type; khptmPairRecordRole = saved.pairRole || 'MAIN';
    khptm2Role = key ? key === 'tctClerk' ? 'Văn thư' : roles[key] : saved.role;
    khptm2Step = key ? ({ originalPM: 'B1', tct: 'B3', tctClerk: 'B4' })[key] : saved.step;
    khptm2History = r.history; khptm2Exchange = r.exchange;
    khptm2ClerkIssues[r.type] = { ...saved.issue }; khptm2Issue = khptm2ClerkIssues[r.type];
    khptm2UnitLeaderSigned = saved.banSigned; khptm2LDTCTSigned = saved.tctSigned;
  }
  function beginReview(recipient, from, details) {
    const type = khptm2DeviceType, existing = records.get(type), fresh = makeRecord(type, 'REVIEW');
    if (existing) { fresh.files = existing.files; fresh.report = existing.report; fresh.reportDraft = existing.reportDraft; }
    W.receiveReview(fresh, from || 'tct', recipient, recipient === 'tctClerk' ? 'DISPATCH_REVIEW' : 'ASSIGN_REVIEW', details);
    if (recipient === 'reviewCoLead') fresh.coRequested = true;
    if (fresh.report) { fresh.report.mainSigned = false; fresh.report.coSigned = false; fresh.report.coInitialled = false; fresh.report.requiresInitial = false; fresh.report.signed = false; }
    records.set(type, fresh); currentType = type; log(fresh, 'Yêu cầu rà soát; giữ nguyên hồ sơ trình và chuỗi ý kiến', roles[from || 'tct']); render();
  }
  function paper(r, file) {
    file = file || r.decision;
    if (file && file.docType === 'report') {
      const title = file.reportMode === 'REVIEW' ? 'BÁO CÁO RÀ SOÁT' : 'BÁO CÁO THẨM ĐỊNH';
      return '<div style="text-align:center"><b>' + (file.reportMode === 'REVIEW' ? 'TỔNG CÔNG TY HẠ TẦNG MẠNG - VNPT NET' : 'ĐƠN VỊ THẨM ĐỊNH TẬP ĐOÀN') + '</b></div><h2>' + title + '</h2><h3>Hồ sơ KHPTM ' + esc(r.type) + ' năm ' + r.year + '</h3><p style="white-space:pre-wrap">' + esc(file.content || 'Cần khảo sát khách hàng để chốt nội dung/field chi tiết của báo cáo.') + '</p><div class="sign"><b>LÃNH ĐẠO ĐƠN VỊ CHỦ TRÌ</b><br>' + (file.mainSigned ? file.reportMode === 'REVIEW' ? '(Đã ký chính thức – demo)' : '(Đã ký số – demo)' : '(Chờ ký)') + (file.reportMode === 'REVIEW' || file.requiresCo ? '<p><b>LÃNH ĐẠO ĐƠN VỊ PHỐI HỢP</b><br>' + (file.reportMode === 'REVIEW' ? file.coInitialled ? '(Đã ký nháy – demo)' : file.requiresInitial ? '(Chờ ký nháy)' : '(Ký nháy khi chuyển phối hợp)' : file.coSigned ? '(Đã ký số – demo)' : '(Chờ ký)') + '</p>' : '') + '</div>';
    }
    const title = r.type === 'Vô tuyến' ? 'Phê duyệt và ban hành Kế hoạch đầu tư phát triển mạng' : 'Phê duyệt Kế hoạch phát triển mạng';
    return '<div style="text-align:center"><b>TẬP ĐOÀN BƯU CHÍNH VIỄN THÔNG VIỆT NAM</b></div><p>Số: ' + esc(numberText(r.issue)) + '</p><p style="text-align:right">Ngày ban hành: ' + esc(formatDateVN(r.issue.date) || '...') + '</p><h2>QUYẾT ĐỊNH</h2><h3>' + title + ' ' + esc(r.type) + ' năm ' + r.year + '</h3><p>Cần khảo sát khách hàng để chốt nội dung và biểu mẫu chi tiết của quyết định.</p><div class="sign"><b>LÃNH ĐẠO TẬP ĐOÀN</b><br><br><br>' + (file && file.signed ? '(Đã ký số – demo)' : '(Chờ ký)') + '</div>';
  }
  function refreshGenerated(r, file) {
    if (!file || file.kind !== 'generated') return;
    file.html = paper(r, file);
    const html = '<!doctype html><html><head><meta charset="utf-8"><style>body{font-family:"Times New Roman",serif;margin:35pt;line-height:1.5}h2,h3{text-align:center}.sign{text-align:right;margin-top:36pt}</style></head><body>' + file.html + '</body></html>';
    if (file.url) URL.revokeObjectURL(file.url);
    file.blob = new Blob([html], { type: 'application/msword;charset=utf-8' }); file.url = URL.createObjectURL(file.blob);
    file.signed = file.docType === 'report' ? !!file.mainSigned && (file.reportMode === 'REVIEW' || !file.requiresCo || !!file.coSigned) : r.signed;
  }
  function createFile(r, docType, values) {
    const file = { id: r.id + '-VB-' + (r.files.length + 1), actor: roles[r.viewer], time: now(), docType,
      reportMode: r.mode, requiresCo: r.coRequested, mainSigned: false, coSigned: false, coInitialled: false, requiresInitial: false, signed: false, ...values };
    if (values.signatureSource === 'external') W.importSignedDecision(r, r.viewer, file);
    else { r[docType] = file; r.ready = false; if (docType === 'decision') { r.signed = false; r.decisionApproval = null; } }
    r.files.push(file); r.previewKind = docType;
    return file;
  }
  function generate(docType) {
    const r = current();
    if (!r || !W.canPrepare(r, r.viewer) || (docType === 'decision' && r.mode !== 'APPRAISAL')) return toast('Vai trò/trạng thái không được lập văn bản');
    const title = docType === 'report' ? r.mode === 'REVIEW' ? 'Bao_cao_ra_soat' : 'Bao_cao_tham_dinh' : 'Du_thao_Quyet_dinh';
    const file = createFile(r, docType, { kind: 'generated', name: title + '_KHPTM_' + tag(r.type) + '_' + r.year + '_v' + (r.files.length + 1) + '.doc', content: docType === 'report' ? r.mode === 'REVIEW' ? r.exchange.map(x => roles.reviewPM === x.actor || roles.reviewCoPM === x.actor ? x.actor + ': ' + (x.text || '') : '').filter(Boolean).reverse().join('\n\n') : r.reportDraft : '' });
    refreshGenerated(r, file); log(r, 'Lập ' + file.name + '; thêm vào Tài liệu đính kèm'); render();
  }
  async function upload(input, docType, signedDecision) {
    const r = current(), file = input.files && input.files[0];
    const canUpload = () => current() === r && (signedDecision ? docType === 'decision' && W.canUploadSignedDecision(r, r.viewer) : isEditor(r) && (docType !== 'decision' || r.mode === 'APPRAISAL'));
    if (!r || !file || !canUpload()) return;
    const viewer = r.viewer, received = r.receipt, decision = r.decision;
    const token = ++r.uploadToken;
    try {
      if (!/\.pdf$/i.test(file.name) || file.size > 32 * 1024 * 1024 || new TextDecoder().decode(await file.slice(0, 5).arrayBuffer()) !== '%PDF-') throw new Error('Chọn file PDF hợp lệ, dung lượng tối đa 32 MB');
      if (token !== r.uploadToken || r.viewer !== viewer || r.receipt !== received || r.decision !== decision || !canUpload()) return;
      createFile(r, docType, { kind: 'uploaded', name: file.name, blob: file, url: URL.createObjectURL(file), ...(signedDecision ? { signatureSource: 'external' } : {}) });
      log(r, (signedDecision ? 'Upload Quyết định TĐ đã ký bên ngoài: ' : 'Upload dự thảo: ') + file.name + '; thêm vào Tài liệu đính kèm'); render();
    } catch (error) { toast(error.message); } finally { input.value = ''; }
  }
  function approve() {
    const r = current(); if (!r) return;
    if (r.mode === 'APPRAISAL' && W.canPrepare(r, r.viewer) && !r.decisionOpened) { r.decisionOpened = true; r.previewKind = 'decision'; render(); return toast('Đã mở hồ sơ Quyết định liên kết; lập dự thảo để trình ký'); }
    try { W.complete(r, r.viewer); refreshGenerated(r, r.report); log(r, 'Hoàn thiện báo cáo và hồ sơ để trình ký'); render(); } catch (error) { toast(error.message); }
  }
  function sign() {
    const r = current(); if (!r) return;
    try { W.sign(r, r.viewer); refreshGenerated(r, r.phase === 'SIGN_QD' ? r.decision : r.report); log(r, r.phase === 'SIGN_QD' ? 'Ký số Quyết định (demo)' : (r.mode === 'REVIEW' && W.reviewTask(r) === 'initial' ? 'Ký nháy Báo cáo rà soát (demo)' : 'Ký chính thức Báo cáo ' + (r.mode === 'REVIEW' ? 'rà soát' : 'thẩm định') + ' (demo)')); render(); } catch (error) { toast(error.message); }
  }
  function rejectReport() {
    const r = current(); if (!r) return; const actor = roles[r.viewer];
    try { W.rejectReport(r, r.viewer); refreshGenerated(r, r.report); log(r, 'Trả PM chủ trì sửa báo cáo; giữ nguyên hồ sơ trình', actor); render(); } catch (error) { toast(error.message); }
  }
  function returnSource() { transfer('returnSource'); }
  function updateIssue() {
    const r = current(); if (!r || !W.canIssue(r, r.viewer)) return;
    ['Number', 'Suffix', 'Date', 'Eoffice'].forEach(key => { const input = document.getElementById('kh4Issue' + key); if (input) r.issue[key.toLowerCase()] = input.value.trim(); });
    // File scan giữ nguyên byte; chỉ cập nhật metadata. Văn bản sinh từ template được cập nhật preview.
    if (r.decision.kind === 'generated') { refreshGenerated(r, r.decision); const host = document.getElementById('kh4Paper'); if (host) host.innerHTML = paper(r); }
  }
  function takeNumber() {
    const r = current(); if (!r || !W.canIssue(r, r.viewer)) return;
    while ([...records.values()].some(x => x.issue.number === String(nextNumber))) nextNumber++;
    document.getElementById('kh4IssueNumber').value = String(nextNumber++); updateIssue(); toast('Đã lấy số quyết định (demo)');
  }
  function issue() {
    const r = current(); if (!r || !W.canIssue(r, r.viewer)) return toast('Quyết định chưa được ký hoặc chưa chuyển Văn thư');
    updateIssue(); if (!r.issue.number || !r.issue.date) return toast('Nhập Số quyết định và Ngày ban hành');
    if ([r.issue.number, r.issue.suffix, r.issue.eoffice].some(v => /[<>]/.test(v))) return toast('Thông tin văn bản không được chứa ký tự < hoặc >');
    r.phase = 'ISSUED'; r.decision.issued = true; refreshGenerated(r, r.decision);
    log(r, 'Ban hành Quyết định: ' + numberText(r.issue) + ' ngày ' + formatDateVN(r.issue.date)); render();
  }
  function button(label, action, enabled, css) { return '<button' + (css ? ' class="' + css + '"' : '') + ' onclick="' + action + '"' + (enabled ? '' : ' disabled') + '>' + label + '</button>'; }
  function actions(r) {
    const own = W.owns(r, r.viewer), u = W.units(r);
    if (r.phase === 'STEP5_RECEIVED') return button('Xem Quyết định Tập đoàn', "kh4.previewDocument('decision')", !!r.decision) +
      button('Xem VB TCT trình Tập đoàn', 'kh4.previewSource()', true) + (r.report ? button('Xem Báo cáo thẩm định', "kh4.previewDocument('report')", true) : '');
    if (r.mode === 'REVIEW' && [u.lead,u.coLead].includes(r.viewer) && !W.canViewReviewReport(r, r.viewer)) return button('Chuyển', 'kh4.transfer()', W.allowed(r, r.viewer).length > 0);
    let html = r.mode === 'REVIEW' ? button('Xem Tờ trình LĐ TCT', 'kh4.previewSubmission()', true) + button('Xem dự thảo VB trình Tập đoàn', 'kh4.previewSource()', true) : button('Xem VB TCT trình Tập đoàn', 'kh4.previewSource()', true);
    if (r.mode === 'REVIEW') html += button('Xem Báo cáo rà soát', "kh4.previewDocument('report')", !!r.report);
    else if (W.canViewAppraisalDocuments(r, r.viewer)) html += button('Xem Báo cáo thẩm định', "kh4.previewDocument('report')", !!r.report) + button(r.signed ? 'Xem Quyết định Tập đoàn' : 'Xem dự thảo Quyết định', "kh4.previewDocument('decision')", !!r.decision);
    if ([u.pm, u.coPM].includes(r.viewer)) {
      if (r.viewer === u.pm) html += button(r.mode === 'REVIEW' ? 'Hoàn thiện báo cáo' : 'Duyệt', 'kh4.approve()', W.canPrepare(r, r.viewer));
      if (r.mode === 'REVIEW' && r.viewer === u.pm) html += button('Trả PM lập hồ sơ', 'kh4.returnSource()', own && W.reviewTask(r) === 'work', 'khptm-danger');
    }
    if ([u.lead, u.coLead].includes(r.viewer) && ['SIGN_MAIN', 'SIGN_CO'].includes(r.phase)) html += button(r.mode === 'REVIEW' && r.phase === 'SIGN_CO' ? 'Ký nháy Báo cáo' : 'Ký số Báo cáo', 'kh4.sign()', W.canSign(r, r.viewer)) + button('Trả sửa báo cáo', 'kh4.rejectReport()', own, 'khptm-danger');
    if (r.viewer === 'leader' && r.phase === 'SIGN_QD') html += button('Ký số Quyết định', 'kh4.sign()', W.canSign(r, r.viewer));
    if (r.viewer === 'leader' && W.canUploadSignedDecision(r, r.viewer)) html += button('Upload Quyết định đã ký bên ngoài', "document.getElementById('kh4SignedDecisionUpload').click()", true);
    if (r.viewer === u.clerk) html += button('Ban hành', 'kh4.issue()', W.canIssue(r, r.viewer));
    return html + button(r.viewer === 'leader' ? 'Chuyển Văn thư' : 'Chuyển', 'kh4.transfer()', W.allowed(r, r.viewer).length > 0);
  }
  function previewContent(r, file) {
    if (!file) return '<div class="mini" style="padding:30px 0">Chưa có văn bản. Đơn vị chủ trì lập văn bản để trình ký.</div>';
    return file.kind === 'uploaded' ? '<iframe class="kh4-pdf" title="' + esc(file.name) + '" src="' + file.url + '"></iframe>' : '<div id="kh4Paper" class="khptm-paper">' + (file.html || paper(r, file)) + '</div>';
  }
  function previewHtml(r) {
    const canViewAppraisal = W.canViewAppraisalDocuments(r, r.viewer);
    if (!canViewAppraisal) r.previewKind = 'source';
    const canViewReport = W.canViewReviewReport(r, r.viewer) && canViewAppraisal;
    if (!canViewReport && r.previewKind === 'report') r.previewKind = 'source';
    const file = r[r.previewKind], doc = r.previewKind === 'report' ? r.mode === 'REVIEW' ? 'Báo cáo rà soát' : 'Báo cáo thẩm định' : 'Quyết định';
    let html = '<div class="section"><h3>Văn bản trình ký / ban hành</h3><div class="body">';
    if (r.mode === 'APPRAISAL' && canViewAppraisal && (r.viewer === 'clerk' || r.viewer === 'tctClerk')) {
      const locked = !W.canIssue(r, r.viewer) ? ' readonly' : '';
      html += '<div class="khptm-issue-grid" style="margin-bottom:12px"><div><label>Số quyết định <span class="req">*</span></label><div style="display:flex;gap:6px"><input id="kh4IssueNumber" value="' + esc(r.issue.number) + '" oninput="kh4.updateIssue()"' + locked + ' style="min-width:0;flex:1">' + button('Lấy số', 'kh4.takeNumber()', !locked) + '</div></div><div><label>Hậu tố</label><input id="kh4IssueSuffix" value="' + esc(r.issue.suffix) + '" oninput="kh4.updateIssue()"' + locked + '></div><div><label>Ngày ban hành <span class="req">*</span></label><input id="kh4IssueDate" type="date" value="' + esc(r.issue.date) + '" oninput="kh4.updateIssue()"' + locked + '></div><div><label>Số eOffice/VBKS</label><input id="kh4IssueEoffice" value="' + esc(r.issue.eoffice) + '" oninput="kh4.updateIssue()"' + locked + '></div></div>';
    }
    if (r.mode === 'REVIEW' && r.viewer === 'tctClerk') {
      html += '<div class="khptm-issue-grid" style="margin-bottom:12px"><div><label>Số văn bản</label><input value="' + esc(r.sourceIssue.number || '') + '" readonly></div><div><label>Hậu tố</label><input value="' + esc(r.sourceIssue.suffix || 'KT') + '" readonly></div><div><label>Ngày ban hành</label><input type="date" value="' + esc(r.sourceIssue.date || '') + '" readonly></div><div><label>Số eOffice/VBKS</label><input value="' + esc(r.sourceIssue.eoffice || '') + '" readonly></div></div>';
      return html + '<div class="khptm-doc-preview"><div class="khptm-paper">' + r.sourceHtml + '</div></div></div></div>';
    }
    html += '<div class="toolbar" style="margin-bottom:10px"><label for="kh4Document">Văn bản xem trước</label><select id="kh4Document" onchange="kh4.selectDocument(this.value)">' + (canViewReport ? '<option value="report"' + (r.previewKind === 'report' ? ' selected' : '') + '>' + (r.mode === 'REVIEW' ? 'Báo cáo rà soát' : 'Báo cáo thẩm định') + '</option>' : '') + (r.mode === 'APPRAISAL' ? (canViewAppraisal ? '<option value="decision"' + (r.previewKind === 'decision' ? ' selected' : '') + '>Quyết định Tập đoàn</option>' : '') + '<option value="source"' + (r.previewKind === 'source' ? ' selected' : '') + '>VB TCT trình Tập đoàn</option>' : '<option value="source"' + (r.previewKind === 'source' ? ' selected' : '') + '>Tờ trình LĐ TCT</option>') + '</select>';
    if (file) html += '<a class="linklike" href="' + file.url + '" download="' + esc(file.name) + '">Tải văn bản</a>';
    if (isEditor(r) && r.previewKind !== 'source') {
      html += button('Upload ' + doc, "document.getElementById('kh4Upload').click()", true);
      html += button(r.previewKind === 'report' ? 'Lập báo cáo' : 'Sinh quyết định tự động', "kh4.generate('" + r.previewKind + "')", true);
    }
    html += '</div>';
    if (r.mode === 'APPRAISAL' && r.previewKind === 'report' && W.canPrepare(r, r.viewer)) html += '<label for="kh4ReportDraft">Nội dung báo cáo</label><textarea id="kh4ReportDraft" placeholder="Cần khảo sát khách hàng để chốt nội dung/field chi tiết của báo cáo" oninput="kh4.reportInput(this.value)" style="min-height:100px;margin-bottom:10px">' + esc(r.reportDraft) + '</textarea>';
    html += '<div class="khptm-doc-preview">' + (r.previewKind === 'source' ? '<div class="khptm-paper">' + (r.mode === 'REVIEW' ? submissionPaper(r) : r.sourceHtml) + '</div>' : previewContent(r, file)) + '</div>';
    return html + '<input id="kh4Upload" type="file" accept="application/pdf,.pdf" style="display:none" onchange="kh4.upload(this,document.getElementById(\'kh4Document\').value)">' +
      (W.canUploadSignedDecision(r, r.viewer) ? '<input id="kh4SignedDecisionUpload" type="file" accept="application/pdf,.pdf" style="display:none" onchange="kh4.upload(this,\'decision\',true)">' : '') + '</div></div>';
  }
  function formHtml(r) {
    const holder = document.createElement('div'); holder.innerHTML = r.submittedHtml;
    const editable = W.canEdit(r, r.viewer);
    holder.querySelectorAll('input,select,textarea,button').forEach(el => { el.disabled = true; el.removeAttribute('onchange'); });
    if (r.mode === 'APPRAISAL') {
      holder.querySelectorAll('.kh2-detail-placeholder,.kh2-source-card .v').forEach((el, i) => {
        const field = document.createElement('textarea'); field.className = 'kh4-business'; field.setAttribute('aria-label', 'Nội dung thẩm định ' + (i + 1));
        field.value = r.appraisalValues[i] === undefined ? el.textContent : r.appraisalValues[i]; field.textContent = field.value; field.disabled = !editable;
        field.setAttribute('oninput', 'kh4.saveBusiness(' + i + ',this.value)'); field.style.minHeight = '90px'; el.replaceWith(field);
      });
    }
    return holder.innerHTML;
  }
  function saveBusiness(index, value) { const r = current(); if (r && W.canEdit(r, r.viewer)) { r.appraisalValues[index] = value; r.businessChanged = true; } }
  function reportInput(value) {
    const r = current(); if (!r || !W.canPrepare(r, r.viewer)) return;
    r.reportDraft = value;
    if (r.report && r.report.kind === 'generated') { r.report.content = value; r.report.mainSigned = false; r.report.coSigned = false; refreshGenerated(r, r.report); const host = document.getElementById('kh4Paper'); if (host) host.innerHTML = paper(r, r.report); }
  }
  function selectDocument(value) { const r = current(); if (r && ['report', 'decision', 'source'].includes(value) && (value === 'source' || W.canViewAppraisalDocuments(r, r.viewer))) { r.previewKind = value; render(); } }
  function docRow(index, r, file, action, main) {
    const issued = file.issued, decision = file.docType === 'decision';
    const issue = decision ? r.issue : r.sourceIssue;
    const number = issued ? (decision ? numberText(issue) : (issue.number || '...') + '/VNPT Net-' + issue.suffix) : '';
    return '<tr><td class="center">' + index + '</td><td class="center">' + (file.signed ? '☒' : '☐') + '</td><td class="center"><input type="checkbox" checked disabled></td>' +
      '<td class="center"><input type="checkbox" ' + (main ? 'checked' : '') + ' disabled></td><td class="center"><input type="checkbox" ' + (!main ? 'checked' : '') + ' disabled></td>' +
      '<td>' + esc(number) + (issued && issue.date ? '<br><span class="mini">' + esc(formatDateVN(issue.date)) + '</span>' : '') + '</td><td>' + esc(issued ? issue.eoffice || '' : '') + '</td>' +
      '<td>' + (decision || file.docType === 'report' && file.reportMode === 'APPRAISAL' ? 'Tập đoàn' : 'VNPT Net') + '</td><td>' + (file.signed ? decision ? 'LĐ Tập đoàn' : file.docType === 'report' ? 'LĐ ĐV chủ trì' + (file.reportMode === 'REVIEW' ? file.coInitialled ? ' / LĐ phối hợp ký nháy' : '' : file.coSigned ? ' / phối hợp' : '') : 'LĐTCT' : '--') + '</td><td><select disabled><option>' + (decision ? 'Quyết định phê duyệt' : file.docType === 'report' ? file.reportMode === 'REVIEW' ? 'Báo cáo rà soát' : 'Báo cáo thẩm định' : file.group || 'VB trình TĐ') + '</option></select></td>' +
      '<td><span class="pm-ext-file" onclick="' + action + '">' + esc(file.name) + '</span></td><td>' + esc(file.actor || 'Chuyên viên Ban KT') + '</td><td>' + esc(file.time || '') + '</td><td></td><td></td>' +
      '<td><button class="pm-ext-action" onclick="' + action + '">Xem</button>' + (file.url ? ' <a class="pm-ext-action" href="' + file.url + '" download="' + esc(file.name) + '">Tải</a>' : '') + '</td></tr>';
  }

  function renderExtended(r) {
    const host = document.getElementById('kh4Extended');
    host.innerHTML = r.extTemplate.replaceAll('khptm2', 'kh4').replaceAll('switchKHPTM2ExtTab', 'kh4.extTab').replaceAll('sendKHPTM2Exchange', 'kh4.sendExchange').replaceAll('kh4ExchangeFileChanged', 'kh4.exchangeFileChanged');
    // Chỉ thay dữ liệu/handler trong bản sao của bước 4; giữ bảng, cột và tab theo pattern cũ.
    const table = host.querySelector('.pm-ext-table tbody');
    const source = { name: 'VB_TCT_trinh_TD_KHPTM_' + tag(r.type) + '_' + r.year + '.pdf', signed: r.sourceContext.tctSigned, issued: !!r.sourceIssue.issued, group: 'VB trình TĐ' };
    let rows = docRow(1, r, source, 'kh4.previewSource()', true);
    rows += docRow(2, r, { name: 'To_trinh_LDTCT_KHPTM_' + tag(r.type) + '_' + r.year + '.docx', signed: r.sourceContext.banSigned, issued: false, group: 'Tờ trình LĐ TCT' }, 'kh4.previewSubmission()', false);
    rows += docRow(3, r, { name: 'KHPTM_' + tag(r.type) + '_' + r.year + '.xlsx', signed: false, issued: false, group: 'Hồ sơ KHPTM' }, "toast('Mở hồ sơ KHPTM liên quan (demo)')", false);
    r.files.forEach((file, index) => { if (file.docType === 'report' && !W.canViewReviewReport(r, r.viewer) || file.reportMode === 'APPRAISAL' && !W.canViewAppraisalDocuments(r, r.viewer)) return; rows += docRow(index + 4, r, file, 'kh4.previewFile(' + index + ')', file === r[r.previewKind]); });
    table.innerHTML = rows;
    const ta = document.getElementById('kh4QuickExchange'); if (ta) { ta.value = r.exchangeDraft; ta.oninput = () => { r.exchangeDraft = ta.value; }; }
    const attach = document.getElementById('kh4ExchangeFile'); if (attach) attach.onchange = () => exchangeFileChanged(attach);
    const attachName = document.getElementById('kh4ExchangeFileName'); if (attachName) attachName.textContent = exchangeAttachment && exchangeAttachment.record === r.id ? exchangeAttachment.file.name : 'Chưa chọn tệp';
    renderHistory(r); renderExchange(r); extTab(r.extTab || 'files', host.querySelector('[data-kh4-ext="' + (r.extTab || 'files') + '"]'));
  }

  function renderHistory(r) {
    const host = document.getElementById('kh4History');
    if (host) host.innerHTML = r.history.map(x => '<div class="history-item"><div class="history-dot"></div><div><b>' + esc(x.actor) + '</b><div>' + esc(x.text) + '</div><div class="mini">' + esc(x.time) + '</div></div></div>').join('');
  }

  function renderExchange(r) {
    const host = document.getElementById('kh4Exchange');
    if (window.khInfo) return window.khInfo.renderExchangeInto(host, r.exchange);
    if (host) host.innerHTML = r.exchange.length ? r.exchange.map(x => '<div class="history-item"><div class="history-dot"></div><div><b>' + esc(x.actor) + '</b><div>' + esc(x.text || '') + '</div>' +
      (x.file ? '<div class="mini">' + (x.url ? '<a href="' + x.url + '" download="' + esc(x.file) + '">' + esc(x.file) + '</a>' : esc(x.file)) + '</div>' : '') + '<div class="mini">' + esc(x.time) + '</div></div></div>').join('') : '<div class="mini" style="padding:8px">Chưa có nội dung trao đổi.</div>';
  }

  function extTab(name, el) {
    const r = current(); if (r) r.extTab = name;
    ['files', 'route', 'exchange'].forEach(n => { const pane = document.getElementById('kh4Ext' + n[0].toUpperCase() + n.slice(1)); if (pane) pane.classList.toggle('active', n === name); });
    document.querySelectorAll('#kh4Extended .pm-ext-tab').forEach(tab => tab.classList.toggle('active', tab === el || tab.dataset.kh4Ext === name));
  }

  function exchangeFileChanged(input) { const r = current(); if (r) { exchangeAttachment = input.files[0] ? { record: r.id, file: input.files[0] } : null; const el = document.getElementById('kh4ExchangeFileName'); if (el) el.textContent = exchangeAttachment ? exchangeAttachment.file.name : 'Chưa chọn tệp'; } }
  function sendExchange() {
    const r = current(); if (!r || r.phase === 'DONE') return toast('Hồ sơ đã hoàn tất');
    const ta = document.getElementById('kh4QuickExchange'), text = ta.value.trim(), file = exchangeAttachment && exchangeAttachment.record === r.id ? exchangeAttachment.file : null;
    if (!text && !file) return toast('Nhập ý kiến hoặc tải tệp lên');
    r.exchange.unshift({ actor: roles[r.viewer], text, file: file ? file.name : '', url: file ? URL.createObjectURL(file) : '', time: now() });
    r.exchangeDraft = ''; exchangeAttachment = null; renderExtended(r); toast('Đã gửi ý kiến');
  }

  function showPreview(title, html) { document.getElementById('khptmPreviewTitle').textContent = title; document.getElementById('khptmPreviewPaper').innerHTML = html; document.getElementById('khptmPreviewModal').classList.add('show'); }
  function previewSource() { const r = current(); if (r) showPreview('VB TCT trình Tập đoàn – ' + r.type, r.sourceHtml); }
  function submissionPaper(r) { return '<h2>TỜ TRÌNH</h2><h3>Về việc thông qua KHPTM ' + esc(r.type) + ' năm ' + r.year + '</h3><p>Cần khảo sát khách hàng để chốt nội dung/field chi tiết của Tờ trình.</p><div class="sign"><b>LÃNH ĐẠO BAN KT</b><br>' + (r.sourceContext.banSigned ? '(Đã ký số)' : '(Chờ ký)') + '</div>'; }
  function previewSubmission() { const r = current(); if (r) showPreview('Tờ trình LĐ TCT – ' + r.type, submissionPaper(r)); }
  function previewFile(index) {
    const r = current(), file = r && r.files[index]; if (!file || file.docType === 'report' && !W.canViewReviewReport(r, r.viewer) || file.reportMode === 'APPRAISAL' && !W.canViewAppraisalDocuments(r, r.viewer)) return;
    showPreview(file.name, file.kind === 'uploaded' ? '<iframe class="kh4-pdf" title="' + esc(file.name) + '" src="' + file.url + '"></iframe>' : file.html || paper(r, file));
  }
  function previewDocument(kind) {
    const r = current(); if (!r || !r[kind]) return toast('Chưa có văn bản');
    previewFile(r.files.indexOf(r[kind]));
  }
  function registerRecipients() {
    const r = current(), step5Route = r && W.groupClerkAfterLeader(r, r.viewer);
    Object.entries(roles).forEach(([key, defaultName]) => {
      const name = step5Route ? W.step5RoleNames[key] || defaultName : defaultName;
      const id = 'khw_' + key;
      const existing = routeRecipients.find(x => x.id === id);
      if (existing) { existing.name = name; existing.title = name; }
      else routeRecipients.push({ id, name, title: name, unit: key.startsWith('review') || ['tct','tctClerk','originalPM'].includes(key) ? 'VNPT NET' : key.startsWith('consult') ? 'Ban/đơn vị liên quan theo RACI' : 'Tập đoàn' });
    });
  }
  function transfer(kind) {
    const r = current(), type = khptm2DeviceType;
    kind = kind || 'workflow';
    let allowed;
    if (kind === 'tct') {
      if (khptm2Role !== 'LĐTCT' || khptm2Step !== 'B3') return;
      allowed = ['reviewLead', 'reviewCoLead', 'tctClerk'];
    } else if (kind === 'tctClerk') {
      if (khptm2Role !== 'Văn thư' || !['B4','DONE'].includes(khptm2Step)) return;
      allowed = W.tctClerkRecipients(khptm2ClerkIssue());
    } else if (kind === 'returnSource') {
      if (!r || !W.owns(r, r.viewer) || r.mode !== 'REVIEW' || r.viewer !== 'reviewPM' || W.reviewTask(r) !== 'work') return;
      allowed = ['originalPM'];
    } else allowed = r && W.allowed(r, r.viewer);
    if (!allowed || !allowed.length) return toast('Vai trò/trạng thái không được chuyển hồ sơ');
    registerRecipients(); pendingTransferAction = 'kh4Transfer'; currentTransferCfg = { main: '', co: [], send: [], allowed: allowed.map(k => 'khw_' + k) };
    const modal = document.getElementById('transferModal');
    modalSnapshot = { kind, type, viewer: r && r.viewer, phase: r && r.phase, receipt: r && r.receipt, legacyRole: khptm2Role, legacyStep: khptm2Step,
      allowed, summary: modal.querySelector('.route-opinion-summary').innerHTML,
      rows: ['routeSignFileRow', 'routeIssueFileRow'].map(id => { const row = document.getElementById(id); return { row, html: row.innerHTML, display: row.style.display }; }) };
    modal.classList.add('kh4-route'); document.getElementById('routeReceiverSearch').value = ''; renderRouteRecipients();
    const issue = khptm2ClerkIssue(), legacy = kind === 'tct' || kind === 'tctClerk';
    const files = [{ name: 'VB_TCT_trinh_TD_KHPTM_' + tag(type) + '_2027' + (kind === 'tctClerk' && issue.issued ? '_' + issue.number : '') + '.pdf', preview: legacy ? "openKHPTM2Preview('outgoing')" : 'kh4.previewSource()' }];
    if (r && r.report && W.canViewReviewReport(r, r.viewer) && W.canViewAppraisalDocuments(r, r.viewer) && r.mode === (kind === 'workflow' || kind === 'returnSource' ? r.mode : 'REVIEW')) files.push({ name: r.report.name, preview: "kh4.previewDocument('report')" });
    if (r && r.decision && W.canViewAppraisalDocuments(r, r.viewer) && kind === 'workflow') files.push({ name: r.decision.name, preview: "kh4.previewDocument('decision')" });
    if (files.length === 1) files.push({ name: 'To_trinh_LDTCT_KHPTM_' + tag(type) + '_2027.docx', preview: legacy ? "openKHPTM2Preview('submission')" : 'kh4.previewSubmission()' });
    modalSnapshot.rows.forEach((entry, i) => {
      entry.row.querySelector('.route-file-name').textContent = files[i].name;
      entry.row.querySelector('.route-check').checked = true; entry.row.style.display = '';
      entry.row.querySelectorAll('[onclick]').forEach(el => { const action = el.getAttribute('onclick'); if (action.includes('openTransferPreview')) el.setAttribute('onclick', files[i].preview); });
    });
    if (files[2]) {
      const row = modalSnapshot.rows[1].row.cloneNode(true); row.id = 'kh4ExtraRouteFile';
      row.querySelector('.route-file-name').textContent = files[2].name;
      row.querySelectorAll('[onclick]').forEach(el => { const action = el.getAttribute('onclick'); if (action.includes('kh4.previewDocument') || action.includes('openTransferPreview')) el.setAttribute('onclick', files[2].preview); });
      row.querySelectorAll('[id]').forEach(el => el.removeAttribute('id')); modalSnapshot.rows[1].row.after(row);
    }
    const history = kind === 'tct' || kind === 'tctClerk' ? khptm2History : r.history;
    const exchange = kind === 'tct' || kind === 'tctClerk' ? khptm2Exchange : r.exchange;
    modal.querySelector('.route-opinion-summary').innerHTML = '<div><b>Tổng hợp ý kiến</b></div>' + [...history, ...exchange].map(x => '<div class="route-opinion-row"><b>' + esc(x.actor) + '</b><div class="mini">' + esc(x.time) + ' · ' + esc(x.text || '') + '</div></div>').join('');
    document.getElementById('transferNote').value = ''; switchRouteTab('receiver'); modal.classList.add('show');
  }
  function restoreModal() {
    if (!modalSnapshot) return;
    const modal = document.getElementById('transferModal'); modal.classList.remove('kh4-route'); modal.querySelector('.route-opinion-summary').innerHTML = modalSnapshot.summary;
    modalSnapshot.rows.forEach(x => { x.row.innerHTML = x.html; x.row.style.display = x.display; });
    document.getElementById('kh4ExtraRouteFile')?.remove(); document.getElementById('kh4RouteNotice')?.remove(); document.getElementById('kh4Step5RouteNotice')?.remove(); modalSnapshot = null;
  }
  function showGroupClerkRouteState() {
    const r = current();
    if (!modalSnapshot || modalSnapshot.kind !== 'workflow' || !r || !W.groupClerkAfterLeader(r, r.viewer) || r.phase === 'ISSUED') return;
    let notice = document.getElementById('kh4Step5RouteNotice');
    if (!notice) {
      notice = document.createElement('div'); notice.id = 'kh4Step5RouteNotice'; notice.className = 'mini'; notice.setAttribute('role','status'); notice.style.marginBottom = '8px';
      document.getElementById('routeRecipientRows').closest('table').before(notice);
    }
    notice.textContent = 'Ban hành Quyết định trước khi chuyển sang Bước 5. Có thể chuyển lại LĐ Tập đoàn để xử lý.';
    W.step5Recipients.filter(key => key !== 'leader').forEach(key => {
      const radio = document.querySelector('#routeRecipientRows input[name="routeMain"][value="khw_' + key + '"]');
      if (radio) { radio.disabled = true; radio.checked = false; radio.closest('tr').title = notice.textContent; }
    });
  }
  function showTCTRouteState() {
    if (!modalSnapshot || modalSnapshot.kind !== 'tctClerk' || pendingTransferAction !== 'kh4Transfer') return;
    const issue = khptm2ClerkIssue(), ready = W.canForwardTCT(khptm2LDTCTSigned, issue, khptm2Step);
    let notice = document.getElementById('kh4RouteNotice');
    if (ready) { notice?.remove(); return; }
    if (!notice) {
      notice = document.createElement('div'); notice.id = 'kh4RouteNotice'; notice.className = 'mini';
      notice.setAttribute('role','status'); notice.style.marginBottom = '8px';
      document.getElementById('routeRecipientRows').closest('table').before(notice);
    }
    notice.textContent = !khptm2LDTCTSigned ? 'Chưa thể chuyển TĐ: VB TCT đang chờ LĐ TCT ký. Chuyển về LĐ TCT để ký, sau đó Văn thư ban hành.' :
      !issue.issued ? 'Chưa thể chuyển TĐ: VB TCT đã ký nhưng chưa ban hành. Đóng popup, chọn Ban hành, rồi mở Chuyển.' :
      'Chưa thể chuyển TĐ: hồ sơ chưa ở trạng thái chờ chuyển văn bản đã ban hành.';
    ['clerk','leader'].forEach(key => {
      const radio = document.querySelector('#routeRecipientRows input[name="routeMain"][value="khw_' + key + '"]');
      if (radio) { radio.disabled = true; radio.checked = false; radio.closest('tr').title = notice.textContent; }
    });
  }
  function confirmTransfer() {
    const r = current(), snap = modalSnapshot;
    if (!snap || snap.type !== khptm2DeviceType || snap.legacyRole !== khptm2Role || snap.legacyStep !== khptm2Step || (snap.kind === 'workflow' && (!r || snap.viewer !== r.viewer || snap.phase !== r.phase || snap.receipt !== r.receipt))) return toast('Hồ sơ đã thay đổi; mở lại popup Chuyển');
    const selected = selectedRouteRecipients(), recipient = selected.main && selected.main.id.replace('khw_', '');
    if (!recipient || !snap.allowed.includes(recipient)) { switchRouteTab('receiver'); return toast('Chọn 01 người xử lý chính thuộc tuyến xử lý hiện tại'); }
    const note = document.getElementById('transferNote').value.trim();
    if ((snap.kind === 'returnSource' || r && r.mode === 'REVIEW' && snap.kind === 'workflow' && recipient === 'originalPM') && !note) { switchRouteTab('opinion'); return toast('Ghi yêu cầu sửa/bổ sung hồ sơ trước khi trả PM lập'); }
    const selectedFiles = [...document.querySelectorAll('#transferModal .route-file-name')].filter(el => el.closest('.route-file-tools')?.style.display !== 'none' && el.closest('.route-file-tools')?.querySelector('.route-check')?.checked).map(el => el.textContent);
    if (snap.kind === 'tctClerk') {
      const issue = khptm2ClerkIssue();
      if (!W.tctClerkRecipients(issue).includes(recipient)) return toast('Trạng thái văn bản đã thay đổi; mở lại popup Chuyển');
      if (['clerk','leader'].includes(recipient)) {
        if (!W.canForwardTCT(khptm2LDTCTSigned, issue, khptm2Step)) { showTCTRouteState(); return toast('LĐ TCT ký và Văn thư TCT ban hành văn bản trước khi chuyển Tập đoàn'); }
        const issuedFile = 'VB_TCT_trinh_TD_KHPTM_' + tag(snap.type) + '_2027_' + issue.number + '.pdf';
        if (!selectedFiles.includes(issuedFile)) { switchRouteTab('files'); return toast('Chọn văn bản đã ban hành để chuyển'); }
        // Đi qua handler cũ để giữ nguyên kiểm tra, metadata và điểm nối bước 4.
        const id = recipient === 'clerk' ? 'kh2tdclerk' : 'kh2tdleader';
        if (!routeRecipients.some(x => x.id === id)) routeRecipients.push({ ...selected.main, id });
        const checked = document.querySelector('input[name="routeMain"]:checked');
        checked.value = id;
        // Handler cũ kiểm tra row này là văn bản ban hành.
        const issueRow = document.getElementById('routeIssueFileRow'), signRow = document.getElementById('routeSignFileRow');
        const issueHtml = issueRow.innerHTML; issueRow.innerHTML = signRow.innerHTML; signRow.innerHTML = issueHtml;
        return confirmKHPTM2ClerkTransfer();
      }
    }
    if (r && snap.kind === 'workflow' && (r.signed || ['SIGN_MAIN', 'SIGN_CO', 'REVIEW_SUBMIT', 'DECISION_ROUTE', 'SIGN_QD', 'CLERK_SIGNED', 'ISSUED'].includes(r.phase))) {
      const required = ['SIGN_MAIN','SIGN_CO','REVIEW_SUBMIT'].includes(r.phase) ? r.report : r.decision;
      if (required && !selectedFiles.includes(required.name)) { switchRouteTab('files'); return toast('Chọn văn bản cần chuyển: ' + required.name); }
    }
    const text = 'Chuyển hồ sơ tới ' + selected.main.name + (selected.co.length ? ' · Phối hợp: ' + selected.co.map(x => x.name).join(', ') : '') + (selected.view.length ? ' · Xem để biết: ' + selected.view.map(x => x.name).join(', ') : '') + (note ? ' · ' + note : '');
    if (snap.kind === 'tct' || snap.kind === 'tctClerk') {
      khptm2Log(khptm2Role, text);
      if (note) khptm2Exchange.unshift({ actor: khptm2Role, text: note, time: now() });
      pendingTransferAction = ''; hideTransferModal();
      if (recipient.startsWith('review')) { beginReview(recipient, snap.kind === 'tct' ? 'tct' : 'tctClerk', { note, files: selectedFiles }); return; }
      if (recipient === 'tctClerk') {
        khptm2Role = 'Văn thư'; khptm2Step = 'B4';
        const context = ensure(snap.type, 'REVIEW');
        context.sourceContext = captureContext(); context.history = khptm2History; context.exchange = khptm2Exchange;
        W.receiveTCTClerk(context, { note, files: selectedFiles });
      } else if (recipient === 'tct') { khptm2Role = 'LĐTCT'; khptm2Step = 'B3'; }
      else { khptm2Role = 'Chuyên viên Ban KT'; khptm2Step = 'B1'; khptm2UnitLeaderSigned = false; khptm2LDTCTSigned = false; banDrafts.delete(snap.type); }
      renderKHPTMBuild(); return;
    }
    const actor = roles[r.viewer];
    try {
      if (snap.kind === 'returnSource') W.returnSource(r, r.viewer, { note, files: selectedFiles });
      else W.transfer(r, r.viewer, recipient, { note, files: selectedFiles });
      refreshGenerated(r, r.report); refreshGenerated(r, r.decision);
      log(r, text + (r.receipt ? ' · ' + W.transferPurposes[r.receipt.purpose] : ''), actor);
      if (r.receipt) r.history[0].receipt = { ...r.receipt, files: [...r.receipt.files] };
      if (note) r.exchange.unshift({ actor, text: note, time: now() });
      if (r.businessChanged) { log(r, 'Cập nhật dữ liệu thẩm định theo phân công; lưu nguyên bản hồ sơ trình', actor); r.businessChanged = false; }
      pendingTransferAction = ''; hideTransferModal();
      if (r.phase === 'LEGACY') {
        r.returnedFromTD = r.mode === 'APPRAISAL';
        if (recipient === 'originalPM') {
          r.sourceContext.banSigned = false; r.sourceContext.tctSigned = false;
          r.sourceContext.issue = { number: '', suffix: 'KT', date: '2026-12-05', eoffice: '' };
          banDrafts.delete(r.type);
          // Báo cáo của vòng trước lưu trong hồ sơ; hồ sơ sửa phải ký/trình lại từ PM → LĐ Ban → LĐ TCT.
          if (r.report) r.report.archived = true;
        }
        restoreContext(r, recipient); renderKHPTMBuild();
      } else render();
      toast('Đã chuyển hồ sơ tới ' + selected.main.name);
    } catch (error) { toast(error.message); }
  }
  function availableKeys(r) { return r.phase === 'STEP5_RECEIVED' ? [...W.step5Recipients,'clerk'] : r.mode === 'REVIEW' ? ['tctClerk','reviewLead','reviewPM','reviewCoLead','reviewCoPM'] : ['leader','clerk','appraisalLead','appraisalPM','appraisalCoLead','appraisalCoPM']; }
  function setRole(key) { const r = current(); if (r && availableKeys(r).includes(key)) { r.viewer = key; render(); } }
  function addRoleOptions() {
    const select = document.getElementById('khptm2Role');
    // Giữ value cũ cho các handler bước 1–3, nhưng chỉ hiển thị một actor TCT.
    const clerk = [...select.options].find(o => o.value === 'Văn thư');
    if (clerk) { clerk.value = 'Văn thư'; clerk.textContent = roles.tctClerk; }
    if (!select.querySelector('[data-kh4-role]')) {
      const group = document.createElement('optgroup'); group.label = 'Rà soát TCT / Thẩm định Tập đoàn';
      newKeys.forEach(key => { const option = document.createElement('option'); option.value = roles[key]; option.textContent = roles[key]; option.dataset.kh4Role = key; group.appendChild(option); });
      select.appendChild(group);
    }
    select.querySelectorAll('[data-kh4-role]').forEach(option => {
      const key = option.dataset.kh4Role;
      option.textContent = khptm2Step === step4 && current()?.phase === 'STEP5_RECEIVED' ? W.step5RoleNames[key] || roles[key] : roles[key];
    });
  }
  function refreshList() {
    document.querySelectorAll('#khptm-build-list tbody tr').forEach(row => {
      const link = row.querySelector('.khptm-list-title'); if (!link || (link.getAttribute('onclick') || '').includes("'COORD'")) return;
      const r = records.get(row.cells[2].textContent.trim());
      if (r && r.phase !== 'LEGACY') { if (!listBadges.has(row)) listBadges.set(row, row.cells[6].innerHTML); row.cells[6].innerHTML = '<span class="badge bblue">' + esc(flowLabel(r) + ' · ' + status(r)) + '</span>'; }
      else if (listBadges.has(row)) row.cells[6].innerHTML = listBadges.get(row);
    });
  }
  function render() {
    const r = current(); if (!r) return;
    khptm2DeviceType = r.type; khptm2Step = step4; khptm2Role = roles[r.viewer];
    const page = document.getElementById('khptm-build-process');
    page.querySelector('.titlebar h1').textContent = 'Xây dựng, trình KHPTM - ' + r.type;
    page.querySelector('.crumb').textContent = 'QUẢN LÝ KHPTM > Xây dựng, trình KHPTM > ' + r.type + ' > ' + flowLabel(r);
    page.querySelectorAll('.khptm-process-panel').forEach(panel => panel.classList.remove('active'));
    document.getElementById('kh4Panel').classList.add('active'); document.getElementById('kh4Context').style.display = 'contents';
    addRoleOptions();
    document.querySelectorAll('#khptm2Role [data-kh4-role]').forEach(o => { o.hidden = !availableKeys(r).includes(o.dataset.kh4Role); });
    document.getElementById('khptm2Role').value = r.viewer === 'tctClerk' ? 'Văn thư' : roles[r.viewer];
    document.getElementById('kh4Status').textContent = status(r) + ' · Người xử lý: ' + roleName(r, r.owner) + (r.receipt ? ' · Người chuyển: ' + r.receipt.fromName + ' · Nhiệm vụ: ' + W.transferPurposes[r.receipt.purpose] + (r.receipt.note ? ' · ' + r.receipt.note : '') : '');
    document.getElementById('khptm2TopActions').innerHTML = actions(r);
    const u = W.units(r), isPM = [u.pm,u.coPM].includes(r.viewer);
    if (r.lastViewer !== r.viewer) {
      r.previewKind = r.phase === 'STEP5_RECEIVED' || ['leader','clerk','tctClerk'].includes(r.viewer) ? r.decision ? 'decision' : 'source' : ['ASSIGN','CO_ASSIGN'].includes(r.phase) ? 'source' : 'report';
      r.lastViewer = r.viewer;
    }
    document.getElementById('kh4Panel').innerHTML = (isPM ? formHtml(r) : '') +
      (isPM && r.viewer === u.coPM ? '' : previewHtml(r));
    document.getElementById('khptm2Extended').innerHTML = '<div id="kh4Extended"></div>'; renderExtended(r); refreshList();
  }
  function open(type, key) {
    currentType = types.includes(type) ? type : currentType;
    let r = records.get(currentType);
    const mode = key && key.startsWith('review') ? 'REVIEW' : 'APPRAISAL';
    if (!r || (r.phase === 'LEGACY' && mode !== r.mode && key)) {
      const previous = r; r = makeRecord(currentType, mode);
      if (previous) { r.files = previous.files; r.reviewReport = previous.report; }
      records.set(currentType, r);
    }
    if (key && availableKeys(r).includes(key)) r.viewer = key;
    document.querySelectorAll('.nav .item').forEach(el => el.classList.remove('active')); document.getElementById('nav-khptm').classList.add('active');
    showPage('khptm-build-process'); render();
  }
  function receive(type, incoming) {
    const old = records.get(type), r = makeRecord(type, 'APPRAISAL', incoming);
    if (old) { r.files = old.files; r.reviewReport = old.report; }
    W.receiveGroupSource(r, incoming.recipient, incoming.details); records.set(type, r);
    log(r, 'Tiếp nhận VB TCT trình TĐ đã ban hành; chuyển đúng người xử lý: ' + roles[r.owner], roles.tctClerk);
  }
  function banState() { if (!banDrafts.has(khptm2DeviceType)) banDrafts.set(khptm2DeviceType, { initialled: false, selected: 'submission' }); return banDrafts.get(khptm2DeviceType); }
  function selectBanDocument(value) { const state = banState(); state.selected = value; renderKHPTMBuild(); }
  function signBan() {
    if (khptm2Role !== 'LĐ Ban KT' || khptm2Step !== 'B2') return;
    const state = banState();
    if (state.selected === 'submission') { if (!khptm2UnitLeaderSigned) previousSignBan(); }
    else if (!state.initialled) { state.initialled = true; khptm2Log('LĐ Ban KT', 'Ký nháy dự thảo VB TCT trình Tập đoàn (demo)'); renderKHPTMBuild(); }
  }
  function renderBan() {
    const state = banState(), internal = state.selected === 'submission', signed = internal ? khptm2UnitLeaderSigned : state.initialled;
    const paperHtml = internal ? khptm2LeaderPreviewHtml('LĐ Ban KT') : '<div class="section"><h3>Văn bản trình ký</h3><div class="body"><div class="khptm-doc-preview"><div class="khptm-paper">' + sourcePaper(khptm2DeviceType,{number:'',suffix:'KT',date:''},false) + '<p style="text-align:right">LĐ Ban/đơn vị: ' + (signed ? 'Đã ký nháy (demo)' : 'Chờ ký nháy') + '</p></div></div></div></div>';
    document.getElementById('khptm2PanelUnitLeader').innerHTML = '<div class="toolbar" style="margin-bottom:10px"><label for="kh4BanDocument">Văn bản xem trước</label><select id="kh4BanDocument" onchange="kh4.selectBanDocument(this.value)"><option value="submission"' + (internal ? ' selected' : '') + '>Tờ trình LĐ TCT — ký chính thức</option><option value="outgoing"' + (!internal ? ' selected' : '') + '>Dự thảo VB TCT trình TĐ — ký nháy</option></select></div>' + paperHtml;
    document.getElementById('khptm2TopActions').innerHTML = button('Xem Tờ trình LĐ TCT', "openKHPTM2Preview('submission')", true) + button('Xem dự thảo VB trình Tập đoàn', "openKHPTM2Preview('outgoing')", true) + button('Trả lại', 'khptm2ReturnSpecialist()', true, 'khptm-danger') + button(internal ? 'Ký số Tờ trình' : 'Ký nháy VB trình Tập đoàn', 'kh4.signBan()', !signed) + button('Chuyển', "openKHPTM2Transfer('khbuildSubmitLDTCT')", khptm2UnitLeaderSigned && state.initialled, 'khptm-emphasis');
  }
  function legacyExtras() {
    const type = khptm2DeviceType, r = records.get(type), isCoord = isKHPTMPairType() && khptmPairRecordRole === 'COORD';
    if (isCoord) return;
    if (khptm2Role === 'LĐ Ban KT' && khptm2Step === 'B2') renderBan();
    if (khptm2Role === 'LĐTCT' && khptm2Step === 'B3') {
      const host = document.getElementById('khptm2TopActions');
      host.querySelectorAll('button').forEach(b => { if (b.textContent.trim().startsWith('Chuyển')) b.remove(); });
      host.innerHTML += button('Chuyển', "kh4.transfer('tct')", true, 'khptm-emphasis');
      if (r && r.report && r.report.reportMode === 'REVIEW') host.innerHTML = button('Xem Báo cáo rà soát', "kh4.previewDocument('report')", true) + host.innerHTML;
    }
    if (khptm2Role === 'Văn thư' && ['B4','DONE'].includes(khptm2Step)) {
      document.getElementById('khptm2TopActions').innerHTML = button('Ban hành', 'issueKHPTM2()', khptm2LDTCTSigned && khptm2Step === 'B4' && !khptm2ClerkIssue().issued, 'khptm-emphasis') + button('Chuyển', "kh4.transfer('tctClerk')", W.tctClerkRecipients(khptm2ClerkIssue()).length > 0, 'khptm-emphasis');
    }
    // Thay dummy sai ngữ cảnh; không đổi cấu trúc Thông tin mở rộng.
    document.querySelectorAll('#khptm2Extended .pm-ext-table tbody tr').forEach(row => {
      if (row.textContent.includes('Du_thao_QD') || row.textContent.includes('Dự thảo QĐ TĐ')) {
        const name = row.querySelector('.pm-ext-file'); if (name) { name.textContent = 'Du_thao_VB_TCT_trinh_TD_KHPTM_' + tag(type) + '_2027.docx'; name.setAttribute('onclick', "openKHPTM2Preview('outgoing')"); }
        const group = row.cells[9]?.querySelector('option'); if (group) group.textContent = 'Dự thảo VB trình TĐ'; if (row.cells[7]) row.cells[7].textContent = 'VNPT Net'; if (row.cells[8]) row.cells[8].textContent = banState().initialled ? 'LĐ Ban KT – ký nháy' : 'LĐTCT';
        row.cells[15]?.querySelector('button')?.setAttribute('onclick', "openKHPTM2Preview('outgoing')");
      }
    });
    if (r) {
      currentType = type;
      if (r.phase === 'LEGACY' && r.owner === 'tctClerk' && r.receipt?.purpose === 'TCT_ROUTE' && khptm2Role === 'Văn thư') {
        r.sourceContext = captureContext();
        r.sourceIssue = { ...khptm2ClerkIssue() }; r.sourceHtml = sourcePaper(type, r.sourceIssue, khptm2LDTCTSigned);
      }
      if (r.phase === 'LEGACY' && r.receipt && (r.owner === 'tctClerk' ? khptm2Role === 'Văn thư' : roles[r.owner] === khptm2Role)) {
        document.getElementById('kh4Context').style.display = 'contents';
        document.getElementById('kh4Status').textContent = 'Người chuyển: ' + r.receipt.fromName + ' · Nhiệm vụ: ' + W.transferPurposes[r.receipt.purpose] + (r.receipt.note ? ' · ' + r.receipt.note : '');
      }
      const body = document.querySelector('#khptm2Extended .pm-ext-table tbody');
      r.files.forEach((file, index) => { if (body) body.insertAdjacentHTML('beforeend', docRow(body.rows.length + 1, r, file, 'kh4.previewFile(' + index + ')', false)); });
      r.history = khptm2History; r.exchange = khptm2Exchange;
    }
    displayClerkNames(document.getElementById('khptm-build-process'));
  }
  function displayClerkNames(host) {
    // Chỉ đổi text hiển thị KHPTM; không đổi value/handler hay các module khác.
    const walker = document.createTreeWalker(host, NodeFilter.SHOW_TEXT);
    while (walker.nextNode()) {
      const node = walker.currentNode;
      if (!node.parentElement.closest('script,style,input,textarea')) node.textContent = node.textContent.replace(/Văn thư(?! Tập đoàn| TCT)/g, 'Văn thư TCT');
    }
  }
  function mount() {
    const anchor = document.getElementById('khptm-build-process'); if (!anchor) return;
    const style = document.createElement('style');
    style.textContent = '.kh4-pdf{width:100%;height:690px;border:0;background:white}.kh4-business:disabled{background:#eef1f4;color:#6b7280;opacity:1}#kh4Context .right-note{margin-left:8px;min-width:0;flex:1;white-space:normal}#transferModal.kh4-route button[onclick="openInitialSignModal()"],#transferModal.kh4-route button[onclick="openDigitalSignModal()"],#transferModal.kh4-route button[onclick^="generateTransferFile"],#transferModal.kh4-route .route-unit-block,#transferModal.kh4-route .route-receiver-toolbar button{display:none}';
    document.head.appendChild(style);
    const panel = document.createElement('div'); panel.id = 'kh4Panel'; panel.className = 'khptm-process-panel'; anchor.insertBefore(panel, document.getElementById('khptm2Extended'));
    const context = document.createElement('span'); context.id = 'kh4Context'; context.style.display = 'none';
    context.innerHTML = '<span id="kh4Status" class="right-note"></span>';
    anchor.querySelector('.khptm-rolebar').appendChild(context); addRoleOptions();
  }
  const previousSignBan = khptm2SignUnitLeader;
  const previousSignTCT = khptm2SignLDTCT;
  khptm2SignLDTCT = function () { if (!khptm2UnitLeaderSigned || !banState().initialled) return toast('Cần Tờ trình đã ký chính thức và dự thảo VB trình TĐ đã ký nháy'); return previousSignTCT.apply(this, arguments); };
  const previousTransferOpen = openKHPTM2Transfer;
  openKHPTM2Transfer = function (action) {
    if (action === 'khbuildSubmitLDTCT' && (!khptm2UnitLeaderSigned || !banState().initialled)) return toast('LĐ Ban cần ký chính thức Tờ trình và ký nháy dự thảo VB trình TĐ');
    const result = previousTransferOpen.apply(this, arguments);
    displayClerkNames(document.getElementById('transferModal')); return result;
  };
  const previousReturn = khptm2ReturnSpecialist;
  khptm2ReturnSpecialist = function () { banDrafts.delete(khptm2DeviceType); const r = records.get(khptm2DeviceType); if (r) { r.phase = 'LEGACY'; if (r.report) r.report.archived = true; } return previousReturn.apply(this, arguments); };
  const previousClerkTransfer = confirmKHPTM2ClerkTransfer;
  confirmKHPTM2ClerkTransfer = function () {
    const type = khptm2DeviceType, before = khptm2ClerkIssue().transferredTo;
    const selected = selectedRouteRecipients(), recipient = selected.main && ({ kh2tdclerk: 'clerk', kh2tdleader: 'leader' })[selected.main.id];
    const details = { note: document.getElementById('transferNote').value.trim(), files: [...document.querySelectorAll('#transferModal .route-file-name')].filter(el => el.closest('.route-file-tools')?.querySelector('.route-check')?.checked).map(el => el.textContent) };
    const result = previousClerkTransfer.apply(this, arguments), sent = khptm2ClerkIssue();
    if (!before && sent.transferredTo) { receive(type, { recipient, details, issue: { ...sent }, history: khptm2History, exchange: khptm2Exchange }); open(type); }
    return result;
  };
  const previousConfirm = confirmTransferFromModal;
  confirmTransferFromModal = function () { return pendingTransferAction === 'kh4Transfer' ? confirmTransfer() : previousConfirm.apply(this, arguments); };
  const previousRenderRecipients = renderRouteRecipients;
  renderRouteRecipients = function () {
    const result = previousRenderRecipients.apply(this, arguments);
    showTCTRouteState(); showGroupClerkRouteState(); return result;
  };
  const previousHide = hideTransferModal;
  hideTransferModal = function () { restoreModal(); return previousHide.apply(this, arguments); };
  const previousRender = renderKHPTMBuild;
  renderKHPTMBuild = function () {
    if (khptm2Step === step4) { currentType = khptm2DeviceType; render(); return; }
    document.getElementById('kh4Panel').classList.remove('active'); document.getElementById('kh4Context').style.display = 'none';
    const result = previousRender.apply(this, arguments); addRoleOptions(); currentType = khptm2DeviceType;
    const isCoord = isKHPTMPairType() && khptmPairRecordRole === 'COORD';
    document.querySelectorAll('#khptm2Role [data-kh4-role]').forEach(option => { option.hidden = isCoord; });
    legacyExtras(); return result;
  };
  const previousSwitchRole = switchKHPTMBuildRole;
  switchKHPTMBuildRole = function (role) {
    const type = khptm2DeviceType;
    if (khptm2Step === step4 && current()?.phase === 'STEP5_RECEIVED') {
      const key = availableKeys(current()).find(k => (k === 'tctClerk' ? 'Văn thư' : roles[k]) === role);
      if (key) return setRole(key);
    }
    if (role === 'Văn thư' && khptm2Step === step4 && availableKeys(current()).includes('tctClerk')) return setRole('tctClerk');
    const key = newKeys.find(k => roles[k] === role);
    if (key) {
      if (khptm2Step === step4) { const r = current(); if (availableKeys(r).includes(key)) return setRole(key); }
      open(type, key); return;
    }
    if (khptm2Step === step4) restoreContext(current());
    return previousSwitchRole.apply(this, arguments);
  };
  const previousOpenType = openKHPTMBuildType;
  openKHPTMBuildType = function (type) {
    const r = records.get(type);
    if (r && r.phase !== 'LEGACY') return open(type);
    if (r) { currentType = type; restoreContext(r, r.owner); showPage('khptm-build-process'); renderKHPTMBuild(); return; }
    return previousOpenType.apply(this, arguments);
  };
  const previousOpenPair = openKHPTMPairRecord;
  openKHPTMPairRecord = function (type, role) {
    const r = records.get(type);
    if (role !== 'COORD' && r) return openKHPTMBuildType(type);
    return previousOpenPair.apply(this, arguments);
  };
  const previousOpenList = openKHPTMBuildModule;
  openKHPTMBuildModule = function () { const result = previousOpenList.apply(this, arguments); refreshList(); return result; };
  const previousReset = resetKHPTMBuildFlow;
  resetKHPTMBuildFlow = function () {
    const r = records.get(khptm2DeviceType); if (khptm2Step === step4) restoreContext(r);
    if (r) r.files.forEach(file => { if (file.url) URL.revokeObjectURL(file.url); });
    records.delete(khptm2DeviceType); banDrafts.delete(khptm2DeviceType); exchangeAttachment = null;
    const result = previousReset.apply(this, arguments); refreshList(); return result;
  };
  window.kh4 = { open, render, setRole, generate, upload, approve, sign, issue, updateIssue, takeNumber, transfer,
    extTab, sendExchange, exchangeFileChanged, previewSource, previewSubmission, previewFile, previewDocument,
    saveBusiness, reportInput, selectDocument, returnSource, rejectReport, selectBanDocument, signBan };
  mount();
}());
