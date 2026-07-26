import { Route, Routes } from 'react-router-dom'
import { Home } from '@/routes/Home'
import { Create } from '@/routes/Create'
import { Room } from '@/routes/Room'

function App() {
  return (
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/create" element={<Create />} />
      <Route path="/room/:code" element={<Room />} />
    </Routes>
  )
}

export default App
