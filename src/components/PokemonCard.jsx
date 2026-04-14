import TypeBadge from './TypeBadge'
import { typeGradients } from '../utils/typeColors'
import { typeIconPaths } from '../utils/typeIcons'
import styles from './PokemonCard.module.css'

export default function PokemonCard({ pokemon, onClick }) {
  const primaryType = pokemon.types[0].type.name
  const gradient = typeGradients[primaryType] ?? 'linear-gradient(135deg, #555, #333)'
  const id = String(pokemon.id).padStart(3, '0')
  const img =
    pokemon.sprites.other['official-artwork'].front_default ||
    pokemon.sprites.front_default

  const iconPath = typeIconPaths[primaryType]

  return (
    <article
      className={styles.card}
      style={{ background: gradient }}
      onClick={() => onClick(pokemon)}
    >
      {iconPath && (
        <svg className={styles.typeIcon} viewBox="0 0 512 512" fill="currentColor" aria-hidden="true">
          {iconPath.map((d, i) => (
            <path key={i} d={d} fillRule="evenodd" clipRule="evenodd" />
          ))}
        </svg>
      )}
      <span className={styles.id}>#{id}</span>
      <img
        className={styles.img}
        src={img}
        alt={pokemon.name}
        loading="lazy"
      />
      <div className={styles.info}>
        <h3 className={styles.name}>{pokemon.name}</h3>
        <div className={styles.types}>
          {pokemon.types.map(t => (
            <TypeBadge key={t.type.name} type={t.type.name} />
          ))}
        </div>
      </div>
    </article>
  )
}
