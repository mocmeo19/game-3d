# Quy tắc dành cho coding agent

Tài liệu này áp dụng cho toàn bộ repository. Coding agent phải đọc và tuân thủ trước khi thay đổi mã nguồn. Chỉ dẫn trực
tiếp của người dùng được ưu tiên khi có xung đột với tài liệu này.

## Stack bắt buộc

- Sử dụng **TypeScript**, **Vite**, **React** và **Tailwind CSS 4**.
- Viết component React bằng function component và hooks; dùng `.tsx` cho giao diện, `.ts` cho logic.
- Giữ TypeScript ở chế độ strict. Ưu tiên kiểu dữ liệu rõ ràng; tránh `any`, ép kiểu tùy tiện và bỏ qua lỗi kiểu dữ
  liệu.
- Dùng Vite cho quá trình phát triển và build. Không thêm framework hoặc bundler khác nếu chưa có yêu cầu.
- Sử dụng Tailwind CSS 4 cho giao diện; ưu tiên cấu hình CSS và tích hợp Vite phù hợp với phiên bản 4.
- Không đưa cú pháp hoặc plugin chỉ dành cho Tailwind CSS 3 vào mã mới. Nếu gặp cấu hình cũ, xử lý việc tương thích khi
  thực hiện tác vụ liên quan; không tự mở rộng thành đợt nâng cấp toàn dự án.
- Ưu tiên thư viện đã có. Chỉ thêm dependency khi có nhu cầu cụ thể và lợi ích rõ ràng so với chi phí tải, thực thi và
  bảo trì.

## Giới hạn file và thiết kế theo component

- **Không tạo hoặc mở rộng file mã nguồn vượt quá 1000 dòng**, tính cả dòng trống và comment. Chủ động tách file trước
  khi chạm giới hạn; không nén nhiều câu lệnh lên một dòng để lách quy tắc.
- Nếu file hiện có đã vượt 1000 dòng, tách phần trách nhiệm liên quan đến tác vụ thành module hoặc component riêng trước
  khi bổ sung chức năng. Không tự thực hiện một đợt chia nhỏ toàn repository ngoài phạm vi yêu cầu.
- Ưu tiên thiết kế giao diện bằng các component có trách nhiệm rõ ràng, có thể kết hợp và tái sử dụng.
- **Mỗi file `.tsx` chỉ định nghĩa một React function component.** Component con có JSX riêng phải đặt trong file riêng,
  kể cả khi chỉ được sử dụng bởi một màn hình.
- Không khai báo component bên trong component khác; tránh tạo lại kiểu component sau mỗi lần render và làm mất state
  ngoài ý muốn.
- Tách component khi một phần giao diện có trách nhiệm, hành vi, vòng đời hoặc nhu cầu tái sử dụng riêng. Không tách
  thành hàng loạt component chỉ bọc một thẻ HTML mà không tạo giá trị.
- Component màn hình chủ yếu kết hợp component con và điều phối dữ liệu. Không nhồi xử lý nghiệp vụ, truy cập storage,
  tải tài nguyên và thuật toán render 3D vào cùng một component giao diện.
- Tách logic React có state hoặc vòng đời thành custom hook phù hợp; đặt logic thuần, kiểu dữ liệu và truy cập dữ liệu
  trong module `.ts` theo chức năng.
- Nhóm file theo tính năng. Chỉ đưa component vào thư mục dùng chung khi có trách nhiệm và API phù hợp với nhiều nơi sử
  dụng.
- Quy tắc 1000 dòng áp dụng cho mã viết tay. Mã sinh tự động và lockfile được quản lý qua công cụ sinh tương ứng; không
  sửa tay hoặc chia nhỏ chúng để đáp ứng giới hạn.

## Nguyên tắc clean code

### Trách nhiệm và cấu trúc

- Mỗi module, component và function có một trách nhiệm chính, giải thích được bằng một câu cụ thể. Tách khi có nhiều lý
  do độc lập để thay đổi.
- Giữ function tập trung vào một mức trừu tượng; không trộn thao tác giao diện, xử lý nghiệp vụ và chi tiết lưu trữ
  trong cùng một luồng dài.
- Ưu tiên composition thay vì kế thừa sâu. Áp dụng SOLID khi giúp làm rõ trách nhiệm và phụ thuộc, không tạo thêm tầng
  chỉ để đủ mẫu thiết kế.
- Giữ hướng phụ thuộc rõ ràng: giao diện gọi logic nghiệp vụ; logic thuần không phụ thuộc React hoặc DOM nếu không cần.
  Không tạo import vòng.
- API và props phải biểu đạt ý định rõ ràng. Dùng discriminated union cho các chế độ loại trừ nhau; tránh nhiều cờ
  boolean tạo ra trạng thái mâu thuẫn.
