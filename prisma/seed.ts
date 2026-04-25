// prisma/seed.ts
//
// EarthLetter seed — 30 countries × 3 topics × 1–3 English-language RSS feeds.
//
// Curation notes:
// - All feeds are English-language at time of curation.
// - Feeds marked `// REVIEW:` are not 100% verified as live or topic-pure and
//   should be validated by QA or replaced before production launch.
// - Feeds annotated `// state-affiliated` are from state-owned or state-run
//   outlets and are included for coverage breadth, not endorsement.
// - Any `placeholder.example` URL is a known-dead stand-in — replace it
//   before production launch or disable the source via the admin UI.
// - Source of truth for coverage; adding a country is a seed edit + migrate.
//
// Run via: `pnpm prisma:seed` (package.json > prisma.seed → `tsx prisma/seed.ts`).

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

interface CountrySeed {
  code: string
  nameEn: string
  nameKo: string | null
}

interface TopicSeed {
  slug: 'military' | 'economy' | 'politics' | 'environment' | 'technology' | 'health' | 'culture' | 'sports'
  label: string
}

interface SourceSeed {
  countryCode: string
  topicSlug: TopicSeed['slug']
  name: string
  feedUrl: string
}

const COUNTRIES: CountrySeed[] = [
  // --- Original 10 (MVP) ---
  { code: 'US', nameEn: 'United States', nameKo: '미국' },
  { code: 'GB', nameEn: 'United Kingdom', nameKo: '영국' },
  { code: 'CN', nameEn: 'China', nameKo: '중국' },
  { code: 'RU', nameEn: 'Russia', nameKo: '러시아' },
  { code: 'JP', nameEn: 'Japan', nameKo: '일본' },
  { code: 'KR', nameEn: 'South Korea', nameKo: '대한민국' },
  { code: 'DE', nameEn: 'Germany', nameKo: '독일' },
  { code: 'FR', nameEn: 'France', nameKo: '프랑스' },
  { code: 'IL', nameEn: 'Israel', nameKo: '이스라엘' },
  { code: 'IN', nameEn: 'India', nameKo: '인도' },

  // --- Feature G expansion: +20 countries → 30 total ---
  // Asia-Pacific (+5)
  { code: 'AU', nameEn: 'Australia', nameKo: '호주' },
  { code: 'NZ', nameEn: 'New Zealand', nameKo: '뉴질랜드' },
  { code: 'SG', nameEn: 'Singapore', nameKo: '싱가포르' },
  { code: 'PH', nameEn: 'Philippines', nameKo: '필리핀' },
  { code: 'ID', nameEn: 'Indonesia', nameKo: '인도네시아' },

  // Europe (+5)
  { code: 'IT', nameEn: 'Italy', nameKo: '이탈리아' },
  { code: 'ES', nameEn: 'Spain', nameKo: '스페인' },
  { code: 'NL', nameEn: 'Netherlands', nameKo: '네덜란드' },
  { code: 'PL', nameEn: 'Poland', nameKo: '폴란드' },
  { code: 'UA', nameEn: 'Ukraine', nameKo: '우크라이나' },

  // Americas (+4)
  { code: 'CA', nameEn: 'Canada', nameKo: '캐나다' },
  { code: 'BR', nameEn: 'Brazil', nameKo: '브라질' },
  { code: 'MX', nameEn: 'Mexico', nameKo: '멕시코' },
  { code: 'AR', nameEn: 'Argentina', nameKo: '아르헨티나' },

  // Middle East (+3)
  { code: 'AE', nameEn: 'United Arab Emirates', nameKo: '아랍에미리트' },
  { code: 'SA', nameEn: 'Saudi Arabia', nameKo: '사우디아라비아' },
  { code: 'TR', nameEn: 'Turkey', nameKo: '튀르키예' },

  // Africa (+3)
  { code: 'ZA', nameEn: 'South Africa', nameKo: '남아프리카 공화국' },
  { code: 'NG', nameEn: 'Nigeria', nameKo: '나이지리아' },
  { code: 'EG', nameEn: 'Egypt', nameKo: '이집트' },

  // --- Iteration 6 expansion: +20 countries → 50 total ---
  // Asia-Pacific (+5)
  { code: 'PK', nameEn: 'Pakistan',         nameKo: '파키스탄' },
  { code: 'BD', nameEn: 'Bangladesh',        nameKo: '방글라데시' },
  { code: 'LK', nameEn: 'Sri Lanka',         nameKo: '스리랑카' },
  { code: 'KZ', nameEn: 'Kazakhstan',        nameKo: '카자흐스탄' },
  { code: 'MM', nameEn: 'Myanmar',           nameKo: '미얀마' },

  // Europe (+5)
  { code: 'SE', nameEn: 'Sweden',            nameKo: '스웨덴' },
  { code: 'NO', nameEn: 'Norway',            nameKo: '노르웨이' },
  { code: 'CZ', nameEn: 'Czech Republic',    nameKo: '체코' },
  { code: 'RO', nameEn: 'Romania',           nameKo: '루마니아' },
  { code: 'HU', nameEn: 'Hungary',           nameKo: '헝가리' },

  // Middle East & Africa (+5)
  { code: 'IQ', nameEn: 'Iraq',              nameKo: '이라크' },
  { code: 'LY', nameEn: 'Libya',             nameKo: '리비아' },
  { code: 'ET', nameEn: 'Ethiopia',          nameKo: '에티오피아' },
  { code: 'KE', nameEn: 'Kenya',             nameKo: '케냐' },
  { code: 'TZ', nameEn: 'Tanzania',          nameKo: '탄자니아' },

  // Americas (+5)
  { code: 'VE', nameEn: 'Venezuela',         nameKo: '베네수엘라' },
  { code: 'CL', nameEn: 'Chile',             nameKo: '칠레' },
  { code: 'CO', nameEn: 'Colombia',          nameKo: '콜롬비아' },
  { code: 'CU', nameEn: 'Cuba',              nameKo: '쿠바' },
  { code: 'PE', nameEn: 'Peru',              nameKo: '페루' }
]

