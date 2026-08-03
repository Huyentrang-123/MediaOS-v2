# MediaOS v2 — Project Status

**Cập nhật lần cuối:** 2026-08-03  
**Repository:** `huyentrang-123/mediaos-v2`  
**Branch đang phát triển:** `claude/mediaos-viral-research-359eio`  
**Commit mới nhất:** `f096367` — feat: Deploy-ready — single server, Render config, relative API paths

---

## Tiến độ tổng quan

```
[████████████████████░░░░░░] ~50% hoàn thành
```

| Giai đoạn | Nội dung | Trạng thái |
|---|---|---|
| Frontend + UI | Kiến trúc + Module Viral Research | ✅ Hoàn thành |
| Backend Phase 1 | TikHub API + Viral Score in-memory | ✅ Hoàn thành |
| Deploy | Cấu hình Render (single server) | ✅ Sẵn sàng — chưa deploy thật |
| Giai đoạn 2 | Campaigns, Ideas Board, AI Content Writer | ⏳ Chưa bắt đầu |
| Giai đoạn 3 | Team, Guidelines & SOP | ⏳ Chưa bắt đầu |
| Backend Phase 2 | Facebook connector, DB snapshot, 7-day growth | ⏳ Chưa bắt đầu |

---

## Đã hoàn thành — toàn bộ session

### Commits trong session này (thứ tự từ cũ đến mới)

| Commit | Nội dung |
|---|---|
| `f8bc55f` | Khởi tạo kiến trúc + Module Viral Research (UI, mock data, dynamic score) |
| `142e546` | Cập nhật module list, chuyển sang AI Engine UX |
| `5badbe8` | Dynamic Viral Score Formula (min-max normalization) |
| `9392b26` | PROJECT_STATUS.md lần đầu |
| `f28d34e` | Backend MVP Phase 1 — TikHub connector, Express server, routes |
| `6154545` | Xóa DB khỏi luồng chính — Phase 1 stateless |
| `96e7778` | Đổi tên velocityScore → viewsPerHour, điều chỉnh weights |
| `e4cf3cf` | Thêm likes vào card, loading/error state, one-command startup |
| `105c006` | Xóa better-sqlite3 — tương thích Node 24 |
| `f096367` | **Deploy-ready** — single server, Render config, relative API paths |

---

## Cấu trúc hiện tại

```
mediaos-v2/                   ← root, cũng là thư mục frontend
├── index.html
├── css/
├── js/
├── modules/
│   └── viral-research/
│       ├── index.js          ← BACKEND_URL = '' (relative /api/research)
│       ├── cards.js          ← hiển thị views, likes, comments, shares
│       ├── data.js
│       ├── filters.js
│       └── viral-score.js
├── package.json              ← root: start/dev scripts + tất cả deps
├── render.yaml               ← Render deploy config
├── .gitignore
└── backend/
    ├── server.js             ← serve static từ ../, không còn CORS middleware
    ├── config.js             ← dotenv từ backend/.env, PORT từ env var
    ├── connectors/
    │   ├── tiktok.js         ← TikHub API, trả viewsPerHour
    │   └── facebook.js       ← placeholder Phase 2
    ├── routes/
    │   └── research.js
    ├── services/
    │   ├── search.js         ← fetch → score → filter → return JSON
    │   └── viral-score.js    ← scoring (shareRate 35%, commentRate 30%, views 25%, viewsPerHour 10%)
    └── .env.example
```

---

## Chi tiết Backend Phase 1

**Luồng dữ liệu:**
```
User nhập keyword
  → GET /api/research?keyword=...&platform=tiktok&region=vn
  → connectors/tiktok.js: gọi TikHub API → video thật
  → services/viral-score.js: normalize in-memory → viralScore 0–100
  → lọc viralScore >= 30, sort desc, top 30
  → frontend render card thật
```

**Scoring weights (Phase 1):**
- `shareRate` (shares/views): 35%
- `commentRate` (comments/views): 30%
- `views` (tổng): 25%
- `viewsPerHour` (views/giờ kể từ ngày đăng): 10%

**Không có:** mock fallback, database, 7-day growth, Facebook (Phase 2)

---

## Trạng thái Deploy lên Render

**Đã chuẩn bị — chưa deploy thật.** Cấu hình đã sẵn sàng:

| | |
|---|---|
| **Build Command** | `npm install` |
| **Start Command** | `npm start` |
| **Biến môi trường** | `TIKHUB_API_KEY` (thêm trong Render dashboard) |

`render.yaml` đã có trong repo — Render sẽ tự đọc khi connect repo.

**Để deploy:**
1. Render.com → New Web Service → connect `huyentrang-123/MediaOS-v2`
2. Chọn branch `claude/mediaos-viral-research-359eio`
3. Render tự đọc `render.yaml`
4. Thêm `TIKHUB_API_KEY` trong tab Environment
5. Deploy

---

## Còn dang dở

### Cần làm trước khi dùng được
- [ ] **Deploy lên Render + thêm TIKHUB_API_KEY** — app đã sẵn sàng, chỉ cần bước này
- [ ] **Kiểm tra TikHub API** với keyword thật sau khi có key — verify video trả về đủ fields

### Module Viral Research
- [ ] Tính năng "Saved videos" — hiện save vào `state` nhưng chưa có trang xem danh sách
- [ ] Facebook connector (Phase 2) — `connectors/facebook.js` là placeholder

### Giai đoạn 2 — Module NỘI DUNG (chưa bắt đầu)
- [ ] **Campaigns** (`#campaigns`)
- [ ] **Ideas Board** (`#ideas`)
- [ ] **AI Content Writer** (`#aiwriter`) — nav item có sẵn, cần build UI

### Giai đoạn 3 — Module QUẢN LÝ (chưa bắt đầu)
- [ ] **Team** (`#team`)
- [ ] **Guidelines & SOP** (`#guidelines`)

---

## Bước tiếp theo chính xác khi bắt đầu phiên mới

**Ưu tiên 1 — Để app hoạt động thật:**
1. Deploy lên Render (xem hướng dẫn ở trên)
2. Thêm `TIKHUB_API_KEY` trong Render dashboard
3. Test: mở URL Render → nhập keyword → bấm Phân tích → kiểm tra video trả về

**Ưu tiên 2 — Nếu Render đã chạy ổn:**
4. Kiểm tra `backend/.env.example` → tạo `backend/.env` cho local dev:
   ```
   TIKHUB_API_KEY=<token_từ_tikhub.io>
   ```
5. Chạy `npm run dev` local để test trước khi thay đổi code

**Ưu tiên 3 — Mở rộng tính năng:**
6. Chọn module tiếp theo: Campaigns hoặc Ideas Board (cần xác nhận ưu tiên)
7. Facebook connector Phase 2 (cần nghiên cứu thêm về data source)
