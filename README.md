# Duygusal Aktivasyon Göstergesi

Bu uygulama, tarayıcı tabanlı fizyolojik ve akustik sinyal işleme yöntemlerini kullanarak kullanıcının anlık uyarılma ve uyarılmışlık seviyesini ölçen, sakin, etik ve tıbbi olmayan bir öz-yansıtma ve farkındalık aracıdır. 

**ÖNEMLİ ETİK ÇERÇEVE:** Bu uygulama kesinlikle bir **tıbbi cihaz veya yalan makinesi DEĞİLDİR**. Elde edilen yüksek uyarılma sonuçları dürüstlük veya yalan söyleme ile ilgili değildir; heyecan, stres, kafein tüketimi, fiziksel yorgunluk veya tatlı bir telaş gibi düzinelerce doğal ve geçici sebepten kaynaklanabilir. Uygulama, kullanıcıyı yargılamadan anlık bir farkındalık molası sunmayı amaçlar.

## Özellikler

- **İki Farklı Ölçüm Modu:**
  - *Hızlı Ses Analizi:* Sadece mikrofon izni istenir, kamera izni istenmez. Kısa bir konuşma kaydı üzerinden ses analizi yapılır.
  - *Detaylı Kamera + Ses Analizi:* Parmak ucu ile kamera lensi üzerinden nabız ölçümü (rPPG) ve ses analizi birlikte gerçekleştirilir.
- **Kamera Tabanlı Nabız Ölçümü (rPPG):** Parmağın kamera lensi üzerine yerleştirilmesiyle kan akışındaki mikro renk değişimlerini (kırmızı kanal dalgalanmaları) yakalar. Detrending, bandpass filtreleme ve FFT (Hızlı Fourier Dönüşümü) / Tepe Noktası Tespiti (Peak Detection) algoritmalarıyla dakikadaki kalp atış hızını (BPM) tamamen tarayıcı tarafında hesaplar. **Yapay zeka veya makine öğrenmesi kullanılmaz.**
- **Akustik Ses Analizi:** Mikrofon üzerinden alınan ses sinyalinden oto-korelasyon yöntemiyle ses perdesi (F0), genlik eşiği tabanlı sessizlik tespitiyle duraklamalar ve birim zamandaki sesli segment sayısıyla konuşma hızı çıkarılır.
- **Sakin ve Renk Kodlu Gösterge:** Sonuçlar, tıbbi veya alarm verici olmayan, sakin bir renk paletiyle (Düşük: Sakin Yeşil, Orta: Kehribar, Yüksek: Sıcak Kiremit Rengi) "Aktivasyon Seviyesi" olarak sunulur. Kesinlik veya doğruluk yüzdesi gibi yanıltıcı ifadeler kullanılmaz.
- **Öz-Bakım Önerileri:** Sonuç seviyesine göre rastgele seçilen, tekrar etmeyen, nefes egzersizleri, su içme hatırlatması ve profesyonel destek yönlendirmesi içeren Türkçe öneriler sunulur.
- **İsteğe Bağlı Yapay Zeka Yorumu (Varsayılan Kapalı):** Kullanıcı onay verdiğinde, sadece özet sayısal veriler (ham ses/görüntü değil) Gemini API'sine gönderilerek sıcak, teşhis koymayan, Türkçe bir yansıtma yorumu alınır.
- **Yerel Geçmiş Takibi (localStorage):** Geçmiş ölçümler sadece kullanıcının kendi tarayıcısında saklanır ve zaman içindeki eğilim basit bir grafik (recharts) ile gösterilir.
- **"Nasıl Çalışır?" Sayfası:** Uygulamanın arkasındaki bilimsel ilkeleri, sınırlamaları ve gizlilik politikasını dürüstçe açıklayan detaylı bilgilendirme sayfası.
- **Kesintisiz Etik Uyarı:** Her ekranda kalıcı olarak yer alan ve uygulamanın tıbbi/yalan tespiti amaçlı olmadığını hatırlatan alt bilgi (footer) bandı.

## Proje Yapısı

