/* Nội dung theo nghiệp vụ CSHT bước 5.3/5.4; không gán mã SOP của mẫu cáp quang. */
(function(root){
  'use strict';
  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const text=v=>esc(v).replace(/\n/g,'<br>');
  const date=v=>/^\d{4}-\d{2}-\d{2}$/.test(v||'')?v.split('-').reverse().join('/'):esc(v||'');
  const requestFields=[['unit','Đơn vị nhận yêu cầu'],['related','Đơn vị phối hợp (nếu có)'],['planBasis','KHPTM đã được phê duyệt','textarea'],
    ['year','Năm KHPTM','number'],['location','Phạm vi / node chính'],['content','Nội dung yêu cầu','textarea'],['deadline','Thời hạn phản hồi','date'],
    ['contact','Đầu mối Ban KT'],['phone','Số điện thoại'],['email','Email','email']];
  const supplyFields=review=>[['recipient1','Kính gửi'],['period','Năm KHPTM'],['requestReference','Văn bản yêu cầu đã nhận','textarea'],
    ['location','Phạm vi / node chính'],['content',review?'Kết quả rà soát hiện trạng':'Số liệu hiện trạng cung cấp','textarea'],
    ...(review?[['proposal','Đề xuất trang bị CSHT đáp ứng KHPTM','textarea']]:[])];
  function html(data,kind,review){
    const label=kind==='request'?(data.unit==='Đơn vị trực thuộc'?'YÊU CẦU RÀ SOÁT HIỆN TRẠNG VÀ ĐỀ XUẤT CSHT':'YÊU CẦU CUNG CẤP SỐ LIỆU HIỆN TRẠNG'):
      review?'PHẢN HỒI KẾT QUẢ RÀ SOÁT VÀ ĐỀ XUẤT CSHT':'PHẢN HỒI SỐ LIỆU HIỆN TRẠNG';
    const field=(name,fallback)=>data[name]?text(data[name]):'<span class="ph">['+esc(fallback)+']</span>';
    return '<div class="kh-info-paper"><table class="kh-info-letterhead"><tr><td><b>'+field('issuer','Đơn vị ban hành')+'</b><p>Số: '+field('number','Số văn bản')+'</p></td><td><b>CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM</b><br>Độc lập - Tự do - Hạnh phúc<p>'+field('place','Địa danh')+', '+date(data.date)+'</p></td></tr></table>'+
      '<h3 style="text-align:center">'+label+'</h3><p style="text-align:center">Phục vụ KHPTM năm '+esc(data.year||data.period)+'</p>'+
      '<p>Kính gửi: '+field(kind==='request'?'unit':'recipient1','Đơn vị nhận')+'</p>'+
      (kind==='request'?'<p>Căn cứ '+field('planBasis','KHPTM đã được phê duyệt')+'.</p>':'<p>Thực hiện yêu cầu: '+field('requestReference','Văn bản yêu cầu đã nhận')+'.</p>')+
      '<p><b>Phạm vi / node chính:</b> '+field('location','Phạm vi rà soát')+'</p><p><b>'+(kind==='request'?'Nội dung yêu cầu':review?'Kết quả rà soát hiện trạng':'Số liệu hiện trạng')+':</b></p><p>'+field('content','Nội dung')+'</p>'+
      (kind==='supply' && review?'<p><b>Đề xuất trang bị CSHT đáp ứng KHPTM:</b></p><p>'+field('proposal','Đề xuất trang bị')+'</p>':'')+
      (kind==='request'?'<p>Đề nghị đơn vị gửi kết quả, đề xuất và các hồ sơ liên quan về Ban KT trước ngày '+date(data.deadline)+'.</p><p>Đầu mối Ban KT: '+field('contact','Đầu mối')+(data.phone?' · '+text(data.phone):'')+(data.email?' · '+text(data.email):'')+'.</p>':'<p>Hồ sơ số liệu / rà soát liên quan được đính kèm cùng văn bản phản hồi để Ban KT tổng hợp, xác định quy mô.</p>')+
      '<p>Trân trọng./.</p><table class="kh-info-letterhead"><tr><td>Nơi nhận:<br>- Như trên;<br>- Lưu: '+field('archive','Nơi lưu')+'.</td><td><b>'+field('issuer','Đơn vị ban hành')+'</b><p>'+field('signer','Người đại diện')+'</p></td></tr></table></div>';
  }
  const api={requestFields,supplyFields,html};root.KHCSHTTemplate=api;if(typeof module!=='undefined'&&module.exports)module.exports=api;
}(typeof window==='undefined'?globalThis:window));
