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

// Fungsi pengiriman pesan ke Telegram dengan penanganan log respon lengkap
function kirimPesanTelegram(pesanHtml) {
  if (!TELEGRAM_BOT_TOKEN || TELEGRAM_BOT_TOKEN === 'MASUKKAN_BOT_TOKEN_TELEGRAM') {
    Logger.log('[Peringatan] Token Telegram belum dikonfigurasi.');
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
    const respon = UrlFetchApp.fetch(url, options);
    const hasil = JSON.parse(respon.getContentText());
    
    if (!hasil.ok) {
      Logger.log('Telegram API Error: ' + hasil.description);
    } else {
      Logger.log('Pesan Telegram berhasil terkirim ke chat ID: ' + TELEGRAM_CHAT_ID);
    }
  } catch (err) {
    Logger.log('Gagal menjalankan UrlFetchApp: ' + err.message);
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
// REKAP OTOMATIS TELEGRAM (BEBAS TAG HTML TIDAK VALID)
// ==========================================

// 3. Rekap Harian (Dijalankan tiap malam via Time-Driven Trigger)
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

  // Catatan: Telegram Bot API TIDAK mendukung tag <font>. Gunakan tag standar <b>, <i>, atau emoji.
  const pesan = 
    `<b>📊 REKAP KEUANGAN HARIAN</b>\n` +
    `📅 <i>${todayStr}</i>\n` +
    `────────────────────\n` +
    `• Total Transaksi: <b>${jumlahTrx}</b>\n` +
    `• Pemasukan: 🟢 <b>${formatRupiahServer(pemasukanHariIni)}</b>\n` +
    `• Pengeluaran: 🔴 <b>${formatRupiahServer(pengeluaranHariIni)}</b>\n` +
    `────────────────────\n` +
    `• Hasil Hari Ini: <b>${formatRupiahServer(selisih)}</b> (${statusHari})\n\n` +
    `<i>Selalu kontrol pengeluaran harianmu! 🚀</i>`;

  kirimPesanTelegram(pesan);
}

// 4. Rekap Mingguan (Dijalankan tiap akhir pekan via Trigger)
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
    `• Total Pemasukan : 🟢 <b>${formatRupiahServer(pemasukan)}</b>\n` +
    `• Total Pengeluaran: 🔴 <b>${formatRupiahServer(pengeluaran)}</b>\n` +
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
  
  const bulanIniPrefix = Utilities.formatDate(new Date(), 'Asia/Jakarta', 'yyyy-MM');
  const namaBulan = Utilities.formatDate(new Date(), 'Asia/Jakarta', 'MMMM yyyy');

  let pemasukan = 0;
  let pengeluaran = 0;
  let totalSaldoAkumulasi = 0;

  for (let i = 1; i < rows.length; i++) {
    const [, tgl, tipe, , nominal] = rows[i];
    const nilai = Number(nominal) || 0;
    const tglBaris = normalisasiTanggal(tgl);

    if (tipe === 'Pemasukan') totalSaldoAkumulasi += nilai;
    if (tipe === 'Pengeluaran') totalSaldoAkumulasi -= nilai;

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
    `• Pemasukan Bulan Ini  : 🟢 <b>${formatRupiahServer(pemasukan)}</b>\n` +
    `• Pengeluaran Bulan Ini: 🔴 <b>${formatRupiahServer(pengeluaran)}</b>\n` +
    `• Selisih (Net Cash)   : <b>${formatRupiahServer(pemasukan - pengeluaran)}</b>\n` +
    `• Tabungan (Savings Rate): <b>${rasioTabungan}%</b>\n` +
    `────────────────────\n` +
    `💰 <b>Total Saldo Kas Saat Ini: ${formatRupiahServer(totalSaldoAkumulasi)}</b>\n\n` +
    `<i>Bagus! Pertahankan disiplin keuangan bulan depan. 🎯</i>`;

  kirimPesanTelegram(pesan);
}
