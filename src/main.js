import "./style.css";
import { createApp } from "./app.js";

const game = createApp(document.querySelector("#app"));
if (import.meta.hot) import.meta.hot.dispose(() => game.dispose());
