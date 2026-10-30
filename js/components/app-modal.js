Vue.component('app-modal', {
  template: '#tpl-modal',

  // Data internal modal (state lokal komponen).
  data: function () {
    return {
      visible: false,        // true = modal sedang tampil
      mode: 'alert',         // 'alert' (1 tombol) atau 'confirm' (2 tombol)
      title: '',
      message: '',
      okText: 'OK',
      cancelText: 'Batal',
      resolver: null         // fungsi penyelesai Promise yang sedang menunggu
    };
  },

  methods: {
    /**
     * Membuka modal. Mengembalikan Promise<boolean>:
     * true bila pengguna menekan tombol utama, false bila membatalkan.
     */
    open: function (options) {
      // Gabungkan opsi dari pemanggil dengan nilai bawaan.
      this.mode = options.mode || 'alert';
      this.title = options.title || '';
      this.message = options.message || '';
      this.okText = options.okText || 'OK';
      this.cancelText = options.cancelText || 'Batal';
      this.visible = true;

      const self = this;
      return new Promise(function (resolve) {
        self.resolver = resolve;   // disimpan; dipanggil saat ok()/cancel()
      });
    },

    /** Modal dengan dua tombol (mis. konfirmasi hapus). */
    confirm: function (options) {
      return this.open(Object.assign({}, options, { mode: 'confirm' }));
    },

    /** Modal informasi dengan satu tombol. */
    alert: function (options) {
      return this.open(Object.assign({}, options, { mode: 'alert' }));
    },

    /** Dipanggil saat tombol utama ditekan. */
    ok: function () {
      this.close(true);
    },

    /** Dipanggil saat tombol Batal / area gelap / tombol Esc ditekan. */
    cancel: function () {
      // Untuk 'alert', menutup dengan Esc dianggap sama dengan OK.
      this.close(this.mode === 'alert');
    },

    /** Menutup modal dan menyelesaikan Promise dengan nilai tertentu. */
    close: function (result) {
      this.visible = false;
      if (this.resolver) {
        this.resolver(result);
        this.resolver = null;
      }
    },

    /** Menangani tombol keyboard global: Esc menutup modal yang sedang tampil. */
    onKeydown: function (event) {
      if (this.visible && event.key === 'Escape') {
        this.cancel();
      }
    }
  },

  // Lifecycle hook: dipanggil sekali setelah komponen terpasang di halaman.
  mounted: function () {
    document.addEventListener('keydown', this.onKeydown);
  },

  // Lifecycle hook: bersihkan listener saat komponen dibuang (mencegah kebocoran memori).
  beforeDestroy: function () {
    document.removeEventListener('keydown', this.onKeydown);
  }
});
