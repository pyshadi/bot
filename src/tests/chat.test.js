import { screen, fireEvent, waitFor } from "@testing-library/dom";
import "@testing-library/jest-dom";
import Chat from "../static/js/script"; // Adjust the path to match your project structure

// Mock global objects and libraries
global.fetch = jest.fn(() =>
  Promise.resolve({
    json: () => Promise.resolve({ response: "Hello, AI!" }),
  })
);

global.mermaid = {
  initialize: jest.fn(),
  init: jest.fn(),
};

global.Prism = {
  highlight: jest.fn((code) => code),
  languages: { javascript: {} },
  highlightAll: jest.fn(),
};

global.markdownit = jest.fn(() => ({
  render: jest.fn((text) => `<p>${text}</p>`),
}));

// Prepare the DOM for testing
beforeEach(() => {
  document.body.innerHTML = `
    <div id="messages"></div>
    <textarea id="inputBox"></textarea>
    <button id="sendButton">Send</button>
    <button id="saveButton">Save</button>
    <button id="clearButton">Clear</button>
  `;
});

afterEach(() => {
  jest.clearAllMocks();
});

// Test cases

test("Chat initializes with correct defaults", () => {
  const chat = new Chat({
    apiURL: "http://127.0.0.1:8000/chat/",
    model: "llama3.1",
    inputBoxId: "inputBox",
    messagesContainerId: "messages",
  });

  expect(chat.apiURL).toBe("http://127.0.0.1:8000/chat/");
  expect(chat.model).toBe("llama3.1");
  expect(chat.inputBoxId).toBe("inputBox");
  expect(chat.messagesContainerId).toBe("messages");
  expect(screen.getByText("Send")).toBeInTheDocument();
});

test("User message is sent and rendered", () => {
  const chat = new Chat();
  const inputBox = screen.getByRole("textbox");
  const sendButton = screen.getByText("Send");

  fireEvent.change(inputBox, { target: { value: "Hello, AI!" } });
  fireEvent.click(sendButton);

  const userMessage = screen.getByText("Hello, AI!");
  expect(userMessage).toBeInTheDocument();
  expect(userMessage.closest(".user-message")).not.toBeNull();
});

test("AI response is rendered after user message", async () => {
  fetch.mockResolvedValueOnce({
    json: () => Promise.resolve({ response: "Hello, human!" }),
  });

  const chat = new Chat();
  const inputBox = screen.getByRole("textbox");
  const sendButton = screen.getByText("Send");

  fireEvent.change(inputBox, { target: { value: "Hi AI!" } });
  fireEvent.click(sendButton);

  await waitFor(() => {
    const aiMessage = screen.getByText("Hello, human!");
    expect(aiMessage.closest(".ai-message")).not.toBeNull();
  });
});

test("Chat messages can be cleared", () => {
  const chat = new Chat();
  const clearButton = screen.getByText("Clear");
  const inputBox = screen.getByRole("textbox");
  const sendButton = screen.getByText("Send");

  fireEvent.change(inputBox, { target: { value: "Message 1" } });
  fireEvent.click(sendButton);
  fireEvent.change(inputBox, { target: { value: "Message 2" } });
  fireEvent.click(sendButton);

  fireEvent.click(clearButton);

  expect(screen.queryByText("Message 1")).toBeNull();
  expect(screen.queryByText("Message 2")).toBeNull();
});

test("Mermaid diagram is rendered correctly", async () => {
  fetch.mockResolvedValueOnce({
    json: () =>
      Promise.resolve({
        response: "```mermaid\nflowchart TD\nA-->B\n```",
      }),
  });

  const chat = new Chat();
  const inputBox = screen.getByRole("textbox");
  const sendButton = screen.getByText("Send");

  fireEvent.change(inputBox, { target: { value: "Show diagram" } });
  fireEvent.click(sendButton);

  await waitFor(() => {
    const mermaidContainer = screen.getByText(
      (content, element) =>
        element.className.includes("mermaid") && content.includes("A-->B")
    );
    expect(mermaidContainer).toBeInTheDocument();
    expect(mermaidContainer.closest(".mermaid")).not.toBeNull();
  });
});
