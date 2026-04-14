import { useState, useEffect, useRef } from 'react'
import {
  usePokemonList,
  useInfinitePokemon,
  useAdvancedSearch,
  useAbilityList,
} from './hooks/usePokemon'
import PokemonCard from './components/PokemonCard'
import PokemonModal from './components/PokemonModal'
import SearchFilters from './components/SearchFilters'
import styles from './App.module.css'

const LIMIT = 20

export default function App() {
  const [page, setPage] = useState(0)
  const [query, setQuery] = useState('')
  const [generation, setGeneration] = useState(null)
  const [types, setTypes] = useState([])
  const [megaOnly, setMegaOnly] = useState(false)
  const [ability, setAbility] = useState('')
  const [weightRange, setWeightRange] = useState([0, 1000])
  const [selected, setSelected] = useState(null)
  const [showAll, setShowAll] = useState(false)
  const [filtersOpen, setFiltersOpen] = useState(false)
  const [sortBy, setSortBy] = useState('id-asc')

  const toggleType = t => setTypes(prev =>
    prev.includes(t) ? prev.filter(x => x !== t) : [...prev, t]
  )
  const sentinelRef = useRef(null)

  const abilities = useAbilityList()

  const { results: filteredResults, loading: filterLoading, total: filterTotal, hasFilter } =
    useAdvancedSearch({ query, generation, ability, types, megaOnly, weightRange, page, showAll })

  const { pokemon: pagedPokemon, total, loading: pagedLoading } = usePokemonList(page * LIMIT, sortBy)

  const { pokemon: allPokemon, total: allTotal, loading: allLoading, loadingMore, hasMore, loadMore } =
    useInfinitePokemon(sortBy)

  const loading = hasFilter ? filterLoading : showAll ? allLoading : pagedLoading
  const displayList = hasFilter ? filteredResults : showAll ? allPokemon : pagedPokemon

  // En modo filtro el orden se aplica client-side (ya tenemos todos los resultados).
  // En modo paginado/infinito el orden viene pre-aplicado desde el hook.
  const sortedList = hasFilter ? (() => {
    const list = [...displayList]
    switch (sortBy) {
      case 'name-asc':  return list.sort((a, b) => a.name.localeCompare(b.name))
      case 'name-desc': return list.sort((a, b) => b.name.localeCompare(a.name))
      case 'type':      return list.sort((a, b) => a.types[0].type.name.localeCompare(b.types[0].type.name))
      case 'id-desc':   return list.sort((a, b) => b.id - a.id)
      default:          return list.sort((a, b) => a.id - b.id)
    }
  })() : displayList
  const totalPages = Math.ceil((hasFilter ? filterTotal : total) / LIMIT)
  const activeFilterCount = [generation, megaOnly, ability].filter(Boolean).length + types.length + (weightRange[0] > 0 || weightRange[1] < 1000 ? 1 : 0)

  useEffect(() => {
    if (!showAll || hasFilter || !sentinelRef.current) return
    const observer = new IntersectionObserver(
      entries => { if (entries[0].isIntersecting && hasMore && !loadingMore) loadMore() },
      { threshold: 0.1 }
    )
    observer.observe(sentinelRef.current)
    return () => observer.disconnect()
  }, [showAll, hasFilter, hasMore, loadingMore, loadMore])

  const handleSetGeneration = gen => { setGeneration(gen); setPage(0) }
  const handleToggleType = t => { toggleType(t); setPage(0) }
  const handleSetMegaOnly = v => { setMegaOnly(v); setPage(0) }
  const handleSetAbility = ab => { setAbility(ab); setPage(0) }

  return (
    <div className={styles.app}>
      <header className={styles.header}>
        <div className={styles.logo}>
          <h1>Pokédex</h1>
        </div>

        <div className={styles.searchWrap}>
          <input
            className={styles.search}
            type="text"
            placeholder="Buscar por nombre..."
            value={query}
            onChange={e => { setQuery(e.target.value); setPage(0) }}
          />
          {query && (
            <button className={styles.clearBtn} onClick={() => setQuery('')}>✕</button>
          )}
        </div>

        <button
          className={`${styles.filterBtn} ${filtersOpen || activeFilterCount > 0 ? styles.filterBtnActive : ''}`}
          onClick={() => setFiltersOpen(v => !v)}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <line x1="4" y1="6" x2="20" y2="6"/><line x1="8" y1="12" x2="16" y2="12"/><line x1="11" y1="18" x2="13" y2="18"/>
          </svg>
          Filtros
          {activeFilterCount > 0 && (
            <span className={styles.filterBadge}>{activeFilterCount}</span>
          )}
        </button>

        <div className={styles.sortWrap}>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M3 6h18M7 12h10M11 18h2"/>
          </svg>
          <select
            className={styles.sortSelect}
            value={sortBy}
            onChange={e => { setSortBy(e.target.value); setPage(0) }}
          >
            <option value="id-asc">Gen I → IX</option>
            <option value="id-desc">Gen IX → I</option>
            <option value="name-asc">Nombre A → Z</option>
            <option value="name-desc">Nombre Z → A</option>
            <option value="type">Por tipo</option>
          </select>
        </div>

        <button
          className={`${styles.toggleBtn} ${showAll ? styles.toggleActive : ''}`}
          onClick={() => { setShowAll(v => !v); setPage(0) }}
        >
          {showAll ? 'Paginado' : 'Todos'}
          <span className={styles.toggleCount}>
            {hasFilter
              ? (showAll ? `${filteredResults.length}/${filterTotal}` : `${filterTotal}`)
              : (showAll ? `${allPokemon.length}/${allTotal}` : `${total}`)
            }
          </span>
        </button>
      </header>

      {filtersOpen && (
        <SearchFilters
          generation={generation} setGeneration={handleSetGeneration}
          types={types} toggleType={handleToggleType}
          megaOnly={megaOnly} setMegaOnly={handleSetMegaOnly}
          ability={ability} setAbility={handleSetAbility}
          abilities={abilities}
          weightRange={weightRange} setWeightRange={setWeightRange}
        />
      )}

      <main className={styles.main}>
        {hasFilter && !filterLoading && (
          <p className={styles.resultsCount}>
            {filterTotal} resultado{filterTotal !== 1 ? 's' : ''}
          </p>
        )}

        {loading ? (
          <div className={styles.loaderWrap}>
            <div className={styles.loader} />
            <p>Cargando Pokémon...</p>
          </div>
        ) : !loading && displayList.length === 0 && hasFilter ? (
          <div className={styles.empty}>
            <p>Sin resultados para esa búsqueda</p>
          </div>
        ) : (
          <div className={styles.grid}>
            {sortedList.map(p => (
              <PokemonCard key={p.id} pokemon={p} onClick={setSelected} />
            ))}
          </div>
        )}

        {showAll && !hasFilter && !allLoading && (
          <div ref={sentinelRef} className={styles.sentinel}>
            {loadingMore && (
              <div className={styles.loadMoreWrap}>
                <div className={styles.loader} />
                <p>Cargando más...</p>
              </div>
            )}
            {!hasMore && allPokemon.length > 0 && (
              <p className={styles.allLoaded}>Todos los {allTotal} Pokémon cargados</p>
            )}
          </div>
        )}

        {!showAll && !loading && totalPages > 1 && (
          <div className={styles.pagination}>
            <button className={styles.pageBtn} onClick={() => setPage(p => p - 1)} disabled={page === 0}>
              ← Anterior
            </button>
            <span className={styles.pageInfo}>{page + 1} / {totalPages}</span>
            <button className={styles.pageBtn} onClick={() => setPage(p => p + 1)} disabled={page >= totalPages - 1}>
              Siguiente →
            </button>
          </div>
        )}
      </main>

      <PokemonModal pokemon={selected} onClose={() => setSelected(null)} />
    </div>
  )
}
