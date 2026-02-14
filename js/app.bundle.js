// ===== file.tools — Main Application Logic =====

(function () {
  'use strict';

  // ===== ROUTER =====
  const views = document.querySelectorAll('.view');

  function navigateTo(hash) {
    const viewId = hash ? hash.replace('#', '') + '-view' : 'home-view';
    views.forEach(v => v.classList.remove('active'));
    const target = document.getElementById(viewId) || document.getElementById('home-view');
    target.classList.add('active');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  window.addEventListener('hashchange', () => navigateTo(location.hash));
  navigateTo(location.hash);

  // Smooth scroll for nav links
  document.querySelectorAll('[data-scroll]').forEach(link => {
    link.addEventListener('click', (e) => {
      e.preventDefault();
      location.hash = '';
      navigateTo('');
      setTimeout(() => {
        const el = document.getElementById(link.dataset.scroll);
        if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 100);
    });
  });

  // ===== THEME TOGGLE =====
  const themeToggle = document.getElementById('theme-toggle');
  const html = document.documentElement;

  // Apply saved theme or detect system preference
  function applyTheme(theme) {
    html.setAttribute('data-theme', theme);
  }

  const savedTheme = localStorage.getItem('edit-it-theme');
  if (savedTheme) {
    applyTheme(savedTheme);
  } else if (window.matchMedia('(prefers-color-scheme: dark)').matches) {
    applyTheme('dark');
  } else {
    applyTheme('light');
  }

  // Listen for system theme changes
  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (e) => {
    if (!localStorage.getItem('edit-it-theme')) {
      applyTheme(e.matches ? 'dark' : 'light');
    }
  });

  themeToggle.addEventListener('click', () => {
    const current = html.getAttribute('data-theme');
    const next = current === 'dark' ? 'light' : 'dark';
    applyTheme(next);
    localStorage.setItem('edit-it-theme', next);
  });

  // ===== DRAG & DROP ZONES =====
  document.querySelectorAll('.drop-zone').forEach(zone => {
    const inputId = zone.querySelector('input[type="file"]')?.id;
    if (!inputId) return;
    const input = document.getElementById(inputId);

    ['dragenter', 'dragover'].forEach(evt => {
      zone.addEventListener(evt, (e) => {
        e.preventDefault();
        e.stopPropagation();
        zone.classList.add('drag-over');
      });
    });

    ['dragleave', 'drop'].forEach(evt => {
      zone.addEventListener(evt, (e) => {
        e.preventDefault();
        e.stopPropagation();
        zone.classList.remove('drag-over');
      });
    });

    zone.addEventListener('drop', (e) => {
      const files = e.dataTransfer.files;
      if (files.length) {
        handleFilesForZone(zone, files);
      }
    });

    zone.addEventListener('click', (e) => {
      if (e.target.tagName !== 'LABEL' && e.target.tagName !== 'INPUT') {
        input.click();
      }
    });

    input.addEventListener('change', () => {
      if (input.files.length) {
        handleFilesForZone(zone, input.files);
        input.value = '';
      }
    });
  });

  function handleFilesForZone(zone, files) {
    const toolView = zone.closest('.tool-view');
    if (!toolView) return;
    const toolId = toolView.id.replace('-view', '');
    const event = new CustomEvent('files-added', { detail: { files: Array.from(files), toolId } });
    document.dispatchEvent(event);
  }

  // ===== SORTABLE FILE LIST =====
  window.EditIt = window.EditIt || {};

  EditIt.initSortable = function (listEl) {
    let dragItem = null;
    let dragIndex = -1;

    listEl.addEventListener('dragstart', (e) => {
      dragItem = e.target.closest('.file-item');
      if (!dragItem) return;
      dragIndex = [...listEl.children].indexOf(dragItem);
      dragItem.classList.add('dragging');
      e.dataTransfer.effectAllowed = 'move';
    });

    listEl.addEventListener('dragover', (e) => {
      e.preventDefault();
      const afterElement = getDragAfterElement(listEl, e.clientY);
      if (afterElement) {
        listEl.insertBefore(dragItem, afterElement);
      } else {
        listEl.appendChild(dragItem);
      }
    });

    listEl.addEventListener('dragend', () => {
      if (dragItem) dragItem.classList.remove('dragging');
      dragItem = null;
    });

    function getDragAfterElement(container, y) {
      const elements = [...container.querySelectorAll('.file-item:not(.dragging)')];
      return elements.reduce((closest, child) => {
        const box = child.getBoundingClientRect();
        const offset = y - box.top - box.height / 2;
        if (offset < 0 && offset > closest.offset) {
          return { offset, element: child };
        }
        return closest;
      }, { offset: Number.NEGATIVE_INFINITY }).element;
    }
  };

  // ===== UTILITY FUNCTIONS =====
  EditIt.formatFileSize = function (bytes) {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

  EditIt.getFileExtension = function (filename) {
    return filename.split('.').pop().toLowerCase();
  };

  EditIt.getFileIcon = function (file) {
    const ext = EditIt.getFileExtension(file.name);
    if (ext === 'pdf') return 'PDF';
    if (['jpg', 'jpeg'].includes(ext)) return 'JPG';
    if (ext === 'png') return 'PNG';
    if (ext === 'webp') return 'WEBP';
    if (ext === 'bmp') return 'BMP';
    if (ext === 'gif') return 'GIF';
    return 'FILE';
  };

  EditIt.createFileItem = function (file, index, options = {}) {
    const div = document.createElement('div');
    div.className = 'file-item';
    div.dataset.index = index;
    if (options.sortable) div.draggable = true;

    let dragHandle = '';
    if (options.sortable) {
      dragHandle = '<span class="file-item-drag">⠿</span>';
    }

    div.innerHTML = `
      ${dragHandle}
      <div class="file-item-icon">${EditIt.getFileIcon(file)}</div>
      <div class="file-item-info">
        <div class="file-item-name">${file.name}</div>
        <div class="file-item-meta">${EditIt.formatFileSize(file.size)}${options.meta ? ' • ' + options.meta : ''}</div>
      </div>
      <button class="file-item-remove" title="Remove">&times;</button>
    `;

    // Auto-generate thumbnail for image files (including exotic formats)
    const isImage = file.type.startsWith('image/') || file.name.match(/\.(heic|heif|dng|tiff?|avif|cr2|nef|arw|ico|tga)$/i);
    if (isImage) {
      EditIt.normalizeImageFile(file).then(normalized => {
        if (normalized) return EditIt.readFileAsDataURL(normalized);
      }).then(url => {
        if (url) EditIt.setFileItemThumb(div, url);
      }).catch(() => {});
    }

    // Make thumbnail / icon / name clickable to open preview modal
    div._previewFile = file;
    const clickTarget = (e) => {
      if (e.target.closest('.file-item-remove') || e.target.closest('.file-item-drag')) return;
      const thumb = div.querySelector('.file-item-thumb');
      const icon = div.querySelector('.file-item-icon');
      const name = div.querySelector('.file-item-name');
      if (e.target === thumb || e.target === icon || e.target === name || e.target.closest('.file-item-info')) {
        e.stopPropagation();
        EditIt.openPreviewModal(div._previewFile);
      }
    };
    div.addEventListener('click', clickTarget);

    return div;
  };

  // Replace file-item icon with a thumbnail image
  EditIt.setFileItemThumb = function (fileItem, dataUrl) {
    const icon = fileItem.querySelector('.file-item-icon');
    if (icon) {
      const img = document.createElement('img');
      img.className = 'file-item-thumb';
      img.src = dataUrl;
      img.alt = '';
      icon.replaceWith(img);
    }
  };

  // Render a PDF page to a data URL for preview
  EditIt.renderPdfPageToDataURL = async function (arrayBuffer, pageNum, scale) {
    const pdfDoc = await pdfjsLib.getDocument({ data: new Uint8Array(arrayBuffer) }).promise;
    const page = await pdfDoc.getPage(pageNum || 1);
    const viewport = page.getViewport({ scale: scale || 0.5 });
    const canvas = document.createElement('canvas');
    canvas.width = viewport.width;
    canvas.height = viewport.height;
    const ctx = canvas.getContext('2d');
    await page.render({ canvasContext: ctx, viewport }).promise;
    return canvas.toDataURL('image/jpeg', 0.75);
  };

  // Generate before/after comparison HTML
  EditIt.previewCompareHTML = function (beforeSrc, afterSrc, beforeMeta, afterMeta) {
    return `
      <div class="preview-compare">
        <div class="preview-panel">
          <h4>Before</h4>
          <img src="${beforeSrc}" alt="Before">
          ${beforeMeta ? `<div class="preview-meta">${beforeMeta}</div>` : ''}
        </div>
        <div class="preview-arrow">→</div>
        <div class="preview-panel">
          <h4>After</h4>
          <img src="${afterSrc}" alt="After">
          ${afterMeta ? `<div class="preview-meta">${afterMeta}</div>` : ''}
        </div>
      </div>
    `;
  };

  // Generate single output preview HTML
  EditIt.outputPreviewHTML = function (src, label) {
    return `
      <div class="output-preview">
        <img src="${src}" alt="Preview">
        ${label ? `<div class="preview-meta">${label}</div>` : ''}
      </div>
    `;
  };

  // ===== TOOL SEARCH =====
  (function () {
    var searchInput = document.getElementById('tool-search');
    var searchCount = document.getElementById('search-count');
    var noResults = document.getElementById('no-results');
    if (!searchInput) return;

    searchInput.addEventListener('input', function () {
      var query = searchInput.value.toLowerCase().trim();
      var cards = document.querySelectorAll('#tools-container .tool-card');
      var sections = document.querySelectorAll('#tools-container .section-title');
      var grids = document.querySelectorAll('#tools-container .tools-grid');
      var visibleCount = 0;

      if (!query) {
        // Show everything
        cards.forEach(function (c) { c.classList.remove('hidden-card'); });
        sections.forEach(function (s) { s.classList.remove('hidden-section'); });
        grids.forEach(function (g) { g.classList.remove('hidden-section'); });
        noResults.style.display = 'none';
        searchCount.textContent = '';
        return;
      }

      // Filter cards
      cards.forEach(function (card) {
        var title = (card.querySelector('h3') || {}).textContent || '';
        var desc = (card.querySelector('p') || {}).textContent || '';
        var text = (title + ' ' + desc).toLowerCase();
        var match = query.split(/\s+/).every(function (word) { return text.includes(word); });
        if (match) {
          card.classList.remove('hidden-card');
          visibleCount++;
        } else {
          card.classList.add('hidden-card');
        }
      });

      // Show/hide sections based on whether they have visible cards
      grids.forEach(function (grid, idx) {
        var hasVisible = grid.querySelector('.tool-card:not(.hidden-card)');
        grid.classList.toggle('hidden-section', !hasVisible);
        if (sections[idx]) sections[idx].classList.toggle('hidden-section', !hasVisible);
      });

      noResults.style.display = visibleCount === 0 ? 'block' : 'none';
      searchCount.textContent = visibleCount + ' tool' + (visibleCount !== 1 ? 's' : '');
    });

    // Keyboard shortcut: / to focus search
    document.addEventListener('keydown', function (e) {
      if (e.key === '/' && document.activeElement.tagName !== 'INPUT' && document.activeElement.tagName !== 'TEXTAREA') {
        e.preventDefault();
        searchInput.focus();
        // Scroll to top if on home view
        if (document.getElementById('home-view').classList.contains('active')) {
          window.scrollTo({ top: 0, behavior: 'smooth' });
        }
      }
    });
  })();

  // ===== FILE PREVIEW MODAL =====
  (function () {
    const modal = document.getElementById('preview-modal');
    const body = document.getElementById('preview-modal-body');
    const img = document.getElementById('preview-modal-img');
    const canvas = document.getElementById('preview-modal-canvas');
    const loader = document.getElementById('preview-modal-loader');
    const nameEl = document.getElementById('preview-modal-name');
    const metaEl = document.getElementById('preview-modal-meta');
    const prevBtn = document.getElementById('preview-modal-prev');
    const nextBtn = document.getElementById('preview-modal-next');
    const pageInfo = document.getElementById('preview-modal-page-info');
    const closeBtn = document.getElementById('preview-modal-close');

    let currentPdfDoc = null;
    let currentPage = 1;
    let totalPages = 0;

    function showLoading() { loader.style.display = 'flex'; img.style.display = 'none'; canvas.style.display = 'none'; }
    function hideLoading() { loader.style.display = 'none'; }

    function showPdfNav(show) {
      const d = show ? 'inline-flex' : 'none';
      prevBtn.style.display = d; nextBtn.style.display = d; pageInfo.style.display = d;
    }

    async function renderPdfPage(pageNum) {
      if (!currentPdfDoc) return;
      currentPage = pageNum;
      const page = await currentPdfDoc.getPage(pageNum);
      const vp = page.getViewport({ scale: 1.5 });
      canvas.width = vp.width;
      canvas.height = vp.height;
      const ctx = canvas.getContext('2d');
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      await page.render({ canvasContext: ctx, viewport: vp }).promise;
      hideLoading();
      img.style.display = 'none';
      canvas.style.display = 'block';
      pageInfo.textContent = `${pageNum} / ${totalPages}`;
      prevBtn.disabled = pageNum <= 1;
      nextBtn.disabled = pageNum >= totalPages;
    }

    EditIt.openPreviewModal = async function (file) {
      modal.classList.add('active');
      nameEl.textContent = file.name;
      metaEl.textContent = EditIt.formatFileSize(file.size) + ' • ' + (file.type || 'unknown type');
      showLoading();
      showPdfNav(false);
      currentPdfDoc = null;

      try {
        if (file.type.startsWith('image/') || /\.(jpe?g|png|gif|webp|bmp|svg)$/i.test(file.name)) {
          // Image preview
          const dataUrl = await EditIt.readFileAsDataURL(file);
          const imgObj = await EditIt.loadImage(dataUrl);
          metaEl.textContent += ` • ${imgObj.naturalWidth} × ${imgObj.naturalHeight} px`;
          hideLoading();
          canvas.style.display = 'none';
          img.src = dataUrl;
          img.style.display = 'block';
        } else if (file.type === 'application/pdf' || file.name.endsWith('.pdf')) {
          // PDF preview with page navigation
          const bytes = await EditIt.readFileAsArrayBuffer(file);
          currentPdfDoc = await pdfjsLib.getDocument({ data: new Uint8Array(bytes) }).promise;
          totalPages = currentPdfDoc.numPages;
          currentPage = 1;
          metaEl.textContent += ` • ${totalPages} page${totalPages > 1 ? 's' : ''}`;
          showPdfNav(totalPages > 1);
          await renderPdfPage(1);
        } else {
          // Unsupported type — show placeholder
          hideLoading();
          canvas.style.display = 'none';
          img.style.display = 'none';
          loader.style.display = 'flex';
          loader.innerHTML = '<span style="font-size:2rem">📄</span> Preview not available for this file type';
        }
      } catch (err) {
        hideLoading();
        loader.style.display = 'flex';
        loader.innerHTML = 'Error loading preview';
        console.error('Preview error:', err);
      }
    };

    EditIt.closePreviewModal = function () {
      modal.classList.remove('active');
      currentPdfDoc = null;
      img.src = '';
      // Reset loader text
      loader.innerHTML = 'Loading preview…';
    };

    // Navigation
    prevBtn.addEventListener('click', () => { if (currentPage > 1) renderPdfPage(currentPage - 1); });
    nextBtn.addEventListener('click', () => { if (currentPage < totalPages) renderPdfPage(currentPage + 1); });

    // Close
    closeBtn.addEventListener('click', EditIt.closePreviewModal);
    modal.addEventListener('click', (e) => { if (e.target === modal) EditIt.closePreviewModal(); });
    document.addEventListener('keydown', (e) => {
      if (!modal.classList.contains('active')) return;
      if (e.key === 'Escape') EditIt.closePreviewModal();
      if (e.key === 'ArrowLeft' && currentPage > 1) renderPdfPage(currentPage - 1);
      if (e.key === 'ArrowRight' && currentPage < totalPages) renderPdfPage(currentPage + 1);
    });
  })();

  EditIt.showToast = function (message, type = 'info') {
    const container = document.getElementById('toast-container');
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    const icons = { success: '✓', error: '✕', info: 'ℹ' };
    toast.innerHTML = `<span>${icons[type] || ''}</span> ${message}`;
    container.appendChild(toast);
    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateX(20px)';
      toast.style.transition = 'all 0.3s ease';
      setTimeout(() => toast.remove(), 300);
    }, 3500);
  };

  EditIt.showProgress = function (text, percent) {
    const modal = document.getElementById('progress-modal');
    const textEl = document.getElementById('progress-text');
    const percentEl = document.getElementById('progress-percent');
    const fillEl = document.getElementById('progress-fill');
    modal.classList.add('active');
    textEl.textContent = text;
    percentEl.textContent = Math.round(percent) + '%';
    fillEl.style.width = percent + '%';
  };

  EditIt.hideProgress = function () {
    const modal = document.getElementById('progress-modal');
    modal.classList.remove('active');
  };

  EditIt.setButtonLoading = function (btn, loading) {
    if (loading) {
      btn.classList.add('loading');
      btn.disabled = true;
    } else {
      btn.classList.remove('loading');
      btn.disabled = false;
    }
  };

  EditIt.downloadBlob = function (blob, filename) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 100);
  };

  EditIt.readFileAsArrayBuffer = function (file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsArrayBuffer(file);
    });
  };

  EditIt.readFileAsDataURL = function (file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  };

  // ===== UNIVERSAL IMAGE FORMAT NORMALIZER =====
  // Converts exotic formats (HEIC, TIFF, DNG, etc.) to browser-native formats
  EditIt.normalizeImageFile = async function (file) {
    const name = file.name.toLowerCase();
    const type = file.type.toLowerCase();

    // HEIC/HEIF → JPEG (iPhone photos)
    if (name.match(/\.heic$|\.heif$/) || type.includes('heic') || type.includes('heif')) {
      if (typeof heic2any === 'undefined') {
        EditIt.showToast('HEIC converter not loaded yet, please try again', 'error');
        return null;
      }
      EditIt.showToast('Converting HEIC to JPEG...', 'info');
      const blob = await heic2any({ blob: file, toType: 'image/jpeg', quality: 0.92 });
      const converted = new File([blob], name.replace(/\.heic?$/i, '.jpg'), { type: 'image/jpeg' });
      return converted;
    }

    // TIFF / DNG → PNG (using UTIF.js)
    if (name.match(/\.tiff?$|\.dng$/) || type.includes('tiff') || type.includes('dng')) {
      if (typeof UTIF === 'undefined') {
        EditIt.showToast('TIFF decoder not loaded', 'error');
        return null;
      }
      EditIt.showToast('Decoding TIFF/DNG...', 'info');
      const buf = await EditIt.readFileAsArrayBuffer(file);
      const ifds = UTIF.decode(buf);
      if (!ifds.length) { EditIt.showToast('Could not decode TIFF/DNG', 'error'); return null; }
      UTIF.decodeImage(buf, ifds[0]);
      const rgba = UTIF.toRGBA8(ifds[0]);
      const w = ifds[0].width, h = ifds[0].height;
      const canvas = document.createElement('canvas');
      canvas.width = w; canvas.height = h;
      const ctx = canvas.getContext('2d');
      const imgData = ctx.createImageData(w, h);
      imgData.data.set(new Uint8Array(rgba));
      ctx.putImageData(imgData, 0, 0);
      const blob = await new Promise(r => canvas.toBlob(r, 'image/png'));
      const ext = name.match(/\.dng$/i) ? '.dng' : '.tiff';
      return new File([blob], name.replace(new RegExp(ext.replace('.', '\\.') + '$', 'i'), '.png'), { type: 'image/png' });
    }

    // RAW camera formats → attempt to load as image (some browsers support it)
    if (name.match(/\.cr2$|\.nef$|\.arw$|\.orf$|\.rw2$|\.pef$/)) {
      EditIt.showToast('RAW format — attempting to process...', 'info');
      // Try loading as a regular image (won't work in most browsers)
      try {
        const url = URL.createObjectURL(file);
        const img = await EditIt.loadImage(url);
        URL.revokeObjectURL(url);
        // If it loaded, convert to PNG
        const canvas = document.createElement('canvas');
        canvas.width = img.naturalWidth; canvas.height = img.naturalHeight;
        canvas.getContext('2d').drawImage(img, 0, 0);
        const blob = await new Promise(r => canvas.toBlob(r, 'image/png'));
        return new File([blob], name.replace(/\.[^.]+$/, '.png'), { type: 'image/png' });
      } catch (e) {
        EditIt.showToast('RAW format not supported by your browser. Convert to JPEG/PNG first.', 'error');
        return null;
      }
    }

    // ICO, TGA → try native browser support
    if (name.match(/\.ico$|\.tga$|\.hdr$/)) {
      try {
        const url = URL.createObjectURL(file);
        const img = await EditIt.loadImage(url);
        URL.revokeObjectURL(url);
        const canvas = document.createElement('canvas');
        canvas.width = img.naturalWidth; canvas.height = img.naturalHeight;
        canvas.getContext('2d').drawImage(img, 0, 0);
        const blob = await new Promise(r => canvas.toBlob(r, 'image/png'));
        return new File([blob], name.replace(/\.[^.]+$/, '.png'), { type: 'image/png' });
      } catch (e) {
        EditIt.showToast('This format is not supported by your browser', 'error');
        return null;
      }
    }

    // Already a native format — return as-is
    return file;
  };

  // Wrapper for readFileAsDataURL that handles exotic formats
  EditIt.readImageAsDataURL = async function (file) {
    const normalized = await EditIt.normalizeImageFile(file);
    if (!normalized) throw new Error('Unsupported image format');
    return EditIt.readFileAsDataURL(normalized);
  };

  EditIt.loadImage = function (src) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = reject;
      img.src = src;
    });
  };

  // Parse page range string like "1-3, 5, 7-9" into array of page numbers (0-indexed)
  EditIt.parsePageRange = function (rangeStr, maxPages) {
    const pages = new Set();
    const parts = rangeStr.split(',').map(s => s.trim()).filter(Boolean);
    for (const part of parts) {
      if (part.includes('-')) {
        const [start, end] = part.split('-').map(Number);
        if (!isNaN(start) && !isNaN(end)) {
          for (let i = Math.max(1, start); i <= Math.min(maxPages, end); i++) {
            pages.add(i - 1);
          }
        }
      } else {
        const num = parseInt(part);
        if (!isNaN(num) && num >= 1 && num <= maxPages) {
          pages.add(num - 1);
        }
      }
    }
    return [...pages].sort((a, b) => a - b);
  };

})();


// ===== file.tools — PDF Tools =====

(function () {
  'use strict';

  const { PDFDocument, degrees } = PDFLib;

  // Configure PDF.js worker
  if (typeof pdfjsLib !== 'undefined') {
    pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
  }

  // ===========================
  // MERGE PDF
  // ===========================
  (function () {
    const fileListEl = document.getElementById('merge-pdf-files');
    const actionBtn = document.getElementById('merge-pdf-action');
    const outputEl = document.getElementById('merge-pdf-output');
    let files = [];

    EditIt.initSortable(fileListEl);

    document.addEventListener('files-added', (e) => {
      if (e.detail.toolId !== 'merge-pdf') return;
      const newFiles = e.detail.files.filter(f => f.type === 'application/pdf' || f.name.endsWith('.pdf'));
      if (newFiles.length === 0) {
        EditIt.showToast('Please select PDF files only', 'error');
        return;
      }
      files.push(...newFiles);
      renderFileList();
    });

    function renderFileList() {
      fileListEl.innerHTML = '';
      files.forEach((file, i) => {
        const item = EditIt.createFileItem(file, i, { sortable: true });
        item.querySelector('.file-item-remove').addEventListener('click', () => {
          files.splice(i, 1);
          renderFileList();
        });
        fileListEl.appendChild(item);
        // Generate PDF thumbnail
        EditIt.readFileAsArrayBuffer(file).then(buf =>
          EditIt.renderPdfPageToDataURL(buf, 1, 0.3)
        ).then(url => EditIt.setFileItemThumb(item, url)).catch(() => {});
      });
      actionBtn.disabled = files.length < 2;
      outputEl.innerHTML = '';
    }

    actionBtn.addEventListener('click', async () => {
      if (files.length < 2) return;
      EditIt.setButtonLoading(actionBtn, true);

      try {
        // Respect the DOM order (drag-and-drop reorder)
        const orderedFiles = [];
        const items = fileListEl.querySelectorAll('.file-item');
        items.forEach(item => {
          const idx = parseInt(item.dataset.index);
          orderedFiles.push(files[idx]);
        });

        const mergedPdf = await PDFDocument.create();

        for (let i = 0; i < orderedFiles.length; i++) {
          EditIt.showProgress(`Merging file ${i + 1} of ${orderedFiles.length}...`, ((i + 1) / orderedFiles.length) * 100);
          const bytes = await EditIt.readFileAsArrayBuffer(orderedFiles[i]);
          const pdf = await PDFDocument.load(bytes);
          const pages = await mergedPdf.copyPages(pdf, pdf.getPageIndices());
          pages.forEach(page => mergedPdf.addPage(page));
        }

        const mergedBytes = await mergedPdf.save();
        const blob = new Blob([mergedBytes], { type: 'application/pdf' });
        EditIt.hideProgress();

        // Generate output preview
        let outputPreview = '';
        try {
          const previewUrl = await EditIt.renderPdfPageToDataURL(mergedBytes, 1, 0.8);
          outputPreview = EditIt.outputPreviewHTML(previewUrl, 'Page 1 of merged PDF');
        } catch(e) {}

        outputEl.innerHTML = `
          <div class="output-card">
            <h3>✓ PDFs Merged Successfully!</h3>
            <p>${orderedFiles.length} files merged • ${EditIt.formatFileSize(blob.size)}</p>
            ${outputPreview}
            <div class="output-filename">
              <label for="merge-pdf-filename">File name:</label>
              <input type="text" id="merge-pdf-filename" class="input" value="merged.pdf">
            </div>
            <button class="btn btn-success" id="merge-pdf-download">Download Merged PDF</button>
          </div>
        `;

        document.getElementById('merge-pdf-download').addEventListener('click', () => {
          const filename = document.getElementById('merge-pdf-filename').value.trim() || 'merged.pdf';
          EditIt.downloadBlob(blob, filename);
        });

        EditIt.showToast('PDFs merged successfully!', 'success');
      } catch (err) {
        console.error(err);
        EditIt.showToast('Error merging PDFs: ' + err.message, 'error');
        EditIt.hideProgress();
      }

      EditIt.setButtonLoading(actionBtn, false);
    });
  })();

  // ===========================
  // SPLIT PDF
  // ===========================
  (function () {
    const pagesGrid = document.getElementById('split-pdf-pages');
    const optionsEl = document.getElementById('split-pdf-options');
    const rangeInput = document.getElementById('split-pdf-range');
    const actionBtn = document.getElementById('split-pdf-action');
    const outputEl = document.getElementById('split-pdf-output');
    const selectAllBtn = document.getElementById('split-select-all');
    const selectNoneBtn = document.getElementById('split-select-none');
    let pdfFile = null;
    let pdfBytes = null;
    let totalPages = 0;
    let selectedPages = new Set();

    document.addEventListener('files-added', async (e) => {
      if (e.detail.toolId !== 'split-pdf') return;
      const file = e.detail.files.find(f => f.type === 'application/pdf' || f.name.endsWith('.pdf'));
      if (!file) {
        EditIt.showToast('Please select a PDF file', 'error');
        return;
      }

      pdfFile = file;
      pdfBytes = await EditIt.readFileAsArrayBuffer(file);
      selectedPages.clear();
      outputEl.innerHTML = '';

      try {
        const pdfDoc = await pdfjsLib.getDocument({ data: pdfBytes.slice(0) }).promise;
        totalPages = pdfDoc.numPages;
        pagesGrid.innerHTML = '';
        optionsEl.style.display = 'block';

        for (let i = 1; i <= totalPages; i++) {
          const page = await pdfDoc.getPage(i);
          const viewport = page.getViewport({ scale: 0.4 });
          const canvas = document.createElement('canvas');
          canvas.width = viewport.width;
          canvas.height = viewport.height;
          const ctx = canvas.getContext('2d');
          await page.render({ canvasContext: ctx, viewport }).promise;

          const thumb = document.createElement('div');
          thumb.className = 'page-thumb';
          thumb.dataset.page = i;
          thumb.innerHTML = `<span class="page-check">✓</span><span class="page-num">Page ${i}</span>`;
          thumb.prepend(canvas);

          thumb.addEventListener('click', () => {
            if (selectedPages.has(i)) {
              selectedPages.delete(i);
              thumb.classList.remove('selected');
            } else {
              selectedPages.add(i);
              thumb.classList.add('selected');
            }
            updateRangeInput();
            actionBtn.disabled = selectedPages.size === 0;
          });

          pagesGrid.appendChild(thumb);
        }

        rangeInput.placeholder = `1-${totalPages}`;
        EditIt.showToast(`PDF loaded: ${totalPages} pages`, 'info');
      } catch (err) {
        console.error(err);
        EditIt.showToast('Error loading PDF: ' + err.message, 'error');
      }
    });

    function updateRangeInput() {
      const sorted = [...selectedPages].sort((a, b) => a - b);
      const ranges = [];
      let start = null, prev = null;
      for (const p of sorted) {
        if (start === null) { start = p; prev = p; continue; }
        if (p === prev + 1) { prev = p; continue; }
        ranges.push(start === prev ? `${start}` : `${start}-${prev}`);
        start = p; prev = p;
      }
      if (start !== null) ranges.push(start === prev ? `${start}` : `${start}-${prev}`);
      rangeInput.value = ranges.join(', ');
    }

    rangeInput.addEventListener('input', () => {
      const pages = EditIt.parsePageRange(rangeInput.value, totalPages);
      selectedPages = new Set(pages.map(p => p + 1));
      document.querySelectorAll('#split-pdf-pages .page-thumb').forEach(thumb => {
        const page = parseInt(thumb.dataset.page);
        thumb.classList.toggle('selected', selectedPages.has(page));
      });
      actionBtn.disabled = selectedPages.size === 0;
    });

    selectAllBtn.addEventListener('click', () => {
      selectedPages.clear();
      for (let i = 1; i <= totalPages; i++) selectedPages.add(i);
      document.querySelectorAll('#split-pdf-pages .page-thumb').forEach(t => t.classList.add('selected'));
      updateRangeInput();
      actionBtn.disabled = false;
    });

    selectNoneBtn.addEventListener('click', () => {
      selectedPages.clear();
      document.querySelectorAll('#split-pdf-pages .page-thumb').forEach(t => t.classList.remove('selected'));
      rangeInput.value = '';
      actionBtn.disabled = true;
    });

    actionBtn.addEventListener('click', async () => {
      if (selectedPages.size === 0 || !pdfBytes) return;
      EditIt.setButtonLoading(actionBtn, true);

      try {
        const srcPdf = await PDFDocument.load(pdfBytes);
        const newPdf = await PDFDocument.create();
        const pageIndices = [...selectedPages].sort((a, b) => a - b).map(p => p - 1);

        const copiedPages = await newPdf.copyPages(srcPdf, pageIndices);
        copiedPages.forEach(page => newPdf.addPage(page));

        const newBytes = await newPdf.save();
        const blob = new Blob([newBytes], { type: 'application/pdf' });

        // Generate output preview
        let outputPreview = '';
        try {
          const previewUrl = await EditIt.renderPdfPageToDataURL(newBytes, 1, 0.8);
          outputPreview = EditIt.outputPreviewHTML(previewUrl, `Page 1 of extracted PDF (${selectedPages.size} pages)`);
        } catch(e) {}

        const defaultSplitName = pdfFile.name.replace('.pdf', '') + '_split.pdf';
        outputEl.innerHTML = `
          <div class="output-card">
            <h3>✓ Pages Extracted Successfully!</h3>
            <p>${selectedPages.size} of ${totalPages} pages extracted • ${EditIt.formatFileSize(blob.size)}</p>
            ${outputPreview}
            <div class="output-filename">
              <label for="split-pdf-filename">File name:</label>
              <input type="text" id="split-pdf-filename" class="input" value="${defaultSplitName}">
            </div>
            <button class="btn btn-success" id="split-pdf-download">Download PDF</button>
          </div>
        `;

        document.getElementById('split-pdf-download').addEventListener('click', () => {
          const filename = document.getElementById('split-pdf-filename').value.trim() || defaultSplitName;
          EditIt.downloadBlob(blob, filename);
        });

        EditIt.showToast('Pages extracted successfully!', 'success');
      } catch (err) {
        console.error(err);
        EditIt.showToast('Error splitting PDF: ' + err.message, 'error');
      }

      EditIt.setButtonLoading(actionBtn, false);
    });
  })();

  // ===========================
  // COMPRESS PDF
  // ===========================
  (function () {
    const fileListEl = document.getElementById('compress-pdf-files');
    const optionsEl = document.getElementById('compress-pdf-options');
    const qualitySlider = document.getElementById('compress-pdf-quality');
    const qualityVal = document.getElementById('compress-pdf-quality-val');
    const actionBtn = document.getElementById('compress-pdf-action');
    const outputEl = document.getElementById('compress-pdf-output');
    let pdfFile = null;

    const labels = { '0.1': 'Maximum', '0.2': 'Very High', '0.3': 'High', '0.4': 'Medium-High', '0.5': 'Medium', '0.6': 'Medium-Low', '0.7': 'Low', '0.8': 'Very Low', '0.9': 'Minimal' };

    qualitySlider.addEventListener('input', () => {
      qualityVal.textContent = labels[qualitySlider.value] || 'Medium';
    });

    document.addEventListener('files-added', (e) => {
      if (e.detail.toolId !== 'compress-pdf') return;
      const file = e.detail.files.find(f => f.type === 'application/pdf' || f.name.endsWith('.pdf'));
      if (!file) {
        EditIt.showToast('Please select a PDF file', 'error');
        return;
      }

      pdfFile = file;
      fileListEl.innerHTML = '';
      const item = EditIt.createFileItem(file, 0);
      item.querySelector('.file-item-remove').addEventListener('click', () => {
        pdfFile = null;
        fileListEl.innerHTML = '';
        optionsEl.style.display = 'none';
        actionBtn.disabled = true;
        outputEl.innerHTML = '';
        beforePreviewUrl = null;
      });
      fileListEl.appendChild(item);
      optionsEl.style.display = 'block';
      actionBtn.disabled = false;
      outputEl.innerHTML = '';

      // Generate before preview thumbnail + page preview
      EditIt.readFileAsArrayBuffer(file).then(buf =>
        EditIt.renderPdfPageToDataURL(buf, 1, 0.3)
      ).then(url => EditIt.setFileItemThumb(item, url)).catch(() => {});

      EditIt.readFileAsArrayBuffer(file).then(buf =>
        EditIt.renderPdfPageToDataURL(buf, 1, 0.7)
      ).then(url => { beforePreviewUrl = url; }).catch(() => {});
    });

    let beforePreviewUrl = null;

    actionBtn.addEventListener('click', async () => {
      if (!pdfFile) return;
      EditIt.setButtonLoading(actionBtn, true);
      EditIt.showProgress('Compressing PDF...', 20);

      try {
        const bytes = await EditIt.readFileAsArrayBuffer(pdfFile);
        const quality = parseFloat(qualitySlider.value);

        // Load with PDF.js for rendering, then recreate with pdf-lib
        const pdfDoc = await pdfjsLib.getDocument({ data: bytes.slice(0) }).promise;
        const numPages = pdfDoc.numPages;
        const newPdf = await PDFDocument.create();

        for (let i = 1; i <= numPages; i++) {
          EditIt.showProgress(`Compressing page ${i} of ${numPages}...`, (i / numPages) * 90);

          const page = await pdfDoc.getPage(i);
          const viewport = page.getViewport({ scale: 1.5 });

          const canvas = document.createElement('canvas');
          canvas.width = viewport.width;
          canvas.height = viewport.height;
          const ctx = canvas.getContext('2d');
          await page.render({ canvasContext: ctx, viewport }).promise;

          // Compress the rendered image as JPEG
          const imgDataUrl = canvas.toDataURL('image/jpeg', quality);
          const imgBytes = Uint8Array.from(atob(imgDataUrl.split(',')[1]), c => c.charCodeAt(0));
          const jpgImage = await newPdf.embedJpg(imgBytes);

          const newPage = newPdf.addPage([viewport.width * 0.5, viewport.height * 0.5]);
          newPage.drawImage(jpgImage, {
            x: 0, y: 0,
            width: newPage.getWidth(),
            height: newPage.getHeight()
          });
        }

        EditIt.showProgress('Saving...', 95);
        const compressedBytes = await newPdf.save();
        const blob = new Blob([compressedBytes], { type: 'application/pdf' });
        EditIt.hideProgress();

        const savings = ((1 - blob.size / pdfFile.size) * 100).toFixed(1);
        const savingsText = savings > 0 ? `Reduced by ${savings}%` : 'File size similar';

        // Generate before/after preview
        let compareHTML = '';
        try {
          const afterUrl = await EditIt.renderPdfPageToDataURL(compressedBytes, 1, 0.7);
          if (beforePreviewUrl) {
            compareHTML = EditIt.previewCompareHTML(
              beforePreviewUrl, afterUrl,
              `Original • ${EditIt.formatFileSize(pdfFile.size)}`,
              `Compressed • ${EditIt.formatFileSize(blob.size)}`
            );
          } else {
            compareHTML = EditIt.outputPreviewHTML(afterUrl, 'Compressed PDF preview');
          }
        } catch(e) {}

        const defaultCompressName = pdfFile.name.replace('.pdf', '') + '_compressed.pdf';
        outputEl.innerHTML = `
          <div class="output-card">
            <h3>✓ PDF Compressed!</h3>
            <p>${EditIt.formatFileSize(pdfFile.size)} → ${EditIt.formatFileSize(blob.size)} • ${savingsText}</p>
            ${compareHTML}
            <div class="output-filename">
              <label for="compress-pdf-filename">File name:</label>
              <input type="text" id="compress-pdf-filename" class="input" value="${defaultCompressName}">
            </div>
            <button class="btn btn-success" id="compress-pdf-download">Download Compressed PDF</button>
          </div>
        `;

        document.getElementById('compress-pdf-download').addEventListener('click', () => {
          const filename = document.getElementById('compress-pdf-filename').value.trim() || defaultCompressName;
          EditIt.downloadBlob(blob, filename);
        });

        EditIt.showToast('PDF compressed successfully!', 'success');
      } catch (err) {
        console.error(err);
        EditIt.showToast('Error compressing PDF: ' + err.message, 'error');
        EditIt.hideProgress();
      }

      EditIt.setButtonLoading(actionBtn, false);
    });
  })();

  // ===========================
  // PDF TO IMAGES
  // ===========================
  (function () {
    const fileListEl = document.getElementById('pdf-to-image-files');
    const optionsEl = document.getElementById('pdf-to-image-options');
    const formatSelect = document.getElementById('pdf-to-image-format');
    const scaleSelect = document.getElementById('pdf-to-image-scale');
    const actionBtn = document.getElementById('pdf-to-image-action');
    const outputEl = document.getElementById('pdf-to-image-output');
    let pdfFile = null;

    document.addEventListener('files-added', (e) => {
      if (e.detail.toolId !== 'pdf-to-image') return;
      const file = e.detail.files.find(f => f.type === 'application/pdf' || f.name.endsWith('.pdf'));
      if (!file) {
        EditIt.showToast('Please select a PDF file', 'error');
        return;
      }

      pdfFile = file;
      fileListEl.innerHTML = '';
      const item = EditIt.createFileItem(file, 0);
      item.querySelector('.file-item-remove').addEventListener('click', () => {
        pdfFile = null;
        fileListEl.innerHTML = '';
        optionsEl.style.display = 'none';
        actionBtn.disabled = true;
        outputEl.innerHTML = '';
      });
      fileListEl.appendChild(item);
      optionsEl.style.display = 'block';
      actionBtn.disabled = false;
      outputEl.innerHTML = '';

      // Generate PDF thumbnail for file item
      EditIt.readFileAsArrayBuffer(file).then(buf =>
        EditIt.renderPdfPageToDataURL(buf, 1, 0.3)
      ).then(url => EditIt.setFileItemThumb(item, url)).catch(() => {});
    });

    actionBtn.addEventListener('click', async () => {
      if (!pdfFile) return;
      EditIt.setButtonLoading(actionBtn, true);

      try {
        const bytes = await EditIt.readFileAsArrayBuffer(pdfFile);
        const pdfDoc = await pdfjsLib.getDocument({ data: bytes }).promise;
        const numPages = pdfDoc.numPages;
        const scale = parseInt(scaleSelect.value);
        const format = formatSelect.value;
        const mimeType = format === 'jpeg' ? 'image/jpeg' : format === 'webp' ? 'image/webp' : 'image/png';
        const ext = format === 'jpeg' ? 'jpg' : format;
        const images = [];

        for (let i = 1; i <= numPages; i++) {
          EditIt.showProgress(`Converting page ${i} of ${numPages}...`, (i / numPages) * 90);

          const page = await pdfDoc.getPage(i);
          const viewport = page.getViewport({ scale });
          const canvas = document.createElement('canvas');
          canvas.width = viewport.width;
          canvas.height = viewport.height;
          const ctx = canvas.getContext('2d');
          await page.render({ canvasContext: ctx, viewport }).promise;

          const blob = await new Promise(resolve => canvas.toBlob(resolve, mimeType, 0.92));
          const url = URL.createObjectURL(blob);
          images.push({ blob, url, name: `page_${i}.${ext}`, page: i });
        }

        EditIt.hideProgress();

        const defaultZipName = pdfFile.name.replace('.pdf', '') + '_images.zip';
        let html = '<div class="output-card"><h3>✓ Conversion Complete!</h3>';
        html += `<p>${numPages} pages converted to ${format.toUpperCase()}</p>`;
        if (images.length > 1) {
          html += `<div class="output-filename">
            <label for="pdf-to-image-zipname">ZIP name:</label>
            <input type="text" id="pdf-to-image-zipname" class="input" value="${defaultZipName}">
          </div>`;
          html += '<button class="btn btn-success" id="pdf-to-image-download-all">Download All (ZIP)</button>';
        }
        html += '</div><div class="output-images">';

        images.forEach((img, i) => {
          html += `
            <div class="output-image-card">
              <img src="${img.url}" alt="Page ${img.page}">
              <div class="output-image-info">
                <span>Page ${img.page} • ${EditIt.formatFileSize(img.blob.size)}</span>
                <button class="btn btn-sm btn-outline download-page-btn" data-index="${i}">Download</button>
              </div>
            </div>
          `;
        });

        html += '</div>';
        outputEl.innerHTML = html;

        // Individual download buttons
        outputEl.querySelectorAll('.download-page-btn').forEach(btn => {
          btn.addEventListener('click', () => {
            const idx = parseInt(btn.dataset.index);
            EditIt.downloadBlob(images[idx].blob, images[idx].name);
          });
        });

        // Download all as ZIP
        const downloadAllBtn = document.getElementById('pdf-to-image-download-all');
        if (downloadAllBtn) {
          downloadAllBtn.addEventListener('click', async () => {
            const zip = new JSZip();
            images.forEach(img => zip.file(img.name, img.blob));
            const zipBlob = await zip.generateAsync({ type: 'blob' });
            const zipName = document.getElementById('pdf-to-image-zipname').value.trim() || defaultZipName;
            EditIt.downloadBlob(zipBlob, zipName);
          });
        }

        EditIt.showToast('PDF converted to images!', 'success');
      } catch (err) {
        console.error(err);
        EditIt.showToast('Error converting PDF: ' + err.message, 'error');
        EditIt.hideProgress();
      }

      EditIt.setButtonLoading(actionBtn, false);
    });
  })();

  // ===========================
  // IMAGES TO PDF
  // ===========================
  (function () {
    const fileListEl = document.getElementById('image-to-pdf-files');
    const optionsEl = document.getElementById('image-to-pdf-options');
    const sizeSelect = document.getElementById('image-to-pdf-size');
    const orientSelect = document.getElementById('image-to-pdf-orient');
    const actionBtn = document.getElementById('image-to-pdf-action');
    const outputEl = document.getElementById('image-to-pdf-output');
    let files = [];

    EditIt.initSortable(fileListEl);

    document.addEventListener('files-added', (e) => {
      if (e.detail.toolId !== 'image-to-pdf') return;
      const imageFiles = e.detail.files.filter(f => f.type.startsWith('image/'));
      if (imageFiles.length === 0) {
        EditIt.showToast('Please select image files', 'error');
        return;
      }
      files.push(...imageFiles);
      renderFileList();
    });

    function renderFileList() {
      fileListEl.innerHTML = '';
      files.forEach((file, i) => {
        const item = EditIt.createFileItem(file, i, { sortable: true });
        item.querySelector('.file-item-remove').addEventListener('click', () => {
          files.splice(i, 1);
          renderFileList();
        });
        fileListEl.appendChild(item);
        // Image thumbnails are auto-generated by createFileItem
      });
      actionBtn.disabled = files.length === 0;
      optionsEl.style.display = files.length > 0 ? 'block' : 'none';
      outputEl.innerHTML = '';
    }

    actionBtn.addEventListener('click', async () => {
      if (files.length === 0) return;
      EditIt.setButtonLoading(actionBtn, true);

      try {
        // Get ordered files from DOM
        const orderedFiles = [];
        const items = fileListEl.querySelectorAll('.file-item');
        items.forEach(item => {
          const idx = parseInt(item.dataset.index);
          orderedFiles.push(files[idx]);
        });

        const pdfDoc = await PDFDocument.create();
        const pageSize = sizeSelect.value;
        const orient = orientSelect.value;

        // Page dimensions (in points, 1 inch = 72 points)
        const A4 = { w: 595.28, h: 841.89 };
        const LETTER = { w: 612, h: 792 };

        for (let i = 0; i < orderedFiles.length; i++) {
          EditIt.showProgress(`Adding image ${i + 1} of ${orderedFiles.length}...`, ((i + 1) / orderedFiles.length) * 90);

          const file = orderedFiles[i];
          const dataUrl = await EditIt.readFileAsDataURL(file);
          const img = await EditIt.loadImage(dataUrl);
          const imgWidth = img.naturalWidth;
          const imgHeight = img.naturalHeight;

          // Embed image
          let embeddedImage;
          const bytes = await EditIt.readFileAsArrayBuffer(file);
          if (file.type === 'image/png') {
            embeddedImage = await pdfDoc.embedPng(bytes);
          } else {
            // Convert to JPEG for non-PNG images
            const canvas = document.createElement('canvas');
            canvas.width = imgWidth;
            canvas.height = imgHeight;
            const ctx = canvas.getContext('2d');
            ctx.drawImage(img, 0, 0);
            const jpgDataUrl = canvas.toDataURL('image/jpeg', 0.92);
            const jpgBytes = Uint8Array.from(atob(jpgDataUrl.split(',')[1]), c => c.charCodeAt(0));
            embeddedImage = await pdfDoc.embedJpg(jpgBytes);
          }

          let pageW, pageH;

          if (pageSize === 'fit') {
            pageW = imgWidth;
            pageH = imgHeight;
          } else {
            const dims = pageSize === 'a4' ? A4 : LETTER;
            const isLandscape = orient === 'landscape' || (orient === 'auto' && imgWidth > imgHeight);
            pageW = isLandscape ? dims.h : dims.w;
            pageH = isLandscape ? dims.w : dims.h;
          }

          const page = pdfDoc.addPage([pageW, pageH]);

          if (pageSize === 'fit') {
            page.drawImage(embeddedImage, { x: 0, y: 0, width: pageW, height: pageH });
          } else {
            // Scale image to fit within page with margins
            const margin = 36; // 0.5 inch
            const maxW = pageW - margin * 2;
            const maxH = pageH - margin * 2;
            const scale = Math.min(maxW / imgWidth, maxH / imgHeight);
            const drawW = imgWidth * scale;
            const drawH = imgHeight * scale;
            const x = (pageW - drawW) / 2;
            const y = (pageH - drawH) / 2;
            page.drawImage(embeddedImage, { x, y, width: drawW, height: drawH });
          }
        }

        EditIt.showProgress('Saving PDF...', 95);
        const pdfBytes = await pdfDoc.save();
        const blob = new Blob([pdfBytes], { type: 'application/pdf' });
        EditIt.hideProgress();

        // Generate output preview
        let outputPreview = '';
        try {
          const previewUrl = await EditIt.renderPdfPageToDataURL(pdfBytes, 1, 0.8);
          outputPreview = EditIt.outputPreviewHTML(previewUrl, `Page 1 of created PDF (${orderedFiles.length} pages)`);
        } catch(e) {}

        outputEl.innerHTML = `
          <div class="output-card">
            <h3>✓ PDF Created Successfully!</h3>
            <p>${orderedFiles.length} images → ${EditIt.formatFileSize(blob.size)}</p>
            ${outputPreview}
            <div class="output-filename">
              <label for="image-to-pdf-filename">File name:</label>
              <input type="text" id="image-to-pdf-filename" class="input" value="images.pdf">
            </div>
            <button class="btn btn-success" id="image-to-pdf-download">Download PDF</button>
          </div>
        `;

        document.getElementById('image-to-pdf-download').addEventListener('click', () => {
          const filename = document.getElementById('image-to-pdf-filename').value.trim() || 'images.pdf';
          EditIt.downloadBlob(blob, filename);
        });

        EditIt.showToast('PDF created successfully!', 'success');
      } catch (err) {
        console.error(err);
        EditIt.showToast('Error creating PDF: ' + err.message, 'error');
        EditIt.hideProgress();
      }

      EditIt.setButtonLoading(actionBtn, false);
    });
  })();

  // ===========================
  // ROTATE PDF
  // ===========================
  (function () {
    const fileListEl = document.getElementById('rotate-pdf-files');
    const optionsEl = document.getElementById('rotate-pdf-options');
    const actionBtn = document.getElementById('rotate-pdf-action');
    const outputEl = document.getElementById('rotate-pdf-output');
    let pdfFile = null;
    let rotationDegrees = 90;

    // Rotation buttons
    document.querySelectorAll('.rotation-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.rotation-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        rotationDegrees = parseInt(btn.dataset.degrees);
      });
    });

    document.addEventListener('files-added', (e) => {
      if (e.detail.toolId !== 'rotate-pdf') return;
      const file = e.detail.files.find(f => f.type === 'application/pdf' || f.name.endsWith('.pdf'));
      if (!file) {
        EditIt.showToast('Please select a PDF file', 'error');
        return;
      }

      pdfFile = file;
      fileListEl.innerHTML = '';
      const item = EditIt.createFileItem(file, 0);
      item.querySelector('.file-item-remove').addEventListener('click', () => {
        pdfFile = null;
        fileListEl.innerHTML = '';
        optionsEl.style.display = 'none';
        actionBtn.disabled = true;
        outputEl.innerHTML = '';
        beforePreviewUrl = null;
      });
      fileListEl.appendChild(item);
      optionsEl.style.display = 'block';
      actionBtn.disabled = false;
      outputEl.innerHTML = '';

      // Generate PDF thumbnail + before preview
      EditIt.readFileAsArrayBuffer(file).then(buf =>
        EditIt.renderPdfPageToDataURL(buf, 1, 0.3)
      ).then(url => EditIt.setFileItemThumb(item, url)).catch(() => {});

      EditIt.readFileAsArrayBuffer(file).then(buf =>
        EditIt.renderPdfPageToDataURL(buf, 1, 0.7)
      ).then(url => { beforePreviewUrl = url; }).catch(() => {});
    });

    let beforePreviewUrl = null;

    actionBtn.addEventListener('click', async () => {
      if (!pdfFile) return;
      EditIt.setButtonLoading(actionBtn, true);

      try {
        const bytes = await EditIt.readFileAsArrayBuffer(pdfFile);
        const pdfDoc = await PDFDocument.load(bytes);
        const pages = pdfDoc.getPages();

        pages.forEach(page => {
          const current = page.getRotation().angle;
          page.setRotation(degrees(current + rotationDegrees));
        });

        const rotatedBytes = await pdfDoc.save();
        const blob = new Blob([rotatedBytes], { type: 'application/pdf' });

        // Generate before/after preview
        let compareHTML = '';
        try {
          const afterUrl = await EditIt.renderPdfPageToDataURL(rotatedBytes, 1, 0.7);
          if (beforePreviewUrl) {
            compareHTML = EditIt.previewCompareHTML(
              beforePreviewUrl, afterUrl,
              'Original', `Rotated ${rotationDegrees}°`
            );
          } else {
            compareHTML = EditIt.outputPreviewHTML(afterUrl, 'Rotated PDF preview');
          }
        } catch(e) {}

        const defaultRotateName = pdfFile.name.replace('.pdf', '') + '_rotated.pdf';
        outputEl.innerHTML = `
          <div class="output-card">
            <h3>✓ PDF Rotated!</h3>
            <p>${pages.length} pages rotated ${rotationDegrees}° • ${EditIt.formatFileSize(blob.size)}</p>
            ${compareHTML}
            <div class="output-filename">
              <label for="rotate-pdf-filename">File name:</label>
              <input type="text" id="rotate-pdf-filename" class="input" value="${defaultRotateName}">
            </div>
            <button class="btn btn-success" id="rotate-pdf-download">Download Rotated PDF</button>
          </div>
        `;

        document.getElementById('rotate-pdf-download').addEventListener('click', () => {
          const filename = document.getElementById('rotate-pdf-filename').value.trim() || defaultRotateName;
          EditIt.downloadBlob(blob, filename);
        });

        EditIt.showToast('PDF rotated successfully!', 'success');
      } catch (err) {
        console.error(err);
        EditIt.showToast('Error rotating PDF: ' + err.message, 'error');
      }

      EditIt.setButtonLoading(actionBtn, false);
    });
  })();

})();


// ===== file.tools — Image Tools =====

(function () {
  'use strict';

  // ===========================
  // CONVERT IMAGE
  // ===========================
  (function () {
    const fileListEl = document.getElementById('convert-image-files');
    const optionsEl = document.getElementById('convert-image-options');
    const formatSelect = document.getElementById('convert-image-format');
    const actionBtn = document.getElementById('convert-image-action');
    const outputEl = document.getElementById('convert-image-output');
    let files = [];

    document.addEventListener('files-added', (e) => {
      if (e.detail.toolId !== 'convert-image') return;
      const imageFiles = e.detail.files.filter(f => f.type.startsWith('image/'));
      if (imageFiles.length === 0) {
        EditIt.showToast('Please select image files', 'error');
        return;
      }
      files.push(...imageFiles);
      renderFileList();
    });

    function renderFileList() {
      fileListEl.innerHTML = '';
      files.forEach((file, i) => {
        const item = EditIt.createFileItem(file, i);
        item.querySelector('.file-item-remove').addEventListener('click', () => {
          files.splice(i, 1);
          renderFileList();
        });
        fileListEl.appendChild(item);
      });
      actionBtn.disabled = files.length === 0;
      optionsEl.style.display = files.length > 0 ? 'block' : 'none';
      outputEl.innerHTML = '';
    }

    actionBtn.addEventListener('click', async () => {
      if (files.length === 0) return;
      EditIt.setButtonLoading(actionBtn, true);

      try {
        const mimeType = formatSelect.value;
        const extMap = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'image/avif': 'avif', 'image/bmp': 'bmp', 'image/tiff': 'tiff' };
        const ext = extMap[mimeType] || 'png';
        const results = [];

        for (let i = 0; i < files.length; i++) {
          EditIt.showProgress(`Converting image ${i + 1} of ${files.length}...`, ((i + 1) / files.length) * 90);

          // Normalize exotic input formats (HEIC, DNG, TIFF, etc.)
          let srcFile = files[i];
          if (typeof EditIt.normalizeImageFile === 'function') {
            const normalized = await EditIt.normalizeImageFile(srcFile);
            if (normalized) srcFile = normalized;
          }

          const dataUrl = await EditIt.readFileAsDataURL(srcFile);
          const img = await EditIt.loadImage(dataUrl);

          const canvas = document.createElement('canvas');
          canvas.width = img.naturalWidth;
          canvas.height = img.naturalHeight;
          const ctx = canvas.getContext('2d');

          // White background for JPEG (no transparency support)
          if (mimeType === 'image/jpeg' || mimeType === 'image/bmp') {
            ctx.fillStyle = '#ffffff';
            ctx.fillRect(0, 0, canvas.width, canvas.height);
          }

          ctx.drawImage(img, 0, 0);

          let blob;
          if (mimeType === 'image/tiff' && typeof UTIF !== 'undefined') {
            // Use UTIF.js for TIFF encoding
            const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
            const tiffData = UTIF.encodeImage(new Uint8Array(imgData.data.buffer), canvas.width, canvas.height);
            blob = new Blob([tiffData], { type: 'image/tiff' });
          } else {
            blob = await new Promise(resolve => canvas.toBlob(resolve, mimeType, 0.92));
          }
          if (!blob) {
            // Fallback if browser doesn't support the format (e.g. AVIF on older browsers)
            EditIt.showToast(ext.toUpperCase() + ' not supported by your browser, falling back to PNG', 'info');
            blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/png', 0.92));
          }
          const baseName = files[i].name.replace(/\.[^.]+$/, '');
          results.push({ blob, name: `${baseName}.${ext}`, originalSize: files[i].size });
        }

        EditIt.hideProgress();

        if (results.length === 1) {
          // Before/after preview for single image
          let previewHTML = '';
          try {
            const beforeUrl = await EditIt.readFileAsDataURL(files[0]);
            const afterUrl = URL.createObjectURL(results[0].blob);
            previewHTML = EditIt.previewCompareHTML(
              beforeUrl, afterUrl,
              `Original (${EditIt.getFileExtension(files[0].name).toUpperCase()})`,
              `Converted (${ext.toUpperCase()})`
            );
          } catch(e) {}

          outputEl.innerHTML = `
            <div class="output-card">
              <h3>✓ Image Converted!</h3>
              <p>${EditIt.formatFileSize(results[0].originalSize)} → ${EditIt.formatFileSize(results[0].blob.size)} (${ext.toUpperCase()})</p>
              ${previewHTML}
              <div class="output-filename">
                <label for="convert-image-filename">File name:</label>
                <input type="text" id="convert-image-filename" class="input" value="${results[0].name}">
              </div>
              <button class="btn btn-success" id="convert-image-download">Download ${ext.toUpperCase()}</button>
            </div>
          `;
          document.getElementById('convert-image-download').addEventListener('click', () => {
            const filename = document.getElementById('convert-image-filename').value.trim() || results[0].name;
            EditIt.downloadBlob(results[0].blob, filename);
          });
        } else {
          outputEl.innerHTML = `
            <div class="output-card">
              <h3>✓ ${results.length} Images Converted!</h3>
              <p>All images converted to ${ext.toUpperCase()}</p>
              <div class="output-filename">
                <label for="convert-image-zipname">ZIP name:</label>
                <input type="text" id="convert-image-zipname" class="input" value="converted_images.zip">
              </div>
              <button class="btn btn-success" id="convert-image-download-all">Download All (ZIP)</button>
            </div>
          `;
          document.getElementById('convert-image-download-all').addEventListener('click', async () => {
            const zip = new JSZip();
            results.forEach(r => zip.file(r.name, r.blob));
            const zipBlob = await zip.generateAsync({ type: 'blob' });
            const zipName = document.getElementById('convert-image-zipname').value.trim() || 'converted_images.zip';
            EditIt.downloadBlob(zipBlob, zipName);
          });
        }

        EditIt.showToast('Images converted successfully!', 'success');
      } catch (err) {
        console.error(err);
        EditIt.showToast('Error converting images: ' + err.message, 'error');
        EditIt.hideProgress();
      }

      EditIt.setButtonLoading(actionBtn, false);
    });
  })();

  // ===========================
  // RESIZE IMAGE
  // ===========================
  (function () {
    const fileListEl = document.getElementById('resize-image-files');
    const optionsEl = document.getElementById('resize-image-options');
    const widthInput = document.getElementById('resize-width');
    const heightInput = document.getElementById('resize-height');
    const lockRatio = document.getElementById('resize-lock-ratio');
    const previewEl = document.getElementById('resize-image-preview');
    const actionBtn = document.getElementById('resize-image-action');
    const outputEl = document.getElementById('resize-image-output');
    let imageFile = null;
    let originalWidth = 0;
    let originalHeight = 0;
    let aspectRatio = 1;
    let updatingSize = false;

    document.addEventListener('files-added', async (e) => {
      if (e.detail.toolId !== 'resize-image') return;
      const file = e.detail.files.find(f => f.type.startsWith('image/'));
      if (!file) {
        EditIt.showToast('Please select an image file', 'error');
        return;
      }

      imageFile = file;
      fileListEl.innerHTML = '';
      const item = EditIt.createFileItem(file, 0);
      item.querySelector('.file-item-remove').addEventListener('click', () => {
        imageFile = null;
        fileListEl.innerHTML = '';
        optionsEl.style.display = 'none';
        actionBtn.disabled = true;
        outputEl.innerHTML = '';
        previewEl.innerHTML = '';
      });
      fileListEl.appendChild(item);

      // Load image to get dimensions
      const dataUrl = await EditIt.readFileAsDataURL(file);
      const img = await EditIt.loadImage(dataUrl);
      originalWidth = img.naturalWidth;
      originalHeight = img.naturalHeight;
      aspectRatio = originalWidth / originalHeight;

      widthInput.value = originalWidth;
      heightInput.value = originalHeight;
      widthInput.placeholder = originalWidth;
      heightInput.placeholder = originalHeight;

      previewEl.innerHTML = `<img src="${dataUrl}" alt="Preview">`;

      optionsEl.style.display = 'block';
      actionBtn.disabled = false;
      outputEl.innerHTML = '';

      // Update file item with dimensions
      item.querySelector('.file-item-meta').textContent =
        `${EditIt.formatFileSize(file.size)} • ${originalWidth} × ${originalHeight} px`;
    });

    widthInput.addEventListener('input', () => {
      if (updatingSize) return;
      if (lockRatio.checked && widthInput.value) {
        updatingSize = true;
        heightInput.value = Math.round(parseInt(widthInput.value) / aspectRatio);
        updatingSize = false;
      }
    });

    heightInput.addEventListener('input', () => {
      if (updatingSize) return;
      if (lockRatio.checked && heightInput.value) {
        updatingSize = true;
        widthInput.value = Math.round(parseInt(heightInput.value) * aspectRatio);
        updatingSize = false;
      }
    });

    actionBtn.addEventListener('click', async () => {
      if (!imageFile) return;

      const newWidth = parseInt(widthInput.value) || originalWidth;
      const newHeight = parseInt(heightInput.value) || originalHeight;

      if (newWidth < 1 || newHeight < 1) {
        EditIt.showToast('Invalid dimensions', 'error');
        return;
      }

      EditIt.setButtonLoading(actionBtn, true);

      try {
        const dataUrl = await EditIt.readFileAsDataURL(imageFile);
        const img = await EditIt.loadImage(dataUrl);

        const canvas = document.createElement('canvas');
        canvas.width = newWidth;
        canvas.height = newHeight;
        const ctx = canvas.getContext('2d');

        // High quality resize
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';
        ctx.drawImage(img, 0, 0, newWidth, newHeight);

        // Preserve original format
        const mimeType = imageFile.type === 'image/png' ? 'image/png' :
                         imageFile.type === 'image/webp' ? 'image/webp' : 'image/jpeg';
        const ext = mimeType === 'image/png' ? 'png' : mimeType === 'image/webp' ? 'webp' : 'jpg';

        const blob = await new Promise(resolve => canvas.toBlob(resolve, mimeType, 0.92));
        const baseName = imageFile.name.replace(/\.[^.]+$/, '');

        // Before/after preview
        let compareHTML = '';
        try {
          const afterUrl = URL.createObjectURL(blob);
          compareHTML = EditIt.previewCompareHTML(
            dataUrl, afterUrl,
            `${originalWidth} × ${originalHeight} px`,
            `${newWidth} × ${newHeight} px`
          );
        } catch(e) {}

        const defaultResizeName = `${baseName}_${newWidth}x${newHeight}.${ext}`;
        outputEl.innerHTML = `
          <div class="output-card">
            <h3>✓ Image Resized!</h3>
            <p>${originalWidth}×${originalHeight} → ${newWidth}×${newHeight} • ${EditIt.formatFileSize(blob.size)}</p>
            ${compareHTML}
            <div class="output-filename">
              <label for="resize-image-filename">File name:</label>
              <input type="text" id="resize-image-filename" class="input" value="${defaultResizeName}">
            </div>
            <button class="btn btn-success" id="resize-image-download">Download Resized Image</button>
          </div>
        `;

        document.getElementById('resize-image-download').addEventListener('click', () => {
          const filename = document.getElementById('resize-image-filename').value.trim() || defaultResizeName;
          EditIt.downloadBlob(blob, filename);
        });

        EditIt.showToast('Image resized successfully!', 'success');
      } catch (err) {
        console.error(err);
        EditIt.showToast('Error resizing image: ' + err.message, 'error');
      }

      EditIt.setButtonLoading(actionBtn, false);
    });
  })();

  // ===========================
  // COMPRESS IMAGE
  // ===========================
  (function () {
    const fileListEl = document.getElementById('compress-image-files');
    const optionsEl = document.getElementById('compress-image-options');
    const qualitySlider = document.getElementById('compress-image-quality');
    const qualityVal = document.getElementById('compress-quality-val');
    const outputFormatSelect = document.getElementById('compress-image-output-format');
    const actionBtn = document.getElementById('compress-image-action');
    const outputEl = document.getElementById('compress-image-output');
    let files = [];

    qualitySlider.addEventListener('input', () => {
      qualityVal.textContent = qualitySlider.value + '%';
    });

    document.addEventListener('files-added', (e) => {
      if (e.detail.toolId !== 'compress-image') return;
      const imageFiles = e.detail.files.filter(f => f.type.startsWith('image/'));
      if (imageFiles.length === 0) {
        EditIt.showToast('Please select image files', 'error');
        return;
      }
      files.push(...imageFiles);
      renderFileList();
    });

    function renderFileList() {
      fileListEl.innerHTML = '';
      files.forEach((file, i) => {
        const item = EditIt.createFileItem(file, i);
        item.querySelector('.file-item-remove').addEventListener('click', () => {
          files.splice(i, 1);
          renderFileList();
        });
        fileListEl.appendChild(item);
      });
      actionBtn.disabled = files.length === 0;
      optionsEl.style.display = files.length > 0 ? 'block' : 'none';
      outputEl.innerHTML = '';
    }

    actionBtn.addEventListener('click', async () => {
      if (files.length === 0) return;
      EditIt.setButtonLoading(actionBtn, true);

      try {
        const quality = parseInt(qualitySlider.value) / 100;
        const mimeType = outputFormatSelect.value;
        const extMap = { 'image/jpeg': 'jpg', 'image/webp': 'webp', 'image/png': 'png' };
        const ext = extMap[mimeType] || 'jpg';
        const results = [];
        let totalOriginal = 0;
        let totalCompressed = 0;

        for (let i = 0; i < files.length; i++) {
          EditIt.showProgress(`Compressing image ${i + 1} of ${files.length}...`, ((i + 1) / files.length) * 90);

          const dataUrl = await EditIt.readFileAsDataURL(files[i]);
          const img = await EditIt.loadImage(dataUrl);

          const canvas = document.createElement('canvas');
          canvas.width = img.naturalWidth;
          canvas.height = img.naturalHeight;
          const ctx = canvas.getContext('2d');

          if (mimeType === 'image/jpeg') {
            ctx.fillStyle = '#ffffff';
            ctx.fillRect(0, 0, canvas.width, canvas.height);
          }

          ctx.drawImage(img, 0, 0);

          const blob = await new Promise(resolve => canvas.toBlob(resolve, mimeType, quality));
          const baseName = files[i].name.replace(/\.[^.]+$/, '');

          totalOriginal += files[i].size;
          totalCompressed += blob.size;

          results.push({
            blob,
            name: `${baseName}_compressed.${ext}`,
            originalSize: files[i].size,
            compressedSize: blob.size
          });
        }

        EditIt.hideProgress();

        const savings = ((1 - totalCompressed / totalOriginal) * 100).toFixed(1);

        if (results.length === 1) {
          // Before/after preview
          let compareHTML = '';
          try {
            const beforeUrl = await EditIt.readFileAsDataURL(files[0]);
            const afterUrl = URL.createObjectURL(results[0].blob);
            compareHTML = EditIt.previewCompareHTML(
              beforeUrl, afterUrl,
              `Original • ${EditIt.formatFileSize(results[0].originalSize)}`,
              `Compressed • ${EditIt.formatFileSize(results[0].compressedSize)}`
            );
          } catch(e) {}

          outputEl.innerHTML = `
            <div class="output-card">
              <h3>✓ Image Compressed!</h3>
              <p>${EditIt.formatFileSize(results[0].originalSize)} → ${EditIt.formatFileSize(results[0].compressedSize)} • Saved ${savings}%</p>
              ${compareHTML}
              <div class="output-filename">
                <label for="compress-image-filename">File name:</label>
                <input type="text" id="compress-image-filename" class="input" value="${results[0].name}">
              </div>
              <button class="btn btn-success" id="compress-image-download">Download Compressed Image</button>
            </div>
          `;
          document.getElementById('compress-image-download').addEventListener('click', () => {
            const filename = document.getElementById('compress-image-filename').value.trim() || results[0].name;
            EditIt.downloadBlob(results[0].blob, filename);
          });
        } else {
          outputEl.innerHTML = `
            <div class="output-card">
              <h3>✓ ${results.length} Images Compressed!</h3>
              <p>${EditIt.formatFileSize(totalOriginal)} → ${EditIt.formatFileSize(totalCompressed)} • Saved ${savings}%</p>
              <div class="output-filename">
                <label for="compress-image-zipname">ZIP name:</label>
                <input type="text" id="compress-image-zipname" class="input" value="compressed_images.zip">
              </div>
              <button class="btn btn-success" id="compress-image-download-all">Download All (ZIP)</button>
            </div>
          `;
          document.getElementById('compress-image-download-all').addEventListener('click', async () => {
            const zip = new JSZip();
            results.forEach(r => zip.file(r.name, r.blob));
            const zipBlob = await zip.generateAsync({ type: 'blob' });
            const zipName = document.getElementById('compress-image-zipname').value.trim() || 'compressed_images.zip';
            EditIt.downloadBlob(zipBlob, zipName);
          });
        }

        EditIt.showToast('Images compressed successfully!', 'success');
      } catch (err) {
        console.error(err);
        EditIt.showToast('Error compressing images: ' + err.message, 'error');
        EditIt.hideProgress();
      }

      EditIt.setButtonLoading(actionBtn, false);
    });
  })();

  // ===========================
  // CROP IMAGE
  // ===========================
  (function () {
    const workspace = document.getElementById('crop-workspace');
    const canvas = document.getElementById('crop-canvas');
    const overlay = document.getElementById('crop-overlay');
    const dimensionsEl = document.getElementById('crop-dimensions');
    const actionBtn = document.getElementById('crop-image-action');
    const outputEl = document.getElementById('crop-image-output');
    const ctx = canvas.getContext('2d');
    let imageFile = null;
    let loadedImage = null;
    let displayScale = 1;

    // Crop selection state
    let isDragging = false;
    let startX = 0, startY = 0;
    let cropX = 0, cropY = 0, cropW = 0, cropH = 0;

    document.addEventListener('files-added', async (e) => {
      if (e.detail.toolId !== 'crop-image') return;
      const file = e.detail.files.find(f => f.type.startsWith('image/'));
      if (!file) {
        EditIt.showToast('Please select an image file', 'error');
        return;
      }

      imageFile = file;
      outputEl.innerHTML = '';

      const dataUrl = await EditIt.readFileAsDataURL(file);
      loadedImage = await EditIt.loadImage(dataUrl);

      // Set canvas size (limit display width)
      const maxDisplayWidth = Math.min(loadedImage.naturalWidth, 800);
      displayScale = maxDisplayWidth / loadedImage.naturalWidth;
      canvas.width = loadedImage.naturalWidth * displayScale;
      canvas.height = loadedImage.naturalHeight * displayScale;

      ctx.drawImage(loadedImage, 0, 0, canvas.width, canvas.height);

      workspace.style.display = 'block';
      actionBtn.disabled = true;
      overlay.style.display = 'none';
      dimensionsEl.textContent = `Image: ${loadedImage.naturalWidth} × ${loadedImage.naturalHeight} — Click and drag to select crop area`;
    });

    const canvasWrap = canvas.parentElement;

    canvasWrap.addEventListener('mousedown', (e) => {
      if (!loadedImage) return;
      const rect = canvas.getBoundingClientRect();
      startX = e.clientX - rect.left;
      startY = e.clientY - rect.top;
      isDragging = true;
      overlay.style.display = 'block';
      overlay.style.left = startX + 'px';
      overlay.style.top = startY + 'px';
      overlay.style.width = '0px';
      overlay.style.height = '0px';
    });

    document.addEventListener('mousemove', (e) => {
      if (!isDragging) return;
      const rect = canvas.getBoundingClientRect();
      const currentX = Math.max(0, Math.min(e.clientX - rect.left, canvas.width));
      const currentY = Math.max(0, Math.min(e.clientY - rect.top, canvas.height));

      cropX = Math.min(startX, currentX);
      cropY = Math.min(startY, currentY);
      cropW = Math.abs(currentX - startX);
      cropH = Math.abs(currentY - startY);

      overlay.style.left = cropX + 'px';
      overlay.style.top = cropY + 'px';
      overlay.style.width = cropW + 'px';
      overlay.style.height = cropH + 'px';

      // Show real pixel dimensions
      const realW = Math.round(cropW / displayScale);
      const realH = Math.round(cropH / displayScale);
      dimensionsEl.textContent = `Selection: ${realW} × ${realH} px`;
    });

    document.addEventListener('mouseup', () => {
      if (!isDragging) return;
      isDragging = false;
      actionBtn.disabled = cropW < 5 || cropH < 5;
    });

    // Touch support
    canvasWrap.addEventListener('touchstart', (e) => {
      if (!loadedImage) return;
      e.preventDefault();
      const touch = e.touches[0];
      const rect = canvas.getBoundingClientRect();
      startX = touch.clientX - rect.left;
      startY = touch.clientY - rect.top;
      isDragging = true;
      overlay.style.display = 'block';
    }, { passive: false });

    document.addEventListener('touchmove', (e) => {
      if (!isDragging) return;
      e.preventDefault();
      const touch = e.touches[0];
      const rect = canvas.getBoundingClientRect();
      const currentX = Math.max(0, Math.min(touch.clientX - rect.left, canvas.width));
      const currentY = Math.max(0, Math.min(touch.clientY - rect.top, canvas.height));

      cropX = Math.min(startX, currentX);
      cropY = Math.min(startY, currentY);
      cropW = Math.abs(currentX - startX);
      cropH = Math.abs(currentY - startY);

      overlay.style.left = cropX + 'px';
      overlay.style.top = cropY + 'px';
      overlay.style.width = cropW + 'px';
      overlay.style.height = cropH + 'px';

      const realW = Math.round(cropW / displayScale);
      const realH = Math.round(cropH / displayScale);
      dimensionsEl.textContent = `Selection: ${realW} × ${realH} px`;
    }, { passive: false });

    document.addEventListener('touchend', () => {
      if (!isDragging) return;
      isDragging = false;
      actionBtn.disabled = cropW < 5 || cropH < 5;
    });

    actionBtn.addEventListener('click', async () => {
      if (!loadedImage || cropW < 5 || cropH < 5) return;
      EditIt.setButtonLoading(actionBtn, true);

      try {
        // Convert display coords to real image coords
        const realX = Math.round(cropX / displayScale);
        const realY = Math.round(cropY / displayScale);
        const realW = Math.round(cropW / displayScale);
        const realH = Math.round(cropH / displayScale);

        const cropCanvas = document.createElement('canvas');
        cropCanvas.width = realW;
        cropCanvas.height = realH;
        const cropCtx = cropCanvas.getContext('2d');
        cropCtx.drawImage(loadedImage, realX, realY, realW, realH, 0, 0, realW, realH);

        const mimeType = imageFile.type === 'image/png' ? 'image/png' :
                         imageFile.type === 'image/webp' ? 'image/webp' : 'image/jpeg';
        const ext = mimeType === 'image/png' ? 'png' : mimeType === 'image/webp' ? 'webp' : 'jpg';

        const blob = await new Promise(resolve => cropCanvas.toBlob(resolve, mimeType, 0.92));
        const baseName = imageFile.name.replace(/\.[^.]+$/, '');
        const url = URL.createObjectURL(blob);

        const defaultCropName = `${baseName}_cropped.${ext}`;
        outputEl.innerHTML = `
          <div class="output-card">
            <h3>✓ Image Cropped!</h3>
            <p>${realW} × ${realH} px • ${EditIt.formatFileSize(blob.size)}</p>
            <div style="margin: 16px 0; max-width: 400px; display: inline-block;">
              <img src="${url}" style="width: 100%; border-radius: 8px; border: 1px solid var(--border);" alt="Cropped">
            </div><br>
            <div class="output-filename">
              <label for="crop-image-filename">File name:</label>
              <input type="text" id="crop-image-filename" class="input" value="${defaultCropName}">
            </div>
            <button class="btn btn-success" id="crop-image-download">Download Cropped Image</button>
          </div>
        `;

        document.getElementById('crop-image-download').addEventListener('click', () => {
          const filename = document.getElementById('crop-image-filename').value.trim() || defaultCropName;
          EditIt.downloadBlob(blob, filename);
        });

        EditIt.showToast('Image cropped successfully!', 'success');
      } catch (err) {
        console.error(err);
        EditIt.showToast('Error cropping image: ' + err.message, 'error');
      }

      EditIt.setButtonLoading(actionBtn, false);
    });
  })();

})();


// ===== file.tools — Extended PDF & Conversion Tools =====

(function () {
  'use strict';

  const { PDFDocument, rgb, degrees, StandardFonts } = PDFLib;

  // Helper: standard single-file PDF tool setup
  function setupPdfTool(toolId, onFile, onAction) {
    const fileListEl = document.getElementById(toolId + '-files');
    const actionBtn = document.getElementById(toolId + '-action');
    const outputEl = document.getElementById(toolId + '-output');
    let file = null;

    document.addEventListener('files-added', (e) => {
      if (e.detail.toolId !== toolId) return;
      const f = e.detail.files.find(f => f.type === 'application/pdf' || f.name.endsWith('.pdf'));
      if (!f) { EditIt.showToast('Please select a PDF file', 'error'); return; }
      file = f;
      if (fileListEl) {
        fileListEl.innerHTML = '';
        const item = EditIt.createFileItem(f, 0);
        item.querySelector('.file-item-remove').addEventListener('click', () => {
          file = null; fileListEl.innerHTML = ''; actionBtn.disabled = true; outputEl.innerHTML = '';
          document.querySelectorAll('#' + toolId + '-view .tool-options, #' + toolId + '-view [id$="-container"]').forEach(el => el.style.display = 'none');
        });
        fileListEl.appendChild(item);
        EditIt.readFileAsArrayBuffer(f).then(b => EditIt.renderPdfPageToDataURL(b, 1, 0.3)).then(u => EditIt.setFileItemThumb(item, u)).catch(() => {});
      }
      actionBtn.disabled = false;
      outputEl.innerHTML = '';
      if (onFile) onFile(f);
    });

    actionBtn.addEventListener('click', async () => {
      if (!file) return;
      EditIt.setButtonLoading(actionBtn, true);
      try { await onAction(file, outputEl); }
      catch (err) { console.error(err); EditIt.showToast('Error: ' + err.message, 'error'); EditIt.hideProgress(); }
      EditIt.setButtonLoading(actionBtn, false);
    });
  }

  // Helper: standard single-file generic tool setup (non-PDF)
  function setupFileTool(toolId, acceptCheck, onAction) {
    const fileListEl = document.getElementById(toolId + '-files');
    const actionBtn = document.getElementById(toolId + '-action');
    const outputEl = document.getElementById(toolId + '-output');
    let file = null;

    document.addEventListener('files-added', (e) => {
      if (e.detail.toolId !== toolId) return;
      const f = e.detail.files.find(acceptCheck);
      if (!f) { EditIt.showToast('Unsupported file type', 'error'); return; }
      file = f;
      if (fileListEl) {
        fileListEl.innerHTML = '';
        const item = EditIt.createFileItem(f, 0);
        item.querySelector('.file-item-remove').addEventListener('click', () => {
          file = null; fileListEl.innerHTML = ''; actionBtn.disabled = true; outputEl.innerHTML = '';
        });
        fileListEl.appendChild(item);
      }
      actionBtn.disabled = false;
      outputEl.innerHTML = '';
    });

    actionBtn.addEventListener('click', async () => {
      if (!file) return;
      EditIt.setButtonLoading(actionBtn, true);
      try { await onAction(file, outputEl); }
      catch (err) { console.error(err); EditIt.showToast('Error: ' + err.message, 'error'); EditIt.hideProgress(); }
      EditIt.setButtonLoading(actionBtn, false);
    });
  }

  // Helper: output card with download
  function outputCard(outputEl, title, info, blob, defaultName, previewHTML) {
    outputEl.innerHTML = `<div class="output-card"><h3>✓ ${title}</h3><p>${info}</p>${previewHTML || ''}<div class="output-filename"><label>File name:</label><input type="text" class="input output-dl-name" value="${defaultName}"></div><button class="btn btn-success output-dl-btn">Download</button></div>`;
    outputEl.querySelector('.output-dl-btn').addEventListener('click', () => {
      EditIt.downloadBlob(blob, outputEl.querySelector('.output-dl-name').value.trim() || defaultName);
    });
  }

  // Helper: extract all text from PDF using PDF.js
  async function extractPdfText(arrayBuffer) {
    const pdf = await pdfjsLib.getDocument({ data: new Uint8Array(arrayBuffer) }).promise;
    const pages = [];
    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);
      const content = await page.getTextContent();
      pages.push(content.items.map(item => item.str).join(' '));
    }
    return pages;
  }

  // ===========================
  // 1. WATERMARK PDF
  // ===========================
  (function () {
    const optionsEl = document.getElementById('watermark-pdf-options');
    const opSlider = document.getElementById('watermark-opacity');
    const opVal = document.getElementById('watermark-opacity-val');
    const rotSlider = document.getElementById('watermark-rotation');
    const rotVal = document.getElementById('watermark-rotation-val');
    opSlider.addEventListener('input', () => opVal.textContent = opSlider.value + '%');
    rotSlider.addEventListener('input', () => rotVal.textContent = rotSlider.value + '°');

    setupPdfTool('watermark-pdf',
      () => { optionsEl.style.display = 'block'; },
      async (file, outputEl) => {
        const bytes = await EditIt.readFileAsArrayBuffer(file);
        const pdfDoc = await PDFDocument.load(bytes);
        const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
        const text = document.getElementById('watermark-text').value || 'WATERMARK';
        const fontSize = parseInt(document.getElementById('watermark-size').value) || 60;
        const hex = document.getElementById('watermark-color').value;
        const r = parseInt(hex.slice(1, 3), 16) / 255, g = parseInt(hex.slice(3, 5), 16) / 255, b = parseInt(hex.slice(5, 7), 16) / 255;
        const opacity = parseFloat(opSlider.value) / 100;
        const rot = parseInt(rotSlider.value) || -45;
        const pages = pdfDoc.getPages();
        pages.forEach(page => {
          const { width, height } = page.getSize();
          const tw = font.widthOfTextAtSize(text, fontSize);
          page.drawText(text, { x: (width - tw) / 2, y: height / 2, size: fontSize, font, color: rgb(r, g, b), opacity, rotate: degrees(rot) });
        });
        const saved = await pdfDoc.save();
        const blob = new Blob([saved], { type: 'application/pdf' });
        let pv = ''; try { const u = await EditIt.renderPdfPageToDataURL(saved, 1, 0.7); pv = EditIt.outputPreviewHTML(u, 'Watermarked preview'); } catch (e) { }
        outputCard(outputEl, 'Watermark Added!', `${pages.length} pages • ${EditIt.formatFileSize(blob.size)}`, blob, file.name.replace('.pdf', '') + '_watermarked.pdf', pv);
        EditIt.showToast('Watermark added!', 'success');
      }
    );
  })();

  // ===========================
  // 2. PAGE NUMBERS
  // ===========================
  (function () {
    const optionsEl = document.getElementById('page-numbers-options');
    setupPdfTool('page-numbers',
      () => { optionsEl.style.display = 'block'; },
      async (file, outputEl) => {
        const bytes = await EditIt.readFileAsArrayBuffer(file);
        const pdfDoc = await PDFDocument.load(bytes);
        const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
        const pages = pdfDoc.getPages();
        const pos = document.getElementById('pn-position').value;
        const startNum = parseInt(document.getElementById('pn-start').value) || 1;
        const fmt = document.getElementById('pn-format').value;
        const fontSize = parseInt(document.getElementById('pn-size').value) || 11;
        const total = pages.length;

        pages.forEach((page, i) => {
          const num = startNum + i;
          let label = '' + num;
          if (fmt === 'page') label = 'Page ' + num;
          else if (fmt === 'of') label = num + ' of ' + (startNum + total - 1);
          else if (fmt === 'dash') label = '— ' + num + ' —';
          const { width, height } = page.getSize();
          const tw = font.widthOfTextAtSize(label, fontSize);
          let x, y;
          if (pos.startsWith('bottom')) y = 30; else y = height - 30;
          if (pos.endsWith('center')) x = (width - tw) / 2;
          else if (pos.endsWith('right')) x = width - tw - 40;
          else x = 40;
          page.drawText(label, { x, y, size: fontSize, font, color: rgb(0.3, 0.3, 0.3) });
        });

        const saved = await pdfDoc.save();
        const blob = new Blob([saved], { type: 'application/pdf' });
        let pv = ''; try { const u = await EditIt.renderPdfPageToDataURL(saved, 1, 0.7); pv = EditIt.outputPreviewHTML(u, 'Page numbers preview'); } catch (e) { }
        outputCard(outputEl, 'Page Numbers Added!', `${pages.length} pages numbered • ${EditIt.formatFileSize(blob.size)}`, blob, file.name.replace('.pdf', '') + '_numbered.pdf', pv);
        EditIt.showToast('Page numbers added!', 'success');
      }
    );
  })();

  // ===========================
  // 3. SIGN PDF (Visual Placement)
  // ===========================
  (function () {
    const editorEl = document.getElementById('sign-pdf-editor');
    const signCanvas = document.getElementById('sign-canvas');
    const signCtx = signCanvas.getContext('2d');
    const pdfCanvas = document.getElementById('sign-pdf-canvas');
    const overlayEl = document.getElementById('sign-pdf-overlay');
    const actionBtn = document.getElementById('sign-pdf-action');
    const outputEl = document.getElementById('sign-pdf-output');
    const fileListEl = document.getElementById('sign-pdf-files');
    const pageInfoEl = document.getElementById('sign-pdf-page-info');
    const prevBtn = document.getElementById('sign-pdf-prev');
    const nextBtn = document.getElementById('sign-pdf-next');

    const RENDER_SCALE = 1.5;
    let pdfFile = null, pdfBytes = null, pdfJsDoc = null;
    let currentPage = 1, totalPages = 0;
    let pageDimsPt = {};
    let drawing = false, hasSignature = false;
    let placements = []; // { id, page, xPct, yPct, wPct, sigDataUrl, aspectRatio }
    let nextId = 1;

    // ---- Signature drawing pad ----
    function clearSignPad() {
      signCtx.fillStyle = '#fff';
      signCtx.fillRect(0, 0, signCanvas.width, signCanvas.height);
      hasSignature = false;
    }
    document.getElementById('sign-clear').addEventListener('click', clearSignPad);

    signCanvas.addEventListener('mousedown', (e) => { drawing = true; signCtx.beginPath(); signCtx.moveTo(e.offsetX, e.offsetY); });
    signCanvas.addEventListener('mousemove', (e) => { if (!drawing) return; signCtx.strokeStyle = document.getElementById('sign-color').value; signCtx.lineWidth = 2.5; signCtx.lineCap = 'round'; signCtx.lineTo(e.offsetX, e.offsetY); signCtx.stroke(); hasSignature = true; });
    document.addEventListener('mouseup', () => { drawing = false; });

    signCanvas.addEventListener('touchstart', (e) => { e.preventDefault(); const r = signCanvas.getBoundingClientRect(); const t = e.touches[0]; drawing = true; signCtx.beginPath(); signCtx.moveTo(t.clientX - r.left, t.clientY - r.top); }, { passive: false });
    signCanvas.addEventListener('touchmove', (e) => { e.preventDefault(); if (!drawing) return; const r = signCanvas.getBoundingClientRect(); const t = e.touches[0]; signCtx.strokeStyle = document.getElementById('sign-color').value; signCtx.lineWidth = 2.5; signCtx.lineCap = 'round'; signCtx.lineTo(t.clientX - r.left, t.clientY - r.top); signCtx.stroke(); hasSignature = true; }, { passive: false });
    document.addEventListener('touchend', () => { drawing = false; });

    // ---- File upload ----
    document.addEventListener('files-added', async (e) => {
      if (e.detail.toolId !== 'sign-pdf') return;
      const f = e.detail.files.find(f => f.type === 'application/pdf' || f.name.endsWith('.pdf'));
      if (!f) { EditIt.showToast('Please select a PDF file', 'error'); return; }

      pdfFile = f;
      pdfBytes = await EditIt.readFileAsArrayBuffer(f);
      placements = []; nextId = 1; currentPage = 1; pageDimsPt = {};
      outputEl.innerHTML = '';

      fileListEl.innerHTML = '';
      const item = EditIt.createFileItem(f, 0);
      item.querySelector('.file-item-remove').addEventListener('click', () => {
        pdfFile = null; pdfBytes = null; pdfJsDoc = null;
        fileListEl.innerHTML = ''; editorEl.style.display = 'none';
        actionBtn.disabled = true; outputEl.innerHTML = '';
        placements = [];
      });
      fileListEl.appendChild(item);
      EditIt.readFileAsArrayBuffer(f).then(b => EditIt.renderPdfPageToDataURL(b, 1, 0.3))
        .then(u => EditIt.setFileItemThumb(item, u)).catch(() => {});

      try {
        pdfJsDoc = await pdfjsLib.getDocument({ data: pdfBytes.slice(0) }).promise;
        totalPages = pdfJsDoc.numPages;
        for (let i = 1; i <= totalPages; i++) {
          const pg = await pdfJsDoc.getPage(i);
          const vp = pg.getViewport({ scale: 1 });
          pageDimsPt[i] = { w: vp.width, h: vp.height };
        }
        editorEl.style.display = 'block';
        actionBtn.disabled = false;
        clearSignPad();
        await renderPage();
        EditIt.showToast(`Loaded ${totalPages} page${totalPages > 1 ? 's' : ''} — draw your signature, then click on the page to place it`, 'info');
      } catch (err) { EditIt.showToast('Error loading PDF: ' + err.message, 'error'); }
    });

    // ---- Render current page ----
    async function renderPage() {
      const page = await pdfJsDoc.getPage(currentPage);
      const viewport = page.getViewport({ scale: RENDER_SCALE });
      pdfCanvas.width = viewport.width;
      pdfCanvas.height = viewport.height;
      await page.render({ canvasContext: pdfCanvas.getContext('2d'), viewport }).promise;

      pageInfoEl.textContent = `${currentPage} / ${totalPages}`;
      prevBtn.disabled = currentPage <= 1;
      nextBtn.disabled = currentPage >= totalPages;

      renderPlacements();
    }

    // ---- Render signature placements for current page ----
    function renderPlacements() {
      overlayEl.innerHTML = '';
      placements.filter(p => p.page === currentPage).forEach(p => {
        overlayEl.appendChild(createPlacementEl(p));
      });
    }

    function createPlacementEl(pl) {
      const ow = overlayEl.offsetWidth;
      const oh = overlayEl.offsetHeight;

      const el = document.createElement('div');
      el.className = 'sig-placement';
      el.dataset.id = pl.id;
      el.style.left = (pl.xPct * ow) + 'px';
      el.style.top = (pl.yPct * oh) + 'px';
      el.style.width = (pl.wPct * ow) + 'px';
      el.style.height = (pl.wPct * ow / pl.aspectRatio) + 'px';

      const img = document.createElement('img');
      img.src = pl.sigDataUrl;
      img.draggable = false;
      el.appendChild(img);

      // Delete button
      const delBtn = document.createElement('button');
      delBtn.className = 'sig-placement-del';
      delBtn.textContent = '✕';
      delBtn.title = 'Remove';
      delBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        placements = placements.filter(p => p.id !== pl.id);
        el.remove();
      });
      el.appendChild(delBtn);

      // Resize handle
      const handle = document.createElement('div');
      handle.className = 'sig-resize-handle';
      handle.addEventListener('pointerdown', (e) => {
        e.stopPropagation();
        e.preventDefault();
        beginResize(e, el, pl);
      });
      el.appendChild(handle);

      // Drag to reposition
      el.addEventListener('pointerdown', (e) => {
        if (e.target.closest('.sig-placement-del') || e.target.closest('.sig-resize-handle')) return;
        e.stopPropagation();
        e.preventDefault();
        selectPlacement(el);
        beginDrag(e, el, pl);
      });

      return el;
    }

    function selectPlacement(el) {
      overlayEl.querySelectorAll('.sig-placement.selected').forEach(s => s.classList.remove('selected'));
      el.classList.add('selected');
    }

    // ---- Drag to move ----
    function beginDrag(e, el, pl) {
      const overlayRect = overlayEl.getBoundingClientRect();
      const startX = e.clientX, startY = e.clientY;
      const origLeft = pl.xPct * overlayRect.width;
      const origTop = pl.yPct * overlayRect.height;

      function onMove(ev) {
        ev.preventDefault();
        const dx = ev.clientX - startX, dy = ev.clientY - startY;
        const newLeft = Math.max(0, Math.min(origLeft + dx, overlayRect.width - 20));
        const newTop = Math.max(0, Math.min(origTop + dy, overlayRect.height - 20));
        el.style.left = newLeft + 'px';
        el.style.top = newTop + 'px';
        pl.xPct = newLeft / overlayRect.width;
        pl.yPct = newTop / overlayRect.height;
      }
      function onUp() {
        document.removeEventListener('pointermove', onMove);
        document.removeEventListener('pointerup', onUp);
      }
      document.addEventListener('pointermove', onMove);
      document.addEventListener('pointerup', onUp);
    }

    // ---- Drag corner to resize ----
    function beginResize(e, el, pl) {
      const overlayRect = overlayEl.getBoundingClientRect();
      const startX = e.clientX;
      const origW = pl.wPct * overlayRect.width;

      function onMove(ev) {
        ev.preventDefault();
        const dx = ev.clientX - startX;
        const newW = Math.max(40, origW + dx);
        const newWPct = newW / overlayRect.width;
        pl.wPct = newWPct;
        el.style.width = newW + 'px';
        el.style.height = (newW / pl.aspectRatio) + 'px';
      }
      function onUp() {
        document.removeEventListener('pointermove', onMove);
        document.removeEventListener('pointerup', onUp);
      }
      document.addEventListener('pointermove', onMove);
      document.addEventListener('pointerup', onUp);
    }

    // ---- Click on overlay to place signature ----
    overlayEl.addEventListener('click', (e) => {
      if (e.target !== overlayEl) return;
        if (!hasSignature) { EditIt.showToast('Please draw your signature first', 'error'); return; }

      const rect = overlayEl.getBoundingClientRect();
      const sigDataUrl = signCanvas.toDataURL('image/png');
      const aspectRatio = signCanvas.width / signCanvas.height;
      const defaultWPct = 0.22; // default signature width = 22% of page width

      const clickXPct = (e.clientX - rect.left) / rect.width;
      const clickYPct = (e.clientY - rect.top) / rect.height;
      // Center the signature on the click point
      const xPct = Math.max(0, Math.min(clickXPct - defaultWPct / 2, 1 - defaultWPct));
      const hPct = defaultWPct / aspectRatio * (rect.width / rect.height);
      const yPct = Math.max(0, Math.min(clickYPct - hPct / 2, 1 - hPct));

      const pl = { id: nextId++, page: currentPage, xPct, yPct, wPct: defaultWPct, sigDataUrl, aspectRatio };
      placements.push(pl);

      const el = createPlacementEl(pl);
      overlayEl.appendChild(el);
      selectPlacement(el);
    });

    // ---- Deselect on click outside ----
    document.addEventListener('pointerdown', (e) => {
      if (!e.target.closest('.sig-placement') && !e.target.closest('.pdf-editor-toolbar') && !e.target.closest('.sign-draw-section')) {
        overlayEl.querySelectorAll('.sig-placement.selected').forEach(s => s.classList.remove('selected'));
      }
    });

    // ---- Delete selected with keyboard ----
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Delete' || e.key === 'Backspace') {
        if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.tagName === 'SELECT') return;
        const sel = overlayEl.querySelector('.sig-placement.selected');
        if (sel) {
          const id = parseInt(sel.dataset.id);
          placements = placements.filter(p => p.id !== id);
          sel.remove();
        }
      }
    });

    // ---- Page navigation ----
    prevBtn.addEventListener('click', () => { if (currentPage > 1) { currentPage--; renderPage(); } });
    nextBtn.addEventListener('click', () => { if (currentPage < totalPages) { currentPage++; renderPage(); } });

    // ---- Save signed PDF ----
    actionBtn.addEventListener('click', async () => {
      if (!pdfBytes) return;
      if (placements.length === 0) { EditIt.showToast('Place at least one signature on the page', 'error'); return; }
      EditIt.setButtonLoading(actionBtn, true);
      try {
        const pdfDoc = await PDFDocument.load(pdfBytes);

        // Group placements by unique sigDataUrl to avoid embedding the same image multiple times
        const sigCache = {};
        for (const pl of placements) {
          if (!sigCache[pl.sigDataUrl]) {
            const sigBytes = Uint8Array.from(atob(pl.sigDataUrl.split(',')[1]), c => c.charCodeAt(0));
            sigCache[pl.sigDataUrl] = await pdfDoc.embedPng(sigBytes);
          }
        }

        for (const pl of placements) {
          const page = pdfDoc.getPage(pl.page - 1);
          const W = page.getWidth();
          const H = page.getHeight();

          const sigW = pl.wPct * W;
          const sigH = sigW / pl.aspectRatio;
          const pdfX = pl.xPct * W;
          const pdfY = H - (pl.yPct * H) - sigH;

          page.drawImage(sigCache[pl.sigDataUrl], { x: pdfX, y: pdfY, width: sigW, height: sigH });
        }

        const saved = await pdfDoc.save();
        const blob = new Blob([saved], { type: 'application/pdf' });
        const previewPage = placements[0].page;
        let pv = ''; try { const u = await EditIt.renderPdfPageToDataURL(saved, previewPage, 0.7); pv = EditIt.outputPreviewHTML(u, 'Signed PDF preview'); } catch (e) {}
        outputCard(outputEl, 'PDF Signed!', `${placements.length} signature${placements.length !== 1 ? 's' : ''} placed`, blob, pdfFile.name.replace('.pdf', '') + '_signed.pdf', pv);
        EditIt.showToast('PDF signed successfully!', 'success');
      } catch (err) { console.error(err); EditIt.showToast('Error: ' + err.message, 'error'); }
      EditIt.setButtonLoading(actionBtn, false);
    });
  })();

  // ===========================
  // 4. EDIT PDF (Visual Editor)
  // ===========================
  (function () {
    const editorEl = document.getElementById('edit-pdf-editor');
    const canvasEl = document.getElementById('edit-pdf-canvas');
    const overlayEl = document.getElementById('edit-pdf-overlay');
    const canvasWrap = document.getElementById('edit-pdf-canvas-wrap');
    const actionBtn = document.getElementById('edit-pdf-action');
    const outputEl = document.getElementById('edit-pdf-output');
    const fileListEl = document.getElementById('edit-pdf-files');
    const sizeInput = document.getElementById('edit-pdf-size');
    const colorInput = document.getElementById('edit-pdf-color');
    const opacityInput = document.getElementById('edit-pdf-opacity');
    const opacityVal = document.getElementById('edit-pdf-opacity-val');
    const pageInfoEl = document.getElementById('edit-pdf-page-info');
    const prevBtn = document.getElementById('edit-pdf-prev');
    const nextBtn = document.getElementById('edit-pdf-next');

    // Live opacity label
    opacityInput.addEventListener('input', () => { opacityVal.textContent = opacityInput.value + '%'; });

    const RENDER_SCALE = 1.5;
    let pdfFile = null, pdfBytes = null, pdfJsDoc = null;
    let currentPage = 1, totalPages = 0;
    let pageDimsPt = {}; // { pageNum: { w, h } } — PDF point dimensions per page
    let annotations = []; // { id, page, xPct, yPct, text, fontSize, color, opacity }
    let nextId = 1;

    // ---- File upload ----
    document.addEventListener('files-added', async (e) => {
      if (e.detail.toolId !== 'edit-pdf') return;
      const f = e.detail.files.find(f => f.type === 'application/pdf' || f.name.endsWith('.pdf'));
      if (!f) { EditIt.showToast('Please select a PDF file', 'error'); return; }

      pdfFile = f;
      pdfBytes = await EditIt.readFileAsArrayBuffer(f);
      annotations = []; nextId = 1; currentPage = 1; pageDimsPt = {};
      outputEl.innerHTML = '';

      fileListEl.innerHTML = '';
      const item = EditIt.createFileItem(f, 0);
      item.querySelector('.file-item-remove').addEventListener('click', () => {
        pdfFile = null; pdfBytes = null; pdfJsDoc = null;
        fileListEl.innerHTML = ''; editorEl.style.display = 'none';
        actionBtn.disabled = true; outputEl.innerHTML = '';
        annotations = [];
      });
      fileListEl.appendChild(item);
      EditIt.readFileAsArrayBuffer(f).then(b => EditIt.renderPdfPageToDataURL(b, 1, 0.3))
        .then(u => EditIt.setFileItemThumb(item, u)).catch(() => {});

      try {
        pdfJsDoc = await pdfjsLib.getDocument({ data: pdfBytes.slice(0) }).promise;
        totalPages = pdfJsDoc.numPages;
        // Cache page dimensions in PDF points
        for (let i = 1; i <= totalPages; i++) {
          const pg = await pdfJsDoc.getPage(i);
          const vp = pg.getViewport({ scale: 1 });
          pageDimsPt[i] = { w: vp.width, h: vp.height };
        }
        editorEl.style.display = 'block';
        actionBtn.disabled = false;
        await renderPage();
        EditIt.showToast(`Loaded ${totalPages} page${totalPages > 1 ? 's' : ''} — click on the page to add text`, 'info');
      } catch (err) { EditIt.showToast('Error loading PDF: ' + err.message, 'error'); }
    });

    // ---- Render current page ----
    async function renderPage() {
      const page = await pdfJsDoc.getPage(currentPage);
      const viewport = page.getViewport({ scale: RENDER_SCALE });
      canvasEl.width = viewport.width;
      canvasEl.height = viewport.height;
      await page.render({ canvasContext: canvasEl.getContext('2d'), viewport }).promise;

      pageInfoEl.textContent = `${currentPage} / ${totalPages}`;
      prevBtn.disabled = currentPage <= 1;
      nextBtn.disabled = currentPage >= totalPages;

      renderAnnotations();
    }

    // ---- Display scale: CSS px per PDF point ----
    function displayScale() {
      const dims = pageDimsPt[currentPage];
      if (!dims) return 1;
      return overlayEl.offsetHeight / dims.h;
    }

    // ---- Render annotation overlays for current page ----
    function renderAnnotations() {
      overlayEl.innerHTML = '';
      annotations.filter(a => a.page === currentPage).forEach(a => {
        overlayEl.appendChild(createAnnotationEl(a));
      });
    }

    function createAnnotationEl(ann) {
      const el = document.createElement('div');
      el.className = 'pdf-annotation';
      el.dataset.id = ann.id;

      positionAnnotationEl(el, ann);

      const textSpan = document.createElement('span');
      textSpan.className = 'annotation-text';
      textSpan.textContent = ann.text;
      el.appendChild(textSpan);

      // Delete button
      const delBtn = document.createElement('button');
      delBtn.className = 'annotation-del';
      delBtn.textContent = '✕';
      delBtn.title = 'Remove';
      delBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        annotations = annotations.filter(a => a.id !== ann.id);
        el.remove();
      });
      el.appendChild(delBtn);

      // Double-click to edit text
      el.addEventListener('dblclick', (e) => {
        e.stopPropagation();
        beginInlineEdit(el, ann);
      });

      // Mousedown to select & drag
      el.addEventListener('pointerdown', (e) => {
        if (e.target.closest('.annotation-del') || e.target.closest('.annotation-input')) return;
        e.stopPropagation();
        e.preventDefault();
        selectAnnotation(el);
        if (!el.querySelector('.annotation-input')) {
          beginDrag(e, el, ann);
        }
      });

      return el;
    }

    function positionAnnotationEl(el, ann) {
      const ow = overlayEl.offsetWidth;
      const oh = overlayEl.offsetHeight;
      const s = displayScale();
      el.style.left = (ann.xPct * ow) + 'px';
      el.style.top = (ann.yPct * oh) + 'px';
      el.style.fontSize = (ann.fontSize * s) + 'px';
      el.style.color = ann.color;
      el.style.opacity = ann.opacity;
    }

    function selectAnnotation(el) {
      overlayEl.querySelectorAll('.pdf-annotation.selected').forEach(a => a.classList.remove('selected'));
      el.classList.add('selected');
    }

    // ---- Inline text editing ----
    function beginInlineEdit(el, ann) {
      if (el.querySelector('.annotation-input')) return;
      selectAnnotation(el);
      const textSpan = el.querySelector('.annotation-text');
      textSpan.style.display = 'none';

      const input = document.createElement('textarea');
      input.className = 'annotation-input';
      input.value = ann.text;
      input.style.fontSize = el.style.fontSize;
      input.style.color = ann.color;
      el.insertBefore(input, textSpan);
      input.focus();
      input.select();

      function autoResize() { input.style.height = 'auto'; input.style.height = input.scrollHeight + 'px'; }
      input.addEventListener('input', () => { ann.text = input.value; autoResize(); });
      autoResize();

      function finish() {
        ann.text = input.value;
        textSpan.textContent = ann.text;
        textSpan.style.display = '';
        input.remove();
        if (!ann.text.trim()) {
          annotations = annotations.filter(a => a.id !== ann.id);
          el.remove();
        }
      }
      input.addEventListener('blur', finish);
      input.addEventListener('keydown', (e) => { if (e.key === 'Escape') input.blur(); });
    }

    // ---- Drag to reposition ----
    function beginDrag(e, el, ann) {
      const overlayRect = overlayEl.getBoundingClientRect();
      const startX = e.clientX, startY = e.clientY;
      const origLeft = ann.xPct * overlayRect.width;
      const origTop = ann.yPct * overlayRect.height;

      function onMove(ev) {
        ev.preventDefault();
        const dx = ev.clientX - startX, dy = ev.clientY - startY;
        const newLeft = Math.max(0, Math.min(origLeft + dx, overlayRect.width - 20));
        const newTop = Math.max(0, Math.min(origTop + dy, overlayRect.height - 10));
        el.style.left = newLeft + 'px';
        el.style.top = newTop + 'px';
        ann.xPct = newLeft / overlayRect.width;
        ann.yPct = newTop / overlayRect.height;
      }
      function onUp() {
        document.removeEventListener('pointermove', onMove);
        document.removeEventListener('pointerup', onUp);
      }
      document.addEventListener('pointermove', onMove);
      document.addEventListener('pointerup', onUp);
    }

    // ---- Click on overlay to add new annotation ----
    overlayEl.addEventListener('click', (e) => {
      if (e.target !== overlayEl) return;
      const rect = overlayEl.getBoundingClientRect();
      const xPct = (e.clientX - rect.left) / rect.width;
      const yPct = (e.clientY - rect.top) / rect.height;

      const ann = {
        id: nextId++,
        page: currentPage,
        xPct, yPct,
        text: 'Text',
        fontSize: parseInt(sizeInput.value) || 16,
        color: colorInput.value || '#000000',
        opacity: parseInt(opacityInput.value) / 100
      };
      annotations.push(ann);

      const el = createAnnotationEl(ann);
      overlayEl.appendChild(el);
      beginInlineEdit(el, ann);
    });

    // ---- Deselect on click outside ----
    document.addEventListener('pointerdown', (e) => {
      if (!e.target.closest('.pdf-annotation') && !e.target.closest('.pdf-editor-toolbar')) {
        overlayEl.querySelectorAll('.pdf-annotation.selected').forEach(a => a.classList.remove('selected'));
      }
    });

    // ---- Delete selected annotation with keyboard ----
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Delete' || e.key === 'Backspace') {
        if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
        const sel = overlayEl.querySelector('.pdf-annotation.selected');
        if (sel) {
          const id = parseInt(sel.dataset.id);
          annotations = annotations.filter(a => a.id !== id);
          sel.remove();
        }
      }
    });

    // ---- Page navigation ----
    prevBtn.addEventListener('click', () => { if (currentPage > 1) { currentPage--; renderPage(); } });
    nextBtn.addEventListener('click', () => { if (currentPage < totalPages) { currentPage++; renderPage(); } });

    // ---- Save edited PDF ----
    actionBtn.addEventListener('click', async () => {
      if (!pdfBytes) return;
      if (annotations.length === 0) { EditIt.showToast('Add some text annotations first', 'error'); return; }
      EditIt.setButtonLoading(actionBtn, true);
      try {
        const pdfDoc = await PDFDocument.load(pdfBytes);
        const font = await pdfDoc.embedFont(StandardFonts.Helvetica);

        for (const ann of annotations) {
          const page = pdfDoc.getPage(ann.page - 1);
          const W = page.getWidth();
          const H = page.getHeight();

          const pdfX = ann.xPct * W;
          const pdfY = H - (ann.yPct * H) - ann.fontSize;

          const hex = ann.color;
          const cr = parseInt(hex.slice(1, 3), 16) / 255;
          const cg = parseInt(hex.slice(3, 5), 16) / 255;
          const cb = parseInt(hex.slice(5, 7), 16) / 255;

          const lines = ann.text.split('\n');
        lines.forEach((line, i) => {
            if (!line && lines.length === 1) return;
            page.drawText(line, {
              x: pdfX,
              y: pdfY - i * (ann.fontSize + 4),
              size: ann.fontSize,
              font,
              color: rgb(cr, cg, cb),
              opacity: ann.opacity
            });
          });
        }

        const saved = await pdfDoc.save();
        const blob = new Blob([saved], { type: 'application/pdf' });
        let pv = ''; try { const u = await EditIt.renderPdfPageToDataURL(saved, 1, 0.7); pv = EditIt.outputPreviewHTML(u, 'Edited PDF preview'); } catch (e) {}
        outputCard(outputEl, 'PDF Edited!', `${annotations.length} annotation${annotations.length !== 1 ? 's' : ''} saved`, blob, pdfFile.name.replace('.pdf', '') + '_edited.pdf', pv);
        EditIt.showToast('PDF edited successfully!', 'success');
      } catch (err) { console.error(err); EditIt.showToast('Error: ' + err.message, 'error'); }
      EditIt.setButtonLoading(actionBtn, false);
    });
  })();

  // ===========================
  // 5. ORGANIZE PDF
  // ===========================
  (function () {
    const pagesGrid = document.getElementById('organize-pdf-pages');
    const actionBtn = document.getElementById('organize-pdf-action');
    const outputEl = document.getElementById('organize-pdf-output');
    let pdfBytes = null, pdfFile = null, pageOrder = [], pageRotations = {};
    let dragState = null;

    // Sync pageOrder from current DOM order
    function syncPageOrder() {
      pageOrder = [...pagesGrid.querySelectorAll('.page-thumb')].map(t => parseInt(t.dataset.page));
      updatePositionLabels();
    }

    // Update move button disabled states and position labels
    function updatePositionLabels() {
      const thumbs = [...pagesGrid.querySelectorAll('.page-thumb')];
      thumbs.forEach((t, idx) => {
        const leftBtn = t.querySelector('.move-left-btn');
        const rightBtn = t.querySelector('.move-right-btn');
        const posLabel = t.querySelector('.page-pos');
        const totalLabel = t.querySelector('.page-total');
        if (leftBtn) leftBtn.disabled = idx === 0;
        if (rightBtn) rightBtn.disabled = idx === thumbs.length - 1;
        if (posLabel) posLabel.textContent = idx + 1;
        if (totalLabel) totalLabel.textContent = thumbs.length;
      });
    }

    // Move a thumb left or right by one position
    function moveThumb(thumb, delta) {
      const thumbs = [...pagesGrid.querySelectorAll('.page-thumb')];
      const idx = thumbs.indexOf(thumb);
      const newIdx = idx + delta;
      if (newIdx < 0 || newIdx >= thumbs.length) return;
      if (delta === -1) {
        pagesGrid.insertBefore(thumb, thumbs[newIdx]);
      } else {
        const after = thumbs[newIdx].nextSibling;
        if (after) pagesGrid.insertBefore(thumb, after);
        else pagesGrid.appendChild(thumb);
      }
      syncPageOrder();
    }

    // --- Pointer-based drag and drop ---
    function onPointerDown(e) {
      const thumb = e.target.closest('.page-thumb');
      if (!thumb || e.target.closest('.page-controls') || e.target.closest('.page-move-bar')) return;
      if (e.pointerType === 'mouse' && e.button !== 0) return;
      e.preventDefault();

      const rect = thumb.getBoundingClientRect();

      // Create floating clone that follows the pointer
      const clone = thumb.cloneNode(true);
      clone.classList.add('drag-clone');
      clone.style.width = rect.width + 'px';
      clone.style.height = rect.height + 'px';
      clone.style.left = rect.left + 'px';
      clone.style.top = rect.top + 'px';
      document.body.appendChild(clone);

      thumb.classList.add('drag-placeholder');

      dragState = {
        thumb,
        clone,
        offsetX: e.clientX - rect.left,
        offsetY: e.clientY - rect.top
      };

      document.addEventListener('pointermove', onPointerMove);
      document.addEventListener('pointerup', onPointerUp);
      document.addEventListener('pointercancel', onPointerUp);
    }

    function onPointerMove(e) {
      if (!dragState) return;
      e.preventDefault();

      const { clone, offsetX, offsetY, thumb } = dragState;
      clone.style.left = (e.clientX - offsetX) + 'px';
      clone.style.top = (e.clientY - offsetY) + 'px';

      // elementFromPoint sees through the clone (pointer-events: none)
      const el = document.elementFromPoint(e.clientX, e.clientY);
      const target = el?.closest('.page-thumb:not(.drag-placeholder)');

      if (target && target.parentNode === pagesGrid) {
        const targetRect = target.getBoundingClientRect();
        const midX = targetRect.left + targetRect.width / 2;
        if (e.clientX < midX) {
          pagesGrid.insertBefore(thumb, target);
        } else {
          const next = target.nextSibling;
          if (next && next !== thumb) pagesGrid.insertBefore(thumb, next);
          else if (!next) pagesGrid.appendChild(thumb);
        }
      }
    }

    function onPointerUp() {
      if (!dragState) return;
      dragState.thumb.classList.remove('drag-placeholder');
      dragState.clone.remove();
      syncPageOrder();
      dragState = null;
      document.removeEventListener('pointermove', onPointerMove);
      document.removeEventListener('pointerup', onPointerUp);
      document.removeEventListener('pointercancel', onPointerUp);
    }

    pagesGrid.addEventListener('pointerdown', onPointerDown);

    document.addEventListener('files-added', async (e) => {
      if (e.detail.toolId !== 'organize-pdf') return;
      const f = e.detail.files.find(f => f.type === 'application/pdf' || f.name.endsWith('.pdf'));
      if (!f) { EditIt.showToast('Please select a PDF file', 'error'); return; }
      pdfFile = f;
      pdfBytes = await EditIt.readFileAsArrayBuffer(f);
      pageOrder = []; pageRotations = {};
      outputEl.innerHTML = '';
      pagesGrid.innerHTML = '';

      try {
        const pdfDoc = await pdfjsLib.getDocument({ data: pdfBytes.slice(0) }).promise;
        const totalPages = pdfDoc.numPages;
        for (let i = 1; i <= totalPages; i++) {
          pageOrder.push(i);
          const page = await pdfDoc.getPage(i);
          const viewport = page.getViewport({ scale: 0.35 });
          const canvas = document.createElement('canvas');
          canvas.width = viewport.width; canvas.height = viewport.height;
          await page.render({ canvasContext: canvas.getContext('2d'), viewport }).promise;

          const thumb = document.createElement('div');
          thumb.className = 'page-thumb';
          thumb.dataset.page = i;
          thumb.innerHTML = `
            <div class="page-controls">
              <button class="rotate-page-btn" title="Rotate 90°">↻</button>
              <button class="delete-page-btn" title="Delete page">✕</button>
            </div>
            <div class="page-move-bar">
              <button class="move-left-btn" title="Move left">‹</button>
              <span class="page-pos-label">
                <span class="page-pos">${i}</span> / <span class="page-total">${totalPages}</span>
              </span>
              <button class="move-right-btn" title="Move right">›</button>
            </div>`;
          thumb.prepend(canvas);

          thumb.querySelector('.rotate-page-btn').addEventListener('click', () => {
            pageRotations[i] = ((pageRotations[i] || 0) + 90) % 360;
            canvas.style.transform = `rotate(${pageRotations[i]}deg)`;
          });
          thumb.querySelector('.delete-page-btn').addEventListener('click', () => {
            thumb.remove();
            syncPageOrder();
            actionBtn.disabled = pageOrder.length === 0;
          });
          thumb.querySelector('.move-left-btn').addEventListener('click', () => moveThumb(thumb, -1));
          thumb.querySelector('.move-right-btn').addEventListener('click', () => moveThumb(thumb, +1));

          pagesGrid.appendChild(thumb);
        }
        actionBtn.disabled = false;
        updatePositionLabels();
        EditIt.showToast(`Loaded ${totalPages} pages — drag or use arrows to reorder`, 'info');
      } catch (err) { EditIt.showToast('Error loading PDF: ' + err.message, 'error'); }
    });

    actionBtn.addEventListener('click', async () => {
      if (!pdfBytes || pageOrder.length === 0) return;
      EditIt.setButtonLoading(actionBtn, true);
      try {
        const srcPdf = await PDFDocument.load(pdfBytes);
        const newPdf = await PDFDocument.create();
        const copied = await newPdf.copyPages(srcPdf, pageOrder.map(p => p - 1));
        copied.forEach((page, i) => {
          const rot = pageRotations[pageOrder[i]] || 0;
          if (rot) { const cur = page.getRotation().angle; page.setRotation(degrees(cur + rot)); }
          newPdf.addPage(page);
        });
        const saved = await newPdf.save();
        const blob = new Blob([saved], { type: 'application/pdf' });
        let pv = ''; try { const u = await EditIt.renderPdfPageToDataURL(saved, 1, 0.7); pv = EditIt.outputPreviewHTML(u, 'Organized PDF preview'); } catch (e) { }
        outputCard(outputEl, 'PDF Organized!', `${pageOrder.length} pages saved • ${EditIt.formatFileSize(blob.size)}`, blob, pdfFile.name.replace('.pdf', '') + '_organized.pdf', pv);
        EditIt.showToast('PDF reorganized!', 'success');
      } catch (err) { console.error(err); EditIt.showToast('Error: ' + err.message, 'error'); }
      EditIt.setButtonLoading(actionBtn, false);
    });
  })();

  // ===========================
  // 6. UNLOCK PDF
  // ===========================
  (function () {
    const optionsEl = document.getElementById('unlock-pdf-options');
    setupPdfTool('unlock-pdf',
      () => { optionsEl.style.display = 'block'; },
      async (file, outputEl) => {
        const password = document.getElementById('unlock-pdf-password').value;
        if (!password) { EditIt.showToast('Please enter the PDF password', 'error'); return; }
        const bytes = await EditIt.readFileAsArrayBuffer(file);
        // Try loading with PDF.js which supports password
        try {
          const pdfDoc = await pdfjsLib.getDocument({ data: bytes, password }).promise;
          const numPages = pdfDoc.numPages;
          // Re-create PDF without password using pdf-lib by rendering pages
          const newPdf = await PDFDocument.create();
          for (let i = 1; i <= numPages; i++) {
            EditIt.showProgress(`Unlocking page ${i}/${numPages}...`, (i / numPages) * 90);
            const page = await pdfDoc.getPage(i);
            const vp = page.getViewport({ scale: 2 });
            const canvas = document.createElement('canvas');
            canvas.width = vp.width; canvas.height = vp.height;
            await page.render({ canvasContext: canvas.getContext('2d'), viewport: vp }).promise;
            const imgData = canvas.toDataURL('image/jpeg', 0.92);
            const imgBytes = Uint8Array.from(atob(imgData.split(',')[1]), c => c.charCodeAt(0));
            const img = await newPdf.embedJpg(imgBytes);
            const p = newPdf.addPage([vp.width / 2, vp.height / 2]);
            p.drawImage(img, { x: 0, y: 0, width: p.getWidth(), height: p.getHeight() });
          }
          EditIt.hideProgress();
          const saved = await newPdf.save();
          const blob = new Blob([saved], { type: 'application/pdf' });
          outputCard(outputEl, 'PDF Unlocked!', `${numPages} pages • Password removed`, blob, file.name.replace('.pdf', '') + '_unlocked.pdf');
          EditIt.showToast('PDF unlocked successfully!', 'success');
        } catch (err) {
          EditIt.hideProgress();
          if (err.message && err.message.includes('password')) EditIt.showToast('Incorrect password', 'error');
          else throw err;
        }
      }
    );
  })();

  // ===========================
  // 6b. LOCK PDF (Password Protect)
  // ===========================
  (function () {
    const optionsEl = document.getElementById('lock-pdf-options');
    setupPdfTool('lock-pdf',
      () => { optionsEl.style.display = 'block'; },
      async (file, outputEl) => {
        const password = document.getElementById('lock-pdf-password').value;
        const confirm = document.getElementById('lock-pdf-confirm').value;
        if (!password) { EditIt.showToast('Please enter a password', 'error'); return; }
        if (password !== confirm) { EditIt.showToast('Passwords do not match', 'error'); return; }

        const bytes = await EditIt.readFileAsArrayBuffer(file);

        // Load PDF with pdf.js to render pages as images
        const pdfDoc = await pdfjsLib.getDocument({ data: bytes.slice(0) }).promise;
        const numPages = pdfDoc.numPages;

        // Collect permission settings
        const userPermissions = [];
        if (document.getElementById('lock-allow-print').checked) userPermissions.push('print');
        if (document.getElementById('lock-allow-copy').checked) userPermissions.push('copy');
        if (document.getElementById('lock-allow-modify').checked) userPermissions.push('modify');

        // Get first page dimensions for initial jsPDF setup
        const firstPage = await pdfDoc.getPage(1);
        const firstVp = firstPage.getViewport({ scale: 1 });
        const isLandscape = firstVp.width > firstVp.height;

        // Create jsPDF document with encryption
        const doc = new jspdf.jsPDF({
          orientation: isLandscape ? 'l' : 'p',
          unit: 'pt',
          format: [firstVp.width, firstVp.height],
          encryption: {
            userPassword: password,
            ownerPassword: password,
            userPermissions: userPermissions
          }
        });

        for (let i = 1; i <= numPages; i++) {
          EditIt.showProgress(`Protecting page ${i}/${numPages}...`, (i / numPages) * 90);
          const page = await pdfDoc.getPage(i);
          const nativeVp = page.getViewport({ scale: 1 });
          const renderVp = page.getViewport({ scale: 2 });
          const canvas = document.createElement('canvas');
          canvas.width = renderVp.width;
          canvas.height = renderVp.height;
          await page.render({ canvasContext: canvas.getContext('2d'), viewport: renderVp }).promise;
          const imgData = canvas.toDataURL('image/jpeg', 0.92);

          if (i > 1) {
            doc.addPage([nativeVp.width, nativeVp.height], nativeVp.width > nativeVp.height ? 'l' : 'p');
          }
          doc.addImage(imgData, 'JPEG', 0, 0, nativeVp.width, nativeVp.height);
        }

        EditIt.hideProgress();
        const pdfBlob = doc.output('blob');
        outputCard(outputEl, 'PDF Locked!', `${numPages} pages • Password protected • ${EditIt.formatFileSize(pdfBlob.size)}`, pdfBlob, file.name.replace('.pdf', '') + '_locked.pdf');
        EditIt.showToast('PDF password-protected successfully!', 'success');
      }
    );
  })();

  // ===========================
  // 7. REPAIR PDF
  // ===========================
  setupPdfTool('repair-pdf', null, async (file, outputEl) => {
    EditIt.showProgress('Repairing PDF...', 30);
    const bytes = await EditIt.readFileAsArrayBuffer(file);
    const pdfDoc = await PDFDocument.load(bytes, { ignoreEncryption: true });
    EditIt.showProgress('Saving repaired PDF...', 80);
    const saved = await pdfDoc.save();
    EditIt.hideProgress();
    const blob = new Blob([saved], { type: 'application/pdf' });
    const pages = pdfDoc.getPageCount();
    outputCard(outputEl, 'PDF Repaired!', `${pages} pages recovered • ${EditIt.formatFileSize(blob.size)}`, blob, file.name.replace('.pdf', '') + '_repaired.pdf');
    EditIt.showToast('PDF repaired!', 'success');
  });

  // ===========================
  // 8. OCR PDF
  // ===========================
  (function () {
    const optionsEl = document.getElementById('ocr-pdf-options');
    let tesseractLoaded = false;

    setupPdfTool('ocr-pdf',
      () => { optionsEl.style.display = 'block'; },
      async (file, outputEl) => {
        // Lazy-load Tesseract.js
        if (!tesseractLoaded && typeof Tesseract === 'undefined') {
          EditIt.showProgress('Loading OCR engine...', 10);
          await new Promise((resolve, reject) => {
            const s = document.createElement('script');
            s.src = 'https://cdn.jsdelivr.net/npm/tesseract.js@5/dist/tesseract.min.js';
            s.onload = resolve; s.onerror = reject;
            document.head.appendChild(s);
          });
          tesseractLoaded = true;
        }
        const lang = document.getElementById('ocr-lang').value;
        const bytes = await EditIt.readFileAsArrayBuffer(file);
        const pdfDoc = await pdfjsLib.getDocument({ data: bytes }).promise;
        const allText = [];

        for (let i = 1; i <= pdfDoc.numPages; i++) {
          EditIt.showProgress(`OCR page ${i} of ${pdfDoc.numPages}...`, (i / pdfDoc.numPages) * 90);
          const page = await pdfDoc.getPage(i);
          const vp = page.getViewport({ scale: 2 });
          const canvas = document.createElement('canvas');
          canvas.width = vp.width; canvas.height = vp.height;
          await page.render({ canvasContext: canvas.getContext('2d'), viewport: vp }).promise;
          const { data } = await Tesseract.recognize(canvas, lang);
          allText.push(`--- Page ${i} ---\n${data.text}`);
        }
        EditIt.hideProgress();
        const fullText = allText.join('\n\n');
        const blob = new Blob([fullText], { type: 'text/plain' });
        outputEl.innerHTML = `<div class="output-card"><h3>✓ OCR Complete!</h3><p>${pdfDoc.numPages} pages scanned • ${fullText.length} characters extracted</p><div class="output-filename"><label>File name:</label><input type="text" class="input output-dl-name" value="${file.name.replace('.pdf', '')}_ocr.txt"></div><button class="btn btn-success output-dl-btn">Download Text</button></div><div class="ocr-text-output">${fullText.replace(/</g, '&lt;')}</div>`;
        outputEl.querySelector('.output-dl-btn').addEventListener('click', () => {
          EditIt.downloadBlob(blob, outputEl.querySelector('.output-dl-name').value.trim() || 'ocr_output.txt');
        });
        EditIt.showToast('OCR complete!', 'success');
      }
    );
  })();

  // ===========================
  // 9. PDF TO WORD
  // ===========================
  setupPdfTool('pdf-to-word', null, async (file, outputEl) => {
    EditIt.showProgress('Extracting text...', 20);
    const bytes = await EditIt.readFileAsArrayBuffer(file);
    const pages = await extractPdfText(bytes);
    EditIt.showProgress('Creating Word document...', 70);

    // Build .docx using JSZip (it's a ZIP of XML files)
    const zip = new JSZip();
    const bodyXml = pages.map(text => {
      const escaped = text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
      const paras = escaped.split(/\n+/).filter(Boolean).map(p => `<w:p><w:r><w:t xml:space="preserve">${p}</w:t></w:r></w:p>`).join('');
      return paras + '<w:p><w:r><w:t></w:t></w:r></w:p><w:p><w:pPr><w:pBdr><w:bottom w:val="single" w:sz="4" w:space="1" w:color="auto"/></w:pBdr></w:pPr></w:p>';
    }).join('');

    zip.file('[Content_Types].xml', '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>');
    zip.file('_rels/.rels', '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>');
    zip.file('word/_rels/document.xml.rels', '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"></Relationships>');
    zip.file('word/document.xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>${bodyXml}</w:body></w:document>`);

    const blob = await zip.generateAsync({ type: 'blob', mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' });
    EditIt.hideProgress();
    outputCard(outputEl, 'Converted to Word!', `${pages.length} pages extracted • ${EditIt.formatFileSize(blob.size)}`, blob, file.name.replace('.pdf', '') + '.docx');
    EditIt.showToast('PDF converted to Word!', 'success');
  });

  // ===========================
  // 10. PDF TO EXCEL
  // ===========================
  setupPdfTool('pdf-to-excel', null, async (file, outputEl) => {
    EditIt.showProgress('Extracting text...', 20);
    const bytes = await EditIt.readFileAsArrayBuffer(file);
    const pages = await extractPdfText(bytes);
    EditIt.showProgress('Creating spreadsheet...', 70);

    const wb = XLSX.utils.book_new();
    pages.forEach((text, i) => {
      const lines = text.split(/\n+/).filter(Boolean);
      const data = lines.map(line => line.split(/\s{2,}|\t/));
      const ws = XLSX.utils.aoa_to_sheet(data);
      XLSX.utils.book_append_sheet(wb, ws, `Page ${i + 1}`);
    });

    const xlsxBuf = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
    const blob = new Blob([xlsxBuf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    EditIt.hideProgress();
    outputCard(outputEl, 'Converted to Excel!', `${pages.length} sheets created • ${EditIt.formatFileSize(blob.size)}`, blob, file.name.replace('.pdf', '') + '.xlsx');
    EditIt.showToast('PDF converted to Excel!', 'success');
  });

  // ===========================
  // 11. PDF TO POWERPOINT
  // ===========================
  setupPdfTool('pdf-to-ppt', null, async (file, outputEl) => {
    const bytes = await EditIt.readFileAsArrayBuffer(file);
    const pdfDoc = await pdfjsLib.getDocument({ data: bytes }).promise;
    const pptx = new PptxGenJS();

    for (let i = 1; i <= pdfDoc.numPages; i++) {
      EditIt.showProgress(`Converting page ${i}/${pdfDoc.numPages}...`, (i / pdfDoc.numPages) * 90);
      const page = await pdfDoc.getPage(i);
      const vp = page.getViewport({ scale: 2 });
      const canvas = document.createElement('canvas');
      canvas.width = vp.width; canvas.height = vp.height;
      await page.render({ canvasContext: canvas.getContext('2d'), viewport: vp }).promise;
      const imgData = canvas.toDataURL('image/jpeg', 0.9);
      const slide = pptx.addSlide();
      slide.addImage({ data: imgData, x: 0, y: 0, w: '100%', h: '100%' });
    }

    EditIt.showProgress('Saving...', 95);
    const pptxBlob = await pptx.write({ outputType: 'blob' });
    EditIt.hideProgress();
    outputCard(outputEl, 'Converted to PowerPoint!', `${pdfDoc.numPages} slides • ${EditIt.formatFileSize(pptxBlob.size)}`, pptxBlob, file.name.replace('.pdf', '') + '.pptx');
    EditIt.showToast('PDF converted to PowerPoint!', 'success');
  });

  // ===========================
  // 12. WORD TO PDF
  // ===========================
  setupFileTool('word-to-pdf',
    f => f.name.endsWith('.docx') || f.name.endsWith('.doc') || f.type.includes('wordprocessing'),
    async (file, outputEl) => {
      EditIt.showProgress('Reading Word document...', 20);
      const arrayBuffer = await EditIt.readFileAsArrayBuffer(file);
      const result = await mammoth.extractRawText({ arrayBuffer });
      const text = result.value;
      EditIt.showProgress('Creating PDF...', 60);

      const pdfDoc = await PDFDocument.create();
      const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
      const fontSize = 11;
      const margin = 50;
      const lineHeight = fontSize + 5;
      const lines = text.split('\n');

      let page = pdfDoc.addPage([595.28, 841.89]);
      let y = 841.89 - margin;

      for (const line of lines) {
        // Word wrap
        const words = line.split(' ');
        let currentLine = '';
        for (const word of words) {
          const test = currentLine ? currentLine + ' ' + word : word;
          const tw = font.widthOfTextAtSize(test, fontSize);
          if (tw > 595.28 - margin * 2 && currentLine) {
            if (y < margin + lineHeight) { page = pdfDoc.addPage([595.28, 841.89]); y = 841.89 - margin; }
            page.drawText(currentLine, { x: margin, y, size: fontSize, font, color: rgb(0, 0, 0) });
            y -= lineHeight;
            currentLine = word;
          } else {
            currentLine = test;
          }
        }
        if (currentLine) {
          if (y < margin + lineHeight) { page = pdfDoc.addPage([595.28, 841.89]); y = 841.89 - margin; }
          page.drawText(currentLine, { x: margin, y, size: fontSize, font, color: rgb(0, 0, 0) });
          y -= lineHeight;
        }
        if (!line) y -= lineHeight * 0.5; // blank line
      }

      const saved = await pdfDoc.save();
      const blob = new Blob([saved], { type: 'application/pdf' });
      EditIt.hideProgress();
      let pv = ''; try { const u = await EditIt.renderPdfPageToDataURL(saved, 1, 0.7); pv = EditIt.outputPreviewHTML(u, 'PDF preview'); } catch (e) { }
      outputCard(outputEl, 'Converted to PDF!', `${pdfDoc.getPageCount()} pages • ${EditIt.formatFileSize(blob.size)}`, blob, file.name.replace(/\.(docx?|doc)$/i, '') + '.pdf', pv);
      EditIt.showToast('Word converted to PDF!', 'success');
    }
  );

  // ===========================
  // 13. EXCEL TO PDF
  // ===========================
  setupFileTool('excel-to-pdf',
    f => f.name.endsWith('.xlsx') || f.name.endsWith('.xls') || f.type.includes('spreadsheet'),
    async (file, outputEl) => {
      EditIt.showProgress('Reading spreadsheet...', 20);
      const arrayBuffer = await EditIt.readFileAsArrayBuffer(file);
      const wb = XLSX.read(arrayBuffer, { type: 'array' });
      EditIt.showProgress('Creating PDF...', 60);

      const pdfDoc = await PDFDocument.create();
      const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
      const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
      const fontSize = 9;
      const margin = 40;
      const rowHeight = 16;

      wb.SheetNames.forEach(sheetName => {
        const ws = wb.Sheets[sheetName];
        const data = XLSX.utils.sheet_to_json(ws, { header: 1 });
        if (!data.length) return;

        let page = pdfDoc.addPage([841.89, 595.28]); // Landscape A4
        let y = 595.28 - margin;
        const colCount = Math.max(...data.map(r => (r || []).length));
        const colW = (841.89 - margin * 2) / Math.max(colCount, 1);

        // Sheet name header
        page.drawText(sheetName, { x: margin, y, size: 14, font: boldFont, color: rgb(0.2, 0.2, 0.5) });
        y -= 24;

        data.forEach((row, ri) => {
          if (y < margin + rowHeight) { page = pdfDoc.addPage([841.89, 595.28]); y = 595.28 - margin; }
          (row || []).forEach((cell, ci) => {
            const text = String(cell ?? '').substring(0, 30);
            const f = ri === 0 ? boldFont : font;
            page.drawText(text, { x: margin + ci * colW, y, size: fontSize, font: f, color: rgb(0, 0, 0) });
          });
          y -= rowHeight;
        });
      });

      const saved = await pdfDoc.save();
      const blob = new Blob([saved], { type: 'application/pdf' });
      EditIt.hideProgress();
      outputCard(outputEl, 'Converted to PDF!', `${wb.SheetNames.length} sheets • ${pdfDoc.getPageCount()} pages`, blob, file.name.replace(/\.(xlsx?|xls)$/i, '') + '.pdf');
      EditIt.showToast('Excel converted to PDF!', 'success');
    }
  );

  // ===========================
  // 14. POWERPOINT TO PDF
  // ===========================
  setupFileTool('ppt-to-pdf',
    f => f.name.endsWith('.pptx') || f.name.endsWith('.ppt') || f.type.includes('presentation'),
    async (file, outputEl) => {
      EditIt.showProgress('Reading presentation...', 20);
      const arrayBuffer = await EditIt.readFileAsArrayBuffer(file);
      const zip = await JSZip.loadAsync(arrayBuffer);

      const pdfDoc = await PDFDocument.create();
      const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
      const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

      // Find all slide XML files
      const slideFiles = Object.keys(zip.files).filter(n => /^ppt\/slides\/slide\d+\.xml$/.test(n)).sort((a, b) => {
        const na = parseInt(a.match(/\d+/)[0]), nb = parseInt(b.match(/\d+/)[0]);
        return na - nb;
      });

      for (let si = 0; si < slideFiles.length; si++) {
        EditIt.showProgress(`Processing slide ${si + 1}/${slideFiles.length}...`, ((si + 1) / slideFiles.length) * 90);
        const xml = await zip.files[slideFiles[si]].async('text');
        // Extract text from slide XML
        const texts = [];
        const matches = xml.matchAll(/<a:t>([^<]*)<\/a:t>/g);
        for (const m of matches) if (m[1].trim()) texts.push(m[1]);

        const page = pdfDoc.addPage([960, 540]); // 10x7.5 inches at 96 DPI
        let y = 490;
        const title = texts[0] || `Slide ${si + 1}`;
        page.drawText(title, { x: 50, y, size: 24, font: boldFont, color: rgb(0.1, 0.1, 0.3) });
        y -= 40;

        texts.slice(1).forEach(t => {
          if (y < 50) return;
          page.drawText(t.substring(0, 100), { x: 50, y, size: 14, font, color: rgb(0.15, 0.15, 0.15) });
          y -= 24;
        });
      }

      EditIt.hideProgress();
      const saved = await pdfDoc.save();
      const blob = new Blob([saved], { type: 'application/pdf' });
      let pv = ''; try { const u = await EditIt.renderPdfPageToDataURL(saved, 1, 0.7); pv = EditIt.outputPreviewHTML(u, 'PDF preview'); } catch (e) { }
      outputCard(outputEl, 'Converted to PDF!', `${slideFiles.length} slides • ${pdfDoc.getPageCount()} pages`, blob, file.name.replace(/\.(pptx?|ppt)$/i, '') + '.pdf', pv);
      EditIt.showToast('PowerPoint converted to PDF!', 'success');
    }
  );

  // ===========================
  // REMOVE BACKGROUND (with live preview)
  // ===========================
  (function () {
    var optionsEl = document.getElementById('remove-bg-options');
    var threshSlider = document.getElementById('remove-bg-threshold');
    var threshVal = document.getElementById('remove-bg-threshold-val');
    var beforeCanvas = document.getElementById('rbg-canvas-before');
    var afterCanvas = document.getElementById('rbg-canvas-after');
    var previewArea = document.getElementById('rbg-preview');
    var bgMode = 'auto';
    var loadedImg = null, loadedDataUrl = null;

    function getBgColor(d, w, h) {
      if (bgMode === 'white') return [255, 255, 255];
      if (bgMode === 'black') return [0, 0, 0];
      if (bgMode === 'custom') {
        var hex = document.getElementById('bg-custom-color').value;
        return [parseInt(hex.slice(1, 3), 16), parseInt(hex.slice(3, 5), 16), parseInt(hex.slice(5, 7), 16)];
      }
      // Auto-detect from corners
      var samples = [0, (w - 1) * 4, (h - 1) * w * 4, ((h - 1) * w + w - 1) * 4];
      var sr = 0, sg = 0, sb = 0;
      samples.forEach(function (i) { sr += d[i]; sg += d[i + 1]; sb += d[i + 2]; });
      return [Math.round(sr / 4), Math.round(sg / 4), Math.round(sb / 4)];
    }

    function updatePreview() {
      if (!loadedImg) return;
      var w = loadedImg.naturalWidth, h = loadedImg.naturalHeight;
      var maxW = 350;
      var scale = Math.min(maxW / w, maxW / h, 1);
      var sw = Math.round(w * scale), sh = Math.round(h * scale);
      // Before
      beforeCanvas.width = sw; beforeCanvas.height = sh;
      beforeCanvas.getContext('2d').drawImage(loadedImg, 0, 0, sw, sh);
      // Process at preview size
      afterCanvas.width = sw; afterCanvas.height = sh;
      var ctx = afterCanvas.getContext('2d');
      ctx.drawImage(loadedImg, 0, 0, sw, sh);
      var imageData = ctx.getImageData(0, 0, sw, sh);
      var d = imageData.data;
      var threshold = parseInt(threshSlider.value);
      var bg = getBgColor(d, sw, sh);
      for (var i = 0; i < d.length; i += 4) {
        var dist = Math.sqrt(Math.pow(d[i] - bg[0], 2) + Math.pow(d[i + 1] - bg[1], 2) + Math.pow(d[i + 2] - bg[2], 2));
        if (dist < threshold * 4.42) d[i + 3] = 0;
      }
      ctx.putImageData(imageData, 0, 0);
      // Draw checkerboard behind transparent areas
      var checkerCanvas = document.createElement('canvas');
      checkerCanvas.width = sw; checkerCanvas.height = sh;
      var cctx = checkerCanvas.getContext('2d');
      var cs = 8;
      for (var y = 0; y < sh; y += cs) {
        for (var x = 0; x < sw; x += cs) {
          cctx.fillStyle = ((x / cs + y / cs) % 2 === 0) ? '#e0e0e0' : '#ffffff';
          cctx.fillRect(x, y, cs, cs);
        }
      }
      cctx.drawImage(afterCanvas, 0, 0);
      afterCanvas.width = sw; afterCanvas.height = sh;
      afterCanvas.getContext('2d').drawImage(checkerCanvas, 0, 0);
      previewArea.style.display = '';
    }

    threshSlider.addEventListener('input', function () { threshVal.textContent = threshSlider.value; updatePreview(); });
    ['bg-auto', 'bg-white', 'bg-black'].forEach(function (id) {
      document.getElementById(id).addEventListener('click', function (e) {
        document.querySelectorAll('#remove-bg-options .btn-sm').forEach(function (b) { b.classList.remove('active'); });
        e.target.classList.add('active');
        bgMode = id.replace('bg-', '');
        updatePreview();
      });
    });
    document.getElementById('bg-custom-color').addEventListener('input', function () {
      document.querySelectorAll('#remove-bg-options .btn-sm').forEach(function (b) { b.classList.remove('active'); });
      bgMode = 'custom';
      updatePreview();
    });

    setupFileTool('remove-bg',
      function (f) { return f.type.startsWith('image/'); },
      async function (file, outputEl) {
        // Full-res export
        var w = loadedImg.naturalWidth, h = loadedImg.naturalHeight;
        var canvas = document.createElement('canvas');
        canvas.width = w; canvas.height = h;
        var ctx = canvas.getContext('2d');
        ctx.drawImage(loadedImg, 0, 0);
        var imageData = ctx.getImageData(0, 0, w, h);
        var d = imageData.data;
        var threshold = parseInt(threshSlider.value);
        var bg = getBgColor(d, w, h);
        var removed = 0;
        for (var i = 0; i < d.length; i += 4) {
          var dist = Math.sqrt(Math.pow(d[i] - bg[0], 2) + Math.pow(d[i + 1] - bg[1], 2) + Math.pow(d[i + 2] - bg[2], 2));
          if (dist < threshold * 4.42) { d[i + 3] = 0; removed++; }
        }
        ctx.putImageData(imageData, 0, 0);
        var blob = await new Promise(function (resolve) { canvas.toBlob(resolve, 'image/png'); });
        var pct = ((removed / (w * h)) * 100).toFixed(1);
        outputCard(outputEl, 'Background Removed!', w + '\u00d7' + h + ' \u2022 ' + pct + '% removed', blob, file.name.replace(/\.[^.]+$/, '') + '_nobg.png');
        EditIt.showToast('Background removed!', 'success');
      }
    );

    // Load image for live preview
    document.addEventListener('files-added', async function (e) {
      if (e.detail.toolId !== 'remove-bg') return;
      var f = e.detail.files.find(function (f) { return f.type.startsWith('image/'); });
      if (!f) return;
      var splitEl = document.getElementById('rbg-split');
      if (splitEl) splitEl.style.display = 'grid';
      loadedDataUrl = await EditIt.readFileAsDataURL(f);
      loadedImg = await EditIt.loadImage(loadedDataUrl);
      updatePreview();
    });
  })();

  // ===========================
  // PDF TO JSON
  // ===========================
  setupPdfTool('pdf-to-json', null, async function (file, outputEl) {
    EditIt.showProgress('Extracting text...', 30);
    var bytes = await EditIt.readFileAsArrayBuffer(file);
    var pages = await extractPdfText(bytes);
    EditIt.hideProgress();
    var json = JSON.stringify({ filename: file.name, pages: pages.map(function (text, i) { return { page: i + 1, text: text }; }) }, null, 2);
    var blob = new Blob([json], { type: 'application/json' });
    outputEl.innerHTML = '<div class="output-card"><h3>\u2713 Converted to JSON!</h3><p>' + pages.length + ' pages \u2022 ' + EditIt.formatFileSize(blob.size) + '</p><div class="output-filename"><label>File name:</label><input type="text" class="input output-dl-name" value="' + file.name.replace('.pdf', '') + '.json"></div><button class="btn btn-success output-dl-btn">Download JSON</button></div><div class="ocr-text-output">' + json.replace(/</g, '&lt;').substring(0, 5000) + (json.length > 5000 ? '\n...(truncated)' : '') + '</div>';
    outputEl.querySelector('.output-dl-btn').addEventListener('click', function () { EditIt.downloadBlob(blob, outputEl.querySelector('.output-dl-name').value.trim() || 'output.json'); });
    EditIt.showToast('PDF converted to JSON!', 'success');
  });

  // ===========================
  // PDF TO XML
  // ===========================
  setupPdfTool('pdf-to-xml', null, async function (file, outputEl) {
    EditIt.showProgress('Extracting text...', 30);
    var bytes = await EditIt.readFileAsArrayBuffer(file);
    var pages = await extractPdfText(bytes);
    EditIt.hideProgress();
    var esc = function (s) { return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); };
    var xml = '<?xml version="1.0" encoding="UTF-8"?>\n<document filename="' + esc(file.name) + '">\n';
    pages.forEach(function (text, i) { xml += '  <page number="' + (i + 1) + '">\n    <text>' + esc(text) + '</text>\n  </page>\n'; });
    xml += '</document>';
    var blob = new Blob([xml], { type: 'application/xml' });
    outputEl.innerHTML = '<div class="output-card"><h3>\u2713 Converted to XML!</h3><p>' + pages.length + ' pages \u2022 ' + EditIt.formatFileSize(blob.size) + '</p><div class="output-filename"><label>File name:</label><input type="text" class="input output-dl-name" value="' + file.name.replace('.pdf', '') + '.xml"></div><button class="btn btn-success output-dl-btn">Download XML</button></div><div class="ocr-text-output">' + xml.replace(/</g, '&lt;').substring(0, 5000) + '</div>';
    outputEl.querySelector('.output-dl-btn').addEventListener('click', function () { EditIt.downloadBlob(blob, outputEl.querySelector('.output-dl-name').value.trim() || 'output.xml'); });
    EditIt.showToast('PDF converted to XML!', 'success');
  });

  // ===========================
  // PDF TO BASE64
  // ===========================
  setupPdfTool('pdf-to-base64', null, async function (file, outputEl) {
    EditIt.showProgress('Encoding...', 40);
    var bytes = await EditIt.readFileAsArrayBuffer(file);
    var binary = '';
    var uint8 = new Uint8Array(bytes);
    for (var i = 0; i < uint8.length; i++) binary += String.fromCharCode(uint8[i]);
    var b64 = btoa(binary);
    EditIt.hideProgress();
    var blob = new Blob([b64], { type: 'text/plain' });
    outputEl.innerHTML = '<div class="output-card"><h3>\u2713 Encoded to Base64!</h3><p>' + EditIt.formatFileSize(file.size) + ' \u2192 ' + EditIt.formatFileSize(b64.length) + ' text</p><div class="output-filename"><label>File name:</label><input type="text" class="input output-dl-name" value="' + file.name.replace('.pdf', '') + '_base64.txt"></div><button class="btn btn-success output-dl-btn">Download Base64</button> <button class="btn btn-outline copy-btn">Copy to Clipboard</button></div><div class="ocr-text-output" style="word-break:break-all">' + b64.substring(0, 3000) + (b64.length > 3000 ? '...' : '') + '</div>';
    outputEl.querySelector('.output-dl-btn').addEventListener('click', function () { EditIt.downloadBlob(blob, outputEl.querySelector('.output-dl-name').value.trim() || 'output.txt'); });
    outputEl.querySelector('.copy-btn').addEventListener('click', function () {
      navigator.clipboard.writeText(b64).then(function () { EditIt.showToast('Copied to clipboard!', 'success'); });
    });
    EditIt.showToast('PDF encoded to Base64!', 'success');
  });

  // ===========================
  // PDF TO TIFF
  // ===========================
  setupPdfTool('pdf-to-tiff', null, async function (file, outputEl) {
    var bytes = await EditIt.readFileAsArrayBuffer(file);
    var pdfDoc = await pdfjsLib.getDocument({ data: bytes }).promise;
    var images = [];
    for (var i = 1; i <= pdfDoc.numPages; i++) {
      EditIt.showProgress('Rendering page ' + i + '/' + pdfDoc.numPages + '...', (i / pdfDoc.numPages) * 80);
      var page = await pdfDoc.getPage(i);
      var vp = page.getViewport({ scale: 2 });
      var canvas = document.createElement('canvas');
      canvas.width = vp.width; canvas.height = vp.height;
      var ctx = canvas.getContext('2d');
      await page.render({ canvasContext: ctx, viewport: vp }).promise;
      var imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      // Encode as TIFF using UTIF
      var rgba = new Uint8Array(imgData.data.buffer);
      var tiffData = UTIF.encodeImage(rgba, canvas.width, canvas.height);
      var tiffBlob = new Blob([tiffData], { type: 'image/tiff' });
      images.push({ blob: tiffBlob, name: 'page_' + i + '.tiff' });
    }
    EditIt.hideProgress();
    if (images.length === 1) {
      outputCard(outputEl, 'Converted to TIFF!', EditIt.formatFileSize(images[0].blob.size), images[0].blob, file.name.replace('.pdf', '') + '.tiff');
    } else {
      var zip = new JSZip();
      images.forEach(function (img) { zip.file(img.name, img.blob); });
      var zipBlob = await zip.generateAsync({ type: 'blob' });
      outputCard(outputEl, 'Converted to TIFF!', pdfDoc.numPages + ' pages \u2022 ' + EditIt.formatFileSize(zipBlob.size) + ' ZIP', zipBlob, file.name.replace('.pdf', '') + '_tiff.zip');
    }
    EditIt.showToast('PDF converted to TIFF!', 'success');
  });

  // ===========================
  // PDF TO YAML
  // ===========================
  setupPdfTool('pdf-to-yaml', null, async function (file, outputEl) {
    EditIt.showProgress('Extracting text...', 30);
    var bytes = await EditIt.readFileAsArrayBuffer(file);
    var pages = await extractPdfText(bytes);
    EditIt.hideProgress();
    var yamlEsc = function (s) { return s.replace(/\\/g, '\\\\').replace(/"/g, '\\"'); };
    var yaml = 'filename: "' + yamlEsc(file.name) + '"\npages:\n';
    pages.forEach(function (text, i) {
      yaml += '  - page: ' + (i + 1) + '\n    text: |\n';
      text.split('\n').forEach(function (line) { yaml += '      ' + line + '\n'; });
    });
    var blob = new Blob([yaml], { type: 'text/yaml' });
    outputEl.innerHTML = '<div class="output-card"><h3>\u2713 Converted to YAML!</h3><p>' + pages.length + ' pages \u2022 ' + EditIt.formatFileSize(blob.size) + '</p><div class="output-filename"><label>File name:</label><input type="text" class="input output-dl-name" value="' + file.name.replace('.pdf', '') + '.yaml"></div><button class="btn btn-success output-dl-btn">Download YAML</button></div><div class="ocr-text-output">' + yaml.replace(/</g, '&lt;').substring(0, 5000) + '</div>';
    outputEl.querySelector('.output-dl-btn').addEventListener('click', function () { EditIt.downloadBlob(blob, outputEl.querySelector('.output-dl-name').value.trim() || 'output.yaml'); });
    EditIt.showToast('PDF converted to YAML!', 'success');
  });

  // ===========================
  // TEXT FILE TO PDF (shared helper for JSON/XML/YAML to PDF)
  // ===========================
  async function textFileToPdf(text, outputEl, defaultName, title) {
    var pdfDoc = await PDFDocument.create();
    var font = await pdfDoc.embedFont(StandardFonts.Courier);
    var fontSize = 9;
    var margin = 45;
    var lineH = fontSize + 3;
    var pageW = 595.28, pageH = 841.89;
    var maxLineW = pageW - margin * 2;
    var lines = text.split('\n');
    var page = pdfDoc.addPage([pageW, pageH]);
    var y = pageH - margin;

    for (var li = 0; li < lines.length; li++) {
      var line = lines[li];
      // Simple word wrap
      while (line.length > 0) {
        var chars = line.length;
        while (chars > 0 && font.widthOfTextAtSize(line.substring(0, chars), fontSize) > maxLineW) chars--;
        if (chars === 0) chars = 1;
        var seg = line.substring(0, chars);
        line = line.substring(chars);
        if (y < margin + lineH) { page = pdfDoc.addPage([pageW, pageH]); y = pageH - margin; }
        page.drawText(seg, { x: margin, y: y, size: fontSize, font: font, color: rgb(0.1, 0.1, 0.1) });
        y -= lineH;
      }
    }
    var saved = await pdfDoc.save();
    var blob = new Blob([saved], { type: 'application/pdf' });
    var pv = ''; try { var u = await EditIt.renderPdfPageToDataURL(saved, 1, 0.7); pv = EditIt.outputPreviewHTML(u, 'PDF preview'); } catch (e) { }
    outputCard(outputEl, title || 'Converted to PDF!', pdfDoc.getPageCount() + ' pages \u2022 ' + EditIt.formatFileSize(blob.size), blob, defaultName, pv);
  }

  // ===========================
  // JSON TO PDF
  // ===========================
  setupFileTool('json-to-pdf',
    function (f) { return f.name.endsWith('.json') || f.type === 'application/json'; },
    async function (file, outputEl) {
      EditIt.showProgress('Reading JSON...', 30);
      var text = await file.text();
      try { text = JSON.stringify(JSON.parse(text), null, 2); } catch (e) { /* use raw text */ }
      EditIt.hideProgress();
      await textFileToPdf(text, outputEl, file.name.replace(/\.json$/i, '') + '.pdf', 'JSON Converted to PDF!');
      EditIt.showToast('JSON converted to PDF!', 'success');
    }
  );

  // ===========================
  // XML TO PDF
  // ===========================
  setupFileTool('xml-to-pdf',
    function (f) { return f.name.endsWith('.xml') || f.type.includes('xml'); },
    async function (file, outputEl) {
      EditIt.showProgress('Reading XML...', 30);
      var text = await file.text();
      EditIt.hideProgress();
      await textFileToPdf(text, outputEl, file.name.replace(/\.xml$/i, '') + '.pdf', 'XML Converted to PDF!');
      EditIt.showToast('XML converted to PDF!', 'success');
    }
  );

  // ===========================
  // BASE64 TO PDF
  // ===========================
  (function () {
    var actionBtn = document.getElementById('base64-to-pdf-action');
    var outputEl = document.getElementById('base64-to-pdf-output');
    var textInput = document.getElementById('base64-text-input');
    var b64Content = '';

    document.addEventListener('files-added', async function (e) {
      if (e.detail.toolId !== 'base64-to-pdf') return;
      var f = e.detail.files[0];
      if (f) {
        b64Content = await f.text();
        textInput.value = b64Content.substring(0, 500) + (b64Content.length > 500 ? '...' : '');
        var fileListEl = document.getElementById('base64-to-pdf-files');
        fileListEl.innerHTML = '';
        var item = EditIt.createFileItem(f, 0);
        item.querySelector('.file-item-remove').addEventListener('click', function () {
          b64Content = ''; fileListEl.innerHTML = ''; textInput.value = ''; outputEl.innerHTML = '';
        });
        fileListEl.appendChild(item);
      }
    });

    actionBtn.addEventListener('click', async function () {
      var raw = b64Content || textInput.value.trim();
      if (!raw) { EditIt.showToast('Please paste or upload Base64 content', 'error'); return; }
      // Strip data URI prefix if present
      if (raw.indexOf(',') !== -1 && raw.indexOf('base64') !== -1) raw = raw.split(',')[1];
      raw = raw.replace(/\s/g, '');
      EditIt.setButtonLoading(actionBtn, true);
      try {
        var binary = atob(raw);
        var bytes = new Uint8Array(binary.length);
        for (var i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
        var blob = new Blob([bytes], { type: 'application/pdf' });
        var pv = ''; try { var u = await EditIt.renderPdfPageToDataURL(bytes.buffer, 1, 0.7); pv = EditIt.outputPreviewHTML(u, 'Decoded PDF preview'); } catch (e) { }
        outputCard(outputEl, 'Decoded to PDF!', EditIt.formatFileSize(blob.size), blob, 'decoded.pdf', pv);
        EditIt.showToast('Base64 decoded to PDF!', 'success');
      } catch (err) { EditIt.showToast('Invalid Base64 string: ' + err.message, 'error'); }
      EditIt.setButtonLoading(actionBtn, false);
    });
  })();

  // ===========================
  // TIFF TO PDF
  // ===========================
  setupFileTool('tiff-to-pdf',
    function (f) { return f.name.match(/\.tiff?$/i) || f.type === 'image/tiff'; },
    async function (file, outputEl) {
      EditIt.showProgress('Reading TIFF...', 20);
      var buf = await EditIt.readFileAsArrayBuffer(file);
      var ifds = UTIF.decode(buf);
      var pdfDoc = await PDFDocument.create();

      for (var i = 0; i < ifds.length; i++) {
        EditIt.showProgress('Processing frame ' + (i + 1) + '/' + ifds.length + '...', ((i + 1) / ifds.length) * 80);
        UTIF.decodeImage(buf, ifds[i]);
        var rgba = UTIF.toRGBA8(ifds[i]);
        var w = ifds[i].width, h = ifds[i].height;
        // Convert RGBA to canvas, then to JPEG for embedding
        var canvas = document.createElement('canvas');
        canvas.width = w; canvas.height = h;
        var ctx = canvas.getContext('2d');
        var imgData = ctx.createImageData(w, h);
        imgData.data.set(new Uint8Array(rgba));
        ctx.putImageData(imgData, 0, 0);
        var jpgDataUrl = canvas.toDataURL('image/jpeg', 0.92);
        var jpgBytes = Uint8Array.from(atob(jpgDataUrl.split(',')[1]), function (c) { return c.charCodeAt(0); });
        var img = await pdfDoc.embedJpg(jpgBytes);
        var page = pdfDoc.addPage([w, h]);
        page.drawImage(img, { x: 0, y: 0, width: w, height: h });
      }

      EditIt.hideProgress();
      var saved = await pdfDoc.save();
      var blob = new Blob([saved], { type: 'application/pdf' });
      var pv = ''; try { var u = await EditIt.renderPdfPageToDataURL(saved, 1, 0.7); pv = EditIt.outputPreviewHTML(u, 'PDF preview'); } catch (e) { }
      outputCard(outputEl, 'Converted to PDF!', ifds.length + ' frame(s) \u2022 ' + EditIt.formatFileSize(blob.size), blob, file.name.replace(/\.tiff?$/i, '') + '.pdf', pv);
      EditIt.showToast('TIFF converted to PDF!', 'success');
    }
  );

  // ===========================
  // YAML TO PDF
  // ===========================
  setupFileTool('yaml-to-pdf',
    function (f) { return f.name.match(/\.ya?ml$/i) || f.type.includes('yaml'); },
    async function (file, outputEl) {
      EditIt.showProgress('Reading YAML...', 30);
      var text = await file.text();
      EditIt.hideProgress();
      await textFileToPdf(text, outputEl, file.name.replace(/\.ya?ml$/i, '') + '.pdf', 'YAML Converted to PDF!');
      EditIt.showToast('YAML converted to PDF!', 'success');
    }
  );

  // ===========================
  // 15. COMPARE PDF
  // ===========================
  (function () {
    const fileListEl = document.getElementById('compare-pdf-files');
    const viewer = document.getElementById('compare-pdf-viewer');
    const canvasA = document.getElementById('compare-canvas-a');
    const canvasB = document.getElementById('compare-canvas-b');
    const canvasDiff = document.getElementById('compare-canvas-diff');
    const nameA = document.getElementById('compare-name-a');
    const nameB = document.getElementById('compare-name-b');
    const pageInfoEl = document.getElementById('compare-page-info');
    const diffPanel = document.getElementById('compare-diff-panel');
    const diffInfo = document.getElementById('compare-diff-info');
    const showDiffCheck = document.getElementById('compare-show-diff');
    let files = [], pdfDocs = [], currentPage = 1, maxPages = 0;

    document.addEventListener('files-added', (e) => {
      if (e.detail.toolId !== 'compare-pdf') return;
      const pdfs = e.detail.files.filter(f => f.type === 'application/pdf' || f.name.endsWith('.pdf'));
      if (pdfs.length === 0) { EditIt.showToast('Please select PDF files', 'error'); return; }
      files = files.concat(pdfs).slice(0, 2);
      renderList();
    });

    function renderList() {
      fileListEl.innerHTML = '';
      files.forEach((f, i) => {
        const item = EditIt.createFileItem(f, i);
        item.querySelector('.file-item-remove').addEventListener('click', () => { files.splice(i, 1); renderList(); viewer.style.display = 'none'; });
        fileListEl.appendChild(item);
        EditIt.readFileAsArrayBuffer(f).then(b => EditIt.renderPdfPageToDataURL(b, 1, 0.3)).then(u => EditIt.setFileItemThumb(item, u)).catch(() => {});
      });
      if (files.length === 2) loadComparison();
      else viewer.style.display = 'none';
    }

    async function loadComparison() {
      try {
        pdfDocs = [];
        for (const f of files) {
          const buf = await EditIt.readFileAsArrayBuffer(f);
          pdfDocs.push(await pdfjsLib.getDocument({ data: new Uint8Array(buf) }).promise);
        }
        maxPages = Math.max(pdfDocs[0].numPages, pdfDocs[1].numPages);
        currentPage = 1;
        nameA.textContent = files[0].name;
        nameB.textContent = files[1].name;
        viewer.style.display = 'block';
        await renderPage();
        EditIt.showToast('PDFs loaded — navigate pages to compare', 'info');
      } catch (err) { EditIt.showToast('Error loading PDFs: ' + err.message, 'error'); }
    }

    async function renderPage() {
      pageInfoEl.textContent = 'Page ' + currentPage + ' / ' + maxPages;
      const scale = 1.2;
      for (let idx = 0; idx < 2; idx++) {
        const cv = idx === 0 ? canvasA : canvasB;
        const cvCtx = cv.getContext('2d');
        if (currentPage <= pdfDocs[idx].numPages) {
          const page = await pdfDocs[idx].getPage(currentPage);
          const vp = page.getViewport({ scale: scale });
          cv.width = vp.width; cv.height = vp.height;
          cvCtx.clearRect(0, 0, cv.width, cv.height);
          await page.render({ canvasContext: cvCtx, viewport: vp }).promise;
        } else {
          cv.width = canvasA.width || 400; cv.height = canvasA.height || 550;
          cvCtx.clearRect(0, 0, cv.width, cv.height);
          cvCtx.fillStyle = '#f0f0f0'; cvCtx.fillRect(0, 0, cv.width, cv.height);
          cvCtx.fillStyle = '#999'; cvCtx.font = '16px sans-serif'; cvCtx.textAlign = 'center';
          cvCtx.fillText('No page', cv.width / 2, cv.height / 2);
        }
      }
      if (showDiffCheck.checked) computeDiff();
      else diffPanel.style.display = 'none';
    }

    function computeDiff() {
      if (canvasA.width !== canvasB.width || canvasA.height !== canvasB.height) {
        diffPanel.style.display = 'none'; return;
      }
      var w = canvasA.width, h = canvasA.height;
      canvasDiff.width = w; canvasDiff.height = h;
      var ctxA = canvasA.getContext('2d'), ctxB = canvasB.getContext('2d'), ctxD = canvasDiff.getContext('2d');
      var dataA = ctxA.getImageData(0, 0, w, h).data;
      var dataB = ctxB.getImageData(0, 0, w, h).data;
      var diffImg = ctxD.createImageData(w, h);
      var diffPixels = 0, totalPixels = w * h;
      for (var i = 0; i < dataA.length; i += 4) {
        var dr = Math.abs(dataA[i] - dataB[i]);
        var dg = Math.abs(dataA[i + 1] - dataB[i + 1]);
        var db = Math.abs(dataA[i + 2] - dataB[i + 2]);
        var diff = (dr + dg + db) / 3;
        if (diff > 15) {
          diffImg.data[i] = 255; diffImg.data[i + 1] = 50; diffImg.data[i + 2] = 50; diffImg.data[i + 3] = 200;
          diffPixels++;
        } else {
          diffImg.data[i] = dataA[i]; diffImg.data[i + 1] = dataA[i + 1]; diffImg.data[i + 2] = dataA[i + 2]; diffImg.data[i + 3] = 60;
        }
      }
      ctxD.putImageData(diffImg, 0, 0);
      var pct = ((diffPixels / totalPixels) * 100).toFixed(1);
      diffInfo.textContent = pct + '% pixels differ (' + diffPixels.toLocaleString() + ' of ' + totalPixels.toLocaleString() + ')';
      diffPanel.style.display = 'block';
    }

    document.getElementById('compare-prev').addEventListener('click', function () { if (currentPage > 1) { currentPage--; renderPage(); } });
    document.getElementById('compare-next').addEventListener('click', function () { if (currentPage < maxPages) { currentPage++; renderPage(); } });
    showDiffCheck.addEventListener('change', function () { if (showDiffCheck.checked) computeDiff(); else diffPanel.style.display = 'none'; });
  })();

  // ===========================
  // 16. REDACT PDF
  // ===========================
  (function () {
    var canvas = document.getElementById('redact-canvas');
    var overlay = document.getElementById('redact-overlay');
    var workspace = document.getElementById('redact-workspace');
    var actionBtn = document.getElementById('redact-pdf-action');
    var outputEl = document.getElementById('redact-pdf-output');
    var pageInfoEl = document.getElementById('redact-page-info');
    var countEl = document.getElementById('redact-count');
    var ctx = canvas.getContext('2d');
    var octx = overlay.getContext('2d');
    var pdfFile = null, pdfBytes = null, pdfJsDoc = null;
    var currentPage = 1, totalPages = 0, renderScale = 1.2;
    var redactions = {}; // { pageNum: [{x,y,w,h}] }
    var isDragging = false, startX = 0, startY = 0;

    document.addEventListener('files-added', async function (e) {
      if (e.detail.toolId !== 'redact-pdf') return;
      var f = e.detail.files.find(function (f) { return f.type === 'application/pdf' || f.name.endsWith('.pdf'); });
      if (!f) { EditIt.showToast('Please select a PDF file', 'error'); return; }
      pdfFile = f;
      pdfBytes = await EditIt.readFileAsArrayBuffer(f);
      redactions = {};
      outputEl.innerHTML = '';
      var fileListEl = document.getElementById('redact-pdf-files');
      fileListEl.innerHTML = '';
      var item = EditIt.createFileItem(f, 0);
      item.querySelector('.file-item-remove').addEventListener('click', function () {
        pdfFile = null; fileListEl.innerHTML = ''; workspace.style.display = 'none'; actionBtn.disabled = true; outputEl.innerHTML = '';
      });
      fileListEl.appendChild(item);
      EditIt.readFileAsArrayBuffer(f).then(function (b) { return EditIt.renderPdfPageToDataURL(b, 1, 0.3); }).then(function (u) { EditIt.setFileItemThumb(item, u); }).catch(function () {});

      try {
        pdfJsDoc = await pdfjsLib.getDocument({ data: pdfBytes.slice(0) }).promise;
        totalPages = pdfJsDoc.numPages;
        currentPage = 1;
        workspace.style.display = 'block';
        actionBtn.disabled = false;
        await renderRedactPage();
      } catch (err) { EditIt.showToast('Error loading PDF: ' + err.message, 'error'); }
    });

    async function renderRedactPage() {
      var page = await pdfJsDoc.getPage(currentPage);
      var vp = page.getViewport({ scale: renderScale });
      canvas.width = vp.width; canvas.height = vp.height;
      overlay.width = vp.width; overlay.height = vp.height;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      await page.render({ canvasContext: ctx, viewport: vp }).promise;
      pageInfoEl.textContent = 'Page ' + currentPage + ' / ' + totalPages;
      drawRedactions();
    }

    function drawRedactions() {
      octx.clearRect(0, 0, overlay.width, overlay.height);
      var rects = redactions[currentPage] || [];
      rects.forEach(function (r) {
        octx.fillStyle = 'rgba(0, 0, 0, 0.85)';
        octx.fillRect(r.x, r.y, r.w, r.h);
        octx.strokeStyle = '#ff3333';
        octx.lineWidth = 1.5;
        octx.strokeRect(r.x, r.y, r.w, r.h);
      });
      updateCount();
    }

    function updateCount() {
      var total = Object.values(redactions).reduce(function (sum, arr) { return sum + arr.length; }, 0);
      countEl.textContent = total + ' redaction' + (total !== 1 ? 's' : '');
    }

    function getCanvasCoords(e) {
      var rect = canvas.getBoundingClientRect();
      var scaleX = canvas.width / rect.width, scaleY = canvas.height / rect.height;
      var clientX = e.clientX || (e.touches && e.touches[0] ? e.touches[0].clientX : 0);
      var clientY = e.clientY || (e.touches && e.touches[0] ? e.touches[0].clientY : 0);
      return { x: (clientX - rect.left) * scaleX, y: (clientY - rect.top) * scaleY };
    }

    var wrap = canvas.parentElement;
    wrap.addEventListener('mousedown', function (e) {
      if (!pdfJsDoc) return;
      var c = getCanvasCoords(e); startX = c.x; startY = c.y; isDragging = true;
    });
    document.addEventListener('mousemove', function (e) {
      if (!isDragging) return;
      var c = getCanvasCoords(e);
      drawRedactions();
      octx.fillStyle = 'rgba(0, 0, 0, 0.5)';
      octx.fillRect(Math.min(startX, c.x), Math.min(startY, c.y), Math.abs(c.x - startX), Math.abs(c.y - startY));
      octx.strokeStyle = '#ff3333'; octx.lineWidth = 2; octx.setLineDash([4, 4]);
      octx.strokeRect(Math.min(startX, c.x), Math.min(startY, c.y), Math.abs(c.x - startX), Math.abs(c.y - startY));
      octx.setLineDash([]);
    });
    document.addEventListener('mouseup', function (e) {
      if (!isDragging) return; isDragging = false;
      var c = getCanvasCoords(e);
      var rx = Math.min(startX, c.x), ry = Math.min(startY, c.y), rw = Math.abs(c.x - startX), rh = Math.abs(c.y - startY);
      if (rw > 5 && rh > 5) {
        if (!redactions[currentPage]) redactions[currentPage] = [];
        redactions[currentPage].push({ x: rx, y: ry, w: rw, h: rh });
      }
      drawRedactions();
    });

    wrap.addEventListener('touchstart', function (e) {
      if (!pdfJsDoc) return; e.preventDefault();
      var c = getCanvasCoords(e); startX = c.x; startY = c.y; isDragging = true;
    }, { passive: false });
    document.addEventListener('touchmove', function (e) {
      if (!isDragging) return; e.preventDefault();
      var c = getCanvasCoords(e);
      drawRedactions();
      octx.fillStyle = 'rgba(0, 0, 0, 0.5)';
      octx.fillRect(Math.min(startX, c.x), Math.min(startY, c.y), Math.abs(c.x - startX), Math.abs(c.y - startY));
    }, { passive: false });
    document.addEventListener('touchend', function () { if (!isDragging) return; isDragging = false; drawRedactions(); });

    document.getElementById('redact-prev').addEventListener('click', function () { if (currentPage > 1) { currentPage--; renderRedactPage(); } });
    document.getElementById('redact-next').addEventListener('click', function () { if (currentPage < totalPages) { currentPage++; renderRedactPage(); } });
    document.getElementById('redact-undo').addEventListener('click', function () {
      var rects = redactions[currentPage];
      if (rects && rects.length) { rects.pop(); drawRedactions(); }
    });

    actionBtn.addEventListener('click', async function () {
      var totalRedactions = Object.values(redactions).reduce(function (s, a) { return s + a.length; }, 0);
      if (!pdfBytes || totalRedactions === 0) { EditIt.showToast('Draw at least one redaction box', 'error'); return; }
      EditIt.setButtonLoading(actionBtn, true);
      try {
        var pdfDoc = await PDFDocument.load(pdfBytes);
        var pages = pdfDoc.getPages();
        for (var pageStr in redactions) {
          var pageIdx = parseInt(pageStr) - 1;
          if (pageIdx >= pages.length) continue;
          var page = pages[pageIdx];
          var sz = page.getSize();
          var pdfJsPage = await pdfJsDoc.getPage(parseInt(pageStr));
          var pdfVp = pdfJsPage.getViewport({ scale: 1 });
          // Scale factor: canvas was rendered at renderScale, PDF native is scale=1
          var scaleFactor = 1 / renderScale;
          var rects = redactions[pageStr];
          rects.forEach(function (r) {
            var px = r.x * scaleFactor, py = r.y * scaleFactor, pw = r.w * scaleFactor, ph = r.h * scaleFactor;
            // Convert from canvas coords (y down) to PDF coords (y up)
            page.drawRectangle({ x: px, y: sz.height - py - ph, width: pw, height: ph, color: rgb(0, 0, 0) });
          });
        }
        var saved = await pdfDoc.save();
        var blob = new Blob([saved], { type: 'application/pdf' });
        var pv = ''; try { var u = await EditIt.renderPdfPageToDataURL(saved, 1, 0.7); pv = EditIt.outputPreviewHTML(u, 'Redacted preview'); } catch (e) { }
        outputCard(outputEl, 'PDF Redacted!', totalRedactions + ' area(s) redacted \u2022 ' + EditIt.formatFileSize(blob.size), blob, pdfFile.name.replace('.pdf', '') + '_redacted.pdf', pv);
        EditIt.showToast('Redactions applied permanently!', 'success');
      } catch (err) { console.error(err); EditIt.showToast('Error: ' + err.message, 'error'); }
      EditIt.setButtonLoading(actionBtn, false);
    });
  })();

  // ===========================
  // 17. CROP PDF
  // ===========================
  (function () {
    var canvas = document.getElementById('crop-pdf-canvas');
    var overlayEl = document.getElementById('crop-pdf-overlay');
    var workspace = document.getElementById('crop-pdf-workspace');
    var dimensionsEl = document.getElementById('crop-pdf-dimensions');
    var actionBtn = document.getElementById('crop-pdf-action');
    var outputEl = document.getElementById('crop-pdf-output');
    var ctx = canvas.getContext('2d');
    var pdfFile = null, pdfBytes = null, pdfJsDoc = null;
    var displayScale = 1, pdfPageWidth = 0, pdfPageHeight = 0;
    var isDragging = false, startX = 0, startY = 0;
    var cropX = 0, cropY = 0, cropW = 0, cropH = 0;

    document.addEventListener('files-added', async function (e) {
      if (e.detail.toolId !== 'crop-pdf') return;
      var f = e.detail.files.find(function (f) { return f.type === 'application/pdf' || f.name.endsWith('.pdf'); });
      if (!f) { EditIt.showToast('Please select a PDF file', 'error'); return; }
      pdfFile = f;
      pdfBytes = await EditIt.readFileAsArrayBuffer(f);
      outputEl.innerHTML = '';
      var fileListEl = document.getElementById('crop-pdf-files');
      fileListEl.innerHTML = '';
      var item = EditIt.createFileItem(f, 0);
      item.querySelector('.file-item-remove').addEventListener('click', function () {
        pdfFile = null; fileListEl.innerHTML = ''; workspace.style.display = 'none'; actionBtn.disabled = true; outputEl.innerHTML = '';
      });
      fileListEl.appendChild(item);
      EditIt.readFileAsArrayBuffer(f).then(function (b) { return EditIt.renderPdfPageToDataURL(b, 1, 0.3); }).then(function (u) { EditIt.setFileItemThumb(item, u); }).catch(function () {});

      try {
        pdfJsDoc = await pdfjsLib.getDocument({ data: pdfBytes.slice(0) }).promise;
        var page = await pdfJsDoc.getPage(1);
        var vp = page.getViewport({ scale: 1 });
        pdfPageWidth = vp.width;
        pdfPageHeight = vp.height;
        var maxDisplay = Math.min(800, window.innerWidth - 80);
        displayScale = maxDisplay / vp.width;
        canvas.width = vp.width * displayScale;
        canvas.height = vp.height * displayScale;
        var renderVp = page.getViewport({ scale: displayScale });
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        await page.render({ canvasContext: ctx, viewport: renderVp }).promise;
        workspace.style.display = 'block';
        actionBtn.disabled = true;
        overlayEl.style.display = 'none';
        cropW = 0; cropH = 0;
        dimensionsEl.textContent = 'Page: ' + Math.round(pdfPageWidth) + ' \u00d7 ' + Math.round(pdfPageHeight) + ' pt \u2014 Click and drag to select crop area';
      } catch (err) { EditIt.showToast('Error loading PDF: ' + err.message, 'error'); }
    });

    var canvasWrap = canvas.parentElement;

    canvasWrap.addEventListener('mousedown', function (e) {
      if (!pdfJsDoc) return;
      var rect = canvas.getBoundingClientRect();
      startX = e.clientX - rect.left; startY = e.clientY - rect.top;
      isDragging = true;
      overlayEl.style.display = 'block';
      overlayEl.style.left = startX + 'px'; overlayEl.style.top = startY + 'px';
      overlayEl.style.width = '0px'; overlayEl.style.height = '0px';
    });

    document.addEventListener('mousemove', function (e) {
      if (!isDragging) return;
      var rect = canvas.getBoundingClientRect();
      var cx = Math.max(0, Math.min(e.clientX - rect.left, canvas.offsetWidth));
      var cy = Math.max(0, Math.min(e.clientY - rect.top, canvas.offsetHeight));
      cropX = Math.min(startX, cx); cropY = Math.min(startY, cy);
      cropW = Math.abs(cx - startX); cropH = Math.abs(cy - startY);
      overlayEl.style.left = cropX + 'px'; overlayEl.style.top = cropY + 'px';
      overlayEl.style.width = cropW + 'px'; overlayEl.style.height = cropH + 'px';
      var scaleRatio = canvas.width / canvas.offsetWidth;
      var realW = Math.round((cropW * scaleRatio) / displayScale), realH = Math.round((cropH * scaleRatio) / displayScale);
      dimensionsEl.textContent = 'Crop: ' + realW + ' \u00d7 ' + realH + ' pt';
    });

    document.addEventListener('mouseup', function () {
      if (!isDragging) return;
      isDragging = false;
      actionBtn.disabled = cropW < 5 || cropH < 5;
    });

    canvasWrap.addEventListener('touchstart', function (e) {
      if (!pdfJsDoc) return; e.preventDefault();
      var rect = canvas.getBoundingClientRect(); var t = e.touches[0];
      startX = t.clientX - rect.left; startY = t.clientY - rect.top;
      isDragging = true; overlayEl.style.display = 'block';
    }, { passive: false });
    document.addEventListener('touchmove', function (e) {
      if (!isDragging) return; e.preventDefault();
      var rect = canvas.getBoundingClientRect(); var t = e.touches[0];
      var cx = Math.max(0, Math.min(t.clientX - rect.left, canvas.offsetWidth));
      var cy = Math.max(0, Math.min(t.clientY - rect.top, canvas.offsetHeight));
      cropX = Math.min(startX, cx); cropY = Math.min(startY, cy);
      cropW = Math.abs(cx - startX); cropH = Math.abs(cy - startY);
      overlayEl.style.left = cropX + 'px'; overlayEl.style.top = cropY + 'px';
      overlayEl.style.width = cropW + 'px'; overlayEl.style.height = cropH + 'px';
    }, { passive: false });
    document.addEventListener('touchend', function () { if (!isDragging) return; isDragging = false; actionBtn.disabled = cropW < 5 || cropH < 5; });

    actionBtn.addEventListener('click', async function () {
      if (!pdfBytes || cropW < 5 || cropH < 5) return;
      EditIt.setButtonLoading(actionBtn, true);
      try {
        // Convert display CSS coords → canvas pixel coords → PDF coords
        var scaleRatio = canvas.width / canvas.offsetWidth;
        var canvasCropX = cropX * scaleRatio, canvasCropY = cropY * scaleRatio;
        var canvasCropW = cropW * scaleRatio, canvasCropH = cropH * scaleRatio;
        // Canvas pixels to PDF points
        var pdfCropX = canvasCropX / displayScale;
        var pdfCropY = canvasCropY / displayScale;
        var pdfCropW = canvasCropW / displayScale;
        var pdfCropH = canvasCropH / displayScale;
        // PDF CropBox: y=0 is bottom
        var left = pdfCropX;
        var bottom = pdfPageHeight - pdfCropY - pdfCropH;

        var pdfDoc = await PDFDocument.load(pdfBytes);
        var applyAll = document.getElementById('crop-pdf-all').checked;
        var pages = pdfDoc.getPages();

        (applyAll ? pages : [pages[0]]).forEach(function (page) {
          page.setCropBox(left, bottom, pdfCropW, pdfCropH);
          page.setMediaBox(left, bottom, pdfCropW, pdfCropH);
        });

        var saved = await pdfDoc.save();
        var blob = new Blob([saved], { type: 'application/pdf' });
        var pv = ''; try { var u = await EditIt.renderPdfPageToDataURL(saved, 1, 0.7); pv = EditIt.outputPreviewHTML(u, 'Cropped PDF preview'); } catch (ex) { }
        var pagesAffected = applyAll ? pages.length : 1;
        outputCard(outputEl, 'PDF Cropped!', pagesAffected + ' page(s) cropped \u2022 ' + EditIt.formatFileSize(blob.size), blob, pdfFile.name.replace('.pdf', '') + '_cropped.pdf', pv);
        EditIt.showToast('PDF cropped!', 'success');
      } catch (err) { console.error(err); EditIt.showToast('Error: ' + err.message, 'error'); }
      EditIt.setButtonLoading(actionBtn, false);
    });
  })();

})();


// ===== file.tools — Extra Tools (Image, Text, Utility) =====
(function () {
  'use strict';
  var PDFDoc = PDFLib.PDFDocument, rgb = PDFLib.rgb, SF = PDFLib.StandardFonts;

  // ====== HELPER: Image file tool (with auto format normalization) ======
  var IMG_PATTERN = /\.(jpe?g|png|gif|webp|bmp|svg|avif|heic|heif|dng|tiff?|cr2|nef|arw|orf|rw2|pef|ico|tga|hdr)$/i;
  function isImageFile(f) { return f.type.startsWith('image/') || IMG_PATTERN.test(f.name); }

  function imgTool(id, onFile, onAction) {
    var fileListEl = document.getElementById(id + '-files');
    var actionBtn = document.getElementById(id + '-action');
    var outputEl = document.getElementById(id + '-output');
    var file = null, normalizedFile = null;
    document.addEventListener('files-added', async function (e) {
      if (e.detail.toolId !== id) return;
      var f = e.detail.files.find(isImageFile);
      if (!f) { EditIt.showToast('Please select an image', 'error'); return; }
      file = f;
      // Normalize exotic formats (HEIC, TIFF, DNG, etc.)
      normalizedFile = await EditIt.normalizeImageFile(f);
      if (!normalizedFile) { EditIt.showToast('Could not read this image format', 'error'); return; }
      if (fileListEl) {
        fileListEl.innerHTML = '';
        var item = EditIt.createFileItem(f, 0);
        item.querySelector('.file-item-remove').addEventListener('click', function () {
          file = null; normalizedFile = null; fileListEl.innerHTML = '';
          if (actionBtn) actionBtn.disabled = true; outputEl.innerHTML = '';
          // Hide split layouts and option panels
          var splitEl = document.getElementById(id.replace(/-/g, '') + '-split') || document.querySelector('#' + id + '-view .tool-split');
          if (splitEl) splitEl.style.display = 'none';
          var opts = document.getElementById(id + '-options');
          if (opts) opts.style.display = 'none';
        });
        fileListEl.appendChild(item);
      }
      if (actionBtn) actionBtn.disabled = false;
      outputEl.innerHTML = '';
      if (onFile) onFile(normalizedFile);
    });
    if (actionBtn) actionBtn.addEventListener('click', async function () {
      if (!normalizedFile) return; EditIt.setButtonLoading(actionBtn, true);
      try { await onAction(normalizedFile, outputEl); } catch (err) { console.error(err); EditIt.showToast('Error: ' + err.message, 'error'); }
      EditIt.setButtonLoading(actionBtn, false);
    });
  }

  function dlCard(el, title, info, blob, name, preview) {
    el.innerHTML = '<div class="output-card"><h3>\u2713 ' + title + '</h3><p>' + info + '</p>' + (preview || '') + '<div class="output-filename"><label>File name:</label><input type="text" class="input output-dl-name" value="' + name + '"></div><button class="btn btn-success output-dl-btn">Download</button></div>';
    el.querySelector('.output-dl-btn').addEventListener('click', function () { EditIt.downloadBlob(blob, el.querySelector('.output-dl-name').value.trim() || name); });
  }

  // =============================================
  // PDF TOOLS
  // =============================================

  // FLATTEN PDF
  (function () {
    var setupPdfTool = window.EditIt._setupPdfTool; // might not exist, use inline
    var actionBtn = document.getElementById('flatten-pdf-action');
    var outputEl = document.getElementById('flatten-pdf-output');
    var fileListEl = document.getElementById('flatten-pdf-files');
    var file = null;
    document.addEventListener('files-added', async function (e) {
      if (e.detail.toolId !== 'flatten-pdf') return;
      var f = e.detail.files.find(function (f) { return f.name.endsWith('.pdf'); });
      if (!f) return;
      file = f; fileListEl.innerHTML = ''; var item = EditIt.createFileItem(f, 0);
      item.querySelector('.file-item-remove').addEventListener('click', function () { file = null; fileListEl.innerHTML = ''; actionBtn.disabled = true; });
      fileListEl.appendChild(item); actionBtn.disabled = false; outputEl.innerHTML = '';
      EditIt.readFileAsArrayBuffer(f).then(function (b) { return EditIt.renderPdfPageToDataURL(b, 1, 0.3); }).then(function (u) { EditIt.setFileItemThumb(item, u); }).catch(function () {});
    });
    actionBtn.addEventListener('click', async function () {
      if (!file) return; EditIt.setButtonLoading(actionBtn, true);
      try {
        var bytes = await EditIt.readFileAsArrayBuffer(file);
        var src = await pdfjsLib.getDocument({ data: bytes }).promise;
        var newPdf = await PDFDoc.create();
        for (var i = 1; i <= src.numPages; i++) {
          EditIt.showProgress('Flattening page ' + i + '/' + src.numPages, (i / src.numPages) * 90);
          var p = await src.getPage(i); var vp = p.getViewport({ scale: 2 });
          var c = document.createElement('canvas'); c.width = vp.width; c.height = vp.height;
          await p.render({ canvasContext: c.getContext('2d'), viewport: vp }).promise;
          var jpg = c.toDataURL('image/jpeg', 0.92);
          var jb = Uint8Array.from(atob(jpg.split(',')[1]), function (c) { return c.charCodeAt(0); });
          var img = await newPdf.embedJpg(jb);
          var pg = newPdf.addPage([vp.width / 2, vp.height / 2]);
          pg.drawImage(img, { x: 0, y: 0, width: pg.getWidth(), height: pg.getHeight() });
        }
        EditIt.hideProgress();
        var saved = await newPdf.save(); var blob = new Blob([saved], { type: 'application/pdf' });
        dlCard(outputEl, 'PDF Flattened!', src.numPages + ' pages \u2022 ' + EditIt.formatFileSize(blob.size), blob, file.name.replace('.pdf', '') + '_flat.pdf');
        EditIt.showToast('PDF flattened!', 'success');
      } catch (err) { EditIt.hideProgress(); EditIt.showToast('Error: ' + err.message, 'error'); }
      EditIt.setButtonLoading(actionBtn, false);
    });
  })();

  // EXTRACT IMAGES FROM PDF
  (function () {
    var actionBtn = document.getElementById('extract-images-pdf-action');
    var outputEl = document.getElementById('extract-images-pdf-output');
    var fileListEl = document.getElementById('extract-images-pdf-files');
    var file = null;
    document.addEventListener('files-added', function (e) {
      if (e.detail.toolId !== 'extract-images-pdf') return;
      file = e.detail.files.find(function (f) { return f.name.endsWith('.pdf'); });
      if (!file) return; fileListEl.innerHTML = '';
      var item = EditIt.createFileItem(file, 0); item.querySelector('.file-item-remove').addEventListener('click', function () { file = null; fileListEl.innerHTML = ''; actionBtn.disabled = true; outputEl.innerHTML = ''; });
      fileListEl.appendChild(item); actionBtn.disabled = false; outputEl.innerHTML = '';
    });
    actionBtn.addEventListener('click', async function () {
      if (!file) return; EditIt.setButtonLoading(actionBtn, true);
      try {
        var bytes = await EditIt.readFileAsArrayBuffer(file);
        var pdf = await pdfjsLib.getDocument({ data: bytes }).promise;
        var images = [];
        for (var i = 1; i <= pdf.numPages; i++) {
          EditIt.showProgress('Extracting page ' + i, (i / pdf.numPages) * 90);
          var p = await pdf.getPage(i); var vp = p.getViewport({ scale: 2 });
          var c = document.createElement('canvas'); c.width = vp.width; c.height = vp.height;
          await p.render({ canvasContext: c.getContext('2d'), viewport: vp }).promise;
          var blob = await new Promise(function (r) { c.toBlob(r, 'image/png'); });
          images.push({ blob: blob, name: 'page_' + i + '.png', url: URL.createObjectURL(blob), size: blob.size });
        }
        EditIt.hideProgress();
        var html = '<div class="output-card"><h3>\u2713 Images Extracted!</h3><p>' + images.length + ' page images</p>';
        if (images.length > 1) html += '<button class="btn btn-success" id="ext-img-zip">Download All (ZIP)</button>';
        html += '</div><div class="output-images">';
        images.forEach(function (img, idx) {
          html += '<div class="output-image-card"><img src="' + img.url + '"><div class="output-image-info"><span>Page ' + (idx + 1) + ' \u2022 ' + EditIt.formatFileSize(img.size) + '</span><button class="btn btn-sm btn-outline ext-dl" data-i="' + idx + '">Download</button></div></div>';
        });
        html += '</div>';
        outputEl.innerHTML = html;
        outputEl.querySelectorAll('.ext-dl').forEach(function (b) { b.addEventListener('click', function () { var i = parseInt(b.dataset.i); EditIt.downloadBlob(images[i].blob, images[i].name); }); });
        var zipBtn = document.getElementById('ext-img-zip');
        if (zipBtn) zipBtn.addEventListener('click', async function () { var z = new JSZip(); images.forEach(function (im) { z.file(im.name, im.blob); }); EditIt.downloadBlob(await z.generateAsync({ type: 'blob' }), file.name.replace('.pdf', '') + '_images.zip'); });
        EditIt.showToast('Images extracted!', 'success');
      } catch (err) { EditIt.hideProgress(); EditIt.showToast('Error: ' + err.message, 'error'); }
      EditIt.setButtonLoading(actionBtn, false);
    });
  })();

  // PDF METADATA EDITOR
  (function () {
    var opts = document.getElementById('pdf-metadata-options');
    var actionBtn = document.getElementById('pdf-metadata-action');
    var outputEl = document.getElementById('pdf-metadata-output');
    var fileListEl = document.getElementById('pdf-metadata-files');
    var file = null;
    document.addEventListener('files-added', async function (e) {
      if (e.detail.toolId !== 'pdf-metadata') return;
      file = e.detail.files.find(function (f) { return f.name.endsWith('.pdf'); });
      if (!file) return; fileListEl.innerHTML = ''; outputEl.innerHTML = '';
      var item = EditIt.createFileItem(file, 0); item.querySelector('.file-item-remove').addEventListener('click', function () { file = null; fileListEl.innerHTML = ''; opts.style.display = 'none'; actionBtn.disabled = true; });
      fileListEl.appendChild(item);
      var bytes = await EditIt.readFileAsArrayBuffer(file);
      var pdf = await PDFDoc.load(bytes);
      document.getElementById('meta-title').value = pdf.getTitle() || '';
      document.getElementById('meta-author').value = pdf.getAuthor() || '';
      document.getElementById('meta-subject').value = pdf.getSubject() || '';
      document.getElementById('meta-keywords').value = (pdf.getKeywords() || '');
      opts.style.display = 'block'; actionBtn.disabled = false;
    });
    actionBtn.addEventListener('click', async function () {
      if (!file) return; EditIt.setButtonLoading(actionBtn, true);
      try {
        var bytes = await EditIt.readFileAsArrayBuffer(file);
        var pdf = await PDFDoc.load(bytes);
        pdf.setTitle(document.getElementById('meta-title').value);
        pdf.setAuthor(document.getElementById('meta-author').value);
        pdf.setSubject(document.getElementById('meta-subject').value);
        pdf.setKeywords(document.getElementById('meta-keywords').value.split(',').map(function (s) { return s.trim(); }));
        pdf.setProducer('file.tools'); pdf.setModificationDate(new Date());
        var saved = await pdf.save(); var blob = new Blob([saved], { type: 'application/pdf' });
        dlCard(outputEl, 'Metadata Updated!', EditIt.formatFileSize(blob.size), blob, file.name.replace('.pdf', '') + '_meta.pdf');
        EditIt.showToast('Metadata saved!', 'success');
      } catch (err) { EditIt.showToast('Error: ' + err.message, 'error'); }
      EditIt.setButtonLoading(actionBtn, false);
    });
  })();

  // GRAYSCALE PDF
  (function () {
    var actionBtn = document.getElementById('grayscale-pdf-action');
    var outputEl = document.getElementById('grayscale-pdf-output');
    var fileListEl = document.getElementById('grayscale-pdf-files');
    var file = null;
    document.addEventListener('files-added', function (e) {
      if (e.detail.toolId !== 'grayscale-pdf') return;
      file = e.detail.files.find(function (f) { return f.name.endsWith('.pdf'); }); if (!file) return;
      fileListEl.innerHTML = ''; var item = EditIt.createFileItem(file, 0); item.querySelector('.file-item-remove').addEventListener('click', function () { file = null; fileListEl.innerHTML = ''; actionBtn.disabled = true; }); fileListEl.appendChild(item); actionBtn.disabled = false; outputEl.innerHTML = '';
    });
    actionBtn.addEventListener('click', async function () {
      if (!file) return; EditIt.setButtonLoading(actionBtn, true);
      try {
        var bytes = await EditIt.readFileAsArrayBuffer(file);
        var src = await pdfjsLib.getDocument({ data: bytes }).promise;
        var newPdf = await PDFDoc.create();
        for (var i = 1; i <= src.numPages; i++) {
          EditIt.showProgress('Converting page ' + i, (i / src.numPages) * 90);
          var p = await src.getPage(i); var vp = p.getViewport({ scale: 1.5 });
          var c = document.createElement('canvas'); c.width = vp.width; c.height = vp.height;
          var ctx = c.getContext('2d'); ctx.filter = 'grayscale(100%)';
          await p.render({ canvasContext: ctx, viewport: vp }).promise;
          var jd = c.toDataURL('image/jpeg', 0.85);
          var jb = Uint8Array.from(atob(jd.split(',')[1]), function (c) { return c.charCodeAt(0); });
          var img = await newPdf.embedJpg(jb);
          var pg = newPdf.addPage([vp.width * (72 / 108), vp.height * (72 / 108)]);
          pg.drawImage(img, { x: 0, y: 0, width: pg.getWidth(), height: pg.getHeight() });
        }
        EditIt.hideProgress(); var saved = await newPdf.save();
        var blob = new Blob([saved], { type: 'application/pdf' });
        dlCard(outputEl, 'Converted to Grayscale!', src.numPages + ' pages', blob, file.name.replace('.pdf', '') + '_gray.pdf');
        EditIt.showToast('Converted to grayscale!', 'success');
      } catch (err) { EditIt.hideProgress(); EditIt.showToast('Error: ' + err.message, 'error'); }
      EditIt.setButtonLoading(actionBtn, false);
    });
  })();

  // PDF TO HTML
  (function () {
    var actionBtn = document.getElementById('pdf-to-html-action');
    var outputEl = document.getElementById('pdf-to-html-output');
    var fileListEl = document.getElementById('pdf-to-html-files');
    var file = null;
    document.addEventListener('files-added', function (e) { if (e.detail.toolId !== 'pdf-to-html') return; file = e.detail.files.find(function (f) { return f.name.endsWith('.pdf'); }); if (!file) return; fileListEl.innerHTML = ''; var item = EditIt.createFileItem(file, 0); item.querySelector('.file-item-remove').addEventListener('click', function () { file = null; fileListEl.innerHTML = ''; actionBtn.disabled = true; }); fileListEl.appendChild(item); actionBtn.disabled = false; outputEl.innerHTML = ''; });
    actionBtn.addEventListener('click', async function () {
      if (!file) return; EditIt.setButtonLoading(actionBtn, true);
      try {
        var bytes = await EditIt.readFileAsArrayBuffer(file);
        var pdf = await pdfjsLib.getDocument({ data: bytes }).promise;
        var html = '<!DOCTYPE html><html><head><meta charset="UTF-8"><title>' + file.name + '</title><style>body{font-family:Arial,sans-serif;max-width:800px;margin:40px auto;padding:0 20px;line-height:1.6;color:#333}.page{margin-bottom:40px;padding-bottom:20px;border-bottom:1px solid #ddd}.page h2{color:#666;font-size:14px}</style></head><body>';
        for (var i = 1; i <= pdf.numPages; i++) {
          var p = await pdf.getPage(i); var tc = await p.getTextContent();
          var text = tc.items.map(function (it) { return it.str; }).join(' ');
          html += '<div class="page"><h2>Page ' + i + '</h2><p>' + text.replace(/</g, '&lt;') + '</p></div>';
        }
        html += '</body></html>';
        var blob = new Blob([html], { type: 'text/html' });
        dlCard(outputEl, 'Converted to HTML!', pdf.numPages + ' pages \u2022 ' + EditIt.formatFileSize(blob.size), blob, file.name.replace('.pdf', '') + '.html');
        EditIt.showToast('PDF converted to HTML!', 'success');
      } catch (err) { EditIt.showToast('Error: ' + err.message, 'error'); }
      EditIt.setButtonLoading(actionBtn, false);
    });
  })();

  // MARKDOWN TO PDF
  (function () {
    var actionBtn = document.getElementById('markdown-to-pdf-action');
    var outputEl = document.getElementById('markdown-to-pdf-output');
    var mdInput = document.getElementById('md-text-input');
    var mdContent = '';
    document.addEventListener('files-added', async function (e) {
      if (e.detail.toolId !== 'markdown-to-pdf') return;
      var f = e.detail.files[0]; if (!f) return;
      mdContent = await f.text(); mdInput.value = mdContent;
      var fl = document.getElementById('markdown-to-pdf-files'); fl.innerHTML = '';
      var item = EditIt.createFileItem(f, 0); item.querySelector('.file-item-remove').addEventListener('click', function () { mdContent = ''; mdInput.value = ''; fl.innerHTML = ''; });
      fl.appendChild(item);
    });
    actionBtn.addEventListener('click', async function () {
      var text = mdContent || mdInput.value; if (!text.trim()) { EditIt.showToast('Enter Markdown content', 'error'); return; }
      EditIt.setButtonLoading(actionBtn, true);
      try {
        // Strip markdown to plain text for PDF (basic approach)
        var plain = text.replace(/#{1,6}\s*/g, '').replace(/\*\*(.+?)\*\*/g, '$1').replace(/\*(.+?)\*/g, '$1').replace(/`(.+?)`/g, '$1').replace(/\[(.+?)\]\(.+?\)/g, '$1').replace(/!\[.*?\]\(.+?\)/g, '').replace(/^[-*+]\s/gm, '• ').replace(/^\d+\.\s/gm, '');
        var pdf = await PDFDoc.create(); var font = await pdf.embedFont(SF.Helvetica);
        var boldFont = await pdf.embedFont(SF.HelveticaBold);
        var lines = plain.split('\n'); var page = pdf.addPage([595.28, 841.89]); var y = 791;
        lines.forEach(function (line) {
          if (y < 50) { page = pdf.addPage([595.28, 841.89]); y = 791; }
          var sz = 11; var f = font;
          if (line.trim() === '') { y -= 8; return; }
          page.drawText(line.substring(0, 100), { x: 50, y: y, size: sz, font: f, color: rgb(0.1, 0.1, 0.1) });
          y -= 16;
        });
        var saved = await pdf.save(); var blob = new Blob([saved], { type: 'application/pdf' });
        var pv = ''; try { pv = EditIt.outputPreviewHTML(await EditIt.renderPdfPageToDataURL(saved, 1, 0.7), 'Preview'); } catch (e) { }
        dlCard(outputEl, 'Markdown to PDF!', pdf.getPageCount() + ' pages', blob, 'document.pdf', pv);
        EditIt.showToast('Markdown converted!', 'success');
      } catch (err) { EditIt.showToast('Error: ' + err.message, 'error'); }
      EditIt.setButtonLoading(actionBtn, false);
    });
  })();

  // =============================================
  // IMAGE TOOLS
  // =============================================

  // ROTATE & FLIP IMAGE (with live preview)
  (function () {
    var action = 'cw90', loadedImg = null, loadedFile = null;
    var beforeCanvas = document.getElementById('rf-canvas-before');
    var afterCanvas = document.getElementById('rf-canvas-after');
    var previewArea = document.getElementById('rf-preview');

    function updatePreview() {
      if (!loadedImg) return;
      var w = loadedImg.naturalWidth, h = loadedImg.naturalHeight;
      // Draw "before" (small)
      var maxW = 350;
      var scale = Math.min(maxW / w, maxW / h, 1);
      beforeCanvas.width = w * scale; beforeCanvas.height = h * scale;
      beforeCanvas.getContext('2d').drawImage(loadedImg, 0, 0, beforeCanvas.width, beforeCanvas.height);
      // Draw "after"
      var aw, ah;
      if (action === 'cw90' || action === 'ccw90') { aw = h * scale; ah = w * scale; } else { aw = w * scale; ah = h * scale; }
      afterCanvas.width = aw; afterCanvas.height = ah;
      var ctx = afterCanvas.getContext('2d');
      ctx.save();
      if (action === 'cw90') { ctx.translate(aw, 0); ctx.rotate(Math.PI / 2); }
      else if (action === 'ccw90') { ctx.translate(0, ah); ctx.rotate(-Math.PI / 2); }
      else if (action === '180') { ctx.translate(aw, ah); ctx.rotate(Math.PI); }
      else if (action === 'flipH') { ctx.translate(aw, 0); ctx.scale(-1, 1); }
      else if (action === 'flipV') { ctx.translate(0, ah); ctx.scale(1, -1); }
      ctx.drawImage(loadedImg, 0, 0, beforeCanvas.width, beforeCanvas.height);
      ctx.restore();
      previewArea.style.display = 'block';
    }

    document.querySelectorAll('.rf-btn').forEach(function (b) {
      b.addEventListener('click', function () {
        document.querySelectorAll('.rf-btn').forEach(function (x) { x.classList.remove('active'); });
        b.classList.add('active'); action = b.dataset.action;
        updatePreview();
      });
    });

    imgTool('rotate-flip-image',
      async function (file) {
        document.getElementById('rf-split').style.display = 'grid';
        loadedFile = file;
        var du = await EditIt.readFileAsDataURL(file);
        loadedImg = await EditIt.loadImage(du);
        updatePreview();
      },
      async function (file, out) {
        var w = loadedImg.naturalWidth, h = loadedImg.naturalHeight;
        var c = document.createElement('canvas'); var ctx = c.getContext('2d');
        if (action === 'cw90' || action === 'ccw90') { c.width = h; c.height = w; } else { c.width = w; c.height = h; }
        ctx.save();
        if (action === 'cw90') { ctx.translate(h, 0); ctx.rotate(Math.PI / 2); }
        else if (action === 'ccw90') { ctx.translate(0, w); ctx.rotate(-Math.PI / 2); }
        else if (action === '180') { ctx.translate(w, h); ctx.rotate(Math.PI); }
        else if (action === 'flipH') { ctx.translate(w, 0); ctx.scale(-1, 1); }
        else if (action === 'flipV') { ctx.translate(0, h); ctx.scale(1, -1); }
        ctx.drawImage(loadedImg, 0, 0); ctx.restore();
        var blob = await new Promise(function (r) { c.toBlob(r, 'image/png'); });
        dlCard(out, 'Image Transformed!', c.width + '\u00d7' + c.height, blob, file.name.replace(/\.[^.]+$/, '') + '_' + action + '.png');
        EditIt.showToast('Image transformed!', 'success');
      });
  })();

  // IMAGE FILTERS (with live preview)
  (function () {
    var loadedImg = null;
    var beforeCanvas = document.getElementById('flt-canvas-before');
    var afterCanvas = document.getElementById('flt-canvas-after');
    var previewArea = document.getElementById('flt-preview');
    var sliders = ['flt-bright', 'flt-contrast', 'flt-saturate', 'flt-blur'];

    function getFilterStr() {
      return 'brightness(' + document.getElementById('flt-bright').value + '%) contrast(' + document.getElementById('flt-contrast').value + '%) saturate(' + document.getElementById('flt-saturate').value + '%) blur(' + document.getElementById('flt-blur').value + 'px)';
    }

    function updatePreview() {
      if (!loadedImg) return;
      var w = loadedImg.naturalWidth, h = loadedImg.naturalHeight;
      var maxW = 350;
      var scale = Math.min(maxW / w, maxW / h, 1);
      var sw = w * scale, sh = h * scale;
      // Before
      beforeCanvas.width = sw; beforeCanvas.height = sh;
      beforeCanvas.getContext('2d').drawImage(loadedImg, 0, 0, sw, sh);
      // After
      afterCanvas.width = sw; afterCanvas.height = sh;
      var ctx = afterCanvas.getContext('2d');
      ctx.filter = getFilterStr();
      ctx.drawImage(loadedImg, 0, 0, sw, sh);
      previewArea.style.display = 'block';
    }

    sliders.forEach(function (id) {
      var el = document.getElementById(id); if (!el) return;
      el.addEventListener('input', function () {
        var v = el.value + (id === 'flt-blur' ? 'px' : '%');
        document.getElementById(id + '-val').textContent = v;
        updatePreview();
      });
    });

    document.querySelectorAll('.flt-preset').forEach(function (b) {
      b.addEventListener('click', function () {
        var p = b.dataset.p;
        if (p === 'gray') {
          document.getElementById('flt-saturate').value = 0; document.getElementById('flt-saturate-val').textContent = '0%';
        } else if (p === 'sepia') {
          document.getElementById('flt-saturate').value = 50; document.getElementById('flt-saturate-val').textContent = '50%';
          document.getElementById('flt-bright').value = 110; document.getElementById('flt-bright-val').textContent = '110%';
          document.getElementById('flt-contrast').value = 90; document.getElementById('flt-contrast-val').textContent = '90%';
        } else if (p === 'invert') {
          // Invert is done via pixel manipulation in the final export, show effect in preview
        } else {
          sliders.forEach(function (id) {
            var d = id === 'flt-blur' ? 0 : 100;
            document.getElementById(id).value = d;
            document.getElementById(id + '-val').textContent = d + (id === 'flt-blur' ? 'px' : '%');
          });
        }
        updatePreview();
      });
    });

    imgTool('image-filters',
      async function (file) {
        document.getElementById('flt-split').style.display = 'grid';
        var du = await EditIt.readFileAsDataURL(file);
        loadedImg = await EditIt.loadImage(du);
        updatePreview();
      },
      async function (file, out) {
        var c = document.createElement('canvas'); c.width = loadedImg.naturalWidth; c.height = loadedImg.naturalHeight;
        var ctx = c.getContext('2d');
        ctx.filter = getFilterStr();
        ctx.drawImage(loadedImg, 0, 0);
        var blob = await new Promise(function (r) { c.toBlob(r, 'image/png'); });
        dlCard(out, 'Filters Applied!', EditIt.formatFileSize(blob.size), blob, file.name.replace(/\.[^.]+$/, '') + '_filtered.png');
        EditIt.showToast('Filters applied!', 'success');
      });
  })();

  // ADD TEXT TO IMAGE (with live preview)
  (function () {
    var loadedImg = null;
    var previewCanvas = document.getElementById('ati-canvas-preview');
    var previewArea = document.getElementById('ati-preview');

    function updatePreview() {
      if (!loadedImg) return;
      var w = loadedImg.naturalWidth, h = loadedImg.naturalHeight;
      var maxW = 600;
      var scale = Math.min(maxW / w, 1);
      previewCanvas.width = w * scale; previewCanvas.height = h * scale;
      var ctx = previewCanvas.getContext('2d');
      ctx.drawImage(loadedImg, 0, 0, previewCanvas.width, previewCanvas.height);
      var text = document.getElementById('ati-text').value || '';
      if (!text) { previewArea.style.display = 'block'; return; }
      var size = Math.round((parseInt(document.getElementById('ati-size').value) || 48) * scale);
      var color = document.getElementById('ati-color').value;
      var pos = document.getElementById('ati-pos').value;
      var shadow = document.getElementById('ati-shadow').checked;
      ctx.font = 'bold ' + size + 'px Arial'; ctx.fillStyle = color; ctx.textAlign = 'center';
      if (shadow) { ctx.shadowColor = 'rgba(0,0,0,0.6)'; ctx.shadowBlur = 6 * scale; ctx.shadowOffsetX = 2 * scale; ctx.shadowOffsetY = 2 * scale; }
      var y = pos === 'top' ? size + 15 * scale : pos === 'bottom' ? previewCanvas.height - 15 * scale : previewCanvas.height / 2;
      ctx.fillText(text, previewCanvas.width / 2, y);
      previewArea.style.display = 'block';
    }

    // Listen to all input changes
    ['ati-text', 'ati-size', 'ati-color', 'ati-pos', 'ati-shadow'].forEach(function (id) {
      var el = document.getElementById(id);
      if (el) el.addEventListener('input', updatePreview);
      if (el) el.addEventListener('change', updatePreview);
    });

    imgTool('add-text-image',
      async function (file) {
        document.getElementById('ati-split').style.display = 'grid';
        var du = await EditIt.readFileAsDataURL(file);
        loadedImg = await EditIt.loadImage(du);
        updatePreview();
      },
      async function (file, out) {
        var c = document.createElement('canvas'); c.width = loadedImg.naturalWidth; c.height = loadedImg.naturalHeight;
        var ctx = c.getContext('2d'); ctx.drawImage(loadedImg, 0, 0);
        var text = document.getElementById('ati-text').value || 'Text';
        var size = parseInt(document.getElementById('ati-size').value) || 48;
        var color = document.getElementById('ati-color').value;
        var pos = document.getElementById('ati-pos').value;
        var shadow = document.getElementById('ati-shadow').checked;
        ctx.font = 'bold ' + size + 'px Arial'; ctx.fillStyle = color; ctx.textAlign = 'center';
        if (shadow) { ctx.shadowColor = 'rgba(0,0,0,0.6)'; ctx.shadowBlur = 8; ctx.shadowOffsetX = 2; ctx.shadowOffsetY = 2; }
        var y = pos === 'top' ? size + 20 : pos === 'bottom' ? c.height - 20 : c.height / 2;
        ctx.fillText(text, c.width / 2, y);
        var blob = await new Promise(function (r) { c.toBlob(r, 'image/png'); });
        dlCard(out, 'Text Added!', EditIt.formatFileSize(blob.size), blob, file.name.replace(/\.[^.]+$/, '') + '_text.png');
        EditIt.showToast('Text added!', 'success');
      });
  })();

  // UPSCALE IMAGE (multi-step + sharpening)
  (function () {
    var loadedImg = null, origW = 0, origH = 0, aspect = 1;
    var scaleVal = 2, targetW = 0, targetH = 0;
    var opts = document.getElementById('upscale-image-options');
    var wInput = document.getElementById('upscale-w');
    var hInput = document.getElementById('upscale-h');
    var lockRatio = document.getElementById('upscale-lock');
    var sharpSlider = document.getElementById('upscale-sharp');
    var sharpLabel = document.getElementById('upscale-sharp-val');
    var resultLabel = document.getElementById('upscale-result-size');
    var sharpNames = ['None', 'Medium', 'Strong', 'Maximum'];
    var updating = false;

    function updateTarget() {
      targetW = parseInt(wInput.value) || Math.round(origW * scaleVal);
      targetH = parseInt(hInput.value) || Math.round(origH * scaleVal);
      resultLabel.textContent = targetW + ' × ' + targetH + ' px (' + EditIt.formatFileSize(targetW * targetH * 4) + ' raw)';
    }

    sharpSlider.addEventListener('input', function () { sharpLabel.textContent = sharpNames[parseInt(sharpSlider.value)]; });

    document.querySelectorAll('.upscale-btn').forEach(function (b) {
      b.addEventListener('click', function () {
        document.querySelectorAll('.upscale-btn').forEach(function (x) { x.classList.remove('active'); });
        b.classList.add('active');
        scaleVal = parseInt(b.dataset.scale);
        wInput.value = Math.round(origW * scaleVal);
        hInput.value = Math.round(origH * scaleVal);
        updateTarget();
      });
    });

    document.querySelectorAll('.upscale-preset').forEach(function (b) {
      b.addEventListener('click', function () {
        document.querySelectorAll('.upscale-btn').forEach(function (x) { x.classList.remove('active'); });
        wInput.value = b.dataset.w;
        hInput.value = b.dataset.h;
        updateTarget();
      });
    });

    wInput.addEventListener('input', function () {
      if (updating) return;
      if (lockRatio.checked && wInput.value) { updating = true; hInput.value = Math.round(parseInt(wInput.value) / aspect); updating = false; }
      updateTarget();
    });
    hInput.addEventListener('input', function () {
      if (updating) return;
      if (lockRatio.checked && hInput.value) { updating = true; wInput.value = Math.round(parseInt(hInput.value) * aspect); updating = false; }
      updateTarget();
    });

    // Sharpen convolution kernel
    function applySharpen(ctx, w, h, strength) {
      if (strength <= 0) return;
      var imageData = ctx.getImageData(0, 0, w, h);
      var src = imageData.data;
      var out = new Uint8ClampedArray(src.length);
      // Kernel: [-s, -s, -s, -s, 1+8s, -s, -s, -s, -s] = unsharp mask
      var s = [0, 0.15, 0.35, 0.6][strength] || 0.15;
      var center = 1 + 8 * s;
      for (var y = 1; y < h - 1; y++) {
        for (var x = 1; x < w - 1; x++) {
          for (var c = 0; c < 3; c++) {
            var idx = (y * w + x) * 4 + c;
            var val = src[idx] * center
              - s * src[((y - 1) * w + x - 1) * 4 + c]
              - s * src[((y - 1) * w + x) * 4 + c]
              - s * src[((y - 1) * w + x + 1) * 4 + c]
              - s * src[(y * w + x - 1) * 4 + c]
              - s * src[(y * w + x + 1) * 4 + c]
              - s * src[((y + 1) * w + x - 1) * 4 + c]
              - s * src[((y + 1) * w + x) * 4 + c]
              - s * src[((y + 1) * w + x + 1) * 4 + c];
            out[idx] = val;
          }
          out[(y * w + x) * 4 + 3] = src[(y * w + x) * 4 + 3]; // alpha
        }
      }
      // Copy edges from source
      for (var i = 0; i < w * 4; i++) { out[i] = src[i]; out[(h - 1) * w * 4 + i] = src[(h - 1) * w * 4 + i]; }
      for (var y2 = 0; y2 < h; y2++) { var b = y2 * w * 4; out[b] = src[b]; out[b+1] = src[b+1]; out[b+2] = src[b+2]; out[b+3] = src[b+3]; var e = (y2 * w + w - 1) * 4; out[e] = src[e]; out[e+1] = src[e+1]; out[e+2] = src[e+2]; out[e+3] = src[e+3]; }
      imageData.data.set(out);
      ctx.putImageData(imageData, 0, 0);
    }

    // Multi-step upscale: upscale 2x at a time for better quality
    function multiStepUpscale(img, targetW, targetH) {
      var curW = img.naturalWidth || img.width;
      var curH = img.naturalHeight || img.height;
      var curCanvas = document.createElement('canvas');
      curCanvas.width = curW; curCanvas.height = curH;
      curCanvas.getContext('2d').drawImage(img, 0, 0);

      // Step up by 2x until we reach or exceed target
      while (curW * 2 <= targetW && curH * 2 <= targetH) {
        var nextW = curW * 2, nextH = curH * 2;
        var nextCanvas = document.createElement('canvas');
        nextCanvas.width = nextW; nextCanvas.height = nextH;
        var ctx = nextCanvas.getContext('2d');
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';
        ctx.drawImage(curCanvas, 0, 0, nextW, nextH);
        curCanvas = nextCanvas;
        curW = nextW; curH = nextH;
      }

      // Final step to exact target
      if (curW !== targetW || curH !== targetH) {
        var finalCanvas = document.createElement('canvas');
        finalCanvas.width = targetW; finalCanvas.height = targetH;
        var fctx = finalCanvas.getContext('2d');
        fctx.imageSmoothingEnabled = true;
        fctx.imageSmoothingQuality = 'high';
        fctx.drawImage(curCanvas, 0, 0, targetW, targetH);
        return finalCanvas;
      }
      return curCanvas;
    }

    imgTool('upscale-image',
      async function (file) {
        opts.style.display = 'block';
        var du = await EditIt.readFileAsDataURL(file);
        loadedImg = await EditIt.loadImage(du);
        origW = loadedImg.naturalWidth;
        origH = loadedImg.naturalHeight;
        aspect = origW / origH;
        document.getElementById('upscale-current').textContent = origW + ' × ' + origH + ' px';
        wInput.value = origW * 2;
        hInput.value = origH * 2;
        scaleVal = 2;
        document.querySelectorAll('.upscale-btn').forEach(function (b) { b.classList.toggle('active', b.dataset.scale === '2'); });
        updateTarget();
      },
      async function (file, out) {
        var tw = parseInt(wInput.value) || origW * 2;
        var th = parseInt(hInput.value) || origH * 2;
        if (tw <= origW && th <= origH) {
          EditIt.showToast('Target size must be larger than original', 'error');
          return;
        }
        if (tw * th > 100000000) {
          EditIt.showToast('Target resolution too large (max ~100MP)', 'error');
          return;
        }

        EditIt.showProgress('Upscaling ' + origW + '×' + origH + ' → ' + tw + '×' + th + '...', 20);

        // Multi-step upscale
        var canvas = multiStepUpscale(loadedImg, tw, th);
        EditIt.showProgress('Applying sharpening...', 70);

        // Apply sharpening
        var sharpStrength = parseInt(sharpSlider.value);
        if (sharpStrength > 0) {
          applySharpen(canvas.getContext('2d'), tw, th, sharpStrength);
          // Second pass for stronger effect
          if (sharpStrength >= 2) {
            applySharpen(canvas.getContext('2d'), tw, th, Math.max(1, sharpStrength - 1));
          }
        }

        EditIt.showProgress('Encoding...', 90);
        var blob = await new Promise(function (r) { canvas.toBlob(r, 'image/png'); });
        EditIt.hideProgress();

        var scaleText = (tw / origW).toFixed(1) + '×';
        var beforeUrl = await EditIt.readFileAsDataURL(file);
        var afterUrl = URL.createObjectURL(blob);
        var compareHTML = EditIt.previewCompareHTML(
          beforeUrl, afterUrl,
          origW + '×' + origH + ' (original)',
          tw + '×' + th + ' (' + scaleText + ' upscaled)'
        );

        dlCard(out, 'Image Upscaled!', origW + '×' + origH + ' → ' + tw + '×' + th + ' (' + scaleText + ') • ' + EditIt.formatFileSize(blob.size), blob, file.name.replace(/\.[^.]+$/, '') + '_' + tw + 'x' + th + '.png', compareHTML);
        EditIt.showToast('Image upscaled to ' + tw + '×' + th + '!', 'success');
      }
    );
  })();

  // IMAGE TO BASE64
  imgTool('image-to-base64', null, async function (file, out) {
    var du = await EditIt.readFileAsDataURL(file);
    out.innerHTML = '<div class="output-card"><h3>\u2713 Encoded!</h3><p>' + EditIt.formatFileSize(du.length) + ' characters</p><div style="display:flex;gap:8px;justify-content:center;margin:12px 0"><button class="btn btn-success" id="i2b-copy">Copy to Clipboard</button><button class="btn btn-outline" id="i2b-dl">Download .txt</button></div></div><div class="ocr-text-output" style="word-break:break-all">' + du.substring(0, 3000) + (du.length > 3000 ? '...' : '') + '</div>';
    document.getElementById('i2b-copy').addEventListener('click', function () { navigator.clipboard.writeText(du).then(function () { EditIt.showToast('Copied!', 'success'); }); });
    document.getElementById('i2b-dl').addEventListener('click', function () { EditIt.downloadBlob(new Blob([du], { type: 'text/plain' }), file.name + '_base64.txt'); });
  });

  // QR CODE GENERATOR
  (function () {
    document.getElementById('qr-generate-action').addEventListener('click', async function () {
      var text = document.getElementById('qr-gen-input').value.trim();
      if (!text) { EditIt.showToast('Enter text or URL', 'error'); return; }
      var size = parseInt(document.getElementById('qr-gen-size').value);
      var color = document.getElementById('qr-gen-color').value;
      var out = document.getElementById('qr-generate-output');
      try {
        if (typeof QRCode === 'undefined') { EditIt.showToast('QR Code library failed to load. Please check your internet connection and reload.', 'error'); return; }
        var dataUrl = await QRCode.toDataURL(text, { width: size, margin: 2, color: { dark: color, light: '#ffffff' } });
        var img = await EditIt.loadImage(dataUrl);
        var c = document.createElement('canvas'); c.width = img.naturalWidth; c.height = img.naturalHeight;
        c.getContext('2d').drawImage(img, 0, 0);
        var blob = await new Promise(function (r) { c.toBlob(r, 'image/png'); });
        out.innerHTML = '<div class="output-card"><h3>\u2713 QR Code Generated!</h3><div style="margin:16px 0"><img src="' + dataUrl + '" style="max-width:300px;border:1px solid var(--border);border-radius:8px"></div><button class="btn btn-success" id="qr-dl">Download PNG</button></div>';
        document.getElementById('qr-dl').addEventListener('click', function () { EditIt.downloadBlob(blob, 'qrcode.png'); });
      } catch (err) { EditIt.showToast('Error: ' + err.message, 'error'); }
    });
  })();

  // QR CODE READER
  imgTool('qr-reader', null, async function (file, out) {
    var du = await EditIt.readFileAsDataURL(file); var img = await EditIt.loadImage(du);
    var c = document.createElement('canvas'); c.width = img.naturalWidth; c.height = img.naturalHeight;
    var ctx = c.getContext('2d'); ctx.drawImage(img, 0, 0);
    var imgData = ctx.getImageData(0, 0, c.width, c.height);
    var code = jsQR(imgData.data, c.width, c.height);
    if (code) {
      var isUrl = code.data.match(/^https?:\/\//);
      out.innerHTML = '<div class="output-card"><h3>\u2713 QR Code Found!</h3><p>Decoded content:</p><div class="ocr-text-output" style="text-align:left">' + code.data.replace(/</g, '&lt;') + '</div>' + (isUrl ? '<a href="' + code.data + '" target="_blank" class="btn btn-success" style="margin-top:12px">Open Link</a>' : '') + '<button class="btn btn-outline" id="qr-copy" style="margin-top:8px">Copy Text</button></div>';
      document.getElementById('qr-copy').addEventListener('click', function () { navigator.clipboard.writeText(code.data).then(function () { EditIt.showToast('Copied!', 'success'); }); });
    } else { out.innerHTML = '<div class="output-card" style="border-color:var(--danger);background:rgba(239,68,68,0.08)"><h3 style="color:var(--danger)">No QR Code Found</h3><p>Could not detect a QR code in this image.</p></div>'; }
  });

  // SVG TO PNG
  (function () {
    imgTool('svg-to-png', function () { var o = document.getElementById('svg-to-png-options'); if (o) o.style.display = 'block'; },
      async function (file, out) {
        var text = await file.text(); var scale = parseInt(document.getElementById('svg-scale').value) || 2;
        var blob = new Blob([text], { type: 'image/svg+xml' }); var url = URL.createObjectURL(blob);
        var img = await EditIt.loadImage(url);
        var c = document.createElement('canvas'); c.width = img.naturalWidth * scale; c.height = img.naturalHeight * scale;
        c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
        var pngBlob = await new Promise(function (r) { c.toBlob(r, 'image/png'); });
        dlCard(out, 'SVG Converted!', c.width + '\u00d7' + c.height + ' \u2022 ' + EditIt.formatFileSize(pngBlob.size), pngBlob, file.name.replace(/\.svg$/i, '') + '.png', EditIt.outputPreviewHTML(URL.createObjectURL(pngBlob), scale + 'x scale'));
        EditIt.showToast('SVG converted to PNG!', 'success');
      });
  })();

  // CIRCLE/ROUND CROP
  (function () {
    var shape = 'circle';
    document.querySelectorAll('.rc-shape').forEach(function (b) { b.addEventListener('click', function () { document.querySelectorAll('.rc-shape').forEach(function (x) { x.classList.remove('active'); }); b.classList.add('active'); shape = b.dataset.shape; }); });
    imgTool('round-crop', function () { document.getElementById('round-crop-options').style.display = 'block'; },
      async function (file, out) {
        var du = await EditIt.readFileAsDataURL(file); var img = await EditIt.loadImage(du);
        var size = Math.min(img.naturalWidth, img.naturalHeight);
        var c = document.createElement('canvas'); c.width = size; c.height = size; var ctx = c.getContext('2d');
        ctx.beginPath();
        if (shape === 'circle') { ctx.arc(size / 2, size / 2, size / 2, 0, Math.PI * 2); }
        else { var r = size * 0.1; ctx.moveTo(r, 0); ctx.lineTo(size - r, 0); ctx.quadraticCurveTo(size, 0, size, r); ctx.lineTo(size, size - r); ctx.quadraticCurveTo(size, size, size - r, size); ctx.lineTo(r, size); ctx.quadraticCurveTo(0, size, 0, size - r); ctx.lineTo(0, r); ctx.quadraticCurveTo(0, 0, r, 0); }
        ctx.closePath(); ctx.clip();
        var ox = (img.naturalWidth - size) / 2, oy = (img.naturalHeight - size) / 2;
        ctx.drawImage(img, ox, oy, size, size, 0, 0, size, size);
        var blob = await new Promise(function (r) { c.toBlob(r, 'image/png'); });
        dlCard(out, 'Cropped!', size + '\u00d7' + size + ' PNG', blob, file.name.replace(/\.[^.]+$/, '') + '_round.png', EditIt.previewCompareHTML(du, URL.createObjectURL(blob), 'Original', shape === 'circle' ? 'Circle' : 'Rounded'));
        EditIt.showToast('Circle crop done!', 'success');
      });
  })();

  // COLOR PALETTE EXTRACTOR
  imgTool('color-palette', null, async function (file, out) {
    var du = await EditIt.readFileAsDataURL(file); var img = await EditIt.loadImage(du);
    var c = document.createElement('canvas'); var s = 100; c.width = s; c.height = s;
    c.getContext('2d').drawImage(img, 0, 0, s, s);
    var data = c.getContext('2d').getImageData(0, 0, s, s).data;
    var colors = {}; for (var i = 0; i < data.length; i += 16) {
      var r = Math.round(data[i] / 32) * 32, g = Math.round(data[i + 1] / 32) * 32, b = Math.round(data[i + 2] / 32) * 32;
      var key = r + ',' + g + ',' + b; colors[key] = (colors[key] || 0) + 1;
    }
    var sorted = Object.entries(colors).sort(function (a, b) { return b[1] - a[1]; }).slice(0, 8);
    var html = '<div class="output-card"><h3>\u2713 Colors Extracted!</h3><p>Top ' + sorted.length + ' dominant colors</p><div class="palette-grid">';
    sorted.forEach(function (entry) {
      var rgb = entry[0].split(','); var hex = '#' + rgb.map(function (v) { return ('0' + parseInt(v).toString(16)).slice(-2); }).join('');
      html += '<div class="palette-swatch"><div class="swatch-color" style="background:' + hex + '" title="Click to copy" data-hex="' + hex + '"></div><div class="swatch-label">' + hex + '</div></div>';
    });
    html += '</div></div>';
    out.innerHTML = html;
    out.querySelectorAll('.swatch-color').forEach(function (sw) { sw.addEventListener('click', function () { navigator.clipboard.writeText(sw.dataset.hex).then(function () { EditIt.showToast('Copied ' + sw.dataset.hex, 'success'); }); }); });
  });

  // =============================================
  // TEXT & DATA TOOLS
  // =============================================

  // TEXT DIFF
  document.getElementById('text-diff-action').addEventListener('click', function () {
    var a = document.getElementById('diff-a').value.split('\n');
    var b = document.getElementById('diff-b').value.split('\n');
    var out = document.getElementById('text-diff-output');
    var html = '<div style="background:var(--bg-card);border:1px solid var(--border);border-radius:var(--radius-sm);padding:8px;max-height:400px;overflow:auto">';
    var max = Math.max(a.length, b.length);
    for (var i = 0; i < max; i++) {
      var la = a[i] || '', lb = b[i] || '';
      if (la === lb) html += '<div class="diff-line diff-same">' + (la || '&nbsp;').replace(/</g, '&lt;') + '</div>';
      else {
        if (la) html += '<div class="diff-line diff-remove">- ' + la.replace(/</g, '&lt;') + '</div>';
        if (lb) html += '<div class="diff-line diff-add">+ ' + lb.replace(/</g, '&lt;') + '</div>';
      }
    }
    html += '</div>';
    out.innerHTML = html;
  });

  // WORD COUNTER
  document.getElementById('wc-input').addEventListener('input', function () {
    var t = this.value;
    var words = t.trim() ? t.trim().split(/\s+/).length : 0;
    var chars = t.length;
    var sentences = t.trim() ? (t.match(/[.!?]+/g) || []).length || (t.trim() ? 1 : 0) : 0;
    var paras = t.trim() ? t.split(/\n\s*\n/).filter(Boolean).length : 0;
    var cards = document.querySelectorAll('#wc-output .stat-num');
    if (cards.length >= 4) { cards[0].textContent = words; cards[1].textContent = chars; cards[2].textContent = sentences; cards[3].textContent = paras; }
  });

  // JSON FORMATTER
  document.getElementById('jf-format').addEventListener('click', function () {
    try { var j = JSON.parse(document.getElementById('jf-input').value); document.getElementById('jf-input').value = JSON.stringify(j, null, 2); document.getElementById('json-formatter-output').innerHTML = '<p style="color:var(--success);font-weight:600">\u2713 Valid JSON — formatted!</p>'; } catch (e) { document.getElementById('json-formatter-output').innerHTML = '<p style="color:var(--danger);font-weight:600">\u2717 ' + e.message + '</p>'; }
  });
  document.getElementById('jf-minify').addEventListener('click', function () {
    try { var j = JSON.parse(document.getElementById('jf-input').value); document.getElementById('jf-input').value = JSON.stringify(j); document.getElementById('json-formatter-output').innerHTML = '<p style="color:var(--success);font-weight:600">\u2713 Minified!</p>'; } catch (e) { document.getElementById('json-formatter-output').innerHTML = '<p style="color:var(--danger);font-weight:600">\u2717 ' + e.message + '</p>'; }
  });
  document.getElementById('jf-validate').addEventListener('click', function () {
    try { JSON.parse(document.getElementById('jf-input').value); document.getElementById('json-formatter-output').innerHTML = '<p style="color:var(--success);font-weight:600">\u2713 Valid JSON!</p>'; } catch (e) { document.getElementById('json-formatter-output').innerHTML = '<p style="color:var(--danger);font-weight:600">\u2717 Invalid: ' + e.message + '</p>'; }
  });

  // CSV <-> JSON
  (function () {
    var dir = 'csv2json';
    document.getElementById('csv-to-json-btn').addEventListener('click', function () { dir = 'csv2json'; this.classList.add('active'); document.getElementById('json-to-csv-btn').classList.remove('active'); });
    document.getElementById('json-to-csv-btn').addEventListener('click', function () { dir = 'json2csv'; this.classList.add('active'); document.getElementById('csv-to-json-btn').classList.remove('active'); });
    document.getElementById('csv-json-action').addEventListener('click', function () {
      var input = document.getElementById('csvjson-input').value; var out = document.getElementById('csv-json-output');
      try {
        if (dir === 'csv2json') {
          var lines = input.trim().split('\n'); var headers = lines[0].split(',').map(function (h) { return h.trim().replace(/^"|"$/g, ''); });
          var json = lines.slice(1).map(function (line) { var vals = line.split(','); var obj = {}; headers.forEach(function (h, i) { obj[h] = (vals[i] || '').trim().replace(/^"|"$/g, ''); }); return obj; });
          out.innerHTML = '<div class="ocr-text-output">' + JSON.stringify(json, null, 2).replace(/</g, '&lt;') + '</div><button class="btn btn-success" style="margin-top:8px" id="csvjson-copy">Copy</button>';
        } else {
          var data = JSON.parse(input); if (!Array.isArray(data)) data = [data];
          var keys = Object.keys(data[0] || {});
          var csv = keys.join(',') + '\n' + data.map(function (row) { return keys.map(function (k) { return '"' + String(row[k] || '').replace(/"/g, '""') + '"'; }).join(','); }).join('\n');
          out.innerHTML = '<div class="ocr-text-output">' + csv.replace(/</g, '&lt;') + '</div><button class="btn btn-success" style="margin-top:8px" id="csvjson-copy">Copy</button>';
        }
        document.getElementById('csvjson-copy').addEventListener('click', function () {
          var text = out.querySelector('.ocr-text-output').textContent;
          navigator.clipboard.writeText(text).then(function () { EditIt.showToast('Copied!', 'success'); });
        });
      } catch (e) { out.innerHTML = '<p style="color:var(--danger)">\u2717 Error: ' + e.message + '</p>'; }
    });
  })();

  // MARKDOWN EDITOR
  (function () {
    var input = document.getElementById('md-editor-input');
    var preview = document.getElementById('md-editor-preview');
    function update() { if (typeof marked !== 'undefined') preview.innerHTML = marked.parse(input.value || ''); }
    input.addEventListener('input', update);
    setTimeout(update, 500);
  })();

  // HASH GENERATOR
  (function () {
    var hashInput = document.getElementById('hash-input');
    var hashFileInput = document.getElementById('hash-file-input');
    var out = document.getElementById('hash-generator-output');
    async function computeHash(data, algo) {
      var buf = await crypto.subtle.digest(algo, data);
      return Array.from(new Uint8Array(buf)).map(function (b) { return b.toString(16).padStart(2, '0'); }).join('');
    }
    document.getElementById('hash-generator-action').addEventListener('click', async function () {
      var data;
      if (hashFileInput.files.length) { data = await hashFileInput.files[0].arrayBuffer(); }
      else if (hashInput.value) { data = new TextEncoder().encode(hashInput.value); }
      else { EditIt.showToast('Enter text or choose a file', 'error'); return; }
      var sha256 = await computeHash(data, 'SHA-256');
      var sha1 = await computeHash(data, 'SHA-1');
      out.innerHTML = '<div class="output-card"><h3>\u2713 Hashes Generated</h3><div style="text-align:left;margin-top:12px"><p><strong>SHA-256:</strong></p><div class="ocr-text-output" style="margin:4px 0 12px;word-break:break-all">' + sha256 + '</div><p><strong>SHA-1:</strong></p><div class="ocr-text-output" style="margin:4px 0;word-break:break-all">' + sha1 + '</div></div></div>';
    });
  })();

  // BASE64 ENCODE/DECODE
  document.getElementById('b64-encode').addEventListener('click', function () { try { document.getElementById('b64-output').value = btoa(unescape(encodeURIComponent(document.getElementById('b64-input').value))); } catch (e) { EditIt.showToast('Error: ' + e.message, 'error'); } });
  document.getElementById('b64-decode').addEventListener('click', function () { try { document.getElementById('b64-output').value = decodeURIComponent(escape(atob(document.getElementById('b64-input').value.trim()))); } catch (e) { EditIt.showToast('Invalid Base64', 'error'); } });

  // URL ENCODE/DECODE
  document.getElementById('url-enc-encode').addEventListener('click', function () { document.getElementById('url-enc-output').value = encodeURIComponent(document.getElementById('url-enc-input').value); });
  document.getElementById('url-enc-decode').addEventListener('click', function () { try { document.getElementById('url-enc-output').value = decodeURIComponent(document.getElementById('url-enc-input').value); } catch (e) { EditIt.showToast('Invalid encoded URL', 'error'); } });

  // LOREM IPSUM
  (function () {
    var LOREM = ['Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat.', 'Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur. Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt mollit anim id est laborum.', 'Curabitur pretium tincidunt lacus. Nulla gravida orci a odio. Nullam varius, turpis et commodo pharetra, est eros bibendum elit, nec luctus magna felis sollicitudin mauris.', 'Praesent dapibus, neque id cursus faucibus, tortor neque egestas augue, eu vulputate magna eros eu erat. Aliquam erat volutpat. Nam dui mi, tincidunt quis, accumsan porttitor, facilisis luctus, metus.', 'Pellentesque habitant morbi tristique senectus et netus et malesuada fames ac turpis egestas. Vestibulum tortor quam, feugiat vitae, ultricies eget, tempor sit amet, ante.'];
    document.getElementById('lorem-ipsum-action').addEventListener('click', function () {
      var count = parseInt(document.getElementById('lorem-count').value) || 3;
      var type = document.getElementById('lorem-type').value;
      var result = '';
      for (var i = 0; i < count; i++) result += LOREM[i % LOREM.length] + (type === 'paragraphs' ? '\n\n' : ' ');
      if (type === 'words') { result = result.split(' ').slice(0, count).join(' ') + '.'; }
      else if (type === 'sentences') { result = result.split('. ').slice(0, count).join('. ') + '.'; }
      document.getElementById('lorem-ipsum-output').innerHTML = '<div class="ocr-text-output">' + result.trim() + '</div><button class="btn btn-success" style="margin-top:8px" id="lorem-copy">Copy</button>';
      document.getElementById('lorem-copy').addEventListener('click', function () { navigator.clipboard.writeText(result.trim()).then(function () { EditIt.showToast('Copied!', 'success'); }); });
    });
  })();

  // REGEX TESTER
  (function () {
    function test() {
      var pattern = document.getElementById('regex-pattern').value;
      var flags = document.getElementById('regex-flags').value;
      var text = document.getElementById('regex-test').value;
      var out = document.getElementById('regex-output');
      if (!pattern || !text) { out.innerHTML = '<span style="color:var(--text-muted)">Enter pattern and text...</span>'; return; }
      try {
        var re = new RegExp(pattern, flags);
        var matches = []; var m; var count = 0;
        if (flags.includes('g')) { while ((m = re.exec(text)) !== null && count < 100) { matches.push({ text: m[0], index: m.index }); count++; } }
        else { m = re.exec(text); if (m) matches.push({ text: m[0], index: m.index }); }
        if (matches.length === 0) { out.innerHTML = '<span style="color:var(--text-muted)">No matches found</span>'; }
        else {
          out.innerHTML = '<strong>' + matches.length + ' match' + (matches.length > 1 ? 'es' : '') + ':</strong><br>';
          matches.forEach(function (m, i) { out.innerHTML += '<span style="color:var(--primary);font-weight:600">[' + i + ']</span> "' + m.text.replace(/</g, '&lt;') + '" at index ' + m.index + '<br>'; });
        }
      } catch (e) { out.innerHTML = '<span style="color:var(--danger)">' + e.message + '</span>'; }
    }
    document.getElementById('regex-pattern').addEventListener('input', test);
    document.getElementById('regex-flags').addEventListener('input', test);
    document.getElementById('regex-test').addEventListener('input', test);
  })();

  // COLOR CONVERTER
  (function () {
    var picker = document.getElementById('cc-picker');
    var hexIn = document.getElementById('cc-hex');
    var rgbIn = document.getElementById('cc-rgb');
    var hslIn = document.getElementById('cc-hsl');
    function hexToRgb(hex) { hex = hex.replace('#', ''); var r = parseInt(hex.substring(0, 2), 16), g = parseInt(hex.substring(2, 4), 16), b = parseInt(hex.substring(4, 6), 16); return [r, g, b]; }
    function rgbToHsl(r, g, b) { r /= 255; g /= 255; b /= 255; var max = Math.max(r, g, b), min = Math.min(r, g, b); var h, s, l = (max + min) / 2; if (max === min) { h = s = 0; } else { var d = max - min; s = l > 0.5 ? d / (2 - max - min) : d / (max + min); switch (max) { case r: h = ((g - b) / d + (g < b ? 6 : 0)) / 6; break; case g: h = ((b - r) / d + 2) / 6; break; case b: h = ((r - g) / d + 4) / 6; break; } } return [Math.round(h * 360), Math.round(s * 100), Math.round(l * 100)]; }
    function update(hex) {
      hex = hex.charAt(0) === '#' ? hex : '#' + hex;
      if (!/^#[0-9a-fA-F]{6}$/.test(hex)) return;
      picker.value = hex; hexIn.value = hex;
      var c = hexToRgb(hex); rgbIn.value = 'rgb(' + c[0] + ', ' + c[1] + ', ' + c[2] + ')';
      var hsl = rgbToHsl(c[0], c[1], c[2]); hslIn.value = 'hsl(' + hsl[0] + ', ' + hsl[1] + '%, ' + hsl[2] + '%)';
    }
    picker.addEventListener('input', function () { update(picker.value); });
    hexIn.addEventListener('input', function () { update(hexIn.value); });
    rgbIn.addEventListener('input', function () {
      var m = rgbIn.value.match(/(\d+)/g); if (m && m.length >= 3) { var hex = '#' + m.slice(0, 3).map(function (v) { return ('0' + parseInt(v).toString(16)).slice(-2); }).join(''); update(hex); }
    });
    update('#6366f1');
  })();

  // CODE TO PDF
  (function () {
    var actionBtn = document.getElementById('code-to-pdf-action');
    var outputEl = document.getElementById('code-to-pdf-output');
    var textInput = document.getElementById('code-text-input');
    var codeContent = '';
    document.addEventListener('files-added', async function (e) {
      if (e.detail.toolId !== 'code-to-pdf') return;
      var f = e.detail.files[0]; if (f) { codeContent = await f.text(); textInput.value = codeContent; }
    });
    actionBtn.addEventListener('click', async function () {
      var text = codeContent || textInput.value; if (!text.trim()) { EditIt.showToast('Enter code content', 'error'); return; }
      EditIt.setButtonLoading(actionBtn, true);
      try {
        var pdf = await PDFDoc.create(); var font = await pdf.embedFont(SF.Courier);
        var sz = 8; var lh = 10; var m = 40; var pw = 595.28; var ph = 841.89;
        var lines = text.split('\n'); var page = pdf.addPage([pw, ph]); var y = ph - m; var ln = 1;
        lines.forEach(function (line) {
          if (y < m + lh) { page = pdf.addPage([pw, ph]); y = ph - m; }
          var numStr = ('    ' + ln).slice(-4) + ' | ';
          page.drawText(numStr + line.substring(0, 110), { x: m, y: y, size: sz, font: font, color: rgb(0.15, 0.15, 0.15) });
          y -= lh; ln++;
        });
        var saved = await pdf.save(); var blob = new Blob([saved], { type: 'application/pdf' });
        dlCard(outputEl, 'Code to PDF!', pdf.getPageCount() + ' pages \u2022 ' + lines.length + ' lines', blob, 'code.pdf');
        EditIt.showToast('Code converted to PDF!', 'success');
      } catch (err) { EditIt.showToast('Error: ' + err.message, 'error'); }
      EditIt.setButtonLoading(actionBtn, false);
    });
  })();

  // =============================================
  // UTILITIES
  // =============================================

  // =============================================
  // ARCHIVE TOOL — ZIP, TAR, GZ, TAR.GZ
  // =============================================
  (function () {
    var actionBtn = document.getElementById('zip-tool-action');
    var outputEl = document.getElementById('zip-tool-output');
    var fileListEl = document.getElementById('zip-tool-files');
    var optsEl = document.getElementById('zip-tool-options');
    var files = [];

    // ---- TAR helpers ----
    function tarParse(buffer) {
      var entries = [], offset = 0, u8 = new Uint8Array(buffer);
      while (offset < u8.length - 512) {
        var header = u8.subarray(offset, offset + 512);
        if (header[0] === 0) break; // empty block = end
        var name = readStr(header, 0, 100).replace(/\0/g, '');
        var sizeStr = readStr(header, 124, 12).replace(/\0/g, '').trim();
        var size = parseInt(sizeStr, 8) || 0;
        var prefix = readStr(header, 345, 155).replace(/\0/g, '');
        var fullName = prefix ? prefix + '/' + name : name;
        var type = header[156]; // 48='0' file, 53='5' dir
        offset += 512;
        if (size > 0 && type !== 53) { // 53 = '5' = directory
          entries.push({ name: fullName, data: u8.slice(offset, offset + size), size: size });
        }
        offset += Math.ceil(size / 512) * 512;
      }
      return entries;
    }

    function readStr(buf, off, len) {
      var s = ''; for (var i = 0; i < len && buf[off + i] !== 0; i++) s += String.fromCharCode(buf[off + i]);
      return s;
    }

    function tarCreate(fileEntries) {
      // fileEntries = [{ name, data (Uint8Array) }]
      var parts = [];
      fileEntries.forEach(function (f) {
        var header = new Uint8Array(512);
        writeStr(header, 0, f.name, 100);
        writeStr(header, 100, '0000644', 8); // mode
        writeStr(header, 108, '0001000', 8); // uid
        writeStr(header, 116, '0001000', 8); // gid
        writeOctal(header, 124, f.data.length, 12); // size
        writeOctal(header, 136, Math.floor(Date.now() / 1000), 12); // mtime
        header[156] = 48; // '0' = regular file
        writeStr(header, 257, 'ustar', 6); // magic
        writeStr(header, 263, '00', 2); // version
        // Compute checksum
        writeStr(header, 148, '        ', 8); // blank checksum field
        var chksum = 0;
        for (var i = 0; i < 512; i++) chksum += header[i];
        writeOctal(header, 148, chksum, 7);
        header[155] = 32; // space after checksum
        parts.push(header);
        parts.push(f.data);
        // Pad to 512 boundary
        var pad = 512 - (f.data.length % 512);
        if (pad < 512) parts.push(new Uint8Array(pad));
      });
      // Two empty 512 blocks at end
      parts.push(new Uint8Array(1024));
      var total = parts.reduce(function (s, p) { return s + p.length; }, 0);
      var result = new Uint8Array(total);
      var off = 0;
      parts.forEach(function (p) { result.set(p, off); off += p.length; });
      return result;
    }

    function writeStr(buf, off, str, len) {
      for (var i = 0; i < Math.min(str.length, len); i++) buf[off + i] = str.charCodeAt(i);
    }

    function writeOctal(buf, off, val, len) {
      var s = val.toString(8);
      while (s.length < len - 1) s = '0' + s;
      writeStr(buf, off, s, len - 1);
    }

    // ---- GZIP helpers (using pako via JSZip internals or DecompressionStream) ----
    async function gzipDecompress(compressedBuf) {
      // Try native DecompressionStream first (modern browsers)
      if (typeof DecompressionStream !== 'undefined') {
        var ds = new DecompressionStream('gzip');
        var reader = new Response(new Blob([compressedBuf]).stream().pipeThrough(ds)).arrayBuffer();
        return new Uint8Array(await reader);
      }
      // Fallback: use JSZip's internal pako
      if (window.pako) return window.pako.inflate(new Uint8Array(compressedBuf));
      throw new Error('GZIP decompression not supported in this browser');
    }

    async function gzipCompress(data) {
      if (typeof CompressionStream !== 'undefined') {
        var cs = new CompressionStream('gzip');
        var reader = new Response(new Blob([data]).stream().pipeThrough(cs)).arrayBuffer();
        return new Uint8Array(await reader);
      }
      if (window.pako) return window.pako.gzip(new Uint8Array(data));
      throw new Error('GZIP compression not supported in this browser');
    }

    // ---- Detect archive type ----
    function detectArchiveType(file, buf) {
      var name = file.name.toLowerCase();
      var u8 = new Uint8Array(buf.slice(0, 4));
      // GZIP magic: 1f 8b
      if (u8[0] === 0x1f && u8[1] === 0x8b) {
        if (name.match(/\.tar\.gz$|\.tgz$/)) return 'tar.gz';
        return 'gz';
      }
      // ZIP magic: PK (50 4b)
      if (u8[0] === 0x50 && u8[1] === 0x4b) return 'zip';
      // TAR: check for 'ustar' at offset 257
      if (buf.byteLength > 262) {
        var magic = readStr(new Uint8Array(buf), 257, 5);
        if (magic === 'ustar') return 'tar';
      }
      // Fallback by extension
      if (name.endsWith('.tar')) return 'tar';
      if (name.endsWith('.gz')) return 'gz';
      if (name.endsWith('.tgz')) return 'tar.gz';
      if (name.endsWith('.zip')) return 'zip';
      return null;
    }

    // ---- Render extracted entries ----
    function renderExtracted(entries, archiveType, fileName) {
      var html = '<div class="output-card"><h3>\u2713 ' + archiveType.toUpperCase() + ' Extracted!</h3><p>' + entries.length + ' file' + (entries.length !== 1 ? 's' : '') + ' found</p>';
      if (entries.length > 1) html += '<button class="btn btn-success" id="archive-dl-all">Download All (ZIP)</button>';
      html += '</div><div class="file-list">';
      entries.forEach(function (entry, i) {
        var ext = (entry.name.split('.').pop() || 'file').toUpperCase();
        html += '<div class="file-item"><div class="file-item-icon">' + ext.substring(0, 4) + '</div><div class="file-item-info"><div class="file-item-name">' + entry.name + '</div><div class="file-item-meta">' + EditIt.formatFileSize(entry.size || entry.data.length) + '</div></div><button class="btn btn-sm btn-outline archive-dl-single" data-i="' + i + '">Download</button></div>';
      });
      html += '</div>';
      outputEl.innerHTML = html;
      outputEl.querySelectorAll('.archive-dl-single').forEach(function (b) {
        b.addEventListener('click', function () {
          var idx = parseInt(b.dataset.i);
          var e = entries[idx];
          EditIt.downloadBlob(new Blob([e.data]), e.name.split('/').pop());
        });
      });
      var allBtn = document.getElementById('archive-dl-all');
      if (allBtn) {
        allBtn.addEventListener('click', async function () {
          var zip = new JSZip();
          entries.forEach(function (e) { zip.file(e.name, e.data); });
          var blob = await zip.generateAsync({ type: 'blob' });
          EditIt.downloadBlob(blob, fileName.replace(/\.[^.]+$/, '') + '_extracted.zip');
        });
      }
    }

    // ---- Main logic ----
    document.addEventListener('files-added', function (e) {
      if (e.detail.toolId !== 'zip-tool') return;
      files = files.concat(e.detail.files);
      fileListEl.innerHTML = '';
      files.forEach(function (f, i) {
        var item = EditIt.createFileItem(f, i);
        item.querySelector('.file-item-remove').addEventListener('click', function () {
          files.splice(i, 1);
          fileListEl.innerHTML = '';
          if (!files.length) { actionBtn.disabled = true; optsEl.style.display = 'none'; }
        });
        fileListEl.appendChild(item);
      });
      // Show format picker only when creating archive (multiple files or non-archive single file)
      var isArchive = files.length === 1 && detectArchiveType(files[0], new ArrayBuffer(0)) !== null;
      if (files.length > 1 || !isArchive) optsEl.style.display = 'block';
      else optsEl.style.display = 'none';
      actionBtn.disabled = false;
      outputEl.innerHTML = '';
    });

    actionBtn.addEventListener('click', async function () {
      if (!files.length) return;
      EditIt.setButtonLoading(actionBtn, true);
      try {
        // ===== EXTRACTION MODE =====
        if (files.length === 1) {
          var file = files[0];
          var buf = await EditIt.readFileAsArrayBuffer(file);
          var type = detectArchiveType(file, buf);

          if (type === 'zip') {
            var zip = await JSZip.loadAsync(buf);
            var entries = [];
            var paths = [];
            zip.forEach(function (path, entry) { if (!entry.dir) paths.push({ path: path, entry: entry }); });
            for (var i = 0; i < paths.length; i++) {
              EditIt.showProgress('Extracting ' + (i + 1) + '/' + paths.length, ((i + 1) / paths.length) * 90);
              var data = await paths[i].entry.async('uint8array');
              entries.push({ name: paths[i].path, data: data, size: data.length });
            }
            EditIt.hideProgress();
            renderExtracted(entries, 'ZIP', file.name);
            EditIt.showToast('ZIP extracted!', 'success');
            EditIt.setButtonLoading(actionBtn, false);
            return;
          }

          if (type === 'tar') {
            EditIt.showProgress('Parsing TAR...', 50);
            var entries = tarParse(buf);
            EditIt.hideProgress();
            renderExtracted(entries, 'TAR', file.name);
            EditIt.showToast('TAR extracted!', 'success');
            EditIt.setButtonLoading(actionBtn, false);
            return;
          }

          if (type === 'tar.gz') {
            EditIt.showProgress('Decompressing GZIP...', 30);
            var decompressed = await gzipDecompress(buf);
            EditIt.showProgress('Parsing TAR...', 70);
            var entries = tarParse(decompressed.buffer);
            EditIt.hideProgress();
            renderExtracted(entries, 'TAR.GZ', file.name);
            EditIt.showToast('TAR.GZ extracted!', 'success');
            EditIt.setButtonLoading(actionBtn, false);
            return;
          }

          if (type === 'gz') {
            EditIt.showProgress('Decompressing GZIP...', 50);
            var decompressed = await gzipDecompress(buf);
            EditIt.hideProgress();
            var outName = file.name.replace(/\.gz$/i, '') || 'decompressed';
            var blob = new Blob([decompressed]);
            dlCard(outputEl, 'GZIP Decompressed!', EditIt.formatFileSize(buf.byteLength) + ' \u2192 ' + EditIt.formatFileSize(decompressed.length), blob, outName);
            EditIt.showToast('GZIP decompressed!', 'success');
            EditIt.setButtonLoading(actionBtn, false);
            return;
          }
        }

        // ===== CREATION MODE =====
        var format = document.getElementById('zip-format').value;

        if (format === 'zip') {
          var zip = new JSZip();
          for (var j = 0; j < files.length; j++) {
            EditIt.showProgress('Adding ' + files[j].name, ((j + 1) / files.length) * 80);
            zip.file(files[j].name, files[j]);
          }
          EditIt.showProgress('Compressing...', 90);
          var zipBlob = await zip.generateAsync({ type: 'blob', compression: 'DEFLATE', compressionOptions: { level: 6 } });
          EditIt.hideProgress();
          dlCard(outputEl, 'ZIP Created!', files.length + ' files \u2022 ' + EditIt.formatFileSize(zipBlob.size), zipBlob, 'archive.zip');
        }

        else if (format === 'tar') {
          var fileEntries = [];
          for (var j = 0; j < files.length; j++) {
            EditIt.showProgress('Reading ' + files[j].name, ((j + 1) / files.length) * 80);
            var data = new Uint8Array(await EditIt.readFileAsArrayBuffer(files[j]));
            fileEntries.push({ name: files[j].name, data: data });
          }
          EditIt.showProgress('Creating TAR...', 90);
          var tarData = tarCreate(fileEntries);
          EditIt.hideProgress();
          var blob = new Blob([tarData], { type: 'application/x-tar' });
          dlCard(outputEl, 'TAR Created!', files.length + ' files \u2022 ' + EditIt.formatFileSize(blob.size), blob, 'archive.tar');
        }

        else if (format === 'tar.gz') {
          var fileEntries = [];
          for (var j = 0; j < files.length; j++) {
            EditIt.showProgress('Reading ' + files[j].name, ((j + 1) / files.length) * 60);
            var data = new Uint8Array(await EditIt.readFileAsArrayBuffer(files[j]));
            fileEntries.push({ name: files[j].name, data: data });
          }
          EditIt.showProgress('Creating TAR...', 70);
          var tarData = tarCreate(fileEntries);
          EditIt.showProgress('GZIP compressing...', 85);
          var gzData = await gzipCompress(tarData);
          EditIt.hideProgress();
          var blob = new Blob([gzData], { type: 'application/gzip' });
          dlCard(outputEl, 'TAR.GZ Created!', files.length + ' files \u2022 ' + EditIt.formatFileSize(blob.size), blob, 'archive.tar.gz');
        }

        else if (format === 'gz') {
          if (files.length > 1) { EditIt.showToast('GZIP only supports a single file. Use TAR.GZ for multiple files.', 'error'); EditIt.setButtonLoading(actionBtn, false); return; }
          EditIt.showProgress('GZIP compressing...', 50);
          var data = new Uint8Array(await EditIt.readFileAsArrayBuffer(files[0]));
          var gzData = await gzipCompress(data);
          EditIt.hideProgress();
          var blob = new Blob([gzData], { type: 'application/gzip' });
          dlCard(outputEl, 'GZIP Compressed!', EditIt.formatFileSize(data.length) + ' \u2192 ' + EditIt.formatFileSize(gzData.length), blob, files[0].name + '.gz');
        }

        EditIt.showToast('Done!', 'success');
      } catch (err) {
        EditIt.hideProgress();
        EditIt.showToast('Error: ' + err.message, 'error');
        console.error(err);
      }
      EditIt.setButtonLoading(actionBtn, false);
    });
  })();

  // FILE HASH CHECKER
  (function () {
    var actionBtn = document.getElementById('file-hash-action');
    var outputEl = document.getElementById('file-hash-output');
    var fileListEl = document.getElementById('file-hash-files');
    var file = null;
    document.addEventListener('files-added', function (e) {
      if (e.detail.toolId !== 'file-hash') return;
      file = e.detail.files[0]; if (!file) return;
      fileListEl.innerHTML = ''; var item = EditIt.createFileItem(file, 0); item.querySelector('.file-item-remove').addEventListener('click', function () { file = null; fileListEl.innerHTML = ''; actionBtn.disabled = true; }); fileListEl.appendChild(item); actionBtn.disabled = false;
    });
    actionBtn.addEventListener('click', async function () {
      if (!file) return; EditIt.setButtonLoading(actionBtn, true);
      try {
        var buf = await file.arrayBuffer();
        async function hash(algo) { var h = await crypto.subtle.digest(algo, buf); return Array.from(new Uint8Array(h)).map(function (b) { return b.toString(16).padStart(2, '0'); }).join(''); }
        var s256 = await hash('SHA-256'), s1 = await hash('SHA-1');
        outputEl.innerHTML = '<div class="output-card"><h3>\u2713 ' + file.name + '</h3><div style="text-align:left;margin-top:12px"><p><strong>SHA-256:</strong></p><div class="ocr-text-output" style="margin:4px 0 12px;word-break:break-all">' + s256 + '</div><p><strong>SHA-1:</strong></p><div class="ocr-text-output" style="margin:4px 0;word-break:break-all">' + s1 + '</div><p><strong>Size:</strong> ' + EditIt.formatFileSize(file.size) + '</p></div></div>';
      } catch (err) { EditIt.showToast('Error: ' + err.message, 'error'); }
      EditIt.setButtonLoading(actionBtn, false);
    });
  })();

  // AUDIO TRIMMER
  (function () {
    var actionBtn = document.getElementById('audio-trimmer-action');
    var outputEl = document.getElementById('audio-trimmer-output');
    var opts = document.getElementById('audio-trimmer-options');
    var player = document.getElementById('audio-player');
    var file = null, audioBuffer = null, audioCtx = null;
    document.addEventListener('files-added', async function (e) {
      if (e.detail.toolId !== 'audio-trimmer') return;
      file = e.detail.files.find(function (f) { return f.type.startsWith('audio/'); });
      if (!file) { EditIt.showToast('Select an audio file', 'error'); return; }
      var fl = document.getElementById('audio-trimmer-files'); fl.innerHTML = '';
      var item = EditIt.createFileItem(file, 0); item.querySelector('.file-item-remove').addEventListener('click', function () { file = null; fl.innerHTML = ''; opts.style.display = 'none'; actionBtn.disabled = true; });
      fl.appendChild(item);
      player.src = URL.createObjectURL(file);
      audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      audioBuffer = await audioCtx.decodeAudioData(await file.arrayBuffer());
      document.getElementById('audio-end').value = audioBuffer.duration.toFixed(1);
      opts.style.display = 'block'; actionBtn.disabled = false;
    });
    actionBtn.addEventListener('click', async function () {
      if (!audioBuffer) return; EditIt.setButtonLoading(actionBtn, true);
      try {
        var start = parseFloat(document.getElementById('audio-start').value) || 0;
        var end = parseFloat(document.getElementById('audio-end').value) || audioBuffer.duration;
        var sr = audioBuffer.sampleRate; var channels = audioBuffer.numberOfChannels;
        var startSample = Math.floor(start * sr), endSample = Math.floor(end * sr);
        var len = endSample - startSample;
        var trimmed = audioCtx.createBuffer(channels, len, sr);
        for (var ch = 0; ch < channels; ch++) { var src = audioBuffer.getChannelData(ch); trimmed.getChannelData(ch).set(src.subarray(startSample, endSample)); }
        // Encode as WAV
        var wavBuf = encodeWAV(trimmed);
        var blob = new Blob([wavBuf], { type: 'audio/wav' });
        dlCard(outputEl, 'Audio Trimmed!', (end - start).toFixed(1) + 's \u2022 ' + EditIt.formatFileSize(blob.size), blob, file.name.replace(/\.[^.]+$/, '') + '_trimmed.wav');
        EditIt.showToast('Audio trimmed!', 'success');
      } catch (err) { EditIt.showToast('Error: ' + err.message, 'error'); }
      EditIt.setButtonLoading(actionBtn, false);
    });
    function encodeWAV(buffer) {
      var ch = buffer.numberOfChannels, sr = buffer.sampleRate, len = buffer.length;
      var buf = new ArrayBuffer(44 + len * ch * 2); var v = new DataView(buf);
      function ws(o, s) { for (var i = 0; i < s.length; i++) v.setUint8(o + i, s.charCodeAt(i)); }
      ws(0, 'RIFF'); v.setUint32(4, 36 + len * ch * 2, true); ws(8, 'WAVE');
      ws(12, 'fmt '); v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, ch, true);
      v.setUint32(24, sr, true); v.setUint32(28, sr * ch * 2, true); v.setUint16(32, ch * 2, true); v.setUint16(34, 16, true);
      ws(36, 'data'); v.setUint32(40, len * ch * 2, true);
      var off = 44;
      for (var i = 0; i < len; i++) { for (var c = 0; c < ch; c++) { var s = Math.max(-1, Math.min(1, buffer.getChannelData(c)[i])); v.setInt16(off, s < 0 ? s * 0x8000 : s * 0x7FFF, true); off += 2; } }
      return buf;
    }
  })();

  // VIDEO TO GIF
  (function () {
    var actionBtn = document.getElementById('video-to-gif-action');
    var outputEl = document.getElementById('video-to-gif-output');
    var opts = document.getElementById('video-to-gif-options');
    var file = null;
    document.addEventListener('files-added', function (e) {
      if (e.detail.toolId !== 'video-to-gif') return;
      file = e.detail.files.find(function (f) { return f.type.startsWith('video/'); });
      if (!file) { EditIt.showToast('Select a video file', 'error'); return; }
      var fl = document.getElementById('video-to-gif-files'); fl.innerHTML = '';
      var item = EditIt.createFileItem(file, 0); item.querySelector('.file-item-remove').addEventListener('click', function () { file = null; fl.innerHTML = ''; opts.style.display = 'none'; actionBtn.disabled = true; });
      fl.appendChild(item); opts.style.display = 'block'; actionBtn.disabled = false;
    });
    actionBtn.addEventListener('click', async function () {
      if (!file) return; EditIt.setButtonLoading(actionBtn, true);
      try {
        var startT = parseFloat(document.getElementById('gif-start').value) || 0;
        var dur = parseFloat(document.getElementById('gif-duration').value) || 3;
        var fps = parseInt(document.getElementById('gif-fps').value) || 10;
        var gw = parseInt(document.getElementById('gif-width').value) || 480;
        var video = document.createElement('video'); video.muted = true; video.playsInline = true;
        video.src = URL.createObjectURL(file);
        await new Promise(function (r) { video.onloadeddata = r; video.load(); });
        var gh = Math.round(gw * (video.videoHeight / video.videoWidth));
        var canvas = document.createElement('canvas'); canvas.width = gw; canvas.height = gh;
        var ctx = canvas.getContext('2d');
        var frames = []; var totalFrames = Math.floor(dur * fps);
        for (var i = 0; i < totalFrames; i++) {
          EditIt.showProgress('Capturing frame ' + (i + 1) + '/' + totalFrames, (i / totalFrames) * 90);
          video.currentTime = startT + (i / fps);
          await new Promise(function (r) { video.onseeked = r; });
          ctx.drawImage(video, 0, 0, gw, gh);
          frames.push(ctx.getImageData(0, 0, gw, gh));
        }
        EditIt.showProgress('Encoding GIF...', 95);
        // Simple GIF encoder (uncompressed - produces larger files but works without library)
        var blob = createGIF(frames, gw, gh, Math.round(100 / fps));
        EditIt.hideProgress();
        var url = URL.createObjectURL(blob);
        outputEl.innerHTML = '<div class="output-card"><h3>\u2713 GIF Created!</h3><p>' + totalFrames + ' frames \u2022 ' + EditIt.formatFileSize(blob.size) + '</p><div style="margin:16px 0"><img src="' + url + '" style="max-width:100%;border:1px solid var(--border);border-radius:8px"></div><div class="output-filename"><label>File name:</label><input type="text" class="input output-dl-name" value="animation.gif"></div><button class="btn btn-success output-dl-btn">Download GIF</button></div>';
        outputEl.querySelector('.output-dl-btn').addEventListener('click', function () { EditIt.downloadBlob(blob, outputEl.querySelector('.output-dl-name').value || 'animation.gif'); });
        EditIt.showToast('GIF created!', 'success');
      } catch (err) { EditIt.hideProgress(); EditIt.showToast('Error: ' + err.message, 'error'); }
      EditIt.setButtonLoading(actionBtn, false);
    });
    // Minimal GIF89a encoder
    function createGIF(frames, w, h, delay) {
      var buf = [];
      function w16(v) { buf.push(v & 0xFF, (v >> 8) & 0xFF); }
      // Header
      [0x47, 0x49, 0x46, 0x38, 0x39, 0x61].forEach(function (b) { buf.push(b); }); // GIF89a
      w16(w); w16(h);
      buf.push(0x70, 0, 0); // GCT flag off, 0 bg, 0 aspect
      // Netscape extension for looping
      buf.push(0x21, 0xFF, 0x0B);
      [0x4E,0x45,0x54,0x53,0x43,0x41,0x50,0x45,0x32,0x2E,0x30].forEach(function (b) { buf.push(b); });
      buf.push(0x03, 0x01); w16(0); buf.push(0x00);
      frames.forEach(function (frame) {
        // Build color table (quantize to 256 colors)
        var pixels = frame.data; var colorMap = {}; var palette = []; var indexed = new Uint8Array(w * h);
        for (var i = 0; i < pixels.length; i += 4) {
          var r = pixels[i] >> 4 << 4, g = pixels[i + 1] >> 4 << 4, b = pixels[i + 2] >> 4 << 4;
          var key = (r << 16) | (g << 8) | b;
          if (!(key in colorMap)) {
            if (palette.length < 256) { colorMap[key] = palette.length; palette.push([r, g, b]); }
            else { colorMap[key] = 0; }
          }
          indexed[i / 4] = colorMap[key];
        }
        while (palette.length < 256) palette.push([0, 0, 0]);
        // GCE
        buf.push(0x21, 0xF9, 0x04, 0x00); w16(delay); buf.push(0x00, 0x00);
        // Image descriptor
        buf.push(0x2C); w16(0); w16(0); w16(w); w16(h);
        buf.push(0x87); // Local color table, 256 colors
        palette.forEach(function (c) { buf.push(c[0], c[1], c[2]); });
        // LZW encode (minimum code size = 8)
        buf.push(8);
        var lzw = lzwEncode(8, indexed);
        var pos = 0;
        while (pos < lzw.length) { var chunk = Math.min(255, lzw.length - pos); buf.push(chunk); for (var j = 0; j < chunk; j++) buf.push(lzw[pos++]); }
        buf.push(0x00);
      });
      buf.push(0x3B); // Trailer
      return new Blob([new Uint8Array(buf)], { type: 'image/gif' });
    }
    function lzwEncode(minCode, data) {
      var clearCode = 1 << minCode, eoi = clearCode + 1;
      var codeSize = minCode + 1, nextCode = eoi + 1;
      var dict = {}; for (var i = 0; i < clearCode; i++) dict[i] = i;
      var out = [], bits = 0, buf = 0;
      function emit(code) { buf |= code << bits; bits += codeSize; while (bits >= 8) { out.push(buf & 0xFF); buf >>= 8; bits -= 8; } }
      emit(clearCode);
      var prev = data[0];
      for (var j = 1; j < data.length; j++) {
        var curr = data[j];
        var key = prev + ',' + curr;
        if (key in dict) { prev = dict[key]; }
        else {
          emit(prev);
          if (nextCode < 4096) { dict[key] = nextCode++; if (nextCode > (1 << codeSize) && codeSize < 12) codeSize++; }
          else { emit(clearCode); dict = {}; for (var k = 0; k < clearCode; k++) dict[k] = k; nextCode = eoi + 1; codeSize = minCode + 1; }
          prev = curr;
        }
      }
      emit(prev); emit(eoi);
      if (bits > 0) out.push(buf & 0xFF);
      return out;
    }
  })();

})();


// ===== file.tools — New Tools (26 additional tools) =====
(function () {
  'use strict';

  // =============================================
  // HELPERS
  // =============================================
  function dlCard(el, title, info, blob, name, preview) {
    el.innerHTML = '<div class="output-card"><h3>\u2713 ' + title + '</h3><p>' + info + '</p>' + (preview || '') + '<div class="output-filename"><label>File name:</label><input type="text" class="input output-dl-name" value="' + name + '"></div><button class="btn btn-success output-dl-btn">Download</button></div>';
    el.querySelector('.output-dl-btn').addEventListener('click', function () { EditIt.downloadBlob(blob, el.querySelector('.output-dl-name').value.trim() || name); });
  }

  var IMG_ACCEPT = 'image/*,.heic,.heif,.dng,.avif,.tiff,.tif';
  function isImageFile(f) { return f.type.startsWith('image/') || /\.(jpe?g|png|gif|webp|bmp|svg|avif|heic|heif|tiff?)$/i.test(f.name); }

  function imgTool(id, onFile, onAction) {
    var fileListEl = document.getElementById(id + '-files');
    var actionBtn = document.getElementById(id + '-action');
    var outputEl = document.getElementById(id + '-output');
    if (!actionBtn) return;
    var file = null, normalizedFile = null;
    document.addEventListener('files-added', async function (e) {
      if (e.detail.toolId !== id) return;
      var f = e.detail.files.find(isImageFile);
      if (!f) { EditIt.showToast('Please select an image', 'error'); return; }
      file = f;
      normalizedFile = await EditIt.normalizeImageFile(f);
      if (!normalizedFile) { EditIt.showToast('Could not read this image format', 'error'); return; }
      if (fileListEl) {
        fileListEl.innerHTML = '';
        var item = EditIt.createFileItem(f, 0);
        item.querySelector('.file-item-remove').addEventListener('click', function () {
          file = null; normalizedFile = null; fileListEl.innerHTML = '';
          if (actionBtn) actionBtn.disabled = true; outputEl.innerHTML = '';
        });
        fileListEl.appendChild(item);
      }
      if (actionBtn) actionBtn.disabled = false;
      outputEl.innerHTML = '';
      if (onFile) onFile(normalizedFile);
    });
    if (actionBtn) actionBtn.addEventListener('click', async function () {
      if (!normalizedFile) return; EditIt.setButtonLoading(actionBtn, true);
      try { await onAction(normalizedFile, outputEl); } catch (err) { console.error(err); EditIt.showToast('Error: ' + err.message, 'error'); }
      EditIt.setButtonLoading(actionBtn, false);
    });
  }

  // =============================================
  // 1. IMAGE WATERMARK
  // =============================================
  (function () {
    var loadedImg = null;
    var previewCanvas = document.getElementById('imgwm-canvas-preview');
    var previewArea = document.getElementById('imgwm-preview');
    if (!previewCanvas) return;

    function updatePreview() {
      if (!loadedImg) return;
      var w = loadedImg.naturalWidth, h = loadedImg.naturalHeight;
      var scale = Math.min(600 / w, 1);
      previewCanvas.width = w * scale; previewCanvas.height = h * scale;
      var ctx = previewCanvas.getContext('2d');
      ctx.drawImage(loadedImg, 0, 0, previewCanvas.width, previewCanvas.height);
      var text = document.getElementById('imgwm-text').value || 'WATERMARK';
      var size = Math.round((parseInt(document.getElementById('imgwm-size').value) || 48) * scale);
      var color = document.getElementById('imgwm-color').value;
      var opacity = parseInt(document.getElementById('imgwm-opacity').value) / 100;
      var pattern = document.getElementById('imgwm-pattern').value;
      ctx.globalAlpha = opacity;
      ctx.font = 'bold ' + size + 'px Arial';
      ctx.fillStyle = color;
      ctx.textAlign = 'center';
      if (pattern === 'center') {
        ctx.fillText(text, previewCanvas.width / 2, previewCanvas.height / 2);
      } else if (pattern === 'diagonal') {
        ctx.save();
        ctx.translate(previewCanvas.width / 2, previewCanvas.height / 2);
        ctx.rotate(-Math.PI / 4);
        ctx.fillText(text, 0, 0);
        ctx.restore();
      } else {
        var gap = size * 3;
        ctx.save();
        ctx.rotate(-Math.PI / 6);
        for (var y = -previewCanvas.height; y < previewCanvas.height * 2; y += gap) {
          for (var x = -previewCanvas.width; x < previewCanvas.width * 2; x += gap) {
            ctx.fillText(text, x, y);
          }
        }
        ctx.restore();
      }
      ctx.globalAlpha = 1;
      previewArea.style.display = 'block';
    }

    ['imgwm-text', 'imgwm-size', 'imgwm-color', 'imgwm-opacity', 'imgwm-pattern'].forEach(function (id) {
      var el = document.getElementById(id);
      if (el) { el.addEventListener('input', updatePreview); el.addEventListener('change', updatePreview); }
    });

    imgTool('image-watermark',
      async function (file) {
        document.getElementById('imgwm-split').style.display = 'grid';
        var du = await EditIt.readFileAsDataURL(file);
        loadedImg = await EditIt.loadImage(du);
        updatePreview();
      },
      async function (file, out) {
        var c = document.createElement('canvas');
        c.width = loadedImg.naturalWidth; c.height = loadedImg.naturalHeight;
        var ctx = c.getContext('2d');
        ctx.drawImage(loadedImg, 0, 0);
        var text = document.getElementById('imgwm-text').value || 'WATERMARK';
        var size = parseInt(document.getElementById('imgwm-size').value) || 48;
        var color = document.getElementById('imgwm-color').value;
        var opacity = parseInt(document.getElementById('imgwm-opacity').value) / 100;
        var pattern = document.getElementById('imgwm-pattern').value;
        ctx.globalAlpha = opacity;
        ctx.font = 'bold ' + size + 'px Arial';
        ctx.fillStyle = color;
        ctx.textAlign = 'center';
        if (pattern === 'center') {
          ctx.fillText(text, c.width / 2, c.height / 2);
        } else if (pattern === 'diagonal') {
          ctx.save(); ctx.translate(c.width / 2, c.height / 2); ctx.rotate(-Math.PI / 4);
          ctx.fillText(text, 0, 0); ctx.restore();
        } else {
          var gap = size * 3;
          ctx.save(); ctx.rotate(-Math.PI / 6);
          for (var y = -c.height; y < c.height * 2; y += gap)
            for (var x = -c.width; x < c.width * 2; x += gap) ctx.fillText(text, x, y);
          ctx.restore();
        }
        ctx.globalAlpha = 1;
        var blob = await new Promise(function (r) { c.toBlob(r, 'image/png'); });
        dlCard(out, 'Watermark Added!', EditIt.formatFileSize(blob.size), blob, file.name.replace(/\.[^.]+$/, '') + '_watermarked.png');
        EditIt.showToast('Watermark added!', 'success');
      });
  })();

  // =============================================
  // 2. PHOTO COLLAGE
  // =============================================
  (function () {
    var actionBtn = document.getElementById('photo-collage-action');
    var outputEl = document.getElementById('photo-collage-output');
    var fileListEl = document.getElementById('photo-collage-files');
    if (!actionBtn) return;
    var files = [];
    document.addEventListener('files-added', function (e) {
      if (e.detail.toolId !== 'photo-collage') return;
      var imgs = e.detail.files.filter(isImageFile);
      if (!imgs.length) { EditIt.showToast('Select images', 'error'); return; }
      files = files.concat(imgs);
      fileListEl.innerHTML = '';
      files.forEach(function (f, i) {
        var item = EditIt.createFileItem(f, i);
        item.querySelector('.file-item-remove').addEventListener('click', function () { files.splice(i, 1); fileListEl.innerHTML = ''; actionBtn.disabled = !files.length; });
        fileListEl.appendChild(item);
      });
      actionBtn.disabled = files.length < 2;
      document.getElementById('photo-collage-options').style.display = 'block';
    });
    actionBtn.addEventListener('click', async function () {
      if (files.length < 2) return;
      EditIt.setButtonLoading(actionBtn, true);
      try {
        var layout = document.getElementById('collage-layout').value;
        var gap = parseInt(document.getElementById('collage-gap').value) || 4;
        var bg = document.getElementById('collage-bg').value;
        var imgs = [];
        for (var i = 0; i < files.length; i++) {
          var du = await EditIt.readImageAsDataURL(files[i]);
          imgs.push(await EditIt.loadImage(du));
        }
        var cellSize = 400;
        var c, ctx, cols, rows;
        if (layout === 'grid') {
          cols = Math.ceil(Math.sqrt(imgs.length));
          rows = Math.ceil(imgs.length / cols);
        } else if (layout === 'horizontal') {
          cols = imgs.length; rows = 1;
        } else { cols = 1; rows = imgs.length; }
        c = document.createElement('canvas');
        c.width = cols * cellSize + (cols - 1) * gap;
        c.height = rows * cellSize + (rows - 1) * gap;
        ctx = c.getContext('2d');
        ctx.fillStyle = bg;
        ctx.fillRect(0, 0, c.width, c.height);
        imgs.forEach(function (img, idx) {
          var col = idx % cols, row = Math.floor(idx / cols);
          var x = col * (cellSize + gap), y = row * (cellSize + gap);
          var scale = Math.min(cellSize / img.naturalWidth, cellSize / img.naturalHeight);
          var dw = img.naturalWidth * scale, dh = img.naturalHeight * scale;
          ctx.drawImage(img, x + (cellSize - dw) / 2, y + (cellSize - dh) / 2, dw, dh);
        });
        var blob = await new Promise(function (r) { c.toBlob(r, 'image/png'); });
        dlCard(outputEl, 'Collage Created!', imgs.length + ' images • ' + EditIt.formatFileSize(blob.size), blob, 'collage.png');
        EditIt.showToast('Collage created!', 'success');
      } catch (err) { EditIt.showToast('Error: ' + err.message, 'error'); }
      EditIt.setButtonLoading(actionBtn, false);
    });
  })();

  // =============================================
  // 3. FAVICON GENERATOR
  // =============================================
  imgTool('favicon-generator', null, async function (file, out) {
    var du = await EditIt.readFileAsDataURL(file);
    var img = await EditIt.loadImage(du);
    var sizes = [16, 32, 48, 64, 128, 180, 192, 512];
    var blobs = [];
    var html = '<div class="output-card"><h3>\u2713 Favicons Generated!</h3><p>' + sizes.length + ' sizes created</p></div><div class="output-images">';
    for (var i = 0; i < sizes.length; i++) {
      var s = sizes[i];
      var c = document.createElement('canvas'); c.width = s; c.height = s;
      var ctx = c.getContext('2d');
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(img, 0, 0, s, s);
      var blob = await new Promise(function (r) { c.toBlob(r, 'image/png'); });
      var url = URL.createObjectURL(blob);
      blobs.push({ blob: blob, name: 'favicon-' + s + 'x' + s + '.png', size: s });
      html += '<div class="output-image-card"><img src="' + url + '" style="width:' + Math.min(s, 128) + 'px;height:' + Math.min(s, 128) + 'px;image-rendering:pixelated"><div class="output-image-info"><span>' + s + '×' + s + ' • ' + EditIt.formatFileSize(blob.size) + '</span><button class="btn btn-sm btn-outline fav-dl" data-i="' + i + '">Download</button></div></div>';
    }
    html += '</div><button class="btn btn-success" id="fav-dl-all" style="margin-top:12px">Download All (ZIP)</button>';
    out.innerHTML = html;
    out.querySelectorAll('.fav-dl').forEach(function (b) {
      b.addEventListener('click', function () { var idx = parseInt(b.dataset.i); EditIt.downloadBlob(blobs[idx].blob, blobs[idx].name); });
    });
    document.getElementById('fav-dl-all').addEventListener('click', async function () {
      var zip = new JSZip();
      blobs.forEach(function (b) { zip.file(b.name, b.blob); });
      EditIt.downloadBlob(await zip.generateAsync({ type: 'blob' }), 'favicons.zip');
    });
    EditIt.showToast('Favicons generated!', 'success');
  });

  // =============================================
  // 4. EXIF VIEWER / STRIPPER
  // =============================================
  imgTool('exif-viewer', null, async function (file, out) {
    var buf = await EditIt.readFileAsArrayBuffer(file);
    var view = new DataView(buf);
    var exifData = {};
    try {
      if (view.getUint16(0) === 0xFFD8) { // JPEG
        var offset = 2;
        while (offset < view.byteLength) {
          var marker = view.getUint16(offset);
          if (marker === 0xFFE1) { // APP1 / EXIF
            var len = view.getUint16(offset + 2);
            var exifStr = '';
            for (var i = 0; i < 4; i++) exifStr += String.fromCharCode(view.getUint8(offset + 4 + i));
            if (exifStr === 'Exif') {
              exifData['Format'] = 'JPEG with EXIF';
              exifData['EXIF Data Size'] = len + ' bytes';
              // Try to parse TIFF header
              var tiffOffset = offset + 10;
              var le = view.getUint16(tiffOffset) === 0x4949;
              var getU16 = function (o) { return le ? view.getUint16(o, true) : view.getUint16(o); };
              var getU32 = function (o) { return le ? view.getUint32(o, true) : view.getUint32(o); };
              var ifdOffset = tiffOffset + getU32(tiffOffset + 4);
              var entries = getU16(ifdOffset);
              var tagNames = { 0x010F: 'Camera Make', 0x0110: 'Camera Model', 0x0112: 'Orientation', 0x011A: 'X Resolution', 0x011B: 'Y Resolution', 0x0131: 'Software', 0x0132: 'DateTime', 0x8769: 'EXIF IFD', 0x8825: 'GPS IFD', 0xA002: 'Image Width', 0xA003: 'Image Height' };
              for (var e = 0; e < Math.min(entries, 50); e++) {
                var entryOffset = ifdOffset + 2 + e * 12;
                var tag = getU16(entryOffset);
                var type = getU16(entryOffset + 2);
                var count = getU32(entryOffset + 4);
                if (tagNames[tag]) {
                  if (type === 2) { // ASCII
                    var strOffset = count > 4 ? tiffOffset + getU32(entryOffset + 8) : entryOffset + 8;
                    var str = '';
                    for (var si = 0; si < Math.min(count - 1, 64); si++) str += String.fromCharCode(view.getUint8(strOffset + si));
                    exifData[tagNames[tag]] = str;
                  } else if (type === 3) { exifData[tagNames[tag]] = getU16(entryOffset + 8); }
                  else if (type === 4) { exifData[tagNames[tag]] = getU32(entryOffset + 8); }
                }
              }
            }
            break;
          }
          var segLen = view.getUint16(offset + 2);
          offset += 2 + segLen;
        }
      }
    } catch (err) { exifData['Parse Error'] = err.message; }
    if (Object.keys(exifData).length === 0) exifData['Info'] = 'No EXIF data found or format not supported';
    exifData['File Name'] = file.name;
    exifData['File Size'] = EditIt.formatFileSize(file.size);
    exifData['MIME Type'] = file.type;
    var html = '<div class="output-card"><h3>\u2713 EXIF Data</h3><table class="exif-table">';
    Object.keys(exifData).forEach(function (k) { html += '<tr><td><strong>' + k + '</strong></td><td>' + exifData[k] + '</td></tr>'; });
    html += '</table><div style="display:flex;gap:8px;margin-top:12px"><button class="btn btn-success" id="exif-strip">Strip EXIF & Download</button><button class="btn btn-outline" id="exif-copy">Copy Data</button></div></div>';
    out.innerHTML = html;
    document.getElementById('exif-copy').addEventListener('click', function () {
      var text = Object.keys(exifData).map(function (k) { return k + ': ' + exifData[k]; }).join('\n');
      navigator.clipboard.writeText(text).then(function () { EditIt.showToast('Copied!', 'success'); });
    });
    document.getElementById('exif-strip').addEventListener('click', async function () {
      var du = await EditIt.readFileAsDataURL(file);
      var img = await EditIt.loadImage(du);
      var c = document.createElement('canvas'); c.width = img.naturalWidth; c.height = img.naturalHeight;
      c.getContext('2d').drawImage(img, 0, 0);
      var blob = await new Promise(function (r) { c.toBlob(r, 'image/jpeg', 0.95); });
      EditIt.downloadBlob(blob, file.name.replace(/\.[^.]+$/, '') + '_no_exif.jpg');
      EditIt.showToast('EXIF stripped!', 'success');
    });
  });

  // =============================================
  // 5. MEME GENERATOR
  // =============================================
  (function () {
    var loadedImg = null;
    var previewCanvas = document.getElementById('meme-canvas-preview');
    if (!previewCanvas) return;

    function drawMeme(ctx, w, h) {
      ctx.drawImage(loadedImg, 0, 0, w, h);
      var top = document.getElementById('meme-top-text').value.toUpperCase();
      var bottom = document.getElementById('meme-bottom-text').value.toUpperCase();
      var size = Math.round(w / 12);
      ctx.font = 'bold ' + size + 'px Impact, Arial Black, sans-serif';
      ctx.textAlign = 'center';
      ctx.strokeStyle = '#000';
      ctx.fillStyle = '#fff';
      ctx.lineWidth = size / 12;
      ctx.lineJoin = 'round';
      if (top) { ctx.strokeText(top, w / 2, size + 10); ctx.fillText(top, w / 2, size + 10); }
      if (bottom) { ctx.strokeText(bottom, w / 2, h - 15); ctx.fillText(bottom, w / 2, h - 15); }
    }

    function updatePreview() {
      if (!loadedImg) return;
      var scale = Math.min(600 / loadedImg.naturalWidth, 1);
      previewCanvas.width = loadedImg.naturalWidth * scale;
      previewCanvas.height = loadedImg.naturalHeight * scale;
      drawMeme(previewCanvas.getContext('2d'), previewCanvas.width, previewCanvas.height);
      document.getElementById('meme-preview').style.display = 'block';
    }

    ['meme-top-text', 'meme-bottom-text'].forEach(function (id) {
      var el = document.getElementById(id);
      if (el) el.addEventListener('input', updatePreview);
    });

    imgTool('meme-generator',
      async function (file) {
        document.getElementById('meme-split').style.display = 'grid';
        var du = await EditIt.readFileAsDataURL(file);
        loadedImg = await EditIt.loadImage(du);
        updatePreview();
      },
      async function (file, out) {
        var c = document.createElement('canvas');
        c.width = loadedImg.naturalWidth; c.height = loadedImg.naturalHeight;
        drawMeme(c.getContext('2d'), c.width, c.height);
        var blob = await new Promise(function (r) { c.toBlob(r, 'image/png'); });
        dlCard(out, 'Meme Created!', EditIt.formatFileSize(blob.size), blob, 'meme.png');
        EditIt.showToast('Meme created!', 'success');
      });
  })();

  // =============================================
  // 6. IMAGE COMPARISON SLIDER
  // =============================================
  (function () {
    var actionBtn = document.getElementById('image-compare-action');
    if (!actionBtn) return;
    var files = [];
    var fileListEl = document.getElementById('image-compare-files');
    document.addEventListener('files-added', function (e) {
      if (e.detail.toolId !== 'image-compare') return;
      files = files.concat(e.detail.files.filter(isImageFile)).slice(0, 2);
      fileListEl.innerHTML = '';
      files.forEach(function (f, i) {
        var item = EditIt.createFileItem(f, i);
        item.querySelector('.file-item-remove').addEventListener('click', function () { files.splice(i, 1); fileListEl.innerHTML = ''; actionBtn.disabled = true; });
        fileListEl.appendChild(item);
      });
      actionBtn.disabled = files.length < 2;
    });
    actionBtn.addEventListener('click', async function () {
      if (files.length < 2) return;
      var out = document.getElementById('image-compare-output');
      var url1 = await EditIt.readImageAsDataURL(files[0]);
      var url2 = await EditIt.readImageAsDataURL(files[1]);
      out.innerHTML = '<div class="compare-slider-wrap"><div class="compare-slider-container" id="cs-container"><img src="' + url1 + '" class="cs-img cs-img-left" id="cs-left"><img src="' + url2 + '" class="cs-img cs-img-right"><div class="cs-handle" id="cs-handle"><div class="cs-handle-line"></div></div></div><div style="display:flex;justify-content:space-between;margin-top:8px"><span class="preview-meta">' + files[0].name + '</span><span class="preview-meta">' + files[1].name + '</span></div></div>';
      var container = document.getElementById('cs-container');
      var handle = document.getElementById('cs-handle');
      var leftImg = document.getElementById('cs-left');
      function setPosition(x) {
        var rect = container.getBoundingClientRect();
        var pct = Math.max(0, Math.min(100, ((x - rect.left) / rect.width) * 100));
        leftImg.style.clipPath = 'inset(0 ' + (100 - pct) + '% 0 0)';
        handle.style.left = pct + '%';
      }
      setPosition(container.getBoundingClientRect().left + container.getBoundingClientRect().width / 2);
      var dragging = false;
      handle.addEventListener('mousedown', function () { dragging = true; });
      document.addEventListener('mousemove', function (e) { if (dragging) setPosition(e.clientX); });
      document.addEventListener('mouseup', function () { dragging = false; });
      handle.addEventListener('touchstart', function () { dragging = true; });
      document.addEventListener('touchmove', function (e) { if (dragging) setPosition(e.touches[0].clientX); });
      document.addEventListener('touchend', function () { dragging = false; });
      container.addEventListener('click', function (e) { setPosition(e.clientX); });
    });
  })();

  // =============================================
  // 7. PASSWORD GENERATOR
  // =============================================
  (function () {
    var btn = document.getElementById('password-gen-btn');
    if (!btn) return;
    btn.addEventListener('click', function () {
      var len = parseInt(document.getElementById('pw-length').value) || 16;
      var upper = document.getElementById('pw-upper').checked;
      var lower = document.getElementById('pw-lower').checked;
      var nums = document.getElementById('pw-numbers').checked;
      var syms = document.getElementById('pw-symbols').checked;
      var count = parseInt(document.getElementById('pw-count').value) || 5;
      var chars = '';
      if (upper) chars += 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
      if (lower) chars += 'abcdefghijklmnopqrstuvwxyz';
      if (nums) chars += '0123456789';
      if (syms) chars += '!@#$%^&*()_+-=[]{}|;:,.<>?';
      if (!chars) { EditIt.showToast('Select at least one character type', 'error'); return; }
      var passwords = [];
      var arr = new Uint32Array(len * count);
      crypto.getRandomValues(arr);
      for (var p = 0; p < count; p++) {
        var pw = '';
        for (var i = 0; i < len; i++) pw += chars[arr[p * len + i] % chars.length];
        passwords.push(pw);
      }
      var out = document.getElementById('password-generator-output');
      var html = '<div class="output-card"><h3>\u2713 Passwords Generated</h3><div class="pw-list">';
      passwords.forEach(function (pw) {
        html += '<div class="pw-item"><code class="pw-code">' + pw + '</code><button class="btn btn-sm btn-outline pw-copy">Copy</button></div>';
      });
      html += '</div></div>';
      out.innerHTML = html;
      out.querySelectorAll('.pw-copy').forEach(function (b, i) {
        b.addEventListener('click', function () { navigator.clipboard.writeText(passwords[i]).then(function () { EditIt.showToast('Copied!', 'success'); }); });
      });
    });
  })();

  // =============================================
  // 8. UUID GENERATOR
  // =============================================
  (function () {
    var btn = document.getElementById('uuid-gen-btn');
    if (!btn) return;
    function uuidv4() {
      var arr = new Uint8Array(16);
      crypto.getRandomValues(arr);
      arr[6] = (arr[6] & 0x0f) | 0x40;
      arr[8] = (arr[8] & 0x3f) | 0x80;
      var hex = Array.from(arr).map(function (b) { return b.toString(16).padStart(2, '0'); }).join('');
      return hex.substr(0, 8) + '-' + hex.substr(8, 4) + '-' + hex.substr(12, 4) + '-' + hex.substr(16, 4) + '-' + hex.substr(20, 12);
    }
    btn.addEventListener('click', function () {
      var count = parseInt(document.getElementById('uuid-count').value) || 5;
      var format = document.getElementById('uuid-format').value;
      var uuids = [];
      for (var i = 0; i < count; i++) {
        var u = uuidv4();
        if (format === 'upper') u = u.toUpperCase();
        else if (format === 'no-dash') u = u.replace(/-/g, '');
        uuids.push(u);
      }
      var out = document.getElementById('uuid-generator-output');
      out.innerHTML = '<div class="output-card"><h3>\u2713 UUIDs Generated</h3><div class="pw-list">' +
        uuids.map(function (u) { return '<div class="pw-item"><code class="pw-code">' + u + '</code><button class="btn btn-sm btn-outline pw-copy">Copy</button></div>'; }).join('') +
        '</div><button class="btn btn-outline" id="uuid-copy-all" style="margin-top:8px">Copy All</button></div>';
      out.querySelectorAll('.pw-copy').forEach(function (b, i) {
        b.addEventListener('click', function () { navigator.clipboard.writeText(uuids[i]).then(function () { EditIt.showToast('Copied!', 'success'); }); });
      });
      document.getElementById('uuid-copy-all').addEventListener('click', function () {
        navigator.clipboard.writeText(uuids.join('\n')).then(function () { EditIt.showToast('All copied!', 'success'); });
      });
    });
  })();

  // =============================================
  // 9. JWT DECODER
  // =============================================
  (function () {
    var btn = document.getElementById('jwt-decode-btn');
    if (!btn) return;
    btn.addEventListener('click', function () {
      var token = document.getElementById('jwt-input').value.trim();
      var out = document.getElementById('jwt-decoder-output');
      if (!token) { EditIt.showToast('Paste a JWT token', 'error'); return; }
      try {
        var parts = token.split('.');
        if (parts.length !== 3) throw new Error('Invalid JWT: expected 3 parts, got ' + parts.length);
        function b64decode(s) { s = s.replace(/-/g, '+').replace(/_/g, '/'); while (s.length % 4) s += '='; return decodeURIComponent(escape(atob(s))); }
        var header = JSON.parse(b64decode(parts[0]));
        var payload = JSON.parse(b64decode(parts[1]));
        // Check expiry
        var expInfo = '';
        if (payload.exp) {
          var expDate = new Date(payload.exp * 1000);
          var now = new Date();
          expInfo = '<div class="jwt-exp ' + (expDate < now ? 'expired' : 'valid') + '">' + (expDate < now ? '⚠ Expired: ' : '✓ Expires: ') + expDate.toLocaleString() + '</div>';
        }
        if (payload.iat) payload['iat (Issued At)'] = new Date(payload.iat * 1000).toLocaleString();
        if (payload.exp) payload['exp (Expires)'] = new Date(payload.exp * 1000).toLocaleString();
        out.innerHTML = '<div class="output-card"><h3>\u2713 JWT Decoded</h3>' + expInfo +
          '<h4 style="margin-top:12px">Header</h4><div class="ocr-text-output" style="text-align:left">' + JSON.stringify(header, null, 2).replace(/</g, '&lt;') + '</div>' +
          '<h4 style="margin-top:12px">Payload</h4><div class="ocr-text-output" style="text-align:left">' + JSON.stringify(payload, null, 2).replace(/</g, '&lt;') + '</div>' +
          '<p class="preview-meta" style="margin-top:8px">Signature: ' + parts[2].substring(0, 20) + '...</p></div>';
      } catch (e) { out.innerHTML = '<div class="output-card" style="border-color:var(--danger)"><h3 style="color:var(--danger)">\u2717 Invalid JWT</h3><p>' + e.message + '</p></div>'; }
    });
  })();

  // =============================================
  // 10. UNIX TIMESTAMP CONVERTER
  // =============================================
  (function () {
    var nowBtn = document.getElementById('ts-now');
    if (!nowBtn) return;
    function update() {
      var ts = document.getElementById('ts-input').value.trim();
      var out = document.getElementById('timestamp-converter-output');
      if (!ts) { out.innerHTML = ''; return; }
      var num = parseInt(ts);
      if (isNaN(num)) { out.innerHTML = '<p style="color:var(--danger)">Invalid timestamp</p>'; return; }
      // Auto-detect seconds vs milliseconds
      var ms = num > 1e12 ? num : num * 1000;
      var d = new Date(ms);
      if (isNaN(d.getTime())) { out.innerHTML = '<p style="color:var(--danger)">Invalid timestamp</p>'; return; }
      out.innerHTML = '<div class="stat-grid">' +
        '<div class="stat-card"><div class="stat-num" style="font-size:0.9rem">' + d.toLocaleDateString() + '</div><div class="stat-label">Local Date</div></div>' +
        '<div class="stat-card"><div class="stat-num" style="font-size:0.9rem">' + d.toLocaleTimeString() + '</div><div class="stat-label">Local Time</div></div>' +
        '<div class="stat-card"><div class="stat-num" style="font-size:0.9rem">' + d.toISOString() + '</div><div class="stat-label">ISO 8601</div></div>' +
        '<div class="stat-card"><div class="stat-num" style="font-size:0.9rem">' + d.toUTCString() + '</div><div class="stat-label">UTC</div></div></div>';
    }
    document.getElementById('ts-input').addEventListener('input', update);
    nowBtn.addEventListener('click', function () {
      document.getElementById('ts-input').value = Math.floor(Date.now() / 1000);
      update();
    });
    // Date to timestamp
    var dateBtn = document.getElementById('ts-from-date-btn');
    if (dateBtn) dateBtn.addEventListener('click', function () {
      var val = document.getElementById('ts-date-input').value;
      if (!val) { EditIt.showToast('Select a date', 'error'); return; }
      var d = new Date(val);
      var result = Math.floor(d.getTime() / 1000);
      document.getElementById('ts-date-result').textContent = 'Unix: ' + result + ' (ms: ' + d.getTime() + ')';
    });
  })();

  // =============================================
  // 11. CASE CONVERTER
  // =============================================
  (function () {
    var input = document.getElementById('case-input');
    if (!input) return;
    var out = document.getElementById('case-converter-output');
    function convert(type) {
      var t = input.value;
      if (!t) { EditIt.showToast('Enter text', 'error'); return; }
      var result;
      switch (type) {
        case 'upper': result = t.toUpperCase(); break;
        case 'lower': result = t.toLowerCase(); break;
        case 'title': result = t.replace(/\w\S*/g, function (w) { return w.charAt(0).toUpperCase() + w.substr(1).toLowerCase(); }); break;
        case 'sentence': result = t.toLowerCase().replace(/(^\s*\w|[.!?]\s+\w)/g, function (c) { return c.toUpperCase(); }); break;
        case 'camel': result = t.toLowerCase().replace(/[^a-zA-Z0-9]+(.)/g, function (m, c) { return c.toUpperCase(); }); break;
        case 'snake': result = t.replace(/\s+/g, '_').replace(/[A-Z]/g, function (c) { return '_' + c.toLowerCase(); }).replace(/^_/, '').replace(/__+/g, '_').toLowerCase(); break;
        case 'kebab': result = t.replace(/\s+/g, '-').replace(/[A-Z]/g, function (c) { return '-' + c.toLowerCase(); }).replace(/^-/, '').replace(/--+/g, '-').toLowerCase(); break;
        case 'pascal': result = t.replace(/\w\S*/g, function (w) { return w.charAt(0).toUpperCase() + w.substr(1).toLowerCase(); }).replace(/\s+/g, ''); break;
        case 'constant': result = t.replace(/\s+/g, '_').toUpperCase(); break;
        case 'dot': result = t.toLowerCase().replace(/\s+/g, '.'); break;
        case 'reverse': result = t.split('').reverse().join(''); break;
        case 'alternating': result = t.split('').map(function (c, i) { return i % 2 === 0 ? c.toLowerCase() : c.toUpperCase(); }).join(''); break;
        default: result = t;
      }
      out.innerHTML = '<div class="ocr-text-output">' + result.replace(/</g, '&lt;') + '</div><button class="btn btn-success case-copy" style="margin-top:8px">Copy</button>';
      out.querySelector('.case-copy').addEventListener('click', function () { navigator.clipboard.writeText(result).then(function () { EditIt.showToast('Copied!', 'success'); }); });
    }
    document.querySelectorAll('.case-btn').forEach(function (b) {
      b.addEventListener('click', function () { convert(b.dataset.type); });
    });
  })();

  // =============================================
  // 12. SLUG GENERATOR
  // =============================================
  (function () {
    var input = document.getElementById('slug-input');
    if (!input) return;
    function update() {
      var t = input.value;
      var sep = document.getElementById('slug-separator').value;
      var slug = t.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9\s-]/g, '').trim().replace(/[\s-]+/g, sep);
      document.getElementById('slug-output').value = slug;
    }
    input.addEventListener('input', update);
    document.getElementById('slug-separator').addEventListener('change', update);
    document.getElementById('slug-copy').addEventListener('click', function () {
      navigator.clipboard.writeText(document.getElementById('slug-output').value).then(function () { EditIt.showToast('Copied!', 'success'); });
    });
  })();

  // =============================================
  // 13. CRON EXPRESSION PARSER
  // =============================================
  (function () {
    var input = document.getElementById('cron-input');
    if (!input) return;
    function parse() {
      var val = input.value.trim();
      var out = document.getElementById('cron-parser-output');
      if (!val) { out.innerHTML = ''; return; }
      var parts = val.split(/\s+/);
      if (parts.length < 5 || parts.length > 6) { out.innerHTML = '<p style="color:var(--danger)">Expected 5 or 6 fields: minute hour day-of-month month day-of-week [year]</p>'; return; }
      var fields = ['Minute', 'Hour', 'Day of Month', 'Month', 'Day of Week'];
      if (parts.length === 6) fields.push('Year');
      var monthNames = ['', 'January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
      var dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
      function describe(val, field) {
        if (val === '*') return 'every ' + field.toLowerCase();
        if (val.includes('/')) { var p = val.split('/'); return 'every ' + p[1] + ' ' + field.toLowerCase() + '(s)' + (p[0] !== '*' ? ' starting at ' + p[0] : ''); }
        if (val.includes('-')) return field + ' ' + val;
        if (val.includes(',')) return field + ' ' + val;
        if (field === 'Month' && monthNames[parseInt(val)]) return monthNames[parseInt(val)];
        if (field === 'Day of Week' && dayNames[parseInt(val)]) return dayNames[parseInt(val)];
        return field + ' ' + val;
      }
      var html = '<div class="output-card"><h3>\u2713 Cron Parsed</h3><table class="exif-table">';
      parts.forEach(function (p, i) { html += '<tr><td><strong>' + fields[i] + '</strong></td><td><code>' + p + '</code></td><td>' + describe(p, fields[i]) + '</td></tr>'; });
      html += '</table>';
      // Generate human-readable summary
      var summary = 'Runs ';
      if (parts[0] === '*' && parts[1] === '*') summary += 'every minute';
      else if (parts[0] !== '*' && parts[1] === '*') summary += 'at minute ' + parts[0] + ' of every hour';
      else if (parts[0] !== '*' && parts[1] !== '*') summary += 'at ' + parts[1].padStart(2, '0') + ':' + parts[0].padStart(2, '0');
      else summary += 'every minute during hour ' + parts[1];
      if (parts[4] !== '*') summary += ' on ' + (dayNames[parseInt(parts[4])] || 'day ' + parts[4]);
      if (parts[2] !== '*') summary += ' on day ' + parts[2];
      if (parts[3] !== '*') summary += ' in ' + (monthNames[parseInt(parts[3])] || 'month ' + parts[3]);
      html += '<p style="margin-top:12px;font-weight:600;color:var(--primary)">' + summary + '</p></div>';
      out.innerHTML = html;
    }
    input.addEventListener('input', parse);
    document.querySelectorAll('.cron-example').forEach(function (b) {
      b.addEventListener('click', function () { input.value = b.dataset.cron; parse(); });
    });
  })();

  // =============================================
  // 14. JSON TO TYPESCRIPT
  // =============================================
  (function () {
    var btn = document.getElementById('json-to-ts-btn');
    if (!btn) return;
    function jsonToTs(obj, name) {
      var lines = ['interface ' + name + ' {'];
      Object.keys(obj).forEach(function (key) {
        var val = obj[key];
        var type;
        if (val === null) type = 'null';
        else if (Array.isArray(val)) {
          if (val.length === 0) type = 'any[]';
          else if (typeof val[0] === 'object' && val[0] !== null) type = name + key.charAt(0).toUpperCase() + key.slice(1) + 'Item[]';
          else type = typeof val[0] + '[]';
        }
        else if (typeof val === 'object') type = name + key.charAt(0).toUpperCase() + key.slice(1);
        else type = typeof val;
        lines.push('  ' + key + ': ' + type + ';');
      });
      lines.push('}');
      // Recurse for nested objects
      Object.keys(obj).forEach(function (key) {
        var val = obj[key];
        if (val !== null && typeof val === 'object' && !Array.isArray(val)) {
          lines.push('');
          lines = lines.concat(jsonToTs(val, name + key.charAt(0).toUpperCase() + key.slice(1)).split('\n'));
        } else if (Array.isArray(val) && val.length > 0 && typeof val[0] === 'object' && val[0] !== null) {
          lines.push('');
          lines = lines.concat(jsonToTs(val[0], name + key.charAt(0).toUpperCase() + key.slice(1) + 'Item').split('\n'));
        }
      });
      return lines.join('\n');
    }
    btn.addEventListener('click', function () {
      var input = document.getElementById('jts-input').value.trim();
      var name = document.getElementById('jts-name').value.trim() || 'Root';
      var out = document.getElementById('json-to-ts-output');
      try {
        var json = JSON.parse(input);
        if (Array.isArray(json)) json = json[0] || {};
        var ts = jsonToTs(json, name);
        out.innerHTML = '<div class="output-card"><h3>\u2713 TypeScript Interface</h3><div class="ocr-text-output" style="text-align:left;white-space:pre">' + ts.replace(/</g, '&lt;') + '</div><button class="btn btn-success" id="jts-copy" style="margin-top:8px">Copy</button></div>';
        document.getElementById('jts-copy').addEventListener('click', function () { navigator.clipboard.writeText(ts).then(function () { EditIt.showToast('Copied!', 'success'); }); });
      } catch (e) { out.innerHTML = '<p style="color:var(--danger)">\u2717 Invalid JSON: ' + e.message + '</p>'; }
    });
  })();

  // =============================================
  // 15. HTML/CSS/JS MINIFIER
  // =============================================
  (function () {
    var btn = document.getElementById('minify-btn');
    if (!btn) return;
    btn.addEventListener('click', function () {
      var input = document.getElementById('minify-input').value;
      var type = document.getElementById('minify-type').value;
      var out = document.getElementById('minify-code-output');
      if (!input.trim()) { EditIt.showToast('Paste code to minify', 'error'); return; }
      var result;
      if (type === 'html') {
        result = input.replace(/<!--[\s\S]*?-->/g, '').replace(/\s+/g, ' ').replace(/>\s+</g, '><').trim();
      } else if (type === 'css') {
        result = input.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\s+/g, ' ').replace(/\s*{\s*/g, '{').replace(/\s*}\s*/g, '}').replace(/\s*:\s*/g, ':').replace(/\s*;\s*/g, ';').replace(/;}/g, '}').trim();
      } else {
        result = input.replace(/\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '').replace(/\s+/g, ' ').replace(/\s*([{}();,=+\-*/<>!&|?:])\s*/g, '$1').trim();
      }
      var saved = ((1 - result.length / input.length) * 100).toFixed(1);
      out.innerHTML = '<div class="output-card"><h3>\u2713 Minified!</h3><p>' + input.length + ' → ' + result.length + ' chars (saved ' + saved + '%)</p><div class="ocr-text-output" style="word-break:break-all">' + result.substring(0, 3000).replace(/</g, '&lt;') + '</div><button class="btn btn-success" id="min-copy" style="margin-top:8px">Copy</button></div>';
      document.getElementById('min-copy').addEventListener('click', function () { navigator.clipboard.writeText(result).then(function () { EditIt.showToast('Copied!', 'success'); }); });
    });
  })();

  // =============================================
  // 16. HTML PRETTIFIER
  // =============================================
  (function () {
    var btn = document.getElementById('prettify-btn');
    if (!btn) return;
    btn.addEventListener('click', function () {
      var input = document.getElementById('prettify-input').value;
      var out = document.getElementById('html-prettifier-output');
      if (!input.trim()) { EditIt.showToast('Paste HTML/XML to prettify', 'error'); return; }
      var indent = 0, result = '', inTag = false;
      var formatted = input.replace(/>\s*</g, '>\n<');
      formatted.split('\n').forEach(function (line) {
        line = line.trim();
        if (!line) return;
        if (line.match(/^<\//) ) indent--;
        result += '  '.repeat(Math.max(0, indent)) + line + '\n';
        if (line.match(/^<[^\/!][^>]*[^\/]>/) && !line.match(/^<(br|hr|img|input|meta|link)/i)) indent++;
        if (line.match(/<\/[^>]+>$/) && line.match(/^<[^\/]/)) indent--;
      });
      out.innerHTML = '<div class="output-card"><h3>\u2713 Prettified!</h3><div class="ocr-text-output" style="text-align:left;white-space:pre">' + result.replace(/</g, '&lt;') + '</div><button class="btn btn-success" id="pret-copy" style="margin-top:8px">Copy</button></div>';
      document.getElementById('pret-copy').addEventListener('click', function () { navigator.clipboard.writeText(result).then(function () { EditIt.showToast('Copied!', 'success'); }); });
    });
  })();

  // =============================================
  // 17. SQL FORMATTER
  // =============================================
  (function () {
    var btn = document.getElementById('sql-format-btn');
    if (!btn) return;
    btn.addEventListener('click', function () {
      var input = document.getElementById('sql-input').value;
      var out = document.getElementById('sql-formatter-output');
      if (!input.trim()) { EditIt.showToast('Paste SQL to format', 'error'); return; }
      var keywords = ['SELECT', 'FROM', 'WHERE', 'AND', 'OR', 'JOIN', 'LEFT JOIN', 'RIGHT JOIN', 'INNER JOIN', 'OUTER JOIN', 'CROSS JOIN', 'ON', 'GROUP BY', 'ORDER BY', 'HAVING', 'LIMIT', 'OFFSET', 'UNION', 'INSERT INTO', 'VALUES', 'UPDATE', 'SET', 'DELETE FROM', 'CREATE TABLE', 'ALTER TABLE', 'DROP TABLE', 'AS', 'IN', 'NOT', 'BETWEEN', 'LIKE', 'IS NULL', 'IS NOT NULL', 'CASE', 'WHEN', 'THEN', 'ELSE', 'END', 'EXISTS'];
      var result = input.replace(/\s+/g, ' ').trim();
      keywords.forEach(function (kw) {
        var re = new RegExp('\\b' + kw.replace(/\s+/g, '\\s+') + '\\b', 'gi');
        result = result.replace(re, '\n' + kw.toUpperCase());
      });
      result = result.trim().replace(/^\n/, '');
      // Indent after SELECT, etc.
      var lines = result.split('\n');
      var formatted = [];
      lines.forEach(function (line) {
        line = line.trim();
        if (['AND', 'OR', 'ON'].some(function (k) { return line.startsWith(k + ' '); })) {
          formatted.push('  ' + line);
        } else {
          formatted.push(line);
        }
      });
      result = formatted.join('\n');
      out.innerHTML = '<div class="output-card"><h3>\u2713 SQL Formatted!</h3><div class="ocr-text-output" style="text-align:left;white-space:pre">' + result.replace(/</g, '&lt;') + '</div><button class="btn btn-success" id="sql-copy" style="margin-top:8px">Copy</button></div>';
      document.getElementById('sql-copy').addEventListener('click', function () { navigator.clipboard.writeText(result).then(function () { EditIt.showToast('Copied!', 'success'); }); });
    });
  })();

  // =============================================
  // 18. cURL TO CODE
  // =============================================
  (function () {
    var btn = document.getElementById('curl-convert-btn');
    if (!btn) return;
    btn.addEventListener('click', function () {
      var input = document.getElementById('curl-input').value.trim();
      var lang = document.getElementById('curl-lang').value;
      var out = document.getElementById('curl-to-code-output');
      if (!input) { EditIt.showToast('Paste a cURL command', 'error'); return; }
      // Parse cURL
      var url = '', method = 'GET', headers = {}, data = '';
      var urlMatch = input.match(/curl\s+['"]?(https?:\/\/[^\s'"]+)/i);
      if (urlMatch) url = urlMatch[1];
      else { var m2 = input.match(/['"]?(https?:\/\/[^\s'"]+)/); if (m2) url = m2[1]; }
      var methodMatch = input.match(/-X\s+(\w+)/i);
      if (methodMatch) method = methodMatch[1].toUpperCase();
      var headerMatches = input.match(/-H\s+['"]([^'"]+)['"]/gi);
      if (headerMatches) headerMatches.forEach(function (h) { var m = h.match(/-H\s+['"](.*)['"]/i); if (m) { var p = m[1].split(':'); headers[p[0].trim()] = p.slice(1).join(':').trim(); } });
      var dataMatch = input.match(/(?:-d|--data|--data-raw)\s+['"]([^'"]*)['"]/i);
      if (dataMatch) { data = dataMatch[1]; if (method === 'GET') method = 'POST'; }
      var result = '';
      if (lang === 'fetch') {
        result = 'fetch(\'' + url + '\', {\n  method: \'' + method + '\'';
        if (Object.keys(headers).length) result += ',\n  headers: ' + JSON.stringify(headers, null, 4).replace(/\n/g, '\n  ');
        if (data) result += ',\n  body: \'' + data.replace(/'/g, "\\'") + '\'';
        result += '\n})\n.then(res => res.json())\n.then(data => console.log(data))\n.catch(err => console.error(err));';
      } else if (lang === 'python') {
        result = 'import requests\n\nresponse = requests.' + method.toLowerCase() + '(\n    \'' + url + '\'';
        if (Object.keys(headers).length) result += ',\n    headers=' + JSON.stringify(headers).replace(/"/g, "'");
        if (data) result += ',\n    data=\'' + data + '\'';
        result += '\n)\nprint(response.json())';
      } else if (lang === 'axios') {
        result = 'const axios = require(\'axios\');\n\naxios({\n  method: \'' + method.toLowerCase() + '\',\n  url: \'' + url + '\'';
        if (Object.keys(headers).length) result += ',\n  headers: ' + JSON.stringify(headers, null, 4).replace(/\n/g, '\n  ');
        if (data) result += ',\n  data: \'' + data + '\'';
        result += '\n})\n.then(res => console.log(res.data))\n.catch(err => console.error(err));';
      } else if (lang === 'php') {
        result = '$ch = curl_init();\ncurl_setopt($ch, CURLOPT_URL, \'' + url + '\');\ncurl_setopt($ch, CURLOPT_RETURNTRANSFER, true);';
        if (method !== 'GET') result += '\ncurl_setopt($ch, CURLOPT_CUSTOMREQUEST, \'' + method + '\');';
        if (data) result += '\ncurl_setopt($ch, CURLOPT_POSTFIELDS, \'' + data + '\');';
        if (Object.keys(headers).length) {
          result += '\ncurl_setopt($ch, CURLOPT_HTTPHEADER, [';
          Object.keys(headers).forEach(function (k) { result += '\n    \'' + k + ': ' + headers[k] + '\','; });
          result += '\n]);';
        }
        result += '\n$response = curl_exec($ch);\ncurl_close($ch);\necho $response;';
      }
      out.innerHTML = '<div class="output-card"><h3>\u2713 Converted!</h3><div class="ocr-text-output" style="text-align:left;white-space:pre">' + result.replace(/</g, '&lt;') + '</div><button class="btn btn-success" id="curl-copy" style="margin-top:8px">Copy</button></div>';
      document.getElementById('curl-copy').addEventListener('click', function () { navigator.clipboard.writeText(result).then(function () { EditIt.showToast('Copied!', 'success'); }); });
    });
  })();

  // =============================================
  // 19. TEXT ENCRYPT / DECRYPT
  // =============================================
  (function () {
    var encBtn = document.getElementById('enc-encrypt');
    var decBtn = document.getElementById('enc-decrypt');
    if (!encBtn) return;
    async function deriveKey(password, salt) {
      var enc = new TextEncoder();
      var keyMaterial = await crypto.subtle.importKey('raw', enc.encode(password), 'PBKDF2', false, ['deriveBits', 'deriveKey']);
      return crypto.subtle.deriveKey({ name: 'PBKDF2', salt: salt, iterations: 100000, hash: 'SHA-256' }, keyMaterial, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
    }
    encBtn.addEventListener('click', async function () {
      var text = document.getElementById('enc-input').value;
      var password = document.getElementById('enc-password').value;
      var out = document.getElementById('text-encrypt-output');
      if (!text || !password) { EditIt.showToast('Enter text and password', 'error'); return; }
      try {
        var enc = new TextEncoder();
        var salt = crypto.getRandomValues(new Uint8Array(16));
        var iv = crypto.getRandomValues(new Uint8Array(12));
        var key = await deriveKey(password, salt);
        var encrypted = await crypto.subtle.encrypt({ name: 'AES-GCM', iv: iv }, key, enc.encode(text));
        var combined = new Uint8Array(salt.length + iv.length + encrypted.byteLength);
        combined.set(salt, 0);
        combined.set(iv, salt.length);
        combined.set(new Uint8Array(encrypted), salt.length + iv.length);
        var b64 = btoa(String.fromCharCode.apply(null, combined));
        out.innerHTML = '<div class="output-card"><h3>\u2713 Encrypted!</h3><div class="ocr-text-output" style="word-break:break-all">' + b64 + '</div><button class="btn btn-success" id="enc-copy" style="margin-top:8px">Copy</button></div>';
        document.getElementById('enc-copy').addEventListener('click', function () { navigator.clipboard.writeText(b64).then(function () { EditIt.showToast('Copied!', 'success'); }); });
      } catch (e) { EditIt.showToast('Encryption error: ' + e.message, 'error'); }
    });
    decBtn.addEventListener('click', async function () {
      var text = document.getElementById('enc-input').value.trim();
      var password = document.getElementById('enc-password').value;
      var out = document.getElementById('text-encrypt-output');
      if (!text || !password) { EditIt.showToast('Enter encrypted text and password', 'error'); return; }
      try {
        var combined = Uint8Array.from(atob(text), function (c) { return c.charCodeAt(0); });
        var salt = combined.slice(0, 16);
        var iv = combined.slice(16, 28);
        var data = combined.slice(28);
        var key = await deriveKey(password, salt);
        var decrypted = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: iv }, key, data);
        var result = new TextDecoder().decode(decrypted);
        out.innerHTML = '<div class="output-card"><h3>\u2713 Decrypted!</h3><div class="ocr-text-output" style="text-align:left">' + result.replace(/</g, '&lt;') + '</div><button class="btn btn-success" id="dec-copy" style="margin-top:8px">Copy</button></div>';
        document.getElementById('dec-copy').addEventListener('click', function () { navigator.clipboard.writeText(result).then(function () { EditIt.showToast('Copied!', 'success'); }); });
      } catch (e) { out.innerHTML = '<div class="output-card" style="border-color:var(--danger)"><h3 style="color:var(--danger)">\u2717 Decryption Failed</h3><p>Wrong password or corrupted data</p></div>'; }
    });
  })();

  // =============================================
  // 20. STEGANOGRAPHY
  // =============================================
  (function () {
    var encodeBtn = document.getElementById('steg-encode-btn');
    if (!encodeBtn) return;
    // Encode
    encodeBtn.addEventListener('click', async function () {
      var input = document.getElementById('steg-encode-input');
      var text = document.getElementById('steg-text').value;
      var out = document.getElementById('steganography-output');
      if (!input.files.length || !text) { EditIt.showToast('Select image and enter text', 'error'); return; }
      var du = await EditIt.readFileAsDataURL(input.files[0]);
      var img = await EditIt.loadImage(du);
      var c = document.createElement('canvas'); c.width = img.naturalWidth; c.height = img.naturalHeight;
      var ctx = c.getContext('2d');
      ctx.drawImage(img, 0, 0);
      var imgData = ctx.getImageData(0, 0, c.width, c.height);
      var data = imgData.data;
      var msg = text + '\0'; // null terminator
      var bits = '';
      for (var i = 0; i < msg.length; i++) {
        var code = msg.charCodeAt(i);
        bits += code.toString(2).padStart(8, '0');
      }
      if (bits.length > data.length / 4) { EditIt.showToast('Image too small for this message', 'error'); return; }
      for (var b = 0; b < bits.length; b++) {
        data[b * 4] = (data[b * 4] & 0xFE) | parseInt(bits[b]);
      }
      ctx.putImageData(imgData, 0, 0);
      var blob = await new Promise(function (r) { c.toBlob(r, 'image/png'); });
      dlCard(out, 'Message Hidden!', text.length + ' chars encoded', blob, 'steganography.png');
      EditIt.showToast('Message hidden in image!', 'success');
    });
    // Decode
    var decodeBtn = document.getElementById('steg-decode-btn');
    if (decodeBtn) decodeBtn.addEventListener('click', async function () {
      var input = document.getElementById('steg-decode-input');
      var out = document.getElementById('steganography-output');
      if (!input.files.length) { EditIt.showToast('Select an image', 'error'); return; }
      var du = await EditIt.readFileAsDataURL(input.files[0]);
      var img = await EditIt.loadImage(du);
      var c = document.createElement('canvas'); c.width = img.naturalWidth; c.height = img.naturalHeight;
      var ctx = c.getContext('2d');
      ctx.drawImage(img, 0, 0);
      var data = ctx.getImageData(0, 0, c.width, c.height).data;
      var bits = '', message = '';
      for (var b = 0; b < data.length / 4; b++) {
        bits += (data[b * 4] & 1).toString();
        if (bits.length === 8) {
          var char = String.fromCharCode(parseInt(bits, 2));
          if (char === '\0') break;
          message += char;
          bits = '';
        }
      }
      out.innerHTML = '<div class="output-card"><h3>' + (message ? '\u2713 Message Found!' : 'No message found') + '</h3>' + (message ? '<div class="ocr-text-output" style="text-align:left">' + message.replace(/</g, '&lt;') + '</div><button class="btn btn-success" id="steg-copy" style="margin-top:8px">Copy</button>' : '<p>No hidden message detected in this image.</p>') + '</div>';
      if (message) document.getElementById('steg-copy').addEventListener('click', function () { navigator.clipboard.writeText(message).then(function () { EditIt.showToast('Copied!', 'success'); }); });
    });
  })();

  // =============================================
  // 21. CSS GRADIENT GENERATOR
  // =============================================
  (function () {
    var preview = document.getElementById('gradient-preview');
    if (!preview) return;
    function update() {
      var type = document.getElementById('grad-type').value;
      var c1 = document.getElementById('grad-color1').value;
      var c2 = document.getElementById('grad-color2').value;
      var c3 = document.getElementById('grad-color3').value;
      var angle = document.getElementById('grad-angle').value;
      document.getElementById('grad-angle-val').textContent = angle + '°';
      var colors = c1 + ', ' + c2;
      if (c3) colors += ', ' + c3;
      var css;
      if (type === 'linear') css = 'linear-gradient(' + angle + 'deg, ' + colors + ')';
      else if (type === 'radial') css = 'radial-gradient(circle, ' + colors + ')';
      else css = 'conic-gradient(from ' + angle + 'deg, ' + colors + ')';
      preview.style.background = css;
      document.getElementById('grad-css-output').textContent = 'background: ' + css + ';';
    }
    ['grad-type', 'grad-color1', 'grad-color2', 'grad-color3', 'grad-angle'].forEach(function (id) {
      var el = document.getElementById(id);
      if (el) { el.addEventListener('input', update); el.addEventListener('change', update); }
    });
    update();
    document.getElementById('grad-copy').addEventListener('click', function () {
      navigator.clipboard.writeText(document.getElementById('grad-css-output').textContent).then(function () { EditIt.showToast('Copied!', 'success'); });
    });
  })();

  // =============================================
  // 22. BOX SHADOW GENERATOR
  // =============================================
  (function () {
    var preview = document.getElementById('shadow-preview');
    if (!preview) return;
    function update() {
      var x = document.getElementById('shd-x').value;
      var y = document.getElementById('shd-y').value;
      var blur = document.getElementById('shd-blur').value;
      var spread = document.getElementById('shd-spread').value;
      var color = document.getElementById('shd-color').value;
      var inset = document.getElementById('shd-inset').checked;
      document.getElementById('shd-x-val').textContent = x + 'px';
      document.getElementById('shd-y-val').textContent = y + 'px';
      document.getElementById('shd-blur-val').textContent = blur + 'px';
      document.getElementById('shd-spread-val').textContent = spread + 'px';
      var css = (inset ? 'inset ' : '') + x + 'px ' + y + 'px ' + blur + 'px ' + spread + 'px ' + color;
      preview.style.boxShadow = css;
      document.getElementById('shd-css-output').textContent = 'box-shadow: ' + css + ';';
    }
    ['shd-x', 'shd-y', 'shd-blur', 'shd-spread', 'shd-color', 'shd-inset'].forEach(function (id) {
      var el = document.getElementById(id);
      if (el) { el.addEventListener('input', update); el.addEventListener('change', update); }
    });
    update();
    document.getElementById('shd-copy').addEventListener('click', function () {
      navigator.clipboard.writeText(document.getElementById('shd-css-output').textContent).then(function () { EditIt.showToast('Copied!', 'success'); });
    });
  })();

  // =============================================
  // 23. PLACEHOLDER IMAGE GENERATOR
  // =============================================
  (function () {
    var btn = document.getElementById('placeholder-gen-btn');
    if (!btn) return;
    btn.addEventListener('click', async function () {
      var w = parseInt(document.getElementById('ph-width').value) || 400;
      var h = parseInt(document.getElementById('ph-height').value) || 300;
      var bg = document.getElementById('ph-bg').value;
      var fg = document.getElementById('ph-fg').value;
      var text = document.getElementById('ph-text').value || (w + '×' + h);
      var c = document.createElement('canvas'); c.width = w; c.height = h;
      var ctx = c.getContext('2d');
      ctx.fillStyle = bg; ctx.fillRect(0, 0, w, h);
      var size = Math.max(12, Math.min(w, h) / 8);
      ctx.font = 'bold ' + size + 'px Arial';
      ctx.fillStyle = fg; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(text, w / 2, h / 2);
      var blob = await new Promise(function (r) { c.toBlob(r, 'image/png'); });
      var out = document.getElementById('placeholder-image-output');
      var url = URL.createObjectURL(blob);
      out.innerHTML = '<div class="output-card"><h3>\u2713 Placeholder Created!</h3><p>' + w + '×' + h + ' • ' + EditIt.formatFileSize(blob.size) + '</p><img src="' + url + '" style="max-width:100%;border:1px solid var(--border);border-radius:8px;margin:12px 0"><div class="output-filename"><label>File name:</label><input type="text" class="input output-dl-name" value="placeholder_' + w + 'x' + h + '.png"></div><button class="btn btn-success output-dl-btn">Download</button></div>';
      out.querySelector('.output-dl-btn').addEventListener('click', function () { EditIt.downloadBlob(blob, out.querySelector('.output-dl-name').value || 'placeholder.png'); });
    });
  })();

  // =============================================
  // 24. ICO FILE GENERATOR
  // =============================================
  imgTool('ico-generator', null, async function (file, out) {
    var du = await EditIt.readFileAsDataURL(file);
    var img = await EditIt.loadImage(du);
    var sizes = [16, 32, 48];
    // Build ICO file
    var pngs = [];
    for (var i = 0; i < sizes.length; i++) {
      var s = sizes[i];
      var c = document.createElement('canvas'); c.width = s; c.height = s;
      c.getContext('2d').drawImage(img, 0, 0, s, s);
      var blob = await new Promise(function (r) { c.toBlob(r, 'image/png'); });
      pngs.push(await blob.arrayBuffer());
    }
    // ICO header
    var totalSize = 6 + sizes.length * 16;
    pngs.forEach(function (p) { totalSize += p.byteLength; });
    var buf = new ArrayBuffer(totalSize);
    var view = new DataView(buf);
    view.setUint16(0, 0, true); // reserved
    view.setUint16(2, 1, true); // type: ICO
    view.setUint16(4, sizes.length, true); // count
    var dataOffset = 6 + sizes.length * 16;
    for (var i = 0; i < sizes.length; i++) {
      var offset = 6 + i * 16;
      var s = sizes[i];
      view.setUint8(offset, s < 256 ? s : 0); // width
      view.setUint8(offset + 1, s < 256 ? s : 0); // height
      view.setUint8(offset + 2, 0); // color palette
      view.setUint8(offset + 3, 0); // reserved
      view.setUint16(offset + 4, 1, true); // color planes
      view.setUint16(offset + 6, 32, true); // bits per pixel
      view.setUint32(offset + 8, pngs[i].byteLength, true); // size
      view.setUint32(offset + 12, dataOffset, true); // offset
      new Uint8Array(buf, dataOffset).set(new Uint8Array(pngs[i]));
      dataOffset += pngs[i].byteLength;
    }
    var icoBlob = new Blob([buf], { type: 'image/x-icon' });
    dlCard(out, 'ICO Created!', sizes.join('×, ') + '× sizes • ' + EditIt.formatFileSize(icoBlob.size), icoBlob, 'favicon.ico');
    EditIt.showToast('ICO file created!', 'success');
  });

  // =============================================
  // 25. ASCII ART GENERATOR
  // =============================================
  imgTool('ascii-art', null, async function (file, out) {
    var du = await EditIt.readFileAsDataURL(file);
    var img = await EditIt.loadImage(du);
    var width = parseInt(document.getElementById('ascii-width').value) || 80;
    var chars = document.getElementById('ascii-chars').value || ' .:-=+*#%@';
    var aspect = img.naturalHeight / img.naturalWidth;
    var height = Math.round(width * aspect * 0.5);
    var c = document.createElement('canvas'); c.width = width; c.height = height;
    var ctx = c.getContext('2d');
    ctx.drawImage(img, 0, 0, width, height);
    var data = ctx.getImageData(0, 0, width, height).data;
    var ascii = '';
    for (var y = 0; y < height; y++) {
      for (var x = 0; x < width; x++) {
        var idx = (y * width + x) * 4;
        var brightness = (data[idx] + data[idx + 1] + data[idx + 2]) / 3;
        var charIdx = Math.floor((brightness / 255) * (chars.length - 1));
        ascii += chars[charIdx];
      }
      ascii += '\n';
    }
    out.innerHTML = '<div class="output-card"><h3>\u2713 ASCII Art!</h3><pre class="ascii-output">' + ascii.replace(/</g, '&lt;') + '</pre><div style="display:flex;gap:8px;margin-top:8px"><button class="btn btn-success" id="ascii-copy">Copy</button><button class="btn btn-outline" id="ascii-dl">Download .txt</button></div></div>';
    document.getElementById('ascii-copy').addEventListener('click', function () { navigator.clipboard.writeText(ascii).then(function () { EditIt.showToast('Copied!', 'success'); }); });
    document.getElementById('ascii-dl').addEventListener('click', function () { EditIt.downloadBlob(new Blob([ascii], { type: 'text/plain' }), 'ascii_art.txt'); });
  });

  // =============================================
  // 26. CHART MAKER
  // =============================================
  (function () {
    var btn = document.getElementById('chart-gen-btn');
    if (!btn) return;
    btn.addEventListener('click', async function () {
      var type = document.getElementById('chart-type').value;
      var dataStr = document.getElementById('chart-data').value.trim();
      var out = document.getElementById('chart-maker-output');
      if (!dataStr) { EditIt.showToast('Enter chart data', 'error'); return; }
      var lines = dataStr.split('\n').map(function (l) { return l.trim(); }).filter(Boolean);
      var labels = [], values = [];
      lines.forEach(function (l) {
        var parts = l.split(/[,\t:]+/);
        labels.push(parts[0].trim());
        values.push(parseFloat(parts[1]) || 0);
      });
      var max = Math.max.apply(null, values);
      var colors = ['#6366f1', '#f59e0b', '#10b981', '#ef4444', '#8b5cf6', '#06b6d4', '#f97316', '#ec4899', '#14b8a6', '#a855f7'];
      var c = document.createElement('canvas');
      var w = 700, h = 400, pad = 60;
      c.width = w; c.height = h;
      var ctx = c.getContext('2d');
      ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, w, h);
      if (type === 'bar') {
        var barW = (w - pad * 2) / values.length - 8;
        values.forEach(function (v, i) {
          var barH = (v / max) * (h - pad * 2 - 20);
          var x = pad + i * (barW + 8);
          var y = h - pad - barH;
          ctx.fillStyle = colors[i % colors.length];
          ctx.fillRect(x, y, barW, barH);
          ctx.fillStyle = '#333';
          ctx.font = '11px Arial';
          ctx.textAlign = 'center';
          ctx.fillText(labels[i], x + barW / 2, h - pad + 15);
          ctx.fillText(v, x + barW / 2, y - 5);
        });
      } else if (type === 'pie') {
        var total = values.reduce(function (a, b) { return a + b; }, 0);
        var angle = -Math.PI / 2;
        var cx = w / 2, cy = h / 2, r = Math.min(w, h) / 2 - pad;
        values.forEach(function (v, i) {
          var slice = (v / total) * Math.PI * 2;
          ctx.beginPath();
          ctx.moveTo(cx, cy);
          ctx.arc(cx, cy, r, angle, angle + slice);
          ctx.fillStyle = colors[i % colors.length];
          ctx.fill();
          // Label
          var mid = angle + slice / 2;
          var lx = cx + Math.cos(mid) * (r * 0.65);
          var ly = cy + Math.sin(mid) * (r * 0.65);
          ctx.fillStyle = '#fff';
          ctx.font = 'bold 12px Arial';
          ctx.textAlign = 'center';
          ctx.fillText(labels[i] + ' (' + Math.round(v / total * 100) + '%)', lx, ly);
          angle += slice;
        });
      } else {
        // Line chart
        var stepX = (w - pad * 2) / (values.length - 1);
        ctx.strokeStyle = '#ddd'; ctx.lineWidth = 1;
        for (var g = 0; g < 5; g++) {
          var gy = pad + g * ((h - pad * 2) / 4);
          ctx.beginPath(); ctx.moveTo(pad, gy); ctx.lineTo(w - pad, gy); ctx.stroke();
        }
        ctx.strokeStyle = colors[0]; ctx.lineWidth = 3;
        ctx.beginPath();
        values.forEach(function (v, i) {
          var x = pad + i * stepX;
          var y = h - pad - (v / max) * (h - pad * 2 - 20);
          if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
        });
        ctx.stroke();
        values.forEach(function (v, i) {
          var x = pad + i * stepX;
          var y = h - pad - (v / max) * (h - pad * 2 - 20);
          ctx.beginPath(); ctx.arc(x, y, 5, 0, Math.PI * 2); ctx.fillStyle = colors[0]; ctx.fill();
          ctx.fillStyle = '#333'; ctx.font = '11px Arial'; ctx.textAlign = 'center';
          ctx.fillText(labels[i], x, h - pad + 15);
          ctx.fillText(v, x, y - 10);
        });
      }
      var blob = await new Promise(function (r) { c.toBlob(r, 'image/png'); });
      var url = URL.createObjectURL(blob);
      out.innerHTML = '<div class="output-card"><h3>\u2713 Chart Created!</h3><img src="' + url + '" style="max-width:100%;border:1px solid var(--border);border-radius:8px;margin:12px 0"><div class="output-filename"><label>File name:</label><input type="text" class="input output-dl-name" value="chart.png"></div><button class="btn btn-success output-dl-btn">Download</button></div>';
      out.querySelector('.output-dl-btn').addEventListener('click', function () { EditIt.downloadBlob(blob, out.querySelector('.output-dl-name').value || 'chart.png'); });
    });
  })();

})();


// ===== file.tools — Batch 3: 28 Additional Tools =====
(function () {
  'use strict';

  function dlCard(el, title, info, blob, name, preview) {
    el.innerHTML = '<div class="output-card"><h3>\u2713 ' + title + '</h3><p>' + info + '</p>' + (preview || '') + '<div class="output-filename"><label>File name:</label><input type="text" class="input output-dl-name" value="' + name + '"></div><button class="btn btn-success output-dl-btn">Download</button></div>';
    el.querySelector('.output-dl-btn').addEventListener('click', function () { EditIt.downloadBlob(blob, el.querySelector('.output-dl-name').value.trim() || name); });
  }

  // 1. SOCIAL MEDIA RESIZER
  (function () {
    var sizes = { 'ig-post': [1080,1080], 'ig-story': [1080,1920], 'ig-landscape': [1080,566], 'fb-post': [1200,630], 'fb-cover': [820,312], 'tw-post': [1200,675], 'tw-header': [1500,500], 'li-post': [1200,627], 'li-banner': [1584,396], 'yt-thumb': [1280,720], 'yt-banner': [2560,1440] };
    var actionBtn = document.getElementById('social-resizer-action');
    if (!actionBtn) return;
    var file = null;
    document.addEventListener('files-added', function (e) {
      if (e.detail.toolId !== 'social-resizer') return;
      file = e.detail.files.find(function (f) { return f.type.startsWith('image/'); });
      if (!file) return;
      var fl = document.getElementById('social-resizer-files'); fl.innerHTML = '';
      var item = EditIt.createFileItem(file, 0);
      item.querySelector('.file-item-remove').addEventListener('click', function () { file = null; fl.innerHTML = ''; actionBtn.disabled = true; document.getElementById('social-resizer-options').style.display = 'none'; });
      fl.appendChild(item); actionBtn.disabled = false;
      document.getElementById('social-resizer-options').style.display = 'block';
    });
    actionBtn.addEventListener('click', async function () {
      if (!file) return; EditIt.setButtonLoading(actionBtn, true);
      try {
        var du = await EditIt.readImageAsDataURL(file);
        var img = await EditIt.loadImage(du);
        var key = document.getElementById('social-platform').value;
        var tw = sizes[key][0], th = sizes[key][1];
        var c = document.createElement('canvas'); c.width = tw; c.height = th;
        var ctx = c.getContext('2d');
        var scale = Math.max(tw / img.naturalWidth, th / img.naturalHeight);
        var dw = img.naturalWidth * scale, dh = img.naturalHeight * scale;
        ctx.drawImage(img, (tw - dw) / 2, (th - dh) / 2, dw, dh);
        var blob = await new Promise(function (r) { c.toBlob(r, 'image/png'); });
        dlCard(document.getElementById('social-resizer-output'), 'Resized!', tw + '×' + th + ' • ' + EditIt.formatFileSize(blob.size), blob, file.name.replace(/\.[^.]+$/, '') + '_' + key + '.png');
        EditIt.showToast('Image resized!', 'success');
      } catch (err) { EditIt.showToast('Error: ' + err.message, 'error'); }
      EditIt.setButtonLoading(actionBtn, false);
    });
  })();

  // 2. WHITEBOARD
  (function () {
    var canvas = document.getElementById('wb-canvas');
    if (!canvas) return;
    var ctx = canvas.getContext('2d');
    ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, canvas.width, canvas.height);
    var drawing = false;
    function getPos(e) { var r = canvas.getBoundingClientRect(); var ev = e.touches ? e.touches[0] : e; return { x: ev.clientX - r.left, y: ev.clientY - r.top }; }
    function startDraw(e) { drawing = true; var p = getPos(e); ctx.beginPath(); ctx.moveTo(p.x, p.y); }
    function draw(e) {
      if (!drawing) return; e.preventDefault();
      var p = getPos(e);
      var tool = document.getElementById('wb-tool').value;
      ctx.lineWidth = document.getElementById('wb-size').value;
      ctx.lineCap = 'round'; ctx.lineJoin = 'round';
      ctx.strokeStyle = tool === 'eraser' ? '#ffffff' : document.getElementById('wb-color').value;
      ctx.lineTo(p.x, p.y); ctx.stroke();
    }
    function stopDraw() { drawing = false; }
    canvas.addEventListener('mousedown', startDraw); canvas.addEventListener('mousemove', draw); canvas.addEventListener('mouseup', stopDraw); canvas.addEventListener('mouseleave', stopDraw);
    canvas.addEventListener('touchstart', startDraw, { passive: false }); canvas.addEventListener('touchmove', draw, { passive: false }); canvas.addEventListener('touchend', stopDraw);
    document.getElementById('wb-clear').addEventListener('click', function () { ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, canvas.width, canvas.height); });
    document.getElementById('wb-download').addEventListener('click', function () { canvas.toBlob(function (b) { EditIt.downloadBlob(b, 'whiteboard.png'); }, 'image/png'); });
  })();

  // 3. TEXT LOGO MAKER
  (function () {
    var btn = document.getElementById('tl-generate');
    if (!btn) return;
    btn.addEventListener('click', async function () {
      var text = document.getElementById('tl-text').value || 'Logo';
      var size = parseInt(document.getElementById('tl-size').value) || 72;
      var font = document.getElementById('tl-font').value;
      var color = document.getElementById('tl-color').value;
      var bg = document.getElementById('tl-bg').value;
      var transparent = document.getElementById('tl-transparent').checked;
      var c = document.createElement('canvas');
      var tmpCtx = c.getContext('2d');
      tmpCtx.font = 'bold ' + size + 'px ' + font;
      var m = tmpCtx.measureText(text);
      c.width = m.width + size; c.height = size * 1.8;
      var ctx = c.getContext('2d');
      if (!transparent) { ctx.fillStyle = bg; ctx.fillRect(0, 0, c.width, c.height); }
      ctx.font = 'bold ' + size + 'px ' + font;
      ctx.fillStyle = color; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(text, c.width / 2, c.height / 2);
      var blob = await new Promise(function (r) { c.toBlob(r, 'image/png'); });
      var out = document.getElementById('text-logo-output');
      var url = URL.createObjectURL(blob);
      out.innerHTML = '<div class="output-card"><h3>\u2713 Logo Created!</h3><img src="' + url + '" style="max-width:100%;border:1px solid var(--border);border-radius:8px;margin:12px 0"><div class="output-filename"><label>File name:</label><input type="text" class="input output-dl-name" value="logo.png"></div><button class="btn btn-success output-dl-btn">Download</button></div>';
      out.querySelector('.output-dl-btn').addEventListener('click', function () { EditIt.downloadBlob(blob, out.querySelector('.output-dl-name').value || 'logo.png'); });
    });
  })();

  // 4. COLOR CONTRAST CHECKER
  (function () {
    var fg = document.getElementById('cc2-fg'), bg = document.getElementById('cc2-bg');
    if (!fg) return;
    function hexToRgb(hex) { hex = hex.replace('#', ''); return [parseInt(hex.substr(0,2),16), parseInt(hex.substr(2,2),16), parseInt(hex.substr(4,2),16)]; }
    function luminance(r,g,b) { var a = [r,g,b].map(function(v){ v/=255; return v<=0.03928?v/12.92:Math.pow((v+0.055)/1.055,2.4); }); return a[0]*0.2126+a[1]*0.7152+a[2]*0.0722; }
    function contrast(c1,c2) { var l1 = luminance(c1[0],c1[1],c1[2])+0.05, l2 = luminance(c2[0],c2[1],c2[2])+0.05; return l1>l2?l1/l2:l2/l1; }
    function update() {
      var fgC = hexToRgb(fg.value), bgC = hexToRgb(bg.value);
      var ratio = contrast(fgC, bgC);
      var preview = document.getElementById('cc2-preview');
      preview.style.color = fg.value; preview.style.background = bg.value;
      var aa = ratio >= 4.5 ? 'PASS' : 'FAIL', aaL = ratio >= 3 ? 'PASS' : 'FAIL';
      var aaa = ratio >= 7 ? 'PASS' : 'FAIL', aaaL = ratio >= 4.5 ? 'PASS' : 'FAIL';
      document.getElementById('color-contrast-output').innerHTML = '<div class="output-card"><h3>Contrast Ratio: ' + ratio.toFixed(2) + ':1</h3><div class="stat-grid"><div class="stat-card"><div class="stat-num" style="color:' + (aa==='PASS'?'var(--success)':'var(--danger)') + '">' + aa + '</div><div class="stat-label">AA Normal</div></div><div class="stat-card"><div class="stat-num" style="color:' + (aaL==='PASS'?'var(--success)':'var(--danger)') + '">' + aaL + '</div><div class="stat-label">AA Large</div></div><div class="stat-card"><div class="stat-num" style="color:' + (aaa==='PASS'?'var(--success)':'var(--danger)') + '">' + aaa + '</div><div class="stat-label">AAA Normal</div></div><div class="stat-card"><div class="stat-num" style="color:' + (aaaL==='PASS'?'var(--success)':'var(--danger)') + '">' + aaaL + '</div><div class="stat-label">AAA Large</div></div></div></div>';
    }
    fg.addEventListener('input', update); bg.addEventListener('input', update);
    update();
  })();

  // 5. BARCODE GENERATOR (Code128 subset B)
  (function () {
    var btn = document.getElementById('bc-generate');
    if (!btn) return;
    btn.addEventListener('click', function () {
      var text = document.getElementById('bc-input').value;
      var out = document.getElementById('barcode-gen-output');
      if (!text) { EditIt.showToast('Enter text', 'error'); return; }
      var barW = parseInt(document.getElementById('bc-width').value) || 2;
      var barH = parseInt(document.getElementById('bc-height').value) || 80;
      // Simple Code128B encoding
      var PATTERNS = ['11011001100','11001101100','11001100110','10010011000','10010001100','10001001100','10011001000','10011000100','10001100100','11001001000','11001000100','11000100100','10110011100','10011011100','10011001110','10111001100','10011101100','10011100110','11001110010','11001011100','11000101110','11011100100','11001110100','11001110010','11010010000','11010000100','11000010100','10100110000','10010011000','10010000110','10000101100','10000100110','10110010000','10110000100','10011010000','10011000010','10000110100','10000110010','11010110000','11010000110','11000010110','10100011000','10001011000','10001000110','10110001000','10001101000','10001100010','11010001000','11000010010','11011000010','11000111010','10100110000','11010110000','11000110100','10011000010','11110111010','11000110010','10100011000'];
      var START_B = 104;
      var indices = [START_B];
      var checksum = START_B;
      for (var i = 0; i < text.length; i++) {
        var idx = text.charCodeAt(i) - 32;
        if (idx < 0 || idx > 94) idx = 0;
        indices.push(idx);
        checksum += idx * (i + 1);
      }
      indices.push(checksum % 103);
      indices.push(106); // STOP
      var binary = '';
      indices.forEach(function (idx) { binary += PATTERNS[idx] || PATTERNS[0]; });
      binary += '11'; // final bar
      var c = document.createElement('canvas');
      c.width = binary.length * barW + 40;
      c.height = barH + 30;
      var ctx = c.getContext('2d');
      ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, c.width, c.height);
      ctx.fillStyle = '#000';
      for (var b = 0; b < binary.length; b++) {
        if (binary[b] === '1') ctx.fillRect(20 + b * barW, 5, barW, barH);
      }
      ctx.font = '12px Arial'; ctx.textAlign = 'center';
      ctx.fillText(text, c.width / 2, barH + 20);
      c.toBlob(function (blob) {
        var url = URL.createObjectURL(blob);
        out.innerHTML = '<div class="output-card"><h3>\u2713 Barcode Generated!</h3><img src="' + url + '" style="margin:12px 0"><div class="output-filename"><label>File name:</label><input type="text" class="input output-dl-name" value="barcode.png"></div><button class="btn btn-success output-dl-btn">Download</button></div>';
        out.querySelector('.output-dl-btn').addEventListener('click', function () { EditIt.downloadBlob(blob, out.querySelector('.output-dl-name').value || 'barcode.png'); });
      }, 'image/png');
    });
  })();

  // 6. PATTERN GENERATOR
  (function () {
    var preview = document.getElementById('pat-preview');
    if (!preview) return;
    function generate() {
      var type = document.getElementById('pat-type').value;
      var size = parseInt(document.getElementById('pat-size').value) || 24;
      var c1 = document.getElementById('pat-c1').value, c2 = document.getElementById('pat-c2').value;
      var c = document.createElement('canvas'); c.width = size; c.height = size;
      var ctx = c.getContext('2d');
      ctx.fillStyle = c2; ctx.fillRect(0, 0, size, size);
      ctx.fillStyle = c1;
      if (type === 'stripes') { ctx.beginPath(); ctx.moveTo(0, size); ctx.lineTo(size, 0); ctx.lineTo(size, size/4); ctx.lineTo(size/4, size); ctx.fill(); ctx.beginPath(); ctx.moveTo(0, size*0.5); ctx.lineTo(size*0.5, 0); ctx.lineTo(0, 0); ctx.fill(); }
      else if (type === 'dots') { ctx.beginPath(); ctx.arc(size/2, size/2, size/5, 0, Math.PI*2); ctx.fill(); }
      else if (type === 'grid') { ctx.fillRect(0, 0, 1, size); ctx.fillRect(0, 0, size, 1); }
      else if (type === 'checkers') { ctx.fillRect(0, 0, size/2, size/2); ctx.fillRect(size/2, size/2, size/2, size/2); }
      else if (type === 'zigzag') { ctx.beginPath(); ctx.moveTo(0,size); ctx.lineTo(size/2,0); ctx.lineTo(size,size); ctx.lineWidth=2; ctx.strokeStyle=c1; ctx.stroke(); }
      var dataUrl = c.toDataURL();
      preview.style.backgroundImage = 'url(' + dataUrl + ')';
      preview.style.backgroundRepeat = 'repeat';
      preview.style.backgroundSize = size + 'px ' + size + 'px';
      preview._canvas = c; preview._css = 'background-image:url(' + dataUrl + ');background-repeat:repeat;background-size:' + size + 'px ' + size + 'px;';
    }
    ['pat-type','pat-size','pat-c1','pat-c2'].forEach(function(id) { var el = document.getElementById(id); if(el) { el.addEventListener('input', generate); el.addEventListener('change', generate); } });
    generate();
    document.getElementById('pat-download').addEventListener('click', function () {
      var big = document.createElement('canvas'); big.width = 512; big.height = 512;
      var bctx = big.getContext('2d');
      var pat = bctx.createPattern(preview._canvas, 'repeat');
      bctx.fillStyle = pat; bctx.fillRect(0, 0, 512, 512);
      big.toBlob(function (b) { EditIt.downloadBlob(b, 'pattern.png'); }, 'image/png');
    });
    document.getElementById('pat-copy-css').addEventListener('click', function () {
      navigator.clipboard.writeText(preview._css).then(function () { EditIt.showToast('CSS copied!', 'success'); });
    });
  })();

  // 7. GIF FROM IMAGES
  (function () {
    var actionBtn = document.getElementById('gif-from-images-action');
    if (!actionBtn) return;
    var files = [], fileListEl = document.getElementById('gif-from-images-files');
    document.addEventListener('files-added', function (e) {
      if (e.detail.toolId !== 'gif-from-images') return;
      files = files.concat(e.detail.files.filter(function(f){return f.type.startsWith('image/');}));
      fileListEl.innerHTML = '';
      files.forEach(function (f, i) { var item = EditIt.createFileItem(f, i); item.querySelector('.file-item-remove').addEventListener('click', function () { files.splice(i, 1); fileListEl.innerHTML = ''; actionBtn.disabled = files.length < 2; }); fileListEl.appendChild(item); });
      actionBtn.disabled = files.length < 2;
      document.getElementById('gif-from-images-options').style.display = 'block';
    });
    actionBtn.addEventListener('click', async function () {
      if (files.length < 2) return; EditIt.setButtonLoading(actionBtn, true);
      try {
        var delay = parseInt(document.getElementById('gfi-delay').value) || 200;
        var gw = parseInt(document.getElementById('gfi-width').value) || 480;
        var imgs = [];
        for (var i = 0; i < files.length; i++) {
          var du = await EditIt.readImageAsDataURL(files[i]);
          imgs.push(await EditIt.loadImage(du));
        }
        var gh = Math.round(gw * (imgs[0].naturalHeight / imgs[0].naturalWidth));
        var canvas = document.createElement('canvas'); canvas.width = gw; canvas.height = gh;
        var ctx = canvas.getContext('2d');
        var frames = [];
        for (var j = 0; j < imgs.length; j++) {
          EditIt.showProgress('Processing frame ' + (j+1), (j/imgs.length)*90);
          ctx.clearRect(0,0,gw,gh);
          ctx.drawImage(imgs[j], 0, 0, gw, gh);
          frames.push(ctx.getImageData(0, 0, gw, gh));
        }
        EditIt.showProgress('Encoding GIF...', 95);
        // Reuse existing GIF encoder from video-to-gif section
        var buf = []; function w16(v){buf.push(v&0xFF,(v>>8)&0xFF);}
        [0x47,0x49,0x46,0x38,0x39,0x61].forEach(function(b){buf.push(b);}); w16(gw);w16(gh);buf.push(0x70,0,0);
        buf.push(0x21,0xFF,0x0B);[0x4E,0x45,0x54,0x53,0x43,0x41,0x50,0x45,0x32,0x2E,0x30].forEach(function(b){buf.push(b);});buf.push(0x03,0x01);w16(0);buf.push(0x00);
        frames.forEach(function(frame){var pixels=frame.data;var colorMap={};var palette=[];var indexed=new Uint8Array(gw*gh);for(var i=0;i<pixels.length;i+=4){var r=pixels[i]>>4<<4,g=pixels[i+1]>>4<<4,b=pixels[i+2]>>4<<4;var key=(r<<16)|(g<<8)|b;if(!(key in colorMap)){if(palette.length<256){colorMap[key]=palette.length;palette.push([r,g,b]);}else{colorMap[key]=0;}}indexed[i/4]=colorMap[key];}while(palette.length<256)palette.push([0,0,0]);buf.push(0x21,0xF9,0x04,0x00);w16(Math.round(delay/10));buf.push(0x00,0x00);buf.push(0x2C);w16(0);w16(0);w16(gw);w16(gh);buf.push(0x87);palette.forEach(function(c){buf.push(c[0],c[1],c[2]);});buf.push(8);var clearCode=256,eoi=257,codeSize=9,nextCode=258;var dict={};for(var k=0;k<256;k++)dict[k]=k;var out2=[],bits=0,bf=0;function emit(code){bf|=code<<bits;bits+=codeSize;while(bits>=8){out2.push(bf&0xFF);bf>>=8;bits-=8;}}emit(clearCode);var prev=indexed[0];for(var j=1;j<indexed.length;j++){var curr=indexed[j];var ky=prev+','+curr;if(ky in dict){prev=dict[ky];}else{emit(prev);if(nextCode<4096){dict[ky]=nextCode++;if(nextCode>(1<<codeSize)&&codeSize<12)codeSize++;}else{emit(clearCode);dict={};for(var m=0;m<256;m++)dict[m]=m;nextCode=eoi+1;codeSize=9;}prev=curr;}}emit(prev);emit(eoi);if(bits>0)out2.push(bf&0xFF);var pos=0;while(pos<out2.length){var chunk=Math.min(255,out2.length-pos);buf.push(chunk);for(var n=0;n<chunk;n++)buf.push(out2[pos++]);}buf.push(0x00);});
        buf.push(0x3B);
        var blob = new Blob([new Uint8Array(buf)], { type: 'image/gif' });
        EditIt.hideProgress();
        var url = URL.createObjectURL(blob);
        var out = document.getElementById('gif-from-images-output');
        out.innerHTML = '<div class="output-card"><h3>\u2713 GIF Created!</h3><p>' + frames.length + ' frames • ' + EditIt.formatFileSize(blob.size) + '</p><img src="' + url + '" style="max-width:100%;border:1px solid var(--border);border-radius:8px;margin:12px 0"><div class="output-filename"><label>File name:</label><input type="text" class="input output-dl-name" value="animation.gif"></div><button class="btn btn-success output-dl-btn">Download</button></div>';
        out.querySelector('.output-dl-btn').addEventListener('click', function(){EditIt.downloadBlob(blob, out.querySelector('.output-dl-name').value||'animation.gif');});
        EditIt.showToast('GIF created!', 'success');
      } catch (err) { EditIt.hideProgress(); EditIt.showToast('Error: ' + err.message, 'error'); }
      EditIt.setButtonLoading(actionBtn, false);
    });
  })();

  // 8. LINE SORTER
  (function () {
    document.querySelectorAll('.ls-btn').forEach(function (b) {
      b.addEventListener('click', function () {
        var input = document.getElementById('ls-input').value;
        var lines = input.split('\n');
        var action = b.dataset.action;
        if (action === 'az') lines.sort(function(a,b){return a.localeCompare(b);});
        else if (action === 'za') lines.sort(function(a,b){return b.localeCompare(a);});
        else if (action === 'num') lines.sort(function(a,b){return parseFloat(a)||0 - (parseFloat(b)||0);});
        else if (action === 'dedup') lines = [...new Set(lines)];
        else if (action === 'shuffle') { for(var i=lines.length-1;i>0;i--){var j=Math.floor(Math.random()*(i+1));var t=lines[i];lines[i]=lines[j];lines[j]=t;} }
        else if (action === 'reverse') lines.reverse();
        else if (action === 'trim') lines = lines.map(function(l){return l.trim();});
        else if (action === 'empty') lines = lines.filter(function(l){return l.trim()!=='';});
        var result = lines.join('\n');
        document.getElementById('line-sorter-output').innerHTML = '<div class="ocr-text-output">' + result.replace(/</g,'&lt;') + '</div><button class="btn btn-success ls-copy" style="margin-top:8px">Copy</button>';
        document.querySelector('.ls-copy').addEventListener('click', function(){navigator.clipboard.writeText(result).then(function(){EditIt.showToast('Copied!','success');});});
      });
    });
  })();

  // 9. TEXT REPEATER
  (function () {
    var btn = document.getElementById('tr-go');
    if (!btn) return;
    btn.addEventListener('click', function () {
      var text = document.getElementById('tr-text').value;
      var count = parseInt(document.getElementById('tr-count').value) || 10;
      var sep = document.getElementById('tr-sep').value.replace(/\\n/g, '\n');
      if (!text) { EditIt.showToast('Enter text', 'error'); return; }
      var result = Array(count).fill(text).join(sep);
      document.getElementById('text-repeater-output').innerHTML = '<div class="ocr-text-output">' + result.substring(0,5000).replace(/</g,'&lt;') + '</div><button class="btn btn-success" id="tr-copy" style="margin-top:8px">Copy</button>';
      document.getElementById('tr-copy').addEventListener('click', function(){navigator.clipboard.writeText(result).then(function(){EditIt.showToast('Copied!','success');});});
    });
  })();

  // 10. FIND & REPLACE
  (function () {
    var btn = document.getElementById('fr-go');
    if (!btn) return;
    btn.addEventListener('click', function () {
      var text = document.getElementById('fr-text').value;
      var find = document.getElementById('fr-find').value;
      var replace = document.getElementById('fr-replace').value;
      var useRegex = document.getElementById('fr-regex').checked;
      if (!text || !find) { EditIt.showToast('Enter text and search term', 'error'); return; }
      try {
        var re = useRegex ? new RegExp(find, 'g') : new RegExp(find.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g');
        var count = (text.match(re) || []).length;
        var result = text.replace(re, replace);
        document.getElementById('find-replace-output').innerHTML = '<div class="output-card"><h3>\u2713 ' + count + ' replacements made</h3><div class="ocr-text-output">' + result.replace(/</g,'&lt;') + '</div><button class="btn btn-success" id="fr-copy" style="margin-top:8px">Copy</button></div>';
        document.getElementById('fr-copy').addEventListener('click', function(){navigator.clipboard.writeText(result).then(function(){EditIt.showToast('Copied!','success');});});
      } catch (e) { EditIt.showToast('Regex error: ' + e.message, 'error'); }
    });
  })();

  // 11. FAKE DATA GENERATOR
  (function () {
    var btn = document.getElementById('fd-go');
    if (!btn) return;
    var firstNames = ['James','Mary','John','Patricia','Robert','Jennifer','Michael','Linda','David','Elizabeth','William','Barbara','Richard','Susan','Joseph','Jessica','Thomas','Sarah','Christopher','Karen','Emma','Olivia','Liam','Noah','Sophia','Ava','Isabella','Mia','Charlotte','Amelia'];
    var lastNames = ['Smith','Johnson','Williams','Brown','Jones','Garcia','Miller','Davis','Rodriguez','Martinez','Hernandez','Lopez','Gonzalez','Wilson','Anderson','Thomas','Taylor','Moore','Jackson','Martin','Lee','Perez','Thompson','White','Harris','Sanchez','Clark','Ramirez','Lewis','Robinson'];
    var domains = ['gmail.com','yahoo.com','outlook.com','proton.me','company.com','work.org'];
    var streets = ['Main St','Oak Ave','Elm St','Park Dr','Cedar Ln','Maple Rd','Pine St','Lake Ave','Hill Dr','River Rd'];
    var cities = ['New York','Los Angeles','Chicago','Houston','Phoenix','San Antonio','Dallas','San Jose','Austin','San Francisco','Seattle','Denver','Boston','Miami','Portland'];
    var companies = ['Acme Corp','TechStart Inc','Digital Wave','Cloud Nine Labs','Pixel Perfect','DataFlow Systems','NovaTech','BlueSky Solutions','GreenLeaf Co','QuantumEdge'];
    function rnd(arr) { return arr[Math.floor(Math.random()*arr.length)]; }
    function rndNum(min,max) { return Math.floor(Math.random()*(max-min+1))+min; }
    btn.addEventListener('click', function () {
      var type = document.getElementById('fd-type').value;
      var count = parseInt(document.getElementById('fd-count').value) || 5;
      var out = document.getElementById('fake-data-output');
      var html = '<div class="output-card"><h3>\u2713 ' + count + ' Records Generated</h3><table class="exif-table">';
      for (var i = 0; i < count; i++) {
        if (type === 'person') {
          var fn = rnd(firstNames), ln = rnd(lastNames);
          html += '<tr><td><strong>' + fn + ' ' + ln + '</strong></td><td>' + fn.toLowerCase() + '.' + ln.toLowerCase() + '@' + rnd(domains) + '</td><td>+1 ' + rndNum(200,999) + ' ' + rndNum(100,999) + ' ' + rndNum(1000,9999) + '</td></tr>';
        } else if (type === 'address') {
          html += '<tr><td>' + rndNum(1,9999) + ' ' + rnd(streets) + '</td><td>' + rnd(cities) + '</td><td>' + rndNum(10000,99999) + '</td></tr>';
        } else {
          html += '<tr><td><strong>' + rnd(companies) + '</strong></td><td>Founded ' + rndNum(1990,2023) + '</td><td>' + rndNum(5,5000) + ' employees</td></tr>';
        }
      }
      html += '</table><button class="btn btn-outline" id="fd-copy" style="margin-top:8px">Copy as JSON</button></div>';
      out.innerHTML = html;
      document.getElementById('fd-copy').addEventListener('click', function(){
        var rows = out.querySelectorAll('tr');
        var data = []; rows.forEach(function(r){var cells=[]; r.querySelectorAll('td').forEach(function(c){cells.push(c.textContent);}); data.push(cells);});
        navigator.clipboard.writeText(JSON.stringify(data,null,2)).then(function(){EditIt.showToast('Copied!','success');});
      });
    });
  })();

  // 12. TYPING SPEED TEST
  (function () {
    var startBtn = document.getElementById('tt-start'), resetBtn = document.getElementById('tt-reset');
    if (!startBtn) return;
    var passages = ['The quick brown fox jumps over the lazy dog. Pack my box with five dozen liquor jugs. How vexingly quick daft zebras jump. The five boxing wizards jump quickly.', 'Programming is the art of telling another human being what one wants the computer to do. Software is a great combination between artistry and engineering.', 'In the beginning there was nothing, which exploded. Time is a drug. Too much of it kills you. The ships hung in the sky in much the same way that bricks do not.'];
    var passage, startTime, timer, done;
    startBtn.addEventListener('click', function () {
      passage = passages[Math.floor(Math.random()*passages.length)];
      document.getElementById('tt-passage').textContent = passage;
      document.getElementById('tt-input').value = ''; document.getElementById('tt-input').disabled = false; document.getElementById('tt-input').focus();
      startTime = null; done = false;
      startBtn.style.display = 'none'; resetBtn.style.display = 'inline-flex';
      document.getElementById('tt-wpm').textContent = '0'; document.getElementById('tt-acc').textContent = '0%'; document.getElementById('tt-time').textContent = '0s';
    });
    resetBtn.addEventListener('click', function () {
      clearInterval(timer); document.getElementById('tt-input').disabled = true;
      startBtn.style.display = 'inline-flex'; resetBtn.style.display = 'none';
      document.getElementById('tt-passage').textContent = ''; document.getElementById('tt-input').value = '';
    });
    document.getElementById('tt-input').addEventListener('input', function () {
      if (done) return;
      if (!startTime) { startTime = Date.now(); timer = setInterval(updateStats, 500); }
      var typed = this.value;
      if (typed.length >= passage.length) { done = true; clearInterval(timer); updateStats(); EditIt.showToast('Test complete!', 'success'); }
    });
    function updateStats() {
      var elapsed = (Date.now() - startTime) / 1000;
      var typed = document.getElementById('tt-input').value;
      var words = typed.trim().split(/\s+/).length;
      var wpm = Math.round((words / elapsed) * 60) || 0;
      var correct = 0;
      for (var i = 0; i < typed.length; i++) { if (typed[i] === passage[i]) correct++; }
      var acc = typed.length ? Math.round((correct / typed.length) * 100) : 0;
      document.getElementById('tt-wpm').textContent = wpm;
      document.getElementById('tt-acc').textContent = acc + '%';
      document.getElementById('tt-time').textContent = Math.round(elapsed) + 's';
    }
  })();

  // 13. EMOJI SEARCH
  (function () {
    var input = document.getElementById('emo-search');
    if (!input) return;
    var emojis = [['😀','grinning'],['😂','joy laughing'],['🥹','holding tears'],['😍','heart eyes love'],['🥰','smiling hearts'],['😎','cool sunglasses'],['🤔','thinking'],['😱','scream shocked'],['🥳','party'],['😴','sleeping'],['🤮','vomit'],['🤡','clown'],['👻','ghost'],['💀','skull dead'],['👽','alien'],['🤖','robot'],['💩','poop'],['❤️','red heart love'],['🧡','orange heart'],['💛','yellow heart'],['💚','green heart'],['💙','blue heart'],['💜','purple heart'],['🖤','black heart'],['🤍','white heart'],['💔','broken heart'],['🔥','fire hot'],['⭐','star'],['🌟','glowing star'],['✨','sparkles'],['⚡','lightning zap'],['💡','lightbulb idea'],['🎉','party celebration'],['🎊','confetti'],['🏆','trophy winner'],['🥇','gold medal first'],['🎯','target bullseye'],['🚀','rocket launch'],['✅','check mark done'],['❌','cross mark wrong'],['⚠️','warning'],['🔴','red circle'],['🟢','green circle'],['🔵','blue circle'],['👍','thumbs up like'],['👎','thumbs down dislike'],['👏','clapping'],['🤝','handshake'],['✌️','peace victory'],['🤞','fingers crossed'],['💪','strong muscle'],['🙏','pray please'],['👋','wave hello bye'],['📱','phone mobile'],['💻','laptop computer'],['⌨️','keyboard'],['🖥️','desktop computer'],['🔗','link chain'],['📧','email'],['📅','calendar date'],['📊','chart graph'],['📈','trending up'],['📉','trending down'],['🔒','lock secure'],['🔓','unlock'],['🔑','key'],['🛡️','shield'],['⚙️','gear settings'],['🔧','wrench tool'],['🔨','hammer'],['🗑️','trash delete'],['📁','folder'],['📄','document page'],['✏️','pencil edit'],['🖊️','pen'],['📌','pin'],['🔍','search magnify'],['💬','speech bubble chat'],['🌍','earth globe world'],['🌈','rainbow'],['☀️','sun'],['🌙','moon night'],['⛅','cloud sun'],['🌧️','rain'],['❄️','snowflake cold'],['🌊','wave ocean'],['🍕','pizza food'],['🍔','burger food'],['☕','coffee'],['🍺','beer'],['🎵','music note'],['🎶','music notes'],['🎮','game controller'],['🎨','art palette paint'],['📸','camera photo'],['🎥','video camera film'],['🎬','clapperboard movie']];
    function render(filter) {
      var grid = document.getElementById('emo-grid');
      var html = '';
      emojis.forEach(function (e) {
        if (filter && !e[1].includes(filter) && !e[0].includes(filter)) return;
        html += '<span class="emoji-item" data-emoji="' + e[0] + '" title="' + e[1] + '">' + e[0] + '</span>';
      });
      grid.innerHTML = html;
      grid.querySelectorAll('.emoji-item').forEach(function (el) {
        el.addEventListener('click', function () { navigator.clipboard.writeText(el.dataset.emoji).then(function () { document.getElementById('emo-copied').textContent = 'Copied: ' + el.dataset.emoji; EditIt.showToast('Copied ' + el.dataset.emoji, 'success'); }); });
      });
    }
    render('');
    input.addEventListener('input', function () { render(input.value.toLowerCase().trim()); });
  })();

  // 14. HTML → MARKDOWN
  (function () {
    var btn = document.getElementById('h2m-go');
    if (!btn) return;
    btn.addEventListener('click', function () {
      var html = document.getElementById('h2m-input').value;
      if (!html.trim()) { EditIt.showToast('Paste HTML', 'error'); return; }
      var md = html.replace(/<h1[^>]*>(.*?)<\/h1>/gi, '# $1\n').replace(/<h2[^>]*>(.*?)<\/h2>/gi, '## $1\n').replace(/<h3[^>]*>(.*?)<\/h3>/gi, '### $1\n').replace(/<h4[^>]*>(.*?)<\/h4>/gi, '#### $1\n').replace(/<strong[^>]*>(.*?)<\/strong>/gi, '**$1**').replace(/<b[^>]*>(.*?)<\/b>/gi, '**$1**').replace(/<em[^>]*>(.*?)<\/em>/gi, '*$1*').replace(/<i[^>]*>(.*?)<\/i>/gi, '*$1*').replace(/<a[^>]*href="([^"]*)"[^>]*>(.*?)<\/a>/gi, '[$2]($1)').replace(/<img[^>]*src="([^"]*)"[^>]*alt="([^"]*)"[^>]*/gi, '![$2]($1)').replace(/<br\s*\/?>/gi, '\n').replace(/<li[^>]*>(.*?)<\/li>/gi, '- $1\n').replace(/<code[^>]*>(.*?)<\/code>/gi, '`$1`').replace(/<blockquote[^>]*>(.*?)<\/blockquote>/gi, '> $1\n').replace(/<p[^>]*>(.*?)<\/p>/gi, '$1\n\n').replace(/<hr\s*\/?>/gi, '---\n').replace(/<[^>]+>/g, '').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&nbsp;/g, ' ').replace(/\n{3,}/g, '\n\n').trim();
      document.getElementById('html-to-md-output').innerHTML = '<div class="output-card"><h3>\u2713 Converted!</h3><div class="ocr-text-output" style="text-align:left;white-space:pre-wrap">' + md.replace(/</g,'&lt;') + '</div><button class="btn btn-success" id="h2m-copy" style="margin-top:8px">Copy</button></div>';
      document.getElementById('h2m-copy').addEventListener('click', function(){navigator.clipboard.writeText(md).then(function(){EditIt.showToast('Copied!','success');});});
    });
  })();

  // 15. TEXT TO HANDWRITING
  (function () {
    var btn = document.getElementById('hw-go');
    if (!btn) return;
    btn.addEventListener('click', async function () {
      var text = document.getElementById('hw-input').value;
      if (!text.trim()) { EditIt.showToast('Enter text', 'error'); return; }
      var color = document.getElementById('hw-color').value;
      var size = parseInt(document.getElementById('hw-size').value) || 22;
      var lineH = size * 1.8;
      var lines = text.split('\n');
      var c = document.createElement('canvas'); c.width = 800; c.height = Math.max(400, lines.length * lineH + 80);
      var ctx = c.getContext('2d');
      // Paper background
      ctx.fillStyle = '#fef9ef'; ctx.fillRect(0, 0, c.width, c.height);
      // Ruled lines
      ctx.strokeStyle = '#d4c5a9'; ctx.lineWidth = 0.5;
      for (var i = 0; i < c.height; i += lineH) { ctx.beginPath(); ctx.moveTo(40, 60 + i); ctx.lineTo(c.width - 40, 60 + i); ctx.stroke(); }
      // Red margin line
      ctx.strokeStyle = '#e8a0a0'; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(70, 0); ctx.lineTo(70, c.height); ctx.stroke();
      // Text
      ctx.fillStyle = color;
      ctx.font = size + 'px "Segoe Script", "Comic Sans MS", cursive';
      lines.forEach(function (line, idx) {
        var x = 80;
        for (var j = 0; j < line.length; j++) {
          var jitter = (Math.random() - 0.5) * 2;
          ctx.fillText(line[j], x, 56 + idx * lineH + jitter);
          x += ctx.measureText(line[j]).width + (Math.random() - 0.5) * 1;
        }
      });
      var blob = await new Promise(function (r) { c.toBlob(r, 'image/png'); });
      var out = document.getElementById('text-to-handwriting-output');
      dlCard(out, 'Handwriting Generated!', EditIt.formatFileSize(blob.size), blob, 'handwriting.png', '<img src="' + URL.createObjectURL(blob) + '" style="max-width:100%;border:1px solid var(--border);border-radius:8px;margin:12px 0">');
      EditIt.showToast('Handwriting generated!', 'success');
    });
  })();

  // 16. INVOICE GENERATOR
  (function () {
    var btn = document.getElementById('inv-go');
    if (!btn) return;
    btn.addEventListener('click', async function () {
      EditIt.setButtonLoading(btn, true);
      try {
        var PDFDoc = PDFLib.PDFDocument, SF = PDFLib.StandardFonts, rgb = PDFLib.rgb;
        var pdf = await PDFDoc.create();
        var font = await pdf.embedFont(SF.Helvetica);
        var bold = await pdf.embedFont(SF.HelveticaBold);
        var page = pdf.addPage([595, 842]);
        var from = document.getElementById('inv-from').value || 'Your Company';
        var to = document.getElementById('inv-to').value || 'Client';
        var num = document.getElementById('inv-num').value || 'INV-001';
        var date = document.getElementById('inv-date').value || new Date().toLocaleDateString();
        var notes = document.getElementById('inv-notes').value || '';
        var itemsRaw = document.getElementById('inv-items').value.trim().split('\n');
        page.drawText('INVOICE', { x: 50, y: 780, size: 28, font: bold, color: rgb(0.39,0.4,0.95) });
        page.drawText(from, { x: 50, y: 740, size: 12, font: bold }); page.drawText('Bill To: ' + to, { x: 50, y: 710, size: 11, font: font });
        page.drawText('Invoice #: ' + num, { x: 400, y: 740, size: 10, font: font }); page.drawText('Date: ' + date, { x: 400, y: 725, size: 10, font: font });
        // Table header
        var y = 660;
        page.drawRectangle({ x: 50, y: y - 5, width: 495, height: 25, color: rgb(0.39,0.4,0.95) });
        page.drawText('Description', { x: 60, y: y, size: 10, font: bold, color: rgb(1,1,1) });
        page.drawText('Qty', { x: 350, y: y, size: 10, font: bold, color: rgb(1,1,1) });
        page.drawText('Price', { x: 400, y: y, size: 10, font: bold, color: rgb(1,1,1) });
        page.drawText('Total', { x: 470, y: y, size: 10, font: bold, color: rgb(1,1,1) });
        y -= 30; var total = 0;
        itemsRaw.forEach(function (line) {
          var parts = line.split(',').map(function(s){return s.trim();}); if (parts.length < 3) return;
          var desc = parts[0], qty = parseFloat(parts[1]) || 1, price = parseFloat(parts[2]) || 0;
          var lineTotal = qty * price; total += lineTotal;
          page.drawText(desc, { x: 60, y: y, size: 10, font: font }); page.drawText(String(qty), { x: 355, y: y, size: 10, font: font });
          page.drawText('$' + price.toFixed(2), { x: 400, y: y, size: 10, font: font }); page.drawText('$' + lineTotal.toFixed(2), { x: 470, y: y, size: 10, font: font });
          y -= 22;
        });
        y -= 10;
        page.drawLine({ start: { x: 350, y: y + 5 }, end: { x: 545, y: y + 5 }, thickness: 1 });
        page.drawText('Total: $' + total.toFixed(2), { x: 400, y: y - 15, size: 14, font: bold, color: rgb(0.39,0.4,0.95) });
        if (notes) page.drawText('Notes: ' + notes, { x: 50, y: y - 50, size: 9, font: font, color: rgb(0.4,0.4,0.4) });
        var saved = await pdf.save(); var blob = new Blob([saved], { type: 'application/pdf' });
        dlCard(document.getElementById('invoice-gen-output'), 'Invoice Created!', '$' + total.toFixed(2) + ' total • ' + EditIt.formatFileSize(blob.size), blob, 'invoice_' + num + '.pdf');
        EditIt.showToast('Invoice created!', 'success');
      } catch (err) { EditIt.showToast('Error: ' + err.message, 'error'); }
      EditIt.setButtonLoading(btn, false);
    });
  })();

  // 17. RESUME BUILDER
  (function () {
    var btn = document.getElementById('res-go');
    if (!btn) return;
    btn.addEventListener('click', async function () {
      EditIt.setButtonLoading(btn, true);
      try {
        var PDFDoc = PDFLib.PDFDocument, SF = PDFLib.StandardFonts, rgb = PDFLib.rgb;
        var pdf = await PDFDoc.create();
        var font = await pdf.embedFont(SF.Helvetica); var bold = await pdf.embedFont(SF.HelveticaBold);
        var page = pdf.addPage([595, 842]);
        var name = document.getElementById('res-name').value || 'Your Name';
        var title = document.getElementById('res-title').value || '';
        var email = document.getElementById('res-email').value || '';
        var phone = document.getElementById('res-phone').value || '';
        var summary = document.getElementById('res-summary').value || '';
        var expRaw = document.getElementById('res-exp').value || '';
        var skills = document.getElementById('res-skills').value || '';
        var y = 780;
        page.drawText(name, { x: 50, y: y, size: 24, font: bold, color: rgb(0.2,0.2,0.2) }); y -= 22;
        if (title) { page.drawText(title, { x: 50, y: y, size: 13, font: font, color: rgb(0.39,0.4,0.95) }); y -= 18; }
        var contact = [email, phone].filter(Boolean).join(' • ');
        if (contact) { page.drawText(contact, { x: 50, y: y, size: 9, font: font, color: rgb(0.5,0.5,0.5) }); y -= 25; }
        page.drawLine({ start:{x:50,y:y}, end:{x:545,y:y}, thickness:1, color:rgb(0.85,0.85,0.85) }); y -= 20;
        if (summary) { page.drawText('SUMMARY', { x: 50, y: y, size: 11, font: bold, color: rgb(0.39,0.4,0.95) }); y -= 16; page.drawText(summary.substring(0,200), { x: 50, y: y, size: 9, font: font }); y -= 25; }
        if (expRaw) {
          page.drawText('EXPERIENCE', { x: 50, y: y, size: 11, font: bold, color: rgb(0.39,0.4,0.95) }); y -= 16;
          expRaw.split('\n').forEach(function (line) {
            var parts = line.split('|').map(function(s){return s.trim();});
            page.drawText(parts[0] || '', { x: 50, y: y, size: 10, font: bold }); page.drawText((parts[1]||'') + ' • ' + (parts[2]||''), { x: 250, y: y, size: 9, font: font, color: rgb(0.5,0.5,0.5) });
            y -= 18;
          });
          y -= 10;
        }
        if (skills) {
          page.drawText('SKILLS', { x: 50, y: y, size: 11, font: bold, color: rgb(0.39,0.4,0.95) }); y -= 16;
          page.drawText(skills, { x: 50, y: y, size: 9, font: font });
        }
        var saved = await pdf.save(); var blob = new Blob([saved], { type: 'application/pdf' });
        dlCard(document.getElementById('resume-builder-output'), 'Resume Created!', EditIt.formatFileSize(blob.size), blob, name.replace(/\s+/g,'_') + '_Resume.pdf');
        EditIt.showToast('Resume created!', 'success');
      } catch (err) { EditIt.showToast('Error: ' + err.message, 'error'); }
      EditIt.setButtonLoading(btn, false);
    });
  })();

  // 18. CERTIFICATE GENERATOR
  (function () {
    var btn = document.getElementById('cert-go');
    if (!btn) return;
    btn.addEventListener('click', async function () {
      var name = document.getElementById('cert-name').value || 'Recipient Name';
      var course = document.getElementById('cert-course').value || 'Achievement';
      var date = document.getElementById('cert-date').value || new Date().toLocaleDateString();
      var issuer = document.getElementById('cert-issuer').value || 'Organization';
      var c = document.createElement('canvas'); c.width = 1200; c.height = 800;
      var ctx = c.getContext('2d');
      // Background
      ctx.fillStyle = '#fff'; ctx.fillRect(0,0,1200,800);
      ctx.strokeStyle = '#6366f1'; ctx.lineWidth = 8; ctx.strokeRect(30,30,1140,740);
      ctx.strokeStyle = '#a855f7'; ctx.lineWidth = 3; ctx.strokeRect(45,45,1110,710);
      // Title
      ctx.font = 'bold 48px Georgia'; ctx.fillStyle = '#6366f1'; ctx.textAlign = 'center';
      ctx.fillText('Certificate of Completion', 600, 150);
      // Subtitle
      ctx.font = '20px Georgia'; ctx.fillStyle = '#666';
      ctx.fillText('This is to certify that', 600, 260);
      // Name
      ctx.font = 'bold 52px Georgia'; ctx.fillStyle = '#1a1a2e';
      ctx.fillText(name, 600, 340);
      // Line
      ctx.strokeStyle = '#6366f1'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(250, 360); ctx.lineTo(950, 360); ctx.stroke();
      // Course
      ctx.font = '20px Georgia'; ctx.fillStyle = '#666';
      ctx.fillText('has successfully completed', 600, 420);
      ctx.font = 'bold 30px Georgia'; ctx.fillStyle = '#333';
      ctx.fillText(course, 600, 470);
      // Footer
      ctx.font = '16px Georgia'; ctx.fillStyle = '#888';
      ctx.fillText('Date: ' + date, 350, 620);
      ctx.fillText('Issued by: ' + issuer, 850, 620);
      // Decorative
      ctx.font = '80px serif'; ctx.fillStyle = '#6366f120';
      ctx.fillText('★', 100, 400); ctx.fillText('★', 1100, 400);
      var blob = await new Promise(function(r){c.toBlob(r,'image/png');});
      var out = document.getElementById('certificate-gen-output');
      dlCard(out, 'Certificate Created!', EditIt.formatFileSize(blob.size), blob, 'certificate_' + name.replace(/\s+/g,'_') + '.png', '<img src="' + URL.createObjectURL(blob) + '" style="max-width:100%;border:1px solid var(--border);border-radius:8px;margin:12px 0">');
      EditIt.showToast('Certificate created!', 'success');
    });
  })();

  // 19. EMAIL SIGNATURE
  (function () {
    var refreshBtn = document.getElementById('sig-refresh'), copyBtn = document.getElementById('sig-copy');
    if (!refreshBtn) return;
    function generate() {
      var name = document.getElementById('sig-name').value || 'John Doe';
      var title = document.getElementById('sig-title').value || '';
      var email = document.getElementById('sig-email').value || '';
      var phone = document.getElementById('sig-phone').value || '';
      var web = document.getElementById('sig-web').value || '';
      var color = document.getElementById('sig-color').value || '#6366f1';
      var html = '<table cellpadding="0" cellspacing="0" style="font-family:Arial,sans-serif;font-size:14px;color:#333"><tr><td style="border-right:3px solid ' + color + ';padding-right:16px"><strong style="font-size:16px;color:' + color + '">' + name + '</strong>' + (title ? '<br><span style="font-size:12px;color:#666">' + title + '</span>' : '') + '</td><td style="padding-left:16px">' + (email ? '<div style="font-size:12px">✉ <a href="mailto:' + email + '" style="color:' + color + ';text-decoration:none">' + email + '</a></div>' : '') + (phone ? '<div style="font-size:12px">☎ ' + phone + '</div>' : '') + (web ? '<div style="font-size:12px">🌐 <a href="' + web + '" style="color:' + color + ';text-decoration:none">' + web.replace(/https?:\/\//, '') + '</a></div>' : '') + '</td></tr></table>';
      document.getElementById('sig-preview').innerHTML = html;
      return html;
    }
    refreshBtn.addEventListener('click', generate);
    copyBtn.addEventListener('click', function () {
      var html = generate();
      navigator.clipboard.writeText(html).then(function () { EditIt.showToast('HTML copied! Paste in your email client settings.', 'success'); });
    });
    generate();
  })();

  // 20. BUSINESS CARD
  (function () {
    var btn = document.getElementById('bc2-go');
    if (!btn) return;
    btn.addEventListener('click', async function () {
      var name = document.getElementById('bc2-name').value || 'Jane Smith';
      var title = document.getElementById('bc2-title').value || '';
      var email = document.getElementById('bc2-email').value || '';
      var phone = document.getElementById('bc2-phone').value || '';
      var company = document.getElementById('bc2-company').value || '';
      var color = document.getElementById('bc2-color').value;
      var c = document.createElement('canvas'); c.width = 700; c.height = 400;
      var ctx = c.getContext('2d');
      ctx.fillStyle = '#fff'; ctx.fillRect(0,0,700,400);
      // Accent bar
      ctx.fillStyle = color; ctx.fillRect(0,0,8,400);
      // Name
      ctx.font = 'bold 32px Arial'; ctx.fillStyle = '#1a1a2e'; ctx.textAlign = 'left';
      ctx.fillText(name, 40, 120);
      if (title) { ctx.font = '18px Arial'; ctx.fillStyle = color; ctx.fillText(title, 40, 155); }
      if (company) { ctx.font = 'bold 16px Arial'; ctx.fillStyle = '#555'; ctx.fillText(company, 40, 195); }
      // Contact info
      ctx.font = '14px Arial'; ctx.fillStyle = '#666'; var cy = 260;
      if (email) { ctx.fillText('✉  ' + email, 40, cy); cy += 28; }
      if (phone) { ctx.fillText('☎  ' + phone, 40, cy); cy += 28; }
      // Border
      ctx.strokeStyle = '#eee'; ctx.lineWidth = 2; ctx.strokeRect(1,1,698,398);
      var blob = await new Promise(function(r){c.toBlob(r,'image/png');});
      var out = document.getElementById('biz-card-output');
      dlCard(out, 'Business Card Created!', '700×400 • ' + EditIt.formatFileSize(blob.size), blob, 'business_card.png', '<img src="' + URL.createObjectURL(blob) + '" style="max-width:100%;border:1px solid var(--border);border-radius:8px;margin:12px 0">');
    });
  })();

  // 21. POMODORO TIMER
  (function () {
    var startBtn = document.getElementById('pom-start'), pauseBtn = document.getElementById('pom-pause'), resetBtn = document.getElementById('pom-reset');
    if (!startBtn) return;
    var timer, seconds, isWork = true, sessions = 0, running = false;
    function display() { var m = Math.floor(seconds/60), s = seconds%60; document.getElementById('pom-display').textContent = String(m).padStart(2,'0') + ':' + String(s).padStart(2,'0'); }
    function reset() {
      clearInterval(timer); running = false;
      seconds = parseInt(document.getElementById('pom-work').value) * 60 || 1500; isWork = true;
      document.getElementById('pom-label').textContent = 'Work Session';
      display(); startBtn.style.display = 'inline-flex'; pauseBtn.style.display = 'none';
    }
    startBtn.addEventListener('click', function () {
      if (!running) { seconds = (isWork ? parseInt(document.getElementById('pom-work').value) : parseInt(document.getElementById('pom-break').value)) * 60; }
      running = true; startBtn.style.display = 'none'; pauseBtn.style.display = 'inline-flex';
      timer = setInterval(function () {
        seconds--;
        if (seconds < 0) {
          clearInterval(timer);
          if (isWork) { sessions++; document.getElementById('pom-sessions').textContent = 'Sessions completed: ' + sessions; isWork = false; seconds = parseInt(document.getElementById('pom-break').value) * 60; document.getElementById('pom-label').textContent = 'Break Time!'; }
          else { isWork = true; seconds = parseInt(document.getElementById('pom-work').value) * 60; document.getElementById('pom-label').textContent = 'Work Session'; }
          EditIt.showToast(isWork ? 'Break over! Back to work!' : 'Great work! Take a break!', 'info');
          display(); startBtn.style.display = 'inline-flex'; pauseBtn.style.display = 'none'; running = false;
          return;
        }
        display();
      }, 1000);
    });
    pauseBtn.addEventListener('click', function () { clearInterval(timer); running = false; startBtn.style.display = 'inline-flex'; pauseBtn.style.display = 'none'; startBtn.textContent = 'Resume'; });
    resetBtn.addEventListener('click', function () { sessions = 0; document.getElementById('pom-sessions').textContent = 'Sessions completed: 0'; startBtn.textContent = 'Start'; reset(); });
    reset();
  })();

  // 23. VIDEO TRIMMER
  (function () {
    var actionBtn = document.getElementById('video-trimmer-action');
    if (!actionBtn) return;
    var file = null;
    document.addEventListener('files-added', function (e) {
      if (e.detail.toolId !== 'video-trimmer') return;
      file = e.detail.files.find(function (f) { return f.type.startsWith('video/'); });
      if (!file) { EditIt.showToast('Select a video file', 'error'); return; }
      var fl = document.getElementById('video-trimmer-files'); fl.innerHTML = '';
      var item = EditIt.createFileItem(file, 0); item.querySelector('.file-item-remove').addEventListener('click', function () { file = null; fl.innerHTML = ''; actionBtn.disabled = true; document.getElementById('video-trimmer-options').style.display = 'none'; });
      fl.appendChild(item);
      var player = document.getElementById('vt-player');
      player.src = URL.createObjectURL(file);
      player.addEventListener('loadedmetadata', function () { document.getElementById('vt-end').value = player.duration.toFixed(1); });
      document.getElementById('video-trimmer-options').style.display = 'block'; actionBtn.disabled = false;
    });
    actionBtn.addEventListener('click', async function () {
      if (!file) return;
      EditIt.showToast('Video trimming uses MediaRecorder. The video will play and record in real-time.', 'info');
      EditIt.setButtonLoading(actionBtn, true);
      try {
        var start = parseFloat(document.getElementById('vt-start').value) || 0;
        var end = parseFloat(document.getElementById('vt-end').value) || 5;
        var video = document.createElement('video'); video.src = URL.createObjectURL(file); video.muted = false;
        await new Promise(function(r){video.onloadeddata=r;video.load();});
        video.currentTime = start;
        await new Promise(function(r){video.onseeked=r;});
        var stream = video.captureStream();
        var recorder = new MediaRecorder(stream, { mimeType: 'video/webm' });
        var chunks = [];
        recorder.ondataavailable = function (e) { if (e.data.size > 0) chunks.push(e.data); };
        recorder.onstop = function () {
          var blob = new Blob(chunks, { type: 'video/webm' });
          dlCard(document.getElementById('video-trimmer-output'), 'Video Trimmed!', (end-start).toFixed(1) + 's • ' + EditIt.formatFileSize(blob.size), blob, file.name.replace(/\.[^.]+$/, '') + '_trimmed.webm');
          EditIt.showToast('Video trimmed!', 'success');
          EditIt.setButtonLoading(actionBtn, false);
        };
        recorder.start();
        video.play();
        setTimeout(function () { recorder.stop(); video.pause(); }, (end - start) * 1000);
      } catch (err) { EditIt.showToast('Error: ' + err.message, 'error'); EditIt.setButtonLoading(actionBtn, false); }
    });
  })();

  // 24. AUDIO VISUALIZER
  (function () {
    var actionBtn = document.getElementById('audio-visualizer-action');
    if (!actionBtn) return;
    var file = null;
    document.addEventListener('files-added', function (e) {
      if (e.detail.toolId !== 'audio-visualizer') return;
      file = e.detail.files.find(function(f){return f.type.startsWith('audio/');});
      if (!file) { EditIt.showToast('Select an audio file', 'error'); return; }
      var fl = document.getElementById('audio-visualizer-files'); fl.innerHTML = '';
      var item = EditIt.createFileItem(file, 0); item.querySelector('.file-item-remove').addEventListener('click', function(){file=null;fl.innerHTML='';actionBtn.disabled=true;});
      fl.appendChild(item); actionBtn.disabled = false;
      document.getElementById('audio-visualizer-opts').style.display = 'block';
    });
    actionBtn.addEventListener('click', async function () {
      if (!file) return; EditIt.setButtonLoading(actionBtn, true);
      try {
        var audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        var buf = await file.arrayBuffer();
        var audioBuffer = await audioCtx.decodeAudioData(buf);
        var data = audioBuffer.getChannelData(0);
        var waveColor = document.getElementById('av-color').value;
        var bgColor = document.getElementById('av-bg').value;
        var c = document.createElement('canvas'); c.width = 1200; c.height = 300;
        var ctx = c.getContext('2d');
        ctx.fillStyle = bgColor; ctx.fillRect(0,0,c.width,c.height);
        var step = Math.ceil(data.length / c.width);
        ctx.fillStyle = waveColor;
        for (var i = 0; i < c.width; i++) {
          var min = 1, max = -1;
          for (var j = 0; j < step; j++) {
            var val = data[i * step + j] || 0;
            if (val < min) min = val; if (val > max) max = val;
          }
          var barH = Math.max(1, (max - min) * c.height / 2);
          ctx.fillRect(i, (c.height - barH) / 2, 1, barH);
        }
        audioCtx.close();
        var blob = await new Promise(function(r){c.toBlob(r,'image/png');});
        var out = document.getElementById('audio-visualizer-output');
        dlCard(out, 'Waveform Generated!', audioBuffer.duration.toFixed(1) + 's • ' + EditIt.formatFileSize(blob.size), blob, file.name.replace(/\.[^.]+$/,'') + '_waveform.png', '<img src="'+URL.createObjectURL(blob)+'" style="max-width:100%;border:1px solid var(--border);border-radius:8px;margin:12px 0">');
        EditIt.showToast('Waveform generated!', 'success');
      } catch(err) { EditIt.showToast('Error: ' + err.message, 'error'); }
      EditIt.setButtonLoading(actionBtn, false);
    });
  })();

  // 25. VIDEO THUMBNAIL EXTRACTOR
  (function () {
    var captureBtn = document.getElementById('vth-capture');
    if (!captureBtn) return;
    var file = null;
    document.addEventListener('files-added', function (e) {
      if (e.detail.toolId !== 'video-thumb') return;
      file = e.detail.files.find(function(f){return f.type.startsWith('video/');});
      if (!file) return;
      var fl = document.getElementById('video-thumb-files'); fl.innerHTML = '';
      var item = EditIt.createFileItem(file,0); item.querySelector('.file-item-remove').addEventListener('click', function(){file=null;fl.innerHTML='';document.getElementById('vth-workspace').style.display='none';});
      fl.appendChild(item);
      var video = document.getElementById('vth-video');
      video.src = URL.createObjectURL(file);
      video.addEventListener('loadedmetadata', function(){
        document.getElementById('vth-seek').max = video.duration;
        document.getElementById('vth-workspace').style.display = 'block';
      });
    });
    document.getElementById('vth-seek').addEventListener('input', function(){
      var video = document.getElementById('vth-video');
      video.currentTime = parseFloat(this.value);
      document.getElementById('vth-time-val').textContent = parseFloat(this.value).toFixed(1) + 's';
    });
    captureBtn.addEventListener('click', async function(){
      var video = document.getElementById('vth-video');
      var c = document.createElement('canvas'); c.width = video.videoWidth; c.height = video.videoHeight;
      c.getContext('2d').drawImage(video, 0, 0);
      var blob = await new Promise(function(r){c.toBlob(r,'image/png');});
      var out = document.getElementById('video-thumb-output');
      dlCard(out, 'Frame Captured!', c.width+'×'+c.height+' • '+EditIt.formatFileSize(blob.size), blob, 'thumbnail.png', '<img src="'+URL.createObjectURL(blob)+'" style="max-width:100%;border:1px solid var(--border);border-radius:8px;margin:12px 0">');
      EditIt.showToast('Frame captured!', 'success');
    });
  })();

})();


// ===== file.tools — Batch 4: Font Preview, Habit Tracker, Kanban Board =====
(function () {
  'use strict';

  // 1. FONT PREVIEW
  (function () {
    var textInput = document.getElementById('fp-text');
    var sizeInput = document.getElementById('fp-size');
    if (!textInput) return;
    var fonts = ['Arial','Arial Black','Georgia','Times New Roman','Courier New','Verdana','Trebuchet MS','Impact','Comic Sans MS','Lucida Console','Palatino Linotype','Garamond','Book Antiqua','Tahoma','Geneva','Helvetica','Futura','Optima','Didot','Baskerville','Copperplate','Papyrus','Brush Script MT','Segoe UI','Candara','Calibri','Cambria','Consolas','Monaco','Menlo','SF Pro Display','system-ui','cursive','fantasy','monospace','serif','sans-serif'];
    function render() {
      var text = textInput.value || 'The quick brown fox jumps over the lazy dog';
      var size = parseInt(sizeInput.value) || 28;
      var grid = document.getElementById('fp-grid');
      var html = '';
      fonts.forEach(function (font) {
        html += '<div class="fp-item"><div class="fp-font-name">' + font + '</div><div class="fp-sample" style="font-family:\'' + font + '\',sans-serif;font-size:' + size + 'px">' + text.replace(/</g, '&lt;') + '</div></div>';
      });
      grid.innerHTML = html;
    }
    textInput.addEventListener('input', render);
    sizeInput.addEventListener('input', render);
    render();
  })();

})();


// ===== file.tools — LaTeX Editor =====
(function () {
  'use strict';

  var input = document.getElementById('latex-input');
  var preview = document.getElementById('latex-preview');
  if (!input || !preview) return;

  var renderTimer = null;

  // Image store: maps filename -> data URL
  var imageStore = {};

  // Helper to match balanced braces (handles nested braces)
  function matchBalancedBraces(str, startIndex) {
    if (str[startIndex] !== '{') return null;
    var depth = 0;
    var start = startIndex;
    for (var i = startIndex; i < str.length; i++) {
      if (str[i] === '{') depth++;
      else if (str[i] === '}') {
        depth--;
        if (depth === 0) {
          return { content: str.slice(start + 1, i), end: i };
        }
      }
    }
    return null;
  }

  // Replace LaTeX command with balanced brace handling
  function replaceCommand(text, cmd, replaceFn) {
    var pattern = new RegExp('\\\\' + cmd + '\\*?\\s*\\{', 'g');
    var result = '';
    var lastIndex = 0;
    var match;
    while ((match = pattern.exec(text)) !== null) {
      result += text.slice(lastIndex, match.index);
      var braceMatch = matchBalancedBraces(text, match.index + match[0].length - 1);
      if (braceMatch) {
        result += replaceFn(braceMatch.content);
        lastIndex = braceMatch.end + 1;
        pattern.lastIndex = lastIndex;
      } else {
        result += match[0];
        lastIndex = match.index + match[0].length;
      }
    }
    result += text.slice(lastIndex);
    return result;
  }

  // Process \includegraphics[options]{filename} into <img> tags
  function processIncludeGraphics(text) {
    var pattern = /\\includegraphics(\[[^\]]*\])?\{/g;
    var result = '';
    var lastIndex = 0;
    var match;
    while ((match = pattern.exec(text)) !== null) {
      result += text.slice(lastIndex, match.index);
      var braceStart = match.index + match[0].length - 1;
      var braceMatch = matchBalancedBraces(text, braceStart);
      if (braceMatch) {
        var filename = braceMatch.content.trim();
        var options = match[1] || '';
        var style = '';

        // Parse common options: width, height, scale
        if (options) {
          var widthMatch = options.match(/width\s*=\s*([\d.]+(?:\\?(?:textwidth|linewidth|columnwidth)|\s*(?:cm|mm|in|pt|px|em|%)))/);
          var heightMatch = options.match(/height\s*=\s*([\d.]+(?:\\?(?:textheight)|\s*(?:cm|mm|in|pt|px|em|%)))/);
          var scaleMatch = options.match(/scale\s*=\s*([\d.]+)/);

          if (widthMatch) {
            var w = widthMatch[1];
            if (w.match(/\\?textwidth|\\?linewidth|\\?columnwidth/)) {
              var num = parseFloat(w) || 1;
              style += 'width:' + (num * 100) + '%;';
            } else {
              style += 'width:' + w + ';';
            }
          }
          if (heightMatch) {
            var h = heightMatch[1];
            if (h.match(/\\?textheight/)) {
              var hnum = parseFloat(h) || 1;
              style += 'height:' + (hnum * 100) + 'vh;';
            } else {
              style += 'height:' + h + ';';
            }
          }
          if (scaleMatch) {
            var s = parseFloat(scaleMatch[1]);
            style += 'width:' + (s * 100) + '%;';
          }
        }

        // Look up the image in our store
        var imgSrc = imageStore[filename] || imageStore[filename.replace(/\.[^.]+$/, '')] || '';

        if (imgSrc) {
          result += '<img class="latex-img" src="' + imgSrc + '" alt="' + filename + '"' + (style ? ' style="' + style + '"' : '') + '>';
        } else {
          // Show placeholder for missing image
          result += '<div class="latex-img" style="' + (style || 'width:200px;height:120px;') + 'background:#f0f0f0;border:2px dashed #ccc;border-radius:4px;display:flex;align-items:center;justify-content:center;margin:12px auto;color:#999;font-size:0.85em;padding:12px;text-align:center">' +
            '<span>Image: ' + filename + '<br><small>Use the Image button to upload</small></span></div>';
        }
        lastIndex = braceMatch.end + 1;
        pattern.lastIndex = lastIndex;
      } else {
        result += match[0];
        lastIndex = match.index + match[0].length;
      }
    }
    result += text.slice(lastIndex);
    return result;
  }

  // Parse LaTeX source into structured HTML for preview
  function latexToHTML(src) {
    var body = src;
    // Extract body content if \begin{document} exists
    var bodyMatch = src.match(/\\begin\{document\}([\s\S]*?)\\end\{document\}/);
    if (bodyMatch) body = bodyMatch[1];

    var html = body;

    // Remove preamble commands first
    html = html.replace(/\\documentclass(\[[^\]]*\])?\{[^}]*\}/g, '');
    html = html.replace(/\\usepackage(\[[^\]]*\])?\{[^}]*\}/g, '');
    html = html.replace(/\\setlength\{[^}]*\}\{[^}]*\}/g, '');
    html = html.replace(/\\pagestyle\{[^}]*\}/g, '');

    // Title, author, date (with balanced brace support)
    html = replaceCommand(html, 'title', function (c) { return '<h1 class="latex-title">' + c + '</h1>'; });
    html = replaceCommand(html, 'author', function (c) { return '<div class="latex-author">' + c + '</div>'; });
    html = replaceCommand(html, 'date', function (c) { return '<div class="latex-date">' + c + '</div>'; });
    html = html.replace(/\\maketitle/g, '');

    // Sections (with balanced brace support)
    html = replaceCommand(html, 'section', function (c) { return '<h2 class="latex-section">' + c + '</h2>'; });
    html = replaceCommand(html, 'subsection', function (c) { return '<h3 class="latex-subsection">' + c + '</h3>'; });
    html = replaceCommand(html, 'subsubsection', function (c) { return '<h4 class="latex-subsubsection">' + c + '</h4>'; });

    // Text formatting (with balanced brace support for nested commands)
    html = replaceCommand(html, 'textbf', function (c) { return '<strong>' + c + '</strong>'; });
    html = replaceCommand(html, 'textit', function (c) { return '<em>' + c + '</em>'; });
    html = replaceCommand(html, 'underline', function (c) { return '<u>' + c + '</u>'; });
    html = replaceCommand(html, 'texttt', function (c) { return '<code>' + c + '</code>'; });
    html = replaceCommand(html, 'emph', function (c) { return '<em>' + c + '</em>'; });

    // Environments
    html = html.replace(/\\begin\{itemize\}([\s\S]*?)\\end\{itemize\}/g, function (m, content) {
      var items = content.split('\\item').filter(function (s) { return s.trim(); });
      return '<ul>' + items.map(function (item) { return '<li>' + item.trim() + '</li>'; }).join('') + '</ul>';
    });
    html = html.replace(/\\begin\{enumerate\}([\s\S]*?)\\end\{enumerate\}/g, function (m, content) {
      var items = content.split('\\item').filter(function (s) { return s.trim(); });
      return '<ol>' + items.map(function (item) { return '<li>' + item.trim() + '</li>'; }).join('') + '</ol>';
    });

    // Verbatim / code blocks
    html = html.replace(/\\begin\{verbatim\}([\s\S]*?)\\end\{verbatim\}/g, '<pre class="latex-verbatim">$1</pre>');
    // Quote
    html = html.replace(/\\begin\{quote\}([\s\S]*?)\\end\{quote\}/g, '<blockquote>$1</blockquote>');
    // Center
    html = html.replace(/\\begin\{center\}([\s\S]*?)\\end\{center\}/g, '<div style="text-align:center">$1</div>');

    // Figure environment: \begin{figure}...\end{figure}
    html = html.replace(/\\begin\{figure\}(\[[^\]]*\])?([\s\S]*?)\\end\{figure\}/g, function (m, pos, content) {
      // Process the content inside the figure
      var figHtml = content;
      var caption = '';
      var captionMatch = figHtml.match(/\\caption\{/);
      if (captionMatch) {
        var braceStart = figHtml.indexOf('{', figHtml.indexOf('\\caption'));
        var braceResult = matchBalancedBraces(figHtml, braceStart);
        if (braceResult) {
          caption = braceResult.content;
          figHtml = figHtml.slice(0, figHtml.indexOf('\\caption')) + figHtml.slice(braceResult.end + 1);
        }
      }
      // Remove \centering, \label
      figHtml = figHtml.replace(/\\centering/g, '');
      figHtml = figHtml.replace(/\\label\{[^}]*\}/g, '');
      // Process \includegraphics inside the figure
      figHtml = processIncludeGraphics(figHtml);
      var captionHtml = caption ? '<div class="latex-caption">' + caption + '</div>' : '';
      return '<div class="latex-figure">' + figHtml.trim() + captionHtml + '</div>';
    });

    // Standalone \includegraphics (outside figure environment)
    html = processIncludeGraphics(html);

    // Horizontal rule
    html = html.replace(/\\hrule|\\hline/g, '<hr>');
    html = html.replace(/\\newpage|\\clearpage|\\pagebreak/g, '<hr class="latex-pagebreak">');

    // Line breaks - but preserve \\ inside math mode for MathJax
    // First, protect math content by temporarily replacing it
    var mathBlocks = [];
    html = html.replace(/\$\$[\s\S]*?\$\$/g, function (m) {
      mathBlocks.push(m);
      return '%%MATHBLOCK' + (mathBlocks.length - 1) + '%%';
    });
    html = html.replace(/\$[^$]+\$/g, function (m) {
      mathBlocks.push(m);
      return '%%MATHBLOCK' + (mathBlocks.length - 1) + '%%';
    });

    // Now safely replace line breaks
    html = html.replace(/\\\\\s*/g, '<br>');
    html = html.replace(/\\newline/g, '<br>');

    // Restore math blocks
    html = html.replace(/%%MATHBLOCK(\d+)%%/g, function (m, idx) {
      return mathBlocks[parseInt(idx, 10)];
    });

    // Spacing
    html = replaceCommand(html, 'vspace', function () { return '<div style="margin:12px 0"></div>'; });
    html = replaceCommand(html, 'hspace', function () { return '&nbsp;&nbsp;'; });
    html = html.replace(/\\noindent/g, '');

    // Special chars (but preserve \$ for math mode)
    html = html.replace(/\\&/g, '&amp;');
    html = html.replace(/\\%/g, '%');
    html = html.replace(/\\#/g, '#');
    html = html.replace(/\\ldots|\\dots/g, '…');
    html = html.replace(/\\LaTeX/g, 'L<sup>A</sup>T<sub>E</sub>X');
    html = html.replace(/\\TeX/g, 'T<sub>E</sub>X');

    // Remove unknown commands (but keep their content)
    html = html.replace(/\\(?:begin|end)\{(?:document|abstract|table|tabular)\}/g, '');

    // Paragraphs from double newlines
    html = html.replace(/\n\s*\n/g, '</p><p>');
    // Clean up
    html = html.replace(/^\s*<\/p>/, '').trim();

    if (html && !html.startsWith('<')) html = '<p>' + html;
    if (html && !html.endsWith('>')) html += '</p>';

    return html;
  }

  function renderPreview() {
    var src = input.value;
    if (!src.trim()) {
      preview.innerHTML = '<p style="color:var(--text-muted);font-style:italic">Start typing LaTeX to see the preview...</p>';
      return;
    }

    // Convert LaTeX structure to HTML
    var html = latexToHTML(src);
    preview.innerHTML = html;

    // Use MathJax to render math expressions
    if (window.MathJax) {
      // Clear previous MathJax rendering before re-typesetting
      if (MathJax.typesetClear) {
        MathJax.typesetClear([preview]);
      }
      if (MathJax.typesetPromise) {
        MathJax.typesetPromise([preview]).catch(function (err) {
          console.warn('MathJax render error:', err);
        });
      }
    }
  }

  // Debounced live preview
  input.addEventListener('input', function () {
    clearTimeout(renderTimer);
    renderTimer = setTimeout(renderPreview, 300);
  });

  // Snippet buttons
  document.querySelectorAll('.latex-snippet').forEach(function (btn) {
    btn.addEventListener('click', function () {
      var snippet = btn.dataset.snippet.replace(/\\n/g, '\n');
      var start = input.selectionStart;
      var end = input.selectionEnd;
      var text = input.value;
      input.value = text.substring(0, start) + snippet + text.substring(end);
      input.selectionStart = input.selectionEnd = start + snippet.length;
      input.focus();
      clearTimeout(renderTimer);
      renderTimer = setTimeout(renderPreview, 300);
    });
  });

  // Image upload handler
  var imageUploadInput = document.getElementById('latex-image-upload');
  var insertImageBtn = document.getElementById('latex-insert-image');

  if (insertImageBtn && imageUploadInput) {
    insertImageBtn.addEventListener('click', function () {
      imageUploadInput.click();
    });

    imageUploadInput.addEventListener('change', function () {
      if (!imageUploadInput.files || !imageUploadInput.files.length) return;

      // Snapshot the files array BEFORE any async work — resetting the input
      // later clears the live FileList, so we must copy everything now.
      var fileList = Array.from(imageUploadInput.files);
      var pending = fileList.length;
      var snippets = [];
      var fileNames = [];

      fileList.forEach(function (file) {
        if (!file.type.startsWith('image/')) {
          pending--;
          if (pending <= 0) finishInsert();
          return;
        }

        // Capture the name before any async gap
        var name = file.name;
        fileNames.push(name);

        var reader = new FileReader();
        reader.onload = function (e) {
          var dataUrl = e.target.result;

          // Store image by filename (with and without extension)
          imageStore[name] = dataUrl;
          var nameNoExt = name.replace(/\.[^.]+$/, '');
          imageStore[nameNoExt] = dataUrl;

          // Build the LaTeX snippet
          snippets.push({ name: name, cmd: '\\includegraphics[width=0.8\\textwidth]{' + name + '}' });

          pending--;
          if (pending <= 0) finishInsert();
        };
        reader.onerror = function () {
          pending--;
          if (pending <= 0) finishInsert();
        };
        reader.readAsDataURL(file);
      });

      // Reset input immediately so the same file can be re-selected.
      // The fileList snapshot keeps the File objects alive.
      imageUploadInput.value = '';

      function finishInsert() {
        if (!snippets.length) return;

        var snippet;
        if (snippets.length === 1) {
          var caption = snippets[0].name.replace(/\.[^.]+$/, '').replace(/[-_]/g, ' ');
          snippet = '\\begin{figure}[h]\n  \\centering\n  ' + snippets[0].cmd + '\n  \\caption{' + caption + '}\n\\end{figure}';
        } else {
          snippet = snippets.map(function (s) {
            var caption = s.name.replace(/\.[^.]+$/, '').replace(/[-_]/g, ' ');
            return '\\begin{figure}[h]\n  \\centering\n  ' + s.cmd + '\n  \\caption{' + caption + '}\n\\end{figure}';
          }).join('\n\n');
        }

        var start = input.selectionStart;
        var end = input.selectionEnd;
        var text = input.value;
        input.value = text.substring(0, start) + snippet + text.substring(end);
        input.selectionStart = input.selectionEnd = start + snippet.length;
        input.focus();

        clearTimeout(renderTimer);
        renderTimer = setTimeout(renderPreview, 100);

        EditIt.showToast(snippets.length + ' image' + (snippets.length > 1 ? 's' : '') + ' inserted!', 'success');
      }
    });
  }

  // Export to PDF
  document.getElementById('latex-export-pdf').addEventListener('click', async function () {
    var btn = this;
    EditIt.setButtonLoading(btn, true);

    try {
      // Ensure MathJax has finished rendering
      if (window.MathJax && MathJax.typesetPromise) {
        await MathJax.typesetPromise([preview]);
      }

      // Create a clean offscreen container for rendering
      var container = document.createElement('div');
      container.style.cssText = 'position:absolute;left:-9999px;top:0;width:595px;padding:40px;box-sizing:border-box;font-family:Georgia,serif;font-size:12pt;line-height:1.6;color:#000;background:#fff;';
      // Clone preview content including rendered MathJax SVGs and images
      container.innerHTML = preview.innerHTML;
      document.body.appendChild(container);

      // Wait for all images inside the container to fully load
      var containerImages = container.querySelectorAll('img');
      if (containerImages.length > 0) {
        await Promise.all(Array.from(containerImages).map(function (img) {
          if (img.complete) return Promise.resolve();
          return new Promise(function (resolve) {
            img.onload = resolve;
            img.onerror = resolve;
          });
        }));
      }

      // Wait for layout
      await new Promise(function (resolve) { setTimeout(resolve, 200); });

      // Build SVG foreignObject with inline styles
      var width = 595;
      var height = Math.max(842, container.scrollHeight + 80);

      // Collect all computed styles and inline them for SVG rendering
      var clone = container.cloneNode(true);

      // Convert all MathJax SVGs to data URIs to avoid CORS issues
      var mjxSvgs = clone.querySelectorAll('mjx-container svg');
      mjxSvgs.forEach(function (svg) {
        svg.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
      });

      // Serialize HTML for foreignObject - need to ensure valid XHTML
      var serializer = new XMLSerializer();
      var xhtmlContent = serializer.serializeToString(clone);

      var svgData = '<svg xmlns="http://www.w3.org/2000/svg" width="' + width + '" height="' + height + '">' +
        '<foreignObject width="100%" height="100%">' +
        xhtmlContent +
        '</foreignObject></svg>';

      var svgBlob = new Blob([svgData], { type: 'image/svg+xml;charset=utf-8' });
      var svgUrl = URL.createObjectURL(svgBlob);

      var pdfGenerated = false;

      // Set a timeout so we always fall back if SVG rendering hangs
      var fallbackTimer = setTimeout(function () {
        if (!pdfGenerated) {
          pdfGenerated = true;
          URL.revokeObjectURL(svgUrl);
          try { document.body.removeChild(container); } catch (e) {}
          fallbackPDF(btn);
        }
      }, 5000);

      var img = new Image();
      img.onload = async function () {
        if (pdfGenerated) return;
        pdfGenerated = true;
        clearTimeout(fallbackTimer);

        try {
          var canvas = document.createElement('canvas');
          var scale = 2;
          canvas.width = width * scale;
          canvas.height = height * scale;
          var ctx = canvas.getContext('2d');
          ctx.fillStyle = '#fff';
          ctx.fillRect(0, 0, canvas.width, canvas.height);
          ctx.scale(scale, scale);
          ctx.drawImage(img, 0, 0, width, height);
          URL.revokeObjectURL(svgUrl);
          document.body.removeChild(container);

          // Check if canvas is tainted (security restriction)
          try {
            canvas.toDataURL();
          } catch (taintErr) {
            console.warn('Canvas tainted, using fallback PDF:', taintErr);
            fallbackPDF(btn);
            return;
          }

          // Create PDF from canvas using pdf-lib
          var PDFDocument = PDFLib.PDFDocument;
          var pdfDoc = await PDFDocument.create();
          var pageHeight = 842;
          var pageWidth = 595;
          var totalPages = Math.ceil(height / pageHeight);

          for (var p = 0; p < totalPages; p++) {
            var srcY = p * pageHeight;
            var drawH = Math.min(pageHeight, height - srcY);

            // Create a per-page canvas cropping the right section
            var pageCanvas = document.createElement('canvas');
            pageCanvas.width = pageWidth * scale;
            pageCanvas.height = drawH * scale;
            var pCtx = pageCanvas.getContext('2d');
            pCtx.drawImage(canvas, 0, srcY * scale, pageWidth * scale, drawH * scale, 0, 0, pageWidth * scale, drawH * scale);

            var imgDataUrl = pageCanvas.toDataURL('image/png');
            var imgBytes = Uint8Array.from(atob(imgDataUrl.split(',')[1]), function (c) { return c.charCodeAt(0); });
            var pdfImage = await pdfDoc.embedPng(imgBytes);

            var page = pdfDoc.addPage([pageWidth, pageHeight]);
            page.drawImage(pdfImage, {
              x: 0,
              y: pageHeight - drawH,
              width: pageWidth,
              height: drawH,
            });
          }

          var pdfBytes = await pdfDoc.save();
          var blob = new Blob([pdfBytes], { type: 'application/pdf' });

          var out = document.getElementById('latex-editor-output');
          out.innerHTML = '<div class="output-card"><h3>\u2713 PDF Created!</h3><p>' + totalPages + ' page' + (totalPages > 1 ? 's' : '') + ' \u2022 ' + EditIt.formatFileSize(blob.size) + '</p><div class="output-filename"><label>File name:</label><input type="text" class="input output-dl-name" value="latex_document.pdf"></div><button class="btn btn-success output-dl-btn">Download PDF</button></div>';
          out.querySelector('.output-dl-btn').addEventListener('click', function () {
            EditIt.downloadBlob(blob, out.querySelector('.output-dl-name').value.trim() || 'latex_document.pdf');
          });
          EditIt.showToast('LaTeX exported to PDF!', 'success');
        } catch (err) {
          console.error('PDF canvas error:', err);
          fallbackPDF(btn);
          return;
        }
        EditIt.setButtonLoading(btn, false);
      };

      img.onerror = function () {
        if (pdfGenerated) return;
        pdfGenerated = true;
        clearTimeout(fallbackTimer);
        try { document.body.removeChild(container); } catch (e) {}
        URL.revokeObjectURL(svgUrl);
        fallbackPDF(btn);
      };

      img.src = svgUrl;

    } catch (err) {
      console.error(err);
      fallbackPDF(btn);
    }
  });

  // Fallback PDF generation using pdf-lib (text-only, no SVG rendering)
  async function fallbackPDF(btn) {
    try {
      var PDFDocument = PDFLib.PDFDocument;
      var StandardFonts = PDFLib.StandardFonts;
      var rgb = PDFLib.rgb;

      var pdfDoc = await PDFDocument.create();
      var font = await pdfDoc.embedFont(StandardFonts.TimesRoman);
      var boldFont = await pdfDoc.embedFont(StandardFonts.TimesRomanBold);
      var italicFont = await pdfDoc.embedFont(StandardFonts.TimesRomanItalic);

      var src = input.value;
      var bodyMatch = src.match(/\\begin\{document\}([\s\S]*?)\\end\{document\}/);
      var body = bodyMatch ? bodyMatch[1] : src;

      // Collect images to embed in the fallback PDF
      var fallbackImages = [];
      var bodyForImages = body;
      var imgPattern = /\\includegraphics(\[[^\]]*\])?\{([^}]+)\}/g;
      var imgMatch;
      while ((imgMatch = imgPattern.exec(bodyForImages)) !== null) {
        var imgName = imgMatch[2].trim();
        var imgData = imageStore[imgName] || imageStore[imgName.replace(/\.[^.]+$/, '')] || null;
        if (imgData) {
          fallbackImages.push({ name: imgName, dataUrl: imgData, placeholder: '=IMG=' + imgName + '=ENDIMG=' });
        }
      }

      // Strip LaTeX commands to plain text lines
      var plain = body
        .replace(/\\title\{([^}]*)\}/g, '=TITLE=$1=ENDTITLE=')
        .replace(/\\section\*?\{([^}]*)\}/g, '\n=SECTION=$1=ENDSECTION=\n')
        .replace(/\\subsection\*?\{([^}]*)\}/g, '\n=SUBSECTION=$1=ENDSUBSECTION=\n')
        .replace(/\\caption\{([^}]*)\}/g, '$1')
        .replace(/\\includegraphics(\[[^\]]*\])?\{([^}]+)\}/g, function (m, opts, name) {
          var n = name.trim();
          var data = imageStore[n] || imageStore[n.replace(/\.[^.]+$/, '')] || null;
          if (data) return '=IMG=' + n + '=ENDIMG=';
          return '[Image: ' + n + ']';
        })
        .replace(/\\textbf\{([^}]*)\}/g, '$1')
        .replace(/\\textit\{([^}]*)\}/g, '$1')
        .replace(/\\emph\{([^}]*)\}/g, '$1')
        .replace(/\\texttt\{([^}]*)\}/g, '$1')
        .replace(/\\item\s*/g, '  • ')
        .replace(/\\begin\{(?:itemize|enumerate|document|center|quote|figure)\}(\[[^\]]*\])?/g, '')
        .replace(/\\end\{(?:itemize|enumerate|document|center|quote|figure)\}/g, '')
        .replace(/\$\$([^$]+)\$\$/g, '  [$1]')
        .replace(/\$([^$]+)\$/g, '[$1]')
        .replace(/\\(?:begin|end)\{(?:equation|align|gather)\*?\}/g, '')
        .replace(/\\(?:maketitle|noindent|newpage|clearpage|centering)/g, '')
        .replace(/\\(?:documentclass|usepackage|setlength|pagestyle)(\[[^\]]*\])?\{[^}]*\}/g, '')
        .replace(/\\vspace\{[^}]*\}/g, '')
        .replace(/\\hspace\{[^}]*\}/g, '  ')
        .replace(/\\label\{[^}]*\}/g, '')
        .replace(/\\\\/g, '\n')
        .replace(/\\newline/g, '\n')
        .replace(/\\&/g, '&')
        .replace(/\\%/g, '%')
        .replace(/\\#/g, '#')
        .replace(/\\\$/g, '$')
        .replace(/\\ldots|\\dots/g, '...')
        .replace(/\\LaTeX/g, 'LaTeX')
        .replace(/\\TeX/g, 'TeX')
        .replace(/\\[a-zA-Z]+\{?/g, '')
        .replace(/[{}]/g, '')
        .trim();

      var lines = plain.split('\n');
      var page = pdfDoc.addPage([595, 842]);
      var y = 790;
      var pageW = 595;

      for (var li = 0; li < lines.length; li++) {
        if (y < 50) {
          page = pdfDoc.addPage([595, 842]);
          y = 790;
        }

        var line = lines[li].trim();
        if (!line) { y -= 8; continue; }

        var titleMatch = line.match(/=TITLE=(.*?)=ENDTITLE=/);
        var sectionMatch = line.match(/=SECTION=(.*?)=ENDSECTION=/);
        var subsectionMatch = line.match(/=SUBSECTION=(.*?)=ENDSUBSECTION=/);
        var imgMarker = line.match(/=IMG=(.*?)=ENDIMG=/);

        if (titleMatch) {
          page.drawText(titleMatch[1], { x: 50, y: y, size: 22, font: boldFont, color: rgb(0.1, 0.1, 0.1) });
          y -= 32;
        } else if (sectionMatch) {
          y -= 8;
          page.drawText(sectionMatch[1], { x: 50, y: y, size: 16, font: boldFont, color: rgb(0.15, 0.15, 0.15) });
          y -= 24;
        } else if (subsectionMatch) {
          page.drawText(subsectionMatch[1], { x: 50, y: y, size: 13, font: boldFont, color: rgb(0.2, 0.2, 0.2) });
          y -= 20;
        } else if (imgMarker) {
          // Embed image in fallback PDF
          var imgName = imgMarker[1];
          var imgDataUrl = imageStore[imgName] || imageStore[imgName.replace(/\.[^.]+$/, '')] || null;
          if (imgDataUrl) {
            try {
              var imgBytesStr = atob(imgDataUrl.split(',')[1]);
              var imgBytesArr = new Uint8Array(imgBytesStr.length);
              for (var bi = 0; bi < imgBytesStr.length; bi++) imgBytesArr[bi] = imgBytesStr.charCodeAt(bi);

              var pdfImage;
              if (imgDataUrl.match(/^data:image\/png/)) {
                pdfImage = await pdfDoc.embedPng(imgBytesArr);
              } else {
                pdfImage = await pdfDoc.embedJpg(imgBytesArr);
              }

              // Scale image to fit page width (max 495px) maintaining aspect ratio
              var maxImgW = pageW - 100;
              var imgAspect = pdfImage.width / pdfImage.height;
              var drawW = Math.min(maxImgW, pdfImage.width);
              var drawImgH = drawW / imgAspect;

              // If image is taller than remaining space, start a new page
              if (y - drawImgH < 50) {
                page = pdfDoc.addPage([595, 842]);
                y = 790;
              }

              page.drawImage(pdfImage, {
                x: (pageW - drawW) / 2,
                y: y - drawImgH,
                width: drawW,
                height: drawImgH,
              });
              y -= drawImgH + 16;
            } catch (imgErr) {
              console.warn('Could not embed image in PDF:', imgErr);
              page.drawText('[Image: ' + imgName + ']', { x: 50, y: y, size: 11, font: font, color: rgb(0.5, 0.5, 0.5) });
              y -= 16;
            }
          } else {
            page.drawText('[Image: ' + imgName + ']', { x: 50, y: y, size: 11, font: font, color: rgb(0.5, 0.5, 0.5) });
            y -= 16;
          }
        } else {
          // Word-wrap long lines
          var words = line.split(' ');
          var currentLine = '';
          var fontSize = 11;
          var maxWidth = pageW - 100;

          words.forEach(function (word) {
            var testLine = currentLine ? currentLine + ' ' + word : word;
            var width = font.widthOfTextAtSize(testLine, fontSize);
            if (width > maxWidth && currentLine) {
              page.drawText(currentLine, { x: 50, y: y, size: fontSize, font: font, color: rgb(0.1, 0.1, 0.1) });
              y -= 16;
              if (y < 50) { page = pdfDoc.addPage([595, 842]); y = 790; }
              currentLine = word;
            } else {
              currentLine = testLine;
            }
          });
          if (currentLine) {
            page.drawText(currentLine, { x: 50, y: y, size: fontSize, font: font, color: rgb(0.1, 0.1, 0.1) });
            y -= 16;
          }
        }
      }

      var pdfBytes = await pdfDoc.save();
      var blob = new Blob([pdfBytes], { type: 'application/pdf' });

      var out = document.getElementById('latex-editor-output');
      out.innerHTML = '<div class="output-card"><h3>\u2713 PDF Created!</h3><p>' + pdfDoc.getPageCount() + ' page(s) \u2022 ' + EditIt.formatFileSize(blob.size) + '</p><div class="output-filename"><label>File name:</label><input type="text" class="input output-dl-name" value="latex_document.pdf"></div><button class="btn btn-success output-dl-btn">Download PDF</button></div>';
      out.querySelector('.output-dl-btn').addEventListener('click', function () {
        EditIt.downloadBlob(blob, out.querySelector('.output-dl-name').value.trim() || 'latex_document.pdf');
      });
      EditIt.showToast('LaTeX exported to PDF!', 'success');
    } catch (err) {
      EditIt.showToast('Error: ' + err.message, 'error');
    }
    EditIt.setButtonLoading(btn, false);
  }

  // --- EXPORT AS DOCX ---
  document.getElementById('latex-export-docx').addEventListener('click', async function () {
    var btn = this;
    EditIt.setButtonLoading(btn, true);
    try {
      // Ensure MathJax has rendered
      if (window.MathJax && MathJax.typesetPromise) {
        await MathJax.typesetPromise([preview]);
      }

      // Build a complete HTML document for the DOCX
      var htmlContent = '<!DOCTYPE html><html><head><meta charset="UTF-8"><style>' +
        'body{font-family:Cambria,Georgia,serif;font-size:12pt;line-height:1.6;color:#000;margin:40px}' +
        'h1{font-size:22pt;text-align:center;margin-bottom:4px}' +
        'h2{font-size:16pt;margin-top:24px;border-bottom:1px solid #ccc;padding-bottom:4px}' +
        'h3{font-size:13pt;margin-top:16px}' +
        'ul,ol{margin:8px 0 8px 24px}' +
        'blockquote{border-left:3px solid #666;padding-left:12px;color:#555;font-style:italic}' +
        'pre{background:#f5f5f5;padding:10px;font-family:Consolas,monospace;font-size:10pt}' +
        'code{background:#f0f0f0;padding:1px 3px;font-family:Consolas,monospace;font-size:0.9em}' +
        '</style></head><body>' + preview.innerHTML + '</body></html>';

      // Create DOCX using the HTML-in-DOCX approach (Word can open HTML saved as .doc/.docx)
      // For true DOCX we wrap it in the MHTML format that Word understands
      var mhtml = 'MIME-Version: 1.0\r\n' +
        'Content-Type: multipart/related; boundary="----=_NextPart"\r\n\r\n' +
        '------=_NextPart\r\n' +
        'Content-Type: text/html; charset="utf-8"\r\n' +
        'Content-Transfer-Encoding: quoted-printable\r\n\r\n' +
        htmlContent + '\r\n\r\n' +
        '------=_NextPart--';

      var blob = new Blob([mhtml], { type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' });

      var out = document.getElementById('latex-editor-output');
      out.innerHTML = '<div class="output-card"><h3>\u2713 DOCX Created!</h3><p>' + EditIt.formatFileSize(blob.size) + '</p>' +
        '<div class="output-filename"><label>File name:</label><input type="text" class="input output-dl-name" value="latex_document.docx"></div>' +
        '<button class="btn btn-success output-dl-btn">Download DOCX</button></div>';
      out.querySelector('.output-dl-btn').addEventListener('click', function () {
        EditIt.downloadBlob(blob, out.querySelector('.output-dl-name').value.trim() || 'latex_document.docx');
      });
      EditIt.showToast('DOCX exported! Opens in Word, Google Docs, LibreOffice.', 'success');
    } catch (err) { EditIt.showToast('Error: ' + err.message, 'error'); }
    EditIt.setButtonLoading(btn, false);
  });

  // --- EXPORT AS HTML ---
  document.getElementById('latex-export-html').addEventListener('click', async function () {
    try {
      if (window.MathJax && MathJax.typesetPromise) {
        await MathJax.typesetPromise([preview]);
      }

      var htmlContent = '<!DOCTYPE html>\n<html lang="en">\n<head>\n<meta charset="UTF-8">\n<meta name="viewport" content="width=device-width, initial-scale=1.0">\n<title>LaTeX Document</title>\n' +
        '<script>MathJax={tex:{inlineMath:[[\'$\',\'$\'],[\'\\\\(\',\'\\\\)\']],displayMath:[[\'$$\',\'$$\'],[\'\\\\[\',\'\\\\]\']]}};' + '<\/script>\n' +
        '<script src="https://cdn.jsdelivr.net/npm/mathjax@3/es5/tex-svg.js" async><\/script>\n' +
        '<style>\n' +
        'body{font-family:Georgia,serif;max-width:800px;margin:40px auto;padding:0 20px;line-height:1.7;color:#1a1a2e;font-size:12pt}\n' +
        'h1{text-align:center;font-size:1.8rem;margin-bottom:4px}\n' +
        'h2{font-size:1.3rem;border-bottom:1px solid #ddd;padding-bottom:4px;margin-top:24px}\n' +
        'h3{font-size:1.1rem;margin-top:16px}\n' +
        'blockquote{border-left:3px solid #6366f1;padding-left:16px;color:#555;font-style:italic}\n' +
        'pre{background:#f5f5f5;padding:12px;border-radius:4px;font-family:monospace;overflow-x:auto}\n' +
        'code{background:#f0f0f0;padding:1px 4px;border-radius:3px;font-family:monospace}\n' +
        '</style>\n</head>\n<body>\n' + latexToHTML(input.value) + '\n</body>\n</html>';

      var blob = new Blob([htmlContent], { type: 'text/html;charset=utf-8' });

      var out = document.getElementById('latex-editor-output');
      out.innerHTML = '<div class="output-card"><h3>\u2713 HTML Created!</h3><p>' + EditIt.formatFileSize(blob.size) + ' \u2022 Includes MathJax for math rendering</p>' +
        '<div class="output-filename"><label>File name:</label><input type="text" class="input output-dl-name" value="latex_document.html"></div>' +
        '<button class="btn btn-success output-dl-btn">Download HTML</button></div>';
      out.querySelector('.output-dl-btn').addEventListener('click', function () {
        EditIt.downloadBlob(blob, out.querySelector('.output-dl-name').value.trim() || 'latex_document.html');
      });
      EditIt.showToast('HTML exported with MathJax support!', 'success');
    } catch (err) { EditIt.showToast('Error: ' + err.message, 'error'); }
  });

  // --- EXPORT AS PLAIN TEXT ---
  document.getElementById('latex-export-txt').addEventListener('click', function () {
    var src = input.value;
    var bodyMatch = src.match(/\\begin\{document\}([\s\S]*?)\\end\{document\}/);
    var body = bodyMatch ? bodyMatch[1] : src;

    var plain = body
      .replace(/\\title\{([^}]*)\}/g, '$1\n' + '='.repeat(40) + '\n')
      .replace(/\\author\{([^}]*)\}/g, 'Author: $1\n')
      .replace(/\\date\{([^}]*)\}/g, 'Date: $1\n')
      .replace(/\\section\*?\{([^}]*)\}/g, '\n$1\n' + '-'.repeat(30) + '\n')
      .replace(/\\subsection\*?\{([^}]*)\}/g, '\n$1\n')
      .replace(/\\subsubsection\*?\{([^}]*)\}/g, '\n$1\n')
      .replace(/\\textbf\{([^}]*)\}/g, '*$1*')
      .replace(/\\textit\{([^}]*)\}/g, '_$1_')
      .replace(/\\emph\{([^}]*)\}/g, '_$1_')
      .replace(/\\texttt\{([^}]*)\}/g, '`$1`')
      .replace(/\\underline\{([^}]*)\}/g, '$1')
      .replace(/\\item\s*/g, '  - ')
      .replace(/\\begin\{(?:itemize|enumerate|document|center|quote|verbatim|equation|align|gather)\*?\}/g, '')
      .replace(/\\end\{(?:itemize|enumerate|document|center|quote|verbatim|equation|align|gather)\*?\}/g, '')
      .replace(/\$\$([^$]+)\$\$/g, '\n  $1\n')
      .replace(/\$([^$]+)\$/g, '$1')
      .replace(/\\(?:maketitle|noindent|newpage|clearpage|centering|hrule|hline)/g, '')
      .replace(/\\(?:documentclass|usepackage|setlength|pagestyle)(\[[^\]]*\])?\{[^}]*\}/g, '')
      .replace(/\\vspace\{[^}]*\}/g, '\n')
      .replace(/\\hspace\{[^}]*\}/g, '  ')
      .replace(/\\\\/g, '\n')
      .replace(/\\newline/g, '\n')
      .replace(/\\&/g, '&')
      .replace(/\\%/g, '%')
      .replace(/\\#/g, '#')
      .replace(/\\\$/g, '$')
      .replace(/\\ldots|\\dots/g, '...')
      .replace(/\\LaTeX/g, 'LaTeX')
      .replace(/\\TeX/g, 'TeX')
      .replace(/\\frac\{([^}]*)\}\{([^}]*)\}/g, '($1/$2)')
      .replace(/\\sqrt\{([^}]*)\}/g, 'sqrt($1)')
      .replace(/\\(?:alpha|beta|gamma|delta|epsilon|theta|lambda|mu|pi|sigma|omega)/g, function (m) {
        var map = {'\\alpha':'α','\\beta':'β','\\gamma':'γ','\\delta':'δ','\\epsilon':'ε','\\theta':'θ','\\lambda':'λ','\\mu':'μ','\\pi':'π','\\sigma':'σ','\\omega':'ω'};
        return map[m] || m;
      })
      .replace(/\\[a-zA-Z]+\{?/g, '')
      .replace(/[{}]/g, '')
      .replace(/\n{3,}/g, '\n\n')
      .trim();

    var blob = new Blob([plain], { type: 'text/plain;charset=utf-8' });

    var out = document.getElementById('latex-editor-output');
    out.innerHTML = '<div class="output-card"><h3>\u2713 Plain Text Created!</h3><p>' + EditIt.formatFileSize(blob.size) + '</p>' +
      '<div class="output-filename"><label>File name:</label><input type="text" class="input output-dl-name" value="latex_document.txt"></div>' +
      '<button class="btn btn-success output-dl-btn">Download TXT</button></div>';
    out.querySelector('.output-dl-btn').addEventListener('click', function () {
      EditIt.downloadBlob(blob, out.querySelector('.output-dl-name').value.trim() || 'latex_document.txt');
    });
    EditIt.showToast('Plain text exported!', 'success');
  });

  // Initial render - wait for MathJax to be ready
  function initialRender() {
    if (input.value) {
      renderPreview();
    }
  }

  // Try to render when MathJax is ready, or after a delay
  if (window.MathJax && MathJax.startup && MathJax.startup.promise) {
    MathJax.startup.promise.then(initialRender).catch(function () {
      setTimeout(initialRender, 500);
    });
  } else {
    // MathJax not loaded yet, wait and try again
    setTimeout(function () {
      if (window.MathJax && MathJax.startup && MathJax.startup.promise) {
        MathJax.startup.promise.then(initialRender);
      } else {
        initialRender();
      }
    }, 1500);
  }

})();
