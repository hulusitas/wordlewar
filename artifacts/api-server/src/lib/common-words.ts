import { WORD_SET } from "./words";

// Curated list of well-known Turkish 5-letter words.
// Filtered at runtime against WORD_SET so only valid words become secret words.
const RAW_COMMON: string[] = [
  // Everyday objects & home
  "ARABA", "BAHÇE", "DOLAP", "DUVAR", "HAVLU", "KALEM", "KAPAK", "KİTAP", "LAMBA",
  "MASA", "SANDALYE", "YATAK", "ÇANTA", "ÇATAL", "ŞAPKA", "TABLO", "TAVAN", "TENCERE",
  "AYNA", "HALAT", "KEMER", "MAKAS", "SEPET", "KAŞIK", "ÇEKİÇ", "BARDAK", "TABAK",
  "ÇAKMAK", "KİLİT", "MUSLUK", "SÜPÜRGE",

  // Food & drink
  "AYRAN", "EKMEK", "ELMAS", "HELVA", "KAHVE", "KAVUN", "KAVİM", "LİMON", "LOKUM",
  "MEYVE", "PEKMEZ", "PASTA", "PIRASA", "ŞEKER", "TAVUK", "YUMURTA", "ZEYTIN",
  "BAKLA", "BIBER", "ÜZÜM", "TURŞU", "SOĞAN", "SALÇA", "PORTAKAL", "MAKARNA",

  // Nature & places
  "BAHÇE", "BULUT", "DENİZ", "DUMAN", "GÜNEŞ", "KIYIA", "KUYTU", "NEHİR", "ORMAN",
  "KUZEY", "GÜNEY", "DOĞU", "BATIK", "DÜNYA", "HAVAN", "KUŞAK", "YAYLA",
  "ÇAYIR", "DELTA", "KUMUL", "ŞELALE",

  // Animals
  "ASLAN", "BALIK", "BEBEK", "CEYLAN", "HOROZ", "KARGI", "KARTAL", "KARGA", "KOYUN",
  "KÖPEK", "KOYUN", "ÖRDEK", "TILKI", "TAVUK", "ARILA", "BÖCEK", "GEYIK", "MAYMUN",
  "KAPLAN", "SINCAP",

  // Body & health
  "BEDEN", "BEYİN", "BOYUN", "BURUN", "DAMAR", "KABURGA", "KARİN", "SİNİR",
  "VÜCUT", "DIRSEK", "GERDAN", "BILEK",

  // People & society
  "ASKER", "ÇOBAN", "ERKEK", "ESİR", "GELİN", "İNSAN", "KADRO", "KASAP",
  "POLİS", "YAZAR", "ÇOCUK", "DOKTOR", "HEMŞIRE", "ÖĞRENCİ",

  // Emotions & mind
  "ÜZGÜN", "ENDIŞE", "GİZEM", "HEVES", "HÜZÜN", "İNANÇ", "KORKU", "MERAK",
  "MUTLU", "NEŞE", "ÖFKE", "SEVGİ", "UMUT", "YAKIN",

  // Concepts & abstracts
  "AKLIN", "BAŞKA", "BİLGİ", "BÜYÜK", "DEĞİL", "DEVAM", "DOĞRU", "DÜZEN",
  "EYLEM", "FİKİR", "GÜZEL", "HAYAT", "HAYIR", "HAZIR", "HESAP", "İDEAL",
  "İFADE", "İKLİM", "İSTEK", "KABUL", "KADER", "KENDİ", "KESİN", "KOŞUL",
  "KÜÇÜK", "MASAL", "MORAL", "NEDEN", "NİYET", "ÖNDЕР", "SANAT", "SEBEP",
  "SEÇİM", "SEFER", "SİSTEM", "SÜPER", "TEMEL", "TEPKİ", "TUTKU", "ÜLKÜ",
  "VAKİT", "VATAN", "YAŞAM", "YETKİ", "ZİHİN", "ÇÖZÜM",

  // Common verbs / actions (noun form)
  "DÖVÜŞ", "GEÇİŞ", "GELİR", "KARAR", "KAYIP", "OYNAK", "SAVAŞ", "YORUM",
  "ÇIKIŞ", "ÇİZGİ",

  // Daily life
  "BANKA", "BAHAR", "ÇARŞI", "GAZETe", "HABER", "KİTAP", "MÜZİK", "PAZAR",
  "RADYO", "SALON", "ŞEHİR", "SOKAK", "TARİH", "TATİL", "OKUMA",

  // Common Turkish words (high frequency)
  "AKŞAM", "SABAH", "BUGÜN", "YARIN", "HAFTA", "SENE", "NISAN", "ŞUBAT",
  "OCAK", "MAYIS", "TEMMUZ", "EYLÜL", "KASIM", "ARALIK",

  // Well-known 5-letter words
  "ALKOL", "BAŞAK", "BOYUN", "ÇEVRE", "ÇIÇEK", "ÇOBAN", "DEMİR", "DIKEN",
  "DOĞAL", "DRAMA", "ERKEN", "ESNAF", "EVREN", "GAZOZ", "GENİŞ", "GİTAR",
  "GÜNDÜZ", "GÜNAH", "GÜÇLÜ", "HAFIF", "HAPİS", "HAVUZ", "HESAP", "HUKUK",
  "İFADE", "İZLEM", "KABAK", "KAFES", "KAĞIT", "KANAL", "KANAT", "KAVGA",
  "KAZAK", "KAZAN", "KARİN", "KENAR", "KEŞKE", "KOMŞU", "KOPYA", "KOVAN",
  "KUTUP", "MARKA", "MEDYA", "MİRAS", "MODEL", "MOTOR", "NOTER", "NÜFUS",
  "OĞLAN", "ÖNDER", "ÖRGÜ", "PAKİT", "PAMUK", "PASTA", "PEMBE", "PİLOT",
  "PLAKA", "REZİL", "RİTİM", "ROBOT", "ROMAN", "SABUN", "SAHTE", "SAKAL",
  "SAKİN", "SAYFA", "SEHER", "SİLAH", "SINAV", "SINIF", "SİNİR", "SOLUK",
  "ŞAMAN", "ŞEHİT", "ŞİMDİ", "TABAN", "TABAK", "TAHIL", "TALAN", "TALEP",
  "TARAK", "TARLA", "TASİT", "TAYIN", "TEKNE", "TENİS", "TEPSİ", "TOKAT",
  "TÖREN", "TUZLU", "UZMAN", "VATAN", "VERGİ", "VİRÜS", "YAKUT", "YAKIN",
  "YANKI", "YAVAŞ", "YEŞİL", "YEDEK", "YILDİZ", "YOLCU", "YÜZME", "ZAFER",
  "ZAYİF", "ZEHİR", "ZEMİN", "ZİYAN", "İŞARET", "BULUT",

  // Very common everyday words (double-check 5 chars)
  "AKICI", "AKLIN", "BAKIŞ", "BASİT", "BASKI", "BASIN", "BATIK", "BEYİN",
  "BİLİM", "BİTKİ", "BOŞLUK", "BOZUK", "BUYUR", "ÇEKME", "DEMIR", "DOĞUM",
  "ERKEK", "EVREN", "FINAL", "FIRMA", "GELİR", "GEÇİŞ", "GİZLİ", "GÜLER",
  "HAFİF", "HAPİS", "HOROZ", "HUKUK", "KABUL", "KADAR", "KADER", "KALIM",
  "KANAT", "KAVUN", "KAZAK", "KEDER", "KELİM", "KOŞUL", "KUTUP", "MARKA",
  "MESAJ", "MODEL", "MORAL", "MOTOR", "NEDEN", "ÖNEMİ", "PAKET", "PAMİK",
  "PEMBe", "PİLOT", "POLİS", "SAKIN", "SAYGI", "SANAT", "SICAK", "SOKAK",
  "SÜPER", "TAKİP", "TAKSİ", "TEMEL", "UYSAL", "UZMAN", "YEDEK", "YETKİ",
  "YORUM", "ZAFER", "ZAYİF",
];

// Normalize to uppercase Turkish (same as server normalization)
function normalizeTurkish(str: string): string {
  return str
    .replace(/i/g, "İ")
    .replace(/ı/g, "I")
    .replace(/ğ/g, "Ğ")
    .replace(/ü/g, "Ü")
    .replace(/ş/g, "Ş")
    .replace(/ö/g, "Ö")
    .replace(/ç/g, "Ç")
    .toUpperCase();
}

// Filter to only 5-letter words that exist in the validation dictionary
const normalized = [...new Set(RAW_COMMON.map(normalizeTurkish))];
export const COMMON_WORDS: string[] = normalized.filter(
  (w) => w.length === 5 && WORD_SET.has(w)
);
