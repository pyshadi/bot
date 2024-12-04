// main.js
import { Chat } from "./chat.js";

const chatApp = new Chat({
  apiURL: "http://127.0.0.1:8000/chat/",
  model: "llama3.1",
  inputBoxId: "inputBox",
  messagesContainerId: "messages",
});

export default chatApp;
