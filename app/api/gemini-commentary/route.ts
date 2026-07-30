import { NextResponse } from 'next/server';
import { ActivationSummaryForAI } from '../../../lib/geminiCommentary';

export const runtime = 'nodejs'; // Force Node.js runtime to avoid edge/Node compatibility issues

export async function POST(req: Request) {
  try {
    // 1. Parse and validate request body
    const body = await req.json().catch(() => null);
    if (!body) {
      return NextResponse.json(
        { error: 'Geçersiz istek gövdesi.' },
        { status: 400 }
      );
    }

    const {
      mode,
      level,
      pulseBpmRounded,
      voicePitchRounded,
      speechRateDescriptor,
      pauseDescriptor,
    } = body as ActivationSummaryForAI;

    if (!mode || !level) {
      return NextResponse.json(
        { error: 'Eksik parametreler: mode ve level zorunludur.' },
        { status: 400 }
      );
    }

    // 2. Check API Key
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: 'Yapay zeka yorumu şu anda yapılandırılmamış. Lütfen sunucu tarafında GEMINI_API_KEY ortam değişkenini tanımlayın.' },
        { status: 500 }
      );
    }

    // 3. Build descriptive prompt in Turkish
    let signalDetails = '';
    if (mode === 'camera_audio') {
      signalDetails += `- Ölçüm Modu: Kamera ve Ses (Detaylı Analiz)\n`;
      if (pulseBpmRounded) {
        signalDetails += `- Tahmini Nabız: Dakikada ${pulseBpmRounded} atım (BPM)\n`;
      }
    } else {
      signalDetails += `- Ölçüm Modu: Sadece Ses (Hızlı Analiz)\n`;
    }

    if (voicePitchRounded) {
      signalDetails += `- Ortalama Ses Perdesi (F0): ${voicePitchRounded} Hz\n`;
    }
    if (speechRateDescriptor) {
      const rateMap = { yavas: 'yavaş', normal: 'normal', hizli: 'hızlı' };
      signalDetails += `- Konuşma Hızı: ${rateMap[speechRateDescriptor]}\n`;
    }
    if (pauseDescriptor) {
      const pauseMap = { az: 'az/seyrek', orta: 'orta sıklıkta', sik: 'sık/uzun' };
      signalDetails += `- Konuşma Arası Boşluklar: ${pauseMap[pauseDescriptor]}\n`;
    }

    const levelMap = {
      dusuk: 'Düşük Aktivasyon (Sakin, dingin, dinlenme halinde)',
      orta: 'Orta Aktivasyon (Hafif uyarılma, odaklanma, günlük heyecan)',
      yuksek: 'Yüksek Aktivasyon (Belirgin uyarılma, coşku, stres veya yoğun heyecan)'
    };

    const prompt = `
Sen, "Duygusal Aktivasyon Göstergesi" adlı etik ve bilimsel bir öz-yansıtma uygulamasında yer alan, sıcak, sakinleştirici ve destekleyici bir Türkçe konuşan esenlik (wellness) rehberisin. Kesinlikle bir doktor, psikiyatrist veya yalan dedektörü değilsin.

Kullanıcının yaptığı ölçümün özet verileri şu şekildedir:
- Hesaplanan Aktivasyon Seviyesi: ${levelMap[level]}
${signalDetails}

Senden ricam, bu verilere dayanarak kullanıcıya tamamen samimi, yargılamayan, tıbbi olmayan ve KESİNLİKLE teşhis koymayan kısa bir yansıtma (öz-farkındalık) yorumu yazmandır.

Yazarken şu kurallara KESİNLİKLE uy:
1. En fazla 2-4 cümle uzunluğunda, kısa ve öz olsun.
2. Asla "yalan söylüyorsun", "doğru söylüyorsun", "dürüstlük oranınız" gibi yalan tespiti veya dürüstlük imalarında bulunma. Bu bir yalan makinesi değildir.
3. Asla tıbbi teşhis koyma ("anksiyete bozukluğunuz var", "taşikardi var" vb. deme).
4. Bu uyarılma seviyesinin (özellikle yüksekse) heyecan, kahve tüketimi, o anki konunun coşkusu, fiziksel yorgunluk veya tatlı bir telaş gibi düzinelerce doğal ve geçici sebebi olabileceğini nazikçe hatırlat.
5. Eğer seviye yüksekse, kullanıcıyı korkutmadan, omuzlarını gevşetmesi, derin bir nefes alması veya bir yudum su içmesi gibi çok basit bir öz-bakım önerisinde bulun.
6. Dilin son derece sıcak, şefkatli, sakinleştirici ve yapıcı olsun. "Ben" diliyle konuş (ör. "Bedeninin ritmini fark etmeni öneririm...").

Yorumunu doğrudan Türkçe olarak yaz, başka hiçbir açıklama veya meta-metin ekleme.
`;

    // 4. Call Gemini REST API via fetch (plain REST call, no SDK, per deployment constraints)
    const GEMINI_MODEL = 'gemini-flash-latest';
    const GEMINI_ENDPOINT = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;
    const url = `${GEMINI_ENDPOINT}?key=${apiKey}`;
    
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 12000); // 12s timeout for upstream

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        contents: [
          {
            parts: [
              { text: prompt }
            ]
          }
        ],
        generationConfig: {
          temperature: 0.7,
          maxOutputTokens: 250,
        }
      }),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      const errText = await response.text().catch(() => '');
      console.error('Gemini API upstream error:', response.status, errText);
      return NextResponse.json(
        { error: `Gemini API hatası: ${response.status}` },
        { status: 502 }
      );
    }

    const data = await response.json();
    
    // 5. Extract and validate response text
    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!text) {
      console.error('Gemini API returned empty or blocked response:', JSON.stringify(data));
      return NextResponse.json(
        { error: 'Yapay zeka uygun bir yanıt üretemedi (güvenlik filtreleri tetiklenmiş olabilir).' },
        { status: 502 }
      );
    }

    return NextResponse.json({ text: text.trim() });

  } catch (e: any) {
    console.error('Unexpected error in gemini-commentary API route:', e);
    if (e.name === 'AbortError') {
      return NextResponse.json(
        { error: 'Gemini API yanıt süresi doldu.' },
        { status: 504 }
      );
    }
    return NextResponse.json(
      { error: 'Sunucu tarafında beklenmeyen bir hata oluştu.' },
      { status: 500 }
    );
  }
}