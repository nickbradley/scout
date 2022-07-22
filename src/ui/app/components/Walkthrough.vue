<template>
  <v-tooltip
    ref="toolTip"
    transition="fade-transition"
    tag="div"
    color="#cc0033"
    :bottom="bottom"
    :top="top"
    :content-class="css"
    :value="value"
    :position-y="y"
    z-index="1001"
  >
    <v-card-title>{{ title }}</v-card-title>
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
        {{ action }}
      </v-alert>
    </v-card-text>
    <v-progress-linear :value="progress" color="success"></v-progress-linear>
  </v-tooltip>
</template>

<script lang="ts">
import { Vue, Component, Prop, Watch } from "vue-property-decorator";

@Component({
  components: {},
})
export default class Walkthrough extends Vue {
  @Prop({ default: false }) readonly value!: boolean;
  @Prop({ default: "#app" }) readonly attach!: Node | string;
  @Prop({ default: false }) readonly top!: boolean;
  @Prop({ default: true }) readonly point!: boolean;

  @Prop() readonly title!: string;
  @Prop() readonly text!: string;
  @Prop() readonly action!: string;
  @Prop({ default: 0 }) readonly progress!: number;

  resizeObserver = null;
  y = 0;

  get bottom(): boolean {
    return !this.top;
  }

  get node(): Node {
    if (typeof this.attach === "string") {
      return document.querySelector(this.attach);
    }
    return this.attach;
  }

  get css(): string {
    let classes = "primary menuable__content__active pa-0";
    if (this.point) {
      if (this.top) {
        classes += " tooltip-top";
      } else {
        classes += " tooltip-bottom";
      }
    }
    return classes;
  }

  @Watch("node")
  updatePosition(): void {
    this.resizeObserver.observe(this.node);
  }

  mounted(): void {
    this.resizeObserver = new ResizeObserver(() => {
      if (this.top) {
        this.y = this.node.getBoundingClientRect().top;
      } else {
        this.y = this.node.getBoundingClientRect().bottom;
      }
    });
    this.resizeObserver.observe(this.node);
  }
}
</script>

<style scoped>
/* https://github.com/SyzbaLinux/Vuetify-Tooltip/blob/main/tooltip.css */
.tooltip-bottom::before {
  border-right: solid 8px transparent;
  border-left: solid 8px transparent;
  transform: translateX(-50%);
  position: absolute;
  z-index: -21;
  content: "";
  bottom: 100%;
  left: 50%;
  height: 0;
  width: 0;
}

.tooltip-bottom.primary::before {
  border-bottom: solid 8px #246fb3;
}

.tooltip-top::before {
  border-right: solid 8px transparent;
  border-left: solid 8px transparent;
  transform: translateX(-50%);
  position: absolute;
  z-index: -21;
  content: "";
  top: 100%;
  left: 50%;
  height: 0;
  width: 0;
}

.tooltip-top.primary::before {
  border-top: solid 8px #246fb3;
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
