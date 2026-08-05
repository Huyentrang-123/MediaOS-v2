/* ============================================================
   MediaOS — Library Edit Form
   Opens in the shared modal. All fields are optional / blank by default.
   No data is fabricated.
   ============================================================ */

'use strict';

var REGION_OPTIONS = [
  { id: 'global', label: 'Toàn cầu' },
  { id: 'vn',     label: 'Việt Nam' },
  { id: 'kr',     label: 'Hàn Quốc' },
  { id: 'cn',     label: 'Trung Quốc / Douyin' },
  { id: 'tw',     label: 'Đài Loan' }
];
var PLATFORM_OPTIONS = ['tiktok', 'douyin', 'facebook'];

function _sel(opts, selected) {
  return opts.map(function(o) {
    var id    = typeof o === 'string' ? o : o.id;
    var label = typeof o === 'string' ? o : o.label;
    return '<option value="' + esc(id) + '"' + (id === selected ? ' selected' : '') + '>' + esc(label) + '</option>';
  }).join('');
}

function renderEditForm(video) {
  var v = video || {};
  return '<form id="libEditForm" class="lib-form">' +
    '<div class="lib-form-grid">' +

    '<div class="lib-form-group lib-form-full">' +
      '<label>URL video</label>' +
      '<input class="lib-form-input" name="url" type="url" value="' + esc(v.url || '') + '" placeholder="https://www.tiktok.com/...">' +
    '</div>' +

    '<div class="lib-form-group lib-form-full">' +
      '<label>Tiêu đề / Caption</label>' +
      '<input class="lib-form-input" name="title" type="text" value="' + esc(v.title || '') + '" placeholder="Để trống nếu chưa biết">' +
    '</div>' +

    '<div class="lib-form-group">' +
      '<label>Creator / Tác giả</label>' +
      '<input class="lib-form-input" name="creator" type="text" value="' + esc(v.creator || '') + '">' +
    '</div>' +

    '<div class="lib-form-group">' +
      '<label>Nền tảng</label>' +
      '<select class="lib-form-select" name="platform">' + _sel(PLATFORM_OPTIONS, v.platform || 'tiktok') + '</select>' +
    '</div>' +

    '<div class="lib-form-group">' +
      '<label>Thị trường</label>' +
      '<select class="lib-form-select" name="region">' + _sel(REGION_OPTIONS, v.region || 'global') + '</select>' +
    '</div>' +

    '<div class="lib-form-group">' +
      '<label>Chủ đề (phân cách bằng dấu phẩy)</label>' +
      '<input class="lib-form-input" name="topics" type="text" value="' + esc((v.topics || []).join(', ')) + '" placeholder="nám, serum, whitening">' +
    '</div>' +

    '<div class="lib-form-group">' +
      '<label>Lượt xem</label>' +
      '<input class="lib-form-input" name="views" type="number" min="0" value="' + (v.views != null ? v.views : '') + '">' +
    '</div>' +

    '<div class="lib-form-group">' +
      '<label>Lượt thích</label>' +
      '<input class="lib-form-input" name="likes" type="number" min="0" value="' + (v.likes != null ? v.likes : '') + '">' +
    '</div>' +

    '<div class="lib-form-group">' +
      '<label>Bình luận</label>' +
      '<input class="lib-form-input" name="comments" type="number" min="0" value="' + (v.comments != null ? v.comments : '') + '">' +
    '</div>' +

    '<div class="lib-form-group">' +
      '<label>Chia sẻ</label>' +
      '<input class="lib-form-input" name="shares" type="number" min="0" value="' + (v.shares != null ? v.shares : '') + '">' +
    '</div>' +

    '<div class="lib-form-group">' +
      '<label>Ngày đăng</label>' +
      '<input class="lib-form-input" name="postedAt" type="date" value="' + esc(v.postedAt ? v.postedAt.slice(0,10) : '') + '">' +
    '</div>' +

    '<div class="lib-form-group">' +
      '<label>Người thêm</label>' +
      '<input class="lib-form-input" name="addedBy" type="text" value="' + esc(v.addedBy || '') + '">' +
    '</div>' +

    '<div class="lib-form-group">' +
      '<label>Hook (mô tả phần mở đầu)</label>' +
      '<input class="lib-form-input" name="hook" type="text" value="' + esc(v.hook || '') + '">' +
    '</div>' +

    '<div class="lib-form-group">' +
      '<label>CTA (kêu gọi hành động)</label>' +
      '<input class="lib-form-input" name="cta" type="text" value="' + esc(v.cta || '') + '">' +
    '</div>' +

    '<div class="lib-form-group lib-form-full">' +
      '<label>Ghi chú nhóm</label>' +
      '<textarea class="lib-form-input" name="notes" rows="3" placeholder="Ghi chú nội bộ...">' + esc(v.notes || '') + '</textarea>' +
    '</div>' +

    '</div>' +  /* lib-form-grid */
  '</form>';
}

