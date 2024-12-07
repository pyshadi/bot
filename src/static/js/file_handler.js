// file_handler.js
export class FileHandler {
  static async readFile(file) {
    return new Promise((resolve, reject) => {
      if (!file) {
        reject("No file provided.");
        return;
      }

      // Check file type
      const isText =
        file.type.startsWith("text/") || file.name.endsWith(".txt");
      const isDocx = file.name.endsWith(".docx");
      const isPDF = file.name.endsWith(".pdf");
      const isImage = file.type.startsWith("image/");

      // Only .txt, .docx, .pdf, and images supported
      if (!(isText || isDocx || isPDF || isImage)) {
        reject(
          "Unsupported file type. Please upload .txt, .pdf, .docx, or image files."
        );
        return;
      }

      const reader = new FileReader();

      // Handle text files
      if (isText) {
        reader.onload = () => resolve(reader.result);
        reader.onerror = () => reject(`Error reading text file: ${file.name}`);
        reader.readAsText(file);
        return;
      }

      // Handle docx
      if (isDocx) {
        reader.onload = async () => {
          try {
            const result = await mammoth.extractRawText({
              arrayBuffer: reader.result,
            });
            resolve(result.value);
          } catch (error) {
            alert("Failed to process the file: " + error.message);
            reject(`Error reading Word file (${file.name}): ${error.message}`);
          }
        };
        reader.onerror = () =>
          reject(`Error reading binary file: ${file.name}`);
        reader.readAsArrayBuffer(file);
        return;
      }

      // Handle pdf
      if (isPDF) {
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
        return;
      }

      // Handle images with OCR
      if (isImage) {
        reader.onload = async () => {
          try {
            const base64Data = reader.result;
            const ocrText = await FileHandler.ocrImage(base64Data);
            resolve(ocrText);
          } catch (error) {
            reject(`Error processing image file (${file.name}): ${error}`);
          }
        };
        reader.onerror = () => reject(`Error reading image file: ${file.name}`);
        reader.readAsDataURL(file); // read as base64
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

  static async ocrImage(base64Data) {
    // Extract the base64 string without prefix
    const base64String = base64Data.split(",")[1];
  
    const formData = new FormData();
    formData.append("base64image", `data:image/png;base64,${base64String}`);
    // Default is eng. Example: French = "fre"
    formData.append("language", "eng");
    // Return overlay if needed
    formData.append("isOverlayRequired", "false");
    // 1 or 2
    formData.append("OCREngine", "1");
  
    const response = await fetch("https://api.ocr.space/parse/image", {
      method: "POST",
      headers: {
        apikey: "placeholder-key",
      },
      body: formData,
    });
  
    if (!response.ok) {
      throw new Error("OCR API request failed with status: " + response.status);
    }
  
    const data = await response.json();
    
    if (data.IsErroredOnProcessing) {
      throw new Error("OCR processing error: " + (data.ErrorMessage || "Unknown error"));
    }
  
    const parsedResults = data.ParsedResults;
    if (!parsedResults || parsedResults.length === 0 || !parsedResults[0].ParsedText) {
      throw new Error("No text found in the image.");
    }
  
    // Return the extracted text
    return parsedResults[0].ParsedText.trim();
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
