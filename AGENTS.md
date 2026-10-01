# Nguyên tắc thiết kế OnePMS

Đọc logic xử lý và pattern màn hình hiện có trước khi bổ sung chức năng. Chỉ sửa các màn và điểm nối trong phạm vi yêu cầu. Không thiết kế lại font, style, màn nhập, popup Chuyển hoặc Thông tin mở rộng khi chưa được yêu cầu.

## Quyền phải dựa vào nguồn chuyển và nhiệm vụ

Một vai trò có thể nhận hồ sơ để phân công, thực hiện nghiệp vụ, ký chính thức, ký nháy hoặc trình văn bản đã ký. Không xác định quyền chỉ từ tên vai trò, người đang xem hoặc việc đổi “Vai trò test”.

- Lưu người gửi, người nhận, mục đích chuyển, nội dung xử lý, thời gian và tài liệu/phiên bản được chuyển.
- Từ phiếu chuyển hiện tại và người được giao xử lý, xác định trạng thái, quyền sửa/ký, văn bản preview và người nhận trong popup.
- Dùng cùng quy tắc nghiệp vụ cho nút trên màn, popup và xử lý khi xác nhận. Không chỉ ẩn nút rồi để handler vẫn cho phép thao tác.
- Hiển thị người chuyển trước đó và nhiệm vụ hiện tại. Giữ chuỗi chỉ đạo, trao đổi, tài liệu trong cùng hồ sơ.
- Người xem/được gửi để biết không có quyền xử lý chính. Chọn vai trò test không tự cấp nhiệm vụ.
- Báo cáo đã có chữ ký hợp lệ không yêu cầu ký lại khi chuyển qua người trình. Chỉ đặt lại quyền/chữ ký khi nội dung hoặc phiên bản được sửa.
- Phân biệt chữ ký chính thức với ký nháy bằng trạng thái và nội dung hiển thị riêng.

## Pattern dùng chung

Giữ cùng chức năng/danh sách/hồ sơ khi thêm bước xử lý. Màn lãnh đạo và văn thư dùng khung preview văn bản, rồi Thông tin mở rộng. Lãnh đạo ghi/phê ý kiến tại phần trao đổi; không nhập nhiều field nghiệp vụ.

**Văn thư TCT** là một actor duy nhất (`tctClerk`), dùng cho văn bản TCT trình TĐ, điều phối rà soát và NET ghi nhận ban hành kết quả TĐ. Không tạo actor Văn thư điều phối/NET riêng. **Văn thư Tập đoàn** là actor riêng. Cùng người nhận TCT nhưng quyền, preview, metadata và nơi chuyển phải theo hồ sơ/nhiệm vụ được chuyển đến: văn bản TCT đã ký mới ban hành văn bản TCT; rà soát chỉ điều phối; NET chỉ ghi nhận quyết định TĐ đã ký/ban hành ngoài hệ thống, không ký lại và không chuyển cho chính mình. Giữ giá trị vai trò legacy trong các handler cũ; chỉ đổi tên hiển thị thành Văn thư TCT. Giữ popup File chuyển đi / Thông tin nhận / Thông tin ý kiến và bảng Thông tin mở rộng theo pattern hiện tại. Chỉ thay dummy đúng ngữ cảnh hoặc bổ sung tài liệu thực tế của bước mới.

## Rà soát KHPTM đã chốt (01/10/2026)

LĐ TCT chuyển Văn thư TCT không tự khởi tạo nhánh rà soát. Văn thư chọn LĐ ĐV rà soát khi cần rà soát; hoặc ban hành văn bản TCT đã ký rồi chuyển Văn thư Tập đoàn/LĐ Tập đoàn theo luồng trình TĐ cũ. Popup có đủ các hướng, nhưng chọn TĐ trước khi ký/ban hành phải bị chặn tại handler. Khi văn bản đã ban hành và chuyển TĐ, không phát hành/chuyển trùng. Giữ riêng việc ghi nhận QĐ TĐ trên nhánh NET.

Áp dụng cho Core di động, Vô tuyến, BRCĐ và CSHT:

| Người nhận và nguồn chuyển | Nhiệm vụ / quyền | Hướng chuyển |
| --- | --- | --- |
| LĐ rà soát chủ trì nhận từ Văn thư (hoặc yêu cầu rà soát trực tiếp của LĐ TCT) | Phân công; chỉ có Chuyển, chưa xem/ký báo cáo | PM rà soát chủ trì |
| LĐ rà soát phối hợp nhận từ Văn thư | Phân công; chỉ có Chuyển, chưa xem/ký báo cáo | PM rà soát phối hợp |
| PM rà soát chủ trì | Chỉ xem hồ sơ trình, ghi ý kiến ở Thông tin mở rộng; tổng hợp/lập báo cáo | PM lập hồ sơ để sửa; PM rà soát phối hợp; LĐ rà soát chủ trì để ký báo cáo đã hoàn thiện |
| PM rà soát phối hợp nhận nhiệm vụ từ PM chủ trì hoặc LĐ phối hợp | Chỉ xem và ghi ý kiến; gửi kết quả phối hợp | PM rà soát chủ trì |
| LĐ rà soát chủ trì nhận báo cáo từ PM chủ trì | Xem và ký chính thức báo cáo | LĐ TCT hoặc LĐ phối hợp để ký nháy |
| LĐ rà soát phối hợp nhận báo cáo đã ký từ LĐ chủ trì | Xem và ký nháy báo cáo | LĐ TCT hoặc trả LĐ chủ trì để trình |
| LĐ rà soát chủ trì nhận lại báo cáo đã ký nháy từ LĐ phối hợp | Xem báo cáo đã ký; không ký lại, không phân công lại | LĐ TCT |

Không có lớp dữ liệu nghiệp vụ “Thông tin rà soát” được sửa. Ý kiến rà soát chỉ nhập trong Thông tin mở rộng; nội dung báo cáo tổng hợp từ ý kiến hoặc upload báo cáo.

Nếu hồ sơ trình chưa đạt: trả PM lập sửa, rồi PM → LĐ Ban/đơn vị → LĐ TCT theo vòng trình ban đầu. Không chuyển PM lập thẳng về PM rà soát.

Nếu lãnh đạo không đồng ý báo cáo: trả PM rà soát chủ trì sửa **báo cáo**, không trả PM lập sửa **hồ sơ trình**.

Ký nháy là nhánh có thể chọn; LĐ chủ trì ký chính thức có thể trình thẳng LĐ TCT. Khi đã chọn gửi ký nháy, người nhận phải ký nháy trước khi trình hoặc trả LĐ chủ trì.

## Tài liệu và kiểm tra

Đối chiếu “Gỡ băng buổi 1”, “gỡ băng buổi 2” và các quy trình/biểu mẫu khi làm nghiệp vụ mới; ưu tiên các nội dung khách hàng đã chốt trực tiếp trong phiên làm việc.

Luồng thẩm định có quyền sửa theo nhiệm vụ, khác với rà soát chỉ xem. Không tự áp quy tắc rà soát cho thẩm định nếu chưa được chốt. NET ghi nhận văn bản TĐ đã ký/ban hành ngoài OnePMS không trình ký lại; PDF scan giữ nguyên byte khi nhập metadata ban hành.

Kiểm tra model bằng `node --test tests/khptm-workflow.test.cjs`. Kiểm tra màn thực tế cho các trường hợp cùng actor nhưng khác nguồn chuyển, các nhánh trả lại và trạng thái tài liệu, đồng thời bảo đảm các luồng ngoài phạm vi vẫn hoạt động.
