<script lang="ts" setup></script>

<template>
  <a
    class="flex items-center gap-2 min-w-0 !no-underline !text-nc-content-gray-emphasis transition-all duration-200 transform hover:scale-105"
    :href="FANJAM_URL"
    target="_blank"
    rel="noopener noreferrer"
  >
    <img :src="FANJAM_ICON_URL" alt="" class="flex-none w-6 h-6 object-contain" />

    <span class="text-base font-semibold leading-none truncate">FanJam</span>
  </a>
</template>
