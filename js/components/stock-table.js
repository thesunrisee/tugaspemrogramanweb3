(function () {
  // Dibungkus fungsi anonim (IIFE) agar fungsi bantu di bawah tidak menjadi variabel global.

  /** Membuat objek formulir kosong (nilai awal saat tambah data). */
  function blankForm() {
    return {
      kode: '',
      judul: '',
      kategori: '',
      upbjj: '',
      lokasiRak: '',
      harga: '',
      qty: '',
      safety: '',
      catatan: ''
    };
  }

  /**
   * Membersihkan catatan sebelum disimpan (karena catatan ditampilkan dengan v-html).
   * Semua tanda < > & di-escape, lalu HANYA tag sederhana tanpa atribut
   * (<b> <i> <em> <strong> <u>) yang dikembalikan. Ini mencegah penyisipan
   * script/atribut berbahaya lewat kolom catatan.
   */
  function sanitizeCatatan(text) {
    const escaped = String(text)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
    return escaped.replace(/&lt;(\/?)(b|i|em|strong|u)&gt;/gi, '<$1$2>');
  }

  /** Apakah teks berisi bilangan bulat tak negatif (hanya angka 0-9)? */
  function isWholeNumber(value) {
    return /^\d+$/.test(String(value).trim());
  }

  Vue.component('ba-stock-table', {
    template: '#tpl-stock',

    // Data masukan dari induk (index.html -> :items, :upbjj-list, :kategori-list).
    props: {
      items: { type: Array, required: true },
      upbjjList: { type: Array, default: function () { return []; } },
      kategoriList: { type: Array, default: function () { return []; } }
    },

    // State lokal komponen.
    data: function () {
      return {
        // --- state filter & sort ---
        filterUpbjj: '',         // '' = semua UT-Daerah
        filterKategori: '',      // '' = semua kategori
        onlyReorder: false,      // true = hanya stok yang perlu re-order
        sortKey: '',             // '' | 'judul' | 'qty' | 'harga'
        sortDir: 'asc',          // 'asc' | 'desc'

        // --- state formulir tambah/ubah ---
        formVisible: false,      // formulir tampil atau tidak
        editingKey: null,        // null = mode tambah; selain itu = kunci baris yang diedit
        form: blankForm(),       // isi kolom formulir
        errors: {},              // pesan kesalahan per kolom, mis. { kode: '...' }

        // --- state tooltip catatan ---
        tooltip: { visible: false, html: '', x: 0, y: 0 }
      };
    },

    computed: {
      /**
       * Pilihan "Kategori" yang bergantung pada UT-Daerah terpilih (dependent options).
       * Kosong bila UT-Daerah belum dipilih, sehingga filter kategori belum ditampilkan.
       * Hanya kategori yang benar-benar ada di UT-Daerah tersebut yang muncul.
       */
      kategoriOptions: function () {
        if (!this.filterUpbjj) return [];
        const available = new Set(
          this.items
            .filter(function (it) { return it.upbjj === this.filterUpbjj; }, this)
            .map(function (it) { return it.kategori; })
        );
        // Urutan mengikuti kategoriList agar konsisten.
        return this.kategoriList.filter(function (k) { return available.has(k); });
      },

      /**
       * Data setelah difilter. Karena ini COMPUTED, hasilnya di-cache oleh Vue
       * dan hanya dihitung ulang bila items/filter berubah — bukan setiap render.
       * Itulah cara memenuhi syarat "filter tidak perlu recompute kembali".
       */
      filteredItems: function () {
        return this.items.filter(function (it) {
          if (this.filterUpbjj && it.upbjj !== this.filterUpbjj) return false;
          if (this.filterKategori && it.kategori !== this.filterKategori) return false;
          // Re-order: stok di bawah safety stock, atau stok kosong.
          if (this.onlyReorder && !(it.qty < it.safety || it.qty === 0)) return false;
          return true;
        }, this);
      },

      /**
       * Data yang ditampilkan = hasil filter lalu diurutkan.
       * Memakai slice() agar array asli (prop items) tidak ikut terurut.
       */
      visibleItems: function () {
        const list = this.filteredItems.slice();
        if (!this.sortKey) return list;                 // tanpa pengurutan

        const dir = this.sortDir === 'asc' ? 1 : -1;    // arah urutan
        const key = this.sortKey;
        return list.sort(function (a, b) {
          if (key === 'judul') return a.judul.localeCompare(b.judul, 'id') * dir;
          return (a[key] - b[key]) * dir;               // qty / harga: angka
        });
      },

      /** Jumlah baris per status (dipakai untuk ringkasan di atas tabel). */
      statusSummary: function () {
        const summary = { Aman: 0, Menipis: 0, Kosong: 0 };
        this.filteredItems.forEach(function (it) {
          summary[this.statusOf(it)]++;
        }, this);
        return summary;
      },

      /** true bila formulir sedang dipakai untuk mengubah data (bukan menambah). */
      isEditing: function () {
        return this.editingKey !== null;
      }
    },

    // Watcher: menjalankan kode ketika sebuah data berubah.
    watch: {
      // WATCHER 1 — saat UT-Daerah berganti, pilihan kategori lama bisa jadi
      // tidak berlaku lagi, jadi kategori di-reset.
      filterUpbjj: function () {
        this.filterKategori = '';
      },

      // WATCHER 2 — bila data yang sedang diedit hilang dari daftar
      // (mis. kuncinya berubah atau terhapus), tutup formulir.
      items: function (newItems) {
        if (this.editingKey === null) return;
        const stillExists = newItems.some(function (it) {
          return Api.stokKey(it) === this.editingKey;
        }, this);
        if (!stillExists) this.closeForm();
      }
    },

    methods: {
      /** Kunci unik baris untuk atribut :key pada v-for. */
      itemKey: function (item) {
        return Api.stokKey(item);
      },

      /** Menentukan status stok sebuah baris. */
      statusOf: function (item) {
        if (item.qty === 0) return 'Kosong';             // stok habis
        if (item.qty < item.safety) return 'Menipis';    // di bawah safety stock
        return 'Aman';                                   // qty >= safety
      },

      /** Mengembalikan semua filter ke kondisi awal (tombol Reset). */
      resetFilters: function () {
        this.filterUpbjj = '';
        this.filterKategori = '';
        this.onlyReorder = false;
        this.sortKey = '';
        this.sortDir = 'asc';
      },

      // ------------------------- tooltip catatan -------------------------

      /** Menampilkan tooltip catatan (HTML) di dekat kursor. */
      showTip: function (event, item) {
        this.tooltip.html = item.catatanHTML || '<em>Tidak ada catatan</em>';
        this.moveTip(event);
        this.tooltip.visible = true;
      },

      /** Menggeser tooltip mengikuti kursor, dijaga agar tidak keluar layar. */
      moveTip: function (event) {
        this.tooltip.x = Math.min(event.clientX + 14, window.innerWidth - 300);
        this.tooltip.y = event.clientY + 14;
      },

      /** Menyembunyikan tooltip. */
      hideTip: function () {
        this.tooltip.visible = false;
      },

      // ------------------------- formulir tambah / ubah -------------------------

      /** Membuka formulir kosong untuk menambah data. */
      openCreate: function () {
        this.editingKey = null;
        this.form = blankForm();
        this.errors = {};
        this.formVisible = true;
        this.focusFirstField();
      },

      /** Membuka formulir berisi data baris yang dipilih untuk diubah. */
      openEdit: function (item) {
        this.editingKey = Api.stokKey(item);
        this.form = {
          kode: item.kode,
          judul: item.judul,
          kategori: item.kategori,
          upbjj: item.upbjj,
          lokasiRak: item.lokasiRak,
          // Nilai angka diubah ke teks karena <input> bekerja dengan teks.
          harga: String(item.harga),
          qty: String(item.qty),
          safety: String(item.safety),
          catatan: item.catatanHTML || ''
        };
        this.errors = {};
        this.formVisible = true;
        this.focusFirstField();
      },

      /** Menutup formulir dan membersihkan isinya. */
      closeForm: function () {
        this.formVisible = false;
        this.editingKey = null;
        this.form = blankForm();
        this.errors = {};
      },

      /** Memindahkan kursor ke kolom pertama setelah formulir tampil di layar. */
      focusFirstField: function () {
        this.$nextTick(function () {
          const el = this.$refs.firstField;
          if (el) el.focus();
        });
      },

      /**
       * Menangani tombol Enter di formulir. Bila fokus ada di tombol,
       * biarkan tombol bekerja sendiri agar tidak tersimpan dua kali.
       */
      onFormEnter: function (event) {
        if (event.target.tagName === 'BUTTON') return;
        this.submit();
      },

      /** Mengecek apakah kombinasi kode + UT-Daerah sudah dipakai baris lain. */
      isDuplicate: function (kode, upbjj) {
        const key = kode + '|' + upbjj;
        return this.items.some(function (it) {
          // Baris yang sedang diedit dikecualikan dari pengecekan.
          return Api.stokKey(it) === key && key !== this.editingKey;
        }, this);
      },

      /** Validasi sederhana semua kolom. Mengembalikan objek { namaKolom: pesan }. */
      validate: function () {
        const f = this.form;
        const e = {};
        const kode = f.kode.trim().toUpperCase();

        if (!kode) {
          e.kode = 'Kode wajib diisi.';
        } else if (!/^[A-Z]{2,6}\d{3,5}$/.test(kode)) {
          e.kode = 'Format kode: huruf lalu angka, mis. EKMA4116.';
        } else if (f.upbjj && this.isDuplicate(kode, f.upbjj)) {
          e.kode = 'Kode ini sudah ada di UT-Daerah tersebut.';
        }

        if (f.judul.trim().length < 3) e.judul = 'Judul minimal 3 karakter.';
        if (!f.kategori) e.kategori = 'Pilih kategori.';
        if (!f.upbjj) e.upbjj = 'Pilih UT-Daerah.';

        if (!/^[A-Za-z0-9-]{2,10}$/.test(f.lokasiRak.trim())) {
          e.lokasiRak = 'Lokasi rak 2-10 karakter huruf/angka/tanda -, mis. R1-A3.';
        }

        if (!isWholeNumber(f.harga) || Number(f.harga) <= 0) {
          e.harga = 'Harga harus bilangan bulat lebih dari 0.';
        }
        if (!isWholeNumber(f.qty)) e.qty = 'Jumlah stok harus bilangan bulat >= 0.';
        if (!isWholeNumber(f.safety)) e.safety = 'Safety stock harus bilangan bulat >= 0.';

        return e;
      },

      /**
       * Menyimpan formulir (tambah ATAU ubah, tergantung mode).
       * Dipanggil oleh tombol Simpan dan oleh tombol keyboard Enter.
       */
      submit: function () {
        this.errors = this.validate();
        if (Object.keys(this.errors).length > 0) return;   // ada kesalahan -> berhenti

        const f = this.form;
        // Susun objek data bersih dengan tipe yang benar (angka sungguhan, bukan teks).
        const data = {
          kode: f.kode.trim().toUpperCase(),
          judul: f.judul.trim(),
          kategori: f.kategori,
          upbjj: f.upbjj,
          lokasiRak: f.lokasiRak.trim().toUpperCase(),
          harga: Number(f.harga),
          qty: Number(f.qty),
          safety: Number(f.safety),
          catatanHTML: sanitizeCatatan(f.catatan.trim())
        };

        if (this.isEditing) {
          this.$emit('update', { key: this.editingKey, data: data });   // beri tahu induk: ubah
        } else {
          this.$emit('create', data);                                   // beri tahu induk: tambah
        }
        this.closeForm();
      },

      /** Meminta induk menghapus baris (induk yang menampilkan konfirmasi). */
      requestDelete: function (item) {
        this.$emit('delete', item);
      }
    }
  });
})();
