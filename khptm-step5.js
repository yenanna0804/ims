/* KHPTM Step 5: De xuat lua chon PAKT, CN va quy mo - common pattern for Core, Vo tuyen, BRCD. */
(function () {
  'use strict';

  const TYPES = ['Core di động', 'Vô tuyến', 'BRCĐ'];
  const SURVEY = 'CẦN KHẢO SÁT';
  const ROLE_NAMES = { pm: 'PM Ban KT', provider: 'Đơn vị cung cấp thông tin', leader: 'LĐ Ban KT' };
  const PROVIDERS = {
    'Core di động': ['Ban KTM', 'VNPT TTP/VNP/IT, các đơn vị liên quan trong Tập đoàn'],
    'Vô tuyến': ['Ban KTM', 'Đơn vị liên quan cung cấp số liệu hiện trạng'],
    'BRCĐ': ['Ban KTM', 'VNPT TTP/VNP/IT, các đơn vị liên quan trong Tập đoàn']
  };
  const records = new Map();
  let currentType = TYPES[0];
  let viewer = 'pm';
  let exchangeUpload = '';
  let infoEditing = null;

  const now = () => new Date().toLocaleString('vi-VN', { hour12: false });
  const safe = value => typeof esc === 'function'
    ? esc(String(value == null ? '' : value))
    : String(value == null ? '' : value).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const formatDate = value => typeof formatDateVN === 'function' ? formatDateVN(value) : (value || '');
  const notify = message => typeof toast === 'function' ? toast(message) : void 0;

  function approvedSources() {
    const live = window.kh4 && typeof window.kh4.getStep5Sources === 'function' ? window.kh4.getStep5Sources() : [];
    return TYPES.map(type => {
      const source = live.find(x => x.type === type);
      if (source) return source;
      return {
        id: 'KHPTM-' + type.replace(/\s+/g, '-').replace(/Đ/g,'D').replace(/đ/g,'d') + '-2027-APPROVED',
        type,
        year: 2027,
        title: 'KHPTM ' + type + ' năm 2027',
        decisionNumber: SURVEY,
        decisionDate: '',
        issued: true,
        fallback: true
      };
    });
  }

  function sourceById(id) {
    return approvedSources().find(x => x.id === id) || null;
  }

  function blankFields() {
    return {
      currentState: SURVEY,
      technicalOption: SURVEY,
      equipmentOption: SURVEY,
      calculationMethod: SURVEY,
      calculationParameters: SURVEY,
      calculationResult: SURVEY,
      equipmentList: SURVEY
    };
  }

  function makeRecord(type) {
    const source = approvedSources().find(x => x.type === type);
    return {
      id: 'PAKT-' + ({'Core di động':'CORE','Vô tuyến':'VT','BRCĐ':'BRCD'})[type] + '-2027',
      type,
      year: 2027,
      basisId: source ? source.id : '',
      fields: blankFields(),
      docType: 'submission',
      generated: null,
      generatedVersion: 0,
      leaderSigned: false,
      status: 'DRAFT',
      owner: 'pm',
      receipt: { from: 'system', fromName: 'Hệ thống', to: 'pm', toName: ROLE_NAMES.pm, purpose: 'CREATE', note: 'Khởi tạo đề xuất từ KHPTM đã được phê duyệt', time: now() },
      requests: [],
      activeRequestId: '',
      files: [],
      history: [{ actor: 'Hệ thống', text: 'Khởi tạo hồ sơ Đề xuất lựa chọn PAKT, CN và quy mô - ' + type, time: now() }],
      exchange: [],
      exchangeDraft: { text: '', attachments: [] }
    };
  }

  function record() {
    if (!records.has(currentType)) records.set(currentType, makeRecord(currentType));
    return records.get(currentType);
  }

  function log(r, actor, text) {
    r.history.push({ actor, text, time: now() });
  }

  function statusText(r) {
    return ({
      DRAFT: 'Đang lập',
      INFO_WAIT: 'Chờ cung cấp thông tin',
      LEADER: r.leaderSigned ? 'Đã ký - chờ chuyển' : 'Chờ LĐ Ban KT ký',
      RETURNED: 'Yêu cầu chỉnh sửa',
      DONE: 'Hoàn thành'
    })[r.status] || r.status;
  }

  function owns(r, role) {
    return r.owner === role;
  }

  function isEditable(r) {
    return viewer === 'pm' && owns(r, 'pm') && ['DRAFT','RETURNED'].includes(r.status);
  }

  function surveyInputClass(value) {
    return String(value || '').trim() === SURVEY ? ' kh5-survey-input' : '';
  }

  function setSurveyState(el) {
    if (!el) return;
    el.classList.toggle('kh5-survey-input', el.value.trim() === SURVEY);
  }

  function field(label, key, value, textarea) {
    const disabled = isEditable(record()) ? '' : ' disabled';
    const cls = surveyInputClass(value);
    if (textarea) {
      return '<div class="kh5-field-full"><label>' + label + '</label><textarea data-kh5-field="' + key + '" class="' + cls.trim() + '" oninput="kh5.fieldChanged(this)"' + disabled + '>' + safe(value) + '</textarea></div>';
    }
    return '<div><label>' + label + '</label><input data-kh5-field="' + key + '" class="' + cls.trim() + '" value="' + safe(value) + '" oninput="kh5.fieldChanged(this)"' + disabled + '></div>';
  }

  function captureFields() {
    const r = record();
    document.querySelectorAll('#kh5Process [data-kh5-field]').forEach(el => {
      r.fields[el.dataset.kh5Field] = el.value.trim() || SURVEY;
    });
  }

  function fieldChanged(el) {
    setSurveyState(el);
    const r = record();
    if (r.generated) {
      r.generated = null;
      r.leaderSigned = false;
      notify('Nội dung đã thay đổi. Cần sinh lại văn bản trước khi trình.');
      renderActions();
    }
  }

  function fallbackDecisionHtml(source) {
    return '<div style="text-align:center"><b>TẬP ĐOÀN BƯU CHÍNH VIỄN THÔNG VIỆT NAM</b></div>' +
      '<p>Số: <span class="kh5-survey-text">' + SURVEY + '</span></p>' +
      '<h2>QUYẾT ĐỊNH</h2><h3>Phê duyệt Kế hoạch phát triển mạng ' + safe(source.type) + ' năm ' + safe(source.year) + '</h3>' +
      '<p><b>Ngày quyết định:</b> <span class="kh5-survey-text">' + SURVEY + '</span></p>' +
      '<div class="sign"><b>LÃNH ĐẠO TẬP ĐOÀN</b><br><br><br>(Đã phê duyệt)</div>';
  }

  function openPreview(title, html) {
    const titleEl = document.getElementById('khptmPreviewTitle');
    const paper = document.getElementById('khptmPreviewPaper');
    const modal = document.getElementById('khptmPreviewModal');
    if (!titleEl || !paper || !modal) return;
    titleEl.textContent = title;
    paper.innerHTML = html;
    modal.classList.add('show');
  }

  function viewDecision() {
    const r = record();
    const source = sourceById(r.basisId);
    if (!source) return notify('Chọn KHPTM đã được phê duyệt');
    openPreview('Quyết định phê duyệt KHPTM', source.html || fallbackDecisionHtml(source));
  }

  function documentTitle(kind) {
    return kind === 'report' ? 'Báo cáo đề xuất' : 'Tờ trình';
  }

  function documentName(r, kind) {
    const tag = ({'Core di động':'Core','Vô tuyến':'Vo_tuyen','BRCĐ':'BRCD'})[r.type];
    return (kind === 'report' ? 'Bao_cao_de_xuat_PAKT_CN_quy_mo_' : 'To_trinh_de_xuat_PAKT_CN_quy_mo_') + tag + '_' + r.year + '.docx';
  }

  function docValue(value) {
    return String(value || '').trim() === SURVEY
      ? '<span class="kh5-survey-text">' + SURVEY + '</span>'
      : safe(value).replace(/\n/g, '<br>');
  }

  function generatedHtml(r, snapshot) {
    const s = snapshot || (r.generated && r.generated.snapshot) || { fields: r.fields, kind: r.docType, basisId: r.basisId, year: r.year, type: r.type };
    const f = s.fields || r.fields;
    const heading = s.kind === 'report' ? 'BÁO CÁO ĐỀ XUẤT' : 'TỜ TRÌNH';
    const source = sourceById(s.basisId);
    return '<div class="kh5-doc">' +
      '<div style="text-align:center"><b>TỔNG CÔNG TY HẠ TẦNG MẠNG - VNPT NET</b></div>' +
      '<p>Số: <span class="kh5-survey-text">' + SURVEY + '</span></p>' +
      '<h2>' + heading + '</h2>' +
      '<h3>V/v lựa chọn phương án kỹ thuật, công nghệ và tính toán quy mô ' + safe(s.type) + ' năm ' + safe(s.year) + '</h3>' +
      '<p><b>Căn cứ:</b> ' + safe(source ? source.title : SURVEY) + ' và Quyết định phê duyệt KHPTM liên quan.</p>' +
      '<p><b>1. Hiện trạng phục vụ tính toán quy mô</b><br>' + docValue(f.currentState) + '</p>' +
      '<p><b>2. Phương án kỹ thuật, công nghệ đề xuất</b><br>' + docValue(f.technicalOption) + '</p>' +
      '<p><b>3. Phương án thiết bị lựa chọn</b><br>' + docValue(f.equipmentOption) + '</p>' +
      '<p><b>4. Nguyên tắc/phương pháp tính toán, định cỡ</b><br>' + docValue(f.calculationMethod) + '</p>' +
      '<p><b>5. Tham số tính toán</b><br>' + docValue(f.calculationParameters) + '</p>' +
      '<p><b>6. Kết quả tính toán quy mô</b><br>' + docValue(f.calculationResult) + '</p>' +
      '<p><b>7. Danh mục/chủng loại vật tư thiết bị dự kiến</b><br>' + docValue(f.equipmentList) + '</p>' +
      '<div class="sign"><b>LÃNH ĐẠO BAN KỸ THUẬT</b><br><br><br>' + (r.leaderSigned ? '(Đã ký số - demo)' : '(Chờ ký)') + '</div></div>';
  }

  function generate() {
    const r = record();
    if (!isEditable(r)) return notify('Hồ sơ hiện không thuộc quyền lập/sửa của PM Ban KT');
    captureFields();
    if (!r.basisId) return notify('Chọn KHPTM đã được phê duyệt làm căn cứ');
    r.generatedVersion += 1;
    r.generated = {
      id: r.id + '-DOC-' + r.generatedVersion,
      kind: r.docType,
      name: documentName(r, r.docType),
      time: now(),
      actor: ROLE_NAMES.pm,
      signed: false,
      snapshot: {
        kind: r.docType,
        basisId: r.basisId,
        type: r.type,
        year: r.year,
        fields: structuredClone(r.fields)
      }
    };
    r.leaderSigned = false;
    stageAttachment({ kind: 'main', id: r.generated.id, name: r.generated.name });
    log(r, ROLE_NAMES.pm, 'Sinh ' + documentTitle(r.docType) + ' từ template - phiên bản ' + r.generatedVersion);
    render();
    viewGenerated();
  }

  function viewGenerated() {
    const r = record();
    if (!r.generated) return notify('Chưa sinh văn bản');
    openPreview(documentTitle(r.generated.kind) + ' - Đề xuất PAKT, CN và quy mô', generatedHtml(r));
  }

  function viewDocumentType(kind) {
    const r = record();
    if (!['submission','report'].includes(kind)) return;
    if (isEditable(r)) {
      captureFields();
      r.docType = kind;
      const snapshot = {
        kind,
        basisId: r.basisId,
        type: r.type,
        year: r.year,
        fields: structuredClone(r.fields)
      };
      if (!r.generated || r.generated.kind !== kind) {
        r.generatedVersion += 1;
        r.generated = {
          id: r.id + '-DOC-' + r.generatedVersion,
          kind,
          name: documentName(r, kind),
          time: now(),
          actor: ROLE_NAMES.pm,
          signed: false,
          snapshot
        };
        r.leaderSigned = false;
      } else {
        r.generated.snapshot = snapshot;
      }
      openPreview(documentTitle(kind) + ' - Đề xuất PAKT, CN và quy mô', generatedHtml(r, snapshot));
      return;
    }
    const snapshot = r.generated && r.generated.kind === kind
      ? r.generated.snapshot
      : {
          kind,
          basisId: r.basisId,
          type: r.type,
          year: r.year,
          fields: structuredClone(r.fields)
        };
    openPreview(documentTitle(kind) + ' - Đề xuất PAKT, CN và quy mô', generatedHtml(r, snapshot));
  }

  function setDocType(value) {
    const r = record();
    if (!isEditable(r)) return;
    if (!['submission','report'].includes(value)) return;
    if (r.docType !== value) {
      r.docType = value;
      r.generated = null;
      r.leaderSigned = false;
      log(r, ROLE_NAMES.pm, 'Chọn loại văn bản đầu ra: ' + documentTitle(value));
    }
    render();
  }

  function setBasis(value) {
    const r = record();
    if (!isEditable(r)) return;
    r.basisId = value;
    r.generated = null;
    r.leaderSigned = false;
    log(r, ROLE_NAMES.pm, 'Chọn căn cứ KHPTM đã được phê duyệt');
    render();
  }

  function saveDraft() {
    const r = record();
    if (!isEditable(r)) return notify('Hồ sơ hiện không thuộc quyền sửa');
    captureFields();
    log(r, ROLE_NAMES.pm, 'Lưu nháp Đề xuất lựa chọn PAKT, CN và quy mô');
    notify('Đã lưu nháp');
    renderExtended();
  }

  function requestPaper(data) {
    const source = sourceById(record().basisId);
    return '<div class="kh-info-paper"><table class="kh-info-letterhead"><tr><td><b>TẬP ĐOÀN BƯU CHÍNH VIỄN THÔNG VIỆT NAM<br>TỔNG CÔNG TY HẠ TẦNG MẠNG</b><p>Số: ' + docValue(data.number) + '</p></td><td><b>CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM</b><br><b>Độc lập - Tự do - Hạnh phúc</b><p>' + docValue(data.place) + ', ' + (data.date ? safe(formatDate(data.date)) : '<span class="kh5-survey-text">'+SURVEY+'</span>') + '</p></td></tr></table>' +
      '<h3 style="text-align:center">V/v yêu cầu cung cấp số liệu hiện trạng phục vụ tính toán quy mô</h3>' +
      '<p><b>Kính gửi:</b> ' + docValue(data.unit) + '</p>' +
      '<p>Căn cứ ' + docValue(data.basis) + ';</p>' +
      '<p>Căn cứ ' + safe(source ? source.title : SURVEY) + ' và Quyết định phê duyệt kế hoạch phát triển mạng liên quan;</p>' +
      '<p>Tổng công ty/VNPT Net đề nghị ' + docValue(data.unit) + ' phối hợp cung cấp nhu cầu và/hoặc hiện trạng phục vụ tính toán quy mô như sau:</p>' +
      '<p>' + docValue(data.content) + '</p>' +
      '<p>Thời hạn cung cấp thông tin trước ngày ' + (data.deadline ? '<b>'+safe(formatDate(data.deadline))+'</b>' : '<span class="kh5-survey-text">'+SURVEY+'</span>') + '.</p>' +
      '<p>Mọi thông tin trao đổi vui lòng liên hệ đầu mối VNPT Net/Ban KT: ' + docValue(data.contact) + ', ' + docValue(data.phone) + ', ' + docValue(data.email) + '.</p>' +
      '<div class="sign"><b>TỔNG GIÁM ĐỐC</b></div></div>';
  }

  function responsePaper(data, req) {
    return '<div class="kh-info-paper"><div style="text-align:center"><b>' + docValue(data.issuer) + '</b></div>' +
      '<h3 style="text-align:center">VĂN BẢN CUNG CẤP THÔNG TIN</h3>' +
      '<p><b>Kính gửi:</b> Ban Kỹ thuật - VNPT Net</p>' +
      '<p>Căn cứ Văn bản yêu cầu cung cấp số liệu hiện trạng phục vụ tính toán quy mô của VNPT Net' + (req ? ' (' + safe(req.name) + ')' : '') + ';</p>' +
      '<p><b>Nội dung/số liệu cung cấp:</b></p><p>' + docValue(data.content) + '</p>' +
      '<p><b>Ghi chú/phụ lục:</b> ' + docValue(data.note) + '</p>' +
      '<div class="sign"><b>ĐẠI DIỆN ĐƠN VỊ CUNG CẤP THÔNG TIN</b><br><br><br>' + docValue(data.signer) + '</div></div>';
  }

  function openInfo(kind) {
    const r = record();
    if (kind === 'request') {
      if (!isEditable(r)) return notify('Chỉ PM Ban KT đang xử lý hồ sơ mới được tạo yêu cầu');
      const providers = PROVIDERS[r.type] || [SURVEY];
      infoEditing = {
        kind,
        data: {
          unit: providers[0] || SURVEY,
          number: SURVEY,
          place: 'Hà Nội',
          date: '',
          basis: 'Quyết định phê duyệt KHPTM và các văn bản liên quan',
          content: SURVEY,
          deadline: '',
          contact: SURVEY,
          phone: SURVEY,
          email: SURVEY
        }
      };
    } else {
      const req = activeRequest(r);
      if (!(viewer === 'provider' && owns(r,'provider') && req && r.receipt && r.receipt.purpose === 'INFO_REQUEST')) return notify('Không có yêu cầu cung cấp thông tin hợp lệ');
      infoEditing = {
        kind,
        requestId: req.id,
        data: {
          issuer: req.unit || SURVEY,
          content: SURVEY,
          note: SURVEY,
          signer: SURVEY
        }
      };
    }
    renderInfoModal();
  }

  function infoField(name, label, type, options) {
    const data = infoEditing.data;
    const value = data[name] || '';
    const cls = surveyInputClass(value);
    if (options && options.length) {
      return '<div><label>' + label + '</label><select data-kh5-info="' + name + '">' + options.map(x => '<option'+(x===value?' selected':'')+'>'+safe(x)+'</option>').join('') + '</select></div>';
    }
    if (type === 'textarea') return '<div class="kh5-field-full"><label>' + label + '</label><textarea data-kh5-info="' + name + '" class="' + cls.trim() + '" oninput="kh5.infoFieldChanged(this)">' + safe(value) + '</textarea></div>';
    return '<div><label>' + label + '</label><input data-kh5-info="' + name + '" type="' + (type || 'text') + '" class="' + cls.trim() + '" value="' + safe(value) + '" oninput="kh5.infoFieldChanged(this)"></div>';
  }

  function renderInfoModal() {
    const modal = document.getElementById('kh5InfoModal');
    if (!modal || !infoEditing) return;
    const r = record();
    let html = '';
    if (infoEditing.kind === 'request') {
      html += '<div class="kh2-doc-note" style="margin-bottom:10px"><b>SOP1-TB-01B</b> - Văn bản yêu cầu cung cấp số liệu hiện trạng phục vụ tính toán quy mô</div>';
      html += '<div class="kh5-form-grid">' +
        infoField('unit','Đơn vị cần cung cấp thông tin','',PROVIDERS[r.type]) +
        infoField('number','Số văn bản') +
        infoField('place','Địa danh') +
        infoField('date','Ngày văn bản','date') +
        infoField('basis','Căn cứ','textarea') +
        infoField('content','Nội dung/số liệu cần cung cấp','textarea') +
        infoField('deadline','Thời hạn cung cấp','date') +
        infoField('contact','Họ tên đầu mối') +
        infoField('phone','Số điện thoại') +
        infoField('email','Email') +
      '</div>';
    } else {
      html += '<div class="kh2-doc-note" style="margin-bottom:10px"><b>Văn bản cung cấp thông tin</b><br>Phản hồi đúng yêu cầu đã được PM Ban KT chuyển đến đơn vị.</div>';
      html += '<div class="kh5-form-grid">' +
        infoField('issuer','Đơn vị ban hành') +
        infoField('content','Nội dung/số liệu cung cấp','textarea') +
        infoField('note','Ghi chú/Phụ lục','textarea') +
        infoField('signer','Người đại diện') +
      '</div>';
    }
    html += '<div class="footer-actions"><button onclick="kh5.closeInfo()">Đóng</button><button onclick="kh5.previewInfo()">Xem preview văn bản</button><button class="primary" onclick="kh5.saveInfo()">Lưu văn bản</button></div>';
    document.getElementById('kh5InfoTitle').textContent = infoEditing.kind === 'request' ? 'Tạo VB yêu cầu cung cấp thông tin' : 'Tạo VB cung cấp thông tin';
    document.getElementById('kh5InfoBody').innerHTML = html;
    modal.classList.add('show');
  }

  function infoFieldChanged(el) {
    setSurveyState(el);
  }

  function captureInfo() {
    if (!infoEditing) return null;
    const data = { ...infoEditing.data };
    document.querySelectorAll('#kh5InfoModal [data-kh5-info]').forEach(el => data[el.dataset.kh5Info] = el.value.trim());
    infoEditing.data = data;
    return data;
  }

  function previewInfo() {
    if (!infoEditing) return;
    const data = captureInfo();
    if (infoEditing.kind === 'request') openPreview('SOP1-TB-01B - Văn bản yêu cầu cung cấp số liệu hiện trạng', requestPaper(data));
    else openPreview('Văn bản cung cấp thông tin', responsePaper(data, activeRequest(record())));
  }

  function saveInfo() {
    const r = record();
    const data = captureInfo();
    if (!infoEditing || !data) return;
    if (infoEditing.kind === 'request') {
      const req = {
        id: r.id + '-REQ-' + (r.requests.length + 1),
        unit: data.unit,
        data: structuredClone(data),
        name: 'SOP1-TB-01B_Yeu_cau_so_lieu_' + (r.requests.length + 1) + '.docx',
        status: 'DRAFT',
        createdAt: now(),
        response: null
      };
      r.requests.push(req);
      r.activeRequestId = req.id;
      stageAttachment({ kind: 'request', id: req.id, name: req.name });
      log(r, ROLE_NAMES.pm, 'Tạo VB yêu cầu cung cấp thông tin SOP1-TB-01B cho ' + req.unit);
    } else {
      const req = r.requests.find(x => x.id === infoEditing.requestId);
      if (!req) return notify('Yêu cầu nguồn không còn hiệu lực');
      req.response = {
        id: req.id + '-RESP',
        data: structuredClone(data),
        name: 'VB_cung_cap_thong_tin_' + req.id.split('-').pop() + '.docx',
        status: 'DRAFT',
        createdAt: now()
      };
      stageAttachment({ kind: 'response', id: req.response.id, requestId: req.id, name: req.response.name });
      log(r, ROLE_NAMES.provider, 'Tạo VB cung cấp thông tin phản hồi yêu cầu ' + req.name);
    }
    closeInfo();
    render();
    openExtTab('exchange');
    notify('Đã gắn văn bản vào nội dung trao đổi. Nhập nội dung rồi nhấn Gửi.');
  }

  function closeInfo() {
    const modal = document.getElementById('kh5InfoModal');
    if (modal) modal.classList.remove('show');
    infoEditing = null;
  }

  function activeRequest(r) {
    return r.requests.find(x => x.id === r.activeRequestId) || null;
  }

  function stageAttachment(att) {
    const r = record();
    const draft = r.exchangeDraft;
    const idx = draft.attachments.findIndex(x => x.kind === att.kind && x.id === att.id);
    if (idx < 0) draft.attachments.push(att);
    else draft.attachments[idx] = att;
  }

  function sendExchange() {
    const r = record();
    const ta = document.getElementById('kh5ExchangeText');
    const text = (ta ? ta.value : r.exchangeDraft.text || '').trim();
    const attachments = r.exchangeDraft.attachments.map(x => ({...x}));
    if (exchangeUpload) attachments.push({kind:'upload',id:'UP-'+Date.now(),name:exchangeUpload});
    if (!text && !attachments.length) return notify('Nhập nội dung trao đổi hoặc đính kèm văn bản');
    r.exchange.push({
      actor: ROLE_NAMES[viewer],
      senderName: ROLE_NAMES[viewer],
      time: now(),
      text,
      attachments
    });
    r.exchangeDraft = { text: '', attachments: [] };
    exchangeUpload = '';
    log(r, ROLE_NAMES[viewer], 'Gửi nội dung trao đổi' + (attachments.length ? ' kèm ' + attachments.length + ' tài liệu' : ''));
    renderExtended();
    openExtTab('exchange');
    notify('Đã gửi nội dung trao đổi');
  }

  function exchangeFileChanged(input) {
    exchangeUpload = input && input.files && input.files[0] ? input.files[0].name : '';
    const name = document.getElementById('kh5ExchangeFileName');
    if (name) name.textContent = exchangeUpload || 'Chưa chọn tệp';
  }

  function previewAttachment(att) {
    const r = record();
    if (att.kind === 'main') return viewGenerated();
    if (att.kind === 'request') {
      const req = r.requests.find(x => x.id === att.id);
      if (req) return openPreview('SOP1-TB-01B - Văn bản yêu cầu cung cấp số liệu hiện trạng', requestPaper(req.data));
    }
    if (att.kind === 'response') {
      const req = r.requests.find(x => x.id === att.requestId);
      if (req && req.response) return openPreview('Văn bản cung cấp thông tin', responsePaper(req.response.data, req));
    }
    notify('Mở tệp đính kèm: ' + att.name);
  }

  function ensureSharedRecipients(r) {
    if (typeof routeRecipients === 'undefined') return;
    const extras = [
      { id:'kh5pm', name:'PM Ban KT', title:'Đầu mối lựa chọn PAKT, CN và quy mô', unit:'Ban KT' },
      { id:'kh5leader', name:'LĐ Ban KT', title:'Lãnh đạo Ban Kỹ thuật', unit:'Ban KT' }
    ];
    (PROVIDERS[r.type] || []).forEach((unit, idx) => {
      extras.push({
        id:'kh5provider'+idx,
        name:unit,
        title:'Đơn vị cung cấp thông tin',
        unit:unit.indexOf('Ban KTM') === 0 ? 'VNPT Net' : 'Đơn vị liên quan'
      });
    });
    extras.forEach(item => {
      const old = routeRecipients.find(x => x.id === item.id);
      if (old) {
        old.name = item.name;
        old.title = item.title;
        old.unit = item.unit;
      } else {
        routeRecipients.push(item);
      }
    });
  }

  function providerRouteId(r, unit) {
    const idx = (PROVIDERS[r.type] || []).indexOf(unit);
    return idx >= 0 ? 'kh5provider' + idx : '';
  }

  function resetSharedFileRows() {
    ['routeSignFileRow','routeIssueFileRow'].forEach(id => {
      const row = document.getElementById(id);
      if (!row) return;
      row.style.display = '';
      const check = row.querySelector('.route-check');
      if (check) check.checked = true;
    });
  }

  function setSharedRouteFiles(r) {
    resetSharedFileRows();
    const sign = document.querySelector('#routeSignFileRow .route-file-name');
    const issue = document.querySelector('#routeIssueFileRow .route-file-name');
    const note = document.getElementById('transferNote');
    const req = activeRequest(r) || [...r.requests].reverse().find(x => x.status === 'DRAFT');
    const listName = 'Danh_muc_PAKT_CN_quy_mo_' + ({'Core di động':'Core','Vô tuyến':'Vo_tuyen','BRCĐ':'BRCD'})[r.type] + '_' + r.year + '.xlsx';

    if (viewer === 'pm') {
      const draftReq = [...r.requests].reverse().find(x => x.status === 'DRAFT');
      if (sign) {
        sign.textContent = draftReq
          ? draftReq.name
          : r.generated
            ? r.generated.name
            : listName;
      }
      if (issue) issue.textContent = r.generated ? r.generated.name : listName;
      if (note) note.value = draftReq && r.generated
        ? 'Chọn đơn vị cung cấp thông tin để gửi yêu cầu, hoặc chọn LĐ Ban KT để trình văn bản đã hoàn thiện.'
        : draftReq
          ? 'Chuyển Văn bản yêu cầu cung cấp thông tin tới đúng đơn vị được yêu cầu.'
          : 'Trình văn bản Đề xuất lựa chọn PAKT, CN và quy mô tới LĐ Ban KT xem xét/ký.';
      return;
    }

    if (viewer === 'provider') {
      if (sign) sign.textContent = req && req.response ? req.response.name : 'VB_cung_cap_thong_tin.docx';
      if (issue) issue.textContent = req ? req.name : 'SOP1-TB-01B_Yeu_cau_so_lieu.docx';
      if (note) note.value = 'Đã cung cấp thông tin; chuyển lại PM Ban KT tiếp tục hoàn thiện Đề xuất lựa chọn PAKT, CN và quy mô.';
      return;
    }

    if (viewer === 'leader') {
      if (sign) sign.textContent = r.generated ? r.generated.name : 'To_trinh_Bao_cao_de_xuat_PAKT_CN_quy_mo.docx';
      if (issue) issue.textContent = listName;
      if (note) note.value = 'LĐ Ban KT đã ký văn bản; chuyển kết quả đã ký về PM Ban KT.';
    }
  }

  function openTransfer() {
    const r = record();
    if (!owns(r, viewer)) return notify('Hồ sơ hiện không thuộc người đang xem');
    if (
      typeof routeRecipients === 'undefined' ||
      typeof renderRouteRecipients !== 'function' ||
      typeof switchRouteTab !== 'function'
    ) return notify('Chưa tải được popup Chuyển dùng chung');

    ensureSharedRecipients(r);
    const allowed = [];
    let main = '';

    if (viewer === 'pm' && isEditable(r)) {
      const draftReq = [...r.requests].reverse().find(x => x.status === 'DRAFT');
      if (draftReq) {
        const providerId = providerRouteId(r, draftReq.unit);
        if (providerId) allowed.push(providerId);
      }
      if (r.generated) allowed.push('kh5leader');
    } else if (viewer === 'provider') {
      const req = activeRequest(r);
      if (req && req.response && req.response.status === 'DRAFT') {
        allowed.push('kh5pm');
        main = 'PM Ban KT';
      }
    } else if (viewer === 'leader' && r.leaderSigned) {
      allowed.push('kh5pm');
      main = 'PM Ban KT';
    }

    if (!allowed.length) return notify('Chưa có tuyến chuyển hợp lệ ở trạng thái hiện tại');

    pendingTransferAction = 'kh5Route';
    currentTransferCfg = { main, co:[], send:[], allowed };
    const search = document.getElementById('routeReceiverSearch');
    if (search) search.value = '';
    renderRouteRecipients();
    switchRouteTab('files');
    setSharedRouteFiles(r);
    document.getElementById('transferModal')?.classList.add('show');
  }

  function closeTransfer() {
    if (typeof hideTransferModal === 'function') hideTransferModal();
    else document.getElementById('transferModal')?.classList.remove('show');
  }

  function confirmSharedTransfer() {
    const r = record();
    if (String(pendingTransferAction || '') !== 'kh5Route') return;
    if (typeof selectedRouteRecipients !== 'function') return notify('Chưa tải được thông tin người nhận');
    const selected = selectedRouteRecipients();
    if (!selected.main) {
      if (typeof switchRouteTab === 'function') switchRouteTab('receiver');
      return notify('Chọn 01 người xử lý chính');
    }

    const note = (document.getElementById('transferNote')?.value || '').trim();
    const targetId = selected.main.id;

    if (viewer === 'pm' && isEditable(r)) {
      const draftReq = [...r.requests].reverse().find(x => x.status === 'DRAFT');
      const expectedProviderId = draftReq ? providerRouteId(r, draftReq.unit) : '';

      if (draftReq && targetId === expectedProviderId) {
        draftReq.status = 'SENT';
        r.activeRequestId = draftReq.id;
        r.status = 'INFO_WAIT';
        r.owner = 'provider';
        r.receipt = {
          from:'pm',
          fromName:ROLE_NAMES.pm,
          to:'provider',
          toName:draftReq.unit,
          purpose:'INFO_REQUEST',
          requestId:draftReq.id,
          note,
          time:now()
        };
        log(r, ROLE_NAMES.pm, 'Chuyển ' + draftReq.name + ' đến ' + draftReq.unit + ' - nhiệm vụ cung cấp thông tin');
        viewer = 'provider';
      } else if (targetId === 'kh5leader') {
        captureFields();
        if (!r.generated) {
          if (typeof switchRouteTab === 'function') switchRouteTab('files');
          return notify('Cần xem/sinh Tờ trình hoặc Báo cáo trước khi trình LĐ Ban KT');
        }
        r.status = 'LEADER';
        r.owner = 'leader';
        r.receipt = {
          from:'pm',
          fromName:ROLE_NAMES.pm,
          to:'leader',
          toName:ROLE_NAMES.leader,
          purpose:'SUBMIT_APPROVAL',
          documentId:r.generated.id,
          note,
          time:now()
        };
        log(r, ROLE_NAMES.pm, 'Trình ' + documentTitle(r.generated.kind) + ' đến LĐ Ban KT');
        viewer = 'leader';
      } else {
        if (typeof switchRouteTab === 'function') switchRouteTab('receiver');
        return notify('Chọn đúng đơn vị cung cấp thông tin hoặc LĐ Ban KT');
      }
    } else if (
      viewer === 'provider' &&
      owns(r,'provider') &&
      r.receipt &&
      r.receipt.purpose === 'INFO_REQUEST' &&
      targetId === 'kh5pm'
    ) {
      const req = activeRequest(r);
      if (!req || !req.response || req.response.status !== 'DRAFT') {
        if (typeof switchRouteTab === 'function') switchRouteTab('files');
        return notify('Chưa có VB cung cấp thông tin');
      }
      req.response.status = 'SENT';
      req.status = 'RESPONDED';
      r.status = 'DRAFT';
      r.owner = 'pm';
      r.receipt = {
        from:'provider',
        fromName:req.unit || ROLE_NAMES.provider,
        to:'pm',
        toName:ROLE_NAMES.pm,
        purpose:'INFO_RESPONSE',
        requestId:req.id,
        note,
        time:now()
      };
      log(r, req.unit || ROLE_NAMES.provider, 'Chuyển VB cung cấp thông tin về PM Ban KT');
      viewer = 'pm';
    } else if (
      viewer === 'leader' &&
      owns(r,'leader') &&
      r.receipt &&
      r.receipt.purpose === 'SUBMIT_APPROVAL' &&
      targetId === 'kh5pm'
    ) {
      if (!r.leaderSigned || !r.generated) {
        if (typeof switchRouteTab === 'function') switchRouteTab('files');
        return notify('Văn bản chưa được LĐ Ban KT ký');
      }
      r.status = 'DONE';
      r.owner = 'pm';
      r.receipt = {
        from:'leader',
        fromName:ROLE_NAMES.leader,
        to:'pm',
        toName:ROLE_NAMES.pm,
        purpose:'APPROVED',
        documentId:r.generated.id,
        note,
        time:now()
      };
      log(r, ROLE_NAMES.leader, 'Chuyển kết quả đã ký về PM Ban KT - hoàn thành Bước 5');
      viewer = 'pm';
    } else {
      if (typeof switchRouteTab === 'function') switchRouteTab('receiver');
      return notify('Người nhận không phù hợp với nguồn chuyển/nhiệm vụ hiện tại');
    }

    pendingTransferAction = '';
    closeTransfer();
    render();
    window.scrollTo({top:0,behavior:'smooth'});
    notify('Đã chuyển hồ sơ tới ' + (r.receipt?.toName || ROLE_NAMES[r.owner]));
  }

  function openSharedTransferPreview(title) {
    const r = record();
    const modal = document.getElementById('transferPreviewModal');
    const titleEl = document.getElementById('transferPreviewTitle');
    const paper = modal?.querySelector('.route-preview-paper');
    if (!modal || !titleEl || !paper) return;

    const isFirst = String(title || '').indexOf('Tờ trình') === 0;
    const req = activeRequest(r) || [...r.requests].reverse().find(x => x.status === 'DRAFT');
    let previewTitle = '';
    let html = '';

    if (viewer === 'pm') {
      const draftReq = [...r.requests].reverse().find(x => x.status === 'DRAFT');
      if (isFirst && draftReq) {
        previewTitle = draftReq.name;
        html = requestPaper(draftReq.data);
      } else if (r.generated) {
        previewTitle = r.generated.name;
        html = generatedHtml(r);
      } else {
        previewTitle = 'Danh_muc_PAKT_CN_quy_mo.xlsx';
        html = '<h2>FILE DANH MỤC</h2><p class="kh5-survey-text">' + SURVEY + '</p>';
      }
    } else if (viewer === 'provider') {
      if (isFirst && req && req.response) {
        previewTitle = req.response.name;
        html = responsePaper(req.response.data, req);
      } else if (req) {
        previewTitle = req.name;
        html = requestPaper(req.data);
      }
    } else if (viewer === 'leader') {
      if (isFirst && r.generated) {
        previewTitle = r.generated.name;
        html = generatedHtml(r);
      } else {
        const source = sourceById(r.basisId);
        previewTitle = 'QD_phe_duyet_KHPTM.pdf';
        html = source?.html || fallbackDecisionHtml(source || {type:r.type,year:r.year});
      }
    }

    titleEl.textContent = previewTitle || 'Tài liệu chuyển đi';
    paper.innerHTML = html || '<p>Chưa có nội dung preview.</p>';
    modal.classList.add('show');
  }

  function signLeader() {
    const r = record();
    if (!(viewer === 'leader' && owns(r,'leader') && r.status === 'LEADER' && r.receipt && r.receipt.from === 'pm' && r.receipt.purpose === 'SUBMIT_APPROVAL')) return notify('Không đúng nguồn/tuyến ký');
    if (!r.generated || r.receipt.documentId !== r.generated.id) return notify('Phiên bản văn bản không còn khớp phiếu chuyển');
    r.leaderSigned = true;
    r.generated.signed = true;
    log(r, ROLE_NAMES.leader, 'Ký số ' + documentTitle(r.generated.kind));
    render();
    notify('Đã ký số văn bản');
  }

  function openReturn() {
    const r = record();
    if (!(viewer === 'leader' && owns(r,'leader') && r.status === 'LEADER')) return;
    document.getElementById('kh5ReturnReason').value = '';
    document.getElementById('kh5ReturnModal').classList.add('show');
  }

  function closeReturn() {
    document.getElementById('kh5ReturnModal').classList.remove('show');
  }

  function confirmReturn() {
    const r = record();
    const reason = (document.getElementById('kh5ReturnReason').value || '').trim();
    if (!reason) return notify('Nhập nội dung yêu cầu chỉnh sửa');
    r.status = 'RETURNED';
    r.owner = 'pm';
    r.leaderSigned = false;
    if (r.generated) r.generated.signed = false;
    r.receipt = { from:'leader', fromName:ROLE_NAMES.leader, to:'pm', toName:ROLE_NAMES.pm, purpose:'RETURN_EDIT', note:reason, time:now() };
    log(r, ROLE_NAMES.leader, 'Trả lại PM Ban KT: ' + reason);
    viewer = 'pm';
    closeReturn();
    render();
    notify('Đã trả lại PM Ban KT');
  }

  function addFile(input, groupSelect) {
    const r = record();
    if (!isEditable(r) || !input.files || !input.files[0]) return;
    const group = document.getElementById(groupSelect)?.value || 'Hồ sơ liên quan';
    r.files.push({ id:'FILE-'+Date.now(), name:input.files[0].name, group, actor:ROLE_NAMES.pm, time:now() });
    log(r, ROLE_NAMES.pm, 'Thêm tài liệu: ' + input.files[0].name);
    renderExtended();
    notify('Đã thêm tài liệu');
  }

  function attachmentRows(r) {
    const row = typeof khptm2DocRow === 'function' ? khptm2DocRow : function(stt,signed,main,related,number,eoffice,level,signer,group,file,action){
      return '<tr>'+
        '<td class="center">'+stt+'</td>'+
        '<td class="center">'+signed+'</td>'+
        '<td class="center"><input type="checkbox" checked disabled></td>'+
        '<td class="center"><input type="checkbox" '+(main?'checked':'')+' disabled></td>'+
        '<td class="center"><input type="checkbox" '+(related?'checked':'')+' disabled></td>'+
        '<td>'+number+'</td>'+
        '<td>'+eoffice+'</td>'+
        '<td>'+level+'</td>'+
        '<td>'+signer+'</td>'+
        '<td><select disabled><option selected>'+group+'</option></select></td>'+
        '<td><span class="pm-ext-file" onclick="'+action+'">'+file+'</span></td>'+
        '<td>Chuyên viên Ban KT</td>'+
        '<td>30/09/2026<br>19:35</td>'+
        '<td></td><td></td>'+
        '<td><button class="pm-ext-action" onclick="'+action+'">Xem</button></td>'+
        '</tr>';
    };
    let i=1, rows='';
    const source=sourceById(r.basisId);
    if(source){
      const number=source.decisionNumber&&source.decisionNumber!==SURVEY
        ? safe(source.decisionNumber)+(source.decisionDate?'<br><span class="mini">'+safe(formatDate(source.decisionDate))+'</span>':'')
        : '<span class="mini">Chưa cấp số</span>';
      rows+=row(
        String(i++),'☒',false,true,
        number,'',
        'Tập đoàn','LĐ Tập đoàn','QĐ phê duyệt KHPTM',
        'QD_phe_duyet_KHPTM_'+({'Core di động':'Core','Vô tuyến':'Vo_tuyen','BRCĐ':'BRCD'})[r.type]+'_'+r.year+'.pdf',
        'kh5.viewDecision()'
      );
    }
    rows+=row(
      String(i++),'☐',false,true,
      '<span class="mini">Chưa cấp số</span>','',
      'VNPT Net','--','File danh mục',
      'Danh_muc_PAKT_CN_quy_mo_'+({'Core di động':'Core','Vô tuyến':'Vo_tuyen','BRCĐ':'BRCD'})[r.type]+'_'+r.year+'.xlsx',
      "toast('Mở file danh mục PAKT, CN và quy mô (demo)')"
    );
    if(r.generated){
      rows+=row(
        String(i++),r.leaderSigned?'☒':'☐',true,false,
        '<span class="mini">Chưa cấp số</span>','',
        'Ban KT','LĐ Ban KT',documentTitle(r.generated.kind),
        r.generated.name,'kh5.viewGenerated()'
      );
    }else{
      rows+=row(
        String(i++),'☐',true,false,
        '<span class="mini">Chưa cấp số</span>','',
        'Ban KT','Theo luồng trình ký',r.docType==='report'?'Báo cáo đề xuất':'Tờ trình',
        documentName(r,r.docType),'kh5.generate()'
      );
    }
    r.requests.forEach(req=>{
      rows+=row(
        String(i++),'☐',false,false,
        '<span class="mini">Chưa cấp số</span>','',
        'VNPT Net','Theo luồng xử lý','Yêu cầu cung cấp thông tin',
        req.name,"kh5.viewRequest('"+req.id+"')"
      );
      if(req.response){
        rows+=row(
          String(i++),'☐',false,false,
          '<span class="mini">Chưa cấp số</span>','',
          req.unit||'Đơn vị cung cấp thông tin','Theo văn bản','Văn bản cung cấp thông tin',
          req.response.name,"kh5.viewResponse('"+req.id+"')"
        );
      }
    });
    r.files.forEach(file=>{
      rows+=row(
        String(i++),'☐',false,false,
        '<span class="mini">Chưa cấp số</span>','',
        'VNPT Net','--',file.group||'Hồ sơ liên quan',
        file.name,"toast('Mở tệp đính kèm: "+safe(file.name).replace(/'/g,"\\'")+"')"
      );
    });
    return rows;
  }

  function extendedFilesHtml(r) {
    const rows=attachmentRows(r);
    const uploadRow=isEditable(r)?
      '<table class="pm-ext-add-table">'+
        '<colgroup><col style="width:72px"><col style="width:55px"><col style="width:48px"><col style="width:48px"><col><col style="width:126px"><col style="width:88px"><col style="width:94px"><col style="width:112px"><col style="width:116px"><col style="width:118px"><col style="width:34px"></colgroup>'+
        '<thead><tr><th>Yêu cầu ký số<br>chính thức<br>(PDF,DOCX)</th><th>Cho ĐTVT<br>xem</th><th>VB<br>Chính</th><th>VB<br>LQ</th><th>Đường dẫn file</th><th>Nhóm tài liệu</th><th>Số VB</th><th>Ngày VB</th><th>Cấp ra VB</th><th>Người ký</th><th>Chức vụ người ký</th><th>Xóa</th></tr></thead>'+
        '<tbody><tr>'+
          '<td><input type="checkbox"></td>'+
          '<td><input type="checkbox" checked></td>'+
          '<td><input type="checkbox"></td>'+
          '<td><input type="checkbox"></td>'+
          '<td><input type="file" accept=".pdf,.doc,.docx,.xls,.xlsx"></td>'+
          '<td><select><option>-- Chọn --</option><option>File danh mục</option><option>Tờ trình</option><option>Báo cáo đề xuất</option><option>Yêu cầu cung cấp thông tin</option><option>Văn bản cung cấp thông tin</option><option>Hồ sơ liên quan</option></select></td>'+
          '<td><input value=""></td>'+
          '<td><input type="date"></td>'+
          '<td><input value=""></td>'+
          '<td><input placeholder="Người ký"></td>'+
          '<td><select><option>-- Chọn --</option><option>Lãnh đạo Ban</option><option>Tổng Giám đốc</option><option>Phó Tổng Giám đốc</option><option>Khác</option></select></td>'+
          '<td><span class="linklike" onclick="toast(\'Đã xóa dòng file\')">Xóa</span></td>'+
        '</tr></tbody>'+
      '</table>'+
      '<div class="pm-ext-add-links"><span onclick="toast(\'Mở danh sách file từ template\')">Thêm file từ template</span><span onclick="toast(\'Đã thêm dòng file mới\')">Thêm File</span><span onclick="toast(\'Đã lưu tài liệu\')">Lưu tài liệu</span></div>'
      :'';

    return '<table class="pm-ext-table">'+
      '<colgroup><col class="pm-ext-w-stt"><col class="pm-ext-w-check"><col class="pm-ext-w-check"><col class="pm-ext-w-check-sm"><col class="pm-ext-w-check-sm"><col class="pm-ext-w-date"><col class="pm-ext-w-eoffice"><col class="pm-ext-w-level"><col class="pm-ext-w-signer"><col class="pm-ext-w-group"><col><col class="pm-ext-w-user"><col class="pm-ext-w-time"><col class="pm-ext-w-office"><col class="pm-ext-w-update"><col class="pm-ext-w-docact"></colgroup>'+
      '<thead><tr><th>STT</th><th>Trạng thái<br>ký số</th><th>Cho ĐTVT<br>xem</th><th>VB<br>Chính</th><th>VB<br>LQ</th><th>Số, ngày VB</th><th>Số<br>eOffice</th><th>Cấp ra VB</th><th>Người ký</th><th>Nhóm tài liệu</th><th>Tên tài liệu</th><th>Người tạo</th><th>Thời gian<br>tạo</th><th>Thao tác<br>eOffice</th><th>Cập nhật<br>người ký</th><th>Thao tác<br>văn bản</th></tr></thead>'+
      '<tbody>'+rows+'</tbody>'+
    '</table>'+uploadRow;
  }

  function renderHistory(r) {
    return r.history.length ? r.history.map((x,idx) => '<div class="history-item"><div class="history-dot"></div><div><b>' + safe(x.actor) + '</b><div>' + safe(x.text) + '</div><div class="mini">' + safe(x.time) + '</div></div></div>').join('') : '<div class="mini">Chưa có lịch sử.</div>';
  }

  function exchangeTable(r) {
    if (!r.exchange.length) return '<div class="mini" style="padding:8px">Chưa có nội dung trao đổi.</div>';
    return '<div style="overflow:auto"><table class="exchange-history-table"><thead><tr><th style="width:68px">TT</th><th style="width:400px">Người gửi</th><th style="width:200px">Thời gian</th><th>Nội dung</th></tr></thead><tbody>' +
      r.exchange.map((x,idx) => '<tr><td class="exchange-col-no">' + (idx+1) + '</td><td class="exchange-col-sender"><div class="exchange-sender-name">' + safe(x.senderName || x.actor) + '</div></td><td class="exchange-col-time">' + safe(x.time) + '</td><td><div class="exchange-content"><span class="blue">' + safe(x.text || '').replace(/\n/g,'<br>') + '</span>' + (x.attachments||[]).map((a,j) => '<br><button class="exchange-file-link" onclick="kh5.previewExchangeAttachment('+idx+','+j+')">Xem file đính kèm: ' + safe(a.name) + '</button>').join('') + '</div></td></tr>').join('') +
      '</tbody></table></div>';
  }

  function composerHtml(r) {
    if (!owns(r,viewer) || viewer === 'leader' || r.status === 'DONE') return '';
    const staged = r.exchangeDraft.attachments.map((a,i) => '<span class="file-chip" style="display:inline-flex;margin-right:5px"><span class="pm-ext-file" onclick="kh5.previewStaged('+i+')">' + safe(a.name) + '</span></span>').join('');
    return '<div style="margin-top:9px">' + staged + '<div class="toolbar" style="margin-top:6px;align-items:flex-end"><div style="flex:1"><textarea id="kh5ExchangeText" placeholder="Nhập nội dung trao đổi..." style="min-height:70px">' + safe(r.exchangeDraft.text||'') + '</textarea><div style="margin-top:6px"><button type="button" onclick="document.getElementById(\'kh5ExchangeFile\').click()">☁ Tải tệp lên</button><input id="kh5ExchangeFile" type="file" style="display:none" onchange="kh5.exchangeFileChanged(this)"><span id="kh5ExchangeFileName" class="mini" style="margin-left:8px">' + safe(exchangeUpload || 'Chưa chọn tệp') + '</span></div></div><button class="primary" onclick="kh5.sendExchange()">Gửi</button></div></div>';
  }

  function renderExtended() {
    const host = document.getElementById('kh5Extended');
    if (!host) return;
    const r = record();
    const defaultTab = viewer === 'leader' || viewer === 'provider' ? 'exchange' : 'files';
    const extAction = isEditable(r)
      ? '<button class="kh5-ext-create" onclick="kh5.openInfo(\'request\')">Tạo VB yêu cầu cung cấp thông tin</button>'
      : '';

    host.innerHTML = '<div class="pm-ims-extended"><span class="pm-ext-caption">Thông tin mở rộng</span>' + extAction +
      '<div class="pm-ext-tabs">' +
        '<div class="pm-ext-tab '+(defaultTab==='files'?'active':'')+'" data-kh5-tab="files" onclick="kh5.extTab(\'files\',this)">Tài liệu đính kèm</div>' +
        '<div class="pm-ext-tab" data-kh5-tab="route" onclick="kh5.extTab(\'route\',this)">Lịch sử luân chuyển</div>' +
        '<div class="pm-ext-tab '+(defaultTab==='exchange'?'active':'')+'" data-kh5-tab="exchange" onclick="kh5.extTab(\'exchange\',this)">Lịch sử trao đổi</div>' +
      '</div>' +
      '<div id="kh5ExtFiles" class="pm-ext-pane '+(defaultTab==='files'?'active':'')+'">' + extendedFilesHtml(r) + '</div>' +
      '<div id="kh5ExtRoute" class="pm-ext-pane"><div class="history-list">' + renderHistory(r) + '</div></div>' +
      '<div id="kh5ExtExchange" class="pm-ext-pane '+(defaultTab==='exchange'?'active':'')+'">' + exchangeTable(r) + composerHtml(r) + '</div>' +
    '</div>';
  }

  function openExtTab(name) {
    const tab = document.querySelector('#kh5Extended [data-kh5-tab="'+name+'"]');
    if (tab) extTab(name, tab);
  }

  function extTab(name, el) {
    ['files','route','exchange'].forEach(n => {
      const pane = document.getElementById('kh5Ext' + n.charAt(0).toUpperCase() + n.slice(1));
      if (pane) pane.classList.toggle('active', n === name);
    });
    document.querySelectorAll('#kh5Extended .pm-ext-tab').forEach(x => x.classList.remove('active'));
    if (el) el.classList.add('active');
  }

  function viewRequest(id) {
    const req = record().requests.find(x => x.id === id);
    if (req) openPreview('SOP1-TB-01B - Văn bản yêu cầu cung cấp số liệu hiện trạng', requestPaper(req.data));
  }

  function viewResponse(id) {
    const req = record().requests.find(x => x.id === id);
    if (req && req.response) openPreview('Văn bản cung cấp thông tin', responsePaper(req.response.data, req));
  }

  function previewExchangeAttachment(entry, file) {
    const att = record().exchange[entry] && record().exchange[entry].attachments[file];
    if (att) previewAttachment(att);
  }

  function previewStaged(index) {
    const att = record().exchangeDraft.attachments[index];
    if (att) previewAttachment(att);
  }

  function renderPM(r) {
    if (r.status === 'DONE') {
      return '<div class="section"><h3>Kết quả Bước 5</h3><div class="body"><div class="applied"><b>Đã hoàn thành Đề xuất lựa chọn PAKT, CN và quy mô.</b></div><div class="toolbar"><button onclick="kh5.viewDecision()">Xem QĐ phê duyệt KHPTM</button>' + (r.generated?'<button class="primary" onclick="kh5.viewGenerated()">Xem ' + (r.generated.kind==='report'?'báo cáo':'tờ trình') + '</button>':'') + '</div></div></div>';
    }
    const sources = approvedSources().filter(x => x.type === r.type);
    const receiptNote = r.receipt && r.receipt.from !== 'system' ? '<div class="action-note"><b>Người chuyển:</b> ' + safe(r.receipt.fromName) + ' · <b>Nhiệm vụ:</b> ' + safe(({INFO_RESPONSE:'Tiếp nhận thông tin phản hồi',RETURN_EDIT:'Chỉnh sửa hồ sơ'}[r.receipt.purpose] || r.receipt.purpose)) + (r.receipt.note?' · '+safe(r.receipt.note):'') + '</div>' : '';
    return receiptNote +
      '<div class="section"><h3>Căn cứ</h3><div class="body"><div class="kh5-basis-row"><div><label>KHPTM đã được phê duyệt <span class="req">*</span></label><select id="kh5Basis" onchange="kh5.setBasis(this.value)" ' + (isEditable(r)?'':'disabled') + '><option value="">-- Chọn KHPTM --</option>' + sources.map(x=>'<option value="'+safe(x.id)+'"'+(x.id===r.basisId?' selected':'')+'>'+safe(x.title)+'</option>').join('') + '</select></div><button onclick="kh5.viewDecision()" ' + (r.basisId?'':'disabled') + '>Xem QĐ phê duyệt KHPTM</button></div></div></div>' +
      '<div class="section"><h3>Nội dung Đề xuất lựa chọn PAKT, CN và quy mô</h3><div class="body"><div class="kh5-form-grid">' +
        field('Hiện trạng phục vụ tính toán quy mô','currentState',r.fields.currentState,true) +
        field('Phương án kỹ thuật, công nghệ đề xuất','technicalOption',r.fields.technicalOption,true) +
        field('Phương án thiết bị lựa chọn','equipmentOption',r.fields.equipmentOption,true) +
        field('Nguyên tắc/phương pháp tính toán, định cỡ','calculationMethod',r.fields.calculationMethod,true) +
        field('Tham số tính toán','calculationParameters',r.fields.calculationParameters,true) +
        field('Kết quả tính toán quy mô','calculationResult',r.fields.calculationResult,true) +
        field('Danh mục/chủng loại vật tư thiết bị dự kiến','equipmentList',r.fields.equipmentList,true) +
      '</div></div></div>';
  }

  function renderProvider(r) {
    if (!(owns(r,'provider') && r.receipt && r.receipt.purpose === 'INFO_REQUEST')) {
      return '<div class="role-empty">Vai trò Đơn vị cung cấp thông tin hiện không có nhiệm vụ trực tiếp trên hồ sơ này.</div>';
    }
    const req = activeRequest(r);
    if (!req) return '<div class="role-empty">Không tìm thấy yêu cầu nguồn.</div>';
    return '<div class="section"><h3>Yêu cầu cung cấp thông tin</h3><div class="body"><div class="review-grid"><div class="review-item"><div class="k">Người chuyển</div><div class="v">'+safe(r.receipt.fromName)+'</div></div><div class="review-item"><div class="k">Đơn vị nhận</div><div class="v">'+safe(req.unit)+'</div></div><div class="review-item"><div class="k">Nhiệm vụ</div><div class="v">Cung cấp số liệu hiện trạng phục vụ tính toán quy mô</div></div></div><div class="toolbar" style="margin-top:10px"><button onclick="kh5.viewRequest(\''+req.id+'\')">Xem VB yêu cầu</button>'+(req.response?'<button onclick="kh5.viewResponse(\''+req.id+'\')">Xem VB cung cấp thông tin</button>':'')+'</div></div></div>';
  }

  function renderLeader(r) {
    if (!(owns(r,'leader') && r.receipt && r.receipt.purpose === 'SUBMIT_APPROVAL' && r.generated && r.receipt.documentId === r.generated.id)) {
      return '<div class="role-empty">LĐ Ban KT hiện không có văn bản được PM Ban KT trình ký trên hồ sơ này.</div>';
    }
    return '<div class="section"><h3>Preview ' + documentTitle(r.generated.kind) + ' cần ký</h3><div class="body"><div class="preview"><div class="paper">' + generatedHtml(r) + '</div></div></div></div>';
  }

  function renderActions() {
    const host = document.getElementById('kh5Actions');
    if (!host) return;
    const r = record();
    let html = '<button onclick="openKHPTMPAKTModule()">Danh sách</button>';
    if (viewer === 'pm' && owns(r,'pm')) {
      if (r.status === 'DONE') {
        html += '<button onclick="kh5.viewDocumentType(\'submission\')">Xem tờ trình</button>';
        html += '<button onclick="kh5.viewDocumentType(\'report\')">Xem báo cáo</button>';
      } else {
        html += '<button onclick="kh5.saveDraft()">Lưu nháp</button>';
        html += '<button onclick="kh5.viewDocumentType(\'submission\')">Xem tờ trình</button>';
        html += '<button onclick="kh5.viewDocumentType(\'report\')">Xem báo cáo</button>';
        html += '<button class="khptm-emphasis" onclick="kh5.openTransfer()">Chuyển</button>';
      }
    }
    if (viewer === 'provider' && owns(r,'provider')) {
      const req = activeRequest(r);
      if (req) html += '<button onclick="kh5.viewRequest(\''+req.id+'\')">Xem VB yêu cầu</button>';
      html += '<button onclick="kh5.openInfo(\'response\')">Tạo VB cung cấp thông tin</button>';
      if (req && req.response) html += '<button onclick="kh5.viewResponse(\''+req.id+'\')">Xem VB cung cấp thông tin</button>';
      html += '<button class="khptm-emphasis" onclick="kh5.openTransfer()">Chuyển</button>';
    }
    if (viewer === 'leader' && owns(r,'leader')) {
      if (r.generated) html += '<button onclick="kh5.viewGenerated()">Xem ' + (r.generated.kind==='report'?'báo cáo':'tờ trình') + '</button>';
      if (!r.leaderSigned) html += '<button class="khptm-danger" onclick="kh5.openReturn()">Trả lại</button><button class="khptm-emphasis" onclick="kh5.signLeader()">Ký số</button>';
      else html += '<button disabled>Đã ký</button><button class="khptm-emphasis" onclick="kh5.openTransfer()">Chuyển</button>';
    }
    host.innerHTML = html;
  }

  function setRole(role) {
    if (!ROLE_NAMES[role]) return;
    viewer = role;
    render();
  }

  function openType(type) {
    currentType = TYPES.includes(type) ? type : TYPES[0];
    record();
    showPage('kh5Process');
    document.querySelectorAll('.nav .item').forEach(x => x.classList.remove('active'));
    document.getElementById('nav-khptm')?.classList.add('active');
    render();
  }

  function renderList() {
    const tbody = document.getElementById('kh5ListRows');
    if (!tbody) return;
    tbody.innerHTML = TYPES.map((type,idx) => {
      const r = records.get(type);
      const status = r ? statusText(r) : 'Chưa tạo';
      const badge = r && r.status === 'DONE' ? 'bgreen' : r ? 'borange' : 'bgray';
      return '<tr><td class="center">'+(idx+1)+'</td><td class="center">2027</td><td>'+safe(type)+'</td><td><span class="khptm-list-title" onclick="kh5.openType(\''+type+'\')">Đề xuất lựa chọn PAKT, CN và quy mô - '+safe(type)+'</span></td><td><span class="badge '+badge+'">'+safe(status)+'</span></td><td>'+safe(r ? ROLE_NAMES[r.owner] : ROLE_NAMES.pm)+'</td><td class="center"><button class="small" onclick="kh5.openType(\''+type+'\')">'+(r?'Mở':'Tạo')+'</button></td></tr>';
    }).join('');
  }

  function render() {
    const r = record();
    const role = document.getElementById('kh5Role');
    if (role) role.value = viewer;
    document.getElementById('kh5Title').textContent = 'Đề xuất lựa chọn PAKT, CN và quy mô - ' + r.type;
    document.getElementById('kh5Crumb').textContent = 'QUẢN LÝ KHPTM > Đề xuất lựa chọn PAKT, CN và quy mô > ' + r.type;
    document.getElementById('kh5Status').textContent = statusText(r) + ' · Người xử lý: ' + ROLE_NAMES[r.owner] + (r.receipt && r.receipt.from !== 'system' ? ' · Người chuyển: ' + r.receipt.fromName : '');
    const host = document.getElementById('kh5Main');
    if (viewer === 'pm') host.innerHTML = renderPM(r);
    else if (viewer === 'provider') host.innerHTML = renderProvider(r);
    else host.innerHTML = renderLeader(r);
    renderActions();
    renderExtended();
    renderList();
  }

  function openModule() {
    showPage('kh5List');
    document.querySelectorAll('.nav .item').forEach(x => x.classList.remove('active'));
    document.getElementById('nav-khptm')?.classList.add('active');
    renderList();
  }

  function mount() {
    const shell = document.querySelector('.shell');
    if (!shell || document.getElementById('kh5List')) return;

    const style = document.createElement('style');
    style.textContent = '.kh5-form-grid{display:grid;grid-template-columns:1fr 1fr;gap:10px 12px}.kh5-field-full{grid-column:1/-1}.kh5-survey-input{color:#c62828!important;font-weight:800!important}.kh5-survey-text{color:#c62828!important;font-weight:800!important}.kh5-basis-row{display:grid;grid-template-columns:minmax(320px,1fr) auto;gap:9px;align-items:end}.kh5-output-row{display:grid;grid-template-columns:minmax(280px,420px) auto auto;gap:9px;align-items:end}.kh5-transfer-choice{display:grid;grid-template-columns:28px 220px 1fr;gap:7px;align-items:center;border-bottom:1px solid #e1e8ef;padding:10px 6px}.kh5-transfer-choice input{width:auto}.kh5-transfer-choice span{font-size:12px;color:#61778b}.kh5-doc{font-family:"Times New Roman",serif;color:#111;line-height:1.5}.kh5-doc h2,.kh5-doc h3{text-align:center}.kh5-rolebar{display:flex;align-items:center;gap:8px;background:#eef6ff;border:1px solid #bdd5e9;padding:8px 10px;margin-bottom:10px}.kh5-rolebar label{margin:0}.kh5-rolebar select{width:auto;min-width:240px}.kh5-rolebar .right-note{margin-left:auto;color:#58708a;font-size:12px}.kh5-ext-create{position:absolute;right:8px;top:-17px;z-index:3;background:#fff;color:#0766ad;border:1px solid #86a8c8;padding:6px 10px;white-space:nowrap}.kh5-form-grid .kh5-field-full textarea{min-height:86px}@media(max-width:850px){.kh5-form-grid,.kh5-basis-row,.kh5-output-row{grid-template-columns:1fr}.kh5-transfer-choice{grid-template-columns:28px 1fr}.kh5-transfer-choice span{grid-column:2}}';
    document.head.appendChild(style);

    const list = document.createElement('section');
    list.id = 'kh5List'; list.className = 'page';
    list.innerHTML = '<div class="crumb">QUẢN LÝ KHPTM &gt; Đề xuất lựa chọn PAKT, CN và quy mô</div><div class="titlebar"><h1>Đề xuất lựa chọn PAKT, CN và quy mô</h1><div class="buttons"><button class="primary" onclick="kh5.openType(\'Core di động\')">+ Tạo mới</button><button onclick="goHome()">Quay lại</button></div></div><div class="section"><h3>Danh sách hồ sơ</h3><div class="body"><table><thead><tr><th width="45">STT</th><th width="90">Năm KH</th><th width="140">Loại thiết bị</th><th>Hồ sơ</th><th width="150">Trạng thái</th><th width="190">Người xử lý</th><th width="80">Thao tác</th></tr></thead><tbody id="kh5ListRows"></tbody></table></div></div>';

    const process = document.createElement('section');
    process.id = 'kh5Process'; process.className = 'page';
    process.innerHTML = '<div id="kh5Crumb" class="crumb"></div><div class="titlebar"><h1 id="kh5Title"></h1><div id="kh5Actions" class="buttons"></div></div><div class="kh5-rolebar"><label>Vai trò test</label><select id="kh5Role" onchange="kh5.setRole(this.value)"><option value="pm">PM Ban KT</option><option value="provider">Đơn vị cung cấp thông tin</option><option value="leader">LĐ Ban KT</option></select><span id="kh5Status" class="right-note"></span></div><div id="kh5Main"></div><div id="kh5Extended"></div>';

    const infoModal = document.createElement('div');
    infoModal.id = 'kh5InfoModal'; infoModal.className = 'modal';
    infoModal.innerHTML = '<div class="modalbox" style="width:min(980px,95vw)"><div class="modalhead"><b id="kh5InfoTitle"></b><button onclick="kh5.closeInfo()" style="background:transparent;border:0;color:white;font-size:20px">×</button></div><div id="kh5InfoBody" class="modalbody"></div></div>';

    const returnModal = document.createElement('div');
    returnModal.id = 'kh5ReturnModal'; returnModal.className = 'modal';
    returnModal.innerHTML = '<div class="modalbox" style="width:min(720px,94vw)"><div class="modalhead"><b>Trả lại PM Ban KT</b><button onclick="kh5.closeReturn()" style="background:transparent;border:0;color:white;font-size:20px">×</button></div><div class="modalbody"><label>Nội dung yêu cầu chỉnh sửa</label><textarea id="kh5ReturnReason"></textarea><div class="footer-actions"><button onclick="kh5.closeReturn()">Đóng</button><button class="primary" onclick="kh5.confirmReturn()">Trả lại</button></div></div></div>';

    shell.appendChild(list);
    shell.appendChild(process);
    document.body.appendChild(infoModal);
    document.body.appendChild(returnModal);
    renderList();
  }

  window.openKHPTMPAKTModule = openModule;
  window.kh5 = {
    openType, setRole, fieldChanged, setBasis, setDocType, saveDraft, generate, viewGenerated, viewDocumentType, viewDecision,
    openInfo, infoFieldChanged, previewInfo, saveInfo, closeInfo,
    openTransfer, closeTransfer, confirmSharedTransfer, openSharedTransferPreview, signLeader, openReturn, closeReturn, confirmReturn,
    extTab, sendExchange, exchangeFileChanged, previewExchangeAttachment, previewStaged,
    viewRequest, viewResponse, addFile
  };

  mount();
}());
