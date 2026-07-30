import { ActivationLevel } from './activationLevel';

export const suggestionBank: Record<ActivationLevel, string[]> = {
  dusuk: [
    "Sakinliğin tadını çıkarın. Şu anki dingin ritminizi korumak için kendinize birkaç dakika izin verin ve zihninizin dinlenmesine izin verin.",
    "Hafifçe esneyin. Oturduğunuz yerde omuzlarınızı geriye doğru dairesel hareketlerle oynatın, boynunuzu yavaşça sağa ve sola bükerek kaslarınızı gevşetin.",
    "Bir bardak ılık su veya sevdiğiniz bitki çayından (özellikle papatya veya melisa) birkaç yudum alarak bu sakin anı taçlandırın.",
    "Zihinsel odaklanma egzersizi yapın. Bulunduğunuz odada yeşil renkli 3 nesne bulun ve her birinin dokusunu, şeklini zihninizde sessizce tanımlayın.",
    "Gözlerinizi 1 dakika boyunca kapatın. Sadece nefesinizin burnunuzdan girerken bıraktığı serinliğe ve çıkarken bıraktığı sıcaklığa odaklanın."
  ],
  orta: [
    "Kutulu Nefes Egzersizi (Box Breathing): 4 saniye boyunca burnunuzdan nefes alın, nefesinizi 4 saniye tutun, 4 saniyede ağzınızdan yavaşça verin ve 4 saniye boş akciğerlerle bekleyin. Bunu 3 kez tekrarlayın.",
    "Kısa bir hareket molası verin. Bulunduğunuz odada veya koridorda 2-3 dakika boyunca yavaş adımlarla yürüyün. Adımlarınızın yere basış hissini fark edin.",
    "Bir bardak taze, serin su için. Suyun boğazınızdan aşağı süzülüşünü ve vücudunuza yaydığı o tazeleyici serinlik hissini tüm dikkatinizle takip edin.",
    "5-4-3-2-1 Topraklanma Tekniği: Etrafınızda görebileceğiniz 5 nesneye, dokunabileceğiniz 4 şeye, duyabileceğiniz 3 sese, koklayabileceğiniz 2 kokuya ve tadabileceğiniz 1 şeye odaklanarak zihninizi şimdiki ana getirin.",
    "Ekranlardan uzaklaşın. Bilgisayar veya telefon ekranına bakmayı 5 dakikalığına bırakıp pencereden dışarıya, mümkünse en uzaktaki bir noktaya veya gökyüzüne bakın."
  ],
  yuksek: [
    "4-7-8 Nefes Tekniği: Burnunuzdan sessizce 4 saniye boyunca nefes alın. Nefesinizi zihninizden 7 saniye boyunca tutun. Ardından ağzınızdan 'fıss' sesi çıkararak yavaşça 8 saniyede nefesinizi verin. Bu döngüyü 4 kez tekrarlayarak sinir sisteminizi sakinleştirin.",
    "Omuzlarınızı ve çenenizi serbest bırakın. Fark etmeden dişlerinizi sıkıyor veya omuzlarınızı yukarı kaldırmış olabilirsiniz. Derin bir nefes vererek çenenizi gevşetin ve omuzlarınızı tamamen aşağı bırakın.",
    "Ellerinizi ve yüzünüzü soğuk suyla yıkayın. Suyun cildinizle temas ettiği o anki ani his, vagus sinirini uyararak vücudunuzun doğal sakinleşme mekanizmasını devreye sokacaktır.",
    "Duygularınızı veya o anki düşüncelerinizi bir kağıda dökün. Zihninizde dönüp duran karmaşık düşünceleri yargılamadan, sadece aklınıza geldiği gibi bir kağıda yazıp ardından o kağıdı katlayıp bir kenara koyun.",
    "Güvendiğiniz bir dostunuzla veya bir yakınınızla kısa bir sohbet edin. O an hissettiğiniz heyecan veya gerginliği paylaşmak, yükünüzü hafifletmeye yardımcı olur.",
    "Eğer bu yüksek uyarılma, kaygı veya yoğun stres durumu günlerdir devam ediyorsa ve günlük yaşamınızı zorlaştırıyorsa, kendinize bir şans verip uzman bir psikolog veya psikolojik danışman ile görüşmeyi düşünebilirsiniz. Destek almak en doğal hakkınızdır."
  ]
};

export const universalTips: string[] = [
  "Unutmayın: Fizyolojik uyarılma seviyeniz sürekli değişen dinamik bir durumdur. Şu anki hissiniz kalıcı değildir.",
  "Kendinize karşı nazik olun. Bedeninizin verdiği tepkiler (hızlı kalp atışı, hızlı konuşma vb.) sizi korumaya çalışan doğal mekanizmalardır.",
  "Günde en az bir kez, hiçbir şey yapmadan sadece 5 dakika boyunca sessizce oturmayı alışkanlık haline getirin."
];

/**
 * Returns a set of non-repeating random suggestions for the given activation level.
 */
export function getRandomSuggestions(level: ActivationLevel, count: number = 3): string[] {
  const levelSuggestions = [...suggestionBank[level]];
  const selected: string[] = [];

  // Shuffle level suggestions
  for (let i = levelSuggestions.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [levelSuggestions[i], levelSuggestions[j]] = [levelSuggestions[j], levelSuggestions[i]];
  }

  // Take up to count suggestions
  const limit = Math.min(count, levelSuggestions.length);
  for (let i = 0; i < limit; i++) {
    selected.push(levelSuggestions[i]);
  }

  // If we need more to reach count, pull from universal tips
  if (selected.length < count) {
    const remaining = count - selected.length;
    const shuffledUniversal = [...universalTips];
    for (let i = shuffledUniversal.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffledUniversal[i], shuffledUniversal[j]] = [shuffledUniversal[j], shuffledUniversal[i]];
    }
    for (let i = 0; i < Math.min(remaining, shuffledUniversal.length); i++) {
      selected.push(shuffledUniversal[i]);
    }
  }

  return selected;
}