# Giọng nhân vật

Các MP3 được tổng hợp bằng Microsoft Edge TTS qua `edge-tts`:
- Nữ: `vi-VN-HoaiMyNeural`.
- Nam: `vi-VN-NamMinhNeural`.
- Bảy biến thể dùng cao độ và tốc độ riêng. Đây là giọng tổng hợp, không phải bản thu từ trò chơi.
- `line`: lời thoại; `normal`: “Hây!”; `special`: “Hây! Đỡ chiêu này!”. Tiếng hét là mẫu TTS, không phải diễn xuất tiếng hét thu âm.

Ứng dụng phát file tĩnh, không cần gọi dịch vụ TTS khi người dùng nghe thử.
Xem `manifest.json` để biết nội dung và thông số từng file.

Tạo lại bằng Python có cài `edge-tts==7.3.1`:

```sh
python3 scripts/generate-voices.py
```

Script cần internet; tự bỏ qua file đã tồn tại. Để tạo lại một mẫu sau khi sửa lời thoại, xóa đúng MP3 tương ứng rồi chạy lại script.
