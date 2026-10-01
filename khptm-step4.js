/* Bước 4 bổ sung độc lập; các renderer và dữ liệu của luồng trước được giữ nguyên. */
(function () {
  'use strict';
  const types = ['Core di động', 'Vô tuyến', 'BRCĐ', 'CSHT'];
  const roles = { net: 'NET thực hiện thay Tập đoàn', expert: 'Người thẩm định Tập đoàn', leader: 'LĐ Tập đoàn', clerk: 'Văn thư Tập đoàn', kt: 'Ban KT giải trình' };
  const records = new Map();
  let currentType = types[0], nextNumber = 100, exchangeAttachment = null, modalSnapshot = null;
  const now = () => new Date().toLocaleString('vi-VN', { hour12: false });
  const tag = type => ({ 'Core di động': 'Core', 'Vô tuyến': 'Vo_tuyen', 'BRCĐ': 'BRCD', 'CSHT': 'CSHT' })[type];
  const current = () => records.get(currentType);
  const numberText = issue => issue.number ? issue.number + '/QĐ-' + (issue.suffix || 'VNPT') : '.../QĐ-VNPT';
  const isEditor = r => [roles.net, roles.expert, roles.leader].includes(r.role) && r.stage === 'APPRAISAL' && !r.signed;
  const log = (r, text, actor) => r.history.unshift({ actor: actor || r.role, text, time: now() });
  const status = r => ({ APPRAISAL: r.appraised ? 'Đã thẩm định – chờ duyệt' : 'Chờ thẩm định', APPROVED: r.scenario === 'NET' ? 'Đã ghi nhận kết quả TĐ – chờ hoàn thiện thông tin' : 'Đã duyệt – chờ ban hành', ISSUED: 'Đã ban hành – chờ chuyển', DONE: 'Đã chuyển kết quả về NET' })[r.stage];

  function sourcePaper(type, issue, signed) {
    return '<div style="text-align:center"><b>TỔNG CÔNG TY HẠ TẦNG MẠNG - VNPT NET</b></div><p>Số: ' + esc(issue.number || '...') + '/VNPT Net-' + esc(issue.suffix || 'KT') + '</p>' +
      (issue.date ? '<p style="text-align:right">Ngày ban hành: ' + esc(formatDateVN(issue.date)) + '</p>' : '') +
      '<h2>VĂN BẢN TRÌNH TẬP ĐOÀN</h2><h3>V/v trình phê duyệt Kế hoạch phát triển mạng ' + esc(type) + ' năm 2027</h3>' +
      '<p>Cần khảo sát khách hàng để chốt nội dung/field chi tiết của văn bản.</p><div class="sign"><b>LÃNH ĐẠO TỔNG CÔNG TY</b><br><br><br>' + (signed ? '(Đã ký số)' : '(Văn bản mẫu)') + '</div>';
  }

  function makeRecord(type, incoming) {
    const saved = { type: khptm2DeviceType, role: khptm2Role, step: khptm2Step, issue: khptm2Issue };
    let extTemplate;
    try {
      khptm2DeviceType = type; khptm2Role = 'Văn thư'; khptm2Step = incoming ? 'DONE' : 'B3';
      khptm2Issue = incoming ? incoming.issue : { number: '', suffix: 'KT', date: '', eoffice: '' };
      extTemplate = khptm2ExtendedHtml();
    } finally {
      khptm2DeviceType = saved.type; khptm2Role = saved.role; khptm2Step = saved.step; khptm2Issue = saved.issue;
    }
    const sourceIssue = incoming ? { ...incoming.issue } : { number: '', suffix: 'KT', date: '', eoffice: '' };
    return { id: 'KHPTM4-' + tag(type) + '-2027', type, year: 2027, scenario: 'NET', role: roles.net, stage: 'APPRAISAL',
      demo: !incoming, sourceIssue, sourceHtml: sourcePaper(type, sourceIssue, !!incoming), extTemplate,
      history: incoming ? incoming.history.map(x => ({ ...x })) : [{ actor: 'Hệ thống', text: 'Hồ sơ mẫu bước 4 – KHPTM ' + type + ' năm 2027.', time: now() }],
      exchange: incoming ? incoming.exchange.map(x => ({ ...x })) : [], exchangeDraft: '', files: [], activeFile: null,
      decisionOpened: false, appraised: false, signed: false, issue: { number: '', suffix: 'VNPT', date: '', eoffice: '' }, uploadToken: 0 };
  }

  function ensure(type) {
    if (!types.includes(type)) throw new Error('Loại thiết bị không hợp lệ');
    if (!records.has(type)) records.set(type, makeRecord(type));
    return records.get(type);
  }

  function paper(r) {
    const title = r.type === 'Vô tuyến' ? 'Phê duyệt và ban hành Kế hoạch đầu tư phát triển mạng' : 'Phê duyệt Kế hoạch phát triển mạng';
    return '<div style="text-align:center"><b>TẬP ĐOÀN BƯU CHÍNH VIỄN THÔNG VIỆT NAM</b></div><p>Số: ' + esc(numberText(r.issue)) + '</p>' +
      '<p style="text-align:right">Ngày ban hành: ' + esc(formatDateVN(r.issue.date) || '...') + '</p><h2>QUYẾT ĐỊNH</h2><h3>' + title + ' ' + esc(r.type) + ' năm ' + r.year + '</h3>' +
      '<p>Căn cứ văn bản của Tổng công ty Hạ tầng mạng trình Tập đoàn về KHPTM ' + esc(r.type) + ' năm ' + r.year + '.</p>' +
      '<p>Cần khảo sát khách hàng để chốt nội dung và biểu mẫu chi tiết của quyết định.</p>' +
      '<div class="sign"><b>LÃNH ĐẠO TẬP ĐOÀN</b><br><br><br>' + (r.signed ? '(Đã ký số – demo)' : '(Chờ ký)') + '</div>';
  }

  function refreshGenerated(r) {
    const file = r.activeFile;
    if (!file || file.kind !== 'generated') return;
    const html = '<!doctype html><html><head><meta charset="utf-8"><style>body{font-family:"Times New Roman",serif;margin:35pt;line-height:1.5}h2,h3{text-align:center}.sign{text-align:right;margin-top:36pt}</style></head><body>' + paper(r) + '</body></html>';
    if (file.url) URL.revokeObjectURL(file.url);
    file.blob = new Blob([html], { type: 'application/msword;charset=utf-8' });
    file.url = URL.createObjectURL(file.blob);
    file.signed = r.signed; file.issued = r.stage === 'ISSUED' || r.stage === 'DONE';
  }

  function createFile(r, values) {
    const file = { id: r.id + '-VB-' + (r.files.length + 1), actor: r.role, time: now(), ...values };
    r.files.push(file); r.activeFile = file; r.decisionOpened = true; r.appraised = false; r.signed = false;
    return file;
  }

  function generate() {
    const r = current(); if (!r || !isEditor(r)) return toast('Vai trò/trạng thái hiện tại không được tạo quyết định');
    createFile(r, { kind: 'generated', name: 'Du_thao_QD_KHPTM_' + tag(r.type) + '_' + r.year + '_v' + (r.files.length + 1) + '.doc', signed: false });
    refreshGenerated(r); log(r, 'Sinh dự thảo quyết định từ template; thêm vào Tài liệu đính kèm'); render();
  }

  async function upload(input) {
    const r = current(), file = input.files && input.files[0];
    if (!r || !file || !isEditor(r)) return;
    const token = ++r.uploadToken;
    try {
      if (!/\.pdf$/i.test(file.name) || file.size > 32 * 1024 * 1024) throw new Error('Chọn file PDF, dung lượng tối đa 32 MB');
      const signature = new TextDecoder().decode(await file.slice(0, 5).arrayBuffer());
      if (signature !== '%PDF-') throw new Error('File không phải định dạng PDF hợp lệ');
      if (token !== r.uploadToken || !isEditor(r)) return;
      createFile(r, { kind: 'uploaded', name: file.name, blob: file, url: URL.createObjectURL(file), signed: true });
      log(r, 'Upload quyết định TĐ: ' + file.name + '; thêm vào Tài liệu đính kèm');
      if (r === current()) render();
    } catch (error) { toast(error.message); } finally { input.value = ''; }
  }

  function approve() {
    const r = current(); if (!r || ![roles.net, roles.expert, roles.leader].includes(r.role) || r.stage !== 'APPRAISAL') return toast('Hồ sơ không ở trạng thái chờ duyệt');
    if (!r.decisionOpened) { r.decisionOpened = true; log(r, 'Duyệt: mở hồ sơ Quyết định ' + r.id + ' liên kết với hồ sơ TCT trình TĐ'); render(); return toast('Đã mở hồ sơ Quyết định; chọn Upload hoặc Sinh quyết định tự động'); }
    if (!r.activeFile) return toast('Upload quyết định hoặc sinh dự thảo trước khi hoàn tất duyệt');
    if (r.role === roles.expert) { r.appraised = true; log(r, 'Hoàn tất thẩm định; chuyển LĐ Tập đoàn xem xét'); render(); return; }
    if (r.scenario === 'NET' && r.activeFile.kind !== 'uploaded') return toast('Upload quyết định TĐ đã ban hành trước khi ghi nhận kết quả phê duyệt');
    if (r.scenario === 'TD' && r.role !== roles.leader) return toast('LĐ Tập đoàn thực hiện duyệt hồ sơ');
    if (r.activeFile.kind === 'generated' && !r.signed) return toast('LĐ Tập đoàn cần ký quyết định trước khi duyệt');
    r.appraised = true; r.stage = 'APPROVED';
    log(r, r.scenario === 'NET' ? 'Ghi nhận kết quả phê duyệt theo quyết định TĐ đã upload' : 'Duyệt hồ sơ Quyết định'); render();
  }

  function sign() {
    const r = current();
    if (!r || r.scenario !== 'TD' || r.role !== roles.leader || r.stage !== 'APPRAISAL' || !r.activeFile || r.activeFile.kind !== 'generated' || r.signed) return toast('Hồ sơ không ở trạng thái LĐ Tập đoàn ký quyết định');
    r.signed = true; refreshGenerated(r); log(r, 'Ký số dự thảo quyết định (demo)'); render(); toast('Đã ký số quyết định (demo); chọn Duyệt để hoàn tất');
  }

  function updateIssue() {
    const r = current(); if (!r || r.role !== roles.clerk || r.stage !== 'APPROVED') return;
    ['Number', 'Suffix', 'Date', 'Eoffice'].forEach(key => { const input = document.getElementById('kh4Issue' + key); if (input) r.issue[key.toLowerCase()] = input.value.trim(); });
    if (r.activeFile && r.activeFile.kind === 'generated') {
      refreshGenerated(r); const host = document.getElementById('kh4Paper'); if (host) host.innerHTML = paper(r);
    }
    // File PDF upload không bị đọc/ghi lại khi cập nhật metadata.
  }

  function takeNumber() {
    const r = current(); if (!r || r.role !== roles.clerk || r.stage !== 'APPROVED') return;
    while ([...records.values()].some(x => x.issue.number === String(nextNumber))) nextNumber++;
    document.getElementById('kh4IssueNumber').value = String(nextNumber++); updateIssue(); toast('Đã lấy số quyết định (demo)');
  }

  function issue() {
    const r = current(); if (!r || r.role !== roles.clerk || r.stage !== 'APPROVED' || !r.activeFile) return toast('Hồ sơ chưa đủ điều kiện ban hành');
    updateIssue();
    if (!r.issue.number || !r.issue.date) return toast('Nhập Số quyết định và Ngày ban hành');
    if ([r.issue.number, r.issue.suffix, r.issue.eoffice].some(value => /[<>]/.test(value))) return toast('Thông tin văn bản không được chứa ký tự < hoặc >');
    if (r.activeFile.kind === 'generated' && (!r.signed || r.scenario !== 'TD')) return toast('Quyết định cần được LĐ Tập đoàn ký trước khi ban hành');
    r.stage = 'ISSUED'; r.activeFile.issued = true;
    if (r.activeFile.kind === 'generated') refreshGenerated(r);
    log(r, (r.activeFile.kind === 'uploaded' ? 'Ghi nhận thông tin quyết định TĐ đã ban hành: ' : 'Ban hành quyết định: ') + numberText(r.issue) + ' ngày ' + formatDateVN(r.issue.date) + (r.issue.eoffice ? ' · eOffice ' + r.issue.eoffice : ''));
    render(); toast(r.activeFile.kind === 'uploaded' ? 'Đã ghi nhận thông tin ban hành; giữ nguyên file PDF' : 'Đã ban hành quyết định');
  }

  function actions(r) {
    let html = '<button onclick="kh4.previewSource()">Xem VB TCT trình Tập đoàn</button>';
    if (r.role === roles.clerk) {
      html += '<button onclick="kh4.issue()" ' + (r.stage !== 'APPROVED' ? 'disabled' : '') + '>Ban hành</button>';
    } else if ([roles.net, roles.expert, roles.leader].includes(r.role)) {
      html += '<button onclick="kh4.approve()" ' + (r.stage !== 'APPRAISAL' ? 'disabled' : '') + '>Duyệt</button>';
      if (r.role === roles.leader && r.scenario === 'TD' && r.activeFile && r.activeFile.kind === 'generated') html += '<button onclick="kh4.sign()" ' + (r.signed || r.stage !== 'APPRAISAL' ? 'disabled' : '') + '>Ký số Quyết định</button>';
    }
    return html + '<button onclick="kh4.transfer()" ' + (!allowedRecipients(r).length ? 'disabled' : '') + '>Chuyển</button>';
  }

  function previewHtml(r) {
    let html = '<div class="section"><h3>Văn bản phê duyệt</h3><div class="body">';
    if (r.role === roles.clerk) {
      const locked = r.stage !== 'APPROVED' ? ' readonly' : '';
      html += '<div class="khptm-issue-grid" style="margin-bottom:12px"><div><label>Số quyết định <span class="req">*</span></label><div style="display:flex;gap:6px"><input id="kh4IssueNumber" value="' + esc(r.issue.number) + '" oninput="kh4.updateIssue()"' + locked + ' style="min-width:0;flex:1"><button onclick="kh4.takeNumber()" ' + (locked ? 'disabled' : '') + '>Lấy số</button></div></div>' +
        '<div><label>Hậu tố</label><input id="kh4IssueSuffix" value="' + esc(r.issue.suffix) + '" oninput="kh4.updateIssue()"' + locked + '></div>' +
        '<div><label>Ngày ban hành <span class="req">*</span></label><input id="kh4IssueDate" type="date" value="' + esc(r.issue.date) + '" oninput="kh4.updateIssue()"' + locked + '></div>' +
        '<div><label>Số eOffice/VBKS</label><input id="kh4IssueEoffice" value="' + esc(r.issue.eoffice) + '" oninput="kh4.updateIssue()"' + locked + '></div></div>';
    }
    if (!r.activeFile) {
      html += '<div class="khptm-doc-preview kh4-empty"><button onclick="document.getElementById(\'kh4DecisionUpload\').click()" ' + (!isEditor(r) ? 'disabled' : '') + '>Upload quyết định</button>' +
        '<button onclick="kh4.generate()" ' + (!isEditor(r) ? 'disabled' : '') + '>Sinh quyết định tự động</button></div>';
    } else {
      html += '<div class="toolbar" style="margin-bottom:8px"><b>' + esc(r.activeFile.name) + '</b><a class="linklike" href="' + r.activeFile.url + '" download="' + esc(r.activeFile.name) + '">Tải văn bản</a>' +
        (isEditor(r) ? '<button onclick="document.getElementById(\'kh4DecisionUpload\').click()">Upload thay thế</button><button onclick="kh4.generate()">Sinh quyết định tự động</button>' : '') + '</div>';
      html += r.activeFile.kind === 'uploaded' ? '<div class="khptm-doc-preview"><iframe class="kh4-pdf" title="Quyết định Tập đoàn" src="' + r.activeFile.url + '"></iframe></div>' : '<div class="khptm-doc-preview"><div id="kh4Paper" class="khptm-paper">' + paper(r) + '</div></div>';
    }
    return html + '<input id="kh4DecisionUpload" type="file" accept="application/pdf,.pdf" style="display:none" onchange="kh4.upload(this)"></div></div>';
  }

  function docRow(index, r, file, action, main) {
    const issued = file.issued, decision = !!file.kind;
    const issue = decision ? r.issue : r.sourceIssue;
    const number = issued ? (decision ? numberText(issue) : (issue.number || '...') + '/VNPT Net-' + issue.suffix) : '';
    return '<tr><td class="center">' + index + '</td><td class="center">' + (file.signed ? '☒' : '☐') + '</td><td class="center"><input type="checkbox" checked disabled></td>' +
      '<td class="center"><input type="checkbox" ' + (main ? 'checked' : '') + ' disabled></td><td class="center"><input type="checkbox" ' + (!main ? 'checked' : '') + ' disabled></td>' +
      '<td>' + esc(number) + (issued && issue.date ? '<br><span class="mini">' + esc(formatDateVN(issue.date)) + '</span>' : '') + '</td><td>' + esc(issued ? issue.eoffice || '' : '') + '</td>' +
      '<td>' + (decision ? 'Tập đoàn' : 'VNPT Net') + '</td><td>' + (file.signed ? decision ? 'LĐ Tập đoàn' : 'LĐTCT' : '--') + '</td><td><select disabled><option>' + (decision ? 'Quyết định phê duyệt' : file.group || 'VB trình TĐ') + '</option></select></td>' +
      '<td><span class="pm-ext-file" onclick="' + action + '">' + esc(file.name) + '</span></td><td>' + esc(file.actor || 'Chuyên viên Ban KT') + '</td><td>' + esc(file.time || '') + '</td><td></td><td></td>' +
      '<td><button class="pm-ext-action" onclick="' + action + '">Xem</button>' + (file.url ? ' <a class="pm-ext-action" href="' + file.url + '" download="' + esc(file.name) + '">Tải</a>' : '') + '</td></tr>';
  }

  function renderExtended(r) {
    const host = document.getElementById('kh4Extended');
    host.innerHTML = r.extTemplate.replaceAll('khptm2', 'kh4').replaceAll('switchKHPTM2ExtTab', 'kh4.extTab').replaceAll('sendKHPTM2Exchange', 'kh4.sendExchange').replaceAll('khptm2ExchangeFileChanged', 'kh4.exchangeFileChanged');
    // Chỉ thay dữ liệu/handler trong bản sao của bước 4; giữ bảng, cột và tab theo pattern cũ.
    const table = host.querySelector('.pm-ext-table tbody');
    const source = { name: 'VB_TCT_trinh_TD_KHPTM_' + tag(r.type) + '_' + r.year + '.pdf', signed: !r.demo, issued: !r.demo, group: 'VB trình TĐ' };
    let rows = docRow(1, r, source, 'kh4.previewSource()', true);
    rows += docRow(2, r, { name: 'To_trinh_LDTCT_KHPTM_' + tag(r.type) + '_' + r.year + '.docx', signed: !r.demo, issued: false, group: 'Tờ trình LĐ TCT' }, 'kh4.previewSubmission()', false);
    rows += docRow(3, r, { name: 'KHPTM_' + tag(r.type) + '_' + r.year + '.xlsx', signed: false, issued: false, group: 'Hồ sơ KHPTM' }, "toast('Mở hồ sơ KHPTM liên quan (demo)')", false);
    r.files.forEach((file, index) => { rows += docRow(index + 4, r, file, 'kh4.previewFile(' + index + ')', file === r.activeFile); });
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
    const r = current(); if (!r || r.stage === 'DONE') return toast('Hồ sơ đã hoàn tất');
    const ta = document.getElementById('kh4QuickExchange'), text = ta.value.trim(), file = exchangeAttachment && exchangeAttachment.record === r.id ? exchangeAttachment.file : null;
    if (!text && !file) return toast('Nhập ý kiến hoặc tải tệp lên');
    r.exchange.unshift({ actor: r.role, text, file: file ? file.name : '', url: file ? URL.createObjectURL(file) : '', time: now() });
    r.exchangeDraft = ''; exchangeAttachment = null; renderExtended(r); toast('Đã gửi ý kiến');
  }

  function showPreview(title, html) { document.getElementById('khptmPreviewTitle').textContent = title; document.getElementById('khptmPreviewPaper').innerHTML = html; document.getElementById('khptmPreviewModal').classList.add('show'); }
  function previewSource() { const r = current(); if (r) showPreview('VB TCT trình Tập đoàn – ' + r.type, r.sourceHtml); }
  function previewSubmission() { const r = current(); if (r) showPreview('Tờ trình LĐ TCT – ' + r.type, '<h2>TỜ TRÌNH</h2><h3>Về việc thông qua KHPTM ' + esc(r.type) + ' năm ' + r.year + '</h3><p>Cần khảo sát khách hàng để chốt nội dung/field chi tiết của Tờ trình.</p><div class="sign"><b>LÃNH ĐẠO BAN KT</b></div>'); }
  function previewFile(index) { const r = current(), file = r && r.files[index]; if (!file) return; showPreview(file.name, file.kind === 'uploaded' ? '<iframe class="kh4-pdf" title="Quyết định Tập đoàn" src="' + file.url + '"></iframe>' : file === r.activeFile ? paper(r) : '<p>Dự thảo phiên bản trước.</p><a href="' + file.url + '" download="' + esc(file.name) + '">Tải ' + esc(file.name) + '</a>'); }

  function allowedRecipients(r) {
    if (r.stage === 'DONE') return [];
    if (r.role === roles.kt) return [r.scenario === 'NET' ? 'kh4net' : 'kh4expert'];
    if (r.role === roles.clerk) return r.stage === 'ISSUED' ? ['kh4ktreturn', 'kh4netclerk'] : r.stage === 'APPRAISAL' ? [r.scenario === 'NET' ? 'kh4net' : 'kh4expert', ...(r.scenario === 'TD' ? ['kh4leader'] : [])] : [];
    if (r.stage === 'APPROVED') return ['kh4clerk'];
    return r.scenario === 'TD' && r.role === roles.expert ? ['kh4leader', 'kh4kt'] : ['kh4kt'];
  }

  function registerRecipients() {
    const items = [{ id: 'kh4net', name: roles.net, unit: 'VNPT NET' }, { id: 'kh4expert', name: roles.expert, unit: 'Tập đoàn' }, { id: 'kh4leader', name: roles.leader, unit: 'Tập đoàn' },
      { id: 'kh4clerk', name: roles.clerk, unit: 'Tập đoàn' }, { id: 'kh4kt', name: roles.kt, unit: 'Ban KT' }, { id: 'kh4ktreturn', name: 'Chuyên viên Ban KT', unit: 'VNPT NET' }, { id: 'kh4netclerk', name: 'Văn thư NET', unit: 'VNPT NET' }];
    items.forEach(item => { if (!routeRecipients.some(x => x.id === item.id)) routeRecipients.push({ ...item, title: item.name }); });
  }

  function transfer() {
    const r = current(), allowed = r && allowedRecipients(r); if (!allowed || !allowed.length) return toast('Hồ sơ không ở trạng thái được chuyển');
    registerRecipients(); pendingTransferAction = 'kh4Transfer'; currentTransferCfg = { main: '', co: [], send: [], allowed };
    const modal = document.getElementById('transferModal');
    modalSnapshot = { record: r.id, role: r.role, stage: r.stage, summary: modal.querySelector('.route-opinion-summary').innerHTML, rows: ['routeSignFileRow', 'routeIssueFileRow'].map(id => { const row = document.getElementById(id); return { row, name: row.querySelector('.route-file-name').textContent, display: row.style.display, checked: row.querySelector('.route-check').checked }; }) };
    modal.classList.add('kh4-route'); document.getElementById('routeReceiverSearch').value = ''; renderRouteRecipients();
    modalSnapshot.rows[0].row.querySelector('.route-file-name').textContent = 'VB_TCT_trinh_TD_KHPTM_' + tag(r.type) + '_' + r.year + '.pdf';
    modalSnapshot.rows[1].row.querySelector('.route-file-name').textContent = r.activeFile ? r.activeFile.name : '';
    modalSnapshot.rows.forEach((x, index) => { x.row.style.display = index && !r.activeFile ? 'none' : ''; x.row.querySelector('.route-check').checked = true; });
    modal.querySelector('.route-opinion-summary').innerHTML = '<div><b>Tổng hợp ý kiến</b></div>' + [...r.history, ...r.exchange].map(x => '<div class="route-opinion-row"><b>' + esc(x.actor) + '</b><div class="mini">' + esc(x.time) + ' · ' + esc(x.text || '') + '</div></div>').join('');
    document.getElementById('transferNote').value = ''; switchRouteTab('receiver'); modal.classList.add('show');
  }

  function restoreModal() {
    if (!modalSnapshot) return;
    const modal = document.getElementById('transferModal'); modal.classList.remove('kh4-route'); modal.querySelector('.route-opinion-summary').innerHTML = modalSnapshot.summary;
    modalSnapshot.rows.forEach(x => { x.row.querySelector('.route-file-name').textContent = x.name; x.row.style.display = x.display; x.row.querySelector('.route-check').checked = x.checked; });
    modalSnapshot = null;
  }

  function confirmTransfer() {
    const r = current();
    if (!r || !modalSnapshot || modalSnapshot.record !== r.id || modalSnapshot.role !== r.role || modalSnapshot.stage !== r.stage) return toast('Hồ sơ đã thay đổi; mở lại popup Chuyển');
    const selected = selectedRouteRecipients(), allowed = allowedRecipients(r);
    if (!selected.main || !allowed.includes(selected.main.id)) { switchRouteTab('receiver'); return toast('Chọn 01 người xử lý chính trong danh sách được phép'); }
    if (['APPROVED', 'ISSUED'].includes(r.stage)) { const row = document.getElementById('routeIssueFileRow'); if (!r.activeFile || row.style.display === 'none' || !row.querySelector('.route-check').checked) { switchRouteTab('files'); return toast('Chọn quyết định để chuyển'); } }
    const note = document.getElementById('transferNote').value.trim();
    log(r, 'Chuyển hồ sơ tới ' + selected.main.name + (selected.co.length ? ' · Phối hợp: ' + selected.co.map(x => x.name).join(', ') : '') + (selected.view.length ? ' · Xem để biết: ' + selected.view.map(x => x.name).join(', ') : '') + (note ? ' · ' + note : ''));
    if (r.stage === 'ISSUED') { r.stage = 'DONE'; r.returnedTo = selected.main.name; }
    else if (selected.main.id === 'kh4kt') { r.resumeRole = r.role; r.role = roles.kt; }
    else if (r.role === roles.kt) r.role = r.resumeRole || (r.scenario === 'NET' ? roles.net : roles.expert);
    else r.role = selected.main.name;
    pendingTransferAction = ''; hideTransferModal(); render(); toast('Đã chuyển hồ sơ tới ' + selected.main.name);
  }

  function setScenario(value) {
    const r = current(); if (!r || !['NET', 'TD'].includes(value) || r.stage !== 'APPRAISAL' || r.signed) { render(); return toast('Không đổi kịch bản sau khi ký/duyệt'); }
    r.scenario = value; r.role = value === 'NET' ? roles.net : roles.leader; r.appraised = false; render();
  }
  function setRole(value) { const r = current(); if (r && availableRoles(r).includes(value)) { r.role = value; render(); } }
  function availableRoles(r) { return r.scenario === 'NET' ? [roles.net, roles.clerk, roles.kt] : [roles.expert, roles.leader, roles.clerk, roles.kt]; }

  function render() {
    const r = current(); if (!r) return;
    document.getElementById('kh4Title').textContent = 'Thẩm định, phê duyệt KHPTM – ' + r.type;
    document.getElementById('kh4Crumb').textContent = 'QUẢN LÝ KHPTM > Thẩm định, phê duyệt KHPTM > ' + r.type + ' > Chi tiết xử lý';
    document.getElementById('kh4Type').value = r.type; document.getElementById('kh4Scenario').value = r.scenario;
    document.getElementById('kh4Scenario').disabled = r.stage !== 'APPRAISAL' || r.signed;
    document.getElementById('kh4Role').innerHTML = availableRoles(r).map(role => '<option ' + (role === r.role ? 'selected' : '') + '>' + esc(role) + '</option>').join('');
    document.getElementById('kh4Status').textContent = status(r);
    document.getElementById('kh4Actions').innerHTML = actions(r); document.getElementById('kh4Panel').innerHTML = previewHtml(r); renderExtended(r);
  }

  function open(type) {
    currentType = types.includes(type) ? type : currentType; ensure(currentType);
    document.querySelectorAll('.nav .item').forEach(el => el.classList.remove('active')); document.getElementById('nav-khptm').classList.add('active');
    showPage('khptm-step4-process'); render();
  }
  function list() {
    document.querySelectorAll('.nav .item').forEach(el => el.classList.remove('active')); document.getElementById('nav-khptm').classList.add('active');
    document.getElementById('kh4ListRows').innerHTML = types.map((type, index) => { const r = ensure(type); return '<tr><td class="center">' + (index + 1) + '</td><td class="center">2027</td><td>' + esc(type) + '</td><td><span class="khptm-list-title" onclick="kh4.open(\'' + type + '\')">Thẩm định, phê duyệt KHPTM ' + esc(type) + ' năm 2027</span>' + (r.demo ? '<div class="mini">Hồ sơ mẫu</div>' : '') + '</td><td>' + esc(r.sourceIssue.number ? r.sourceIssue.number + '/VNPT Net-' + r.sourceIssue.suffix : '--') + '</td><td>' + esc(status(r)) + '</td><td class="center"><button onclick="kh4.open(\'' + type + '\')">Mở</button></td></tr>'; }).join('');
    showPage('khptm-step4-list');
  }

  function receive(type, incoming) {
    const existing = records.get(type);
    // Không ghi đè một kết quả bước 4 đã được người dùng xử lý.
    if (existing && (!existing.demo || existing.activeFile || existing.decisionOpened)) return;
    const r = makeRecord(type, incoming); records.set(type, r);
    log(r, 'Tiếp nhận hồ sơ TCT đã ban hành và chuyển tới ' + incoming.issue.transferredTo, 'Hệ thống');
  }

  function mount() {
    const anchor = document.getElementById('khptm-build-process'); if (!anchor) return;
    const style = document.createElement('style');
    style.textContent = '#kh4Actions{display:contents}.kh4-empty{min-height:520px;display:flex;align-items:center;justify-content:center;gap:12px;flex-wrap:wrap}.kh4-pdf{width:100%;height:690px;border:0;background:white}#khptm-step4-process .titlebar .buttons button{background:#fff;color:#17344f;border:1px solid #b9cddd}#transferModal.kh4-route button[onclick="openInitialSignModal()"],#transferModal.kh4-route button[onclick="openDigitalSignModal()"],#transferModal.kh4-route button[onclick^="generateTransferFile"],#transferModal.kh4-route .route-unit-block,#transferModal.kh4-route .route-receiver-toolbar button{display:none}';
    document.head.appendChild(style);
    const container = document.createElement('div');
    container.innerHTML = '<section id="khptm-step4-list" class="page"><div class="crumb">QUẢN LÝ KHPTM &gt; Thẩm định, phê duyệt KHPTM</div><div class="titlebar"><h1>Thẩm định, phê duyệt KHPTM</h1><div class="buttons"><button onclick="goHome()">Quay lại</button></div></div><div class="section"><h3>Danh sách hồ sơ</h3><div class="body"><table><thead><tr><th width="45">STT</th><th width="90">Năm KH</th><th width="135">Loại thiết bị</th><th>Hồ sơ KHPTM</th><th width="180">VB TCT trình TĐ</th><th width="220">Trạng thái</th><th width="90">Thao tác</th></tr></thead><tbody id="kh4ListRows"></tbody></table></div></div></section>' +
      '<section id="khptm-step4-process" class="page"><div id="kh4Crumb" class="crumb"></div><div class="titlebar"><h1 id="kh4Title"></h1><div class="buttons"><button onclick="kh4.list()">Danh sách</button><span id="kh4Actions"></span></div></div>' +
      '<div class="khptm-rolebar"><label>Loại thiết bị</label><select id="kh4Type" onchange="kh4.open(this.value)">' + types.map(type => '<option>' + type + '</option>').join('') + '</select><label>Kịch bản test</label><select id="kh4Scenario" onchange="kh4.setScenario(this.value)"><option value="NET">NET thực hiện thay TĐ</option><option value="TD">TĐ dùng OnePMS</option></select><label>Vai trò test</label><select id="kh4Role" onchange="kh4.setRole(this.value)"></select><span id="kh4Status" class="right-note"></span></div><div id="kh4Panel"></div><div id="kh4Extended"></div></section>';
    [...container.children].forEach(section => anchor.parentNode.insertBefore(section, anchor.nextSibling));
    const nav = document.getElementById('nav-khptm'), item = document.createElement('div'); item.className = 'subitem'; item.textContent = 'Thẩm định, phê duyệt KHPTM'; item.onclick = event => { event.stopPropagation(); list(); }; nav.appendChild(item);
  }

  // Các điểm nối bổ sung gọi lại nguyên hàm cũ trước/sau khi xử lý context bước 4.
  const previousClerkTransfer = confirmKHPTM2ClerkTransfer;
  confirmKHPTM2ClerkTransfer = function () {
    const type = khptm2DeviceType, before = khptm2ClerkIssue().transferredTo;
    const result = previousClerkTransfer.apply(this, arguments), sent = khptm2ClerkIssue();
    if (!before && sent.transferredTo) receive(type, { issue: { ...sent }, history: khptm2History, exchange: khptm2Exchange });
    return result;
  };
  const previousConfirm = confirmTransferFromModal;
  confirmTransferFromModal = function () { return pendingTransferAction === 'kh4Transfer' ? confirmTransfer() : previousConfirm.apply(this, arguments); };
  const previousHide = hideTransferModal;
  hideTransferModal = function () { restoreModal(); return previousHide.apply(this, arguments); };
  const previousPreview = openTransferPreview;
  openTransferPreview = function (title) { if (pendingTransferAction !== 'kh4Transfer') return previousPreview.apply(this, arguments); return title.indexOf('Tờ trình') === 0 ? previewSource() : current() && current().activeFile ? previewFile(current().files.indexOf(current().activeFile)) : previewSource(); };

  window.kh4 = { open, list, render, setScenario, setRole, generate, upload, approve, sign, issue, updateIssue, takeNumber, transfer, extTab, sendExchange, exchangeFileChanged, previewSource, previewSubmission, previewFile };
  mount();
}());
