import { useState, useEffect, useCallback, useRef } from 'react'

const LIMIT = 20
const BASE_URL = 'https://pokeapi.co/api/v2'

export const GENERATION_RANGES = {
  1: [1, 151],
  2: [152, 251],
  3: [252, 386],
  4: [387, 493],
  5: [494, 649],
  6: [650, 721],
  7: [722, 809],
  8: [810, 905],
  9: [906, 1025],
}

// Module-level caches — fetched once for the lifetime of the app
let nameCache = null
let namePromise = null
let abilityCache = null
let abilityPromise = null
const typeCache = new Map()
let primaryTypeCache = null
let primaryTypePromise = null
const sortedNamesCache = new Map()
const detailCache = new Map() // id -> full pokemon data

const ALL_TYPES = ['normal','fire','water','electric','grass','ice','fighting','poison',
  'ground','flying','psychic','bug','rock','ghost','dragon','dark','steel','fairy']

function fetchAllNames() {
  if (nameCache) return Promise.resolve(nameCache)
  if (!namePromise) {
    namePromise = fetch(`${BASE_URL}/pokemon?limit=2000`)
      .then(r => r.json())
      .then(data => {
        nameCache = data.results.map(p => ({
          name: p.name,
          id: parseInt(p.url.split('/').filter(Boolean).at(-1)),
        }))
        return nameCache
      })
  }
  return namePromise
}

function fetchAbilities() {
  if (abilityCache) return Promise.resolve(abilityCache)
  if (!abilityPromise) {
    abilityPromise = fetch(`${BASE_URL}/ability?limit=400`)
      .then(r => r.json())
      .then(data => {
        abilityCache = data.results.map(a => a.name)
        return abilityCache
      })
  }
  return abilityPromise
}

function fetchPrimaryTypeMap() {
  if (primaryTypeCache) return Promise.resolve(primaryTypeCache)
  if (!primaryTypePromise) {
    primaryTypePromise = Promise.all(
      ALL_TYPES.map(t => fetch(`${BASE_URL}/type/${t}`).then(r => r.json()))
    ).then(results => {
      const map = {}
      results.forEach((data, i) => {
        data.pokemon.forEach(({ pokemon, slot }) => {
          if (slot === 1) map[pokemon.name] = ALL_TYPES[i]
        })
      })
      primaryTypeCache = map
      return map
    })
  }
  return primaryTypePromise
}

function groupAlternatesWithBase(sorted) {
  const baseNames = new Set(sorted.filter(p => p.id < 10000).map(p => p.name))
  const altsByBase = {}
  const bases = []

  for (const p of sorted) {
    if (p.id < 10000) {
      bases.push(p)
    } else {
      const parts = p.name.split('-')
      let found = null
      for (let i = parts.length - 1; i >= 1; i--) {
        const candidate = parts.slice(0, i).join('-')
        if (baseNames.has(candidate)) { found = candidate; break }
      }
      if (found) {
        if (!altsByBase[found]) altsByBase[found] = []
        altsByBase[found].push(p)
      } else {
        bases.push(p)
      }
    }
  }

  const result = []
  for (const base of bases) {
    result.push(base)
    if (altsByBase[base.name]) result.push(...altsByBase[base.name])
  }
  return result
}

async function fetchSortedNames(sortBy) {
  if (sortedNamesCache.has(sortBy)) return sortedNamesCache.get(sortBy)
  const allNames = await fetchAllNames()
  let sorted
  switch (sortBy) {
    case 'name-asc':  sorted = [...allNames].sort((a, b) => a.name.localeCompare(b.name)); break
    case 'name-desc': sorted = [...allNames].sort((a, b) => b.name.localeCompare(a.name)); break
    case 'id-desc':   sorted = [...allNames].sort((a, b) => b.id - a.id); break
    case 'type': {
      const typeMap = await fetchPrimaryTypeMap()
      sorted = [...allNames].sort((a, b) => {
        const ta = typeMap[a.name] ?? 'zzz'
        const tb = typeMap[b.name] ?? 'zzz'
        return ta.localeCompare(tb) || a.id - b.id
      })
      break
    }
    default: sorted = [...allNames].sort((a, b) => a.id - b.id)
  }
  const grouped = groupAlternatesWithBase(sorted)
  sortedNamesCache.set(sortBy, grouped)
  return grouped
}

