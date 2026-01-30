import { createRoot } from "react-dom/client"; // Renderização React no DOM (React 18)
import App from "./App.tsx"; // Componente raiz da aplicação
import "./index.css"; // Estilos globais (Tailwind + classes utilitárias)

createRoot(document.getElementById("root")!).render(<App />); // Monta o App dentro do elemento #root
