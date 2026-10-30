window.Api = (function () {
  // Lokasi file JSON (relatif terhadap index.html).
  const DATA_URL = 'data/dataBahanAjar.json';

  // Daftar template: id <template> => lokasi file HTML-nya.
  // Id memakai pola "tpl-..." agar konsisten dan mudah dicari (sesuai soal).
  const TEMPLATE_FILES = [
    { id: 'tpl-stock',    file: 'templates/stock-table.html' },
    { id: 'tpl-tracking', file: 'templates/do-tracking.html' },
    { id: 'tpl-order',    file: 'templates/order-form.html' },
    { id: 'tpl-badge',    file: 'templates/status-badge.html' },
    { id: 'tpl-modal',    file: 'templates/app-modal.html' }
  ];

  /**
   * Mengambil teks dari sebuah URL.
   * Melempar Error jika server membalas selain status 2xx.
   */
  async function fetchText(url) {
    const res = await fetch(url);
    if (!res.ok) {
      throw new Error('Gagal memuat "' + url + '" (HTTP ' + res.status + ')');
    }
    return res.text();
  }

  /**
   * Mengubah data tracking dari JSON menjadi array datar.
   *
   * Di file JSON, "tracking" berupa array yang berisi objek dengan KUNCI nomor DO:
   *   [ { "DO2025-0001": { nim, nama, ... } }, { "DO2025-0001": {...} } ]
   * Bentuk itu kurang nyaman dipakai v-for, jadi diubah menjadi:
   *   [ { doNumber: "DO2025-0001", nim, nama, ... } ]
   * Nomor DO yang muncul dua kali (data contoh memang duplikat) hanya diambil sekali.
   */
  function normalizeTracking(raw) {
    const result = [];
    const seen = new Set();                       // penanda nomor DO yang sudah diambil
    const wrappers = Array.isArray(raw) ? raw : [raw];

    wrappers.forEach(function (wrapper) {
      Object.keys(wrapper).forEach(function (doNumber) {
        if (seen.has(doNumber)) return;           // lewati duplikat
        seen.add(doNumber);
        const detail = wrapper[doNumber];
        result.push(Object.assign({ doNumber: doNumber }, detail, {
          // pastikan selalu ada array perjalanan agar v-for tidak error
          perjalanan: Array.isArray(detail.perjalanan) ? detail.perjalanan.slice() : []
        }));
      });
    });
    return result;
  }

  /**
   * Memuat seluruh data aplikasi dari JSON dan mengembalikannya sebagai
   * satu objek "state" yang siap dipakai komponen root.
   */
  async function loadData() {
    const res = await fetch(DATA_URL);
    if (!res.ok) {
      throw new Error('Gagal memuat "' + DATA_URL + '" (HTTP ' + res.status + ')');
    }
    const json = await res.json();

    return {
      upbjjList: json.upbjjList || [],
      kategoriList: json.kategoriList || [],
      pengirimanList: json.pengirimanList || [],
      paket: json.paket || [],
      stok: json.stok || [],
      tracking: normalizeTracking(json.tracking || [])
    };
  }

  /**
   * Mengambil semua file template lalu menyisipkannya ke <body> sebagai
   * elemen <template id="tpl-...">. Dijalankan SEBELUM Vue dibuat.
   */
  async function loadTemplates() {
    // Semua file diunduh paralel supaya lebih cepat.
    const htmlList = await Promise.all(TEMPLATE_FILES.map(function (t) {
      return fetchText(t.file);
    }));

    htmlList.forEach(function (html, i) {
      const el = document.createElement('template');
      el.id = TEMPLATE_FILES[i].id;
      el.innerHTML = html;                        // isi file HTML menjadi isi <template>
      document.body.appendChild(el);
    });
  }

  // ---------------------------------------------------------------------------
  // Fungsi bantu tanggal
  // ---------------------------------------------------------------------------

  /** Menambah angka 0 di depan agar 2 digit: 5 -> "05". */
  function pad(n) {
    return String(n).padStart(2, '0');
  }

  /** Tanggal lokal sebagai teks "YYYY-MM-DD" (format yang dipakai <input type="date">). */
  function formatISODate(d) {
    return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
  }

  /** Tanggal hari ini (waktu lokal perangkat) dalam format "YYYY-MM-DD". */
  function todayISO() {
    return formatISODate(new Date());
  }

  /** Waktu sekarang (lokal) dalam format "YYYY-MM-DD HH:mm:ss", sama seperti data JSON. */
  function nowTimestamp() {
    const d = new Date();
    return formatISODate(d) + ' ' + pad(d.getHours()) + ':' + pad(d.getMinutes()) + ':' + pad(d.getSeconds());
  }

  /**
   * Kunci unik sebuah baris stok. Kode mata kuliah yang sama boleh ada di
   * UT-Daerah berbeda, jadi kuncinya gabungan kode + upbjj.
   */
  function stokKey(item) {
    return item.kode + '|' + item.upbjj;
  }

  // Hanya fungsi-fungsi di bawah ini yang boleh dipakai dari luar.
  return {
    loadData: loadData,
    loadTemplates: loadTemplates,
    todayISO: todayISO,
    nowTimestamp: nowTimestamp,
    stokKey: stokKey
  };
})();
