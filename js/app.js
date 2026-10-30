/** Nama bulan dalam Bahasa Indonesia (indeks 0 = Januari). */
const NAMA_BULAN = [
  'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
  'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
];

/** Filter "rupiah": 65000 -> "Rp 65.000". */
Vue.filter('rupiah', function (value) {
  const n = Number(value);
  if (value === null || value === undefined || value === '' || isNaN(n)) return '-';
  // Regex menyisipkan titik setiap 3 digit dari belakang.
  return 'Rp ' + String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, '.');
});

/** Filter "buah": 28 -> "28 buah". */
Vue.filter('buah', function (value) {
  if (value === null || value === undefined || value === '') return '-';
  return value + ' buah';
});

/**
 * Filter "tanggal": "2025-08-25" -> "25 Agustus 2025".
 * Juga menerima "2025-08-25 10:12:20" (bagian jam diabaikan).
 */
Vue.filter('tanggal', function (value) {
  if (!value) return '-';
  const m = String(value).match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return value;                           // format tak dikenal: tampilkan apa adanya
  // Number() menghapus angka 0 di depan; bulan dikurangi 1 karena indeks array mulai dari 0.
  return Number(m[3]) + ' ' + NAMA_BULAN[Number(m[2]) - 1] + ' ' + m[1];
});

/** Filter "tanggalWaktu": "2025-08-25 10:12:20" -> "25 Agustus 2025, 10:12:20". */
Vue.filter('tanggalWaktu', function (value) {
  if (!value) return '-';
  const m = String(value).match(/^(\d{4}-\d{2}-\d{2})[ T](\d{2}:\d{2}(?::\d{2})?)/);
  if (!m) return value;
  // Memanggil filter "tanggal" yang sudah terdaftar, lalu menambahkan jam.
  return Vue.options.filters.tanggal(m[1]) + ', ' + m[2];
});

// ---------------------------------------------------------------------------
// 2. KOMPONEN ROOT
// ---------------------------------------------------------------------------

