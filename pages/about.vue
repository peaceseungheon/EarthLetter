<script setup lang="ts">
useSiteSeo({
  title: 'About EarthLetter',
  description:
    'EarthLetter curates English-language headlines by country and topic — military, economy, and politics. Our mission, sources, and how we work.',
  ogType: 'website'
})
</script>

<template>
  <article class="mx-auto max-w-3xl px-4 py-10 prose prose-slate dark:prose-invert">
    <h1>About EarthLetter</h1>

    <p>
      EarthLetter is a reading tool for world affairs. Click a country on the
      world map and you get three streams of headlines — military and security,
      economy, and politics — drawn from the country's most recognized
      English-language outlets.
    </p>

    <h2>Why this exists</h2>
    <p>
      Most news aggregators either try to rank everything into one feed or
      demand that you already know where to look. EarthLetter reverses the
      question: start from geography. If you want to understand what people in
      a given country are reading about right now, the map tells you in a
      single click.
    </p>

    <h2>How it works</h2>
    <ul>
      <li>
        We maintain a short curated list of reputable English-language RSS
        feeds per (country, topic) combination.
      </li>
      <li>
        An automated job refreshes every feed once an hour and stores the
        headlines in our database. We never copy the full article text —
        each card links out to the original publisher.
      </li>
      <li>
        Dim countries on the map do not yet have feeds configured; we expand
        the roster continuously.
      </li>
    </ul>

    <h2>Editorial stance</h2>
    <p>
      We curate for source diversity within each country and topic. That
      sometimes includes state-affiliated outlets — included explicitly so
      readers can triangulate framing across viewpoints, not because we
      endorse editorial lines. When in doubt, read the original and check the
      "About" page of the publisher.
    </p>
    <p>
      Some sources are state-affiliated. EarthLetter does not endorse any
      content; we aggregate headlines across perspectives to provide a
      balanced global view.
    </p>

    <h2>Contact</h2>
    <p>
      Spotted a broken feed or want to suggest a source? Open an issue in our
      repository. We welcome corrections — this is a small, hand-tuned
      project.
    </p>
  </article>
</template>
