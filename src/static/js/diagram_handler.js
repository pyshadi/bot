export class DiagramHandler {
  constructor(chatInstance) {
    this.chatInstance = chatInstance;
  }

  extractMermaidDiagramsAndText(response) {
    let diagrams = [];
    let remainingText = response;

    // First try fenced mermaid blocks
    let match;
    const fencedRegex = /```mermaid\s+([\s\S]*?)```/g;
    while ((match = fencedRegex.exec(response)) !== null) {
      diagrams.push(match[1].trim());
      remainingText = remainingText.replace(match[0], "").trim();
    }

    // If no fenced code block found, try keyword-based regex
    if (diagrams.length === 0) {
      const diagramRegex =
        /^(graph|flowchart|sequenceDiagram|classDiagram|stateDiagram|erDiagram|journey|gantt|pie|requirementDiagram|gitGraph|C4Context|mindmap|timeline|zenuml)([\s\S]*)/m;
      const keywordMatch = diagramRegex.exec(response);
      if (keywordMatch) {
        diagrams.push(keywordMatch[0].trim());
        remainingText = remainingText.replace(keywordMatch[0], "").trim();
      }
    }

    console.log("Extracted diagram:", diagrams);

    return { diagrams, remainingText };
  }

  renderMermaidDiagram(container, diagram) {
    const diagramContainer = document.createElement("div");
    diagramContainer.className = "diagram-container";

    const mermaidContainer = document.createElement("div");
    mermaidContainer.className = "mermaid";
    mermaidContainer.textContent = diagram;
    diagramContainer.appendChild(mermaidContainer);

    // Append the container to the parent before initialization
    container.appendChild(diagramContainer);

    // Safely initialize Mermaid with a delay
    setTimeout(() => {
        try {
            mermaid.init(undefined, mermaidContainer);
        } catch (error) {
            console.error("Mermaid rendering error:", error);
        }
    }, 0);

    // Add Save Button for SVG
    const saveContainer = document.createElement("div");
    saveContainer.className = "svg-button";

    const saveAsSVGButton = document.createElement("button");
    saveAsSVGButton.className = "save-svg-button";

    const saveIcon = document.createElement("i");
    saveIcon.className = "fas fa-download";
    saveAsSVGButton.appendChild(saveIcon);

    saveAsSVGButton.onclick = () =>
        this.saveMermaidAsImage(mermaidContainer, "svg");
    saveContainer.appendChild(saveAsSVGButton);
    diagramContainer.appendChild(saveContainer);
}



  async saveMermaidAsImage(mermaidElement, format) {
    const svgElement = mermaidElement.querySelector("svg");

    if (!svgElement) {
      console.error("No SVG element found in the Mermaid container.");
      alert("No diagram found to save.");
      return;
    }

    try {
      if (format === "svg") {
        const svgData = new XMLSerializer().serializeToString(svgElement);
        const blob = new Blob([svgData], {
          type: "image/svg+xml;charset=utf-8",
        });
        const link = document.createElement("a");
        link.href = URL.createObjectURL(blob);
        link.download = "diagram.svg";
        link.style.display = "none";
        document.body.appendChild(link);
        link.click();
        URL.revokeObjectURL(link.href);
        document.body.removeChild(link);
        console.log("SVG successfully saved.");
      } else {
        console.error(`Unsupported format: ${format}`);
        alert("Unsupported format. Currently, only SVG format is supported.");
      }
    } catch (error) {
      console.error("Error saving SVG:", error);
      alert("Failed to save the diagram as SVG. Please try again.");
    }
  }
}
