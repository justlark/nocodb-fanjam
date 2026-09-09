<script lang="ts" setup>
interface Props {
  size?: number
}

const props = withDefaults(defineProps<Props>(), {
  size: 90,
})

const { size } = toRefs(props)
</script>

<template>
  <div :style="{ left: `calc(50% - ${size / 2}px)`, top: `-${size / 2}px` }" class="color-transition absolute rounded-lg">
    <img :width="size" :height="size" alt="FanJam" :src="FANJAM_ICON_URL" />
  </div>
</template>
