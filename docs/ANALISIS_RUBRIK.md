# Analisis kebutuhan UTS dan pemetaan implementasi

## Sumber instruksi

Gambar lampiran berjudul **UTS-Pengembangan dan Operasi | IF-B Pagi TA. 2026/2027 (100 Points)** dan dua ketentuan tambahan yang ditulis pengguna mengenai akses video serta kontribusi anggota. Analisis ini berdiri untuk kelompok baru dan tidak memakai identitas kelompok dari proyek sebelumnya.

Instruksi pada gambar yang dapat dibaca:

1. Media ujian online: Microsoft Teams, Assignment & Forms.
2. Tugas berkelompok, **3–5 mahasiswa** per kelompok.
3. Pekerjaan ujian yang sama antarkelompok berbeda berakibat nilai UTS 0.
4. Berkas dikumpulkan dalam bentuk **Word (.docx)**.
5. Setiap anggota kelompok wajib mengirim laporannya ke form UTS.
6. Studi kasus: menyelesaikan masalah pengembangan aplikasi yang memerlukan deployment cepat kepada pengguna.
7. Aplikasi boleh memakai aplikasi yang dikembangkan kelompok masing-masing.
8. Deployment wajib menggunakan container, misalnya Docker atau Podman, dan wajib menerapkan konsep Continuous Integration serta Continuous Deployment.

## Matriks kebutuhan

| ID | Kebutuhan yang tertulis | Bobot | Implementasi pada revisi | Bukti yang harus dihasilkan |
|---|---|---:|---|---|
| R1 | Penggunaan container | 50 | Dockerfile multi-stage; runtime Node non-root; source aplikasi, aset, dan API masuk image | Log `docker compose up --build`, image, container berjalan dan healthy |
| R2 | Penggunaan container | bagian R1 | Port host/container, volume SQLite, restart policy dan resource limit | `docker compose ps`, `docker inspect`, akses web melalui port host |
| R3 | Penggunaan container | bagian R1 | Data di volume bernama `esoria_uts_data` | Data sama sebelum dan setelah container dibuat ulang |
| R4 | Implementasi CI/CD | 20 | Workflow menguji aplikasi, build container, smoke test, dan uji persistensi | Run GitHub Actions nyata yang berhasil pada commit kelompok |
| R5 | Implementasi CI/CD | bagian R4 | Image yang lolos uji dipublikasikan ke GHCR, dipasang berdasarkan digest pada runner Linux kelompok | Job publish dan deploy sukses; digest dan commit rilis cocok |
| R6 | Video penjelasan implementasi | 20 | Ditunda sesuai instruksi pengguna saat ini | Video final yang menjelaskan container dan CI/CD |
| R7 | Laporan rapi | 10 | Dokumentasi analisis, arsitektur, pengoperasian, API, sumber, dan uji tersedia | Laporan Word final dengan bukti nyata dan identitas kelompok |
| R8 | Tautan video public dan bisa dibuka saat pengecekan | syarat tambahan | Belum dibuat | Tautan diuji tanpa login; hak akses public |
| R9 | Setiap anggota berkontribusi menjelaskan dan terlihat di video | syarat tambahan | Belum direkam | Seluruh anggota tampil dan menjelaskan bagian yang dikerjakan |

Gambar hanya memuat empat komponen bobot utama; rincian R2, R3, dan R5 merupakan cara implementasi untuk memperkuat pembuktian, **bukan subrubrik atau bobot baru yang dibuat dosen**. Tidak ditemukan kewajiban Kubernetes, microservices, sejumlah container tertentu, domain berbayar, atau VPS berbayar pada lampiran.

## Masalah yang digunakan sebagai studi kasus

Pada source awal, website mengandalkan layanan Firebase dan alur deployment tersendiri. Workflow awal melakukan verifikasi source, tetapi tidak menghasilkan image container dan tidak memasang versi baru otomatis ke mesin deployment. Kelompok membutuhkan proses yang konsisten: perubahan source diuji, image dibentuk sekali, image yang sama disalurkan, lalu versi aplikasi di mesin tujuan dapat dicocokkan dengan commit.

Revisi menyediakan satu aplikasi ESORIA yang menyimpan data latihan secara mandiri, memiliki image reproducible dari Dockerfile dan lockfile, serta pipeline dengan gerbang uji sebelum deployment. Kegagalan pengujian menghentikan publish dan deployment; kegagalan kesehatan setelah penggantian versi memicu upaya rollback jika sudah ada image sebelumnya.

## Mengapa ada versi UTS tersendiri

Memasukkan halaman statis ke container sambil membiarkan seluruh fungsi bisnis bergantung pada konfigurasi Firebase produksi membuat demonstrasi kelompok bergantung pada akun, App Check, email, dan izin layanan eksternal. Edisi UTS memindahkan alur yang didemonstrasikan ke Node.js dan SQLite dalam container, sehingga penggunaan container dapat dijelaskan dari antarmuka sampai data.

Ini adalah adaptasi aplikasi dengan cakupan yang dinyatakan. Tidak semua fitur Firebase dimigrasikan. Paket minimal ini tidak menyertakan salinan lengkap source Firebase awal; asal proyek dan batas adaptasi dijelaskan dalam `docs/SUMBER.md`. Kelompok harus menjelaskan bagian adaptasi dan pekerjaannya secara jujur dalam laporan.

## Hal yang belum bisa dipastikan dari lampiran

- Tidak ada batas durasi video yang terbaca.
- Tidak ada alamat repository, server tujuan, maupun identitas anggota kelompok.
- Tidak ada kewajiban URL website harus public; ketentuan public yang diberikan secara eksplisit berlaku untuk **video**. Website lokal tetap harus didemonstrasikan dari container, dan deploy harus menghasilkan layanan pada mesin tujuan yang dapat dibuktikan.
- Tidak ada template rinci struktur atau panjang laporan selain elemen wajib yang tertulis.

## Isi laporan yang diwajibkan

1. Nama aplikasi dan nama anggota kelompok.
2. Deskripsi singkat aplikasi dan cara menggunakannya.
3. Informasi detail aplikasi, termasuk sumber referensi source code/aplikasi.
4. Informasi file pendukung atau aplikasi tambahan yang digunakan.
5. Tautan video penjelasan implementasi deployment menggunakan container.
6. Tautan video penjelasan implementasi CI/CD pada container.

Nama berkas mengikuti teks gambar: **`UTS_[NIM_Salah_Satu_Perwakilan_Kelompok].docx`**; ganti penanda dengan NIM yang benar, misalnya bentuk `UTS_2311XXXXX.docx`, tanpa mengarang NIM atau memakai milik proyek lain. Penjelasan container dan CI/CD dapat berada pada satu video dengan bagian yang mudah ditemukan jika tidak ada arahan dosen lain; dua tautan/bagian wajib tetap harus jelas dalam laporan.

## Sisa pekerjaan setelah source selesai

1. Jalankan website dalam Docker pada komputer kelompok.
2. Buat repository kelompok, konfigurasi runner dan secret, lalu buktikan satu perubahan masuk `main` sampai deploy otomatis berhasil.
3. Simpan bukti runtime dan commit, isi identitas serta kontribusi anggota.
4. Sesudah implementasi disetujui kelompok, buat video dan laporan Word final.
5. Periksa akses public video tanpa login, pastikan semua anggota terlihat dan menjelaskan bagiannya, lalu setiap anggota mengirim laporan ke form UTS.

Tidak ada klaim nilai 100 atau seluruh rubrik sudah terpenuhi hanya dengan ZIP. Bagian yang telah dijalankan dapat dilihat pada berkas hasil pengujian.
