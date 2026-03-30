import { Routes, Route } from "react-router-dom";
import Home from "./pages/Home";
import Result from "./pages/Result";
import Explore from "./pages/Explore";

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/results" element={<Result />} />
      <Route path="/explore" element={<Explore />} />
    </Routes>
  );
}
