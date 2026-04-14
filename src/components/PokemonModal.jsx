import { useState, useEffect } from 'react'
import { usePokemonDetail } from '../hooks/usePokemon'
import { typeGradients } from '../utils/typeColors'
import TypeBadge from './TypeBadge'
import StatBar from './StatBar'
import styles from './PokemonModal.module.css'

function getSprite(sprites, gender, shiny) {
  const oa = sprites.other?.['official-artwork']
  if (gender === 'female') {
    return shiny
      ? sprites.front_shiny_female || sprites.front_shiny
      : sprites.front_female || sprites.front_default
  }
  return shiny
    ? oa?.front_shiny || sprites.front_shiny
    : oa?.front_default || sprites.front_default
}

export default function PokemonModal({ pokemon, onClose }) {
  const { data, species, loading } = usePokemonDetail(pokemon?.name)
  const [gender, setGender] = useState('male')
  const [shiny, setShiny] = useState(false)

  useEffect(() => {
    setGender('male')
    setShiny(false)
  }, [pokemon?.name])

  useEffect(() => {
    const onKey = e => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  if (!pokemon) return null

  const primaryType = pokemon.types[0].type.name
  const gradient = typeGradients[primaryType] ?? 'linear-gradient(135deg, #555, #333)'
  const id = String(pokemon.id).padStart(3, '0')

  const hasFemale = Boolean(pokemon.sprites.front_female)
  const img = getSprite(pokemon.sprites, gender, shiny)

  const description = species?.flavor_text_entries
    ?.find(e => e.language.name === 'es')?.flavor_text?.replace(/\f/g, ' ')
    ?? species?.flavor_text_entries
    ?.find(e => e.language.name === 'en')?.flavor_text?.replace(/\f/g, ' ')
    ?? ''

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.modal} onClick={e => e.stopPropagation()}>
        <div className={styles.header} style={{ background: gradient }}>
          <button className={styles.close} onClick={onClose}>✕</button>
          <div className={styles.headerTop}>
            <span className={styles.id}>#{id}</span>
            <h2 className={styles.name}>{pokemon.name}</h2>
            <div className={styles.types}>
              {pokemon.types.map(t => (
                <TypeBadge key={t.type.name} type={t.type.name} />
              ))}
            </div>
          </div>
          <img className={`${styles.img} ${shiny ? styles.imgShiny : ''}`} src={img} alt={pokemon.name} />

          {/* Sprite controls */}
          <div className={styles.spriteControls}>
            <div className={styles.toggleGroup}>
              <button
                className={`${styles.spriteBtn} ${gender === 'male' ? styles.spriteBtnActive : ''}`}
                onClick={() => setGender('male')}
                title="Masculino"
              >♂</button>
              <button
                className={`${styles.spriteBtn} ${gender === 'female' ? styles.spriteBtnActive : ''} ${!hasFemale ? styles.spriteBtnDisabled : ''}`}
                onClick={() => hasFemale && setGender('female')}
                title={hasFemale ? 'Femenino' : 'Sin variante femenina'}
              >♀</button>
            </div>
            <div className={styles.toggleGroup}>
              <button
                className={`${styles.spriteBtn} ${!shiny ? styles.spriteBtnActive : ''}`}
                onClick={() => setShiny(false)}
                title="Normal"
              >◆</button>
              <button
                className={`${styles.spriteBtn} ${shiny ? styles.spriteBtnShiny : ''}`}
                onClick={() => setShiny(true)}
                title="Shiny"
              >✦</button>
            </div>
          </div>
        </div>

        <div className={styles.body}>
          {loading ? (
            <div className={styles.spinner} />
          ) : (
            <>
              {description && <p className={styles.description}>{description}</p>}

              <div className={styles.infoGrid}>
                <div className={styles.infoItem}>
                  <span className={styles.infoLabel}>Altura</span>
                  <span className={styles.infoValue}>{(data?.height / 10).toFixed(1)} m</span>
                </div>
                <div className={styles.infoItem}>
                  <span className={styles.infoLabel}>Peso</span>
                  <span className={styles.infoValue}>{(data?.weight / 10).toFixed(1)} kg</span>
                </div>
                <div className={styles.infoItem}>
                  <span className={styles.infoLabel}>Exp. base</span>
                  <span className={styles.infoValue}>{data?.base_experience ?? '—'}</span>
                </div>
                <div className={styles.infoItem}>
                  <span className={styles.infoLabel}>Generación</span>
                  <span className={styles.infoValue}>
                    {species?.generation?.name?.replace('generation-', '').toUpperCase() ?? '—'}
                  </span>
                </div>
              </div>

              {data?.abilities?.length > 0 && (
                <div className={styles.section}>
                  <h4 className={styles.sectionTitle}>Habilidades</h4>
                  <div className={styles.abilities}>
                    {data.abilities.map(a => (
                      <span key={a.ability.name} className={styles.ability}>
                        {a.ability.name}
                        {a.is_hidden && <em> (oculta)</em>}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              <div className={styles.section}>
                <h4 className={styles.sectionTitle}>Estadísticas base</h4>
                {data?.stats?.map(s => (
                  <StatBar key={s.stat.name} stat={s} />
                ))}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
