import Home from './Home'
import { useManifest } from './store'
import Workspace from './Workspace'

function App(): React.JSX.Element {
  const manifest = useManifest()
  return (
    <>
      <div className="drag-top" />
      {manifest ? <Workspace m={manifest} /> : <Home />}
    </>
  )
}

export default App
