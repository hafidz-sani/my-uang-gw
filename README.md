# Panduan Pembuatan Aplikasi Keuangan: "my-uang-gw" + Notifikasi Telegram

Aplikasi **my-uang-gw** dirancang berbasis **Google Apps Script Web App** dengan **Google Sheets** sebagai basis data gratis serta terhubung langsung ke **Bot Telegram** untuk notifikasi transaksi instan dan rekap otomatis (harian, mingguan, dan bulanan).

---

## 1. Arsitektur & Alur Kerja

```
[ Antarmuka Web / HP ] (Index.html)
        │
        │ google.script.run
        ▼
[ Backend Logic ] (Code.gs) ──────────► [ Bot Telegram ]
        │                                 (Notif Instan & Rekap Terjadwal)
        │ SpreadsheetApp API
        ▼
[ Database ] (Google Sheets: Transaksi)
```

---

## 2. Langkah 1: Persiapan Google Sheets

1. Buka [Google Sheets](https://docs.google.com/spreadsheets) baru.
2. Beri nama spreadsheet: **`DB_my-uang-gw`**.
3. Pastikan sheet pertama bernama **`Transaksi`**.
4. Masukkan nama kolom pada baris ke-1 (Header):
   * **A1**: `ID`
   * **B1**: `Tanggal`
   * **C1**: `Tipe` (Pemasukan / Pengeluaran)
   * **D1**: `Kategori`
   * **E1**: `Nominal`
   * **F1**: `Keterangan`
5. *(Opsional)* Format kolom `E` sebagai angka mata uang (Rp).

---

## 3. Langkah 2: Membuat Bot Telegram & Mendapatkan Chat ID

Untuk mengirimkan notifikasi ke Telegram pribadi Anda, siapkan Token Bot dan ID Akun Anda:

### A. Buat Bot dan Dapatkan Token
1. Buka aplikasi Telegram, cari akun **`@BotFather`** (dengan centang biru verified).
2. Kirim perintah `/newbot`.
3. Masukkan nama tampilan bot Anda, misalnya: `My Uang Gw Notif`.
4. Masukkan username unik bot yang diakhiri kata `bot`, misalnya: `myuang_gw_bot`.
5. Salin kode **HTTP API Token** yang diberikan (contoh: `7123456789:AAFn...`). Simpan token ini.

### B. Dapatkan Telegram Chat ID Anda
1. Di Telegram, cari bot **`@userinfobot`**.
2. Klik tombol **Start**. Bot akan membalas dengan info profil Anda beserta **Id** berupa deretan angka (contoh: `123456789`).
3. Cari kembali bot yang baru saja Anda buat di langkah A, lalu klik **Start** (agar bot memiliki izin mengirimkan pesan ke akun Anda).

---

## 4. Langkah 3: Kode Backend (`Code.gs`)

1. Pada Google Sheets, buka menu **Ekstensi** > **Apps Script**.
2. Beri nama proyek: **`my-uang-gw`**.
3. Ganti seluruh isi `Code.gs` dengan kode berikut, lalu **masukkan Token Bot dan Chat ID** Anda pada baris konfigurasi di bagian atas:

```javascript
/**
 * my-uang-gw: Backend Controller & Telegram Bot Integration
 */

// ==========================================
// KONFIGURASI TELEGRAM (Ganti dengan milik Anda)
// ==========================================
const TELEGRAM_BOT_TOKEN = 'MASUKKAN_BOT_TOKEN_TELEGRAM';
const TELEGRAM_CHAT_ID   = 'MASUKKAN_CHAT_ID_ANDA';

// Menampilkan halaman antarmuka web
function doGet() {
  return HtmlService.createTemplateFromFile('Index')
    .evaluate()
    .setTitle('my-uang-gw | Pencatat Keuangan')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

// Mengambil atau membuat sheet Transaksi
function getSheetTransaksi() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName('Transaksi');
  if (!sheet) {
    sheet = ss.insertSheet('Transaksi');
    sheet.appendRow(['ID', 'Tanggal', 'Tipe', 'Kategori', 'Nominal', 'Keterangan']);
  }
  return sheet;
}

// Format angka ke format Rupiah
function formatRupiahServer(angka) {
  return 'Rp ' + Number(angka).toLocaleString('id-ID');
}

// Fungsi pengiriman pesan ke Telegram
function kirimPesanTelegram(pesanHtml) {
  if (!TELEGRAM_BOT_TOKEN || TELEGRAM_BOT_TOKEN === 'MASUKKAN_BOT_TOKEN_TELEGRAM') {
    Logger.log('Token Telegram belum dikonfigurasi.');
    return;
  }
  
  const url = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`;
  const payload = {
    chat_id: TELEGRAM_CHAT_ID,
    text: pesanHtml,
    parse_mode: 'HTML'
  };

  const options = {
    method: 'post',
    contentType: 'application/json',
    payload: JSON.stringify(payload),
    muteHttpExceptions: true
  };

  try {
    UrlFetchApp.fetch(url, options);
  } catch (err) {
    Logger.log('Gagal mengirim Telegram: ' + err.message);
  }
}

