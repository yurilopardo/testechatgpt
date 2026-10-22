import "./style.css";
import { createApp } from "./app.js";
const game = createApp(document.querySelector("#app"), { visualTest: true });
if (import.meta.hot) import.meta.hot.dispose(() => game.dispose());