function fetchTypePokemon(typeName) {
  if (typeCache.has(typeName)) return Promise.resolve(typeCache.get(typeName))
  return fetch(`${BASE_URL}/type/${typeName}`)
    .then(r => r.json())
    .then(data => {
      const names = new Set(data.pokemon.map(p => p.pokemon.name))
      typeCache.set(typeName, names)
      return names
    })
}

// ─── Paginated list ────────────────────────────────────────────────────────────

export function usePokemonList(offset = 0, sortBy = 'id-asc') {
  const [pokemon, setPokemon] = useState([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    if (sortBy === 'id-asc') {
      fetch(`${BASE_URL}/pokemon?limit=${LIMIT}&offset=${offset}`)
        .then(r => r.json())
        .then(async data => {
          setTotal(data.count)
          const details = await Promise.all(
            data.results.map(p => fetch(p.url).then(r => r.json()))
          )
          setPokemon(details)
          setLoading(false)
        })
    } else {
      fetchSortedNames(sortBy).then(async sorted => {
        setTotal(sorted.length)
        const page = sorted.slice(offset, offset + LIMIT)
        const details = await Promise.all(
          page.map(p => fetch(`${BASE_URL}/pokemon/${p.id}`).then(r => r.json()))
        )
        setPokemon(details)
        setLoading(false)
      })
    }
  }, [offset, sortBy])

  return { pokemon, total, loading }
}

// ─── Infinite scroll ───────────────────────────────────────────────────────────