/** Membuat dan memasang instance Vue root. Dipanggil setelah data siap. */
function startApp(initialState) {
  return new Vue({
    el: '#app',

    data: {
      tab: 'stok',          // tab aktif: 'stok' | 'tracking' | 'order' (pengganti router)
      state: initialState,  // seluruh data aplikasi (stok, tracking, paket, dll.)
      toast: null           // pesan singkat { text, type } atau null
    },

    computed: {
      /**
       * Nomor DO berikutnya, format: "DO" + tahun berjalan + "-" + nomor urut 3 digit.
       * Nomor urut dihitung per tahun: DO2026-001, DO2026-002, dst.
       * (Untuk mengikuti contoh soal "DO2025-001", ganti tahun di bawah menjadi 2025.)
       */
      nextDoNumber: function () {
        const year = new Date().getFullYear();   // tahun berjalan (ganti 2025 bila perlu)
        let maxSeq = 0;
        this.state.tracking.forEach(function (it) {
          // Pola: DO + 4 digit tahun + "-" + angka urut (3 atau 4 digit, dst.)
          const m = it.doNumber.match(/^DO(\d{4})-(\d+)$/);
          if (m && Number(m[1]) === year) {
            maxSeq = Math.max(maxSeq, Number(m[2]));
          }
        });
        // padStart menambahkan 0 di depan: 2 -> "002".
        return 'DO' + year + '-' + String(maxSeq + 1).padStart(3, '0');
      }
    },

    methods: {
      /** Menampilkan pesan singkat di pojok layar selama 3 detik. */
      notify: function (text, type) {
        this.toast = { text: text, type: type || 'success' };
        clearTimeout(this._toastTimer);
        const self = this;
        this._toastTimer = setTimeout(function () { self.toast = null; }, 3000);
      },

      // ----------------------- STOK -----------------------

      /** Event 'create' dari <ba-stock-table>: tambah baris stok baru. */
      handleCreateStok: function (item) {
        this.state.stok.push(item);
        this.notify('Bahan ajar ' + item.kode + ' berhasil ditambahkan.');
      },

      /** Event 'update' dari <ba-stock-table>: ganti baris lama dengan data baru. */
      handleUpdateStok: function (payload) {
        const index = this.state.stok.findIndex(function (it) {
          return Api.stokKey(it) === payload.key;
        });
        if (index === -1) return;
        // splice (bukan assignment indeks) agar perubahan array terdeteksi reaktif oleh Vue 2.
        this.state.stok.splice(index, 1, payload.data);
        this.notify('Data ' + payload.data.kode + ' berhasil diperbarui.');
      },

      /** Event 'delete' dari <ba-stock-table>: tampilkan konfirmasi, lalu hapus bila disetujui. */
      handleDeleteStok: async function (item) {
        // Menunggu pengguna menekan salah satu tombol pada pop-up.
        const yes = await this.$refs.modal.confirm({
          title: 'Hapus data bahan ajar?',
          message: 'Data "' + item.kode + ' - ' + item.judul + '" (' + item.upbjj + ') akan dihapus. Tindakan ini tidak dapat dibatalkan.',
          okText: 'Ya, hapus',
          cancelText: 'Batal'
        });
        if (!yes) return;   // dibatalkan

        const index = this.state.stok.findIndex(function (it) {
          return Api.stokKey(it) === Api.stokKey(item);
        });
        if (index !== -1) {
          this.state.stok.splice(index, 1);
          this.notify('Data ' + item.kode + ' telah dihapus.', 'danger');
        }
      },

      // ----------------------- DELIVERY ORDER -----------------------

      /** Event 'created' dari <order-form>: simpan DO baru lalu pindah ke tab Tracking. */
      handleNewDO: async function (newDO) {
        this.state.tracking.push(newDO);
        await this.$refs.modal.alert({
          title: 'Delivery Order berhasil dibuat',
          message: 'Nomor DO: ' + newDO.doNumber + '. Anda dapat melacaknya di tab Tracking DO.',
          okText: 'Lihat Tracking'
        });
        this.tab = 'tracking';
      },

      /** Event 'add-progress' dari <do-tracking>: tambah catatan perjalanan pada sebuah DO. */
      handleAddProgress: function (payload) {
        const target = this.state.tracking.find(function (it) {
          return it.doNumber === payload.doNumber;
        });
        if (!target) return;

        target.perjalanan.push({ waktu: payload.waktu, keterangan: payload.keterangan });
        // DO yang baru "Diproses" otomatis menjadi "Dalam Perjalanan" begitu ada progres pertama.
        if (target.status === 'Diproses') target.status = 'Dalam Perjalanan';
        this.notify('Progres ditambahkan pada ' + payload.doNumber + '.');
      }
    }
  });
}

// ---------------------------------------------------------------------------
// 3. START-UP: unduh template -> unduh data -> buat Vue
// ---------------------------------------------------------------------------
(async function bootstrap() {
  const boot = document.getElementById('boot-message');   // teks "Memuat..." di index.html
  try {
    await Api.loadTemplates();            // 1) pasang <template id="tpl-..."> ke halaman
    const data = await Api.loadData();    // 2) baca dataBahanAjar.json
    startApp(data);                       // 3) baru buat aplikasi Vue
    if (boot) boot.remove();              // sembunyikan teks "Memuat..."
  } catch (err) {
    // Gagal paling umum: file dibuka langsung (file://) sehingga fetch diblokir browser.
    if (boot) {
      boot.className = 'boot-error';
      boot.textContent = 'Aplikasi gagal dimuat: ' + err.message +
        '. Jalankan lewat server lokal (mis. "python -m http.server 8000" lalu buka http://localhost:8000), ' +
        'bukan dengan klik dua kali pada index.html.';
    }
    console.error(err);
  }
})();
