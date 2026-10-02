/* SOP1-TB bước 5: dữ liệu đề xuất và tài liệu cùng phiên bản.
 * Trường nghiệp vụ đối chiếu SOP2-TB-4B, SOP1-TB-01B/02A và bảng tính SOP1-TB-01A/01B.
 * Không có mẫu báo cáo bước 5 riêng trong bộ hồ sơ; không dùng QĐ phê duyệt làm đầu ra đề xuất.
 */
(function (root) {
  'use strict';
  const types = ['Core di động', 'Vô tuyến', 'BRCĐ'];
  const roles = { pm: 'PM Ban KT', lead: 'LĐ Ban KT', tct: 'LĐ TCT', tctClerk: 'Văn thư TCT', khdt: 'LĐ Ban KHĐT' };
  const fields = [
    ['name', 'Tên đề xuất', 'input'], ['unit', 'Đơn vị lập', 'input'], ['author', 'Người lập', 'input'],
    ['date', 'Ngày lập', 'date'], ['deadline', 'Thời hạn hoàn thành', 'date'], ['location', 'Địa điểm / khu vực triển khai', 'input'],
    ['current', 'Hiện trạng hạ tầng, mạng lưới và năng lực', 'textarea'], ['spares', 'Vật tư, thiết bị dự phòng và khả năng tận dụng', 'textarea'],
    ['need', 'Nhu cầu phát triển và sự cần thiết', 'textarea'], ['goal', 'Mục tiêu và phạm vi', 'textarea'],
    ['investment', 'Hình thức đầu tư dự kiến', 'input'], ['options', 'Các phương án kỹ thuật, công nghệ và so sánh ưu / nhược điểm', 'textarea'],
    ['selected', 'Phương án kỹ thuật, công nghệ lựa chọn', 'textarea'], ['reason', 'Căn cứ lựa chọn và khả năng tương thích hệ thống hiện có', 'textarea'],
    ['method', 'Nguyên tắc, phương pháp tính toán quy mô', 'textarea'], ['parameters', 'Tham số đầu vào và thông số kỹ thuật', 'textarea'],
    ['result', 'Kết quả tính toán quy mô / năng lực', 'textarea'], ['schedule', 'Tiến độ thực hiện dự kiến', 'textarea'],
    ['recommendation', 'Kết luận và kiến nghị', 'textarea']
  ];
  const columns = [['project', 'Tên dự án / hạng mục'], ['device', 'Thiết bị / dịch vụ / phụ trợ'], ['location', 'Địa điểm'],
    ['unit', 'Đơn vị tính'], ['existing', 'Quy mô hiện có'], ['required', 'Nhu cầu / quy mô tính toán'], ['quantity', 'Số lượng trang bị'],
    ['capacity', 'Năng lực / thông số kỹ thuật'], ['price', 'Đơn giá khái toán (VNĐ)'], ['schedule', 'Tiến độ'], ['note', 'Ghi chú']];
  const emptyRow = () => Object.fromEntries(columns.map(([key]) => [key, '']));
  const owns = (r, actor) => !!r && r.owner === actor && r.receipt?.to === actor;
  const canEdit = (r, actor) => owns(r, actor) && actor === 'pm' && r.receipt.purpose === 'PREPARE';
  function create(basis, id) {
    if (!basis || !types.includes(basis.type) || !basis.decision?.signed || !basis.decision?.issued) throw Error('Chọn KHPTM đã ký và ban hành');
    const data = Object.fromEntries(fields.map(([key]) => [key, '']));
    Object.assign(data, { name: 'Đề xuất lựa chọn PAKT, CN và quy mô ' + basis.type + ' năm ' + basis.year, unit: 'Ban KT', date: new Date().toISOString().slice(0, 10) });
    return { id, basis: { ...basis, decision: { ...basis.decision } }, data, rows: [emptyRow()], revision: 1,
      owner: 'pm', viewer: 'pm', receipt: { from: null, to: 'pm', purpose: 'PREPARE', revision: 1, files: [], time: new Date().toISOString() },
      files: [], archive: [], submission: null, history: [], exchange: [], drafts: {}, tab: 'files', issue: {} };
  }
  function validate(data, rows) {
    if (!data.name.trim() || !data.author.trim() || !data.date || !data.selected.trim() || !data.method.trim() || !data.result.trim())
      throw Error('Nhập tên đề xuất, người lập, ngày lập, phương án lựa chọn, phương pháp và kết quả tính quy mô');
    if (!rows.length || rows.some(row => !row.device.trim() || !row.unit.trim() || !Number.isFinite(Number(row.quantity)) || Number(row.quantity) <= 0 ||
      (row.price !== '' && (!Number.isFinite(Number(row.price)) || Number(row.price) < 0)))) throw Error('Danh mục cần tên thiết bị, đơn vị tính, số lượng lớn hơn 0 và đơn giá không âm');
  }
  function save(r, actor, data, rows) {
    if (!canEdit(r, actor)) throw Error('Hồ sơ chưa được giao cho PM để lập / sửa đề xuất');
    validate(data, rows);
    if (JSON.stringify([r.data, r.rows]) === JSON.stringify([data, rows])) return false;
    if (r.files.some(f => f.generated) || r.submission) {
      r.archive.push({ revision: r.revision, data: { ...r.data }, rows: r.rows.map(row => ({ ...row })),
        files: r.files.filter(f => f.generated), submission: r.submission });
      r.files = r.files.filter(f => !f.generated); r.submission = null;
    }
    r.data = { ...data }; r.rows = rows.map(row => ({ ...row })); r.revision++; r.receipt.revision = r.revision;
    return true;
  }
  function installPair(r, actor, pair) {
    if (!canEdit(r, actor)) throw Error('Chỉ PM đang được giao lập đề xuất được tạo file');
    validate(r.data, r.rows);
    if (pair.length !== 2 || pair[0].docType !== 'report' || pair[1].docType !== 'catalog' || pair.some(f => f.revision !== r.revision)) throw Error('Bộ báo cáo và danh mục không cùng phiên bản');
    // Hai tài liệu được thay cùng một lần; tạo lại không nhân đôi hoặc xóa tệp người dùng tải lên.
    r.files = [...r.files.filter(f => !f.generated), ...pair];
  }
  const pairReady = r => ['report', 'catalog'].every(kind => r.files.some(f => f.docType === kind && f.revision === r.revision));
  const receivedSubmission = r => r.submission && r.submission.revision === r.revision && r.receipt.revision === r.revision && r.receipt.files.includes(r.submission.id);
  const canSign = (r, actor) => owns(r, actor) && ['lead', 'tct'].includes(actor) && r.receipt.purpose === 'REVIEW' && receivedSubmission(r) && !r.submission.signatures.includes(actor);
  const canIssue = (r, actor) => owns(r, actor) && actor === 'tctClerk' && r.receipt.purpose === 'ISSUE' &&
    ['lead', 'tct'].includes(r.receipt.from) && receivedSubmission(r) && r.submission.signatures.length > 0 && !r.submission.issued;
  function allowed(r, actor) {
    if (!owns(r, actor)) return [];
    if (actor === 'pm') return pairReady(r) ? ['lead'] : [];
    if (!receivedSubmission(r)) return [];
    if (actor === 'lead' && r.receipt.purpose === 'REVIEW') return ['pm', 'tct', ...(r.submission.signatures.includes('lead') ? ['tctClerk'] : [])];
    if (actor === 'tct' && r.receipt.purpose === 'REVIEW') return ['lead', 'pm', ...(r.submission.signatures.includes('tct') ? ['tctClerk'] : [])];
    if (actor === 'tctClerk' && r.receipt.purpose === 'ISSUE') return r.submission.issued ? ['lead', 'tct', 'khdt'] : ['lead', 'tct'];
    return [];
  }
  function transfer(r, actor, to, detail) {
    if (!allowed(r, actor).includes(to)) throw Error('Người nhận không thuộc nhiệm vụ hiện tại');
    if (!detail.files.includes(r.submission?.id)) throw Error('Chọn Tờ trình để chuyển cùng hồ sơ');
    if (actor === 'pm' && r.files.filter(f => ['report', 'catalog'].includes(f.docType)).some(f => !detail.files.includes(f.id))) throw Error('Chọn Báo cáo đề xuất và file danh mục');
    if (to === 'pm' && !detail.note.trim()) throw Error('Nhập yêu cầu sửa / bổ sung đề xuất');
    const purpose = to === 'pm' ? 'PREPARE' : to === 'tctClerk' ? 'ISSUE' : to === 'khdt' ? 'RESULT' : 'REVIEW';
    r.receipt = { ...detail, files: detail.files.slice(), co: (detail.co || []).slice(), view: (detail.view || []).slice(),
      from: actor, to, purpose, revision: r.revision, time: new Date().toISOString() };
    r.owner = to; r.viewer = to;
  }
  function sign(r, actor) { if (!canSign(r, actor)) throw Error('Không có nhiệm vụ ký Tờ trình phiên bản này'); r.submission.signatures.push(actor); }
  function issue(r, actor, metadata) {
    if (!canIssue(r, actor)) throw Error('Chỉ Văn thư nhận Tờ trình đã ký mới được ban hành');
    if (!metadata.number.trim() || !metadata.date) throw Error('Nhập số và ngày ban hành');
    r.issue = { ...metadata }; r.submission.issued = true;
  }
  const api = { types, roles, fields, columns, emptyRow, create, owns, canEdit, save, validate, installPair, pairReady, allowed, transfer, canSign, sign, canIssue, issue };
  root.KHStep5 = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
}(typeof window === 'undefined' ? globalThis : window));