const TOPICS: TopicSeed[] = [
  { slug: 'military',    label: 'Military & Security' },
  { slug: 'economy',     label: 'Economy' },
  { slug: 'politics',    label: 'Politics' },
  { slug: 'environment', label: 'Environment & Climate' },
  { slug: 'technology',  label: 'Technology & Innovation' },
  { slug: 'health',      label: 'Health & Medicine' },
  { slug: 'culture',     label: 'Culture & Society' },
  { slug: 'sports',      label: 'Sports' }
]

// NOTE: feedUrl must be unique across the table (Source.feedUrl @unique).
// If two cells point at the same URL, dedupe here before seeding.
const SOURCES: SourceSeed[] = [
  // ---------- United States ----------
  {
    countryCode: 'US',
    topicSlug: 'military',
    name: 'Defense News — Top Stories',
    feedUrl: 'https://www.defensenews.com/arc/outboundfeeds/rss/?outputType=xml'
  },
  {
    countryCode: 'US',
    topicSlug: 'military',
    name: 'Military.com — News',
    feedUrl: 'https://www.military.com/rss-feeds/content-feed.xml' // REVIEW: verify path
  },
  {
    countryCode: 'US',
    topicSlug: 'economy',
    name: 'Reuters — US Business',
    feedUrl: 'https://www.reutersagency.com/feed/?best-sectors=business-finance&post_type=best'
  },
  {
    countryCode: 'US',
    topicSlug: 'economy',
    name: 'CNBC — Economy',
    feedUrl: 'https://www.cnbc.com/id/20910258/device/rss/rss.html'
  },
  {
    countryCode: 'US',
    topicSlug: 'politics',
    name: 'The Hill — News',
    feedUrl: 'https://thehill.com/news/feed/'
  },
  {
    countryCode: 'US',
    topicSlug: 'politics',
    name: 'Politico — Politics',
    feedUrl: 'https://rss.politico.com/politics-news.xml'
  },

  // ---------- United Kingdom ----------
  {
    countryCode: 'GB',
    topicSlug: 'military',
    name: 'UK Defence Journal',
    feedUrl: 'https://ukdefencejournal.org.uk/feed/'
  },
  {
    countryCode: 'GB',
    topicSlug: 'military',
    name: 'Forces News', // REVIEW: check if still publishing
    feedUrl: 'https://www.forces.net/rss.xml'
  },
  {
    countryCode: 'GB',
    topicSlug: 'economy',
    name: 'BBC News — Business',
    feedUrl: 'https://feeds.bbci.co.uk/news/business/rss.xml'
  },
  {
    countryCode: 'GB',
    topicSlug: 'economy',
    name: 'The Guardian — UK Economics',
    feedUrl: 'https://www.theguardian.com/business/economics/rss'
  },
  {
    countryCode: 'GB',
    topicSlug: 'politics',
    name: 'BBC News — Politics',
    feedUrl: 'https://feeds.bbci.co.uk/news/politics/rss.xml'
  },
  {
    countryCode: 'GB',
    topicSlug: 'politics',
    name: 'The Guardian — UK Politics',
    feedUrl: 'https://www.theguardian.com/politics/rss'
  },

  // ---------- China ----------
  {
    countryCode: 'CN',
    topicSlug: 'military',
    name: 'Global Times — China Military', // REVIEW: state-run; included for coverage
    feedUrl: 'https://www.globaltimes.cn/rss/china.xml'
  },
  {
    countryCode: 'CN',
    topicSlug: 'military',
    name: 'South China Morning Post — China Military',
    feedUrl: 'https://www.scmp.com/rss/322262/feed' // REVIEW: SCMP RSS IDs rotate
  },
  {
    countryCode: 'CN',
    topicSlug: 'economy',
    name: 'South China Morning Post — China Economy',
    feedUrl: 'https://www.scmp.com/rss/92/feed' // REVIEW
  },
  {
    countryCode: 'CN',
    topicSlug: 'economy',
    name: 'Caixin Global',
    feedUrl: 'https://www.caixinglobal.com/rss/economy.xml' // REVIEW: verify path
  },
  {
    countryCode: 'CN',
    topicSlug: 'politics',
    name: 'South China Morning Post — China Politics',
    feedUrl: 'https://www.scmp.com/rss/4/feed' // REVIEW
  },
  {
    countryCode: 'CN',
    topicSlug: 'politics',
    name: 'Xinhua — China',
    feedUrl: 'http://www.xinhuanet.com/english/rss/chinarss.xml' // REVIEW: state-run
  },

  // ---------- Russia ----------
  {
    countryCode: 'RU',
    topicSlug: 'military',
    name: 'The Moscow Times — Russia',
    feedUrl: 'https://www.themoscowtimes.com/rss/news'
  },
  {
    countryCode: 'RU',
    topicSlug: 'military',
    name: 'Meduza — English',
    feedUrl: 'https://meduza.io/rss/en/news'
  },
  {
    countryCode: 'RU',
    topicSlug: 'economy',
    name: 'Reuters — Russia', // REVIEW: topic breadth
    feedUrl: 'https://www.reutersagency.com/feed/?taxonomy=best-regions&post_type=best&best-regions=europe'
  },
  {
    countryCode: 'RU',
    topicSlug: 'economy',
    name: 'bne IntelliNews — Russia',
    feedUrl: 'https://www.intellinews.com/rss/country/russia' // REVIEW
  },
  {
    countryCode: 'RU',
    topicSlug: 'politics',
    name: 'The Moscow Times — Politics',
    feedUrl: 'https://www.themoscowtimes.com/rss/politics' // REVIEW: section may differ
  },
  {
    countryCode: 'RU',
    topicSlug: 'politics',
    name: 'RFE/RL — Russia',
    feedUrl: 'https://www.rferl.org/api/zrqiteuuipt'
  },

  // ---------- Japan ----------
  {
    countryCode: 'JP',
    topicSlug: 'military',
    name: 'The Japan Times — National',
    feedUrl: 'https://www.japantimes.co.jp/feed/topstories/'
  },
  {
    countryCode: 'JP',
    topicSlug: 'military',
    name: 'NHK World — News',
    feedUrl: 'https://www3.nhk.or.jp/nhkworld/en/news/feeds/' // REVIEW
  },
  {
    countryCode: 'JP',
    topicSlug: 'economy',
    name: 'Nikkei Asia — Economy',
    feedUrl: 'https://asia.nikkei.com/rss/feed/nar' // REVIEW: broad
  },
  {
    countryCode: 'JP',
    topicSlug: 'economy',
    name: 'The Japan Times — Business',
    feedUrl: 'https://www.japantimes.co.jp/business/feed/'
  },
  {
    countryCode: 'JP',
    topicSlug: 'politics',
    name: 'The Japan Times — Politics',
    feedUrl: 'https://www.japantimes.co.jp/news/politics-diplomacy/feed/'
  },
  {
    countryCode: 'JP',
    topicSlug: 'politics',
    name: 'Kyodo News — Politics',
    feedUrl: 'https://english.kyodonews.net/rss/politics.xml' // REVIEW
  },

  // ---------- South Korea ----------
  {
    countryCode: 'KR',
    topicSlug: 'military',
    name: 'Yonhap News — National/Defense',
    feedUrl: 'https://en.yna.co.kr/RSS/northkorea.xml' // REVIEW: closest English defense feed
  },
  {
    countryCode: 'KR',
    topicSlug: 'military',
    name: 'The Korea Herald — National',
    feedUrl: 'https://www.koreaherald.com/common_prog/rssdisp.php?ct=010100000000.xml' // REVIEW
  },
  {
    countryCode: 'KR',
    topicSlug: 'economy',
    name: 'The Korea Herald — Business',
    feedUrl: 'https://www.koreaherald.com/common_prog/rssdisp.php?ct=020000000000.xml' // REVIEW
  },
  {
    countryCode: 'KR',
    topicSlug: 'economy',
    name: 'Yonhap News — Business',
    feedUrl: 'https://en.yna.co.kr/RSS/business.xml'
  },
  {
    countryCode: 'KR',
    topicSlug: 'politics',
    name: 'Yonhap News — Politics',
    feedUrl: 'https://en.yna.co.kr/RSS/politics.xml'
  },
  {
    countryCode: 'KR',
    topicSlug: 'politics',
    name: 'The Korea Times — Politics',
    feedUrl: 'https://www.koreatimes.co.kr/www/rss/nation.xml' // REVIEW
  },

  // ---------- Germany ----------
  {
    countryCode: 'DE',
    topicSlug: 'military',
    name: 'Deutsche Welle — Germany',
    feedUrl: 'https://rss.dw.com/rdf/rss-en-ger'
  },
  {
    countryCode: 'DE',
    topicSlug: 'military',
    name: 'The Local DE — News', // REVIEW: broad but covers defense
    feedUrl: 'https://feeds.thelocal.com/rss/de'
  },
  {
    countryCode: 'DE',
    topicSlug: 'economy',
    name: 'Deutsche Welle — Business',
    feedUrl: 'https://rss.dw.com/rdf/rss-en-bus'
  },
  {
    countryCode: 'DE',
    topicSlug: 'economy',
    name: 'Reuters — Germany', // REVIEW
    feedUrl: 'https://www.reutersagency.com/feed/?best-regions=europe&post_type=best'
  },
  {
    countryCode: 'DE',
    topicSlug: 'politics',
    name: 'Der Spiegel — International',
    feedUrl: 'https://www.spiegel.de/international/index.rss'
  },
  {
    countryCode: 'DE',
    topicSlug: 'politics',
    name: 'Deutsche Welle — Top Stories',
    feedUrl: 'https://rss.dw.com/rdf/rss-en-top'
  },

  // ---------- France ----------
  {
    countryCode: 'FR',
    topicSlug: 'military',
    name: 'France 24 — France',
    feedUrl: 'https://www.france24.com/en/france/rss'
  },
  {
    countryCode: 'FR',
    topicSlug: 'military',
    name: 'RFI — France',
    feedUrl: 'https://www.rfi.fr/en/france/rss'
  },
  {
    countryCode: 'FR',
    topicSlug: 'economy',
    name: 'France 24 — Business',
    feedUrl: 'https://www.france24.com/en/business/rss'
  },
  {
    countryCode: 'FR',
    topicSlug: 'economy',
    name: 'RFI — Business',
    feedUrl: 'https://www.rfi.fr/en/business/rss'
  },
  {
    countryCode: 'FR',
    topicSlug: 'politics',
    name: 'Le Monde — International',
    feedUrl: 'https://www.lemonde.fr/en/international/rss_full.xml'
  },
  {
    countryCode: 'FR',
    topicSlug: 'politics',
    name: 'Politico Europe',
    feedUrl: 'https://www.politico.eu/feed/' // REVIEW: broader than FR-only
  },

  // ---------- Israel ----------
  {
    countryCode: 'IL',
    topicSlug: 'military',
    name: 'The Times of Israel — IDF',
    feedUrl: 'https://www.timesofisrael.com/topic/idf/feed/'
  },
  {
    countryCode: 'IL',
    topicSlug: 'military',
    name: 'The Jerusalem Post — Israel News',
    feedUrl: 'https://www.jpost.com/rss/rssfeedsisraelnews'
  },
  {
    countryCode: 'IL',
    topicSlug: 'economy',
    name: 'The Times of Israel — Business',
    feedUrl: 'https://www.timesofisrael.com/topic/business/feed/'
  },
  {
    countryCode: 'IL',
    topicSlug: 'economy',
    name: 'Globes — English',
    feedUrl: 'https://www.globes.co.il/WebService/rss/rssfeeder.asmx/FeederNode?iID=1725'
  },
  {
    countryCode: 'IL',
    topicSlug: 'politics',
    name: 'The Times of Israel — Politics',
    feedUrl: 'https://www.timesofisrael.com/topic/politics/feed/'
  },
  {
    countryCode: 'IL',
    topicSlug: 'politics',
    name: 'Haaretz — Israel News',
    feedUrl: 'https://www.haaretz.com/cmlink/1.628752' // REVIEW
  },

  // ---------- India ----------
  {
    countryCode: 'IN',
    topicSlug: 'military',
    name: 'The Hindu — National',
    feedUrl: 'https://www.thehindu.com/news/national/feeder/default.rss'
  },
  {
    countryCode: 'IN',
    topicSlug: 'military',
    name: 'The Times of India — India News',
    feedUrl: 'https://timesofindia.indiatimes.com/rssfeeds/-2128936835.cms'
  },
  {
    countryCode: 'IN',
    topicSlug: 'economy',
    name: 'Livemint — Economy',
    feedUrl: 'https://www.livemint.com/rss/economy'
  },
  {
    countryCode: 'IN',
    topicSlug: 'economy',
    name: 'The Hindu — Business',
    feedUrl: 'https://www.thehindu.com/business/feeder/default.rss'
  },
  {
    countryCode: 'IN',
    topicSlug: 'politics',
    name: 'The Hindu — Politics',
    feedUrl: 'https://www.thehindu.com/news/national/politics/feeder/default.rss'
  },
  {
    countryCode: 'IN',
    topicSlug: 'politics',
    name: 'NDTV — India',
    feedUrl: 'https://feeds.feedburner.com/ndtvnews-india-news'
  },

  // ==========================================================
  // Feature G — 20 new countries (3+ sources each, all English)
  // ==========================================================

  // ---------- Australia ----------
  {
    countryCode: 'AU',
    topicSlug: 'military',
    name: 'ABC News Australia — Defence',
    feedUrl: 'https://www.abc.net.au/news/feed/51120/rss.xml' // REVIEW: verify URL
  },
  {
    countryCode: 'AU',
    topicSlug: 'economy',
    name: 'ABC News Australia — Business',
    feedUrl: 'https://www.abc.net.au/news/feed/51892/rss.xml' // REVIEW: verify URL
  },
  {
    countryCode: 'AU',
    topicSlug: 'politics',
    name: 'The Sydney Morning Herald — Federal Politics',
    feedUrl: 'https://www.smh.com.au/rss/politics/federal.xml' // REVIEW: verify URL
  },

  // ---------- New Zealand ----------
  {
    countryCode: 'NZ',
    topicSlug: 'military',
    name: 'RNZ — National',
    feedUrl: 'https://www.rnz.co.nz/rss/national.xml' // REVIEW: verify URL
  },
  {
    countryCode: 'NZ',
    topicSlug: 'economy',
    name: 'RNZ — Business',
    feedUrl: 'https://www.rnz.co.nz/rss/business.xml' // REVIEW: verify URL
  },
  {
    countryCode: 'NZ',
    topicSlug: 'politics',
    name: 'RNZ — Politics',
    feedUrl: 'https://www.rnz.co.nz/rss/political.xml' // REVIEW: verify URL
  },

  // ---------- Singapore ----------
  {
    countryCode: 'SG',
    topicSlug: 'military',
    name: 'The Straits Times — Singapore',
    feedUrl: 'https://www.straitstimes.com/news/singapore/rss.xml' // REVIEW: verify URL
  },
  {
    countryCode: 'SG',
    topicSlug: 'economy',
    name: 'Channel NewsAsia — Business',
    feedUrl: 'https://www.channelnewsasia.com/api/v1/rss-outbound-feed?_format=xml&category=6936' // REVIEW: verify URL
  },
  {
    countryCode: 'SG',
    topicSlug: 'politics',
    name: 'Channel NewsAsia — Singapore',
    feedUrl: 'https://www.channelnewsasia.com/api/v1/rss-outbound-feed?_format=xml&category=10416' // REVIEW: verify URL
  },

  // ---------- Philippines ----------
  {
    countryCode: 'PH',
    topicSlug: 'military',
    name: 'Rappler — Nation',
    feedUrl: 'https://www.rappler.com/nation/feed/' // REVIEW: verify URL
  },
  {
    countryCode: 'PH',
    topicSlug: 'economy',
    name: 'Philippine Daily Inquirer — Business',
    feedUrl: 'https://business.inquirer.net/feed' // REVIEW: verify URL
  },
  {
    countryCode: 'PH',
    topicSlug: 'politics',
    name: 'Rappler — Philippine Politics',
    feedUrl: 'https://www.rappler.com/nation/politics/feed/' // REVIEW: verify URL
  },

  // ---------- Indonesia ----------
  {
    countryCode: 'ID',
    topicSlug: 'military',
    name: 'The Jakarta Post — National',
    feedUrl: 'https://www.thejakartapost.com/rss/national' // REVIEW: verify URL
  },
  {
    countryCode: 'ID',
    topicSlug: 'economy',
    name: 'The Jakarta Post — Business',
    feedUrl: 'https://www.thejakartapost.com/rss/business' // REVIEW: verify URL
  },
  {
    countryCode: 'ID',
    topicSlug: 'politics',
    name: 'Antara News — Politics', // state-affiliated
    feedUrl: 'https://en.antaranews.com/rss/politics.xml' // REVIEW: verify URL
  },

  // ---------- Italy ----------
  {
    countryCode: 'IT',
    topicSlug: 'military',
    name: 'ANSA English — News', // state-affiliated
    feedUrl: 'https://www.ansa.it/english/english_rss.xml' // REVIEW: verify URL
  },
  {
    countryCode: 'IT',
    topicSlug: 'economy',
    name: 'ANSA English — Business', // state-affiliated
    feedUrl: 'https://www.ansa.it/english/news/business/business_rss.xml' // REVIEW: verify URL
  },
  {
    countryCode: 'IT',
    topicSlug: 'politics',
    name: 'ANSA English — Politics', // state-affiliated
    feedUrl: 'https://www.ansa.it/english/news/politics/politics_rss.xml' // REVIEW: verify URL
  },

  // ---------- Spain ----------
  {
    countryCode: 'ES',
    topicSlug: 'military',
    name: 'El País English — Spain',
    feedUrl: 'https://feeds.elpais.com/mrss-s/pages/ep/site/english.elpais.com/portada' // REVIEW: verify URL
  },
  {
    countryCode: 'ES',
    topicSlug: 'economy',
    name: 'El País English — Economy',
    feedUrl: 'https://feeds.elpais.com/mrss-s/pages/ep/site/english.elpais.com/section/economy-and-business' // REVIEW: verify URL
  },
  {
    countryCode: 'ES',
    topicSlug: 'politics',
    name: 'El País English — Politics',
    feedUrl: 'https://feeds.elpais.com/mrss-s/pages/ep/site/english.elpais.com/section/spain' // REVIEW: verify URL
  },

  // ---------- Netherlands ----------
  {
    countryCode: 'NL',
    topicSlug: 'military',
    name: 'DutchNews.nl — News',
    feedUrl: 'https://www.dutchnews.nl/feed/' // REVIEW: verify URL
  },
  {
    countryCode: 'NL',
    topicSlug: 'economy',
    name: 'NL Times — Business',
    feedUrl: 'https://nltimes.nl/business/rss' // REVIEW: verify URL
  },
  {
    countryCode: 'NL',
    topicSlug: 'politics',
    name: 'NL Times — Politics',
    feedUrl: 'https://nltimes.nl/politics/rss' // REVIEW: verify URL
  },

  // ---------- Poland ----------
  {
    countryCode: 'PL',
    topicSlug: 'military',
    name: 'Notes from Poland — News',
    feedUrl: 'https://notesfrompoland.com/feed/' // REVIEW: verify URL
  },
  {
    countryCode: 'PL',
    topicSlug: 'economy',
    name: 'PolandIn — Business',
    feedUrl: 'https://polandin.com/feed/' // REVIEW: verify URL
  },
  {
    countryCode: 'PL',
    topicSlug: 'politics',
    name: 'TVP World — Poland', // state-affiliated
    feedUrl: 'https://tvpworld.com/rss/poland.xml' // REVIEW: verify URL
  },

  // ---------- Ukraine ----------
  {
    countryCode: 'UA',
    topicSlug: 'military',
    name: 'Kyiv Independent — War',
    feedUrl: 'https://kyivindependent.com/rss/' // REVIEW: verify URL
  },
  {
    countryCode: 'UA',
    topicSlug: 'economy',
    name: 'Kyiv Post — Business',
    feedUrl: 'https://www.kyivpost.com/business/feed' // REVIEW: verify URL
  },
  {
    countryCode: 'UA',
    topicSlug: 'politics',
    name: 'Ukrinform — Politics', // state-affiliated
    feedUrl: 'https://www.ukrinform.net/rss/block-lastnews' // REVIEW: verify URL
  },

  // ---------- Canada ----------
  {
    countryCode: 'CA',
    topicSlug: 'military',
    name: 'CBC News — Politics',
    feedUrl: 'https://www.cbc.ca/webfeed/rss/rss-politics' // REVIEW: verify URL
  },
  {
    countryCode: 'CA',
    topicSlug: 'economy',
    name: 'CBC News — Business',
    feedUrl: 'https://www.cbc.ca/webfeed/rss/rss-business'
  },
  {
    countryCode: 'CA',
    topicSlug: 'politics',
    name: 'The Globe and Mail — Politics',
    feedUrl: 'https://www.theglobeandmail.com/arc/outboundfeeds/rss/category/politics/?outputType=xml' // REVIEW: verify URL
  },

  // ---------- Brazil ----------
  {
    countryCode: 'BR',
    topicSlug: 'military',
    name: 'The Brazilian Report — News',
    feedUrl: 'https://brazilian.report/feed/' // REVIEW: verify URL
  },
  {
    countryCode: 'BR',
    topicSlug: 'economy',
    name: 'Reuters — Brazil Business',
    feedUrl: 'https://www.reutersagency.com/feed/?best-regions=latin-america&post_type=best' // REVIEW: verify URL
  },
  {
    countryCode: 'BR',
    topicSlug: 'politics',
    name: 'Agência Brasil — Politics', // state-affiliated
    feedUrl: 'https://agenciabrasil.ebc.com.br/rss/politica/feed.xml' // REVIEW: verify URL
  },

  // ---------- Mexico ----------
  {
    countryCode: 'MX',
    topicSlug: 'military',
    name: 'Mexico News Daily — News',
    feedUrl: 'https://mexiconewsdaily.com/feed/' // REVIEW: verify URL
  },
  {
    countryCode: 'MX',
    topicSlug: 'economy',
    name: 'Mexico News Daily — Business',
    feedUrl: 'https://mexiconewsdaily.com/business/feed/' // REVIEW: verify URL
  },
  {
    countryCode: 'MX',
    topicSlug: 'politics',
    name: 'Mexico News Daily — Politics',
    feedUrl: 'https://mexiconewsdaily.com/politics/feed/' // REVIEW: verify URL
  },

  // ---------- Argentina ----------
  {
    countryCode: 'AR',
    topicSlug: 'military',
    name: 'Buenos Aires Times — News',
    feedUrl: 'https://www.batimes.com.ar/feed' // REVIEW: verify URL
  },
  {
    countryCode: 'AR',
    topicSlug: 'economy',
    name: 'Buenos Aires Times — Economy',
    feedUrl: 'https://www.batimes.com.ar/economy/feed' // REVIEW: verify URL
  },
  {
    countryCode: 'AR',
    topicSlug: 'politics',
    name: 'Buenos Aires Times — Politics',
    feedUrl: 'https://www.batimes.com.ar/politics/feed' // REVIEW: verify URL
  },

  // ---------- United Arab Emirates ----------
  {
    countryCode: 'AE',
    topicSlug: 'military',
    name: 'The National — UAE',
    feedUrl: 'https://www.thenationalnews.com/rss/uae' // REVIEW: verify URL
  },
  {
    countryCode: 'AE',
    topicSlug: 'economy',
    name: 'The National — Business',
    feedUrl: 'https://www.thenationalnews.com/rss/business' // REVIEW: verify URL
  },
  {
    countryCode: 'AE',
    topicSlug: 'politics',
    name: 'Gulf News — UAE',
    feedUrl: 'https://gulfnews.com/rss?path=/uae' // REVIEW: verify URL
  },

  // ---------- Saudi Arabia ----------
  {
    countryCode: 'SA',
    topicSlug: 'military',
    name: 'Arab News — Saudi Arabia', // state-affiliated
    feedUrl: 'https://www.arabnews.com/rss.xml' // REVIEW: verify URL
  },
  {
    countryCode: 'SA',
    topicSlug: 'economy',
    name: 'Arab News — Economy', // state-affiliated
    feedUrl: 'https://www.arabnews.com/economy/rss' // REVIEW: verify URL
  },
  {
    countryCode: 'SA',
    topicSlug: 'politics',
    name: 'Al Arabiya English — News', // state-affiliated
    feedUrl: 'https://english.alarabiya.net/.mrss/en/News.xml' // REVIEW: verify URL
  },

  // ---------- Turkey ----------
  {
    countryCode: 'TR',
    topicSlug: 'military',
    name: 'Daily Sabah — Türkiye',
    feedUrl: 'https://www.dailysabah.com/rssFeed/7' // REVIEW: verify URL
  },
  {
    countryCode: 'TR',
    topicSlug: 'economy',
    name: 'Hürriyet Daily News — Economy',
    feedUrl: 'https://www.hurriyetdailynews.com/rss/economy' // REVIEW: verify URL
  },
  {
    countryCode: 'TR',
    topicSlug: 'politics',
    name: 'Anadolu Agency — Politics', // state-affiliated
    feedUrl: 'https://www.aa.com.tr/en/rss/default?cat=politics' // REVIEW: verify URL
  },

  // ---------- South Africa ----------
  {
    countryCode: 'ZA',
    topicSlug: 'military',
    name: 'Daily Maverick — South Africa',
    feedUrl: 'https://www.dailymaverick.co.za/section/south-africa/feed/' // REVIEW: verify URL
  },
  {
    countryCode: 'ZA',
    topicSlug: 'economy',
    name: 'News24 — Business',
    feedUrl: 'https://feeds.news24.com/articles/fin24/Business/rss' // REVIEW: verify URL
  },
  {
    countryCode: 'ZA',
    topicSlug: 'politics',
    name: 'Daily Maverick — Politics',
    feedUrl: 'https://www.dailymaverick.co.za/section/politics/feed/' // REVIEW: verify URL
  },

  // ---------- Nigeria ----------
  {
    countryCode: 'NG',
    topicSlug: 'military',
    name: 'Premium Times — News',
    feedUrl: 'https://www.premiumtimesng.com/feed' // REVIEW: verify URL
  },
  {
    countryCode: 'NG',
    topicSlug: 'economy',
    name: 'Premium Times — Business',
    feedUrl: 'https://www.premiumtimesng.com/business/feed' // REVIEW: verify URL
  },
  {
    countryCode: 'NG',
    topicSlug: 'politics',
    name: 'Premium Times — Politics',
    feedUrl: 'https://www.premiumtimesng.com/news/top-news/feed' // REVIEW: verify URL
  },

  // ---------- Egypt ----------
  {
    countryCode: 'EG',
    topicSlug: 'military',
    name: 'Ahram Online — Egypt', // state-affiliated
    feedUrl: 'https://english.ahram.org.eg/rss/1.aspx' // REVIEW: verify URL
  },
  {
    countryCode: 'EG',
    topicSlug: 'economy',
    name: 'Ahram Online — Business', // state-affiliated
    feedUrl: 'https://english.ahram.org.eg/rss/3.aspx' // REVIEW: verify URL
  },
  {
    countryCode: 'EG',
    topicSlug: 'politics',
    name: 'Egypt Independent — News',
    feedUrl: 'https://egyptindependent.com/feed/' // REVIEW: verify URL
  },

  // ---------- environment ----------
  { countryCode: 'US', topicSlug: 'environment', name: 'EPA News',                    feedUrl: 'https://www.epa.gov/rss/epa-news.xml' },
  { countryCode: 'US', topicSlug: 'environment', name: 'Yale Environment 360',        feedUrl: 'https://e360.yale.edu/feed' },
  { countryCode: 'GB', topicSlug: 'environment', name: 'BBC Science & Environment',   feedUrl: 'https://feeds.bbci.co.uk/news/science_and_environment/rss.xml' },
  { countryCode: 'DE', topicSlug: 'environment', name: 'DW Environment',              feedUrl: 'https://rss.dw.com/rdf/rss-en-environment' },
  { countryCode: 'IN', topicSlug: 'environment', name: 'Down to Earth',               feedUrl: 'https://www.downtoearth.org.in/rss/latest-news' },
  { countryCode: 'AU', topicSlug: 'environment', name: 'ABC Environment',             feedUrl: 'https://www.abc.net.au/news/feed/52498/rss.xml' }, // REVIEW
  { countryCode: 'JP', topicSlug: 'environment', name: 'Japan Times — Environment',   feedUrl: 'https://www.japantimes.co.jp/tag/environment/feed/' },
  { countryCode: 'FR', topicSlug: 'environment', name: 'Le Monde — Environment',      feedUrl: 'https://www.lemonde.fr/en/environment/rss_full.xml' }, // REVIEW

  // ---------- technology ----------
  { countryCode: 'US', topicSlug: 'technology', name: 'TechCrunch',                  feedUrl: 'https://techcrunch.com/feed/' },
  { countryCode: 'US', topicSlug: 'technology', name: 'Wired',                        feedUrl: 'https://www.wired.com/feed/rss' },
  { countryCode: 'GB', topicSlug: 'technology', name: 'The Register',                 feedUrl: 'https://www.theregister.com/headlines.atom' },
  { countryCode: 'JP', topicSlug: 'technology', name: 'Japan Times — Technology',     feedUrl: 'https://www.japantimes.co.jp/tag/technology/feed/' },
  { countryCode: 'KR', topicSlug: 'technology', name: 'Korea Herald — Tech',          feedUrl: 'https://koreaherald.com/common/rss_xml.php?ct=050100000000' }, // REVIEW
  { countryCode: 'CN', topicSlug: 'technology', name: 'TechNode',                     feedUrl: 'https://technode.com/feed/' },
  { countryCode: 'IN', topicSlug: 'technology', name: 'Inc42',                        feedUrl: 'https://inc42.com/feed/' },
  { countryCode: 'DE', topicSlug: 'technology', name: 'DW Technology',                feedUrl: 'https://rss.dw.com/rdf/rss-en-tech' }, // REVIEW

  // ---------- health ----------
  { countryCode: 'US', topicSlug: 'health', name: 'STAT News',                        feedUrl: 'https://www.statnews.com/feed/' },
  { countryCode: 'US', topicSlug: 'health', name: 'MedPage Today',                    feedUrl: 'https://www.medpagetoday.com/rss/headlines.xml' }, // REVIEW
  { countryCode: 'GB', topicSlug: 'health', name: 'BBC Health',                        feedUrl: 'https://feeds.bbci.co.uk/news/health/rss.xml' },
  { countryCode: 'IN', topicSlug: 'health', name: 'Times of India — Health',           feedUrl: 'https://timesofindia.indiatimes.com/rssfeeds/3908999.cms' }, // REVIEW
  { countryCode: 'AU', topicSlug: 'health', name: 'The Conversation — Health',         feedUrl: 'https://theconversation.com/health/articles.atom' },
  { countryCode: 'DE', topicSlug: 'health', name: 'DW Health',                         feedUrl: 'https://rss.dw.com/rdf/rss-en-health' }, // REVIEW

  // ---------- culture ----------
  { countryCode: 'US', topicSlug: 'culture', name: 'NPR Arts & Life',                 feedUrl: 'https://feeds.npr.org/1008/rss.xml' },
  { countryCode: 'GB', topicSlug: 'culture', name: 'The Guardian — Culture',           feedUrl: 'https://www.theguardian.com/culture/rss' },
  { countryCode: 'FR', topicSlug: 'culture', name: 'France 24 — Culture',              feedUrl: 'https://www.france24.com/en/culture/rss' },
  { countryCode: 'JP', topicSlug: 'culture', name: 'Japan Today — Culture',            feedUrl: 'https://japantoday.com/category/arts-culture/feed' }, // REVIEW
  { countryCode: 'KR', topicSlug: 'culture', name: 'Korea JoongAng Daily — Culture',  feedUrl: 'https://koreajoongangdaily.joins.com/rss' }, // REVIEW

  // ---------- sports ----------
  { countryCode: 'US', topicSlug: 'sports', name: 'ESPN Headlines',                   feedUrl: 'https://www.espn.com/espn/rss/news' },
  { countryCode: 'GB', topicSlug: 'sports', name: 'BBC Sport',                         feedUrl: 'https://feeds.bbci.co.uk/sport/rss.xml' },
  { countryCode: 'AU', topicSlug: 'sports', name: 'ABC Sport',                         feedUrl: 'https://www.abc.net.au/news/sport/feed' }, // REVIEW
  { countryCode: 'IN', topicSlug: 'sports', name: 'Times of India — Sports',           feedUrl: 'https://timesofindia.indiatimes.com/rssfeeds/4719161.cms' }, // REVIEW
  { countryCode: 'JP', topicSlug: 'sports', name: 'Japan Times — Sports',              feedUrl: 'https://www.japantimes.co.jp/tag/sports/feed/' },
  { countryCode: 'KR', topicSlug: 'sports', name: 'Korea Herald — Sports',             feedUrl: 'https://koreaherald.com/common/rss_xml.php?ct=020200000000' }, // REVIEW
  { countryCode: 'DE', topicSlug: 'sports', name: 'DW Sports',                         feedUrl: 'https://rss.dw.com/rdf/rss-en-sports' }, // REVIEW
  { countryCode: 'FR', topicSlug: 'sports', name: 'France 24 — Sports',                feedUrl: 'https://www.france24.com/en/sport/rss' },

  // ---------- Pakistan ----------
  { countryCode: 'PK', topicSlug: 'politics', name: 'Dawn — Home',       feedUrl: 'https://www.dawn.com/feeds/home' },
  { countryCode: 'PK', topicSlug: 'economy',  name: 'Dawn — Business',   feedUrl: 'https://www.dawn.com/feeds/business' },
  { countryCode: 'PK', topicSlug: 'military', name: 'Geo News',           feedUrl: 'https://www.geo.tv/rss/1/breaking-news' }, // REVIEW

  // ---------- Bangladesh ----------
  { countryCode: 'BD', topicSlug: 'politics', name: 'The Daily Star BD', feedUrl: 'https://www.thedailystar.net/rss.xml' },
  { countryCode: 'BD', topicSlug: 'economy',  name: 'The Financial Express BD', feedUrl: 'https://thefinancialexpress.com.bd/rss' }, // REVIEW

  // ---------- Sri Lanka ----------
  { countryCode: 'LK', topicSlug: 'politics', name: 'Daily Mirror LK',   feedUrl: 'https://www.dailymirror.lk/latest_news/rss' }, // REVIEW
  { countryCode: 'LK', topicSlug: 'economy',  name: 'Daily FT',           feedUrl: 'https://www.ft.lk/feed/s1' }, // REVIEW

  // ---------- Kazakhstan ----------
  { countryCode: 'KZ', topicSlug: 'politics', name: 'Astana Times',       feedUrl: 'https://astanatimes.com/feed/' },
  { countryCode: 'KZ', topicSlug: 'economy',  name: 'Silk Road Briefing', feedUrl: 'https://www.silkroadbriefing.com/news/feed/' }, // REVIEW

  // ---------- Myanmar ----------
  { countryCode: 'MM', topicSlug: 'politics', name: 'Myanmar Now',        feedUrl: 'https://myanmar-now.org/en/feed/' },
  { countryCode: 'MM', topicSlug: 'politics', name: 'Irrawaddy',           feedUrl: 'https://www.irrawaddy.com/feed' },

  // ---------- Sweden ----------
  { countryCode: 'SE', topicSlug: 'politics', name: 'The Local Sweden',   feedUrl: 'https://www.thelocal.se/rss/articles' },
  { countryCode: 'SE', topicSlug: 'economy',  name: 'Radio Sweden — Economy', feedUrl: 'https://sverigesradio.se/topplista/rsslink?programid=3304' }, // REVIEW
  { countryCode: 'SE', topicSlug: 'military', name: 'Swedish Defence Research Agency', feedUrl: 'https://www.foi.se/en/foi/news/rss.xml' }, // REVIEW

  // ---------- Norway ----------
  { countryCode: 'NO', topicSlug: 'politics', name: 'The Local Norway',   feedUrl: 'https://www.thelocal.no/rss/articles' },
  { countryCode: 'NO', topicSlug: 'economy',  name: 'Upstream Online',    feedUrl: 'https://www.upstreamonline.com/rss' }, // REVIEW

  // ---------- Czech Republic ----------
  { countryCode: 'CZ', topicSlug: 'politics', name: 'Radio Prague International', feedUrl: 'https://english.radio.cz/export/rss-all.php' },
  { countryCode: 'CZ', topicSlug: 'economy',  name: 'Prague Business Journal', feedUrl: 'https://www.praguebusinessjournal.com/feed/' }, // REVIEW

  // ---------- Romania ----------
  { countryCode: 'RO', topicSlug: 'politics', name: 'Nine O\'Clock RO',  feedUrl: 'https://www.nineoclock.ro/feed/' },
  { countryCode: 'RO', topicSlug: 'economy',  name: 'Romania Insider',    feedUrl: 'https://www.romania-insider.com/feed' },

  // ---------- Hungary ----------
  { countryCode: 'HU', topicSlug: 'politics', name: 'Hungary Today',      feedUrl: 'https://hungarytoday.hu/feed/' },
  { countryCode: 'HU', topicSlug: 'economy',  name: 'Budapest Business Journal', feedUrl: 'https://bbj.hu/rss' }, // REVIEW

  // ---------- Iraq ----------
  { countryCode: 'IQ', topicSlug: 'politics', name: 'Al-Monitor — Iraq', feedUrl: 'https://www.al-monitor.com/rss/topics/iraq.xml' }, // REVIEW
  { countryCode: 'IQ', topicSlug: 'military', name: 'Iraq News Network',  feedUrl: 'https://www.iraqnewsnetwork.net/feed/' }, // REVIEW

  // ---------- Libya ----------
  { countryCode: 'LY', topicSlug: 'politics', name: 'Libya Herald',       feedUrl: 'https://www.libyaherald.com/feed/' },
  { countryCode: 'LY', topicSlug: 'military', name: 'Libya Observer',     feedUrl: 'https://www.libyaobserver.ly/feed' }, // REVIEW

  // ---------- Ethiopia ----------
  { countryCode: 'ET', topicSlug: 'politics', name: 'Addis Standard',     feedUrl: 'https://addisstandard.com/feed/' },
  { countryCode: 'ET', topicSlug: 'economy',  name: 'The Reporter Ethiopia', feedUrl: 'https://www.thereporterethiopia.com/feed' },

  // ---------- Kenya ----------
  { countryCode: 'KE', topicSlug: 'politics', name: 'Nation Africa KE',   feedUrl: 'https://nation.africa/kenya/rss.xml' }, // REVIEW
  { countryCode: 'KE', topicSlug: 'economy',  name: 'Business Daily Africa', feedUrl: 'https://www.businessdailyafrica.com/rss' }, // REVIEW

  // ---------- Tanzania ----------
  { countryCode: 'TZ', topicSlug: 'politics', name: 'The Citizen TZ',     feedUrl: 'https://www.thecitizen.co.tz/tanzania/rss.xml' }, // REVIEW
  { countryCode: 'TZ', topicSlug: 'economy',  name: 'The East African',   feedUrl: 'https://www.theeastafrican.co.ke/rss' }, // REVIEW

  // ---------- Venezuela ----------
  { countryCode: 'VE', topicSlug: 'politics', name: 'Caracas Chronicles', feedUrl: 'https://www.caracaschronicles.com/feed/' },
  { countryCode: 'VE', topicSlug: 'economy',  name: 'Venezuela Analysis', feedUrl: 'https://venezuelanalysis.com/feed' },

  // ---------- Chile ----------
  { countryCode: 'CL', topicSlug: 'politics', name: 'Santiago Times',     feedUrl: 'https://santiagotimes.cl/feed/' },
  { countryCode: 'CL', topicSlug: 'economy',  name: 'BN Americas — Chile', feedUrl: 'https://www.bnamericas.com/rss/news/chile.xml' }, // REVIEW

  // ---------- Colombia ----------
  { countryCode: 'CO', topicSlug: 'politics', name: 'Colombia Reports',   feedUrl: 'https://colombiareports.com/feed/' },
  { countryCode: 'CO', topicSlug: 'economy',  name: 'BN Americas — Colombia', feedUrl: 'https://www.bnamericas.com/rss/news/colombia.xml' }, // REVIEW

  // ---------- Cuba ----------
  { countryCode: 'CU', topicSlug: 'politics', name: 'Havana Times',       feedUrl: 'https://havanatimes.org/feed/' },
  { countryCode: 'CU', topicSlug: 'politics', name: '14ymedio',           feedUrl: 'https://www.14ymedio.com/rss.xml' }, // REVIEW: may be Spanish

  // ---------- Peru ----------
  { countryCode: 'PE', topicSlug: 'politics', name: 'Peru Reports',       feedUrl: 'https://perureports.com/feed/' }, // REVIEW
  { countryCode: 'PE', topicSlug: 'economy',  name: 'Andina — Peru News', feedUrl: 'https://andina.pe/RSS/rss.aspx?id=4' } // REVIEW
]

async function main() {
  console.log('Seeding countries…')
  for (const c of COUNTRIES) {
    await prisma.country.upsert({
      where: { code: c.code },
      update: { nameEn: c.nameEn, nameKo: c.nameKo },
      create: c
    })
  }

  console.log('Seeding topics…')
  for (const t of TOPICS) {
    await prisma.topic.upsert({
      where: { slug: t.slug },
      update: { label: t.label },
      create: t
    })
  }

  console.log(`Seeding ${SOURCES.length} sources…`)
  for (const s of SOURCES) {
    await prisma.source.upsert({
      where: { feedUrl: s.feedUrl },
      update: {
        countryCode: s.countryCode,
        topicSlug: s.topicSlug,
        name: s.name
      },
      create: { ...s, enabled: true }
    })
  }

  const sourceCount = await prisma.source.count()
  const countryCount = await prisma.country.count()
  const topicCount = await prisma.topic.count()
  console.log(
    `Done. Countries=${countryCount} Topics=${topicCount} Sources=${sourceCount}`
  )
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
