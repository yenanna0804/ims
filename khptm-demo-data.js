/* Một nguồn dữ liệu mẫu cho KHPTM đã phê duyệt và đề xuất bước 5 liên quan. */
(function (root) {
  'use strict';
  const plans = [
    {
      id: 'KHPTM-MAU-Core-2027', type: 'Core di động', year: 2027, number: '1068', approvalDate: '2026-09-24', sourceNumber: '1240', sourceDate: '2026-09-18',
      author: 'Nguyễn Văn An', location: 'Hà Nội và TP. Hồ Chí Minh', stage: 'PREPARE', date: '2026-09-29',
      current: 'Năng lực xử lý hiện có 800.000 thuê bao; các cụm Core đang khai thác tại Hà Nội và TP. Hồ Chí Minh.',
      spares: 'Tận dụng hạ tầng phòng máy, nguồn điện, truyền dẫn và hệ thống quản lý hiện có.',
      need: 'Nhu cầu năm 2027 đạt 1.200.000 thuê bao, tăng 400.000 thuê bao so với năng lực hiện có.',
      goal: 'Mở rộng năng lực Core lên 1.200.000 thuê bao, bảo đảm dự phòng giữa hai trung tâm.',
      options: 'PA1: mở rộng nền tảng Core hiện có, tận dụng kết nối và công cụ vận hành. PA2: đầu tư nền tảng mới, cần chuyển đổi thuê bao và tích hợp lại.',
      selected: 'Mở rộng nền tảng Core hiện có bằng 02 mô-đun năng lực, mỗi mô-đun 200.000 thuê bao.',
      reason: 'Phù hợp phạm vi KHPTM đã phê duyệt; tận dụng hạ tầng và giảm công việc chuyển đổi hệ thống.',
      method: 'Số mô-đun bổ sung = (năng lực mục tiêu − năng lực hiện có) / năng lực mỗi mô-đun, làm tròn lên.',
      parameters: 'Mục tiêu: 1.200.000 thuê bao; hiện có: 800.000; năng lực mỗi mô-đun: 200.000 thuê bao.',
      result: '(1.200.000 − 800.000) / 200.000 = 02 mô-đun; năng lực sau mở rộng: 1.200.000 thuê bao.',
      rows: [{ project: 'Mở rộng Core di động năm 2027', device: 'Mô-đun năng lực Core', location: 'Hà Nội: 01; TP. Hồ Chí Minh: 01', unit: 'Mô-đun', existing: '800.000 thuê bao', required: '1.200.000 thuê bao', quantity: '2', capacity: '200.000 thuê bao/mô-đun', price: '3500000000', schedule: 'Quý II/2027', note: 'Tổng khái toán mẫu: 7.000.000.000 VNĐ' }]
    },
    {
      id: 'KHPTM-MAU-Vo_tuyen-2027', type: 'Vô tuyến', year: 2027, number: '1072', approvalDate: '2026-09-25', sourceNumber: '1244', sourceDate: '2026-09-18',
      author: 'Trần Thị Bình', location: 'Hà Nội, Bắc Ninh và Hải Phòng', stage: 'REVIEW', date: '2026-09-30',
      current: 'Khu vực khảo sát có 120 trạm đang khai thác; còn 30 vị trí cần bổ sung theo kế hoạch phủ sóng.',
      spares: 'Tận dụng vị trí trạm và truyền dẫn hiện có tại các điểm đủ điều kiện; kiểm tra nguồn và anten trước khi triển khai.',
      need: 'Nhu cầu quy hoạch năm 2027 là 150 trạm, ưu tiên các khu vực có tải cao và thiếu vùng phủ.',
      goal: 'Bổ sung 30 trạm vô tuyến, nâng tổng quy mô khu vực lên 150 trạm.',
      options: 'PA1: bổ sung thiết bị tương thích mạng đang khai thác. PA2: thay thế toàn bộ thiết bị trong khu vực. So sánh phạm vi tích hợp, tiến độ và chi phí.',
      selected: 'Bổ sung 30 bộ thiết bị trạm vô tuyến tương thích mạng hiện có; cấu hình chi tiết theo kết quả khảo sát vị trí.',
      reason: 'Đáp ứng danh sách vị trí trong KHPTM đã phê duyệt và tận dụng tài nguyên hiện hữu.',
      method: 'Số trạm bổ sung = số trạm theo quy hoạch − số trạm hiện có; phân bổ theo danh sách vị trí khảo sát.',
      parameters: 'Hiện có: 120 trạm; nhu cầu: 150 trạm. Phân bổ mẫu: Hà Nội 12, Bắc Ninh 8, Hải Phòng 10.',
      result: '150 − 120 = 30 trạm; 12 + 8 + 10 = 30 bộ thiết bị cần trang bị.',
      rows: [
        { location: 'Hà Nội', quantity: '12' }, { location: 'Bắc Ninh', quantity: '8' }, { location: 'Hải Phòng', quantity: '10' }
      ].map(row => ({ project: 'Phát triển mạng vô tuyến năm 2027', device: 'Bộ thiết bị trạm vô tuyến', unit: 'Bộ', existing: '120 trạm toàn khu vực', required: '150 trạm toàn khu vực', capacity: '01 bộ/vị trí trạm', price: '650000000', schedule: 'Quý II–III/2027', note: 'Vị trí cụ thể xác nhận sau khảo sát', ...row }))
    },
    {
      id: 'KHPTM-MAU-BRCD-2027', type: 'BRCĐ', year: 2027, number: '1080', approvalDate: '2026-09-28', sourceNumber: '1250', sourceDate: '2026-09-21',
      author: 'Lê Văn Cường', location: 'Hà Nội và Hải Phòng', stage: 'ISSUE', date: '2026-09-30',
      current: 'Các cụm OLT trong phạm vi triển khai có 400 cổng PON; còn khe cắm để mở rộng.',
      spares: 'Tận dụng chassis OLT, nguồn và uplink hiện có sau khi kiểm tra tải và dự phòng.',
      need: 'Nhu cầu năm 2027 là 560 cổng PON, cần bổ sung 160 cổng.',
      goal: 'Mở rộng mạng băng rộng cố định lên 560 cổng PON trong phạm vi kế hoạch.',
      options: 'PA1: bổ sung bo mạch PON trên OLT hiện có. PA2: đầu tư OLT mới; phát sinh thêm nguồn, uplink và không gian lắp đặt.',
      selected: 'Bổ sung 10 bo mạch PON, mỗi bo 16 cổng, tương thích các OLT hiện có.',
      reason: 'Quy mô phù hợp KHPTM đã phê duyệt; các OLT hiện hữu còn khả năng mở rộng.',
      method: 'Số bo mạch = (số cổng cần có − số cổng hiện có) / 16, làm tròn lên; kiểm tra số khe cắm khả dụng.',
      parameters: 'Hiện có: 400 cổng; nhu cầu: 560 cổng; 16 cổng/bo. Phân bổ: Hà Nội 6 bo, Hải Phòng 4 bo.',
      result: '(560 − 400) / 16 = 10 bo; 10 × 16 = 160 cổng bổ sung; tổng sau mở rộng: 560 cổng.',
      rows: [{ location: 'Hà Nội', quantity: '6' }, { location: 'Hải Phòng', quantity: '4' }].map(row => ({ project: 'Mở rộng BRCĐ năm 2027', device: 'Bo mạch PON 16 cổng', unit: 'Bo', existing: '400 cổng toàn khu vực', required: '560 cổng toàn khu vực', capacity: '16 cổng PON/bo', price: '180000000', schedule: 'Quý II/2027', note: 'Kiểm tra tương thích và khe cắm trước khi trang bị', ...row }))
    },
    {
      id:'KHPTM-MAU-CSHT-2027', type:'CSHT', year:2027, number:'1086', approvalDate:'2026-09-29', sourceNumber:'1256', sourceDate:'2026-09-22',
      author:'Phạm Minh Hạ', location:'Node chính Hà Nội và TP. Hồ Chí Minh', stage:'PREPARE', date:'2026-09-30',
      current:'Rà soát nguồn điện, điều hòa và không gian lắp đặt tại các node chính.',
      goal:'Bảo đảm CSHT tại các node chính đáp ứng KHPTM năm 2027.',
      need:'Các đơn vị trực thuộc rà soát hiện trạng và đề xuất trang bị CSHT theo nhu cầu phát triển mạng.',
      rows:[
        {project:'Trang bị CSHT node chính năm 2027',device:'Hệ thống nguồn điện dự phòng',location:'Node Hà Nội',unit:'Hệ thống',quantity:'1',capacity:'Cần khảo sát',price:'',schedule:'Năm 2027',note:'Dữ liệu mẫu, chờ kết quả rà soát đơn vị'},
        {project:'Trang bị CSHT node chính năm 2027',device:'Hệ thống điều hòa phòng máy',location:'Node TP. Hồ Chí Minh',unit:'Hệ thống',quantity:'1',capacity:'Cần khảo sát',price:'',schedule:'Năm 2027',note:'Dữ liệu mẫu, chờ kết quả rà soát đơn vị'}
      ]
    }
  ];
  root.KHPTMDemoData = { plans };
  if (typeof module !== 'undefined' && module.exports) module.exports = root.KHPTMDemoData;
}(typeof window === 'undefined' ? globalThis : window));

