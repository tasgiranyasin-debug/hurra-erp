# Madde 8 Genişletme — QA Raporu
**Tarih:** 2026-06-11  
**Commit:** 2f9e367 (Madde 8 Genişletme: Kaynak modül, açık işlemler, sağlık, toplu rapor)  
**Test Eden:** Claude (Gerçek kullanıcı simülasyonu)

---

## 1. Mevcut Durum Analizi

### Eklenen Fonksiyonlar (core.js)

| Fonksiyon | Açıklama | Durum |
|---|---|---|
| `cariHareketlerNorm(cariId)` | Çift schema uyumlu (tar/tarih), kaynak etiket | ✅ Çalışıyor |
| `cariAcikSiparisler(cariId)` | hm_sa'dan filtreleme | ✅ Çalışıyor |
| `cariAcikIthalatlar(cariId)` | hm_ithalat'tan filtreleme | ✅ Çalışıyor |
| `cariAcikKrediler(cariId)` | hm_kredi'den filtreleme | ✅ Çalışıyor |
| `cariSaglikKontrol()` | Hareketsiz/yetim/riskAşan/tutarsız | ✅ Çalışıyor |
| `cariTipRaporOzeti(tip)` | 9 tip toplam raporu | ✅ Çalışıyor |

### Eklenen UI (cariler.html)

| Özellik | Durum |
|---|---|
| 3 Sol Panel View (Liste/Raporlar/Sağlık) | ✅ PASS |
| 9 Sekme bar (hrt/çek/özet/bilgi/rapor/yaşlandırma/risk/AI/açık) | ✅ PASS |
| Para birimi toggle (TRY/Orijinal/USD/EUR/CNY) | ✅ PASS |
| Kaynak modül etiketi (Manuel/Banka/Kredi/SA/vb.) | ✅ PASS |
| 11 filtre butonu (Tümü + 9 tip + Arşiv) | ✅ PASS |
| Tip seçim grid (çoklu checkbox) | ✅ PASS |
| Raporlar view (9 tip toplu tablo) | ✅ PASS (30,068 char) |
| Sağlık view (hareketsiz/yetim/risk) | ✅ PASS (2,584 char) |

---

## 2. Test Senaryoları

### Cari Oluşturma
| Test | Sonuç |
|---|---|
| Yeni Bayi oluştur (BAY-0002, Ankara Bayi Ltd.) | ✅ PASS |
| Yeni Tedarikçi oluştur (TED-0002, Delta Plastik A.Ş., USD) | ✅ PASS |
| Yeni Müşteri oluştur (MUS-0001, Beta Otomotiv San., EUR) | ✅ PASS |
| Modal açılıyor, tip seçimi çalışıyor | ✅ PASS |

### Hareket Oluşturma
| Test | Sonuç |
|---|---|
| TRY borç hareketi (Ankara Bayi, 180,000 TRY fatura) | ✅ PASS |
| TRY tahsilat hareketi (120,000 TRY) | ✅ PASS |
| Net bakiye doğrulaması: 60,000 TRY | ✅ PASS |
| USD borç hareketi (Delta Plastik, 15,000 USD @38.5) | ✅ PASS |
| USD kısmi ödeme (5,000 USD @39.2) | ✅ PASS |
| Kur farkı hareketi (10,500 TRY) | ✅ PASS |
| EUR satış hareketi (Beta Otomotiv, 8,000 EUR @41.5) | ✅ PASS |
| EUR tahsilat (3,000 EUR @41.8) | ✅ PASS |

### Bakiye ve Hesaplamalar
| Test | Beklenen | Gerçekleşen | Durum |
|---|---|---|---|
| Ankara Bayi net TRY | 60,000 | 60,000 | ✅ PASS |
| Delta Plastik net USD | 10,000 USD | 10,000 USD | ✅ PASS |
| Delta Plastik net TRY | 392,000 | 392,000 | ✅ PASS |
| Beta Otomotiv net EUR | -5,000 EUR | -5,000 EUR | ✅ PASS |
| Toplam cari sayısı | 23 | 23 | ✅ PASS |
| Toplam hareket sayısı | 130 | 130 | ✅ PASS |

### Raporlar
| Test | Sonuç |
|---|---|
| Tüm cariler raporu (23 cari, toplamBorc/Alacak/Net) | ✅ PASS |
| Bayi raporu özeti (3 bayi) | ✅ PASS |
| Tedarikçi raporu özeti (10 tedarikçi) | ✅ PASS |
| Müşteri raporu özeti (7 müşteri) | ✅ PASS |
| Döviz toplamları (USD/EUR net) | ✅ PASS |
| Risk sıralaması çalışıyor | ✅ PASS |

### Sekme Render
| Test | Sonuç |
|---|---|
| Hareketler sekmesi (hrtTabRender) | ✅ PASS |
| Özet sekmesi (ozetRender) | ✅ PASS |
| Rapor sekmesi (raporTabRender) | ✅ PASS |
| Yaşlandırma sekmesi (yaslandirmaTabRender) | ✅ PASS |
| Risk sekmesi (riskTabRender) | ✅ PASS |
| AI sekmesi (aiTabRender) | ✅ PASS |
| Açık İşlemler sekmesi (acikIslemlerRender) | ✅ PASS |

### AI Analizi
| Soru | Sonuç |
|---|---|
| "en riskli cariler" | ✅ Ankara Bayi + Delta Plastik listelendi |
| "en büyük borçlu" | ✅ İlk 10 sıralandı |
| "tahsilat performansı" | ✅ %114 tahsilat oranı |
| "toplam cari risk" | ✅ Çalışıyor |
| "vadesi geçmiş" | ✅ Çalışıyor |

### ERP Sağlık Merkezi
| Test | Sonuç |
|---|---|
| Hareketsiz cariler tespiti | ✅ 2 hareketsiz cari bulundu |
| Yetim hareketler | ✅ 0 (temiz) |
| Risk aşımları | ✅ 0 (temiz) |
| Tutarsız bakiyeler | ✅ 0 (temiz) |

---

## 3. Açık Hatalar

| ID | Hata | Seviye | Durum |
|---|---|---|---|
| — | Kritik hata yok | — | — |

---

## 4. Minör Gözlemler (Kritik Değil)

| # | Gözlem | Öneri |
|---|---|---|
| G-1 | `viewSec(view, btn)` — btn=null geçilirse crash | `if(!btn) return` guard ekle |
| G-2 | GitHub Pages cache nedeniyle eski kod servisi | ?v= parametresiyle çözüldü, kalıcı fix yok |
| G-3 | `cariTipRaporOzeti` eski sayfa versiyonunda hata | Yeni kod deploy sonrası otomatik çözülüyor |

---

## 5. Kritik Hata: YOK

---

## 6. Karar

> ✅ **Madde 9'a geçilebilir.**

Tüm test senaryoları başarıyla tamamlandı. 3 yeni cari oluşturuldu, borç/alacak/tahsilat/ödeme/kur farkı hareketleri oluşturuldu, bakiyeler doğrulandı. Tüm 7 sekme, 3 view, 9 rapor tipi, AI analizi, ERP sağlık merkezi çalışıyor. Kritik hata bulunmadı.

---

*Sonraki madde: Madde 9*
