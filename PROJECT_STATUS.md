# MediaOS v2 — Project Status

**Cập nhật lần cuối:** 2026-08-01  
**Repository:** `huyentrang-123/mediaos-v2`  
**Branch đang phát triển:** `claude/mediaos-viral-research-359eio`

---

## Tiến độ tổng quan

```
[██████████████████░░░░░░░░] ~35% hoàn thành
```

| Giai đoạn | Nội dung | Trạng thái |
|---|---|---|
| Giai đoạn 1 | Kiến trúc + Module Viral Research | ✅ Hoàn thành |
| Giai đoạn 2 | Campaigns, Ideas Board, AI Content Writer | ⏳ Chưa bắt đầu |
| Giai đoạn 3 | Team, Guidelines & SOP | ⏳ Chưa bắt đầu |
| Backend | Tích hợp API dữ liệu thật | ⏳ Chưa bắt đầu |

---

## Đã hoàn thành

### Commit 1 — Khởi tạo kiến trúc + Module Viral Research (`f8bc55f`)

**Cấu trúc file:**
```
mediaos-v2/
├── index.html
├── css/
│   ├── variables.css     — Design tokens (brand colors, spacing, radius)
│   ├── base.css          — Reset + scrollbar
│   ├── layout.css        — Sidebar, topbar, main content
│   ├── components.css    — Btn, chip, badge, card, modal, toast
│   └── modules/
│       └── viral-research.css
├── js/
│   ├── utils/
│   │   ├── dom.js        — $(), $$(), esc()
│   │   ├── format.js     — formatNumber(), timeAgo(), formatDate()
│   │   └── toast.js      — toast()
│   ├── config.js         — CONFIG (platforms, regions, pageNames)
│   ├── state.js          — state + loadState/saveState
│   ├── router.js         — registerPage(), navigate()
│   └── app.js            — DOMContentLoaded, theme, sidebar, nav
└── modules/
    └── viral-research/
        ├── data.js       — VR_DATA (20 mock videos)
        ├── viral-score.js — getScoreLabel(), generateViralReason(), calculateViralScore()
        ├── filters.js    — applyFilters()
        ├── cards.js      — renderVideoCard(), attachCardHandlers()
        └── index.js      — renderResearch() và các hàm build/render
```

**Tính năng Viral Research:**
- Hiển thị 20 video mẫu (TikTok + Facebook, 4 khu vực: VN, KR, CN, TW)
- Bộ lọc: nền tảng (chips), khu vực (chips), từ khóa (search box)
- Card video: thumbnail, platform badge, viral score badge, trending badge, stats, "why viral" accordion
- Lưu video vào danh sách

---

### Commit 2 — Cập nhật module list + AI Engine UX (`142e546`)

- Xóa Trend Analysis và Knowledge Base khỏi sidebar
- Thêm AI Content Writer vào sidebar (section NỘI DUNG)
- Chuyển Viral Research từ "bộ lọc thủ công" sang "AI Viral Research Engine":
  - Thêm ô tìm kiếm từ khóa + nút "🔍 Phân tích"
  - Xóa sort select (AI tự động xếp theo viral score)
  - Header mới: "🏆 Top video đáng nghiên cứu nhất"
  - Label: "AI đã phân tích X video — hiển thị Y video đáng nghiên cứu nhất"
  - Empty state có 2 variant: chưa nhập từ khóa / không có kết quả

---

### Commit 3 — Dynamic Viral Score Formula (`5badbe8`)

Thay thế `viralScore` hardcode bằng công thức tính động:

```
viral_score = 0.40 × normalize(viewsGrowth7d)
            + 0.25 × normalize(share_rate)       ← shares / views
            + 0.20 × normalize(comment_rate)     ← comments / views
            + 0.15 × normalize(total_views)
```

- Mỗi metric được normalize 0–1 trong dataset (min-max scaling)
- Score cuối nhân 100 → thang điểm 0–100
- Xóa toàn bộ `viralScore` hardcode khỏi 20 video trong `data.js`
- `filters.js` enrich từng video với score tính động trước khi sort
- `index.js` stats bar tính topScore động

---

## Còn dang dở

### Module Viral Research
- [ ] Viral score `getScoreLabel()` threshold hiện dùng: ≥95 Bùng nổ / ≥85 Viral mạnh / ≥70 Đang trend. Cần kiểm tra phân phối thực tế với công thức mới để điều chỉnh ngưỡng nếu cần.
- [ ] Tính năng "Saved videos" — hiện save vào state nhưng chưa có trang xem danh sách đã lưu.

### Giai đoạn 2 — Module NỘI DUNG (chưa bắt đầu)
- [ ] **Campaigns** (`#campaigns`) — quản lý chiến dịch content
- [ ] **Ideas Board** (`#ideas`) — board ý tưởng nội dung
- [ ] **AI Content Writer** (`#aiwriter`) — viết nội dung hỗ trợ AI (hiện chỉ có nav item, bấm vào hiển thị "Module đang phát triển")

### Giai đoạn 3 — Module QUẢN LÝ (chưa bắt đầu)
- [ ] **Team** (`#team`) — quản lý thành viên
- [ ] **Guidelines & SOP** (`#guidelines`) — tài liệu quy trình

### Tích hợp dữ liệu thật (chưa bắt đầu)
Hiện tại toàn bộ data là mock. Ba hướng đã được nghiên cứu:

| Giai đoạn | Giải pháp | Chi phí | Timeline |
|---|---|---|---|
| MVP hiện tại | Mock data + dynamic formula | $0 | ✅ Xong |
| Phase 2 | RapidAPI TikTok Scraper + Apify Facebook + Node.js backend | $30–80/tháng | 2–4 tuần |
| Phase 3 | TikTok Research API (chính thức) + custom crawler + PostgreSQL | $100–300/tháng | 2–3 tháng |

**Lưu ý quan trọng:**
- Meta Graph API **không thể** search video public theo keyword (giới hạn từ 2018)
- Growth rate 7 ngày không lấy được từ 1 API call — cần crawl nhiều lần theo thời gian
- TikTok Research API chỉ có data US + EU, không có VN/CN/KR/TW riêng biệt

---

## Bước tiếp theo đề xuất

**Ngắn hạn (MVP):**
1. Kiểm tra ngưỡng score label (`getScoreLabel`) với distribution mới từ công thức động
2. Mở rộng mock dataset từ 20 → 40–50 video để tìm kiếm từ khóa có ý nghĩa hơn

**Trung hạn (Giai đoạn 2):**
3. Bắt đầu build module **Campaigns** hoặc **Ideas Board** — chờ xác nhận thứ tự ưu tiên
4. Quyết định kiến trúc dữ liệu thật (RapidAPI vs TikTok Research API) trước khi build backend

**Dài hạn:**
5. Deploy static site (GitHub Pages / Vercel) để team dùng thử
6. Tích hợp API thật theo hướng đã chọn
