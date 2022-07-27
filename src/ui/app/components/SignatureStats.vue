<template>
  <div>
    <v-tooltip bottom open-delay="300">
      <template v-slot:activator="{ on, attrs }">
        <v-icon v-if="accepted" small v-bind="attrs" v-on="on"
          >mdi-check</v-icon
        >
      </template>
      <span>Accepted Answer</span>
    </v-tooltip>
    <v-tooltip bottom open-delay="300">
      <template v-slot:activator="{ on, attrs }">
        <v-icon v-if="popular" small v-bind="attrs" v-on="on"
          >mdi-trending-up</v-icon
        >
      </template>
      <span>Popular Answer</span>
    </v-tooltip>
    <v-tooltip bottom open-delay="300">
      <template v-slot:activator="{ on, attrs }">
        <v-icon v-if="latest" small v-bind="attrs" v-on="on">mdi-update</v-icon>
      </template>
      <span>Recent Answer</span>
    </v-tooltip>
  </div>
</template>

<script lang="ts">
import { Vue, Component, Prop } from "vue-property-decorator";

@Component()
export default class SignatureStats extends Vue {
  @Prop({ default: false }) accepted!: boolean;
  @Prop({ default: false }) latest!: boolean;
  @Prop({ default: false }) popular!: boolean;
}
</script>
