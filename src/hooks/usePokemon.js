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

export function usePokemonList(offset = 0) {
  const [pokemon, setPokemon] = useState([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
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
  }, [offset])

  return { pokemon, total, loading }
}

// ─── Infinite scroll ───────────────────────────────────────────────────────────

export function useInfinitePokemon() {
  const [pokemon, setPokemon] = useState([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const offsetRef = useRef(0)
  const hasMore = pokemon.length < total

  const loadMore = useCallback(async () => {
    if (loadingMore) return
    setLoadingMore(true)
    const data = await fetch(`${BASE_URL}/pokemon?limit=${LIMIT}&offset=${offsetRef.current}`).then(r => r.json())
    setTotal(data.count)
    const details = await Promise.all(data.results.map(p => fetch(p.url).then(r => r.json())))
    setPokemon(prev => [...prev, ...details])
    offsetRef.current += LIMIT
    setLoadingMore(false)
  }, [loadingMore])

  useEffect(() => {
    fetch(`${BASE_URL}/pokemon?limit=${LIMIT}&offset=0`)
      .then(r => r.json())
      .then(async data => {
        setTotal(data.count)
        const details = await Promise.all(data.results.map(p => fetch(p.url).then(r => r.json())))
        setPokemon(details)
        offsetRef.current = LIMIT
        setLoading(false)
      })
  }, [])

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

// ─── Advanced search (name partial match + generation + ability) ───────────────

export function useAdvancedSearch({ query, generation, ability, types, megaOnly, weightRange }) {
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
          filtered = filtered.filter(p => {
            if (p.id > 10000) {
              const baseName = p.name.split('-mega')[0]
              const base = allNames.find(b => b.name === baseName)
              return base ? base.id >= min && base.id <= max : false
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

        const sampleSize = hasWeightFilter ? 200 : 40
        const top = filtered.slice(0, sampleSize)

        if (top.length === 0) {
          setResults([])
          setTotal(0)
          setLoading(false)
          return
        }

        const details = await Promise.all(
          top.map(p => fetch(`${BASE_URL}/pokemon/${p.id}`).then(r => r.json()))
        )

        const finalResults = hasWeightFilter
          ? details.filter(p => {
              const kg = p.weight / 10
              return kg >= weightRange[0] && kg <= weightRange[1]
            })
          : details

        setTotal(hasWeightFilter ? finalResults.length : filtered.length)
        setResults(finalResults)
      } catch {
        setResults([])
      }
      setLoading(false)
    }, query.trim() && !generation && !ability && types.length === 0 && !megaOnly ? 350 : 0)

    return () => clearTimeout(timer)
  }, [query, generation, ability, typesKey, megaOnly, hasWeightFilter, weightRange, hasFilter])

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
