import Home from './Home'
import { useManifest } from './store'

function App(): React.JSX.Element {
  const manifest = useManifest()
  if (!manifest) return <Home />
  // ワークスペースは次の作業で作る。
  return (
    <main style={{ padding: 32 }}>
      <h1>{manifest.session}</h1>
      <p>テストケース {manifest.testcases.length}件</p>
      <button onClick={() => window.api.closeSession()}>ホームへ戻る</button>
    </main>
  )
}

export default App