export function useInfinitePokemon(sortBy = 'id-asc') {
  const [pokemon, setPokemon] = useState([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const offsetRef = useRef(0)
  const hasMore = pokemon.length < total

  const loadMore = useCallback(async () => {
    if (loadingMore) return
    setLoadingMore(true)
    const sorted = await fetchSortedNames(sortBy)
    const page = sorted.slice(offsetRef.current, offsetRef.current + LIMIT)
    const details = await Promise.all(page.map(p => fetch(`${BASE_URL}/pokemon/${p.id}`).then(r => r.json())))
    setPokemon(prev => [...prev, ...details])
    offsetRef.current += LIMIT
    setLoadingMore(false)
  }, [loadingMore, sortBy])

  useEffect(() => {
    setPokemon([])
    offsetRef.current = 0
    setLoading(true)

    const init = async () => {
      {
        const sorted = await fetchSortedNames(sortBy)
        setTotal(sorted.length)
        const page = sorted.slice(0, LIMIT)
        const details = await Promise.all(page.map(p => fetch(`${BASE_URL}/pokemon/${p.id}`).then(r => r.json())))
        setPokemon(details)
      }
      offsetRef.current = LIMIT
      setLoading(false)
    }
    init()
  }, [sortBy])

  return { pokemon, total, loading, loadingMore, hasMore, loadMore }
}

// ─── Ability list for autocomplete ────────────────────────────────────────────

export function useAbilityList() {
  const [abilities, setAbilities] = useState(abilityCache || [])

  useEffect(() => {
    if (abilityCache) return
    fetchAbilities().then(setAbilities)
  }, [])

  return abilities
}

async function fetchDetailsInBatches(names) {
  const toFetch = names.filter(p => !detailCache.has(p.id))
  const BATCH = 80
  for (let i = 0; i < toFetch.length; i += BATCH) {
    const batch = toFetch.slice(i, i + BATCH)
    const results = await Promise.all(
      batch.map(p => fetch(`${BASE_URL}/pokemon/${p.id}`).then(r => r.json()))
    )
    results.forEach(p => detailCache.set(p.id, p))
  }
  return names.map(p => detailCache.get(p.id)).filter(Boolean)
}

// ─── Advanced search (name partial match + generation + ability) ───────────────

export function useAdvancedSearch({ query, generation, ability, types, megaOnly, weightRange, page = 0, showAll = false }) {
  const [results, setResults] = useState([])
  const [loading, setLoading] = useState(false)
  const [total, setTotal] = useState(0)

  const typesKey = types.join(',')
  const hasWeightFilter = weightRange[0] > 0 || weightRange[1] < 1000
  const hasFilter = Boolean(query.trim() || generation || ability || types.length > 0 || megaOnly || hasWeightFilter)

  useEffect(() => {
    if (!hasFilter) {
      setResults([])
      setTotal(0)
      return
    }

    const timer = setTimeout(async () => {
      setLoading(true)
      try {
        const allNames = await fetchAllNames()
        let filtered = allNames

        if (query.trim()) {
          const q = query.toLowerCase().trim()
          filtered = filtered.filter(p => p.name.includes(q))
        }

        if (generation) {
          const [min, max] = GENERATION_RANGES[generation]
          const baseNameSet = new Set(allNames.filter(p => p.id < 10000).map(p => p.name))
          const baseById = Object.fromEntries(allNames.filter(p => p.id < 10000).map(p => [p.name, p]))

          filtered = filtered.filter(p => {
            if (p.id > 10000) {
              // Busca el pokémon base quitando sufijos de forma de derecha a izquierda
              // Ej: mr-mime-galar → mr-mime, charizard-mega-x → charizard
              const parts = p.name.split('-')
              for (let i = parts.length - 1; i >= 1; i--) {
                const candidate = parts.slice(0, i).join('-')
                if (baseNameSet.has(candidate)) {
                  const base = baseById[candidate]
                  return base.id >= min && base.id <= max
                }
              }
              return false
            }
            return p.id >= min && p.id <= max
          })
        }

        if (megaOnly) {
          filtered = filtered.filter(p => p.name.includes('-mega'))
        }

        if (ability) {
          const res = await fetch(`${BASE_URL}/ability/${ability}`)
          const data = await res.json()
          const abilitySet = new Set(data.pokemon.map(p => p.pokemon.name))
          filtered = filtered.filter(p => abilitySet.has(p.name))
        }

        if (types.length === 1) {
          // 1 tipo: todos los que lo tengan
          const typeSet = await fetchTypePokemon(types[0])
          filtered = filtered.filter(p => typeSet.has(p.name))
        } else if (types.length === 2) {
          // 2 tipos: solo los que tengan AMBOS a la vez (intersección)
          const [setA, setB] = await Promise.all(types.map(fetchTypePokemon))
          filtered = filtered.filter(p => setA.has(p.name) && setB.has(p.name))
        } else if (types.length >= 3) {
          // 3+ tipos: cualquiera que tenga al menos uno (unión)
          const typeSets = await Promise.all(types.map(fetchTypePokemon))
          const unionSet = new Set(typeSets.flatMap(s => [...s]))
          filtered = filtered.filter(p => unionSet.has(p.name))
        }

        if (!hasWeightFilter) {
          // Sin filtro de peso: paginar sobre nombres directamente
          setTotal(filtered.length)
          const top = showAll
            ? filtered
            : filtered.slice(page * LIMIT, (page + 1) * LIMIT)

          if (top.length === 0) { setResults([]); setTotal(0); setLoading(false); return }

          const details = await fetchDetailsInBatches(top)
          setResults(details)
        } else {
          // Con filtro de peso: fetchear todos, filtrar por peso, luego paginar
          if (filtered.length === 0) { setResults([]); setTotal(0); setLoading(false); return }

          const details = await fetchDetailsInBatches(filtered)
          const weightFiltered = details.filter(p => {
            const kg = p.weight / 10
            return kg >= weightRange[0] && kg <= weightRange[1]
          })
          setTotal(weightFiltered.length)
          const page$ = showAll ? weightFiltered : weightFiltered.slice(page * LIMIT, (page + 1) * LIMIT)
          setResults(page$)
        }
      } catch {
        setResults([])
      }
      setLoading(false)
    }, query.trim() && !generation && !ability && types.length === 0 && !megaOnly ? 350 : 0)

    return () => clearTimeout(timer)
  }, [query, generation, ability, typesKey, megaOnly, hasWeightFilter, weightRange, hasFilter, page, showAll])

  return { results, loading, total, hasFilter }
}

// ─── Pokemon detail for modal ──────────────────────────────────────────────────

export function usePokemonDetail(nameOrId) {
  const [data, setData] = useState(null)
  const [species, setSpecies] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!nameOrId) return
    setLoading(true)
    setData(null)
    setSpecies(null)

    fetch(`${BASE_URL}/pokemon/${nameOrId}`)
      .then(r => r.json())
      .then(async poke => {
        setData(poke)
        const sp = await fetch(poke.species.url).then(r => r.json())
        setSpecies(sp)
        setLoading(false)
      })
  }, [nameOrId])

  return { data, species, loading }
}
