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
  slug: 'military' | 'economy' | 'politics'
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
  { code: 'EG', nameEn: 'Egypt', nameKo: '이집트' }
]

const TOPICS: TopicSeed[] = [
  { slug: 'military', label: 'Military & Security' },
  { slug: 'economy', label: 'Economy' },
  { slug: 'politics', label: 'Politics' }
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
  }
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