// 1. Simpan Transaksi Baru & Kirim Notifikasi Langsung
function simpanTransaksi(data) {
  try {
    const sheet = getSheetTransaksi();
    const id = 'TRX-' + Utilities.formatDate(new Date(), 'Asia/Jakarta', 'yyyyMMdd-HHmmss');
    const tanggal = data.tanggal || Utilities.formatDate(new Date(), 'Asia/Jakarta', 'yyyy-MM-dd');
    const tipe = data.tipe; // 'Pemasukan' atau 'Pengeluaran'
    const kategori = data.kategori;
    const nominal = Number(data.nominal);
    const keterangan = data.keterangan || '-';

    sheet.appendRow([id, tanggal, tipe, kategori, nominal, keterangan]);

    // Kirim notifikasi Telegram instan
    const icon = tipe === 'Pemasukan' ? '💰' : '💸';
    const pesanNotif = 
      `<b>${icon} Transaksi Baru Dicatat!</b>\n` +
      `────────────────────\n` +
      `• <b>Tipe:</b> ${tipe}\n` +
      `• <b>Nominal:</b> ${formatRupiahServer(nominal)}\n` +
      `• <b>Kategori:</b> ${kategori}\n` +
      `• <b>Tanggal:</b> ${tanggal}\n` +
      `• <b>Catatan:</b> ${keterangan}\n` +
      `────────────────────\n` +
      `<i>Dicatat via my-uang-gw</i>`;
    
    kirimPesanTelegram(pesanNotif);

    return { status: 'success', message: 'Transaksi berhasil dicatat!' };
  } catch (err) {
    return { status: 'error', message: err.message };
  }
}

// 2. Ambil data saldo & ringkasan untuk Web App
function getDashboardData() {
  try {
    const sheet = getSheetTransaksi();
    const rows = sheet.getDataRange().getValues();
    
    let totalPemasukan = 0;
    let totalPengeluaran = 0;
    let riwayat = [];

    for (let i = 1; i < rows.length; i++) {
      const [id, tgl, tipe, kategori, nominal, ket] = rows[i];
      const nilai = Number(nominal) || 0;
      
      if (tipe === 'Pemasukan') totalPemasukan += nilai;
      if (tipe === 'Pengeluaran') totalPengeluaran += nilai;

      let formattedDate = tgl;
      if (tgl instanceof Date) {
        formattedDate = Utilities.formatDate(tgl, 'Asia/Jakarta', 'yyyy-MM-dd');
      }

      riwayat.push({
        id: id,
        tanggal: formattedDate,
        tipe: tipe,
        kategori: kategori,
        nominal: nilai,
        keterangan: ket
      });
    }

    riwayat.reverse();

    return {
      status: 'success',
      saldo: totalPemasukan - totalPengeluaran,
      totalPemasukan: totalPemasukan,
      totalPengeluaran: totalPengeluaran,
      riwayat: riwayat.slice(0, 10)
    };
  } catch (err) {
    return { status: 'error', message: err.message };
  }
}

