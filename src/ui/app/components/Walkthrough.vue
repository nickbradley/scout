<template>
  <v-menu
    ref="toolTip"
    offset-y
    tag="div"
    tile
    transition="fade-transition"
    :activator="attach"
    :close-on-click="false"
    :close-on-content-click="false"
    :content-class="css"
    :top="top"
    :value="visible"
  >
    <v-card id="walkthrough">
      <v-card-title color="white">
        {{ title }}<v-spacer></v-spacer>
        <v-btn v-if="closable" icon small @click="visible = false"
          ><v-icon>mdi-close</v-icon></v-btn
        >
      </v-card-title>
      <v-card-text class="text-left">
        {{ text }}
        <v-divider></v-divider>
        <v-alert
          dense
          elevation="2"
          class="text-caption"
          border="left"
          colored-border
          color="success"
          icon="mdi-rocket-launch"
        >
          <span v-html="action"> </span>
        </v-alert>
      </v-card-text>
      <v-progress-linear :value="progress" color="success"></v-progress-linear>
    </v-card>
  </v-menu>
</template>

<script lang="ts">
import { Vue, Component, Prop } from "vue-property-decorator";

@Component({
  components: {},
})
export default class Walkthrough extends Vue {
  @Prop() readonly title!: string;
  @Prop() readonly text!: string;
  @Prop() readonly action!: string;
  @Prop({ default: "#app" }) readonly attach!: Node | string;
  @Prop({ default: false }) readonly top!: boolean;
  @Prop({ default: true }) readonly point!: boolean;
  @Prop({ default: 0 }) readonly progress!: number;
  @Prop({ default: false }) readonly closable!: boolean;

  visible = true;

  get css(): string {
    let classes = "pa-0 tooltip";
    if (this.point) {
      if (this.top) {
        classes += " top";
      } else {
        classes += " bottom";
      }
    }
    return classes;
  }
}
</script>

<style scoped>
/* https://github.com/SyzbaLinux/Vuetify-Tooltip/blob/main/tooltip.css */
.tooltip {
  margin: 10px;
  contain: initial;
  overflow: visible;
}

.tooltip::before {
  border-right: solid 8px transparent;
  border-left: solid 8px transparent;
  transform: translateX(-50%);
  position: absolute;
  content: "";
  left: 50%;
  height: 0;
  width: 0;
}

.tooltip.bottom::before {
  bottom: 100%;
  border-bottom: solid 8px #fff;
}

.tooltip.top::before {
  top: 100%;
  border-top: solid 8px #fff;
}

/deep/ .v-card__title {
  letter-spacing: initial;
  line-height: initial;
  padding: 8px;
}

/deep/ .v-card__text {
  padding: 0 8px;
}
</style>
