import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './auth/AuthProvider'
import Nav from './components/Nav'
import Boot from './pages/Boot'
import Login from './pages/Login'
import Hoje from './pages/Hoje'
import Foco from './pages/Foco'
import Treinos from './pages/Home'
import Sessao from './pages/Sessao'

function Conteudo() {
  const { user, carregando } = useAuth()

  if (carregando) return null
  if (!user) return <Login />

  return (
    <Boot>
      <BrowserRouter>
        <Nav />
        <Routes>
          <Route path="/" element={<Hoje />} />
          <Route path="/foco" element={<Foco />} />
          <Route path="/treinos" element={<Treinos />} />
          <Route path="/sessao/:sessaoId" element={<Sessao />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </Boot>
  )
}

function App() {
  return (
    <AuthProvider>
      <Conteudo />
    </AuthProvider>
  )
}

export default App
