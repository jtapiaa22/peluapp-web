import { Scissors } from 'lucide-react'

export default function Layout({ children, peluqueriaNombre }) {
  return (
    <div className="min-h-screen bg-zinc-950 flex flex-col">
      <header className="border-b border-zinc-800 bg-zinc-900/80 backdrop-blur sticky top-0 z-50">
        <div className="max-w-2xl mx-auto px-4 h-16 flex items-center gap-3">
          <div className="w-8 h-8 bg-violet-600 rounded-lg flex items-center justify-center">
            <Scissors size={16} color="white" />
          </div>
          <div className="flex flex-col leading-tight">
            <span className="font-bold text-white text-base">
              {peluqueriaNombre || 'PeluApp'}
            </span>
            {peluqueriaNombre && (
              <span className="text-zinc-600 text-xs">Reservas online</span>
            )}
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-2xl mx-auto w-full px-4 py-8">
        {children}
      </main>

      <footer className="border-t border-zinc-800 py-4 text-center text-xs text-zinc-700">
        Powered by PeluApp - Jorge Tapia Ahumada © {new Date().getFullYear()}
      </footer>
    </div>
  )
}