```text
duygusal-aktivasyon-gostergesi/
├── app/
│   ├── api/gemini-commentary/route.ts  # Gemini API proxy route handler (Node.js)
│   ├── gecmis/page.tsx                 # Geçmiş ölçümler ve trend grafiği sayfası
│   ├── nasil-calisir/page.tsx          # Bilimsel sınırlamalar ve şeffaflık sayfası
│   ├── olcum/page.tsx                  # Kamera ve ses kayıt/ölçüm akış sayfası
│   ├── sonuc/page.tsx                  # Ölçüm sonuçları, öneriler ve AI yorum sayfası
│   ├── globals.css                     # Global stiller ve mobil taşma önleyiciler
│   ├── layout.tsx                      # Yazı tipleri, meta veriler ve kalıcı etik footer
│   └── page.tsx                        # Ana sayfa ve ölçüm modu seçimi
├── components/
│   ├── ActivationGauge.tsx             # Sakin, dairesel aktivasyon göstergesi
│   ├── EthicalFooter.tsx               # Her ekranda kalıcı etik uyarı bandı
│   └── HeartbeatLine.tsx               # SVG + framer-motion ile dalgalanan kalp çizgisi
├── lib/
│   ├── activationLevel.ts              # Sinyalleri birleştiren uyarılma puanı mantığı
│   ├── audioCapture.ts                 # Web Audio API mikrofon kayıt yardımcıları
│   ├── cameraCapture.ts                # Kamera akışı ve flaş/torch kontrolü
│   ├── geminiCommentary.ts             # İsteğe bağlı Gemini yorumu istemci istekleri
│   ├── history.ts                      # localStorage geçmiş kaydetme/silme/istatistik
│   ├── pulseDetection.ts               # rPPG kamera sinyal işleme (FFT, filtre, detrend)
│   ├── suggestions.ts                  # Türkçe hazır öz-bakım önerileri bankası
│   └── voiceAnalysis.ts                # Ses sinyal işleme (oto-korelasyon perde, duraklama)
├── public/                             # Favicon, PWA ikonları ve manifest dosyası
├── tailwind.config.ts                  # Sakin renk paleti ve özel animasyon tanımları
└── package.json                        # Proje bağımlılıkları ve betikleri
```

## Yerel Geliştirme (Termux Üzerinden)

Android cihazınızda Termux kullanarak projeyi yerel olarak çalıştırmak için aşağıdaki adımları sırasıyla uygulayın:

1. **Gerekli Paketleri Kurun:**
   Termux'u açın ve sistem paketlerini güncelleyip Node.js ile Git'i kurun:
   ```bash
   pkg update && pkg upgrade -y
   pkg install nodejs git -y
   ```

2. **Kurulumları Doğrulayın:**
   Node.js sürümünün en az 18.17 olduğundan emin olun (Next.js 14 gereksinimi):
   ```bash
   node -v
   npm -v
   ```

3. **Proje Klasörüne Girin ve Bağımlılıkları Kurun:**
   Size teslim edilen proje klasörünün içine girin ve gerekli paketleri yükleyin:
   ```bash
   cd duygusal-aktivasyon-gostergesi
   npm install
   ```

4. **Çevre Değişkenlerini Yapılandırın (Opsiyonel):**
   Yapay zeka yorumu özelliğini kullanmak istiyorsanız, şablon dosyayı kopyalayıp API anahtarınızı ekleyin:
   ```bash
   cp .env.example .env.local
   nano .env.local
   ```
   *(Açılan ekranda `GEMINI_API_KEY` kısmına kendi anahtarınızı yazıp `Ctrl+O`, `Enter`, `Ctrl+X` ile kaydedip çıkın).*

5. **Geliştirme Sunucusunu Başlatın:**
   ```bash
   npm run dev
   ```
   Sunucu başladıktan sonra tarayıcınızdan `http://localhost:3000` adresine giderek uygulamayı test edebilirsiniz.
   
   *NOT: Tarayıcılar güvenlik nedeniyle kamera ve mikrofon izinlerini yalnızca `localhost` veya `https://` protokolü üzerinden çalışan sitelerde verir. Telefonunuzun kendi tarayıcısından yerel ağ üzerinden test etmek isterseniz, izin engeline takılmamak için en güvenli yol projeyi doğrudan Vercel'e (HTTPS) deploy etmektir.*

6. **Derleme Testi (Production Build):**
   Hata olmadığından emin olmak için projeyi derleyin:
   ```bash
   npm run build
   ```

## GitHub'a Gönderme

Projeyi kendi GitHub hesabınızda yayınlamak için aşağıdaki adımları izleyin:

1. **Git Kullanıcı Bilgilerinizi Ayarlayın (İlk kez kullanıyorsanız):**
   ```bash
   git config --global user.name "GitHub Kullanıcı Adınız"
   git config --global user.email "github-epostaniz@example.com"
   ```

2. **GitHub CLI ile Giriş Yapın (Önerilen ve en kolay yol):**
   ```bash
   pkg install gh -y
   gh auth login
   ```
   *(Yönergeleri takip ederek tarayıcı veya token ile giriş yapın).*