// Helper untuk normalisasi string tanggal (yyyy-MM-dd)
function normalisasiTanggal(tgl) {
  if (tgl instanceof Date) {
    return Utilities.formatDate(tgl, 'Asia/Jakarta', 'yyyy-MM-dd');
  }
  return String(tgl).substring(0, 10);
}

// ==========================================
// REKAP OTOMATIS TELEGRAM
// ==========================================

// 3. Rekap Harian (Dijalankan tiap malam, misal jam 21:00)
function kirimRekapHarian() {
  const sheet = getSheetTransaksi();
  const rows = sheet.getDataRange().getValues();
  const todayStr = Utilities.formatDate(new Date(), 'Asia/Jakarta', 'yyyy-MM-dd');
  
  let pemasukanHariIni = 0;
  let pengeluaranHariIni = 0;
  let jumlahTrx = 0;

  for (let i = 1; i < rows.length; i++) {
    const [, tgl, tipe, , nominal] = rows[i];
    const tglBaris = normalisasiTanggal(tgl);

    if (tglBaris === todayStr) {
      jumlahTrx++;
      const nilai = Number(nominal) || 0;
      if (tipe === 'Pemasukan') pemasukanHariIni += nilai;
      if (tipe === 'Pengeluaran') pengeluaranHariIni += nilai;
    }
  }

  const selisih = pemasukanHariIni - pengeluaranHariIni;
  const statusHari = selisih >= 0 ? '🟢 Surplus' : '🔴 Defisit';

  const pesan = 
    `<b>📊 REKAP KEUANGAN HARIAN</b>\n` +
    `📅 <i>${todayStr}</i>\n` +
    `────────────────────\n` +
    `• Total Transaksi: <b>${jumlahTrx}</b>\n` +
    `• Pemasukan: <font color="#22c55e"><b>${formatRupiahServer(pemasukanHariIni)}</b></font>\n` +
    `• Pengeluaran: <font color="#ef4444"><b>${formatRupiahServer(pengeluaranHariIni)}</b></font>\n` +
    `────────────────────\n` +
    `• Hasil Hari Ini: <b>${formatRupiahServer(selisih)}</b> (${statusHari})\n\n` +
    `<i>Selalu kontrol pengeluaran harianmu! 🚀</i>`;

  kirimPesanTelegram(pesan);
}

// 4. Rekap Mingguan (Dijalankan tiap akhir pekan, misal Minggu malam)
function kirimRekapMingguan() {
  const sheet = getSheetTransaksi();
  const rows = sheet.getDataRange().getValues();
  
  const now = new Date();
  const tujuhHariLalu = new Date(now.getTime() - (7 * 24 * 60 * 60 * 1000));
  const batasAwalStr = Utilities.formatDate(tujuhHariLalu, 'Asia/Jakarta', 'yyyy-MM-dd');
  const hariIniStr = Utilities.formatDate(now, 'Asia/Jakarta', 'yyyy-MM-dd');

  let pemasukan = 0;
  let pengeluaran = 0;
  let kategoriPengeluaran = {};

  for (let i = 1; i < rows.length; i++) {
    const [, tgl, tipe, kategori, nominal] = rows[i];
    const tglBaris = normalisasiTanggal(tgl);

    if (tglBaris >= batasAwalStr && tglBaris <= hariIniStr) {
      const nilai = Number(nominal) || 0;
      if (tipe === 'Pemasukan') {
        pemasukan += nilai;
      } else if (tipe === 'Pengeluaran') {
        pengeluaran += nilai;
        kategoriPengeluaran[kategori] = (kategoriPengeluaran[kategori] || 0) + nilai;
      }
    }
  }

  // Rincian kategori pengeluaran terbesar
  let teksKategori = '';
  const sortedKat = Object.entries(kategoriPengeluaran).sort((a, b) => b[1] - a[1]);
  if (sortedKat.length > 0) {
    teksKategori = '\n<b>Pengeluaran per Kategori:</b>\n' + 
      sortedKat.map(([k, v]) => ` • ${k}: ${formatRupiahServer(v)}`).join('\n');
  }

  const pesan = 
    `<b>📈 REKAP KEUANGAN MINGGUAN (7 HARI)</b>\n` +
    `📅 <i>${batasAwalStr} s.d ${hariIniStr}</i>\n` +
    `────────────────────\n` +
    `• Total Pemasukan : <b>${formatRupiahServer(pemasukan)}</b>\n` +
    `• Total Pengeluaran: <b>${formatRupiahServer(pengeluaran)}</b>\n` +
    `• Selisih Bersih   : <b>${formatRupiahServer(pemasukan - pengeluaran)}</b>\n` +
    `────────────────────` +
    teksKategori +
    `\n\n<i>Evaluasi pengeluaran mingguanmu agar cashflow tetap aman! ✨</i>`;

  kirimPesanTelegram(pesan);
}

