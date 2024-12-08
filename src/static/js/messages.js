// messages.js
import { md } from "./markdown.js";

export class Message {
  constructor(content, className) {
    this.content = content;
    this.className = className;
  }

  render() {
    const message = document.createElement("div");
    message.className = `message ${this.className}`;
    message.innerHTML = md.render(this.content);
    return message;
  }
}

export class UserMessage extends Message {
  constructor(content) {
    super(content, "user-message");
  }

  renderWithEditButton(editHandler) {
    const container = document.createElement("div");
    container.className = "user-message-container";

    const messageElement = this.render();

    const editButton = document.createElement("button");
    editButton.setAttribute("aria-label", "Edit message");
    editButton.className = "edit-button";

    const editIcon = document.createElement("i");
    editIcon.className = "fas fa-edit";
    editButton.appendChild(editIcon);

    editButton.onclick = editHandler;

    container.appendChild(editButton);
    container.appendChild(messageElement);

    return container;
  }
}

export class AiMessage extends Message {
  constructor(content) {
    super(content, "ai-message");
  }
}
