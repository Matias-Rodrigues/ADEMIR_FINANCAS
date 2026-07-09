type Pesagem = {
  data: string
  peso_kg: number
}

export function GraficoPeso({ pesagens }: { pesagens: Pesagem[] }) {
  if (pesagens.length < 2) {
    return null
  }

  const largura = 320
  const altura = 160
  const preenchimento = 24

  const pesos = pesagens.map((pesagem) => pesagem.peso_kg)
  const pesoMinimo = Math.min(...pesos)
  const pesoMaximo = Math.max(...pesos)
  const variacao = pesoMaximo - pesoMinimo || 1

  const pontos = pesagens.map((pesagem, indice) => {
    const x =
      preenchimento + (indice / (pesagens.length - 1)) * (largura - 2 * preenchimento)
    const y =
      altura -
      preenchimento -
      ((pesagem.peso_kg - pesoMinimo) / variacao) * (altura - 2 * preenchimento)
    return { x, y }
  })

  const pontosSvg = pontos.map((ponto) => `${ponto.x},${ponto.y}`).join(' ')

  return (
    <svg
      viewBox={`0 0 ${largura} ${altura}`}
      className="w-full max-w-sm text-foreground"
      role="img"
      aria-label="Gráfico de evolução de peso"
    >
      <line
        x1={preenchimento}
        y1={altura - preenchimento}
        x2={largura - preenchimento}
        y2={altura - preenchimento}
        stroke="currentColor"
        strokeOpacity={0.2}
      />
      <line
        x1={preenchimento}
        y1={preenchimento}
        x2={preenchimento}
        y2={altura - preenchimento}
        stroke="currentColor"
        strokeOpacity={0.2}
      />
      <polyline points={pontosSvg} fill="none" stroke="currentColor" strokeWidth={2} />
      {pontos.map((ponto, indice) => (
        <circle key={indice} cx={ponto.x} cy={ponto.y} r={3} fill="currentColor" />
      ))}
    </svg>
  )
}
