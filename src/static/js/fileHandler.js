// fileHandler.js
import { mermaid } from "./markdown.js";

export class FileHandler {
    static async readFile(file) {
        return new Promise((resolve, reject) => {
          const reader = new FileReader();
    
          // Validate file type
          if (![".txt", ".docx", ".pdf"].some((ext) => file.name.endsWith(ext))) {
            reject(
              "Unsupported file type. Please upload .txt, .pdf, or .docx files."
            );
            return;
          }
    
          // Handle .txt files
          if (file.type.startsWith("text/") || file.name.endsWith(".txt")) {
            reader.onload = () => resolve(reader.result);
            reader.onerror = () => reject(`Error reading text file: ${file.name}`);
            reader.readAsText(file);
          }
    
          // Handle .docx files
          else if (file.name.endsWith(".docx")) {
            reader.onload = async () => {
              try {
                const result = await mammoth.extractRawText({
                  arrayBuffer: reader.result,
                });
    
                resolve(result.value); // Extracted text
              } catch (error) {
                alert("Failed to process the file: " + error.message);
                reject(`Error reading Word file (${file.name}): ${error.message}`);
              }
            };
            reader.onerror = () =>
              reject(`Error reading binary file: ${file.name}`);
            reader.readAsArrayBuffer(file);
          }
    
          // Handle .pdf files
          else if (file.name.endsWith(".pdf")) {
            reader.onload = async () => {
              try {
                const pdfjsLib = window["pdfjs-dist/build/pdf"];
                pdfjsLib.GlobalWorkerOptions.workerSrc =
                  "//cdnjs.cloudflare.com/ajax/libs/pdf.js/2.9.359/pdf.worker.min.js";
                const pdf = await pdfjsLib.getDocument(reader.result).promise;
                const text = await FileHandler.extractPDFText(pdf);
                resolve(text);
              } catch (error) {
                reject(`Error reading PDF file (${file.name}): ${error.message}`);
              }
            };
            reader.onerror = () =>
              reject(`Error reading binary file: ${file.name}`);
            reader.readAsArrayBuffer(file);
          }
        });
      }
    
      static async extractPDFText(pdf) {
        let text = "";
        for (let i = 1; i <= pdf.numPages; i++) {
          const page = await pdf.getPage(i);
          const content = await page.getTextContent();
          text += content.items.map((item) => item.str).join(" ") + "\n";
        }
        return text.trim();
      }
    
      static saveChat(messagesContainer) {
        let chatContent = "";
    
        // Loop through all message containers and capture their content
        messagesContainer
          .querySelectorAll(".message-container")
          .forEach((container) => {
            const userMessageElement = container.querySelector(".user-message");
            const aiMessageElement = container.querySelector(".ai-message");
    
            if (userMessageElement) {
              const userText = userMessageElement.textContent.trim();
              chatContent += `User: ${userText}\n`;
            }
    
            if (aiMessageElement) {
              const aiText = aiMessageElement.textContent.trim();
              chatContent += `AI: ${aiText}\n`;
            }
          });
    
        const blob = new Blob([chatContent], { type: "text/plain" });
        const url = URL.createObjectURL(blob);
    
        const link = document.createElement("a");
        link.href = url;
        link.download = "chat.txt";
        link.click();
    
        URL.revokeObjectURL(url);
      }
    
      static clearChat(messagesContainer) {
        messagesContainer.innerHTML = ""; // clear all messages
      }
}