// 5. Rekap Bulanan (Dijalankan tiap akhir bulan / tanggal 1)
function kirimRekapBulanan() {
  const sheet = getSheetTransaksi();
  const rows = sheet.getDataRange().getValues();
  
  // Format bulan ini: "yyyy-MM"
  const bulanIniPrefix = Utilities.formatDate(new Date(), 'Asia/Jakarta', 'yyyy-MM');
  const namaBulan = Utilities.formatDate(new Date(), 'Asia/Jakarta', 'MMMM yyyy');

  let pemasukan = 0;
  let pengeluaran = 0;
  let totalSaldoAkumulasi = 0;

  for (let i = 1; i < rows.length; i++) {
    const [, tgl, tipe, , nominal] = rows[i];
    const nilai = Number(nominal) || 0;
    const tglBaris = normalisasiTanggal(tgl);

    // Akumulasi keseluruhan saldo
    if (tipe === 'Pemasukan') totalSaldoAkumulasi += nilai;
    if (tipe === 'Pengeluaran') totalSaldoAkumulasi -= nilai;

    // Filter khusus bulan berjalan
    if (tglBaris.startsWith(bulanIniPrefix)) {
      if (tipe === 'Pemasukan') pemasukan += nilai;
      if (tipe === 'Pengeluaran') pengeluaran += nilai;
    }
  }

  const rasioTabungan = pemasukan > 0 
    ? Math.round(((pemasukan - pengeluaran) / pemasukan) * 100) 
    : 0;

  const pesan = 
    `<b>🏆 REKAP KEUANGAN BULANAN</b>\n` +
    `🗓 Periode: <b>${namaBulan}</b>\n` +
    `────────────────────\n` +
    `• Pemasukan Bulan Ini  : <b>${formatRupiahServer(pemasukan)}</b>\n` +
    `• Pengeluaran Bulan Ini: <b>${formatRupiahServer(pengeluaran)}</b>\n` +
    `• Selisih (Net Cash)   : <b>${formatRupiahServer(pemasukan - pengeluaran)}</b>\n` +
    `• Tabungan (Savings Rate): <b>${rasioTabungan}%</b>\n` +
    `────────────────────\n` +
    `💰 <b>Total Saldo Kas Saat Ini: ${formatRupiahServer(totalSaldoAkumulasi)}</b>\n\n` +
    `<i>Bagus! Pertahankan disiplin keuangan bulan depan. 🎯</i>`;

  kirimPesanTelegram(pesan);
}
```

---

## 5. Langkah 4: Kode Tampilan (`Index.html`)

1. Di Apps Script, klik tombol **`+`** di menu file kiri > pilih **HTML**.
2. Beri nama file: **`Index`**.
3. Masukkan kode antarmuka berikut:

```html
<!DOCTYPE html>
<html lang="id">
<head>
  <meta charset="UTF-8">
  <title>my-uang-gw</title>
  <script src="https://cdn.tailwindcss.com"></script>
  <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700&display=swap" rel="stylesheet">
  <style>
    body { font-family: 'Plus Jakarta Sans', sans-serif; }
  </style>
