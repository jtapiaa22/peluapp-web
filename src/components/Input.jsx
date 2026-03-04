export default function Input({ label, error, ...props }) {
  return (
    <div className="flex flex-col gap-1.5">
      {label && <label className="text-sm font-medium text-zinc-400">{label}</label>}
      <input {...props}
        className={`w-full bg-zinc-900 border rounded-xl px-4 py-3 text-sm text-white outline-none transition-all
          placeholder:text-zinc-600 focus:border-violet-500 focus:ring-2 focus:ring-violet-500/20
          ${error ? 'border-red-500' : 'border-zinc-700 hover:border-zinc-600'}`}
      />
      {error && <span className="text-xs text-red-400">{error}</span>}
    </div>
  )
}
