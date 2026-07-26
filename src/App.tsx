import { Route, Routes } from 'react-router-dom'
import { Home } from '@/routes/Home'
import { Create } from '@/routes/Create'
import { Lobby } from '@/routes/Lobby'

function App() {
  return (
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/create" element={<Create />} />
      <Route path="/room/:code" element={<Lobby />} />
    </Routes>
  )
}

export default App
