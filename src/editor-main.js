import "./style.css";
import "./editor.css";
import { createEditor } from "./editor.js";
const editor = createEditor(document.querySelector("#editor-root"));
if (import.meta.hot) import.meta.hot.dispose(() => editor.dispose());
