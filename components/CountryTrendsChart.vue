<script setup lang="ts">
import { ref, computed } from 'vue'
import { Line } from 'vue-chartjs'
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend
} from 'chart.js'
import type { TrendsResponseDTO } from '~/types/dto'
import { TOPIC_META } from '~/types/domain'

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend)

const TOPIC_COLORS: Record<string, string> = {
  politics:    '#4e79a7',
  economy:     '#f28e2b',
  military:    '#e15759',
  environment: '#59a14f',
  technology:  '#76b7b2',
  health:      '#edc948',
  culture:     '#b07aa1',
  sports:      '#ff9da7'
}

interface Props {
  countryCode: string
}
const props = defineProps<Props>()

type Days = 7 | 30 | 90
const days = ref<Days>(30)

const { data, pending } = useFetch<TrendsResponseDTO>(
  () => `/api/countries/${props.countryCode}/trends`,
  {
    query: { days },
    lazy: true
  }
)

const items = computed(() => data.value?.items ?? [])

const chartData = computed(() => {
  const dates = [...new Set(items.value.map((d) => d.date))].sort()
  const topics = [...new Set(items.value.map((d) => d.topic))]

  return {
    labels: dates,
    datasets: topics.map((topic) => ({
      label: TOPIC_META[topic as keyof typeof TOPIC_META]?.labelEn ?? topic,
      data: dates.map((date) => {
        const row = items.value.find((d) => d.topic === topic && d.date === date)
        return row?.count ?? 0
      }),
      borderColor: TOPIC_COLORS[topic] ?? '#aaa',
      backgroundColor: (TOPIC_COLORS[topic] ?? '#aaa') + '22',
      tension: 0.3,
      fill: false,
      pointRadius: 3
    }))
  }
})

const chartOptions = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    legend: { position: 'bottom' as const },
    title: { display: false }
  },
  scales: {
    y: {
      beginAtZero: true,
      ticks: { precision: 0 }
    }
  }
}
</script>

<template>
  <div class="flex flex-col gap-4">
    <!-- Period toggle -->
    <div class="flex gap-2" role="group" aria-label="Trend period">
      <button
        v-for="d in ([7, 30, 90] as Days[])"
        :key="d"
        class="inline-flex h-9 items-center justify-center rounded-full border px-4 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
        :class="
          days === d
            ? 'border-accent bg-accent text-white shadow-sm'
            : 'border-black/10 bg-surface text-ink hover:bg-surface-muted dark:border-white/15 dark:bg-surface-dark-muted dark:text-ink-dark dark:hover:bg-surface-dark'
        "
        @click="days = d"
      >
        {{ d }}d
      </button>
    </div>

    <!-- Loading -->
    <CountryTrendsSkeleton v-if="pending" />

    <!-- Empty -->
    <div
      v-else-if="items.length === 0"
      class="flex h-64 items-center justify-center rounded-xl border border-dashed border-black/10 text-sm text-ink-muted dark:border-white/15 dark:text-ink-dark-muted"
    >
      No article data for this period.
    </div>

    <!-- Chart -->
    <div v-else class="h-64">
      <Line :data="chartData" :options="chartOptions" />
    </div>
  </div>
</template>