/* OOXML thực: ZIP không nén, UTF-8; ô danh mục là chuỗi / số, không chạy công thức. */
(function (root) {
  'use strict';
  const xml = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' }[c])).replace(/[\x00-\x08\x0b\x0c\x0e-\x1f]/g, '');
  const encoder = new TextEncoder();
  function zip(entries) {
    const chunks = [], central = []; let offset = 0;
    function header(length) { const bytes = new Uint8Array(length); return [bytes, new DataView(bytes.buffer)]; }
    for (const [path, content] of Object.entries(entries)) {
      const name = encoder.encode(path), bytes = encoder.encode(content); let crc = 0xffffffff;
      for (const byte of bytes) { crc ^= byte; for (let bit = 0; bit < 8; bit++) crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0); }
      crc = (crc ^ 0xffffffff) >>> 0;
      const [local, v] = header(30); v.setUint32(0, 0x04034b50, true); v.setUint16(4, 20, true); v.setUint16(6, 0x800, true);
      v.setUint32(14, crc, true); v.setUint32(18, bytes.length, true); v.setUint32(22, bytes.length, true); v.setUint16(26, name.length, true);
      chunks.push(local, name, bytes);
      const [dir, d] = header(46); d.setUint32(0, 0x02014b50, true); d.setUint16(4, 20, true); d.setUint16(6, 20, true); d.setUint16(8, 0x800, true);
      d.setUint32(16, crc, true); d.setUint32(20, bytes.length, true); d.setUint32(24, bytes.length, true); d.setUint16(28, name.length, true); d.setUint32(42, offset, true);
      central.push(dir, name); offset += local.length + name.length + bytes.length;
    }
    const size = central.reduce((n, c) => n + c.length, 0), [end, e] = header(22);
    e.setUint32(0, 0x06054b50, true); e.setUint16(8, central.length / 2, true); e.setUint16(10, central.length / 2, true); e.setUint32(12, size, true); e.setUint32(16, offset, true);
    return new Blob([...chunks, ...central, end]);
  }
  function docx(paragraphs) {
    return zip({
      '[Content_Types].xml': '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>',
      '_rels/.rels': '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>',
      'word/document.xml': '<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>' + paragraphs.map(text => '<w:p><w:r><w:rPr><w:rFonts w:ascii="Times New Roman" w:hAnsi="Times New Roman"/><w:sz w:val="26"/></w:rPr>' + String(text).split('\n').map((line, i) => (i ? '<w:br/>' : '') + '<w:t xml:space="preserve">' + xml(line) + '</w:t>').join('') + '</w:r></w:p>').join('') + '<w:sectPr><w:pgSz w:w="11906" w:h="16838"/><w:pgMar w:top="1134" w:right="1134" w:bottom="1134" w:left="1701"/></w:sectPr></w:body></w:document>'
    });
  }
  function xlsx(rows) {
    const col = n => n < 26 ? String.fromCharCode(65 + n) : String.fromCharCode(64 + Math.floor(n / 26)) + String.fromCharCode(65 + n % 26);
    const sheet = rows.map((row, i) => '<row r="' + (i + 1) + '">' + row.map((value, j) => '<c r="' + col(j) + (i + 1) + '"' + (typeof value === 'number' ? '><v>' + value + '</v>' : ' t="inlineStr"><is><t xml:space="preserve">' + xml(value) + '</t></is>') + '</c>').join('') + '</row>').join('');
    return zip({
      '[Content_Types].xml': '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/></Types>',
      '_rels/.rels': '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>',
      'xl/workbook.xml': '<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="Danh mục PAKT CN" sheetId="1" r:id="rId1"/></sheets></workbook>',
      'xl/_rels/workbook.xml.rels': '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/></Relationships>',
      'xl/worksheets/sheet1.xml': '<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><cols>' + Array.from({length: Math.max(...rows.map(row => row.length))}, (_, i) => '<col min="' + (i + 1) + '" max="' + (i + 1) + '" width="25" customWidth="1"/>').join('') + '</cols><sheetData>' + sheet + '</sheetData></worksheet>'
    });
  }
  root.KHStep5Office = { docx, xlsx };
  if (typeof module !== 'undefined' && module.exports) Object.assign(module.exports, { office: root.KHStep5Office });
}(typeof window === 'undefined' ? globalThis : window));

