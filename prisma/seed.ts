// prisma/seed.ts
//
// EarthLetter seed — 10 countries × 3 topics × 2–3 English-language RSS feeds.
//
// Curation notes:
// - All feeds are English-language at time of curation.
// - Feeds marked `// REVIEW:` are not 100% verified as live or topic-pure and
//   should be validated by QA or replaced before production launch.
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
  { code: 'US', nameEn: 'United States', nameKo: '미국' },
  { code: 'GB', nameEn: 'United Kingdom', nameKo: '영국' },
  { code: 'CN', nameEn: 'China', nameKo: '중국' },
  { code: 'RU', nameEn: 'Russia', nameKo: '러시아' },
  { code: 'JP', nameEn: 'Japan', nameKo: '일본' },
  { code: 'KR', nameEn: 'South Korea', nameKo: '대한민국' },
  { code: 'DE', nameEn: 'Germany', nameKo: '독일' },
  { code: 'FR', nameEn: 'France', nameKo: '프랑스' },
  { code: 'IL', nameEn: 'Israel', nameKo: '이스라엘' },
  { code: 'IN', nameEn: 'India', nameKo: '인도' }
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
