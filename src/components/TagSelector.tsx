import { Check, Search, X } from 'lucide-react'
import { useMemo, useState } from 'react'
import { canonicalizeTags, collectTagOptions } from '../utils/tags'
import { getTagTone } from '../utils/visualTone'

interface Props {
  value: string[]
  options: string[]
  onChange: (tags: string[]) => void
  allowCreate?: boolean
  placeholder?: string
  className?: string
  selectedAreaClassName?: string
}

export default function TagSelector({
  value,
  options,
  onChange,
  allowCreate = true,
  placeholder = '搜索或新增标签',
  className = '',
  selectedAreaClassName = '',
}: Props) {
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)
  const normalizedOptions = useMemo(() => collectTagOptions(options), [options])
  const selected = useMemo(
    () => canonicalizeTags(value, normalizedOptions),
    [normalizedOptions, value]
  )
  const q = query.trim().toLocaleLowerCase()
  const filteredOptions = normalizedOptions.filter(tag => !q || tag.toLocaleLowerCase().includes(q))
  const exactOption = normalizedOptions.find(tag => tag.toLocaleLowerCase() === q)
  const canCreate = allowCreate && Boolean(q) && !exactOption

  const selectTag = (rawTag: string) => {
    const [tag] = canonicalizeTags([rawTag], normalizedOptions)
    if (!tag) return
    const exists = selected.some(item => item.toLocaleLowerCase() === tag.toLocaleLowerCase())
    onChange(exists
      ? selected.filter(item => item.toLocaleLowerCase() !== tag.toLocaleLowerCase())
      : canonicalizeTags([...selected, tag], normalizedOptions))
    setQuery('')
    setOpen(true)
  }

  const removeTag = (tag: string) => {
    onChange(selected.filter(item => item.toLocaleLowerCase() !== tag.toLocaleLowerCase()))
  }

  return (
    <div className={`relative rounded-[10px] border border-black/[0.08] bg-[#F5F5F7] p-2.5 focus-within:border-[#0066FF]/40 ${className}`}>
      <div className={`flex min-h-8 flex-wrap content-start gap-1.5 ${selectedAreaClassName}`}>
        {selected.map(tag => (
          <span key={tag} className={`inline-flex h-7 items-center gap-1 rounded-full px-2.5 text-[11px] font-bold ${getTagTone(tag)}`}>
            {tag}
            <button type="button" onClick={() => removeTag(tag)} className="rounded-full p-0.5 transition hover:bg-black/10" title={`移除 ${tag}`}>
              <X className="h-3 w-3" />
            </button>
          </span>
        ))}
        {selected.length === 0 && <span className="px-1 py-1.5 text-[11px] font-semibold text-[#AEAEB2]">尚未选择标签</span>}
      </div>

      <div className="relative mt-2 border-t border-black/[0.06] pt-2">
        <Search className="absolute left-2 top-[17px] h-3.5 w-3.5 text-[#AEAEB2]" />
        <input
          value={query}
          onFocus={() => setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 120)}
          onChange={event => {
            setQuery(event.target.value)
            setOpen(true)
          }}
          onKeyDown={event => {
            if (event.key === 'Enter' && (exactOption || canCreate)) {
              event.preventDefault()
              selectTag(exactOption || query)
            }
            if (event.key === 'Escape') setOpen(false)
          }}
          placeholder={placeholder}
          className="h-8 w-full rounded-[8px] border border-black/[0.06] bg-white pl-7 pr-2 text-[11px] font-semibold outline-none"
        />

        {open && (
          <div className="absolute left-0 right-0 top-[46px] z-30 max-h-44 overflow-y-auto rounded-[10px] border border-black/[0.08] bg-white p-1.5 shadow-xl">
            {canCreate && (
              <button type="button" onMouseDown={event => event.preventDefault()} onClick={() => selectTag(query)} className="flex w-full items-center rounded-[8px] px-2.5 py-2 text-left text-xs font-bold text-[#0066FF] hover:bg-blue-50">
                新增“{query.trim()}”
              </button>
            )}
            {filteredOptions.map(tag => {
              const isSelected = selected.some(item => item.toLocaleLowerCase() === tag.toLocaleLowerCase())
              return (
                <button
                  key={tag}
                  type="button"
                  onMouseDown={event => event.preventDefault()}
                  onClick={() => selectTag(tag)}
                  className="flex w-full items-center justify-between rounded-[8px] px-2.5 py-2 text-left text-xs font-semibold text-[#1D1D1F] hover:bg-[#F5F5F7]"
                >
                  <span>{tag}</span>
                  {isSelected && <Check className="h-3.5 w-3.5 text-[#0066FF]" />}
                </button>
              )
            })}
            {!canCreate && filteredOptions.length === 0 && (
              <div className="px-2.5 py-3 text-center text-[11px] font-semibold text-[#AEAEB2]">暂无匹配标签</div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