- Chỉ trừu tượng hóa khi đã có nhu cầu cụ thể. Ưu tiên giải pháp đơn giản đáp ứng yêu cầu hiện tại; không xây framework,
  hệ plugin hoặc cấu hình tổng quát cho tình huống giả định.

### Tên gọi và khả năng đọc

- Đặt tên theo ý nghĩa nghiệp vụ và đơn vị sử dụng, ví dụ `reloadDurationMs`, `isMuted`, `selectedGameId`. Không dùng
  tên mơ hồ như `data`, `temp`, `handleThing` khi có thể đặt tên cụ thể.
- Function thực hiện hành động dùng động từ; boolean dùng tên thể hiện điều kiện như `is`, `has`, `can` hoặc `should`.
  Giữ thuật ngữ nhất quán xuyên suốt tính năng.
- Ưu tiên guard clause và return sớm để giảm lồng nhau. Thay chuỗi ternary phức tạp hoặc JSX có nhiều nhánh bằng logic
  hoặc component được đặt tên rõ ràng.
- Đưa giá trị có ý nghĩa nghiệp vụ vào hằng số có tên và đơn vị; không rải magic number hoặc chuỗi điều khiển ở nhiều
  nơi.
- **Không lạm dụng comment.** Ưu tiên tên rõ nghĩa và cấu trúc dễ đọc để mã tự thể hiện ý định.
- Chỉ comment khi cần giải thích lý do, ràng buộc hoặc đánh đổi mà mã chưa thể hiện được.
  Không mô tả lại từng câu lệnh, chú thích những phần hiển nhiên hoặc giữ mã đã bỏ bằng comment.
- Khi sửa mã, cập nhật hoặc xóa comment không còn chính xác; không dùng comment để bù cho thiết kế khó hiểu.
- Xóa import, biến, nhánh và mã chết do thay đổi của mình tạo ra. Không để lại log debug hoặc TODO mơ hồ không có ngữ
  cảnh.

### Dữ liệu, state và side effect

- Giữ một nguồn dữ liệu chính cho mỗi trạng thái. Giá trị tính được từ props hoặc state hiện có phải được suy ra, không
  lưu thêm bản sao dễ lệch.
- Không sửa trực tiếp props, React state hoặc đối tượng dùng chung. Dùng cập nhật bất biến và functional state update
  khi phụ thuộc giá trị trước đó.
- Dùng `useEffect` để đồng bộ với hệ thống bên ngoài; xử lý hành động người dùng trong event handler thay vì nối nhiều
  effect để điều khiển luồng nghiệp vụ.
- Khai báo dependency của hook đầy đủ. Không tắt quy tắc hook để che lỗi thiết kế hoặc stale closure.
- Làm rõ nơi tạo, nơi sở hữu và nơi hủy tài nguyên. Side effect phải có cách cleanup phù hợp với vòng đời sử dụng.
- Với bất đồng bộ, xử lý yêu cầu lỗi thời, component đã bị hủy và thao tác lặp. Dùng hủy yêu cầu hoặc kiểm tra phiên yêu
  cầu khi có nguy cơ ghi đè kết quả mới.
- Kiểm tra dữ liệu tại ranh giới hệ thống như file nhập, API và storage. Dùng `unknown` và kiểm tra thực tế thay vì ép
  kiểu để coi dữ liệu ngoài là hợp lệ.

### Xử lý lỗi và độ tin cậy

- Xử lý lỗi ở nơi có đủ ngữ cảnh để phục hồi hoặc thông báo cho người dùng. Không nuốt lỗi âm thầm nếu việc đó làm người
  dùng tưởng thao tác đã thành công.
- Chỉ báo thành công sau khi thao tác lưu, tải hoặc cập nhật thực sự hoàn tất. Trạng thái loading và lỗi phải phản ánh
  đúng kết quả.
- Khi có fallback, nêu rõ lý do trong mã và bảo đảm fallback không che lỗi dữ liệu hoặc làm mất dữ liệu người dùng.
- Ưu tiên function thuần cho quy tắc nghiệp vụ để dễ đọc, tái sử dụng và kiểm tra. Tách tính toán khỏi I/O khi ranh giới
  này giúp giảm độ phức tạp.
- Không đổi tính đúng đắn hoặc khả năng bảo trì để lấy tối ưu chưa có bằng chứng. Khi cần tối ưu đoạn mã phức tạp, giữ
  phạm vi nhỏ và ghi rõ lý do.

## Ưu tiên hiệu năng

Hiệu năng là tiêu chí thiết kế ngay từ đầu, đặc biệt với render 3D, animation và tài nguyên lớn. Tối ưu phải giữ đúng
hành vi người dùng yêu cầu.

