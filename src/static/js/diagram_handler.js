export class DiagramHandler {
    constructor(chatInstance) {
      this.chatInstance = chatInstance;
    }
  
    extractMermaidDiagramsAndText(response) {
      const mermaidCodeRegex =
        /(?:```mermaid\n([\s\S]*?)```|(?:^|\n)(flowchart|sequenceDiagram|classDiagram|stateDiagram|erDiagram|journey|gantt|pie|requirementDiagram|gitGraph|C4Context|mindmap|timeline|zenuml)[\s\S]*?(?=\n\S|\n$))/g;
      const diagrams = [];
      let remainingText = response;
  
      let match;
      while ((match = mermaidCodeRegex.exec(response)) !== null) {
        diagrams.push(match[1] || match[0].trim());
        remainingText = remainingText.replace(match[0], "").trim();
      }
  
      return { diagrams, remainingText };
    }
  
    renderMermaidDiagram(container, diagram) {
      const diagramContainer = document.createElement("div");
      diagramContainer.className = "diagram-container";
  
      const mermaidContainer = document.createElement("div");
      mermaidContainer.className = "mermaid";
      mermaidContainer.textContent = diagram;
      diagramContainer.appendChild(mermaidContainer);
  
      // Initialize Mermaid in the container
      mermaid.init(undefined, mermaidContainer);
  
      // Add Save Button for SVG
      const saveContainer = document.createElement("div");
      saveContainer.className = "svg-button";
  
      const saveAsSVGButton = document.createElement("button");
      saveAsSVGButton.className = "save-svg-button"; // Updated class for styling
  
      // Add Font Awesome download icon
      const saveIcon = document.createElement("i");
      saveIcon.className = "fas fa-download"; // Font Awesome download icon class
      saveAsSVGButton.appendChild(saveIcon);
  
      saveAsSVGButton.onclick = () =>
        this.saveMermaidAsImage(mermaidContainer, "svg");
      saveContainer.appendChild(saveAsSVGButton);
  
      diagramContainer.appendChild(saveContainer);
      container.appendChild(diagramContainer);
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
          const blob = new Blob([svgData], { type: "image/svg+xml;charset=utf-8" });
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
  