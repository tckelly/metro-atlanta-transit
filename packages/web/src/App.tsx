import { Routes, Route } from 'react-router-dom';

import { Home } from './pages/Home';
import { StopDetail } from './pages/StopDetail';

export function App() {
  return (
    <main className="mx-auto max-w-2xl px-4 py-6">
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/stop/:stopId" element={<StopDetail />} />
      </Routes>
    </main>
  );
}