3. **GitHub'da Yeni Depo (Repository) Oluşturun:**
   *Seçenek A (GitHub CLI ile doğrudan Termux'tan):*
   ```bash
   gh repo create duygusal-aktivasyon-gostergesi --public --source=. --remote=origin
   ```
   
   *Seçenek B (GitHub Web Arayüzünden):*
   GitHub sitesine girip `duygusal-aktivasyon-gostergesi` adında boş bir repo oluşturun ve Termux'ta şu komutla bağlayın:
   ```bash
   git remote add origin https://github.com/KULLANICI_ADINIZ/duygusal-aktivasyon-gostergesi.git
   ```

4. **Kodları Commit Edin ve Pushlayın:**
   ```bash
   git init
   git add .
   git commit -m "İlk sürüm: Duygusal Aktivasyon Göstergesi"
   git branch -M main
   git push -u origin main
   ```

## Vercel'e Deploy Etme

Projeyi ücretsiz ve HTTPS destekli olarak Vercel üzerinde yayına almak için:

1. **Vercel Hesabınızı Bağlayın:**
   [vercel.com](https://vercel.com) adresine gidin, GitHub hesabınızla giriş yapın. "Add New" -> "Project" butonuna tıklayarak az önce oluşturduğunuz `duygusal-aktivasyon-gostergesi` reposunu seçip "Import" edin.

2. **Çevre Değişkenini Tanımlayın:**
   Proje kurulum ekranında (Configure Project), **Environment Variables** sekmesini açın:
   - Name: `GEMINI_API_KEY`
   - Value: *Kendi Gemini API anahtarınız*
   - "Add" butonuna tıklayarak ekleyin.

3. **Deploy Edin:**
   "Deploy" butonuna tıklayın. Vercel projenizi otomatik olarak derleyecek ve birkaç dakika içinde size `https://proje-adi.vercel.app` şeklinde güvenli bir HTTPS bağlantısı verecektir.

*Alternatif (Termux CLI üzerinden deploy):*
```bash
npm install -g vercel
vercel login
vercel --prod
# Çevre değişkeni eklemek için:
vercel env add GEMINI_API_KEY production
# Değişikliklerin geçerli olması için tekrar deploy edin:
vercel --prod
```

## DuckDNS Alt Alan Adı Bağlama

Vercel üzerindeki uygulamanızı kendi DuckDNS alt alan adınıza yönlendirmek için:

1. [duckdns.org](https://www.duckdns.org) adresine gidin ve bir alt alan adı oluşturun (Örn: `aktivasyongosterge.duckdns.org`).
2. Vercel Dashboard'da projenizin sayfasına gidin: **Settings** -> **Domains** sekmesini açın.
3. Alan adı ekleme kutusuna oluşturduğunuz DuckDNS adresini yazın (Örn: `aktivasyongosterge.duckdns.org`) ve "Add" butonuna tıklayın.
4. Vercel size yönlendirme için gerekli DNS kayıtlarını gösterecektir. DuckDNS sadece A kaydı (IP adresi) desteklediği için Vercel'in size verdiği **A Record** IP adresini (Örn: `76.76.21.21`) kopyalayın.
5. DuckDNS paneline geri dönün, oluşturduğunuz alt alan adının yanındaki **IP** kutusuna bu adresi yapıştırın ve "update ip" butonuna tıklayın.
6. DNS kayıtlarının yayılması için birkaç dakika bekleyin. Artık uygulamanıza `https://aktivasyongosterge.duckdns.org` adresinden güvenle erişebilirsiniz.

## Ortam Değişkenleri

| Değişken Adı | Açıklama | Zorunlu mu? | Kaynak |
| :--- | :--- | :--- | :--- |
| `GEMINI_API_KEY` | Sonuç ekranındaki isteğe bağlı "Yapay Zeka Yorumu Ekle" özelliğini çalıştırmak için gereken Google Gemini API anahtarı. | Hayır (Uygulama bu anahtar olmadan da çalışır, sadece AI yorumu özelliği hata verir). | [Google AI Studio](https://aistudio.google.com/apikey) |

## Önemli Teknik Notlar

- **HTTPS Zorunluluğu:** Tarayıcı güvenlik politikaları gereği, kamera ve mikrofon erişimi (getUserMedia) yalnızca `localhost` veya `https://` protokolü altında çalışır. Bu nedenle, yerel ağ üzerinden başka cihazlarla test yaparken veya canlı yayında mutlaka HTTPS (Vercel/DuckDNS) kullanılmalıdır.
- **iOS Safari Desteği:** iOS Safari tarayıcısı, web standartları gereği kamera flaşını (torch) doğrudan kontrol etmeye izin vermez. Uygulama bu durumu otomatik olarak algılar ve kullanıcıya flaş açılmasa bile iyi aydınlatılmış bir odada ölçüm yapabileceğini belirten Türkçe bir bilgilendirme mesajı gösterir.
- **Yerel Hesaplama:** Tüm sinyal işleme, FFT ve ses analizleri tamamen kullanıcının cihazında (istemci tarafında) gerçekleşir. Hiçbir ses veya görüntü verisi sunuculara gönderilmez, bu da tam gizlilik sağlar.