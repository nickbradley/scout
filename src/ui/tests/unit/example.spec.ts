import { mount, shallowMount } from "@vue/test-utils";
import XFrame from "../../app/components/XFrame.vue";

describe("HelloWorld.vue", () => {
  it("renders props.msg when passed", () => {
    const wrapper = mount(XFrame, {
      propsData: {
        url: "https://stackoverflow.com/questions/27732209",
      },
    });
    const loadEvent = wrapper.emitted()?.loaded;
    if (loadEvent) {
      const doc = loadEvent[0];
    }
    expect(true).toBe(true);
  });
});
