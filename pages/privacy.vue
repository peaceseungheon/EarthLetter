<script setup lang="ts">
useSiteSeo({
  title: 'Privacy Policy — EarthLetter',
  description:
    'What EarthLetter collects, what it does not, and how third-party advertising affects your visit.',
  ogType: 'website',
})
</script>

<template>
  <article class="mx-auto max-w-3xl px-4 py-10 prose prose-slate dark:prose-invert">
    <h1>Privacy Policy</h1>
    <p><em>Last updated: April 2026</em></p>

    <h2>What we collect directly</h2>
    <p>
      EarthLetter does not require an account and stores no personal
      information on our servers. We do not track your reading history and do
      not sell data.
    </p>
    <p>
      The only client-side preference we persist is your chosen color theme
      (light or dark), stored in your browser's local storage under the key
      <code>earthletter-color-mode</code>. It never leaves your device.
    </p>

    <h2>Cookies</h2>
    <p>
      The site itself does not set tracking cookies. If third-party services
      (see below) set their own cookies, your browser is the party that stores
      them — we can't read them.
    </p>

    <h2>Third-party services</h2>
    <ul>
      <li>
        <strong>Google AdSense</strong> — once enabled, AdSense may use cookies
        and similar technologies to show you personalized ads on pages other
        than our home and legal pages. You can opt out of personalized
        advertising via
        <a href="https://adssettings.google.com/" rel="nofollow">Ads Settings</a>
        or learn more at
        <a href="https://policies.google.com/technologies/ads" rel="nofollow">
          Google's Advertising Privacy page</a
        >.
      </li>
      <li>
        <strong>Hosting provider (Vercel)</strong> — may collect standard
        server logs (IP address, user agent, request URL) for operational and
        security purposes.
      </li>
    </ul>

    <h2>Outbound links</h2>
    <p>
      Clicking a headline takes you to the original publisher's site. Their
      privacy practices are their own and are not covered by this policy.
    </p>

    <h2>Children</h2>
    <p>
      EarthLetter is a general-audience reader. It is not directed at children
      under 13.
    </p>

    <h2>Changes</h2>
    <p>
      If this policy changes, the effective date above will be updated. Please
      check back periodically.
    </p>
  </article>
</template>