function collectFormData(form) {
  var data = {};
  var els = form.elements;
  for (var i = 0; i < els.length; i++) {
    var el = els[i];
    if (!el.name) continue;
    if (['views','likes','comments','shares'].indexOf(el.name) !== -1) {
      data[el.name] = el.value.trim() !== '' ? parseInt(el.value, 10) : null;
    } else if (el.name === 'topics') {
      data[el.name] = el.value.split(',').map(function(t){ return t.trim(); }).filter(Boolean);
    } else if (el.name === 'postedAt') {
      data[el.name] = el.value ? el.value + 'T00:00:00Z' : null;
    } else {
      data[el.name] = el.value.trim() || (el.type === 'text' || el.tagName === 'TEXTAREA' ? '' : el.value);
    }
  }
  return data;
}

function openEditForm(video, onSaved) {
  var isNew = !video || !video.id;
  var title = isNew ? 'Thêm video thủ công' : 'Chỉnh sửa video';

  openModal(
    title,
    renderEditForm(video),
    '<button class="btn btn-ghost" id="libFormCancel">Hủy</button>' +
    '<button class="btn btn-primary" id="libFormSave">Lưu</button>'
  );

  setTimeout(function() {
    var form       = $('#libEditForm');
    var cancelBtn  = $('#libFormCancel');
    var saveBtn    = $('#libFormSave');
    if (!form || !cancelBtn || !saveBtn) return;

    cancelBtn.addEventListener('click', closeModal);

    saveBtn.addEventListener('click', async function() {
      saveBtn.disabled    = true;
      saveBtn.textContent = '⏳ Đang lưu...';

      var data = collectFormData(form);

      try {
        var result;
        if (isNew) {
          /* Build a new library entry from form data */
          var parsed = Importer.parseUrl(data.url);
          if (!parsed && !data.title) {
            toast('URL không hợp lệ. Vui lòng kiểm tra lại.', 'error');
            saveBtn.disabled    = false;
            saveBtn.textContent = 'Lưu';
            return;
          }
          var newVideo = Object.assign({
            id:            parsed ? parsed.id : 'manual:' + Date.now(),
            platform:      parsed ? parsed.platform : data.platform,
            videoId:       parsed ? parsed.videoId  : null,
            url:           data.url || '',
            normalizedUrl: parsed ? parsed.normalizedUrl : 'manual:' + Date.now(),
            thumbnail:     '',
            addedAt:       new Date().toISOString(),
            seen:          false,
            bookmarked:    false,
            contentTags:   LibraryAnalysis.autoTag((data.title || '') + ' ' + (data.notes || '')),
            viralScore:    null,
            _source:       'manual'
          }, data);
          newVideo.viralScore = LibraryAnalysis.estimateViralScore(newVideo);
          result = await LibraryStorage.add(newVideo);
        } else {
          result = await LibraryStorage.update(video.id, data);
        }

        if (result.ok) {
          closeModal();
          toast(isNew ? 'Đã thêm video vào Library' : 'Đã lưu thay đổi', 'success');
          if (onSaved) onSaved();
        } else if (result.reason === 'duplicate') {
          toast('Video này đã có trong Library.', 'error');
        } else {
          toast('Lỗi: ' + (result.reason || 'unknown'), 'error');
        }
      } catch (e) {
        toast('Lỗi khi lưu: ' + e.message, 'error');
      } finally {
        saveBtn.disabled    = false;
        saveBtn.textContent = 'Lưu';
      }
    });
  }, 0);
}

var LibraryForm = { openEditForm: openEditForm };
