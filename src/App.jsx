import { BrowserRouter, Routes, Route, Link } from "react-router-dom";
import UploadPage from "./pages/UploadPage";
import ProductsPage from "./pages/ProductsPage";
import WebhooksPage from "./pages/WebhooksPage";
import BulkDeletePage from "./pages/BulkDeletePage";

export default function App() {
  return (
    <BrowserRouter>
      <div className="site-header">
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div className="site-title">Acme Admin</div>
        </div>

        <div className="utility">
          <Link to="/" className="nav-link">upload</Link>
          <Link to="/products" className="nav-link">products</Link>
          <Link to="/webhooks" className="nav-link">webhooks</Link>
          <Link to="/delete" className="nav-link">delete</Link>
        </div>
      </div>

      <Routes>
        <Route path="/" element={<UploadPage />} />
        <Route path="/products" element={<ProductsPage />} />
        <Route path="/webhooks" element={<WebhooksPage />} />
        <Route path="/delete" element={<BulkDeletePage />} />
      </Routes>
    </BrowserRouter>
  );
}
