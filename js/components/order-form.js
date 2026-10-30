Vue.component('order-form', {
  template: '#tpl-order',

  props: {
    // Daftar paket bahan ajar (kode, nama, isi, harga).
    paket: { type: Array, required: true },
    // Daftar jenis pengiriman, mis. [{ kode: 'REG', nama: 'Reguler (3-5 hari)' }].
    ekspedisi: { type: Array, required: true },
    // Data stok, dipakai untuk menampilkan judul mata kuliah di isi paket.
    stok: { type: Array, default: function () { return []; } },
    // Nomor DO berikutnya yang sudah dihitung induk, mis. "DO2026-001".
    nextDoNumber: { type: String, required: true }
  },

  data: function () {
    return {
      form: {
        nim: '',
        nama: '',
        ekspedisiKode: '',
        paketKode: '',
        tanggalKirim: Api.todayISO()   // nilai awal: tanggal hari ini
      },
      errors: {}                       // pesan kesalahan per kolom
    };
  },

  computed: {
    /** Objek paket yang sedang dipilih (undefined bila belum memilih). */
    selectedPaket: function () {
      return this.paket.find(function (p) { return p.kode === this.form.paketKode; }, this);
    },

    /** Objek jenis pengiriman yang sedang dipilih. */
    selectedEkspedisi: function () {
      return this.ekspedisi.find(function (e) { return e.kode === this.form.ekspedisiKode; }, this);
    },

    /** Total harga = harga paket terpilih (0 bila belum memilih paket). */
    totalHarga: function () {
      return this.selectedPaket ? this.selectedPaket.harga : 0;
    },

    /** Isi paket terpilih sebagai daftar { kode, judul } untuk ditampilkan. */
    isiPaket: function () {
      if (!this.selectedPaket) return [];
      return this.selectedPaket.isi.map(function (kodeMk) {
        const s = this.stok.find(function (x) { return x.kode === kodeMk; });
        return { kode: kodeMk, judul: s ? s.judul : '(judul tidak ditemukan)' };
      }, this);
    }
  },

  watch: {
    // WATCHER 3 — NIM hanya boleh angka dan maksimal 12 digit; karakter lain dibuang otomatis.
    'form.nim': function (value) {
      const cleaned = String(value).replace(/\D/g, '').slice(0, 12);
      if (cleaned !== value) this.form.nim = cleaned;
      if (this.errors.nim) this.$delete(this.errors, 'nim');
    },

    // WATCHER 4 — begitu paket dipilih, pesan kesalahan paket dihapus.
    'form.paketKode': function () {
      if (this.errors.paketKode) this.$delete(this.errors, 'paketKode');
    }
  },

  methods: {
    /** Mengisi tanggal kirim dengan tanggal hari ini (tombol "Hari ini"). */
    setToday: function () {
      this.form.tanggalKirim = Api.todayISO();
    },

    /** Validasi sederhana semua kolom. Mengembalikan objek { namaKolom: pesan }. */
    validate: function () {
      const f = this.form;
      const e = {};
      if (!/^\d{8,12}$/.test(f.nim)) e.nim = 'NIM harus 8-12 digit angka.';
      if (f.nama.trim().length < 3) e.nama = 'Nama minimal 3 karakter.';
      if (!f.ekspedisiKode) e.ekspedisiKode = 'Pilih jenis ekspedisi.';
      if (!f.paketKode) e.paketKode = 'Pilih paket bahan ajar.';
      if (!f.tanggalKirim) e.tanggalKirim = 'Tanggal kirim wajib diisi.';
      return e;
    },

    /** Menangani Enter di formulir (kecuali saat fokus ada di tombol). */
    onFormEnter: function (event) {
      if (event.target.tagName === 'BUTTON') return;
      this.submit();
    },

    /** Mengosongkan formulir ke kondisi awal. */
    resetForm: function () {
      this.form = {
        nim: '',
        nama: '',
        ekspedisiKode: '',
        paketKode: '',
        tanggalKirim: Api.todayISO()
      };
      this.errors = {};
    },

    /** Memvalidasi lalu mengirim DO baru ke induk. */
    submit: function () {
      this.errors = this.validate();
      if (Object.keys(this.errors).length > 0) return;   // ada kesalahan -> berhenti

      const f = this.form;
      // Susun objek DO baru dengan struktur yang sama seperti data di JSON.
      const newDO = {
        doNumber: this.nextDoNumber,
        nim: f.nim,
        nama: f.nama.trim(),
        status: 'Diproses',
        ekspedisi: 'JNE',                        // semua layanan pengiriman memakai JNE
        layanan: this.selectedEkspedisi.nama,    // mis. "Reguler (3-5 hari)"
        tanggalKirim: f.tanggalKirim,
        paket: f.paketKode,
        total: this.totalHarga,
        perjalanan: [
          { waktu: Api.nowTimestamp(), keterangan: 'Delivery Order dibuat' }
        ]
      };

      this.$emit('created', newDO);   // beri tahu induk
      this.resetForm();
    }
  }
});
