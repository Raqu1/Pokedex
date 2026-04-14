import { useState, useRef, useEffect } from 'react'
import { GENERATION_RANGES } from '../hooks/usePokemon'
import { typeColors } from '../utils/typeColors'
import styles from './SearchFilters.module.css'

const GENERATIONS = Object.keys(GENERATION_RANGES).map(n => ({
  value: Number(n),
  label: `Gen ${['I','II','III','IV','V','VI','VII','VIII','IX'][n - 1]}`,
}))

const TYPE_LABELS = {
  normal: 'Normal', fire: 'Fuego', water: 'Agua', electric: 'Eléctrico',
  grass: 'Planta', ice: 'Hielo', fighting: 'Lucha', poison: 'Veneno',
  ground: 'Tierra', flying: 'Volador', psychic: 'Psíquico', bug: 'Bicho',
  rock: 'Roca', ghost: 'Fantasma', dragon: 'Dragón', dark: 'Siniestro',
  steel: 'Acero', fairy: 'Hada',
}

const TYPES = Object.keys(TYPE_LABELS)

const MAX_WEIGHT = 1000

export default function SearchFilters({ generation, setGeneration, types, toggleType, megaOnly, setMegaOnly, ability, setAbility, abilities, weightRange, setWeightRange }) {
  const [abilityInput, setAbilityInput] = useState(ability)
  const [suggestOpen, setSuggestOpen] = useState(false)
  const abilityWrapRef = useRef(null)

  useEffect(() => { if (!ability) setAbilityInput('') }, [ability])

  useEffect(() => {
    const handler = e => {
      if (abilityWrapRef.current && !abilityWrapRef.current.contains(e.target))
        setSuggestOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const suggestions = abilityInput.length >= 2
    ? abilities.filter(a => a.includes(abilityInput.toLowerCase())).slice(0, 8)
    : []

  const selectAbility = name => {
    setAbility(name)
    setAbilityInput(name)
    setSuggestOpen(false)
  }

  const clearAbility = () => { setAbility(''); setAbilityInput('') }

  const activeCount = [generation, megaOnly, ability].filter(Boolean).length + types.length + (weightRange[0] > 0 || weightRange[1] < MAX_WEIGHT ? 1 : 0)

  const fillLeft = (weightRange[0] / MAX_WEIGHT) * 100
  const fillRight = (weightRange[1] / MAX_WEIGHT) * 100
  const trackFill = `linear-gradient(to right, var(--border) ${fillLeft}%, var(--blue) ${fillLeft}%, var(--blue) ${fillRight}%, var(--border) ${fillRight}%)`

  return (
    <div className={styles.panel}>
      {/* Generation */}
      <section className={styles.section}>
        <span className={styles.sectionLabel}>Generación</span>
        <div className={styles.pills}>
          {GENERATIONS.map(g => (
            <button
              key={g.value}
              className={`${styles.pill} ${generation === g.value ? styles.pillActive : ''}`}
              onClick={() => setGeneration(generation === g.value ? null : g.value)}
            >
              {g.label}
            </button>
          ))}
        </div>
      </section>

      {/* Type */}
      <section className={styles.section}>
        <span className={styles.sectionLabel}>Tipo</span>
        <div className={styles.types}>
          {TYPES.map(t => (
            <button
              key={t}
              className={`${styles.typePill} ${types.includes(t) ? styles.typePillActive : ''}`}
              style={{ '--type-color': typeColors[t], '--type-alpha': typeColors[t] + '33' }}
              onClick={() => toggleType(t)}
            >
              {TYPE_LABELS[t]}
            </button>
          ))}
        </div>
      </section>

      {/* Mega */}
      <section className={styles.section}>
        <span className={styles.sectionLabel}>Forma</span>
        <button
          className={`${styles.pill} ${megaOnly ? styles.pillActive : ''} ${styles.megaPill}`}
          onClick={() => setMegaOnly(!megaOnly)}
        >
          Mega evoluciones
        </button>
      </section>

      {/* Ability */}
      <section className={styles.section}>
        <span className={styles.sectionLabel}>Habilidad</span>
        <div className={styles.abilityRow}>
          <div className={styles.abilityWrap} ref={abilityWrapRef}>
            <input
              className={`${styles.abilityInput} ${ability ? styles.abilityActive : ''}`}
              type="text"
              placeholder="Escribe una habilidad..."
              value={abilityInput}
              onChange={e => {
                setAbilityInput(e.target.value)
                if (ability) setAbility('')
                setSuggestOpen(true)
              }}
              onFocus={() => setSuggestOpen(true)}
            />
            {abilityInput && (
              <button className={styles.clearAbility} onMouseDown={clearAbility}>✕</button>
            )}
            {suggestOpen && suggestions.length > 0 && (
              <ul className={styles.suggestions}>
                {suggestions.map(a => (
                  <li
                    key={a}
                    className={`${styles.suggestion} ${a === ability ? styles.suggestionActive : ''}`}
                    onMouseDown={() => selectAbility(a)}
                  >
                    {a}
                  </li>
                ))}
              </ul>
            )}
          </div>
          {ability && (
            <span className={styles.activePill}>
              {ability} <button onClick={clearAbility}>✕</button>
            </span>
          )}
        </div>
      </section>

      {/* Weight */}
      <section className={styles.section}>
        <span className={styles.sectionLabel}>Peso</span>
        <div className={styles.weightWrap}>
          <div className={styles.sliderTrack} style={{ background: trackFill }}>
            <input
              type="range" min={0} max={MAX_WEIGHT} step={5}
              value={weightRange[0]}
              onChange={e => {
                const val = Math.min(Number(e.target.value), weightRange[1] - 5)
                setWeightRange([val, weightRange[1]])
              }}
            />
            <input
              type="range" min={0} max={MAX_WEIGHT} step={5}
              value={weightRange[1]}
              onChange={e => {
                const val = Math.max(Number(e.target.value), weightRange[0] + 5)
                setWeightRange([weightRange[0], val])
              }}
            />
          </div>
          <div className={styles.weightLabels}>
            <span>{weightRange[0]} kg</span>
            <span>{weightRange[1] >= MAX_WEIGHT ? `${MAX_WEIGHT}+ kg` : `${weightRange[1]} kg`}</span>
          </div>
        </div>
      </section>

      {activeCount > 0 && (
        <button
          className={styles.clearAll}
          onClick={() => { setGeneration(null); TYPES.forEach(t => types.includes(t) && toggleType(t)); setMegaOnly(false); clearAbility(); setWeightRange([0, MAX_WEIGHT]) }}
        >
          Limpiar filtros
        </button>
      )}
    </div>
  )
}
