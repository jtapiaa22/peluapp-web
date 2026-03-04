export default function Button({ children, onClick, disabled, variant = 'primary', fullWidth, type = 'button', size = 'md' }) {
  const base = 'inline-flex items-center justify-center gap-2 font-semibold rounded-xl transition-all duration-200 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed'
  const variants = {
    primary:   'bg-violet-600 hover:bg-violet-700 text-white',
    secondary: 'bg-zinc-800 hover:bg-zinc-700 text-zinc-200',
    danger:    'bg-red-800 hover:bg-red-700 text-white',
    ghost:     'bg-transparent hover:bg-zinc-800 text-zinc-400',
    success:   'bg-emerald-700 hover:bg-emerald-600 text-white',
  }
  const sizes = { sm: 'px-3 py-2 text-sm', md: 'px-5 py-3 text-sm', lg: 'px-6 py-4 text-base' }
  return (
    <button type={type} onClick={onClick} disabled={disabled}
      className={`${base} ${variants[variant]} ${sizes[size]} ${fullWidth ? 'w-full' : ''}`}>
      {children}
    </button>
  )
}
