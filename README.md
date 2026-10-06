# Gặp nhau

Ứng dụng web gọi video 1:1, gọi nhóm nhỏ và livestream nhóm nhỏ. Frontend dùng React, TypeScript, Vite; server Actix Web cung cấp WebSocket signaling cho WebRTC.

## Chạy ở môi trường phát triển

Yêu cầu Node.js 20.19+ và Rust/Cargo stable.

```sh
npm install
```

Mở hai terminal tại thư mục dự án:

```sh
cargo run
```

```sh
npm run dev
```

Mở địa chỉ Vite hiển thị trong terminal (mặc định `http://localhost:5173`). Vite chuyển tiếp `/ws` tới Actix tại `127.0.0.1:8080`.

## Chạy bản production

```sh
npm run build
cargo run
```

Actix phục vụ frontend đã build từ `dist/` tại `http://127.0.0.1:8080`.

## Giới hạn hiện tại

- Signaling được lưu trong bộ nhớ; restart server sẽ ngắt các phòng đang hoạt động.
- Các peer kết nối mesh qua WebRTC và STUN công cộng; nhóm lớn hoặc mạng hạn chế có thể cần TURN.
- Livestream hỗ trợ nhóm nhỏ. Phát tới lượng khán giả lớn cần SFU/media server.
- Không có đăng nhập, phân quyền phòng, hoặc lưu trữ lịch sử. Không đưa server demo này ra internet công cộng khi chưa bổ sung các lớp bảo vệ đó.
- Camera, micro và chia sẻ màn hình yêu cầu trình duyệt hỗ trợ WebRTC và quyền thiết bị; ngoài `localhost`, triển khai cần HTTPS.
