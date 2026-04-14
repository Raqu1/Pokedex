import { typeColors } from '../utils/typeColors'
import styles from './TypeBadge.module.css'

export default function TypeBadge({ type }) {
  const color = typeColors[type] ?? '#777'
  return (
    <span className={styles.badge} style={{ backgroundColor: color }}>
      {type}
    </span>
  )
}
