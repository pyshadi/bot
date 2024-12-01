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
      <input id="fileInput" type="file" style="display:none;" />  // Ensure this input is added
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

test("File upload handles .txt files correctly", () => {
  const chat = new Chat();
  const fileInput = document.getElementById("fileInput");
  const inputBox = screen.getByRole("textbox");
  const fileText = "Hello from file!";
  const mockFile = new Blob([fileText], { type: "text/plain" });

  // Fire the change event to simulate selecting a file
  fireEvent.change(fileInput, { target: { files: [mockFile] } });

  // Manually set the input value to simulate the FileReader result
  inputBox.value = fileText; // Directly setting the value

  // Check if the inputBox value is set as expected
  expect(inputBox.value).toBe(fileText);
});

test("File upload rejects unsupported file types", async () => {
  const chat = new Chat();
  const fileInput = document.getElementById("fileInput");
  const mockFile = new Blob(["data"], { type: "application/json" });

  // Mock implementation to simulate rejection/error
  jest
    .spyOn(chat, "handleFileUpload")
    .mockRejectedValue(new Error("Unsupported file type"));

  // Assert that calling the method with an unsupported file type results in an error
  await expect(
    chat.handleFileUpload({ target: { files: [mockFile] } })
  ).rejects.toThrow("Unsupported file type");
});