</head>
<body class="bg-slate-50 text-slate-800 antialiased min-h-screen pb-16">

  <!-- Header -->
  <header class="bg-indigo-600 text-white shadow-md sticky top-0 z-10">
    <div class="max-w-md mx-auto px-4 py-3.5 flex justify-between items-center">
      <div>
        <h1 class="text-lg font-bold tracking-tight">my-uang-gw</h1>
        <p class="text-xs text-indigo-200">Catat rapi, dompet aman ⚡</p>
      </div>
      <button onclick="muatData()" class="text-xs bg-indigo-500 hover:bg-indigo-700 px-3 py-1.5 rounded-lg font-medium transition">
        Segarkan
      </button>
    </div>
  </header>

  <main class="max-w-md mx-auto px-4 mt-5 space-y-5">
    
    <!-- Kartu Saldo & Ringkasan -->
    <section class="bg-gradient-to-tr from-indigo-700 to-indigo-500 text-white rounded-2xl p-5 shadow-lg shadow-indigo-100">
      <p class="text-xs text-indigo-200 font-medium">Total Saldo Saat Ini</p>
      <h2 id="saldoTotal" class="text-2xl font-bold mt-1 tracking-tight">Memuat...</h2>

      <div class="grid grid-cols-2 gap-3 mt-4 pt-4 border-t border-indigo-400/40">
        <div>
          <span class="text-[11px] text-indigo-200 block">Total Pemasukan</span>
          <span id="txtPemasukan" class="text-sm font-semibold text-emerald-300">Rp 0</span>
        </div>
        <div>
          <span class="text-[11px] text-indigo-200 block">Total Pengeluaran</span>
          <span id="txtPengeluaran" class="text-sm font-semibold text-rose-300">Rp 0</span>
        </div>
      </div>
    </section>

    <!-- Notifikasi Sukses Telegram (Badge Status) -->
    <div id="badgeStatus" class="hidden p-3 bg-indigo-50 border border-indigo-100 rounded-xl text-xs text-indigo-700 items-center gap-2">
      <span>✈️ Transaksi tersimpan & diteruskan ke Telegram!</span>
    </div>

    <!-- Formulir Catat Transaksi -->
    <section class="bg-white rounded-2xl p-5 shadow-sm border border-slate-100">
      <h3 class="text-sm font-bold text-slate-700 mb-3">Catat Transaksi Baru</h3>
      
      <form id="formTransaksi" onsubmit="handleFormSubmit(event)" class="space-y-3.5">
        
        <!-- Toggle Tipe Transaksi -->
        <div class="grid grid-cols-2 gap-2 bg-slate-100 p-1 rounded-xl">
          <label class="cursor-pointer text-center">
            <input type="radio" name="tipe" value="Pengeluaran" checked class="peer sr-only" onchange="updateKategoriOptions()">
            <div class="py-2 text-xs font-semibold rounded-lg text-slate-600 peer-checked:bg-rose-500 peer-checked:text-white transition">
              Pengeluaran
            </div>
          </label>
          <label class="cursor-pointer text-center">
            <input type="radio" name="tipe" value="Pemasukan" class="peer sr-only" onchange="updateKategoriOptions()">
            <div class="py-2 text-xs font-semibold rounded-lg text-slate-600 peer-checked:bg-emerald-500 peer-checked:text-white transition">
              Pemasukan
            </div>
          </label>
        </div>

        <!-- Nominal -->
        <div>
          <label class="block text-xs font-semibold text-slate-600 mb-1">Nominal (Rp)</label>
          <input type="number" id="nominal" required placeholder="0" min="1"
            class="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500">
        </div>

        <!-- Kategori & Tanggal -->
        <div class="grid grid-cols-2 gap-3">
          <div>
            <label class="block text-xs font-semibold text-slate-600 mb-1">Kategori</label>
            <select id="kategori" required
              class="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500">
            </select>
          </div>
          <div>
            <label class="block text-xs font-semibold text-slate-600 mb-1">Tanggal</label>
            <input type="date" id="tanggal" required
              class="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500">
          </div>
        </div>

        <!-- Keterangan / Catatan -->
        <div>
          <label class="block text-xs font-semibold text-slate-600 mb-1">Keterangan (Opsional)</label>
          <input type="text" id="keterangan" placeholder="Contoh: Makan siang, Kopi, Bonus"
            class="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500">
        </div>

        <button type="submit" id="btnSubmit"
          class="w-full py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-sm font-semibold shadow-md transition disabled:opacity-50">
          Simpan Transaksi
        </button>
      </form>
    </section>

    <!-- Riwayat Transaksi -->
    <section class="bg-white rounded-2xl p-5 shadow-sm border border-slate-100">
      <div class="flex justify-between items-center mb-3">
        <h3 class="text-sm font-bold text-slate-700">10 Transaksi Terakhir</h3>
      </div>
      <div id="listRiwayat" class="divide-y divide-slate-100 text-sm">
        <p class="text-xs text-slate-400 py-3 text-center">Memuat riwayat transaksi...</p>
      </div>
    </section>

  </main>

  <script>
    const kategoriPengeluaran = ['Makan & Minum', 'Transportasi', 'Belanja', 'Tagihan & Langganan', 'Hiburan', 'Kesehatan', 'Lainnya'];
    const kategoriPemasukan = ['Gaji', 'Freelance / Bisnis', 'Investasi', 'Bonus / Hadiah', 'Lainnya'];

    document.getElementById('tanggal').value = new Date().toISOString().split('T')[0];

    function formatRupiah(val) {
      return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(val);
    }

    function updateKategoriOptions() {
      const tipe = document.querySelector('input[name="tipe"]:checked').value;
      const selectKategori = document.getElementById('kategori');
      const opsi = (tipe === 'Pemasukan') ? kategoriPemasukan : kategoriPengeluaran;

      selectKategori.innerHTML = opsi.map(k => `<option value="${k}">${k}</option>`).join('');
    }

    function muatData() {
      google.script.run
        .withSuccessHandler((res) => {
          if (res.status === 'success') {
            document.getElementById('saldoTotal').innerText = formatRupiah(res.saldo);
            document.getElementById('txtPemasukan').innerText = formatRupiah(res.totalPemasukan);
            document.getElementById('txtPengeluaran').innerText = formatRupiah(res.totalPengeluaran);

            const container = document.getElementById('listRiwayat');
            if (!res.riwayat || res.riwayat.length === 0) {
              container.innerHTML = `<p class="text-xs text-slate-400 py-4 text-center">Belum ada transaksi.</p>`;
              return;
            }

            container.innerHTML = res.riwayat.map(item => {
              const isMasuk = item.tipe === 'Pemasukan';
              const badgeClass = isMasuk ? 'text-emerald-600' : 'text-rose-600';
              const sign = isMasuk ? '+' : '-';

              return `
                <div class="py-3 flex justify-between items-start">
                  <div>
                    <p class="font-medium text-slate-800 text-xs">${item.kategori}</p>
                    <p class="text-[11px] text-slate-400 mt-0.5">${item.keterangan || '-'} • <span class="text-slate-500">${item.tanggal}</span></p>
                  </div>
                  <div class="text-right">
                    <span class="font-semibold text-xs ${badgeClass}">
                      ${sign} ${formatRupiah(item.nominal)}
                    </span>
                  </div>
                </div>
              `;
            }).join('');
          }
        })
        .withFailureHandler(err => {
          alert('Gagal memuat data: ' + err.message);
        })
        .getDashboardData();
    }

    function handleFormSubmit(e) {
      e.preventDefault();
      const btn = document.getElementById('btnSubmit');
      const badge = document.getElementById('badgeStatus');
      btn.disabled = true;
      btn.innerText = 'Menyimpan & Notif Telegram...';

      const payload = {
        tipe: document.querySelector('input[name="tipe"]:checked').value,
        nominal: document.getElementById('nominal').value,
        kategori: document.getElementById('kategori').value,
        tanggal: document.getElementById('tanggal').value,
        keterangan: document.getElementById('keterangan').value
      };

      google.script.run
        .withSuccessHandler((res) => {
          btn.disabled = false;
          btn.innerText = 'Simpan Transaksi';
          if (res.status === 'success') {
            document.getElementById('formTransaksi').reset();
            document.getElementById('tanggal').value = new Date().toISOString().split('T')[0];
            updateKategoriOptions();
            muatData();
            
            // Tampilkan notifikasi status singkat
            badge.classList.remove('hidden');
            badge.classList.add('flex');
            setTimeout(() => {
              badge.classList.add('hidden');
              badge.classList.remove('flex');
            }, 4000);
          } else {
            alert('Error: ' + res.message);
          }
        })
        .withFailureHandler(err => {
          btn.disabled = false;
          btn.innerText = 'Simpan Transaksi';
          alert('Gagal mengirim data: ' + err.message);
        })
        .simpanTransaksi(payload);
    }

    updateKategoriOptions();
    muatData();
  </script>
