import { BrowserRouter, Routes, Route } from 'react-router-dom'
import Home from './pages/Home'
import Sessao from './pages/Sessao'

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/sessao/:sessaoId" element={<Sessao />} />
      </Routes>
    </BrowserRouter>
  )
}

export default App