(function () {
  'use strict';
  if (typeof window === 'undefined') return;
  const W = KHStep5, records = new Map(); let currentId = '', creationBasis = '', modal = null, signSession = null;
  const now = () => new Date().toLocaleString('vi-VN', { hour12: false });
  const current = () => records.get(currentId), own = r => W.owns(r, r.viewer), edit = r => W.canEdit(r, r.viewer);
  const button = (label, action, enabled = true, cls = '') => '<button class="' + cls + '" onclick="' + action + '"' + (enabled ? '' : ' disabled') + '>' + label + '</button>';
  const section = (title, body) => '<div class="section"><h3>' + title + '</h3><div class="body">' + body + '</div></div>';
  const note = text => '<div class="mini" style="padding:10px">' + esc(text) + '</div>';
  function log(r, text, actor) { r.history.unshift({ actor: actor || W.roles[r.viewer], text, time: now(), receipt: { ...r.receipt, files: r.receipt.files.slice() } }); }
  let extTemplate;
  const previous = { type: khptm2DeviceType, role: khptm2Role, step: khptm2Step };
  try { khptm2DeviceType = 'Core di động'; khptm2Role = 'Chuyên viên Ban KT'; khptm2Step = 'B1'; extTemplate = khptm2ExtendedHtml(); }
  finally { khptm2DeviceType = previous.type; khptm2Role = previous.role; khptm2Step = previous.step; }
  const page = document.createElement('section'); page.id = 'kh5Page'; page.className = 'page'; document.querySelector('.shell').appendChild(page);
  const nav = document.createElement('div'); nav.className = 'subitem'; nav.textContent = 'Lựa chọn PAKT, CN, tính toán quy mô'; nav.onclick = event => { event.stopPropagation(); list(); };
  document.querySelector('#nav-khptm .submenu').appendChild(nav);
  function list() {
    showPage('kh5Page'); currentId = '';
    page.innerHTML = '<div class="crumb">QUẢN LÝ KHPTM &gt; Lựa chọn PAKT, CN, tính toán quy mô</div><div class="toolbar">' + button('Tạo đề xuất', 'kh5.createScreen()', true, 'primary') + '</div>' + section('Danh sách đề xuất lựa chọn PAKT, CN và quy mô',
      '<div style="overflow:auto"><table><thead><tr><th>STT</th><th>Tên đề xuất</th><th>Loại thiết bị</th><th>Căn cứ KHPTM</th><th>Người xử lý chính</th><th>Trạng thái</th><th>Thao tác</th></tr></thead><tbody>' + ([...records.values()].map((r, i) => '<tr><td>' + (i + 1) + '</td><td>' + esc(r.data.name) + '</td><td>' + esc(r.basis.type) + '</td><td>' + esc(r.basis.title) + '</td><td>' + esc(W.roles[r.owner]) + '</td><td>' + state(r) + '</td><td>' + button('Xem', "kh5.open('" + r.id + "')") + '</td></tr>').join('') || '<tr><td colspan="7">Chưa có đề xuất.</td></tr>') + '</tbody></table></div>');
  }
  function state(r) { return r.receipt.purpose === 'PREPARE' ? 'Đang lập / sửa đề xuất' : r.receipt.purpose === 'ISSUE' ? r.submission?.issued ? 'Đã ban hành' : 'Chờ ban hành' : r.receipt.purpose === 'RESULT' ? 'Đã chuyển kết quả' : r.submission?.signatures.includes(r.owner) ? 'Đã ký – chờ chuyển' : 'Chờ xem xét đề xuất'; }
  function basisPicker(selected) {
    const plans = kh4.approvedPlans();
    return '<label for="kh5Basis">Căn cứ: KHPTM đã được phê duyệt <span class="red">*</span></label><select id="kh5Basis" onchange="kh5.chooseBasis(this.value)"><option value="">-- Chọn KHPTM đã phê duyệt --</option>' + plans.map(p => '<option value="' + esc(p.id) + '"' + (p.id === selected ? ' selected' : '') + '>' + esc(p.title + ' · QĐ ' + p.number + ' · ' + formatDateVN(p.date)) + '</option>').join('') + '</select><div id="kh5BasisAction" style="margin-top:8px">' + (selected ? button('Xem QĐ phê duyệt KHPTM', 'kh5.previewBasis()') : '') + '</div>' + (plans.length ? '' : note('Chưa có KHPTM đã ký và ban hành. Hoàn thành phê duyệt KHPTM ở bước trước để chọn căn cứ.') + button('Mở Xây dựng, trình KHPTM', 'openKHPTMBuildModule()'));
  }
  function createScreen(basisId) {
    creationBasis = kh4.approvedPlans().some(p => p.id === basisId) ? basisId : ''; currentId = ''; showPage('kh5Page');
    page.innerHTML = '<div class="crumb">QUẢN LÝ KHPTM &gt; Tạo đề xuất lựa chọn PAKT, CN và quy mô</div><div class="toolbar">' + button('Quay lại', 'kh5.list()') + button('Tạo đề xuất', 'kh5.create()', true, 'primary') + '</div>' + section('Thông tin đề xuất', basisPicker(creationBasis));
  }
  function chooseBasis(id) { creationBasis = id; document.getElementById('kh5BasisAction').innerHTML = id ? button('Xem QĐ phê duyệt KHPTM', 'kh5.previewBasis()') : ''; }
  function create() {
    const basis = kh4.approvedPlans().find(p => p.id === creationBasis);
    try { const r = W.create(basis, 'PAKT-' + Date.now() + '-' + records.size); records.set(r.id, r); currentId = r.id; log(r, 'Tạo đề xuất căn cứ ' + basis.title + ' · QĐ ' + basis.number); render(); }
    catch (error) { toast(error.message); }
  }
  function open(id) { if (!records.has(id)) return; currentId = id; records.get(id).viewer = records.get(id).owner; showPage('kh5Page'); render(); }
  function fieldHtml(r, key, label, kind) {
    const attrs = ' id="kh5Field_' + key + '" data-kh5-field="' + key + '"' + (!edit(r) ? ' disabled' : '');
    return '<div><label for="kh5Field_' + key + '">' + label + (['name', 'author', 'date', 'selected', 'method', 'result'].includes(key) ? ' <span class="red">*</span>' : '') + '</label>' + (kind === 'textarea' ? '<textarea' + attrs + ' style="min-height:90px">' + esc(r.data[key]) + '</textarea>' : '<input type="' + (kind === 'date' ? 'date' : 'text') + '"' + attrs + ' value="' + esc(r.data[key]) + '">') + '</div>';
  }
  function group(r, title, start, end) { return section(title, '<div class="grid" style="grid-template-columns:repeat(2,minmax(0,1fr))">' + W.fields.slice(start, end).map(f => fieldHtml(r, ...f)).join('') + '</div>'); }
  function rowHtml(row, index, editable) {
    return '<tr data-kh5-row><td>' + (index + 1) + '</td>' + W.columns.map(([key, label]) => '<td><input aria-label="' + esc(label + ' ' + (index + 1)) + '" data-kh5-col="' + key + '" type="' + (['quantity', 'price'].includes(key) ? 'number' : 'text') + '"' + (['quantity', 'price'].includes(key) ? ' min="0" step="any"' : '') + ' value="' + esc(row[key]) + '"' + (!editable ? ' disabled' : '') + '></td>').join('') + '<td>' + button('Xóa', 'kh5.removeRow(' + index + ')', editable) + '</td></tr>';
  }
  function form(r) {
    return group(r, 'Thông tin chung', 0, 6) + group(r, 'Hiện trạng, sự cần thiết và mục tiêu', 6, 11) + group(r, 'Lựa chọn phương án kỹ thuật, công nghệ', 11, 14) + group(r, 'Tính toán quy mô', 14, 17) +
      section('Danh mục và khái toán quy mô trang bị', '<div style="overflow:auto"><table style="min-width:1900px"><thead><tr><th>STT</th>' + W.columns.map(([, label]) => '<th>' + label + '</th>').join('') + '<th>Thao tác</th></tr></thead><tbody id="kh5CatalogRows">' + r.rows.map((row, i) => rowHtml(row, i, edit(r))).join('') + '</tbody></table></div>' + (edit(r) ? '<div class="toolbar">' + button('Thêm hạng mục', 'kh5.addRow()') + '</div>' : '')) + group(r, 'Tiến độ, kết luận và kiến nghị', 17, 19);
  }
  function readForm(r) {
    const data = { ...r.data }; page.querySelectorAll('[data-kh5-field]').forEach(el => { data[el.dataset.kh5Field] = el.value.trim(); });
    const rows = [...page.querySelectorAll('[data-kh5-row]')].map(row => Object.fromEntries([...row.querySelectorAll('[data-kh5-col]')].map(el => [el.dataset.kh5Col, el.value.trim()])));
    return { data, rows };
  }
  function addRow() { const r = current(); if (!edit(r)) return; const body = document.getElementById('kh5CatalogRows'); body.insertAdjacentHTML('beforeend', rowHtml(W.emptyRow(), body.children.length, true)); }
  function removeRow(index) { const r = current(); if (!edit(r)) return; const body = document.getElementById('kh5CatalogRows'); body.children[index]?.remove(); [...body.children].forEach((row, i) => { row.children[0].textContent = i + 1; row.querySelector('button').setAttribute('onclick', 'kh5.removeRow(' + i + ')'); }); }
  function save(silent) {
    const r = current(); if (!r) return false;
    try { const input = readForm(r); if (W.save(r, r.viewer, input.data, input.rows)) log(r, 'Lưu đề xuất phiên bản ' + r.revision); if (!silent) { render(); toast('Đã lưu đề xuất'); } return true; }
    catch (error) { toast(error.message); return false; }
  }
  function total(r) { return r.rows.reduce((sum, row) => sum + Number(row.quantity) * Number(row.price || 0), 0); }
  function paragraphs(r, kind) {
    const title = kind === 'submission' ? 'TỜ TRÌNH' : 'BÁO CÁO ĐỀ XUẤT';
    return [r.data.unit.toUpperCase(), title, r.data.name, 'Ngày lập: ' + formatDateVN(r.data.date), ...(kind === 'submission' && r.submission?.issued ? ['Số: ' + r.issue.number + (r.issue.suffix ? '/' + r.issue.suffix : ''), 'Ngày ban hành: ' + formatDateVN(r.issue.date)] : []),
      'Căn cứ ' + r.basis.title + ', Quyết định số ' + r.basis.number + ' ngày ' + formatDateVN(r.basis.date),
      ...W.fields.filter(([key]) => !['name', 'unit', 'date'].includes(key)).map(([key, label]) => label + ':\n' + (r.data[key] || '')),
      'Danh mục quy mô trang bị (chi tiết trong file danh mục kèm theo):', ...r.rows.map((row, i) => (i + 1) + '. ' + W.columns.map(([key, label]) => label + ': ' + row[key]).join('; ')),
      'Tổng khái toán: ' + total(r).toLocaleString('vi-VN') + ' VNĐ',
      ...(kind === 'submission' && r.submission?.signatures.length ? ['Chữ ký (demo): ' + r.submission.signatures.map(key => W.roles[key]).join(', ')] : [])];
  }
  function catalogMatrix(r) { return [['Căn cứ', r.basis.title, r.basis.number, r.basis.date], ['Đề xuất', r.data.name], ['Phiên bản', r.revision],
    ['STT', ...W.columns.map(([, label]) => label), 'Thành tiền khái toán (VNĐ)'],
    ...r.rows.map((row, i) => [i + 1, ...W.columns.map(([key]) => ['quantity', 'price'].includes(key) && row[key] !== '' ? Number(row[key]) : row[key]), Number(row.quantity) * Number(row.price || 0)]),
    ['Tổng khái toán (VNĐ)', total(r)]]; }
  function paper(r, kind) {
    if (kind === 'catalog') return '<h2>DANH MỤC LỰA CHỌN PAKT, CN VÀ QUY MÔ</h2><div style="overflow:auto"><table><tbody>' + catalogMatrix(r).map(row => '<tr>' + row.map(v => '<td>' + esc(v) + '</td>').join('') + '</tr>').join('') + '</tbody></table></div>';
    return paragraphs(r, kind).map((text, i) => i === 1 ? '<h2>' + esc(text) + '</h2>' : '<p style="white-space:pre-wrap">' + esc(text) + '</p>').join('');
  }
  function buildFile(r, kind) {
    const name = (kind === 'report' ? 'Bao_cao_de_xuat' : kind === 'catalog' ? 'Danh_muc_PAKT_CN_quy_mo' : 'To_trinh_PAKT_CN_quy_mo') + '_' + r.basis.type.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^\w]+/g, '_') + '_' + r.basis.year + '_v' + r.revision + (kind === 'catalog' ? '.xlsx' : '.docx');
    const blob = kind === 'catalog' ? KHStep5Office.xlsx(catalogMatrix(r)) : KHStep5Office.docx(paragraphs(r, kind));
    return { id: r.id + '-' + kind + '-v' + r.revision, name, docType: kind, generated: true, revision: r.revision,
      html: paper(r, kind), blob, url: URL.createObjectURL(blob), actor: W.roles[r.viewer], time: now(), signatures: [], issued: false };
  }
  function ensureSubmission(r) { if (!r.submission) r.submission = buildFile(r, 'submission'); return r.submission; }
  function generate() {
    const r = current(); if (!edit(r) || !save(true)) return;
    try { const pair = [buildFile(r, 'report'), buildFile(r, 'catalog')], old = r.files.filter(f => f.generated); W.installPair(r, r.viewer, pair); old.forEach(f => URL.revokeObjectURL(f.url));
      log(r, 'Tạo đồng thời Báo cáo đề xuất và file danh mục từ template · phiên bản ' + r.revision); r.tab = 'files'; render(); toast('Đã thêm Báo cáo đề xuất và file danh mục vào Tài liệu đính kèm'); }
    catch (error) { toast(error.message); }
  }
  function preview(title, html, url) {
    document.getElementById('khptmPreviewTitle').textContent = title;
    document.getElementById('khptmPreviewPaper').innerHTML = url ? '<iframe title="' + esc(title) + '" src="' + url + '" style="width:100%;height:70vh;border:0"></iframe>' : html;
    document.getElementById('khptmPreviewModal').classList.add('show');
  }
  function previewBasis() { const basis = current()?.basis || kh4.approvedPlans().find(p => p.id === creationBasis); if (basis) preview('QĐ phê duyệt ' + basis.title, basis.decision.html, basis.decision.kind === 'uploaded' ? basis.decision.url : null); }
  function previewSubmission() {
    const r = current(); if (!r) return;
    if (edit(r)) { const input = readForm(r); preview('Xem Tờ trình', paper({ ...r, ...input, submission: null }, 'submission')); }
    else preview('Xem Tờ trình', r.submission?.html || paper(r, 'submission'));
  }
  function previewArchive(version, index) { const file = current()?.archive[version]?.files[index]; if (file) preview(file.name, file.html); }
  function previewFile(index) {
    const file = current()?.files[index]; if (!file) return;
    if (file.html) preview(file.name, file.html);
    else if (file.mime === 'application/pdf' || /\.pdf$/i.test(file.name)) preview(file.name, '', file.url);
    else { const a = document.createElement('a'); a.href = file.url; a.download = file.name; a.click(); }
  }
  function actions(r) {
    let html = button('Quay lại', 'kh5.list()') + button('Xem QĐ phê duyệt KHPTM', 'kh5.previewBasis()') + button('Xem Tờ trình', 'kh5.previewSubmission()');
    if (r.viewer === 'pm') html += button('Lưu đề xuất', 'kh5.save()', edit(r), 'primary');
    if (['lead', 'tct'].includes(r.viewer)) html += button('Ký số Tờ trình', 'kh5.sign()', W.canSign(r, r.viewer));
    if (r.viewer === 'tctClerk') html += button('Lấy số', 'kh5.takeNumber()', W.canIssue(r, r.viewer)) + button('Ban hành', 'kh5.issue()', W.canIssue(r, r.viewer), 'primary');
    return html + button('Chuyển', 'kh5.transfer()', own(r) && (edit(r) || W.allowed(r, r.viewer).length > 0));
  }
  function render() {
    const r = current(); if (!r) return; showPage('kh5Page');
    page.innerHTML = '<div class="crumb">QUẢN LÝ KHPTM &gt; Đề xuất lựa chọn PAKT, CN và quy mô</div><div class="toolbar"><label>Vai trò test</label><select id="kh5Role" onchange="kh5.setRole(this.value)">' + Object.entries(W.roles).map(([key, label]) => '<option value="' + key + '"' + (key === r.viewer ? ' selected' : '') + '>' + label + '</option>').join('') + '</select><span class="mini">' + state(r) + '</span></div><div class="toolbar">' + actions(r) + '</div>' +
      section('Thông tin hồ sơ', '<div class="grid" style="grid-template-columns:repeat(2,minmax(0,1fr))"><div><label>Căn cứ KHPTM đã phê duyệt</label><div>' + esc(r.basis.title + ' · QĐ ' + r.basis.number) + '</div></div><div><label>Người xử lý chính</label><div>' + esc(W.roles[r.owner]) + '</div></div><div><label>Người chuyển trước</label><div>' + esc(W.roles[r.receipt.from] || 'PM khởi tạo') + '</div></div><div><label>Nội dung xử lý</label><div style="white-space:pre-wrap">' + esc(r.receipt.note || 'Lập đề xuất lựa chọn PAKT, CN và tính toán quy mô') + '</div></div></div>') +
      (r.viewer === 'pm' ? form(r) : section('Preview văn bản', '<div class="khptm-doc-preview"><div class="khptm-paper">' + (r.submission?.html || paper(r, 'submission')) + '</div></div>')) +
      (r.viewer === 'tctClerk' ? section('Thông tin ban hành', '<div class="grid" style="grid-template-columns:repeat(4,minmax(0,1fr))">' + [['number', 'Số văn bản'], ['date', 'Ngày ban hành'], ['suffix', 'Ký hiệu'], ['eoffice', 'Số eOffice']].map(([key, label]) => '<div><label>' + label + '</label><input id="kh5Issue_' + key + '" type="' + (key === 'date' ? 'date' : 'text') + '" value="' + esc(r.issue[key] || '') + '"' + (!W.canIssue(r, r.viewer) ? ' disabled' : '') + '></div>').join('') + '</div>') : '') + '<div id="kh5Extended"></div>';
    renderExtended(r);
  }
  function setRole(role) { const r = current(); if (r && W.roles[role]) { if (modal) hideTransferModal(); r.viewer = role; render(); } }
  function renderExtended(r) {
    const host = document.getElementById('kh5Extended'); host.innerHTML = extTemplate.replaceAll('khptm2', 'kh5').replaceAll('switchKHPTM2ExtTab', 'kh5.extTab').replaceAll('sendKHPTM2Exchange', 'kh5.sendExchange').replaceAll('kh5ExchangeFileChanged', 'kh5.exchangeFileChanged');
    const row = (file, i, action) => '<tr><td class="center">' + i + '</td><td class="center">' + (file.signatures?.length || file.signed ? '☒' : '☐') + '</td><td class="center"><input type="checkbox" checked disabled></td><td class="center"><input type="checkbox"' + (file.docType === 'report' ? ' checked' : '') + ' disabled></td><td class="center"><input type="checkbox"' + (file.docType !== 'report' ? ' checked' : '') + ' disabled></td><td>' + esc(file.number || '') + '</td><td>' + esc(file.eoffice || '') + '</td><td>' + esc(file.issuer || r.data.unit) + '</td><td>' + esc(file.signer || '--') + '</td><td>' + esc(file.group || (file.docType === 'report' ? 'Báo cáo đề xuất' : 'File danh mục')) + '</td><td><span class="pm-ext-file" onclick="' + action + '">' + esc(file.name) + '</span></td><td>' + esc(file.actor || '') + '</td><td>' + esc(file.time || '') + '</td><td></td><td></td><td>' + button('Xem', action, true, 'pm-ext-action') + (file.url ? ' <a class="pm-ext-action" href="' + file.url + '" download="' + esc(file.name) + '">Tải</a>' : '') + '</td></tr>';
    host.querySelector('.pm-ext-table tbody').innerHTML = row({ ...r.basis.decision, number: r.basis.number, issuer: 'Tập đoàn', signer: 'LĐ Tập đoàn', group: 'QĐ phê duyệt KHPTM' }, 1, 'kh5.previewBasis()') + r.files.map((f, i) => row(f, i + 2, 'kh5.previewFile(' + i + ')')).join('');
    if (r.archive.length) { const archive = document.createElement('div'); archive.style.marginTop = '10px'; archive.innerHTML = '<b>Phiên bản tài liệu trước</b>' + r.archive.map((v, vi) => '<div class="toolbar"><span class="mini">Phiên bản ' + v.revision + '</span>' + v.files.map((f, fi) => button(f.name, 'kh5.previewArchive(' + vi + ',' + fi + ')')).join('') + (v.submission ? '<a href="' + v.submission.url + '" download="' + esc(v.submission.name) + '">Tải Tờ trình' + (v.submission.signatures.length ? ' đã ký (demo)' : '') + '</a>' : '') + '</div>').join(''); host.querySelector('#kh5ExtFiles').appendChild(archive); }
    const links = host.querySelectorAll('.pm-ext-add-links span');
    [generate, addUploadRow, saveUploads].forEach((fn, i) => { links[i].removeAttribute('onclick'); links[i].onclick = fn; links[i].setAttribute('role', 'button'); links[i].tabIndex = 0; links[i].onkeydown = e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); fn(); } }; });
    host.querySelector('.pm-ext-add-table tbody').innerHTML = uploadRow();
    if (!edit(r)) { host.querySelector('.pm-ext-add-table').remove(); host.querySelector('.pm-ext-add-links').remove(); }
    host.querySelector('#kh5History').innerHTML = r.history.slice().reverse().map(x => '<div class="history-item"><div class="history-dot"></div><div><b>' + esc(x.actor) + '</b><div>' + esc(x.text) + '</div><div class="mini">' + esc(x.time) + '</div></div></div>').join('');
    khInfo.renderExchangeInto(host.querySelector('#kh5Exchange'), r.exchange);
    const draft = r.drafts[r.viewer] || (r.drafts[r.viewer] = { text: '', file: null });
    const ta = host.querySelector('#kh5QuickExchange'); ta.value = draft.text; ta.oninput = () => { draft.text = ta.value; };
    host.querySelector('#kh5ExchangeFileName').textContent = draft.file?.name || 'Chưa chọn tệp';
    extTab(r.tab, host.querySelector('[data-kh5-ext="' + r.tab + '"]'));
  }
  function extTab(name, el) { const r = current(); if (!r || !['files', 'route', 'exchange'].includes(name)) return; r.tab = name;
    page.querySelectorAll('[data-kh5-ext]').forEach(tab => tab.classList.toggle('active', tab.dataset.kh5Ext === name));
    ['files', 'route', 'exchange'].forEach(n => document.getElementById('kh5Ext' + n[0].toUpperCase() + n.slice(1)).classList.toggle('active', n === name)); }
  function uploadRow() { return '<tr><td><input type="checkbox"></td><td><input type="checkbox" checked></td><td><input type="checkbox"></td><td><input type="checkbox"></td><td><input type="file" accept=".pdf,.doc,.docx,.xls,.xlsx"></td><td><select><option>Hồ sơ liên quan</option><option>Báo cáo đề xuất</option><option>File danh mục</option></select></td><td><input></td><td><input type="date"></td><td><input></td><td><input></td><td><input></td><td><span class="linklike" onclick="this.closest(\'tr\').remove()">Xóa</span></td></tr>'; }
  function addUploadRow() { if (edit(current())) page.querySelector('.pm-ext-add-table tbody').insertAdjacentHTML('beforeend', uploadRow()); }
  function saveUploads() {
    const r = current(); if (!edit(r)) return; let count = 0;
    page.querySelectorAll('.pm-ext-add-table tbody tr').forEach(row => { const f = row.querySelector('input[type=file]').files[0]; if (!f) return;
      const cells = row.children; r.files.push({ id: r.id + '-upload-' + Date.now() + '-' + count, name: f.name, mime: f.type, blob: f, url: URL.createObjectURL(f), actor: W.roles[r.viewer], time: now(), group: cells[5].querySelector('select').value,
        number: cells[6].querySelector('input').value, date: cells[7].querySelector('input').value, issuer: cells[8].querySelector('input').value, signer: cells[9].querySelector('input').value, signerTitle: cells[10].querySelector('input').value }); count++; });
    if (!count) return toast('Chọn file để lưu tài liệu'); log(r, 'Thêm ' + count + ' tài liệu'); renderExtended(r); toast('Đã lưu tài liệu');
  }
  function exchangeFileChanged(input) { const r = current(); if (!r) return; const d = r.drafts[r.viewer]; if (d.file?.url) URL.revokeObjectURL(d.file.url); const f = input.files[0]; d.file = f ? { kind: 'upload', name: f.name, mime: f.type, url: URL.createObjectURL(f) } : null; document.getElementById('kh5ExchangeFileName').textContent = f?.name || 'Chưa chọn tệp'; }
  function sendExchange() { const r = current(), d = r?.drafts[r.viewer]; if (!d || !d.text.trim() && !d.file) return toast('Nhập nội dung hoặc chọn tệp');
    r.exchange.unshift({ actor: W.roles[r.viewer], text: d.text.trim(), time: now(), attachments: d.file ? [{ ...d.file }] : [] }); r.drafts[r.viewer] = { text: '', file: null }; renderExtended(r); }
  function refreshSubmission(r) { const old = r.submission; if (!old) return; const html = paper(r, 'submission'), blob = KHStep5Office.docx(paragraphs(r, 'submission')); URL.revokeObjectURL(old.url); old.blob = blob; old.url = URL.createObjectURL(blob); old.html = html; }
  function sign() {
    const r = current(); if (!W.canSign(r, r.viewer)) return toast('Không có nhiệm vụ ký Tờ trình');
    signSession = { id: r.id, actor: r.viewer, revision: r.revision, receipt: r.receipt }; openDigitalSignModal();
  }
  const oldFinishSign = finishDigitalSign;
  finishDigitalSign = function () {
    if (!signSession) return oldFinishSign.apply(this, arguments);
    const snap = signSession; signSession = null; const r = records.get(snap.id);
    try { if (!r || r.viewer !== snap.actor || r.revision !== snap.revision || r.receipt !== snap.receipt) throw Error('Nhiệm vụ đã thay đổi; mở lại ký số'); W.sign(r, snap.actor); refreshSubmission(r); log(r, 'Ký số Tờ trình (demo)'); closeDigitalSignModal(); render(); toast('Đã ký Tờ trình (demo)'); } catch (e) { closeDigitalSignModal(); toast(e.message); }
  };
  const oldCloseSign = closeDigitalSignModal;
  closeDigitalSignModal = function () { signSession = null; return oldCloseSign.apply(this, arguments); };
  function takeNumber() { const r = current(); if (W.canIssue(r, r.viewer)) document.getElementById('kh5Issue_number').value = String(800 + [...records.values()].filter(x => x.submission?.issued).length + 1); }
  function issue() { const r = current(); try { const metadata = Object.fromEntries(['number', 'date', 'suffix', 'eoffice'].map(k => [k, document.getElementById('kh5Issue_' + k)?.value.trim() || ''])); W.issue(r, r.viewer, metadata); log(r, 'Ban hành Tờ trình số ' + r.issue.number); refreshSubmission(r); render(); } catch (e) { toast(e.message); } }
  function transfer() {
    const r = current(); if (!own(r)) return toast('Bạn không được giao xử lý chính');
    if (edit(r) && !save(true)) return;
    const allowed = W.allowed(r, r.viewer); if (!allowed.length) return toast('Tạo Báo cáo đề xuất và file danh mục từ template trước khi chuyển');
    ensureSubmission(r);
    const panel = document.getElementById('routePanelFiles'), box = document.getElementById('transferModal'); modal = { id: r.id, actor: r.viewer, receipt: r.receipt, revision: r.revision, allowed,
      filesHtml: panel.innerHTML, cfg: currentTransferCfg, action: pendingTransferAction, classes: box.className, summary: box.querySelector('.route-opinion-summary').innerHTML };
    box.classList.add('kh4-route');
    box.querySelector('.route-opinion-summary').innerHTML = '<div><b>Tổng hợp ý kiến</b></div>' + r.exchange.slice().reverse().map(x => '<div class="route-opinion-row"><b>' + esc(x.actor) + '</b><div class="mini">' + esc(x.time) + ' · ' + esc(x.text) + '</div></div>').join('');
    document.getElementById('routeOpinionFile').value = ''; 
    Object.entries(W.roles).forEach(([key, title]) => { if (!routeRecipients.some(x => x.id === 'kh5_' + key)) routeRecipients.push({ id: 'kh5_' + key, name: title, title, unit: key === 'khdt' ? 'Ban KHĐT' : key === 'pm' || key === 'lead' ? 'Ban KT' : 'VNPT Net' }); });
    pendingTransferAction = 'kh5Transfer'; currentTransferCfg = { title: 'Chuyển đề xuất lựa chọn PAKT, CN và quy mô', main: '', co: [], send: [], allowed: allowed.map(key => 'kh5_' + key) };
    panel.innerHTML = [r.submission, ...r.files].map((f, i) => '<div class="route-file-line"><div class="route-file-tools"><input class="route-check" type="checkbox" checked data-kh5-transfer-file="' + esc(f.id) + '"><span class="route-file-name">' + esc(f.name) + '</span>' + button('Xem', i ? 'kh5.previewFile(' + (i - 1) + ')' : 'kh5.previewSubmission()') + ' <a href="' + f.url + '" download="' + esc(f.name) + '">Tải</a></div></div>').join('');
    document.getElementById('transferNote').value = ''; document.getElementById('routeReceiverSearch').value = '';
    renderRouteRecipients(); switchRouteTab('files'); document.getElementById('transferModal').classList.add('show');
  }
  const oldHide = hideTransferModal;
  hideTransferModal = function () { const snap = modal; modal = null; const result = oldHide.apply(this, arguments); if (snap) { document.getElementById('routePanelFiles').innerHTML = snap.filesHtml; currentTransferCfg = snap.cfg; pendingTransferAction = snap.action; const box = document.getElementById('transferModal'); box.className = snap.classes.replace(/\bshow\b/g, '').trim(); box.querySelector('.route-opinion-summary').innerHTML = snap.summary; document.getElementById('routeOpinionFile').value = ''; } return result; };
  const oldConfirm = confirmTransferFromModal;
  confirmTransferFromModal = function () {
    if (pendingTransferAction !== 'kh5Transfer') return oldConfirm.apply(this, arguments);
    const r = current(), snap = modal;
    try {
      if (!snap || !r || r.id !== snap.id || r.viewer !== snap.actor || r.receipt !== snap.receipt || r.revision !== snap.revision) throw Error('Hồ sơ đã thay đổi; mở lại popup Chuyển');
      const selected = selectedRouteRecipients(), to = selected.main?.id.replace(/^kh5_/, '');
      if (!to || !snap.allowed.includes(to)) { switchRouteTab('receiver'); throw Error('Chọn 01 người xử lý chính'); }
      const detail = { note: document.getElementById('transferNote').value.trim(), files: [...document.querySelectorAll('[data-kh5-transfer-file]:checked')].map(el => el.dataset.kh5TransferFile),
        co: selected.co.map(x => x.id), view: selected.view.map(x => x.id) };
      const opinionFile = document.getElementById('routeOpinionFile')?.files[0], actor = W.roles[r.viewer];
      W.transfer(r, snap.actor, to, detail); log(r, 'Chuyển tới ' + W.roles[to] + (detail.note ? ' · ' + detail.note : ''), actor);
      if (detail.note || opinionFile) r.exchange.unshift({ actor, text: detail.note, time: now(), attachments: opinionFile ? [{ kind: 'upload', name: opinionFile.name, mime: opinionFile.type, url: URL.createObjectURL(opinionFile) }] : [] });
      hideTransferModal(); render(); toast('Đã chuyển đề xuất');
    } catch (e) { toast(e.message); }
  };
  window.kh5 = { list, createScreen, chooseBasis, create, open, render, setRole, save, addRow, removeRow, generate, previewBasis, previewSubmission, previewFile, previewArchive,
    extTab, addUploadRow, saveUploads, exchangeFileChanged, sendExchange, sign, takeNumber, issue, transfer };
}());
