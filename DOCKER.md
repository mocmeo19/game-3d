# Chạy ứng dụng bằng Docker

Chạy các lệnh sau từ thư mục dự án:

```sh
docker build -t clothes-app .
docker run -d --name clothes-app -p 3000:8080 clothes-app
```

Mở http://localhost:3000. Nginx trong container chạy bằng người dùng `nginx` và lắng nghe cổng `8080`.

Dockerfile build React/Vite bằng Node.js, sau đó đưa mã đã build cùng toàn bộ mô hình 3D, animation và âm thanh vào image Nginx. Thư mục `public` hiện khoảng 3,9 GB nên lần đóng gói đầu tiên sẽ tốn dung lượng và thời gian tương ứng. Các tài nguyên này được chép trực tiếp vào image chạy để tránh chép hai lần qua giai đoạn build.

Kiểm tra trạng thái và log:

```sh
docker inspect --format='{{.State.Health.Status}}' clothes-app
docker logs -f clothes-app
```

Endpoint kiểm tra hoạt động: http://localhost:3000/healthz.

Khi cập nhật mã nguồn, build lại image rồi tạo lại container:

```sh
docker build -t clothes-app .
docker stop clothes-app
docker rm clothes-app
docker run -d --name clothes-app -p 3000:8080 clothes-app
```

Nhân vật và các thiết lập được lưu trong trình duyệt theo địa chỉ truy cập. Đổi tên miền hoặc cổng sẽ dùng vùng lưu khác; container không cần volume cho dữ liệu nhân vật.
