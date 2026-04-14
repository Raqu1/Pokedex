import styles from './StatBar.module.css'

const STAT_LABELS = {
  hp: 'HP',
  attack: 'ATK',
  defense: 'DEF',
  'special-attack': 'SpA',
  'special-defense': 'SpD',
  speed: 'SPE',
}

const STAT_COLORS = {
  hp: '#ff5959',
  attack: '#f5ac78',
  defense: '#fae078',
  'special-attack': '#9db7f5',
  'special-defense': '#a7db8d',
  speed: '#fa92b2',
}

export default function StatBar({ stat }) {
  const name = stat.stat.name
  const value = stat.base_stat
  const pct = Math.min((value / 255) * 100, 100)
  const color = STAT_COLORS[name] ?? '#aaa'

  return (
    <div className={styles.row}>
      <span className={styles.label}>{STAT_LABELS[name] ?? name}</span>
      <span className={styles.value}>{value}</span>
      <div className={styles.bar}>
        <div
          className={styles.fill}
          style={{ width: `${pct}%`, backgroundColor: color }}
        />
      </div>
    </div>
  )
}
