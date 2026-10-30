Vue.component('do-tracking', {
  template: '#tpl-tracking',

  props: {
    // Daftar seluruh Delivery Order (array datar hasil normalisasi di api.js).
    items: { type: Array, required: true },
    // Daftar paket (untuk menampilkan nama & isi paket dari kode paket).
    paket: { type: Array, default: function () { return []; } },
    // Daftar stok (untuk menerjemahkan kode mata kuliah menjadi judulnya).
    stok: { type: Array, default: function () { return []; } }
  },

  data: function () {
    return {
      keyword: '',            // teks yang sedang diketik di kolom pencarian
      submittedKeyword: '',   // kata kunci yang sudah "dikirim" dengan menekan Enter
      progressDraft: {},      // keterangan progres yang sedang diketik, per nomor DO
      progressErrors: {}      // pesan kesalahan progres, per nomor DO
    };
  },

  computed: {
    /**
     * Hasil pencarian. Bila belum ada kata kunci, semua DO ditampilkan.
     * Pencocokan tidak membedakan huruf besar/kecil dan boleh sebagian teks.
     */
    results: function () {
      const k = this.submittedKeyword.trim().toLowerCase();
      if (!k) return this.items;
      return this.items.filter(function (it) {
        return it.doNumber.toLowerCase().indexOf(k) !== -1 ||
               String(it.nim).toLowerCase().indexOf(k) !== -1;
      });
    },

    /** true bila pencarian sedang aktif (sudah ada kata kunci yang dikirim). */
    isSearching: function () {
      return this.submittedKeyword.trim() !== '';
    }
  },

  methods: {
    /** Menjalankan pencarian (dipanggil oleh tombol Cari dan tombol Enter). */
    submitSearch: function () {
      this.submittedKeyword = this.keyword;
    },

    /** Menghapus pencarian (dipanggil oleh tombol Reset dan tombol Esc). */
    clearSearch: function () {
      this.keyword = '';
      this.submittedKeyword = '';
    },

    /** Mengambil nama paket berdasarkan kodenya. */
    paketName: function (kode) {
      const p = this.paket.find(function (x) { return x.kode === kode; });
      return p ? p.nama : kode;   // jika tidak ketemu, tampilkan kodenya saja
    },

    /**
     * Mengambil isi paket sebagai daftar teks "KODE - Judul".
     * Judul dicari dari data stok; bila tidak ada, hanya kode yang ditampilkan.
     */
    paketIsi: function (kode) {
      const p = this.paket.find(function (x) { return x.kode === kode; });
      if (!p) return [];
      return p.isi.map(function (kodeMk) {
        const s = this.stok.find(function (x) { return x.kode === kodeMk; });
        return s ? kodeMk + ' - ' + s.judul : kodeMk;
      }, this);
    },

    /** Menyimpan teks yang diketik pada kolom progres milik satu DO. */
    setDraft: function (doNumber, value) {
      // $set dipakai karena properti baru pada objek harus dibuat reaktif secara manual (Vue 2).
      this.$set(this.progressDraft, doNumber, value);
      if (this.progressErrors[doNumber]) this.$set(this.progressErrors, doNumber, '');
    },

    /**
     * Menambah progres perjalanan. Waktu diambil dari jam lokal perangkat,
     * keterangan dari input pengguna.
     */
    addProgress: function (item) {
      const text = (this.progressDraft[item.doNumber] || '').trim();

      // Validasi sederhana: keterangan wajib diisi, minimal 3 karakter.
      if (text.length < 3) {
        this.$set(this.progressErrors, item.doNumber, 'Keterangan minimal 3 karakter.');
        return;
      }

      this.$emit('add-progress', {
        doNumber: item.doNumber,
        waktu: Api.nowTimestamp(),
        keterangan: text
      });

      // Kosongkan kolom input setelah tersimpan.
      this.$set(this.progressDraft, item.doNumber, '');
      this.$set(this.progressErrors, item.doNumber, '');
    }
  }
});
