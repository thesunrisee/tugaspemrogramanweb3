Vue.component('status-badge', {
  // Mengambil template dari elemen <template id="tpl-badge">.
  template: '#tpl-badge',

  // Props = data yang dikirim dari komponen induk.
  props: {
    // Nama status; menentukan warna dan simbol.
    status: { type: String, required: true },
    // Teks yang ditampilkan. Jika kosong, dipakai nilai "status".
    label: { type: String, default: '' }
  },

  // Computed property: dihitung ulang hanya saat "status" berubah.
  computed: {
    // Memilih nama kelas CSS sesuai status (warna hijau/oranye/merah/biru/abu).
    badgeClass: function () {
      const map = {
        'Aman': 'badge-ok',
        'Menipis': 'badge-warn',
        'Kosong': 'badge-danger',
        'Terkirim': 'badge-ok',
        'Dalam Perjalanan': 'badge-info',
        'Diproses': 'badge-neutral'
      };
      return map[this.status] || 'badge-neutral';   // status tak dikenal => abu-abu
    }
  }
});
