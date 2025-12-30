export function DashboardSimple() {
  return (
    <div className="p-8">
      <h1 className="text-3xl font-bold text-white mb-4">PocketWise Dashboard</h1>
      <p className="text-gray-400">Versão simplificada para debug</p>

      <div className="mt-8 p-6 bg-dark-800 rounded-lg">
        <h2 className="text-xl text-white mb-2">✅ App funcionando!</h2>
        <p className="text-gray-300">
          Se você está vendo isso, o problema foi isolado.
        </p>
      </div>
    </div>
  )
}