### React và giao diện

- Giữ state gần nơi sử dụng và giới hạn phạm vi cập nhật để tránh render lại toàn bộ giao diện.
- Không cập nhật React state theo từng frame. Dùng ref hoặc engine cho trạng thái thay đổi liên tục; chỉ đồng bộ dữ liệu
  cần hiển thị với tần suất phù hợp.
- Không chạy phép tính nặng, đọc storage hoặc tạo tài nguyên lớn trong mỗi lần render.
- Chỉ dùng `memo`, `useMemo` và `useCallback` khi giúp giảm chi phí thực tế; không thêm hàng loạt theo thói quen.
- Debounce hoặc throttle thao tác tốn chi phí như lưu dữ liệu, resize, tìm kiếm và đồng bộ trạng thái.
- Với danh sách lớn, dùng phân trang hoặc virtualization khi cần; ảnh ngoài màn hình phải tải lười.
- Giữ thao tác cuộn, chọn trang phục, đổi dáng và chuyển màn hình phản hồi nhanh.

### Render 3D, animation và âm thanh

- Dùng `requestAnimationFrame` cho vòng lặp render; dừng hoặc giảm công việc khi màn hình không hoạt động hoặc tab bị
  ẩn.
- Tái sử dụng geometry, material, texture, vector và bộ đệm; tránh cấp phát đối tượng mới trong vòng lặp theo frame.
- Dùng batching, instancing và giới hạn chất lượng phù hợp khi số lượng vật thể hoặc tải GPU tăng.
- Giới hạn pixel ratio và các hiệu ứng đắt như shadow, ánh sáng động, post-processing theo nhu cầu hiển thị.
- Dọn tài nguyên khi đổi màn hình hoặc hủy engine: listener, timer, animation frame, audio node, geometry, material và
  texture thuộc quyền sở hữu của component/engine.
- Không giải phóng tài nguyên dùng chung khi nơi khác vẫn đang sử dụng.
- Tải mô hình và animation theo nhu cầu; tránh tải toàn bộ kho tài nguyên khi khởi động.
- Không tạo nhiều `AudioContext` hoặc vòng lặp âm thanh trùng nhau cho cùng một chức năng.

### Tải tài nguyên và build

- Lazy-load màn hình game và module nặng; giữ phần mã khởi động nhỏ.
- Cache tài nguyên đã tải, tái sử dụng yêu cầu đang chạy và xử lý trường hợp component bị hủy trước khi tải xong.
- Ưu tiên kích thước ảnh, texture và mô hình phù hợp với nhu cầu hiển thị; tránh đưa dữ liệu nguồn không cần thiết vào
  bundle hoặc image chạy.
- Không nhúng tệp lớn vào JavaScript dưới dạng base64 khi có thể tải riêng.
- Khi sửa cách build hoặc cache, bảo đảm mô hình, animation, âm thanh và manifest vẫn được phục vụ đúng đường dẫn và
  được cập nhật đúng lúc.

## Cách thực hiện thay đổi

- Đọc mã và cấu hình liên quan trước khi chỉnh sửa; ưu tiên sửa nguyên nhân của vấn đề.
- Giữ thay đổi tập trung vào yêu cầu. Không refactor rộng, đổi stack hoặc nâng cấp dependency ngoài phạm vi công việc.
- Tái sử dụng component và logic dùng chung để các màn hình có cùng hành vi và giao diện.
- Bảo đảm giao diện có nhãn rõ ràng, hỗ trợ bàn phím và hoạt động với kích thước màn hình phù hợp.
- Không ghi đè hoặc xóa dữ liệu, tài nguyên và thay đổi khác của người dùng.
- Không đưa khóa bí mật, thông tin xác thực hoặc dữ liệu riêng vào mã nguồn, log hay tài nguyên công khai.

## Kiểm tra và báo cáo

- Với thay đổi mã nguồn hoặc cấu hình build, chạy `npm run build` khi môi trường cho phép và xử lý lỗi phát sinh từ thay
  đổi của mình.
- Chọn kiểm tra phù hợp với rủi ro và phạm vi thay đổi; tránh thêm kiểm tra chỉ lặp lại chi tiết triển khai.
- Với thay đổi tối ưu hiệu năng, nêu điểm nghẽn và bằng chứng phù hợp như số lần render, thời gian frame, thời gian tải,
  dung lượng bundle hoặc bộ nhớ. Không khẳng định cải thiện nếu chưa đo.
- Khi bàn giao, tóm tắt phần đã thay đổi, cách kiểm tra và giới hạn còn tồn tại. Nói rõ nếu không thể build, chạy thử
  hoặc đo hiệu năng.
