/* SOP1-TB bước 5: dữ liệu đề xuất và tài liệu cùng phiên bản.
 * Trường nghiệp vụ đối chiếu SOP2-TB-4B, SOP1-TB-01B/02A và bảng tính SOP1-TB-01A/01B.
 * Không có mẫu báo cáo bước 5 riêng trong bộ hồ sơ; không dùng QĐ phê duyệt làm đầu ra đề xuất.
 */
(function (root) {
  'use strict';
  const types = ['Core di động', 'Vô tuyến', 'BRCĐ'];
  // RACI (TB) SOP_1: 33–48, 83–93, 128–138. CSHT có nhánh riêng.
  const providers = [
    { unit: 'Ban KTM', lead: 'leadKTM', pm: 'pmKTM' },
    { unit: 'VNPT TTP', lead: 'leadTTP', pm: 'pmTTP' },
    { unit: 'VNP', lead: 'leadVNP', pm: 'pmVNP' },
    { unit: 'IT', lead: 'leadIT', pm: 'pmIT' },
    { unit: 'Đơn vị liên quan TĐ', lead: 'leadRelated', pm: 'pmRelated' }
  ];
  const roles = { pm: 'PM Ban KT', lead: 'LĐ Ban KT', khdt: 'Ban KHĐT – nhận thông tin',
    ...Object.fromEntries(providers.flatMap(p => [[p.lead, 'LĐ ' + p.unit], [p.pm, 'PM ' + p.unit]])),
    tct: 'LĐ TCT', tctClerk: 'Văn thư TCT' };
  const provider = actor => providers.find(p => [p.lead, p.pm].includes(actor));
  const infoRequest = (r, actor) => r?.requests?.find(q => q.status !== 'RETURNED' && q.owner === actor && q.receipt.to === actor);
  const mainOwns = (r, actor) => !!r && r.owner === actor && r.receipt?.to === actor;
  const receiptFor = (r, actor) => infoRequest(r, actor)?.receipt || (mainOwns(r, actor) ? r.receipt : r?.infoReceipts?.[actor]);
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
  const owns = (r, actor) => mainOwns(r, actor) || !!infoRequest(r, actor);
  const canEdit = (r, actor) => mainOwns(r, actor) && actor === 'pm' && r.receipt.purpose === 'PREPARE';
  const canProvide = (r, actor) => infoRequest(r, actor)?.receipt.purpose === 'DATA_WORK' && provider(actor)?.pm === actor;
  const pendingRequests = r => (r.requests || []).filter(q => q.status !== 'RETURNED');
  const documentTargets = f => (f.document?.unit + ';' + (f.document?.related || '')).split(/[;,\n]/).map(unit => unit.trim());
  function storeInfoDocument(r, actor, kind, code, data, artifact) {
    const q = infoRequest(r, actor);
    if (kind === 'request' ? !canEdit(r, actor) || !hasBasis(r) : !canProvide(r, actor)) throw Error('Bạn chưa được giao nhiệm vụ tạo văn bản này');
    if (!['request','supply'].includes(kind) || !['2.1','2.2'].includes(code)) throw Error('Biểu mẫu không hợp lệ');
    if (kind === 'request' && (!providers.some(p => p.unit === data.unit) || !data.content?.trim() || !data.deadline)) throw Error('Nhập đơn vị nhận đúng RACI, nội dung yêu cầu và thời hạn cung cấp');
    if (kind === 'supply' && (!data.issuer?.trim() || !data.recipient1?.trim() || !data.period?.trim())) throw Error('Nhập đơn vị ban hành, đơn vị nhận và giai đoạn đề xuất');
    const version = 1 + r.files.filter(f => f.infoKind === kind && f.infoCode === code && f.authorKey === actor && f.infoRequestId === q?.id).reduce((v,f) => Math.max(v,f.version),0);
    const f = { ...artifact, id:(q?.id || r.id)+'-'+kind+'-'+code.replace('.','_')+'-'+actor+'-v'+version, generated:false,
      infoKind:kind, infoCode:code, docType:kind === 'request' ? 'infoRequest' : 'infoSupply', document:structuredClone(data), version, authorKey:actor,
      infoRequestId:q?.id, requestDocumentId:q?.requestDocumentId, requestDocumentVersion:q?.requestDocumentVersion, posted:false };
    r.files.push(f);return f;
  }
  const hasBasis = r => !!r?.basis && types.includes(r.basis.type) && r.basis.decision?.signed && r.basis.decision?.issued;
  function draft(id) {
    const data = Object.fromEntries(fields.map(([key]) => [key, '']));
    Object.assign(data, { name: 'Đề xuất lựa chọn PAKT, CN và quy mô', unit: 'Ban KT', date: new Date().toISOString().slice(0, 10) });
    return { id, basis: null, data, rows: [emptyRow()], revision: 1,
      owner: 'pm', viewer: 'pm', receipt: { from: null, to: 'pm', purpose: 'PREPARE', revision: 1, files: [], time: new Date().toISOString() },
      files: [], archive: [], submission: null, history: [], exchange: [], drafts: {}, tab: 'files', issue: {}, requests: [], infoReceipts: {}, approval: null };
  }
  function create(basis, id) {
    if (!hasBasis({ basis })) throw Error('Chọn KHPTM đã ký và ban hành');
    const r = draft(id); r.basis = { ...basis, decision: { ...basis.decision } };
    r.data.name += ' ' + basis.type + ' năm ' + basis.year;
    return r;
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
    return updateDraft(r, data, rows);
  }
  function saveDraft(r, actor, data, rows) {
    if (!canEdit(r, actor)) throw Error('Hồ sơ chưa được giao cho PM để lập / sửa đề xuất');
    if (!data.name.trim() || !data.date) throw Error('Nhập tên và ngày lập đề xuất');
    return updateDraft(r, data, rows);
  }
  function updateDraft(r, data, rows) {
    if (JSON.stringify([r.data, r.rows]) === JSON.stringify([data, rows])) return false;
    if (r.files.some(f => f.generated) || r.submission) {
      r.archive.push({ revision: r.revision, data: { ...r.data }, rows: r.rows.map(row => ({ ...row })),
        files: r.files.filter(f => f.generated), submission: r.submission });
      r.files = r.files.filter(f => !f.generated); r.submission = null;
    }
    r.data = { ...data }; r.rows = rows.map(row => ({ ...row })); r.revision++; r.receipt.revision = r.revision; r.approval = null;
    return true;
  }
  function installPair(r, actor, pair) {
    if (!canEdit(r, actor)) throw Error('Chỉ PM đang được giao lập đề xuất được tạo file');
    if (!hasBasis(r)) throw Error('Chọn KHPTM đã ký và ban hành');
    validate(r.data, r.rows);
    if (pair.length !== 2 || pair[0].docType !== 'report' || pair[1].docType !== 'catalog' || pair.some(f => f.revision !== r.revision)) throw Error('Bộ báo cáo và danh mục không cùng phiên bản');
    // Hai tài liệu được thay cùng một lần; tạo lại không nhân đôi hoặc xóa tệp người dùng tải lên.
    r.files = [...r.files.filter(f => !f.generated), ...pair];
  }
  const pairReady = r => hasBasis(r) && ['report', 'catalog'].every(kind => r.files.some(f => f.docType === kind && f.revision === r.revision));
  const receivedSubmission = r => hasBasis(r) && r.submission && r.submission.revision === r.revision && r.receipt.revision === r.revision && r.receipt.files.includes(r.submission.id);
  const canSign = (r, actor) => mainOwns(r, actor) && ['lead', 'tct'].includes(actor) && r.receipt.purpose === 'REVIEW' && !pendingRequests(r).length && receivedSubmission(r) && !r.submission.signatures.includes(actor);
  const canIssue = (r, actor) => mainOwns(r, actor) && actor === 'tctClerk' && r.receipt.purpose === 'ISSUE' &&
    ['lead', 'tct'].includes(r.receipt.from) && receivedSubmission(r) && r.submission.signatures.length > 0 && !r.submission.issued;
  const canApprove = (r, actor) => actor === 'lead' && mainOwns(r, actor) && r.receipt.purpose === 'REVIEW' && receivedSubmission(r) && pairReady(r) && !pendingRequests(r).length && r.approval?.revision !== r.revision;
  const canApproveData = (r, actor) => {
    const q = infoRequest(r, actor); return !!q && provider(actor)?.lead === actor && q.receipt.purpose === 'DATA_REVIEW' &&
      q.receipt.responseRevision === q.responseRevision && q.responseRevision > 0 && q.approvedRevision !== q.responseRevision;
  };
  function approve(r, actor) {
    if (!canApprove(r, actor)) throw Error('Không có nhiệm vụ duyệt phương án phiên bản này hoặc còn yêu cầu số liệu chưa hoàn thành');
    r.approval = { actor, revision: r.revision, receipt: { ...r.receipt }, time: new Date().toISOString() };
  }
  function approveData(r, actor) {
    if (!canApproveData(r, actor)) throw Error('Không có nhiệm vụ duyệt số liệu phiên bản này');
    const q = infoRequest(r, actor); q.approvedRevision = q.responseRevision; q.approval = { actor, responseRevision: q.responseRevision, time: new Date().toISOString() };
  }
  function saveResponse(r, actor, text, files) {
    const q = infoRequest(r, actor); if (!canProvide(r, actor)) throw Error('Chỉ PM được giao yêu cầu mới được cung cấp số liệu');
    if (!text.trim() && !files.length) throw Error('Nhập nội dung hoặc đính kèm số liệu');
    if (files.some(id => !r.files.some(f => f.id === id && f.infoRequestId === q.id))) throw Error('Tài liệu không thuộc yêu cầu cung cấp số liệu này');
    if (files.some(id => {const f=r.files.find(f => f.id === id);return f.infoKind === 'supply' && (f.requestDocumentId !== q.requestDocumentId || f.requestDocumentVersion !== q.requestDocumentVersion);})) throw Error('Văn bản cung cấp không khớp phiên bản yêu cầu đã nhận');
    if (q.response.text !== text || JSON.stringify(q.response.files) !== JSON.stringify(files)) {
      q.response = { text, files: files.slice() }; q.responseRevision++; q.approvedRevision = 0; q.approval = null;
    }
  }
  const coAllowed = (r, actor) => hasBasis(r) && canEdit(r, actor) ? providers.filter(p => !(r.requests || []).some(q => q.unit === p.unit && q.status !== 'RETURNED')).map(p => p.lead) : [];
  const viewAllowed = (r, actor) => Object.keys(roles).filter(key => key !== actor);
  function share(r, actor, detail, requestId) {
    r.infoReceipts ||= {};
    (detail.view || []).forEach(to => { r.infoReceipts[to] = { from: actor, to, purpose: 'INFORMATION', requestId: requestId || null,
      revision: r.revision, files: detail.files.slice(), note: detail.note, time: new Date().toISOString() }; });
  }
  function requestData(r, actor, to, detail) {
    if (!coAllowed(r, actor).includes(to)) throw Error('Đơn vị đã có yêu cầu đang xử lý hoặc bạn không được giao lập đề xuất');
    if (!detail.note.trim()) throw Error('Nhập yêu cầu cung cấp số liệu ở Thông tin ý kiến');
    const p = provider(to), id = r.id + '-INFO-' + ((r.requests || []).length + 1);
    const source = r.files.filter(f => f.infoKind === 'request' && detail.files.includes(f.id) && documentTargets(f).includes(p.unit)).sort((a,b) => b.version-a.version)[0];
    const files = detail.files.filter(id => {const f=r.files.find(file => file.id===id);return !f?.infoKind || f.infoKind!=='request' || documentTargets(f).includes(p.unit);});
    const q = { id, unit: p.unit, lead: p.lead, pm: p.pm, owner: to, status: 'ASSIGN', revision: r.revision,
      requestDocumentId:source?.id,requestDocumentVersion:source?.version,
      dossierName: r.data.name,
      documents: [{ ...r.basis.decision, id: r.basis.id + '-basis', docType: 'basis' }, ...(r.submission ? [r.submission] : []), ...r.files].filter(file => files.includes(file.id)).map(file => ({ ...file, document:file.document && structuredClone(file.document), signatures: file.signatures?.slice() })),
      response: { text: '', files: [] }, responseRevision: 0, approvedRevision: 0,
      receipt: { from: actor, to, purpose: 'DATA_ASSIGN', requestId: id, revision: r.revision, note: detail.note, files, time: new Date().toISOString() } };
    r.requests ||= []; r.requests.push(q); share(r, actor, detail, id); return q;
  }
  function allowed(r, actor) {
    if (!hasBasis(r) || !owns(r, actor)) return [];
    const q = infoRequest(r, actor);
    if (q) return q.receipt.purpose === 'DATA_ASSIGN' ? [q.pm] : q.receipt.purpose === 'DATA_WORK' ? [q.lead] :
      q.receipt.purpose === 'DATA_REVIEW' ? [q.pm, ...(q.approvedRevision === q.responseRevision ? ['pm'] : [])] : [];
    if (actor === 'pm') return canEdit(r, actor) ? [...(pairReady(r) && !pendingRequests(r).length ? ['lead'] : []), ...coAllowed(r, actor)] : [];
    if (!receivedSubmission(r)) return [];
    if (actor === 'lead' && r.receipt.purpose === 'REVIEW') return ['pm', 'tct', ...(r.submission.signatures.includes('lead') ? ['tctClerk'] : [])];
    if (actor === 'tct' && r.receipt.purpose === 'REVIEW') return ['lead', 'pm', ...(r.submission.signatures.includes('tct') ? ['tctClerk'] : [])];
    if (actor === 'tctClerk' && r.receipt.purpose === 'ISSUE') return r.submission.issued ? ['lead', 'tct', 'khdt'] : ['lead', 'tct'];
    return [];
  }
  function transfer(r, actor, to, detail) {
    if (!allowed(r, actor).includes(to)) throw Error('Người nhận không thuộc nhiệm vụ hiện tại');
    const q = infoRequest(r, actor);
    const knownFiles = q ? [...q.documents.map(file => file.id), ...r.files.filter(file => file.infoRequestId === q.id).map(file => file.id)] : [r.basis.id + '-basis', r.submission?.id, ...r.files.map(file => file.id)];
    if (detail.files.some(id => !knownFiles.includes(id))) throw Error('Tài liệu chuyển không thuộc hồ sơ này');
    if ((detail.co || []).some(key => !coAllowed(r, actor).includes(key)) || (detail.view || []).some(key => !viewAllowed(r, actor).includes(key))) throw Error('Người phối hợp / nhận thông tin không thuộc RACI hoặc nhiệm vụ hiện tại');
    const selected = [to, ...(detail.co || []), ...(detail.view || [])]; if (new Set(selected).size !== selected.length) throw Error('Mỗi người nhận chỉ chọn một nhiệm vụ');
    if (actor === 'pm' && provider(to)) {const selectedDocs=r.files.filter(f => f.infoKind==='request' && detail.files.includes(f.id));if(selectedDocs.length && !selectedDocs.some(f => documentTargets(f).includes(provider(to).unit))) throw Error('Văn bản yêu cầu không gửi tới đơn vị xử lý chính đã chọn');}
    if ((provider(to) || detail.co?.length) && !detail.note.trim()) throw Error('Ghi yêu cầu / nội dung xử lý tại Thông tin ý kiến');
    if (q) {
      if (q.receipt.purpose === 'DATA_WORK' && !q.responseRevision) throw Error('Gửi nội dung / lưu tài liệu số liệu trước khi trình lãnh đạo');
      if (q.receipt.purpose === 'DATA_WORK' && q.response.files.some(id => !detail.files.includes(id))) throw Error('Chọn đủ tài liệu số liệu khi trình duyệt');
      if (to === 'pm' && (q.approvedRevision !== q.responseRevision || q.receipt.responseRevision !== q.responseRevision || !q.responseRevision)) throw Error('Lãnh đạo đơn vị duyệt đúng phiên bản số liệu trước khi gửi Ban KT');
      if (to === q.pm && q.receipt.purpose === 'DATA_REVIEW' && !detail.note.trim()) throw Error('Ghi yêu cầu sửa số liệu');
      if (to === 'pm' && q.response.files.some(id => !detail.files.includes(id))) throw Error('Chọn số liệu đã được duyệt để gửi Ban KT');
      if (to === q.pm && q.receipt.purpose === 'DATA_REVIEW') { q.approvedRevision = 0; q.approval = null; }
      const purpose = to === 'pm' ? 'DATA_RESULT' : to === q.pm ? 'DATA_WORK' : 'DATA_REVIEW';
      q.owner = to; q.status = to === 'pm' ? 'RETURNED' : purpose;
      q.receipt = { ...detail, files: detail.files.slice(), from: actor, to, purpose, requestId: q.id, revision: q.revision, responseRevision: q.responseRevision, time: new Date().toISOString() };
      if (to === 'pm' && canEdit(r, 'pm')) r.receipt = { ...r.receipt, from: actor, note: 'Nhận số liệu đã duyệt từ ' + q.unit + '. Tiếp tục tổng hợp phương án và quy mô.', time: q.receipt.time };
      share(r, actor, detail, q.id); r.viewer = to; return { request: q };
    }
    if (actor === 'pm' && provider(to)) { const created = requestData(r, actor, to, detail); (detail.co || []).forEach(key => requestData(r, actor, key, detail)); r.viewer = to; return { request: created }; }
    if (!detail.files.includes(r.submission?.id)) throw Error('Chọn Tờ trình để chuyển cùng hồ sơ');
    if (actor === 'pm' && r.files.filter(f => ['report', 'catalog'].includes(f.docType)).some(f => !detail.files.includes(f.id))) throw Error('Chọn Báo cáo đề xuất và file danh mục');
    const approved = r.approval?.revision === r.revision;
    if (to === 'pm' && !approved && !detail.note.trim()) throw Error('Nhập yêu cầu sửa / bổ sung đề xuất');
    (detail.co || []).forEach(key => requestData(r, actor, key, detail)); share(r, actor, detail);
    const purpose = to === 'pm' ? approved ? 'RESULT' : 'PREPARE' : to === 'tctClerk' ? 'ISSUE' : to === 'khdt' ? 'RESULT' : 'REVIEW';
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
  const api = { types, roles, providers, provider, infoRequest, receiptFor, pendingRequests, fields, columns, emptyRow, draft, create, owns, canEdit, canProvide, saveResponse, storeInfoDocument, documentTargets,
    save, saveDraft, validate, installPair, pairReady, allowed, coAllowed, viewAllowed, transfer, canApprove, approve, canApproveData, approveData, canSign, sign, canIssue, issue };
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
    const paragraph = text => '<w:p><w:r><w:rPr><w:rFonts w:ascii="Times New Roman" w:hAnsi="Times New Roman"/><w:sz w:val="26"/></w:rPr>' + String(text).split('\n').map((line, i) => (i ? '<w:br/>' : '') + '<w:t xml:space="preserve">' + xml(line) + '</w:t>').join('') + '</w:r></w:p>';
    const block = item => typeof item === 'string' ? paragraph(item) : '<w:tbl><w:tblPr><w:tblW w:w="9000" w:type="dxa"/>' + (item.border ? '<w:tblBorders>' + ['top','left','bottom','right','insideH','insideV'].map(edge=>'<w:'+edge+' w:val="single" w:sz="4"/>').join('') + '</w:tblBorders>' : '') + '</w:tblPr><w:tblGrid>' + Array.from({length:item.columns},()=>'<w:gridCol w:w="'+Math.round(9000/item.columns)+'"/>').join('') + '</w:tblGrid>' + item.table.map(row=>'<w:tr>'+row.map(cell=>'<w:tc><w:tcPr><w:tcW w:w="'+Math.round(9000*cell.span/item.columns)+'" w:type="dxa"/>'+ (cell.span>1?'<w:gridSpan w:val="'+cell.span+'"/>':'') + '</w:tcPr>'+paragraph(cell.text)+'</w:tc>').join('')+'</w:tr>').join('')+'</w:tbl>';
    return zip({
      '[Content_Types].xml': '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>',
      '_rels/.rels': '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>',
      'word/document.xml': '<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>' + paragraphs.map(block).join('') + '<w:sectPr><w:pgSz w:w="11906" w:h="16838"/><w:pgMar w:top="1134" w:right="1134" w:bottom="1134" w:left="1701"/></w:sectPr></w:body></w:document>'
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
  const W = KHStep5, records = new Map(); let currentId = '', creationBasis = '', creationDraft = null, modal = null, signSession = null, signUI = null;
  const now = () => new Date().toLocaleString('vi-VN', { hour12: false });
  const current = () => records.get(currentId) || creationDraft, own = r => W.owns(r, r.viewer), edit = r => W.canEdit(r, r.viewer);
  const canAttach = r => edit(r) || W.canProvide(r, r.viewer);
  function notify(message, invalid = false, selector) {
    const r = current(); if(r)r.feedback = {message,invalid};
    paintFeedback(message,invalid);
    toast(message);
    if(selector){const field=page.querySelector(selector);field?.scrollIntoView({block:'center'});field?.focus();}
    else if(invalid && !document.querySelector('.modal.show')) document.getElementById('kh5Feedback')?.scrollIntoView({block:'center'});
  }
  function paintFeedback(message,invalid){const host=document.getElementById('kh5Feedback');if(host){host.hidden=false;host.className=invalid?'khptm-note':'khptm-output';host.textContent=message;host.setAttribute('role',invalid?'alert':'status');}}
  const exchangeDraft = r => {const d=r.drafts[r.viewer] || (r.drafts[r.viewer]={text:'',file:null});d.attachments ||= [];return d;};
  function infoPermission(r, kind) { return kind === 'request' ? edit(r) && !!r.basis : W.canProvide(r, r.viewer); }
  const button = (label, action, enabled = true, cls = '') => '<button class="' + cls + '" onclick="' + action + '"' + (enabled ? '' : ' disabled') + '>' + label + '</button>';
  const section = (title, body) => '<div class="section"><h3>' + title + '</h3><div class="body">' + body + '</div></div>';
  const moduleTitle = 'Lựa chọn PAKT, CN, tính toán quy mô';
  const header = (title, actions, suffix = '', detail = false) => '<div class="crumb">QUẢN LÝ KHPTM &gt; ' + moduleTitle + (suffix ? ' &gt; ' + esc(suffix) : '') + '</div><div class="titlebar' + (detail ? ' kh5-detail' : '') + '"><h1>' + esc(title) + '</h1><div class="buttons">' + actions + '</div></div>';
  const listFilters = { year: '', type: '', name: '', status: '' };
  const note = text => '<div class="mini" style="padding:10px">' + esc(text) + '</div>';
  function log(r, text, actor, receipt) { const x = receipt || W.receiptFor(r, r.viewer) || r.receipt; r.history.unshift({ actor: actor || W.roles[r.viewer], text, time: now(), receipt: { ...x, files: x.files.slice() } }); }
  let extTemplate;
  const previous = { type: khptm2DeviceType, role: khptm2Role, step: khptm2Step };
  try { khptm2DeviceType = 'Core di động'; khptm2Role = 'Chuyên viên Ban KT'; khptm2Step = 'B1'; extTemplate = khptm2ExtendedHtml(); }
  finally { khptm2DeviceType = previous.type; khptm2Role = previous.role; khptm2Step = previous.step; }
  const sharedExtended = document.createElement('template'); sharedExtended.innerHTML = extTemplate;
  const sharedUploadRow = sharedExtended.content.querySelector('.pm-ext-add-table tbody tr').cloneNode(true);
  const sharedTransferFileRow = document.getElementById('routeSignFileRow').cloneNode(true);
  const page = document.createElement('section'); page.id = 'kh5Page'; page.className = 'page'; document.querySelector('.shell').appendChild(page);
  const nav = document.createElement('div'); nav.className = 'subitem'; nav.textContent = 'Lựa chọn PAKT, CN, tính toán quy mô'; nav.onclick = event => { event.stopPropagation(); list(); };
  document.querySelector('#nav-khptm .submenu').appendChild(nav);
  function list() {
    showPage('kh5Page'); currentId = ''; creationDraft = null;
    const years = [...new Set([...kh4.approvedPlans(), ...[...records.values()].map(r => r.basis)].map(p => String(p.year)))].sort().reverse();
    const statuses = [...new Set(['Đang lập / sửa đề xuất', 'Chờ xem xét đề xuất', 'Đã duyệt phương án', 'Đã ký – chờ chuyển', 'Chờ ban hành', 'Đã ban hành', 'Đã chuyển kết quả', ...[...records.values()].map(state)])];
    const filterSelect = (key, label, options) => '<div><label for="kh5Filter_' + key + '">' + label + '</label><select id="kh5Filter_' + key + '" onchange="kh5.filterList()"><option value="">Tất cả</option>' + options.map(value => '<option value="' + esc(value) + '"' + (value === listFilters[key] ? ' selected' : '') + '>' + esc(value) + '</option>').join('') + '</select></div>';
    page.innerHTML = header(moduleTitle, button('+ Tạo mới', 'kh5.createScreen()', true, 'primary') + button('Quay lại', 'goHome()')) +
      section('Tìm kiếm, tra cứu', '<div class="grid">' + filterSelect('year', 'Năm kế hoạch', years) + filterSelect('type', 'Loại thiết bị', ['Core di động', 'Vô tuyến', 'BRCĐ']) + '<div><label for="kh5Filter_name">Tên đề xuất</label><input id="kh5Filter_name" placeholder="Nhập tên đề xuất..." value="' + esc(listFilters.name) + '" oninput="kh5.filterList()"></div>' + filterSelect('status', 'Trạng thái', statuses) + '</div>') +
      section('Danh sách hồ sơ', '<div style="overflow:auto"><table><thead><tr><th>STT</th><th>Tên đề xuất</th><th>Loại thiết bị</th><th>Căn cứ KHPTM</th><th>Người xử lý chính</th><th>Trạng thái</th><th>Thao tác</th></tr></thead><tbody id="kh5ListRows"></tbody></table></div>');
    filterList();
  }
  function filterList() {
    Object.keys(listFilters).forEach(key => { listFilters[key] = document.getElementById('kh5Filter_' + key).value; });
    const filtered = [...records.values()].filter(r => (!listFilters.year || String(r.basis.year) === listFilters.year) && (!listFilters.type || r.basis.type === listFilters.type) && (!listFilters.name || r.data.name.toLocaleLowerCase('vi-VN').includes(listFilters.name.trim().toLocaleLowerCase('vi-VN'))) && (!listFilters.status || state(r) === listFilters.status));
    document.getElementById('kh5ListRows').innerHTML = filtered.map((r, i) => '<tr><td>' + (i + 1) + '</td><td>' + esc(r.data.name) + '</td><td>' + esc(r.basis.type) + '</td><td>' + esc(r.basis.title) + '</td><td>' + esc(W.roles[r.owner]) + '</td><td>' + esc(state(r)) + '</td><td>' + button('Xem', "kh5.open('" + r.id + "')") + '</td></tr>').join('') || '<tr><td colspan="7">' + (records.size ? 'Không có hồ sơ phù hợp với điều kiện tìm kiếm.' : 'Chưa có đề xuất.') + '</td></tr>';
  }
  function state(r) { return r.approval?.revision === r.revision ? 'Đã duyệt phương án' : r.receipt.purpose === 'PREPARE' ? W.pendingRequests(r).length ? 'Đang chờ số liệu (' + W.pendingRequests(r).length + ' yêu cầu)' : 'Đang lập / sửa đề xuất' : r.receipt.purpose === 'ISSUE' ? r.submission?.issued ? 'Đã ban hành' : 'Chờ ban hành' : r.receipt.purpose === 'RESULT' ? 'Đã chuyển kết quả' : r.submission?.signatures.includes(r.owner) ? 'Đã ký – chờ chuyển' : 'Chờ xem xét đề xuất'; }
  function taskLabel(r) {
    const q = W.infoRequest(r, r.viewer), receipt = W.receiptFor(r, r.viewer);
    return q ? ({ DATA_ASSIGN: 'Phân công cung cấp số liệu', DATA_WORK: 'Cung cấp số liệu hiện trạng', DATA_REVIEW: q.approvedRevision === q.responseRevision ? 'Số liệu đã duyệt – chờ gửi Ban KT' : 'Duyệt số liệu hiện trạng' })[q.receipt.purpose] + ' · ' + q.unit : receipt?.purpose === 'INFORMATION' ? 'Nhận thông tin – xem để biết' : own(r) ? state(r) : 'Chưa được giao nhiệm vụ xử lý';
  }
  function roleOptions(r) {
    const option = key => '<option value="' + key + '"' + (key === r.viewer ? ' selected' : '') + '>' + esc(W.roles[key]) + '</option>';
    return '<optgroup label="Lựa chọn PAKT, CN và quy mô">' + ['pm', 'lead', 'khdt'].map(option).join('') + '</optgroup><optgroup label="Cung cấp số liệu hiện trạng – RACI bước 5">' + W.providers.flatMap(p => [p.lead, p.pm]).map(option).join('') + '</optgroup><optgroup label="Trình ký / ban hành văn bản khi sử dụng">' + ['tct', 'tctClerk'].map(option).join('') + '</optgroup>';
  }
  function basisPicker(selected) {
    const plans = kh4.approvedPlans();
    return '<label for="kh5Basis">Căn cứ: KHPTM đã được phê duyệt <span class="red">*</span></label><select id="kh5Basis" onchange="kh5.chooseBasis(this.value)"' + (!edit(current()) ? ' disabled' : '') + '><option value="">-- Chọn KHPTM đã phê duyệt --</option>' + plans.map(p => '<option value="' + esc(p.id) + '"' + (p.id === selected ? ' selected' : '') + '>' + esc(p.title + ' · QĐ ' + p.number + ' · ' + formatDateVN(p.date)) + '</option>').join('') + '</select>' + (plans.length ? '' : note('Chưa có KHPTM đã ký và ban hành. Hoàn thành phê duyệt KHPTM ở bước trước để chọn căn cứ.') + button('Mở Xây dựng, trình KHPTM', 'openKHPTMBuildModule()'));
  }
  function createScreen(basisId) {
    const basis = kh4.approvedPlans().find(p => p.id === basisId);
    creationBasis = basis?.id || ''; currentId = ''; showPage('kh5Page');
    const id = 'PAKT-' + Date.now() + '-' + records.size; creationDraft = basis ? W.create(basis, id) : W.draft(id);
    render();
  }
  function chooseBasis(id) {
    const r = creationDraft; if (!r || !edit(r)) return;
    const input = readForm(r); r.data = input.data; r.rows = input.rows;
    const basis = kh4.approvedPlans().find(p => p.id === id); creationBasis = basis?.id || ''; r.basis = basis ? W.create(basis, r.id).basis : null;
    if (basis && r.data.name.startsWith('Đề xuất lựa chọn PAKT, CN và quy mô')) r.data.name = 'Đề xuất lựa chọn PAKT, CN và quy mô ' + basis.type + ' năm ' + basis.year;
    render();
  }
  function create() { save(); }
  function open(id) { if (!records.has(id)) return; currentId = id; records.get(id).viewer = records.get(id).owner; showPage('kh5Page'); render(); }
  function fieldHtml(r, key, label, kind) {
    const attrs = ' id="kh5Field_' + key + '" data-kh5-field="' + key + '"' + (!edit(r) ? ' disabled' : '');
    return '<div><label for="kh5Field_' + key + '">' + label + (['name', 'author', 'date', 'selected', 'method', 'result'].includes(key) ? ' <span class="red">*</span>' : '') + '</label>' + (kind === 'textarea' ? '<textarea' + attrs + ' style="min-height:90px">' + esc(r.data[key]) + '</textarea>' : '<input type="' + (kind === 'date' ? 'date' : 'text') + '"' + attrs + ' value="' + esc(r.data[key]) + '">') + '</div>';
  }
  function group(r, title, start, end) { return section(title, '<div class="' + (start === 0 ? 'kh2-info-grid' : 'grid two') + '">' + W.fields.slice(start, end).map(f => fieldHtml(r, ...f)).join('') + '</div>'); }
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
    try { if (!r.basis) throw Error('Chọn KHPTM đã được phê duyệt làm căn cứ');
      const input = readForm(r); if (W.saveDraft(r, r.viewer, input.data, input.rows)) log(r, 'Lưu nháp đề xuất phiên bản ' + r.revision);
      if (r === creationDraft) { records.set(r.id, r); currentId = r.id; creationDraft = null; log(r, 'Tạo đề xuất căn cứ ' + r.basis.title + ' · QĐ ' + r.basis.number); }
      if (!silent) { render(); notify('Đã lưu nháp đề xuất'); } return true; }
    catch (error) { notify(error.message,true,!r.basis?'#kh5Basis':null); return false; }
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
    try { W.validate(r.data, r.rows); const pair = [buildFile(r, 'report'), buildFile(r, 'catalog')], old = r.files.filter(f => f.generated); W.installPair(r, r.viewer, pair); old.forEach(f => URL.revokeObjectURL(f.url));
      log(r, 'Tạo đồng thời Báo cáo đề xuất và file danh mục từ template · phiên bản ' + r.revision); r.tab = 'files'; render(); notify('Đã thêm Báo cáo đề xuất và file danh mục vào Tài liệu đính kèm'); }
    catch (error) { notify(error.message,true,!r.basis?'#kh5Basis':null); }
  }
  function preview(title, html, url) {
    document.getElementById('khptmPreviewTitle').textContent = title;
    document.getElementById('khptmPreviewPaper').innerHTML = url ? '<iframe title="' + esc(title) + '" src="' + url + '" style="width:100%;height:70vh;border:0"></iframe>' : html;
    document.getElementById('khptmPreviewModal').classList.add('show');
  }
  function previewBasis() { const basis = records.get(currentId)?.basis || kh4.approvedPlans().find(p => p.id === creationBasis); if (basis) preview('QĐ phê duyệt ' + basis.title, basis.decision.html, basis.decision.kind === 'uploaded' ? basis.decision.url : null); }
  function previewSubmission() {
    const r = current(); if (!r?.basis) return notify('Chọn KHPTM đã được phê duyệt làm căn cứ',true,'#kh5Basis');
    const q = W.infoRequest(r, r.viewer); if (q) { const document = q.documents.find(file => file.docType === 'submission'); if (document) preview(document.name, document.html); return; }
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
    const q = W.infoRequest(r, r.viewer);
    let html = button('Danh sách', 'kh5.list()');
    if (r.viewer === 'pm') html += button('Lưu nháp', 'kh5.save()', edit(r));
    html += button('Xem hồ sơ KHPTM', "kh4.openApprovedPlan('" + (r.basis?.id || '') + "')", !!r.basis) + button('Xem QĐ phê duyệt KHPTM', 'kh5.previewBasis()', !!r.basis) + (!q || q.documents.some(file => file.docType === 'submission') ? button('Xem Tờ trình', 'kh5.previewSubmission()', !!r.basis) : '');
    if (r.viewer === 'lead') html += button('Duyệt', 'kh5.approve()', W.canApprove(r, r.viewer)) + button('Trả lại', "kh5.transfer('pm')", own(r) && !r.approval, 'kh2-danger');
    if (q?.receipt.purpose === 'DATA_REVIEW') html += button('Duyệt', 'kh5.approveData()', W.canApproveData(r, r.viewer)) + button('Trả lại', "kh5.transfer('" + q.pm + "')", own(r), 'kh2-danger');
    if (['lead', 'tct'].includes(r.viewer)) html += button('Ký số Tờ trình', 'kh5.sign()', W.canSign(r, r.viewer));
    if (r.viewer === 'tctClerk') html += button('Lấy số', 'kh5.takeNumber()', W.canIssue(r, r.viewer)) + button('Ban hành', 'kh5.issue()', W.canIssue(r, r.viewer), 'primary');
    return html + button('Chuyển', 'kh5.transfer()', own(r) && W.allowed(r, r.viewer).length > 0, 'kh2-emphasis') + button('Reset luồng', 'kh5.reset()');
  }
  function render() {
    const r = current(); if (!r) return; showPage('kh5Page');
    const creating = r === creationDraft;
    const q = W.infoRequest(r, r.viewer), receipt = W.receiptFor(r, r.viewer), context = receipt || { note: 'Vai trò đang xem chưa nhận phiếu chuyển xử lý.' };
    page.innerHTML = header((creating ? 'Tạo đề xuất lựa chọn PAKT, CN và quy mô' : moduleTitle) + (r.basis ? ' - ' + r.basis.type : ''), actions(r), creating ? 'Tạo mới' : 'Chi tiết xử lý', true) + '<div class="khptm-rolebar"><label for="kh5Role">Vai trò test</label><select id="kh5Role" onchange="kh5.setRole(this.value)">' + roleOptions(r) + '</select><span class="right-note">' + esc(creating && r.viewer === 'pm' ? 'Lập đề xuất · chưa lưu hồ sơ' : taskLabel(r)) + '</span></div>' +
      '<div id="kh5Feedback" hidden></div>' + section('Thông tin hồ sơ', '<div class="kh2-info-grid"><div class="kh5-wide">' + (creating ? basisPicker(creationBasis) : '<label>Căn cứ KHPTM đã phê duyệt</label><div>' + esc(r.basis.title + ' · QĐ ' + r.basis.number) + '</div>') + '</div><div><label>Loại thiết bị</label><input value="' + esc(r.basis?.type || '') + '" readonly></div><div><label>Năm kế hoạch</label><input value="' + esc(r.basis?.year || '') + '" readonly></div><div><label>Người xử lý chính</label><div>' + esc(W.roles[q?.owner || r.owner]) + '</div></div><div><label>Người chuyển trước</label><div>' + esc(W.roles[context.from] || (r.viewer === 'pm' && !r.receipt.from ? 'PM khởi tạo' : 'Chưa nhận nhiệm vụ')) + '</div></div><div class="kh5-wide"><label>Nội dung xử lý</label><div style="white-space:pre-wrap">' + esc(context.note || 'Lập đề xuất lựa chọn PAKT, CN và tính toán quy mô') + '</div></div></div>' + ((r.requests || []).length ? '<table style="margin-top:10px"><thead><tr><th>Đơn vị cung cấp số liệu</th><th>Người xử lý</th><th>Trạng thái</th></tr></thead><tbody>' + r.requests.map(x => '<tr><td>' + esc(x.unit) + '</td><td>' + esc(W.roles[x.owner]) + '</td><td>' + esc(x.status === 'RETURNED' ? 'Đã gửi số liệu được duyệt về Ban KT' : x.receipt.purpose === 'DATA_ASSIGN' ? 'Chờ phân công' : x.receipt.purpose === 'DATA_WORK' ? 'Đang cung cấp số liệu' : x.approvedRevision === x.responseRevision ? 'Đã duyệt – chờ gửi Ban KT' : 'Chờ duyệt số liệu') + '</td></tr>').join('') + '</tbody></table>' : '')) +
      (r.viewer === 'pm' ? form(r) : section('Preview văn bản', '<div class="khptm-doc-preview"><div class="khptm-paper">' + (!r.basis ? '<p>Chọn KHPTM đã phê duyệt để lập đề xuất và xem văn bản.</p>' : q ? q.receipt.purpose === 'DATA_REVIEW' ? '<h2>SỐ LIỆU HIỆN TRẠNG – ' + esc(q.unit) + '</h2><p>' + esc(q.dossierName) + '</p><p style="white-space:pre-wrap">' + esc(q.response.text) + '</p><p>Phiên bản số liệu: ' + q.receipt.responseRevision + '</p>' + q.response.files.map(id => '<p>' + esc(r.files.find(file => file.id === id)?.name || id) + '</p>').join('') : '<p><b>Yêu cầu cung cấp số liệu:</b> ' + esc(q.dossierName) + '</p><p style="white-space:pre-wrap">' + esc(q.receipt.note) + '</p>' + r.basis.decision.html : r.submission?.html || paper(r, 'submission')) + '</div></div>')) +
      (r.viewer === 'tctClerk' ? section('Thông tin ban hành', '<div class="khptm-issue-grid">' + [['number', 'Số văn bản'], ['date', 'Ngày ban hành'], ['suffix', 'Ký hiệu'], ['eoffice', 'Số eOffice']].map(([key, label]) => '<div><label>' + label + '</label><input id="kh5Issue_' + key + '" type="' + (key === 'date' ? 'date' : 'text') + '" value="' + esc(r.issue[key] || '') + '"' + (!W.canIssue(r, r.viewer) ? ' disabled' : '') + '></div>').join('') + '</div>') : '') + '<div id="kh5Extended"></div>';
    renderExtended(r);
    if(r.feedback)paintFeedback(r.feedback.message,r.feedback.invalid);
  }
  function setRole(role) { const r = current(); if (r && W.roles[role]) { if (modal) hideTransferModal(); closeKHPTM2InfoModal(); if (r === creationDraft && r.viewer === 'pm') { const input = readForm(r); r.data = input.data; r.rows = input.rows; } r.feedback=null;r.viewer = role; r.tab = role === 'pm' ? 'files' : 'exchange'; render(); } }
  function approve() { const r = current(); try { W.approve(r, r.viewer); log(r, 'Duyệt phương án kỹ thuật, công nghệ và quy mô phiên bản ' + r.revision); render(); notify('Đã duyệt phương án'); } catch (e) { notify(e.message,true); } }
  function approveData() { const r = current(); try { W.approveData(r, r.viewer); log(r, 'Duyệt số liệu hiện trạng của ' + W.infoRequest(r, r.viewer).unit); render(); notify('Đã duyệt số liệu; dùng Chuyển để gửi Ban KT'); } catch (e) { notify(e.message,true); } }
  function reset() {
    const old = current(); if (!old) return; if (modal) hideTransferModal(); closeDigitalSignModal();
    const creating = old === creationDraft, input = old.viewer === 'pm' ? readForm(old) : { data: old.data, rows: old.rows };
    const r = old.basis ? W.create(old.basis, old.id) : W.draft(old.id); W.saveDraft(r, 'pm', { ...input.data, name: input.data.name || r.data.name, date: input.data.date || r.data.date }, input.rows); if (creating) creationDraft = r; else records.set(r.id, r);
    [...old.files, ...(old.submission ? [old.submission] : []), ...old.archive.flatMap(v => [...v.files, ...(v.submission ? [v.submission] : [])])].forEach(f => { if (f.url) URL.revokeObjectURL(f.url); });
    log(r, 'Reset luồng test: PM Ban KT lập đề xuất' + (r.basis ? ' từ ' + r.basis.title : '')); render();
  }
  function infoOffice(html) {
    const template=document.createElement('template');template.innerHTML=html;
    const text=node=>node.nodeType===3?node.textContent:node.tagName==='BR'?'\n':Array.from(node.childNodes).map(text).join('');
    return KHStep5Office.docx(Array.from(template.content.firstElementChild.children).map(el=>el.tagName==='TABLE'?{border:el.classList.contains('kh-info-appendix'),columns:el.rows[0].cells.length,table:Array.from(el.rows,row=>Array.from(row.cells,cell=>({text:text(cell).trim(),span:cell.colSpan})))}:text(el).trim()));
  }
  function openInfo(kind) {
    let r=current();if(!r)return;
    if(kind==='request' && !r.basis)return notify('Chọn KHPTM đã được phê duyệt làm căn cứ',true,'#kh5Basis');
    if(!infoPermission(r,kind))return notify('Bạn chưa được giao nhiệm vụ tạo văn bản này',true);
    if(kind==='request' && !save(true))return;r=current();
    const actor=r.viewer,q=W.infoRequest(r,actor),task=W.receiptFor(r,actor),revision=r.revision;
    const source=q?.documents.find(f=>f.id===q.requestDocumentId),previous=r.files.filter(f=>f.infoKind===kind && f.authorKey===actor && f.infoRequestId===q?.id).at(-1);
    const code=source?.infoCode || previous?.infoCode || '2.2';
    const data=previous?structuredClone(previous.document):kind==='request'?{issuer:'TỔNG CÔNG TY HẠ TẦNG MẠNG',unit:W.providers.find(p=>W.coAllowed(r,actor).includes(p.lead))?.unit || 'Ban KTM',basis:'KHPTM '+r.basis.type+' năm '+r.basis.year,planBasis:'QĐ '+r.basis.number+' ngày '+formatDateVN(r.basis.date),year:String(r.basis.year),date:new Date().toISOString().slice(0,10),deadline:r.data.deadline,contactUnit:'KT',contact:r.data.author,need:r.data.need,current:r.data.current,content:''}:
      {issuer:q.unit,recipient1:'Ban KT',reportTo:'Ban KT',period:String(r.basis.year),date:new Date().toISOString().slice(0,10),deadline:source?.document.deadline || r.data.deadline,lines:Array.from({length:11},()=>({}))};
    khInfo.openFor({key:r.id,kind,code,data,units:kind==='request'?W.providers.map(p=>p.unit):undefined,receipt:{sender:W.roles[task.from],unit:q?.unit},
      canEdit:()=>current()===r && r.viewer===actor && r.revision===revision && W.receiptFor(r,actor)===task && infoPermission(r,kind),
      onSave:(data,kind,code)=>{
        const html=kind==='request'?khInfo.requestHTML(data,code):khInfo.supplyHTML(data);
        const blob=infoOffice(html),file=W.storeInfoDocument(r,actor,kind,code,data,{html,blob,mime:'application/vnd.openxmlformats-officedocument.wordprocessingml.document',actor:W.roles[actor],time:now(),number:data.number,eoffice:data.eoffice,issuer:data.issuer,signer:data.signer || 'Chưa ký',group:kind==='request'?'VB yêu cầu cung cấp thông tin':'VB cung cấp thông tin'});
        file.name=(kind==='request'?'VB_yeu_cau_CCTT_':'VB_cung_cap_CCTT_')+r.basis.type.normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^\w]+/g,'_')+'_'+code.replace('.','_')+'_'+actor+'_v'+file.version+'.docx';file.url=URL.createObjectURL(blob);
        const pending=exchangeDraft(r),ta=document.getElementById('kh5QuickExchange');if(ta)pending.text=ta.value;
        pending.attachments=pending.attachments.filter(id=>{const f=r.files.find(f=>f.id===id);return !(f?.infoKind===kind && f.infoCode===code);});pending.attachments.push(file.id);
        log(r,'Lưu '+file.group+' · phiên bản '+file.version);closeKHPTM2InfoModal();r.tab='exchange';renderExtended(r);document.getElementById('kh5QuickExchange').focus();notify('Đã gắn văn bản vào nội dung trao đổi. Nhập nội dung rồi nhấn Gửi');
      }});
  }
  function previewPending(index) {const r=current(),d=exchangeDraft(r);if(index==='upload'){if(d.file)khInfo.previewAttachment(d.file);}else{const file=r.files.find(f=>f.id===d.attachments[Number(index)]);if(file)preview(file.name,file.html);}}
  function removePending(index) {const r=current(),d=exchangeDraft(r);if(!own(r)&&!W.receiptFor(r,r.viewer))return notify('Vai trò này chưa nhận nhiệm vụ',true);if(index==='upload'){if(d.file)URL.revokeObjectURL(d.file.url);d.file=null;}else d.attachments.splice(Number(index),1);renderExtended(r);}
  function renderExtended(r) {
    const host = document.getElementById('kh5Extended'); host.innerHTML = extTemplate.replaceAll('khptm2', 'kh5').replaceAll('switchKHPTM2ExtTab', 'kh5.extTab').replaceAll('sendKHPTM2Exchange', 'kh5.sendExchange').replaceAll('kh5ExchangeFileChanged', 'kh5.exchangeFileChanged');
    const kind=r.viewer==='pm'?'request':W.provider(r.viewer)?.pm===r.viewer?'supply':null;
    if(kind){const btn=document.createElement('button');btn.className='small kh-info-create';btn.textContent=kind==='request'?'Tạo VB yêu cầu cung cấp thông tin':'Tạo VB cung cấp thông tin';btn.disabled=kind==='request'?!edit(r):!infoPermission(r,kind);btn.title=btn.disabled?'Chưa nhận nhiệm vụ tạo văn bản này':'';btn.onclick=()=>openInfo(kind);host.querySelector('.pm-ext-caption').after(btn);}
    const row = (file, i, action) => '<tr><td class="center">' + i + '</td><td class="center">' + (file.signatures?.length || file.signed ? '☒' : '☐') + '</td><td class="center"><input type="checkbox" checked disabled></td><td class="center"><input type="checkbox"' + (file.docType === 'report' ? ' checked' : '') + ' disabled></td><td class="center"><input type="checkbox"' + (file.docType !== 'report' ? ' checked' : '') + ' disabled></td><td>' + esc(file.number || '') + '</td><td>' + esc(file.eoffice || '') + '</td><td>' + esc(file.issuer || r.data.unit) + '</td><td>' + esc(file.signer || '--') + '</td><td>' + esc(file.group || (file.docType === 'report' ? 'Báo cáo đề xuất' : 'File danh mục')) + '</td><td><span class="pm-ext-file" onclick="' + action + '">' + esc(file.name) + '</span></td><td>' + esc(file.actor || '') + '</td><td>' + esc(file.time || '') + '</td><td></td><td></td><td>' + button('Xem', action, true, 'pm-ext-action') + (file.url ? ' <a class="pm-ext-action" href="' + file.url + '" download="' + esc(file.name) + '">Tải</a>' : '') + '</td></tr>';
    host.querySelector('.pm-ext-table tbody').innerHTML = (r.basis ? row({ ...r.basis.decision, number: r.basis.number, issuer: 'Tập đoàn', signer: 'LĐ Tập đoàn', group: 'QĐ phê duyệt KHPTM' }, 1, 'kh5.previewBasis()') : '') + r.files.map((f, i) => row(f, i + (r.basis ? 2 : 1), 'kh5.previewFile(' + i + ')')).join('') || '<tr><td colspan="16">Chưa có tài liệu đính kèm.</td></tr>';
    if (r.archive.length) { const archive = document.createElement('div'); archive.style.marginTop = '10px'; archive.innerHTML = '<b>Phiên bản tài liệu trước</b>' + r.archive.map((v, vi) => '<div class="toolbar"><span class="mini">Phiên bản ' + v.revision + '</span>' + v.files.map((f, fi) => button(f.name, 'kh5.previewArchive(' + vi + ',' + fi + ')')).join('') + (v.submission ? '<a href="' + v.submission.url + '" download="' + esc(v.submission.name) + '">Tải Tờ trình' + (v.submission.signatures.length ? ' đã ký (demo)' : '') + '</a>' : '') + '</div>').join(''); host.querySelector('#kh5ExtFiles').appendChild(archive); }
    const links = host.querySelectorAll('.pm-ext-add-links span');
    [generate, addUploadRow, saveUploads].forEach((fn, i) => { links[i].removeAttribute('onclick'); links[i].onclick = fn; links[i].setAttribute('role', 'button'); links[i].tabIndex = 0; links[i].onkeydown = e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); fn(); } }; });
    host.querySelector('.pm-ext-add-table tbody').innerHTML = uploadRow();
    if (W.canProvide(r, r.viewer)) links[0].style.display = 'none';
    if (!canAttach(r)) { host.querySelector('.pm-ext-add-table').remove(); host.querySelector('.pm-ext-add-links').remove(); }
    host.querySelector('#kh5History').innerHTML = r.history.slice().reverse().map(x => '<div class="history-item"><div class="history-dot"></div><div><b>' + esc(x.actor) + '</b><div>' + esc(x.text) + '</div><div class="mini">' + esc(x.time) + '</div></div></div>').join('');
    khInfo.renderExchangeInto(host.querySelector('#kh5Exchange'), r.exchange);
    const draft = exchangeDraft(r);
    const ta = host.querySelector('#kh5QuickExchange'); ta.value = draft.text; ta.oninput = () => { draft.text = ta.value; };
    const canExchange = own(r) || !!W.receiptFor(r, r.viewer); ta.disabled = !canExchange;
    host.querySelector('#kh5ExchangeFile').disabled = !canExchange;
    host.querySelector('[onclick="kh5.sendExchange()"]')?.toggleAttribute('disabled', !canExchange);
    host.querySelector('#kh5ExchangeFileName').textContent = draft.file?.name || 'Chưa chọn tệp';
    const pending=document.createElement('div');pending.id='kh5PendingAttachments';
    const chip=(file,index)=>'<div class="file-chip"><span class="pm-ext-file">'+esc(file.name)+'</span>'+button('Xem file',"kh5.previewPending("+index+")",true,'small')+button('Gỡ',"kh5.removePending("+index+")",canExchange,'small danger')+'</div>';
    pending.innerHTML=draft.attachments.map((id,index)=>{const file=r.files.find(f=>f.id===id);return file?chip(file,index):'';}).join('')+(draft.file?chip(draft.file,"'upload'"):'');ta.parentElement.appendChild(pending);
    extTab(r.tab, host.querySelector('[data-kh5-ext="' + r.tab + '"]'));
  }
  function extTab(name, el) { const r = current(); if (!r || !['files', 'route', 'exchange'].includes(name)) return; r.tab = name;
    page.querySelectorAll('[data-kh5-ext]').forEach(tab => tab.classList.toggle('active', tab.dataset.kh5Ext === name));
    ['files', 'route', 'exchange'].forEach(n => document.getElementById('kh5Ext' + n[0].toUpperCase() + n.slice(1)).classList.toggle('active', n === name)); }
  function uploadRow() { const row = sharedUploadRow.cloneNode(true); row.cells[5].querySelector('select').innerHTML = '<option>Hồ sơ liên quan</option><option>Số liệu hiện trạng</option><option>Báo cáo đề xuất</option><option>File danh mục</option>'; row.querySelector('.linklike').setAttribute('onclick', "this.closest('tr').remove()"); return row.outerHTML; }
  function addUploadRow() { if (canAttach(current())) page.querySelector('.pm-ext-add-table tbody').insertAdjacentHTML('beforeend', uploadRow()); }
  function saveUploads() {
    const r = current(); if (!canAttach(r)) return; let count = 0;
    page.querySelectorAll('.pm-ext-add-table tbody tr').forEach(row => { const f = row.querySelector('input[type=file]').files[0]; if (!f) return;
      const cells = row.children; r.files.push({ id: r.id + '-upload-' + Date.now() + '-' + count, name: f.name, mime: f.type, blob: f, url: URL.createObjectURL(f), actor: W.roles[r.viewer], time: now(), group: cells[5].querySelector('select').value, infoRequestId: W.infoRequest(r, r.viewer)?.id,
        number: cells[6].querySelector('input').value, date: cells[7].querySelector('input').value, issuer: cells[8].querySelector('input').value, signer: cells[9].querySelector('input').value, signerTitle: cells[10].querySelector('select,input').value }); count++; });
    if (count && W.canProvide(r, r.viewer)) { const q = W.infoRequest(r, r.viewer); W.saveResponse(r, r.viewer, q.response.text, r.files.filter(f => f.infoRequestId === q.id && (!f.infoKind || f.posted)).map(f => f.id)); }
    if (!count) return notify('Chọn file để lưu tài liệu'); log(r, 'Thêm ' + count + ' tài liệu'); renderExtended(r); notify('Đã lưu tài liệu');
  }
  function exchangeFileChanged(input) { const r = current(); if (!r) return; const d = r.drafts[r.viewer]; if (d.file?.url) URL.revokeObjectURL(d.file.url); const f = input.files[0]; d.file = f ? { kind: 'upload', name: f.name, mime: f.type, blob: f, url: URL.createObjectURL(f) } : null; document.getElementById('kh5ExchangeFileName').textContent = f?.name || 'Chưa chọn tệp'; }
  function sendExchange() { try { const r = current(), d = r && exchangeDraft(r); if (!d || !d.text.trim() && !d.file && !d.attachments.length) return notify('Nhập nội dung hoặc chọn tệp');
    if (!own(r) && !W.receiptFor(r, r.viewer)) return notify('Vai trò này chưa nhận hồ sơ / yêu cầu');
    const q = W.infoRequest(r, r.viewer);
    const documents=d.attachments.map(id=>r.files.find(f=>f.id===id)).filter(Boolean);
    if (W.canProvide(r, r.viewer)) {
      if (d.file) r.files.push({ ...d.file, id: q.id + '-file-' + Date.now(), infoRequestId: q.id, actor: W.roles[r.viewer], time: now(), group: 'Số liệu hiện trạng' });
      W.saveResponse(r, r.viewer, d.text.trim() || q.response.text, r.files.filter(f => f.infoRequestId === q.id && (!f.infoKind || f.posted || documents.includes(f))).map(f => f.id)); log(r, 'Cung cấp số liệu hiện trạng – ' + q.unit + ' – phiên bản ' + q.responseRevision);
    }
    documents.forEach(file=>file.posted=true);
    r.exchange.unshift({ actor: W.roles[r.viewer], requestId: q?.id, text: d.text.trim(), time: now(), attachments: [...documents.map(file=>({kind:file.infoKind,code:file.infoCode,name:file.name,id:file.id,doc:{document:structuredClone(file.document),version:file.version}})),...(d.file?[{...d.file}]:[])] }); r.drafts[r.viewer] = { text: '', file: null, attachments:[] }; renderExtended(r);notify('Đã gửi nội dung trao đổi kèm văn bản'); } catch(error) {notify(error.message,true);} }
  function refreshSubmission(r) { const old = r.submission; if (!old) return; const html = paper(r, 'submission'), blob = KHStep5Office.docx(paragraphs(r, 'submission')); URL.revokeObjectURL(old.url); old.blob = blob; old.url = URL.createObjectURL(blob); old.html = html; }
  function sign() {
    const r = current(); if (!W.canSign(r, r.viewer)) return notify('Không có nhiệm vụ ký Tờ trình');
    signSession = { id: r.id, actor: r.viewer, revision: r.revision, receipt: r.receipt };
    const paperHost = document.querySelector('#digitalSignModal .route-sign-paper'), toolbar = document.querySelector('#digitalSignModal .route-preview-toolbar');
    signUI = { paper: paperHost.innerHTML, toolbar: toolbar.innerHTML }; paperHost.innerHTML = r.submission.html + '<div class="route-signature-stamp">VNPT<br><span style="font-size:13px">Ký số tại đây</span></div>'; toolbar.textContent = r.submission.name; openDigitalSignModal();
  }
  const oldFinishSign = finishDigitalSign;
  finishDigitalSign = function () {
    if (!signSession) return oldFinishSign.apply(this, arguments);
    const snap = signSession; signSession = null; const r = records.get(snap.id);
    try { if (!r || r.viewer !== snap.actor || r.revision !== snap.revision || r.receipt !== snap.receipt) throw Error('Nhiệm vụ đã thay đổi; mở lại ký số'); W.sign(r, snap.actor); refreshSubmission(r); log(r, 'Ký số Tờ trình (demo)'); closeDigitalSignModal(); render(); notify('Đã ký Tờ trình (demo)'); } catch (e) { closeDigitalSignModal(); notify(e.message,true); }
  };
  const oldCloseSign = closeDigitalSignModal;
  closeDigitalSignModal = function () { signSession = null; if (signUI) { document.querySelector('#digitalSignModal .route-sign-paper').innerHTML = signUI.paper; document.querySelector('#digitalSignModal .route-preview-toolbar').innerHTML = signUI.toolbar; signUI = null; } return oldCloseSign.apply(this, arguments); };
  function takeNumber() { const r = current(); if (W.canIssue(r, r.viewer)) document.getElementById('kh5Issue_number').value = String(800 + [...records.values()].filter(x => x.submission?.issued).length + 1); }
  function issue() { const r = current(); try { const metadata = Object.fromEntries(['number', 'date', 'suffix', 'eoffice'].map(k => [k, document.getElementById('kh5Issue_' + k)?.value.trim() || ''])); W.issue(r, r.viewer, metadata); log(r, 'Ban hành Tờ trình số ' + r.issue.number); refreshSubmission(r); render(); } catch (e) { notify(e.message,true); } }
  function transferFile(r, file) {
    const row = sharedTransferFileRow.cloneNode(true); row.removeAttribute('id');
    const buttons = [...row.querySelectorAll('button')]; buttons.filter(b => /openInitialSignModal|openDigitalSignModal/.test(b.getAttribute('onclick') || '')).forEach(b => b.remove());
    const action = "kh5.previewTransferFile('" + file.id + "')";
    buttons[0].setAttribute('onclick', "this.parentElement.querySelector('input').checked=false;this.closest('.route-file-line').style.display='none'"); buttons[1].setAttribute('onclick', action);
    const download = document.createElement('a'); download.className = buttons[2].className; download.textContent = buttons[2].textContent; download.href = file.url || '#'; download.download = file.name; if (!file.url) download.style.display = 'none'; buttons[2].replaceWith(download);
    const check = row.querySelector('input'); check.checked = true; check.setAttribute('checked', ''); check.dataset.kh5TransferFile = file.id;
    row.querySelector('.route-file-name').textContent = file.name + ' (Người gửi: ' + W.roles[r.viewer] + ')';
    return '<div class="route-file-line"><div class="route-file-label">' + (file.docType === 'submission' ? file.issued ? 'File phát hành' : 'File trình ký' : 'Văn bản liên quan') + '</div><div class="route-file-main">' + row.outerHTML + '</div></div>';
  }
  const previousRecipients = renderRouteRecipients;
  renderRouteRecipients = function () {
    const result = previousRecipients.apply(this, arguments);
    if (pendingTransferAction === 'kh5Transfer' && currentTransferCfg?.rolePermissions) {
      const permissions = currentTransferCfg.rolePermissions;
      const defaults = { main: [currentTransferCfg.main], co: currentTransferCfg.co || [], view: currentTransferCfg.send || [] };
      document.querySelectorAll('#routeRecipientRows tr').forEach(row => {
        [['main', 'input[type=radio]'], ['co', '.routeCo'], ['view', '.routeView']].forEach(([kind, selector]) => {
          const input = row.querySelector(selector); input.disabled = !permissions[kind].includes(input.value);
          input.checked = !input.disabled && defaults[kind].includes(input.value);
        });
      }); updateRouteSelectedList();
    }
    return result;
  };
  function previewTransferFile(id) {
    const r = current(), file = modal?.files.find(f => f.id === id); if (!file) return;
    if (file.docType === 'basis') return previewBasis();
    if (file.html) return preview(file.name, file.html);
    if (file.mime === 'application/pdf' || /\.pdf$/i.test(file.name)) return preview(file.name, '', file.url);
    const a = document.createElement('a'); a.href = file.url; a.download = file.name; a.click();
  }
  function transfer(preset) {
    const r = current(); if (!own(r)) return notify('Bạn không được giao xử lý chính');
    if (edit(r) && !save(true)) return;
    const allowed = W.allowed(r, r.viewer); if (!allowed.length) return notify('Chưa có hướng chuyển thuộc nhiệm vụ hiện tại');
    const requestDoc=r.files.filter(f=>f.infoKind==='request' && f.authorKey===r.viewer).at(-1);
    if(!preset && edit(r) && requestDoc){const recipient=W.providers.find(p=>W.documentTargets(requestDoc).includes(p.unit));if(recipient && allowed.includes(recipient.lead))preset=recipient.lead;}
    const q = W.infoRequest(r, r.viewer), taskReceipt = W.receiptFor(r, r.viewer);
    if (edit(r) && W.pairReady(r)) ensureSubmission(r);
    const panel = document.getElementById('routePanelFiles'), box = document.getElementById('transferModal'); modal = { id: r.id, actor: r.viewer, receipt: taskReceipt, requestId: q?.id, responseRevision: q?.responseRevision, revision: r.revision, allowed,
      filesHtml: panel.innerHTML, cfg: currentTransferCfg, action: pendingTransferAction, classes: box.className, summary: box.querySelector('.route-opinion-summary').innerHTML };
    box.classList.add('kh4-route');
    box.querySelector('.route-opinion-summary').innerHTML = '<div><b>Tổng hợp ý kiến</b></div>' + r.exchange.slice().reverse().map(x => '<div class="route-opinion-row"><b>' + esc(x.actor) + '</b><div class="mini">' + esc(x.time) + ' · ' + esc(x.text) + '</div></div>').join('');
    document.getElementById('routeOpinionFile').value = ''; 
    Object.entries(W.roles).forEach(([key, title]) => { if (!routeRecipients.some(x => x.id === 'kh5_' + key)) routeRecipients.push({ id: 'kh5_' + key, name: title, title, unit: W.provider(key)?.unit || (key === 'khdt' ? 'Ban KHĐT' : key === 'pm' || key === 'lead' ? 'Ban KT' : 'VNPT Net') }); });
    const rolePermissions = { main: allowed.map(key => 'kh5_' + key), co: W.coAllowed(r, r.viewer).map(key => 'kh5_' + key), view: W.viewAllowed(r, r.viewer).map(key => 'kh5_' + key) };
    pendingTransferAction = 'kh5Transfer'; currentTransferCfg = { title: q ? 'Chuyển yêu cầu / số liệu hiện trạng – ' + q.unit : 'Chuyển đề xuất lựa chọn PAKT, CN và quy mô', main: preset && allowed.includes(preset) ? 'kh5_' + preset : '', co: [], send: r.viewer !== 'khdt' ? ['kh5_khdt'] : [], allowed: [...new Set(Object.values(rolePermissions).flat())], rolePermissions };
    const files = q ? [...q.documents, ...r.files.filter(file => file.infoRequestId === q.id)] : [{ ...r.basis.decision, id: r.basis.id + '-basis', docType: 'basis' }, ...(r.submission ? [r.submission] : []), ...r.files]; modal.files = files;
    panel.innerHTML = files.map(file => transferFile(r, file)).join('');
    document.getElementById('transferNote').value = q ? q.response.text || q.receipt.note : exchangeDraft(r).text || requestDoc?.document.content || ''; document.getElementById('routeReceiverSearch').value = '';
    renderRouteRecipients(); switchRouteTab('receiver'); document.getElementById('transferModal').classList.add('show');
  }
  const oldHide = hideTransferModal;
  hideTransferModal = function () { const snap = modal; modal = null; const result = oldHide.apply(this, arguments); if (snap) { document.getElementById('routePanelFiles').innerHTML = snap.filesHtml; currentTransferCfg = snap.cfg; pendingTransferAction = snap.action; const box = document.getElementById('transferModal'); box.className = snap.classes.replace(/\bshow\b/g, '').trim(); box.querySelector('.route-opinion-summary').innerHTML = snap.summary; document.getElementById('routeOpinionFile').value = ''; } return result; };
  const oldConfirm = confirmTransferFromModal;
  confirmTransferFromModal = function () {
    if (pendingTransferAction !== 'kh5Transfer') return oldConfirm.apply(this, arguments);
    const r = current(), snap = modal;
    try {
      const q = r && W.infoRequest(r, r.viewer);
      if (!snap || !r || r.id !== snap.id || r.viewer !== snap.actor || W.receiptFor(r, r.viewer) !== snap.receipt || q?.id !== snap.requestId || q?.responseRevision !== snap.responseRevision || r.revision !== snap.revision) throw Error('Hồ sơ / nhiệm vụ đã thay đổi; mở lại popup Chuyển');
      const selected = selectedRouteRecipients(), to = selected.main?.id.replace(/^kh5_/, '');
      if (!to || !snap.allowed.includes(to)) { switchRouteTab('receiver'); throw Error('Chọn 01 người xử lý chính'); }
      const detail = { note: document.getElementById('transferNote').value.trim(), files: [...document.querySelectorAll('[data-kh5-transfer-file]:checked')].map(el => el.dataset.kh5TransferFile),
        co: selected.co.map(x => x.id.replace(/^kh5_/, '')), view: selected.view.map(x => x.id.replace(/^kh5_/, '')) };
      const opinionFile = document.getElementById('routeOpinionFile')?.files[0], actor = W.roles[r.viewer];
      const result = W.transfer(r, snap.actor, to, detail); log(r, 'Chuyển tới ' + W.roles[to] + (detail.note ? ' · ' + detail.note : ''), actor, result?.request?.receipt);
      if (detail.note || opinionFile) r.exchange.unshift({ actor, text: detail.note, time: now(), attachments: opinionFile ? [{ kind: 'upload', name: opinionFile.name, mime: opinionFile.type, url: URL.createObjectURL(opinionFile) }] : [] });
      hideTransferModal(); r.tab = r.viewer === 'pm' ? 'files' : 'exchange'; render(); notify('Đã chuyển hồ sơ / số liệu');
    } catch (e) { notify(e.message,true); }
  };
  function seedProposals() {
    (window.KHPTMDemoData?.plans || []).forEach(sample => {
      const basis = kh4.approvedPlans().find(plan => plan.id === sample.id); if (!basis) return;
      const r = W.create(basis, 'PAKT-MAU-' + sample.id);
      const data = { ...r.data, ...Object.fromEntries(W.fields.filter(([key]) => sample[key] !== undefined).map(([key]) => [key, sample[key]])),
        deadline: '2026-10-15', investment: 'Mở rộng hệ thống hiện có', schedule: 'Chuẩn bị hồ sơ Quý IV/2026; trang bị và đưa vào khai thác Quý II–III/2027.',
        recommendation: 'Đề nghị xem xét phương án và quy mô nêu trên để làm cơ sở triển khai các bước tiếp theo theo KHPTM đã phê duyệt.' };
      W.save(r, 'pm', data, sample.rows.map(row => ({ ...W.emptyRow(), ...row })));
      const sampleTime = hour => formatDateVN(sample.date) + ' ' + hour + ':00:00';
      const addHistory = (actor, text, hour) => r.history.unshift({ actor: W.roles[actor], text, time: sampleTime(hour), receipt: { ...r.receipt, files: r.receipt.files.slice() } });
      addHistory('pm', 'Tiếp nhận căn cứ ' + basis.title + ' · QĐ ' + basis.number + ' ngày ' + formatDateVN(basis.date) + '; lập đề xuất (mẫu).', '08');
      W.installPair(r, 'pm', [buildFile(r, 'report'), buildFile(r, 'catalog')]); r.files.forEach(file => { file.time = sampleTime('09'); });
      addHistory('pm', 'Tạo Báo cáo đề xuất và file danh mục từ cùng dữ liệu tính toán quy mô.', '09');
      if (sample.type === 'Core di động') {
        const result = W.transfer(r, 'pm', 'leadKTM', { note: 'Cung cấp năng lực Core hiện có, tải khai thác và số liệu thuê bao tại ' + sample.location + ' để tính toán quy mô năm ' + sample.year + '.', files: [basis.id + '-basis', ...r.files.map(file => file.id)], co: ['leadTTP'], view: ['khdt'] });
        result.request.receipt.time = sample.date + 'T10:00:00+07:00';
        r.history.unshift({ actor: W.roles.pm, text: 'Yêu cầu Ban KTM cung cấp số liệu; VNPT TTP phối hợp; Ban KHĐT nhận thông tin.', time: sampleTime('10'), receipt: { ...result.request.receipt } });
        const assigned = W.transfer(r, 'leadKTM', 'pmKTM', { note: 'Giao PM Ban KTM tổng hợp số liệu hiện trạng, trình lãnh đạo duyệt trước khi trả Ban KT.', files: result.request.receipt.files, co: [], view: ['khdt'] });
        assigned.request.receipt.time = sample.date + 'T11:00:00+07:00'; r.history.unshift({ actor: W.roles.leadKTM, text: 'Phân công PM Ban KTM cung cấp số liệu hiện trạng.', time: sampleTime('11'), receipt: { ...assigned.request.receipt } });
        r.drafts.pmKTM = { text: sample.parameters + '\n' + sample.current, file: null }; r.viewer = 'pm';
      }
      if (sample.stage !== 'PREPARE') {
        ensureSubmission(r); r.submission.time = sampleTime('09');
        W.transfer(r, 'pm', 'lead', { note: 'Kính trình xem xét phương án kỹ thuật, công nghệ và quy mô theo QĐ ' + basis.number + '.', files: [r.submission.id, ...r.files.map(file => file.id)] });
        r.receipt.time = sample.date + 'T10:00:00+07:00'; addHistory('pm', 'Chuyển LĐ Ban KT xem xét Tờ trình, Báo cáo đề xuất và file danh mục.', '10');
        r.exchange.unshift({ actor: W.roles.pm, text: r.receipt.note, time: sampleTime('10'), attachments: [] });
      }
      if (sample.stage === 'ISSUE') {
        W.sign(r, 'lead'); refreshSubmission(r); addHistory('lead', 'Ký Tờ trình lựa chọn PAKT, CN và quy mô (demo).', '11');
        W.transfer(r, 'lead', 'tctClerk', { note: 'Thống nhất nội dung đề xuất. Văn thư nhập số và ban hành Tờ trình đã ký cùng bộ tài liệu.', files: [r.submission.id, ...r.files.map(file => file.id)] });
        r.receipt.time = sample.date + 'T13:00:00+07:00'; addHistory('lead', 'Chuyển Văn thư TCT ban hành Tờ trình đã ký.', '13');
        r.exchange.unshift({ actor: W.roles.lead, text: r.receipt.note, time: sampleTime('13'), attachments: [] });
        r.issue = { number: '', suffix: 'VNPT Net-KT', date: '2026-10-02', eoffice: '' };
      }
      records.set(r.id, r);
    });
  }
  seedProposals();
  window.kh5 = { list, filterList, createScreen, chooseBasis, create, open, render, setRole, save, reset, approve, approveData, addRow, removeRow, generate, previewBasis, previewSubmission, previewFile, previewArchive,openInfo,previewPending,removePending,
    extTab, addUploadRow, saveUploads, exchangeFileChanged, sendExchange, sign, takeNumber, issue, transfer, previewTransferFile };
}());
