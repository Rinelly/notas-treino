import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './auth/AuthProvider'
import { configOk } from './lib/supabase'
import SemConfig from './pages/SemConfig'
import Nav from './components/Nav'
import Boot from './pages/Boot'
import Login from './pages/Login'
import Hoje from './pages/Hoje'
import Foco from './pages/Foco'
import Treinos from './pages/Home'
import Sessao from './pages/Sessao'
import Diagnostico from './pages/Diagnostico'

/** o app de verdade — só entra depois do Boot */
function Miolo() {
  return (
    <Boot>
      <Nav />
      <Routes>
        <Route path="/" element={<Hoje />} />
        <Route path="/foco" element={<Foco />} />
        <Route path="/treinos" element={<Treinos />} />
        <Route path="/sessao/:sessaoId" element={<Sessao />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Boot>
  )
}

function Conteudo() {
  const { user, carregando } = useAuth()

  if (carregando) return null
  if (!user) return <Login />

  return (
    <BrowserRouter>
      <Routes>
        {/* fora do Boot de propósito: é a tela que precisa abrir
            justamente quando alguma coisa está errada no Boot */}
        <Route path="/diagnostico" element={<Diagnostico />} />
        <Route path="*" element={<Miolo />} />
      </Routes>
    </BrowserRouter>
  )
}

function App() {
  // sem chaves não dá nem pra montar o AuthProvider: ele fala com o Supabase na hora
  if (!configOk) return <SemConfig />

  return (
    <AuthProvider>
      <Conteudo />
    </AuthProvider>
  )
}

export default App