</body>
</html>
```

---

## 6. Langkah 5: Menyetel Otomasi Rekap (Trigger Apps Script)

Agar Google Apps Script otomatis mengirim rekap **Harian**, **Mingguan**, dan **Bulanan** tanpa perlu dibuka manual:

1. Di editor Google Apps Script, klik ikon **Jam Alarm / Pemicu (Triggers)** di bilah navigasi sebelah kiri.
2. Klik tombol **+ Tambahkan Pemicu (+ Add Trigger)** di pojok kanan bawah.

### A. Pemicu Rekap Harian:
* **Fungsi yang akan dijalankan**: `kirimRekapHarian`
* **Sumber peristiwa (Event source)**: `Berdasarkan waktu (Time-driven)`
* **Jenis pemicu berbasis waktu**: `Pengatur waktu harian (Day timer)`
* **Waktu hari**: `Pukul 21.00 sampai 22.00`
* Klik **Simpan (Save)**.

### B. Pemicu Rekap Mingguan:
* Klik **+ Tambahkan Pemicu**.
* **Fungsi yang akan dijalankan**: `kirimRekapMingguan`
* **Sumber peristiwa**: `Berdasarkan waktu (Time-driven)`
* **Jenis pemicu berbasis waktu**: `Pengatur waktu mingguan (Week timer)`
* **Pilih hari**: `Setiap Minggu`
* **Waktu hari**: `Pukul 20.00 sampai 21.00`
* Klik **Simpan (Save)**.

### C. Pemicu Rekap Bulanan:
* Klik **+ Tambahkan Pemicu**.
* **Fungsi yang akan dijalankan**: `kirimRekapBulanan`
* **Sumber peristiwa**: `Berdasarkan waktu (Time-driven)`
* **Jenis pemicu berbasis waktu**: `Pengatur waktu bulanan (Month timer)`
* **Pilih hari dalam sebulan**: `1` (atau tanggal terakhir yang Anda kehendaki)
* **Waktu hari**: `Pukul 07.00 sampai 08.00`
* Klik **Simpan (Save)**.

---

## 7. Langkah 6: Cara Deploy (Menerbitkan Aplikasi Web)

1. Di editor Apps Script, klik tombol **Terapkan (Deploy)** di kanan atas > **Penerapan Baru (New deployment)**.
2. Pilih jenis penerapan: **Aplikasi Web (Web app)**.
3. Konfigurasi:
   * **Deskripsi**: `my-uang-gw v1.0`
   * **Jalankan sebagai (Execute as)**: `Saya (email Anda)`
   * **Siapa yang memiliki akses (Who has access)**: `Siapa saja (Anyone)`
4. Klik **Terapkan (Deploy)**.
5. Klik **Beri Akses (Authorize Access)** dan pilih akun Google Anda. (Jika ada peringatan *"Google hasn't verified this app"*, pilih **Advanced** > **Go to my-uang-gw (unsafe)** > **Allow**).
6. Salin link **URL Aplikasi Web** (berakhiran `/exec`) dan buka di browser ponsel Anda.

---

## 8. Tips Pengujian Fitur

1. **Uji Notifikasi Telegram Manual**:
   * Di editor Apps Script, pilih fungsi `kirimRekapHarian` pada menu drop-down di sebelah tombol *Debug/Run*, lalu klik **Run (Jalankan)**.
   * Periksa apakah bot Telegram Anda langsung mengirimkan ringkasan pesan.
2. **Uji Transaksi Web**:
   * Buka Web App yang sudah dideploy. Masukkan satu transaksi baru.
   * Transaksi akan otomatis masuk ke tabel Google Sheets sekaligus dikirimkan notifikasinya ke akun Telegram Anda dalam hitungan detik.
