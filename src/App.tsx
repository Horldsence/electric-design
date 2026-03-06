import { ConsoleInterface } from './components/ConsoleInterface'
import './index.css'

export function App() {
  console.log('App rendering')
  return (
    <div className="app">
      <ConsoleInterface />
    </div>
  )
}

export default App