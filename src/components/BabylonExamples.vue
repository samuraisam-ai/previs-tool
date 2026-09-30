<template>

<div>
<h3>Babylon Examples</h3>
<canvas></canvas>


</div>

</template>

<script lang="ts">
import { defineComponent } from 'vue'
import { LightsShadows } from '../BabylonExamples/LightsShadows'

export default defineComponent({
  name: 'BabylonExamples',
  mounted() {
    const canvas = document.querySelector('canvas') as HTMLCanvasElement
    new LightsShadows(canvas!)
  }
})
</script>

<!-- Add "scoped" attribute to limit CSS to this component only -->
<style scoped>
div {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-height: 60vh;
  text-align: center;
}
h3 {
  margin: 24px 0;
}
canvas {
  width: 70%;
  height: 70%;
  background: #000;
  display: block;
}
ul {
  list-style-type: none;
  padding: 0;
}
li {
  display: inline-block;
  margin: 0 10px;
}
a {
  color: #42b983;
}
</style>
