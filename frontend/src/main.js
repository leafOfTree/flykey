import { mount } from "svelte";
import App from "./App.svelte";

const HOST_ID = "flykey-extension-root";
let app;

if (!document.getElementById(HOST_ID)) {
  const container = document.createElement("div");
  container.id = HOST_ID;
  container.setAttribute("data-flykey", "root");
  container.style.setProperty("all", "initial", "important");
  container.style.setProperty("display", "inline", "important");
  document.documentElement.append(container);

  const root = container.attachShadow({ mode: "closed" });
  app = mount(App, { target: root });
}

export default app;
